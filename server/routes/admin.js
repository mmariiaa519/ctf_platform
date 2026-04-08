/**
 * @module routes/admin
 * @description Administrative endpoints for managing the MARSEC CTF platform.
 *
 * All routes in this module are protected by the `requireAdmin` middleware,
 * which verifies that `req.session.isAdmin === true` before allowing access.
 * Unauthenticated or non-admin requests receive a 403.
 *
 * Provides full CRUD for challenges and teams, a platform-wide reset, and
 * summary statistics for the admin dashboard.
 *
 * The same `FLAG_SALT` used in the public challenges route is imported from
 * `config.js` to ensure that hashes created here (when an admin sets a flag)
 * can be verified there (when a team submits a flag).
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db, save } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { FLAG_SALT } = require('../config');

/**
 * Produces a hex-encoded SHA-256 hash of a flag.
 *
 * Identical implementation to the one in `routes/challenges.js` — both
 * must use the same salt + algorithm so that hashes created by admins
 * can be verified against team submissions.
 *
 * @param {string} flag - The plaintext flag to hash
 * @returns {string} 64-character lowercase hex digest
 */
const hashFlag = (flag) =>
  crypto.createHash('sha256').update(FLAG_SALT + flag.trim()).digest('hex');

const router = express.Router();

// ── Apply admin-only guard to ALL routes in this router ─────────────────────
// Any request that reaches this router without `req.session.isAdmin === true`
// will be rejected with 403 before any handler executes.
router.use(requireAdmin);

// ══════════════════════════════════════════════════════════════════════════════
// ── Challenges ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /challenges
 * @description Lists all challenges sorted by display order, including
 * metadata needed by the admin panel (title, description, category, points,
 * hint1, order).
 *
 * The actual `flagHash` is **never** returned — only a boolean `hasFlag`
 * indicating whether a flag has been set.  This prevents accidental
 * exposure of hash values even to admin API consumers.
 *
 * The `hasFlag` check also covers the legacy `.flag` property from an
 * older schema where plaintext flags were stored directly.
 *
 * @returns {Array<object>} Sorted array of challenge objects (no flagHash)
 */
router.get('/challenges', (req, res) => {
  const challenges = [...db.challenges]
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
    .map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      points: c.points,
      hint1: c.hint1,
      order_num: c.order_num,
      hasFlag: !!(c.flagHash || c.flag), // Check both new `flagHash` and legacy `flag` property
    }));
  res.json(challenges);
});

/**
 * POST /challenges
 * @description Creates a new challenge.
 *
 * Required fields: title, description, category, points, flag.
 * Optional: hint1 (text shown after unlock, with 50% point penalty).
 *
 * Validation:
 *   - All required fields must be present.
 *   - Points must be an integer between 1 and 10,000 (prevents absurd
 *     values that would break the scoreboard).
 *
 * The `order_num` is auto-incremented: the new challenge is placed after
 * the current highest-ordered challenge.  This means newly created
 * challenges appear at the bottom of the list by default.
 *
 * The plaintext flag is immediately hashed and only the hash is stored.
 * The original cleartext is never persisted to disk.
 *
 * hint2 and hint3 are reserved for future use and initialised as null.
 *
 * @param {string}  req.body.title       - Challenge title
 * @param {string}  req.body.description - Markdown/text description
 * @param {string}  req.body.category    - Category label (auto-uppercased)
 * @param {number}  req.body.points      - Base point value (1-10000)
 * @param {string}  req.body.flag        - Plaintext flag (hashed before storage)
 * @param {string=} req.body.hint1       - Optional hint text
 * @returns {object} `{ success: true, id }` with the new challenge UUID
 */
