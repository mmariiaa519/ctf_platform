/**
 * @module routes/challenges
 * @description Public-facing challenge endpoints for the MARSEC CTF platform.
 *
 * Responsible for:
 *   - Listing all challenges (with per-team solved/hint state)
 *   - Accepting and verifying flag submissions
 *   - Unlocking optional hints (with a point penalty)
 *
 * Security highlights:
 *   - Flag hashes are NEVER sent to the client; verification is server-side only.
 *   - Flag comparison uses `crypto.timingSafeEqual` to prevent timing
 *     side-channel attacks that could leak information about partial matches.
 *   - The shared FLAG_SALT is imported from `config.js` so the same salt is
 *     used for both creating hashes (admin route) and verifying them here.
 *   - Flag submissions are rate-limited (`flagLimiter`) to slow down
 *     automated brute-force attempts.
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db, save } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { flagLimiter } = require('../middleware/rateLimit');
const { FLAG_SALT } = require('../config');

// ── Flag Hashing & Verification Helpers ────────────────────────────────────────

/**
 * Produces a hex-encoded SHA-256 hash of a flag.
 *
 * The salt is **prepended** to the flag (not appended) so that two
 * platforms with different salts always produce different hashes even
 * for identical flag strings.  The flag is trimmed to forgive accidental
 * whitespace in both admin input and team submissions.
 *
 * @param {string} flag - The plaintext flag to hash
 * @returns {string} 64-character lowercase hex digest
 */
const hashFlag = (flag) =>
  crypto.createHash('sha256').update(FLAG_SALT + flag.trim()).digest('hex');

/**
 * Compares a submitted flag against a stored hash in constant time.
 *
 * Why constant-time?  A naive `===` comparison returns `false` as soon as
 * the first differing byte is found.  An attacker measuring response times
 * could deduce how many leading bytes of the hash match, gradually
 * narrowing down the correct flag.  `crypto.timingSafeEqual` always
 * compares every byte, removing this side-channel.
 *
 * The stored hash is validated first (must be exactly 64 hex characters)
 * to guard against corrupt or legacy data that would cause
 * `Buffer.from(..., 'hex')` to throw.
 *
 * @param {string} submitted   - The plaintext flag submitted by a team
 * @param {string} storedHash  - The 64-char hex SHA-256 hash from the challenge record
 * @returns {boolean} `true` if the submitted flag matches the stored hash
 */
const verifyFlag = (submitted, storedHash) => {
  // ── Sanity check: storedHash must be a valid 64-char hex string ──
  if (!storedHash || storedHash.length !== 64) return false;

  const hash = hashFlag(submitted);
  try {
    // ── Constant-time comparison using raw byte buffers ──────────
    // Both values are converted from hex to binary buffers of equal
    // length (32 bytes) so timingSafeEqual can operate correctly.
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch { return false; }
};

/**
 * Calculates the final point award for a challenge submission.
 *
 * Uses a simple binary penalty model:
 *   - No hints used  -> full base points
 *   - Any hint used   -> 50% of base points (floored to an integer)
 *
 * The penalty is intentionally steep (50%) to discourage hint usage and
 * reward teams that solve challenges without assistance.
 *
 * @param {number}  base     - The challenge's base point value
 * @param {boolean} usedHint - Whether the team unlocked any hint for this challenge
 * @returns {number} Final points to award (integer)
 */
const calculatePoints = (base, usedHint) =>
  usedHint ? Math.floor(base * 0.5) : base;

const router = express.Router();

// ── List All Challenges ────────────────────────────────────────────────────────

/**
 * GET /
 * @description Returns every challenge sorted by `order_num`, enriched with
 * per-team state (solved status, hint state, achievable points).
 *
 * For unauthenticated requests (or admin sessions), the solved/hint maps
 * are empty — challenges appear unsolved and without hints.
 *
 * The `flagHash` field is deliberately **excluded** from the response so
 * that flag hashes are never exposed to the client, even in dev-tools.
 *
 * Computed fields per challenge:
 *   - `solved`        : whether the requesting team has already solved it
 *   - `hintUnlocked`  : whether the team has unlocked hint1
 *   - `hint`          : the hint text (only if unlocked), otherwise null
 *   - `maxPoints`     : the maximum points the team can now earn (reduced
 *                        if a hint has been unlocked)
 *
 * @returns {Array<object>} Sorted array of challenge objects
 */
router.get('/', (req, res) => {
  // ── Sort challenges by the admin-defined display order ─
  // Nullish coalescing (?? 0) ensures challenges without order_num
  // default to position 0 rather than sorting unpredictably.
  const challenges = [...db.challenges]
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));

  // ── Build per-team lookup maps for solved & hint state ─
  const solvedMap = {};
  const hintMap = {};

  // Only build maps for real team sessions (not unauthenticated or admin)
  if (req.session?.teamId && req.session.teamId !== 'admin') {
    // Index all submissions by this team keyed on challenge_id for O(1) lookup
    db.submissions
      .filter(s => s.team_id === req.session.teamId)
      .forEach(s => { solvedMap[s.challenge_id] = true; });

    // Index all hint1 unlocks by this team keyed on challenge_id
    db.hintUnlocks
      .filter(h => h.team_id === req.session.teamId && h.hint_number === 1)
      .forEach(h => { hintMap[h.challenge_id] = true; });
  }

  // ── Map to client-safe shape (no flagHash!) ────────────
  res.json(challenges.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    points: c.points,
    order_num: c.order_num,
    placeholder: c.placeholder || null,
    solved: !!solvedMap[c.id],
    hintUnlocked: !!hintMap[c.id],
    hint: hintMap[c.id] ? c.hint1 : null,                  // Only reveal hint text if unlocked
    maxPoints: calculatePoints(c.points, !!hintMap[c.id]),  // Show reduced max if hint was used
  })));
});

