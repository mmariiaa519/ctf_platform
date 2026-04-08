/**
 * @module middleware/auth
 * @description
 * Express middleware for authentication and authorization on the MARSEC CTF
 * platform.
 *
 * The platform has two privilege levels:
 *  1. **Team member** — any logged-in participant (session contains `teamId`).
 *  2. **Admin** — a platform administrator (session contains `isAdmin: true`).
 *
 * ── How sessions are established ────────────────────────────────────────────
 *  • Team login / register  → `req.session.teamId` is set to the team's UUID.
 *  • Admin login             → `req.session.isAdmin` is set to `true`.
 *
 * These values live in an `express-session` store (in-memory by default).
 * The session ID is sent to the browser as an HTTP-only cookie, so all
 * subsequent requests from that browser carry the session automatically.
 *
 * ── Why optional chaining (`?.`) ────────────────────────────────────────────
 * `req.session` can theoretically be `undefined` if the session middleware
 * has not run yet (misconfigured middleware order) or if the session store
 * is unreachable.  Using `req.session?.teamId` instead of
 * `req.session.teamId` prevents a hard crash (`TypeError: Cannot read
 * properties of undefined`) and lets the guard gracefully return a 401/403
 * instead.  This is a defensive-programming best practice for middleware
 * that may be mounted in varied configurations.
 * ────────────────────────────────────────────────────────────────────────────
 */

module.exports = {
  /**
   * Ensures the request comes from an authenticated team.
   *
   * Checks for `req.session.teamId`, which is set during the login or
   * register flow in the auth routes.  If absent, the user has not
   * authenticated (or their session expired), so we reject with 401.
   *
   * Used on all routes that require a logged-in participant:
   *  - Viewing challenges
   *  - Submitting flags
   *  - Viewing the scoreboard (authenticated view)
   *
   * @param {import('express').Request}  req  - Express request object.
   * @param {import('express').Response} res  - Express response object.
   * @param {import('express').NextFunction} next - Passes control to the
   *        next middleware/route handler when the session is valid.
   * @returns {void|Response} 401 JSON error if unauthenticated, otherwise
   *          calls `next()`.
   */
  requireAuth(req, res, next) {
    // Optional chaining guards against a missing session object (see module docblock).
    if (!req.session?.teamId) {
      return res.status(401).json({ error: 'Sesion no valida' }); // "Invalid session" — shown in the frontend toast
    }
    next();
  },

  /**
   * Ensures the request comes from a platform administrator.
   *
   * Checks for `req.session.isAdmin`, which is set during the admin login
   * flow (separate from team auth).  If absent or falsy, the user is not
   * an admin, so we reject with 403 Forbidden.
   *
   * Used on all admin-only routes:
   *  - Creating / editing / deleting challenges
   *  - Viewing admin dashboard statistics
   *  - Resetting submissions
   *
   * @param {import('express').Request}  req  - Express request object.
   * @param {import('express').Response} res  - Express response object.
   * @param {import('express').NextFunction} next - Passes control to the
   *        next middleware/route handler when the session belongs to an admin.
   * @returns {void|Response} 403 JSON error if not admin, otherwise
   *          calls `next()`.
   */
  requireAdmin(req, res, next) {
    // Optional chaining guards against a missing session object (see module docblock).
    if (!req.session?.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' }); // "Access denied" — non-admin or expired session
    }
    next();
  },
};
