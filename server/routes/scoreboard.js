/**
 * @module routes/scoreboard
 * @description Public scoreboard endpoints for the MARSEC CTF platform.
 *
 * Provides two read-only endpoints:
 *   1. A global ranking of all teams (the "leaderboard")
 *   2. A per-team submission history with challenge metadata
 *
 * These endpoints are unauthenticated — the scoreboard is publicly visible
 * to all visitors so that spectators and organisers can follow the event
 * in real time.
 */

const express = require('express');
const { db } = require('../db');

const router = express.Router();

// ── Global Ranking ─────────────────────────────────────────────────────────────

/**
 * GET /
 * @description Builds and returns the global team ranking.
 *
 * Ranking algorithm:
 *   1. Primary sort: total_points DESCENDING — the team with the most
 *      points is ranked #1.
 *   2. Tiebreaker: last_solve ASCENDING — when two teams have equal
 *      points, the one who reached that score *earlier* is ranked higher.
 *      This rewards speed and discourages stalling.
 *   3. Teams with no solves (`last_solve === null`) are pushed to the
 *      bottom of the ranking since they have no tiebreaker timestamp.
 *
 * Each team object in the response includes a `rank` field (1-based)
 * assigned after sorting, which the frontend uses for display and for
 * the "LIDER" badge on rank 1.
 *
 * @returns {Array<object>} Sorted array of team ranking objects:
 *   `{ id, name, total_points, challenges_solved, last_solve, rank }`
 */
router.get('/', (req, res) => {
  // ── Compute score metrics for every team ───────────────
  const scores = db.teams.map(team => {
    // Collect all successful submissions for this team
    const subs = db.submissions.filter(s => s.team_id === team.id);

    // Sum all awarded points (already accounts for hint penalties)
    const totalPoints = subs.reduce((sum, s) => sum + s.points_awarded, 0);

    // Find the most recent submission timestamp for tiebreaker purposes
    // Uses string comparison on ISO timestamps (lexicographic = chronological for ISO 8601)
    const lastSolve = subs.length > 0
      ? subs.reduce((latest, s) => s.submitted_at > latest ? s.submitted_at : latest, '')
      : null;

    return {
      id: team.id,
      name: team.name,
      total_points: totalPoints,
      challenges_solved: subs.length,
      last_solve: lastSolve,
    };
  });

  // ── Sort: highest points first, then earliest last_solve ─
  scores.sort((a, b) => {
    // Primary criterion: more points = higher rank
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;

    // Tiebreaker: the team that reached this score earlier wins
    // Teams with no solves are pushed to the bottom
    if (!a.last_solve) return 1;   // a has no solves -> ranks lower
    if (!b.last_solve) return -1;  // b has no solves -> ranks lower
    return new Date(a.last_solve) - new Date(b.last_solve); // Earlier timestamp = higher rank
  });

  // ── Assign 1-based rank after sorting ──────────────────
  scores.forEach((t, i) => { t.rank = i + 1; });
  res.json(scores);
});

// ── Team Submission History ────────────────────────────────────────────────────

/**
 * GET /submissions/:teamId
 * @description Returns the submission history for a specific team, enriched
 * with challenge metadata (title, category, base_points).
 *
 * Each submission record is augmented with:
 *   - challenge_title : display title of the challenge (or "Desconocido"
 *                       if the challenge was deleted after the solve)
 *   - category        : challenge category (or "-" if missing)
 *   - base_points     : original point value before hint penalties, so the
 *                       frontend can show both awarded and possible points
 *
 * Results are sorted newest-first (descending by `submitted_at`) so the
 * most recent solves appear at the top of the history view.
 *
 * @param {string} req.params.teamId - UUID of the team whose history to retrieve
 * @returns {Array<object>} Sorted array of enriched submission records
 */
router.get('/submissions/:teamId', (req, res) => {
  const subs = db.submissions
    // ── Filter to only this team's submissions ───────────
    .filter(s => s.team_id === req.params.teamId)
    // ── Enrich each submission with challenge metadata ───
    .map(s => {
      // Look up the challenge record; may be null if the challenge was deleted
      const ch = db.challenges.find(c => c.id === s.challenge_id);
      return {
        submitted_at: s.submitted_at,
        points_awarded: s.points_awarded,
        hints_used: s.hints_used,
        challenge_title: ch?.title || 'Desconocido',  // Fallback for deleted challenges
        category: ch?.category || '-',                  // Fallback for deleted challenges
        base_points: ch?.points || 0,                   // Fallback for deleted challenges
      };
    })
    // ── Sort newest-first for display ────────────────────
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  res.json(subs);
});

module.exports = router;