// ── Submit a Flag ──────────────────────────────────────────────────────────────

/**
 * POST /submit
 * @description Verifies a flag submission from an authenticated team.
 *
 * Guard rails:
 *   1. Both `challengeId` and `flag` are required.
 *   2. Double-solve prevention: if the team already has a submission for
 *      this challenge, the request is rejected.  This prevents score
 *      inflation and duplicate entries in the submission log.
 *   3. The challenge must exist in the database.
 *   4. Flag verification uses the constant-time `verifyFlag` helper.
 *
 * On a correct flag:
 *   - Checks whether the team used a hint (any hint unlock for this
 *     challenge) and applies the 50% penalty if so.
 *   - Persists a submission record with the awarded points.
 *
 * @param {string} req.body.challengeId - UUID of the challenge
 * @param {string} req.body.flag        - The plaintext flag to verify
 * @returns {object} `{ correct: boolean, message, pointsAwarded? }`
 */
router.post('/submit', requireAuth, flagLimiter, (req, res) => {
  const { challengeId, flag } = req.body;

  // ── Required-field gate ────────────────────────────────
  if (!challengeId || !flag) {
    return res.status(400).json({ error: 'Challenge ID y flag requeridos' });
  }

  // ── Double-solve prevention ────────────────────────────
  // A team can only score a challenge once; repeat submissions are blocked
  if (db.submissions.find(s => s.team_id === req.session.teamId && s.challenge_id === challengeId)) {
    return res.status(400).json({ error: 'Ya has resuelto este reto' });
  }

  // ── Challenge existence check ──────────────────────────
  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) return res.status(404).json({ error: 'Reto no encontrado' });

  // ── Flag verification (constant-time) ──────────────────
  let correct = false;
  if (challenge.flagHash) {
    correct = verifyFlag(flag, challenge.flagHash);
  }

  // ── Wrong flag — return immediately ────────────────────
  if (!correct) return res.json({ correct: false, message: 'Flag incorrecta' });

  // ── Determine hint penalty ─────────────────────────────
  // If the team previously unlocked ANY hint for this challenge, they
  // receive only 50% of the base points as a penalty.
  const usedHint = db.hintUnlocks.some(
    h => h.team_id === req.session.teamId && h.challenge_id === challengeId
  );
  const points = calculatePoints(challenge.points, usedHint);

  // ── Record the successful submission ───────────────────
  db.submissions.push({
    id: uuidv4(),
    team_id: req.session.teamId,
    challenge_id: challengeId,
    points_awarded: points,
    hints_used: usedHint ? 1 : 0,
    submitted_at: new Date().toISOString(),
  });
  save('submissions');

  res.json({ correct: true, message: 'Flag correcta', pointsAwarded: points });
});

// ── Unlock a Hint ──────────────────────────────────────────────────────────────

/**
 * POST /hint
 * @description Unlocks hint1 for a given challenge.  Only a single hint
 * level (hint_number = 1) is currently supported.
 *
 * Constraints:
 *   - The team must NOT have already solved the challenge (no point in
 *     paying a penalty after the flag is already submitted).
 *   - The hint must not already be unlocked (idempotency guard).
 *   - The challenge must exist and must have a non-empty `hint1` value.
 *
 * Unlocking a hint does not immediately deduct points — the penalty is
 * only applied when the team eventually submits the correct flag (see
 * `calculatePoints`).
 *
 * @param {string} req.body.challengeId - UUID of the challenge
 * @returns {object} `{ hint: string, newMaxPoints: number }`
 */
router.post('/hint', requireAuth, (req, res) => {
  const { challengeId } = req.body;

  // ── Required-field gate ────────────────────────────────
  if (!challengeId) return res.status(400).json({ error: 'Challenge ID requerido' });

  // ── Prevent hint unlock after the challenge is already solved ──
  // Once solved, hints serve no purpose and the penalty should not apply retroactively
  if (db.submissions.find(s => s.team_id === req.session.teamId && s.challenge_id === challengeId)) {
    return res.status(400).json({ error: 'Ya has resuelto este reto' });
  }

  // ── Idempotency guard: prevent duplicate hint unlock ───
  if (db.hintUnlocks.find(h =>
    h.team_id === req.session.teamId &&
    h.challenge_id === challengeId &&
    h.hint_number === 1
  )) {
    return res.status(400).json({ error: 'Pista ya desbloqueada' });
  }

  // ── Challenge existence + hint availability check ──────
  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) return res.status(404).json({ error: 'Reto no encontrado' });
  if (!challenge.hint1) return res.status(400).json({ error: 'Pista no disponible' });

  // ── Persist the hint unlock record ─────────────────────
  db.hintUnlocks.push({
    id: uuidv4(),
    team_id: req.session.teamId,
    challenge_id: challengeId,
    hint_number: 1,                       // Only hint level 1 is supported
    unlocked_at: new Date().toISOString(),
  });
  save('hintUnlocks');

  // ── Return hint text and the new maximum achievable points ──
  res.json({
    hint: challenge.hint1,
    newMaxPoints: calculatePoints(challenge.points, true),
  });
});

module.exports = router;
