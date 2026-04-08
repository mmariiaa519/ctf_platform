/**
 * @file Login.jsx
 * @description Login page for the MARSEC CTF Platform.
 *
 * Renders a branded authentication form that supports two modes:
 * 1. **Team login** (default) -- authenticates a team via `POST /api/login`
 *    with `{ name, password }`. On success, redirects to `/dashboard`.
 * 2. **Admin login** -- authenticates an administrator via
 *    `POST /api/admin/login` with `{ username, password }`.
 *    On success, redirects to `/admin`.
 *
 * The mode is toggled by a small button at the bottom of the form.
 * The register link is only shown in team mode (admins cannot self-register).
 *
 * Visual design:
 * - Centred card (`auth-box`) over the particle background.
 * - TRUST Lab logo (`trustlab-logo.png`) at the top.
 * - MARSEC + UPCT branding in the footer area.
 * - Spinner replaces button text while the request is in-flight.
 *
 * @see {@link ../hooks/useAuth.jsx} for `login` and `adminLogin` functions
 * @see {@link ../styles/index.css} for `.auth-page`, `.auth-box` styles
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * TrustLabLogo -- Renders the TRUST Lab brand logo as an image.
 *
 * Uses the static asset `/trustlab-logo.png` served from the `public/` folder.
 * The `display: block` style eliminates the default inline whitespace below images.
 *
 * @returns {React.ReactElement} An `<img>` element with the TRUST Lab logo.
 */
function TrustLabLogo() {
  return (
    <img
      src="/trustlab-logo.png"
      alt="TRUST Lab"
      height={40}
      style={{ display: 'block' }}
    />
  );
}

/**
 * Login -- Main login page component.
 *
 * State:
 * - `name`      -- Controlled input for the team name / admin username.
 * - `password`  -- Controlled input for the password.
 * - `error`     -- Error message from a failed login attempt.
 * - `loading`   -- `true` while the login request is in-flight (disables button).
 * - `adminMode` -- Toggles between team login and admin login.
 *
 * Flow:
 * 1. User fills in name + password and submits the form.
 * 2. `handleSubmit` calls either `adminLogin` or `login` from the auth context.
 * 3. On success, `navigate` redirects to the appropriate page.
 * 4. On failure, the server error message is shown in the `.auth-error` div.
 *
 * @returns {React.ReactElement} The login page UI.
 */
export default function Login() {
  const { login, adminLogin } = useAuth();
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Toggle between team and admin login modes
  const [adminMode, setAdminMode] = useState(false);

  /**
   * handleSubmit -- Form submission handler.
   *
   * Prevents default form action, clears previous errors, then dispatches
   * the appropriate login function based on `adminMode`. Navigates on
   * success or captures the error message on failure.
   *
   * @param {React.FormEvent} e - The form submit event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear any previous error before a new attempt
    setLoading(true);
    try {
      if (adminMode) {
        // Admin login uses a separate endpoint and redirects to /admin
        await adminLogin(name, password);
        navigate('/admin');
      } else {
        // Team login redirects to the main CTF dashboard
        await login(name, password);
        navigate('/dashboard');
      }
    } catch (err) {
      // Display the server-provided error message (e.g. "Credenciales invalidas")
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        {/* ── Header with branding ───────────────────────────── */}
        <div className="auth-header">
          <div className="auth-logo-wrap">
            <TrustLabLogo />
          </div>
          <h1>MARSEC &mdash; Ejercicio Cyber Range</h1>
          <p>Acceso de equipos &mdash; Componente Ciber</p>
        </div>

        {/* ── Error banner (only visible when `error` is non-empty) ─ */}
        {error && <div className="auth-error">{error}</div>}

        {/* ── Login form ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            {/* Label changes based on login mode (team name vs admin username) */}
            <label>{adminMode ? 'Usuario' : 'Nombre de equipo'}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder={adminMode ? 'admin' : 'Nombre del equipo'}
            />
          </div>
          <div className="auth-field">
            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {/*
           * Submit button.
           * - Full width for visual emphasis.
           * - Disabled while the request is loading to prevent double-submit.
           * - Shows a small spinner in place of text during loading.
           */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '0.6rem', padding: '0.65rem' }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'ACCEDER'}
          </button>
        </form>

        {/* ── Mode toggle: switch between team login and admin login ── */}
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <button
            className="btn btn-sm"
            style={{ fontSize: '0.72rem' }}
            onClick={() => { setAdminMode(!adminMode); setError(''); }}
          >
            {/* Label flips to show the *other* mode the user can switch to */}
            {adminMode ? 'Acceso de equipo' : 'Acceso administrador'}
          </button>
        </div>

        {/*
         * Registration link -- only shown in team mode.
         * Admins are pre-configured in `data/admins.json` and cannot self-register.
         */}
        {!adminMode && (
          <div className="auth-footer">
            Sin cuenta? <Link to="/register">Registrar equipo</Link>
          </div>
        )}

        {/* ── Institutional footer: TRUST Lab + UPCT branding ─────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          <span>MARSEC Cyber Range &mdash; TRUST Lab</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <img src="/upct-logo.png" alt="UPCT" height={24} style={{ opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}