router.post('/challenges', (req, res) => {
  const { title, description, category, points, flag, hint1 } = req.body;

  // ── Required-field validation ──────────────────────────
  if (!title || !description || !category || !points || !flag) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes' });
  }

  // ── Points range validation ────────────────────────────
  // parseInt with radix 10 to avoid octal/hex interpretation
  const parsedPoints = parseInt(points, 10);
  if (isNaN(parsedPoints) || parsedPoints <= 0 || parsedPoints > 10000) {
    return res.status(400).json({ error: 'Puntos debe ser un numero entre 1 y 10000' });
  }

  // ── Auto-increment order_num ───────────────────────────
  // Find the current maximum order_num and place the new challenge after it
  const maxOrder = db.challenges.reduce((max, c) => Math.max(max, c.order_num || 0), 0);

  const challenge = {
    id: uuidv4(),
    title: title.trim(),
    description: description.trim(),
    category: category.toUpperCase(),    // Normalise category to uppercase for consistent display
    points: parsedPoints,
    flagHash: hashFlag(flag),            // Hash immediately — plaintext flag is never stored
    hint1: hint1?.trim() || null,        // Optional hint; null if empty or not provided
    hint2: null,                         // Reserved for future multi-hint support
    hint3: null,                         // Reserved for future multi-hint support
    order_num: maxOrder + 1,             // Append to end of list
    created_at: new Date().toISOString(),
  };

  db.challenges.push(challenge);
  save('challenges');
  res.json({ success: true, id: challenge.id });
});

/**
 * PUT /challenges/:id
 * @description Partially updates an existing challenge.
 *
 * Only the fields present in the request body are overwritten — all other
 * fields retain their current values.  This "partial update" approach lets
 * admins change just the title or points without needing to re-submit the
 * entire challenge payload.
 *
 * Special handling for the `flag` field:
 *   - If a new flag is provided (non-empty after trim), it is hashed and
 *     stored as `flagHash`.
 *   - The legacy `.flag` property (plaintext) is explicitly deleted to
 *     complete the migration to hashed storage.
 *
 * Points validation (1-10000) is re-applied if points are being changed.
 *
 * @param {string}  req.params.id        - Challenge UUID
 * @param {string=} req.body.title       - New title
 * @param {string=} req.body.description - New description
 * @param {string=} req.body.category    - New category (auto-uppercased)
 * @param {number=} req.body.points      - New base point value
 * @param {string=} req.body.flag        - New plaintext flag (re-hashed)
 * @param {string=} req.body.hint1       - New hint text (or empty to clear)
 * @returns {object} `{ success: true }`
 */
router.put('/challenges/:id', (req, res) => {
  const idx = db.challenges.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reto no encontrado' });

  const { title, description, category, points, flag, hint1 } = req.body;

  // ── Shallow clone the existing challenge ───────────────
  // Work on a copy so we can validate before committing changes
  const updated = { ...db.challenges[idx] };

  // ── Conditionally overwrite each field ─────────────────
  if (title) updated.title = title.trim();
  if (description) updated.description = description.trim();
  if (category) updated.category = category.toUpperCase();
  if (points) {
    const p = parseInt(points, 10);
    if (isNaN(p) || p <= 0 || p > 10000) {
      return res.status(400).json({ error: 'Puntos debe ser un numero entre 1 y 10000' });
    }
    updated.points = p;
  }
  // `hint1 !== undefined` allows explicitly setting hint to empty string (clearing it)
  if (hint1 !== undefined) updated.hint1 = hint1?.trim() || null;
  if (flag?.trim()) {
    updated.flagHash = hashFlag(flag);   // Re-hash with the new plaintext flag
    delete updated.flag;                 // Remove legacy plaintext `.flag` property if it exists
  }

  // ── Commit the update ──────────────────────────────────
  db.challenges[idx] = updated;
  save('challenges');
  res.json({ success: true });
});

/**
 * DELETE /challenges/:id
 * @description Deletes a challenge and cascade-deletes all related data.
 *
 * Cascade targets:
 *   1. Submissions referencing this challenge (so team scores are adjusted)
 *   2. Hint unlocks referencing this challenge
 *   3. The challenge record itself
 *
 * All three collections are saved to ensure consistency.  The cascade
 * prevents orphaned records that would cause errors in the scoreboard
 * or team history views.
 *
 * @param {string} req.params.id - Challenge UUID to delete
 * @returns {object} `{ success: true }`
 */
