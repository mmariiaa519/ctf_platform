/**
 * @module middleware/rateLimit
 * @description
 * Rate-limiting middleware for the MARSEC CTF platform.
 *
 * During a CTF exercise, participants may (intentionally or not) try to
 * brute-force flags or flood the authentication endpoints.  These limiters
 * cap the number of attempts per IP address within a sliding time window,
 * returning a 429 "Too Many Requests" response (with a Spanish-language
 * message) once the threshold is exceeded.
 *
 * ── Why two separate limiters? ──────────────────────────────────────────────
 *
 *  • `loginLimiter` — Applied to `/api/auth/login` and `/api/auth/register`.
 *    Authentication endpoints are the primary target for credential-stuffing
 *    and brute-force attacks.  A strict limit of **5 requests / 60 s** makes
 *    automated password guessing impractical while still allowing a human to
 *    mistype a password a few times.
 *
 *  • `flagLimiter`  — Applied to the flag-submission endpoint
 *    (`/api/challenges/:id/submit`).  CTF flags typically have a small
 *    keyspace (e.g. `FLAG{hex}`), so unchecked submission rates could let a
 *    script enumerate answers.  **10 requests / 60 s** is generous enough
 *    for legitimate play (a team solving multiple challenges quickly) but
 *    blocks automated spraying.
 *
 * ── Header configuration ────────────────────────────────────────────────────
 *
 *  • `standardHeaders: true`  — Sends the modern `RateLimit-*` headers
 *    defined in IETF draft-ietf-httpapi-ratelimit-headers:
 *      - `RateLimit-Limit`     → maximum requests in the window
 *      - `RateLimit-Remaining` → requests still available
 *      - `RateLimit-Reset`     → seconds until the window resets
 *    These headers let the frontend (or any API client) display a meaningful
 *    countdown or disable the submit button preemptively.
 *
 *  • `legacyHeaders: false`   — Disables the older, non-standard
 *    `X-RateLimit-*` headers that some libraries still emit by default.
 *    We disable them to keep responses clean and avoid confusing clients
 *    with two competing sets of rate-limit information.
 *
 * ── Implementation note ─────────────────────────────────────────────────────
 * `express-rate-limit` uses an in-memory store by default, which is
 * appropriate here because the platform runs as a single-process Node server
 * (one instance behind Docker).  If the platform were scaled horizontally
 * behind a load balancer, the store would need to be swapped to Redis or
 * another shared backend so counters are consistent across instances.
 * ────────────────────────────────────────────────────────────────────────────
 */

const rateLimit = require('express-rate-limit');

// ── Login / Register limiter ────────────────────────────────────────────────

/**
 * Rate limiter for authentication endpoints (login & register).
 *
 * Allows a maximum of 5 requests per 60-second window per IP address.
 * This is intentionally strict to deter brute-force credential attacks
 * during the exercise.
 *
 * When the limit is exceeded, the response is:
 *   HTTP 429 { "error": "Demasiados intentos de acceso. Espera un minuto." }
 *   ("Too many login attempts. Wait one minute.")
 *
 * @type {import('express').RequestHandler}
 */
const loginLimiter = rateLimit({
  windowMs: 60_000,            // 60-second sliding window
  max: 5,                      // 5 attempts per window per IP
  standardHeaders: true,       // Send modern RateLimit-* headers (Limit, Remaining, Reset)
  legacyHeaders: false,        // Do NOT send deprecated X-RateLimit-* headers
  message: { error: 'Demasiados intentos de acceso. Espera un minuto.' },
});

// ── Flag submission limiter ─────────────────────────────────────────────────

/**
 * Rate limiter for flag-submission endpoints.
 *
 * Allows a maximum of 10 requests per 60-second window per IP address.
 * More permissive than the login limiter because legitimate teams may
 * submit several flags in quick succession when solving a challenge chain,
 * but still low enough to prevent automated flag enumeration.
 *
 * When the limit is exceeded, the response is:
 *   HTTP 429 { "error": "Demasiados intentos. Espera un minuto." }
 *   ("Too many attempts. Wait one minute.")
 *
 * @type {import('express').RequestHandler}
 */
const flagLimiter = rateLimit({
  windowMs: 60_000,            // 60-second sliding window
  max: 10,                     // 10 attempts per window per IP
  standardHeaders: true,       // Send modern RateLimit-* headers (Limit, Remaining, Reset)
  legacyHeaders: false,        // Do NOT send deprecated X-RateLimit-* headers
  message: { error: 'Demasiados intentos. Espera un minuto.' },
});

// ── Public API ──────────────────────────────────────────────────────────────
// Both limiters are exported for use in the Express router setup:
//   router.post('/auth/login',              loginLimiter, loginHandler);
//   router.post('/challenges/:id/submit',   flagLimiter,  submitHandler);
// ────────────────────────────────────────────────────────────────────────────
module.exports = { loginLimiter, flagLimiter };
