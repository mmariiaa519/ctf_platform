/**
 * @module routes/auth
 * @description Authentication routes for the MARSEC CTF platform.
 *
 * Provides team registration, login/logout, session introspection, and
 * administrator authentication.  Every mutable endpoint is protected by
 * the shared `loginLimiter` rate-limiter to prevent brute-force attacks
 * against credentials.
 *
 * Session data stored per-user:
 *   - teamId     {string}  UUID of the authenticated team (or 'admin')
 *   - teamName   {string}  Display name shown in the UI
 *   - isAdmin    {boolean} Flag for administrator privileges
 *   - adminId    {string}  UUID of the admin record (admin sessions only)
 *
 * All error messages are returned in Spanish to match the platform locale.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, save, reload } = require('../db');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// ── Team Registration ──────────────────────────────────────────────────────────

/**
 * POST /register
 * @description Creates a new team account and immediately logs the team in.
 *
 * Validation rules:
 *   1. Name and password are both required.
 *   2. Name must be 3-30 characters after trimming.
 *   3. Name may only contain ASCII letters, digits, extended-Latin Unicode
 *      (U+00C0-U+024F — covers accented chars like a, n, u), spaces,
 *      underscores, and hyphens.  This prevents XSS-prone characters while
 *      still supporting Spanish/European names.
 *   4. Password must be at least 4 characters (deliberately relaxed for a
 *      short-lived CTF event where usability trumps password policy).
 *   5. Team name uniqueness is enforced case-insensitively so that "Alpha"
 *      and "alpha" cannot coexist — avoids scoreboard confusion.
 *
 * On success the new team is persisted to `data/teams.json` and the session
 * is populated so the team lands directly on the dashboard without a
 * separate login step.
 *
 * @param {string} req.body.name     - Desired team name
 * @param {string} req.body.password - Cleartext password (hashed before storage)
 * @returns {object} `{ success: true, teamName }` on success
 */
router.post('/register', loginLimiter, (req, res) => {
  const { name, password } = req.body;

  // ── Required-field gate ────────────────────────────────
  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contrasena requeridos' });
  }

  // ── Name length validation (after whitespace trim) ─────
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 30) {
    return res.status(400).json({ error: 'El nombre debe tener entre 3 y 30 caracteres' });
  }

  // ── Allowed-character whitelist (regex) ────────────────
  // Allows: a-z A-Z 0-9 extended-Latin (accents) space _ -
  if (!/^[a-zA-Z0-9\u00C0-\u024F _-]+$/.test(trimmed)) {
    return res.status(400).json({ error: 'Solo letras, numeros, espacios y guiones' });
  }

  // ── Minimum password length ────────────────────────────
  if (password.length < 4) {
    return res.status(400).json({ error: 'Contrasena: minimo 4 caracteres' });
  }

  // ── Case-insensitive duplicate check ───────────────────
  // Prevents two teams with visually-identical names on the scoreboard
  if (db.teams.find(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: 'Nombre de equipo ya registrado' });
  }

  // ── Build and persist the team record ──────────────────
  const team = {
    id: uuidv4(),
    name: trimmed,
    password: bcrypt.hashSync(password, 10), // bcrypt cost factor 10 (good balance of security vs. speed for a CTF)
    created_at: new Date().toISOString(),
  };
  db.teams.push(team);
  save('teams');

  // ── Auto-login: populate session immediately ───────────
  // So the team does not need to register *then* log in — smoother UX
  req.session.teamId = team.id;
  req.session.teamName = team.name;
  res.json({ success: true, teamName: team.name });
});

// ── Team Login ─────────────────────────────────────────────────────────────────

/**
 * POST /login
 * @description Authenticates a team with name + password credentials.
 *
 * Lookup is case-insensitive (same rule as registration) so teams do not
 * need to remember exact capitalisation.  The password is verified against
 * the stored bcrypt hash.
 *
 * On success the session is populated with the team's id and display name.
 * On failure a generic "incorrect credentials" message is returned — we
 * intentionally do NOT reveal whether the team name exists to avoid
 * enumeration.
 *
 * @param {string} req.body.name     - Team name (case-insensitive)
 * @param {string} req.body.password - Cleartext password to verify
 * @returns {object} `{ success: true, teamName }` on success
 */
router.post('/login', loginLimiter, (req, res) => {
  const { name, password } = req.body;

  // ── Required-field gate ────────────────────────────────
  if (!name || !password) {
    return res.status(400).json({ error: 'Credenciales requeridas' });
  }

  // ── Case-insensitive team lookup ───────────────────────
  const team = db.teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase());

  // ── Credential verification ────────────────────────────
  // Single error message for both "team not found" and "wrong password"
  // so attackers cannot enumerate valid team names
  if (!team || !bcrypt.compareSync(password, team.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // ── Populate session ───────────────────────────────────
  req.session.teamId = team.id;
  req.session.teamName = team.name;
  res.json({ success: true, teamName: team.name });
});

// ── Team Logout ────────────────────────────────────────────────────────────────

/**
 * POST /logout
 * @description Destroys the current express session, effectively logging
 * the team (or admin) out.  The session cookie becomes invalid on the
 * client side after this call.
 *
 * @returns {object} `{ success: true }`
 */
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── Session Introspection ──────────────────────────────────────────────────────

/**
 * GET /me
 * @description Returns the current session state so the frontend can
 * determine whether the user is logged in, which team they belong to,
 * and whether they have admin privileges.
 *
 * Called on every page load by the React AuthContext to hydrate the
 * client-side auth state without requiring a separate token mechanism.
 *
 * @returns {object} Either `{ authenticated: false }` when no session
 *   exists, or `{ authenticated, teamId, teamName, isAdmin }`.
 */
router.get('/me', (req, res) => {
  // ── No active session — unauthenticated ────────────────
  if (!req.session?.teamId) return res.json({ authenticated: false });

  // ── Return session payload ─────────────────────────────
  res.json({
    authenticated: true,
    teamId: req.session.teamId,
    teamName: req.session.teamName,
    isAdmin: req.session.isAdmin || false,
  });
});

// ── Admin Login ────────────────────────────────────────────────────────────────

/**
 * POST /admin/login
 * @description Authenticates a platform administrator.
 *
 * IMPORTANT: `reload('admins')` is called *before* credential checks so
 * that newly-added administrators in `data/admins.json` are recognised
 * without restarting the server.  This is a deliberate trade-off — reading
 * a small JSON file on each admin login attempt is cheap and avoids the
 * operational friction of a restart during a live CTF event.
 *
 * The admin session uses a special `teamId = 'admin'` sentinel value.
 * This value is checked throughout the codebase (e.g. the challenges
 * listing endpoint) to exclude admin activity from team-specific logic
 * like solved-challenge maps.
 *
 * @param {string} req.body.username - Admin username (exact match, case-sensitive)
 * @param {string} req.body.password - Cleartext password to verify
 * @returns {object} `{ success: true }` on success
 */
router.post('/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  // ── Hot-reload admin list from disk ────────────────────
  // Ensures newly added admins work immediately without a server restart
  reload('admins');

  // ── Exact-match username lookup ────────────────────────
  // Admin usernames are case-sensitive (unlike team names)
  const admin = db.admins.find(a => a.username === username);

  // ── Credential verification (bcrypt) ───────────────────
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // ── Populate session with admin privileges ─────────────
  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  req.session.teamId = 'admin';          // Sentinel value — not a real team UUID
  req.session.teamName = 'Administrador'; // Display name shown in the UI header
  res.json({ success: true });
});

module.exports = router;