router.delete('/challenges/:id', (req, res) => {
  const id = req.params.id;

  // ── Cascade delete: remove all related records first ───
  db.submissions = db.submissions.filter(s => s.challenge_id !== id);
  db.hintUnlocks = db.hintUnlocks.filter(h => h.challenge_id !== id);
  db.challenges = db.challenges.filter(c => c.id !== id);

  // ── Persist all affected collections ───────────────────
  save('submissions');
  save('hintUnlocks');
  save('challenges');
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Teams ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /teams
 * @description Returns all registered teams with computed score metrics.
 *
 * For each team the response includes:
 *   - id, name, created_at
 *   - total_points: sum of `points_awarded` across all submissions
 *   - challenges_solved: number of distinct challenge submissions
 *
 * Password hashes are deliberately excluded to prevent accidental leakage
 * even to admin API consumers.
 *
 * @returns {Array<object>} Array of team objects with computed scores
 */
router.get('/teams', (req, res) => {
  res.json(db.teams.map(team => {
    // Collect all submissions belonging to this team
    const subs = db.submissions.filter(s => s.team_id === team.id);
    return {
      id: team.id,
      name: team.name,
      created_at: team.created_at,
      total_points: subs.reduce((sum, s) => sum + s.points_awarded, 0),
      challenges_solved: subs.length,
    };
  }));
});

/**
 * DELETE /teams/:id
 * @description Deletes a team and cascade-deletes all related data.
 *
 * Cascade targets:
 *   1. Submissions by this team (removes their score contributions)
 *   2. Hint unlocks by this team
 *   3. The team record itself
 *
 * This is a hard delete — there is no soft-delete or undo mechanism.
 * All three collections are persisted to maintain consistency.
 *
 * @param {string} req.params.id - Team UUID to delete
 * @returns {object} `{ success: true }`
 */
router.delete('/teams/:id', (req, res) => {
  const id = req.params.id;

  // ── Cascade delete: remove all related records first ───
  db.submissions = db.submissions.filter(s => s.team_id !== id);
  db.hintUnlocks = db.hintUnlocks.filter(h => h.team_id !== id);
  db.teams = db.teams.filter(t => t.id !== id);

  // ── Persist all affected collections ───────────────────
  save('submissions');
  save('hintUnlocks');
  save('teams');
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Platform Reset ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /reset
 * @description Wipes all teams, submissions, and hint unlocks.
 *
 * Challenges are deliberately **preserved** so that the admin does not
 * need to re-create the entire challenge set after a reset.  This is
 * designed for the scenario where a CTF event is re-run (e.g., a second
 * training session) and only the participant data needs clearing.
 *
 * There is no confirmation step on the server — the admin UI should
 * present its own confirmation dialog before calling this endpoint.
 *
 * @returns {object} `{ success: true }`
 */
router.post('/reset', (req, res) => {
  // ── Clear all participant data ─────────────────────────
  db.submissions = [];
  db.hintUnlocks = [];
  db.teams = [];

  // ── Persist empty collections ──────────────────────────
  save('submissions');
  save('hintUnlocks');
  save('teams');
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Dashboard Statistics ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /stats
 * @description Returns summary counters for the admin dashboard.
 *
 * Computed metrics:
 *   - totalTeams           : number of registered teams
 *   - totalChallenges      : number of challenges in the platform
 *   - totalSubmissions     : number of correct flag submissions across all teams
 *   - totalPointsPossible  : sum of base points for all challenges (theoretical
 *                            maximum score if a single team solved everything
 *                            without using any hints)
 *
 * @returns {object} Dashboard summary counters
 */
router.get('/stats', (req, res) => {
  res.json({
    totalTeams: db.teams.length,
    totalChallenges: db.challenges.length,
    totalSubmissions: db.submissions.length,
    totalPointsPossible: db.challenges.reduce((s, c) => s + c.points, 0),
  });
});

module.exports = router;
