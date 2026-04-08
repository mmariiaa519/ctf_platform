/**
 * @file api.js
 * @description Centralised HTTP client for the MARSEC CTF Platform frontend.
 *
 * Every API call from the React app goes through this module, which provides:
 * - A thin `fetch` wrapper (`request`) that handles JSON serialisation,
 *   Content-Type headers, credential forwarding, and error extraction.
 * - A convenience object (`api`) with `get`, `post`, `put`, and `delete`
 *   methods so callers never need to spell out HTTP verbs manually.
 *
 * All request URLs are prefixed with `/api` so that Vite's development proxy
 * (configured in `vite.config.js`) can forward them to the Express backend
 * running on a different port. In production (Docker), the same `/api` prefix
 * is handled by the server directly.
 *
 * Credentials are sent as `same-origin` (default browser behaviour) so that
 * the session cookie set by `express-session` on the backend is included in
 * every request. This is what keeps the user authenticated across page loads.
 *
 * @example
 * // GET request -- no body
 * const challenges = await api.get('/challenges');
 *
 * // POST request -- with JSON body
 * const result = await api.post('/login', { name: 'TeamAlpha', password: 'secret' });
 *
 * @module lib/api
 */

/**
 * Internal fetch wrapper used by all public `api.*` methods.
 *
 * @async
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} path   - API path *without* the `/api` prefix (e.g. `/login`).
 * @param {Object} [body] - Optional request body; will be JSON-stringified.
 * @returns {Promise<Object>} Parsed JSON response from the server.
 * @throws {Error} If the response status is not 2xx. The error message is
 *   taken from `data.error` (set by the Express API) or falls back to the
 *   HTTP status code.
 */
async function request(method, path, body) {
  // Build fetch options; credentials: 'same-origin' ensures the session cookie is sent
  const opts = {
    method,
    headers: {},
    credentials: 'same-origin',
  };

  // Only attach a JSON body for methods that need one (POST, PUT)
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  // Prefix all paths with `/api` so Vite proxy (dev) or Express (prod) can route them
  const res = await fetch(`/api${path}`, opts);

  // Always parse the response as JSON -- the Express API returns JSON for every endpoint
  const data = await res.json();

  // If the server returned a non-2xx status, throw so callers can catch in try/catch
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

  return data;
}

/**
 * Public API client object.
 *
 * Each method corresponds to an HTTP verb and delegates to `request`.
 * The `path` argument should start with `/` (e.g. `/challenges`, `/login`).
 *
 * @type {Object}
 * @property {function(string): Promise<Object>}         get    - GET request (no body).
 * @property {function(string, Object): Promise<Object>} post   - POST request with JSON body.
 * @property {function(string, Object): Promise<Object>} put    - PUT request with JSON body.
 * @property {function(string): Promise<Object>}         delete - DELETE request (no body).
 */
export const api = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  delete: (path)       => request('DELETE', path),
};
