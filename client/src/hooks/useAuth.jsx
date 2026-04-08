/**
 * @file useAuth.jsx
 * @description Authentication context and provider for the MARSEC CTF Platform.
 *
 * Implements the standard React Context + Provider pattern to share
 * authentication state across the entire component tree without prop drilling.
 *
 * How it works:
 * 1. `AuthProvider` wraps the app (in `main.jsx`) and holds the canonical
 *    `user` and `loading` state.
 * 2. On mount, `checkAuth` calls `GET /api/me` to see if the browser already
 *    has a valid session cookie. If so, the user object is populated
 *    immediately (seamless refresh / page-reload experience).
 * 3. `login`, `register`, and `adminLogin` each POST credentials, then call
 *    `checkAuth` again to synchronise the context with the new session.
 * 4. `logout` POSTs to `/api/logout` (which destroys the server session)
 *    and clears the local `user` state.
 * 5. Any component can consume the context via the `useAuth()` hook.
 *
 * Context shape exposed to consumers:
 * ```
 * {
 *   user:       Object | null,   // { teamId, name, isAdmin, authenticated }
 *   loading:    boolean,          // true while the initial /me check runs
 *   login:      (name, password) => Promise,
 *   register:   (name, password) => Promise,
 *   adminLogin: (username, password) => Promise,
 *   logout:     () => Promise,
 * }
 * ```
 *
 * @module hooks/useAuth
 * @see {@link ../lib/api.js} for the HTTP client used by all auth methods
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * React Context that holds authentication state.
 * Initialised to `null`; the actual value is set by `AuthProvider`.
 *
 * @type {React.Context<Object|null>}
 */
const AuthContext = createContext(null);

/**
 * AuthProvider -- Context provider component that manages authentication state.
 *
 * Must wrap all components that need access to `useAuth()`.
 * Placed in `main.jsx` around `<App />`.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child component tree.
 * @returns {React.ReactElement} The context provider with auth value.
 */
export function AuthProvider({ children }) {
  /**
   * The authenticated user object, or `null` if not logged in.
   * Shape: `{ teamId, name, isAdmin, authenticated }` (from GET /api/me).
   */
  const [user, setUser] = useState(null);

  /**
   * `true` until the initial auth check (`checkAuth`) completes.
   * While `loading` is true, route guards show a spinner instead of
   * prematurely redirecting to /login.
   */
  const [loading, setLoading] = useState(true);

  /**
   * checkAuth -- Verifies whether the current browser session is still valid.
   *
   * Calls `GET /api/me`. If the server returns `{ authenticated: true, ... }`,
   * the user state is populated. Otherwise (expired session, no cookie), user
   * is set to `null`.
   *
   * Wrapped in `useCallback` with an empty dependency array so the function
   * reference is stable and safe to include in `useEffect` deps.
   *
   * @async
   * @returns {Promise<void>}
   */
  const checkAuth = useCallback(async () => {
    try {
      const data = await api.get('/me');
      // The server returns `authenticated: true` when the session is valid
      setUser(data.authenticated ? data : null);
    } catch {
      // Network error or 401 -- treat as unauthenticated
      setUser(null);
    } finally {
      // Mark the initial loading phase as complete regardless of outcome
      setLoading(false);
    }
  }, []);

  // Run the auth check once on mount (empty deps via stable `checkAuth` ref)
  useEffect(() => { checkAuth(); }, [checkAuth]);

  /**
   * login -- Authenticate a team with name + password.
   *
   * The server creates an express-session and sets a cookie.
   * After a successful POST, `checkAuth` is called to pull the full
   * user object into context so route guards react immediately.
   *
   * @async
   * @param {string} name     - Team name (nombre de equipo).
   * @param {string} password - Team password (contrasena).
   * @returns {Promise<Object>} Server response from POST /api/login.
   * @throws {Error} If credentials are invalid or the server returns an error.
   */
  const login = async (name, password) => {
    const data = await api.post('/login', { name, password });
    await checkAuth(); // Sync context with the newly created session
    return data;
  };

  /**
   * register -- Create a new team account and auto-login.
   *
   * After successful registration, the server automatically starts a session,
   * so `checkAuth` picks up the new user without a separate login call.
   *
   * @async
   * @param {string} name     - Desired team name (3-30 chars).
   * @param {string} password - Desired password (min 4 chars).
   * @returns {Promise<Object>} Server response from POST /api/register.
   * @throws {Error} If the team name is taken or validation fails.
   */
  const register = async (name, password) => {
    const data = await api.post('/register', { name, password });
    await checkAuth(); // Sync context with the newly created session
    return data;
  };

  /**
   * adminLogin -- Authenticate an administrator.
   *
   * Uses a separate endpoint (`/admin/login`) because admin credentials
   * are stored in `data/admins.json`, not in the teams file.
   *
   * @async
   * @param {string} username - Admin username.
   * @param {string} password - Admin password.
   * @returns {Promise<Object>} Server response from POST /api/admin/login.
   * @throws {Error} If credentials are invalid.
   */
  const adminLogin = async (username, password) => {
    const data = await api.post('/admin/login', { username, password });
    await checkAuth(); // Sync context with the admin session
    return data;
  };

  /**
   * logout -- Destroy the current session and clear client state.
   *
   * POSTs to `/api/logout` which calls `req.session.destroy()` on the server.
   * Then immediately sets `user` to `null` so the UI reacts without waiting
   * for another `checkAuth` round-trip.
   *
   * @async
   * @returns {Promise<void>}
   */
  const logout = async () => {
    await api.post('/logout');
    setUser(null); // Immediately clear -- no need to re-check /me
  };

  return (
    /* Provide the auth state and action functions to the entire component tree */
    <AuthContext.Provider value={{ user, loading, login, register, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth -- Custom hook to consume authentication context.
 *
 * Must be called inside a component wrapped by `<AuthProvider>`.
 * Returns the full context value: `{ user, loading, login, register, adminLogin, logout }`.
 *
 * @returns {Object} The current auth context value.
 *
 * @example
 * const { user, logout } = useAuth();
 * if (user) console.log(`Logged in as ${user.name}`);
 */
export const useAuth = () => useContext(AuthContext);
