/**
 * @file Register.jsx
 * @description Team registration page for the MARSEC CTF Platform.
 *
 * Renders a branded registration form where a new team can sign up with:
 * - Team name (nombre de equipo) -- 3 to 30 characters.
 * - Password (contrasena) -- minimum 4 characters.
 * - Password confirmation -- must match the password field.
 *
 * On successful registration, the server automatically creates a session
 * (auto-login), so the user is redirected straight to `/dashboard` without
 * needing to visit the login page.
 *
 * Visual design mirrors `Login.jsx`: centred `auth-box` card, TRUST Lab logo,
 * and MARSEC + UPCT institutional footer.
 *
 * @see {@link ../hooks/useAuth.jsx} for the `register` function
 * @see {@link ./Login.jsx} for the companion login page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * TrustLabLogo -- Renders the TRUST Lab brand logo.
 *
 * Identical to the logo component in `Login.jsx`; duplicated here to keep
 * each page self-contained (no shared component for a single `<img>`).
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
 * Register -- Team registration page component.
 *
 * State:
 * - `name`    -- Controlled input for the team name.
 * - `password`-- Controlled input for the desired password.
 * - `confirm` -- Controlled input for the password confirmation.
 * - `error`   -- Error message string (client-side validation or server error).
 * - `loading` -- `true` while the registration request is in-flight.
 *
 * Flow:
 * 1. User fills in all three fields and submits the form.
 * 2. Client-side check: if `password !== confirm`, show an error and abort.
 * 3. Otherwise, call `register(name, password)` from the auth context.
 * 4. On success, navigate to `/dashboard` (the server auto-creates a session).
 * 5. On failure (e.g. team name already taken), display the server error.
 *
 * @returns {React.ReactElement} The registration page UI.
 */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');  // Password confirmation field
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * handleSubmit -- Form submission handler.
   *
   * Validates that the two password fields match before making the API call.
   * This client-side check provides instant feedback without a server round-trip.
   *
   * @param {React.FormEvent} e - The form submit event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation: passwords must match before we hit the server
    if (password !== confirm) return setError('Las contrasenas no coinciden');

    setLoading(true);
    try {
      // POST /api/register creates the team and starts a session (auto-login)
      await register(name, password);
      navigate('/dashboard');
    } catch (err) {
      // Server errors: duplicate team name, validation failures, etc.
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
          <p>Registro de equipo</p>
        </div>

        {/* ── Error banner (only visible when `error` is non-empty) ─ */}
        {error && <div className="auth-error">{error}</div>}

        {/* ── Registration form ──────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Nombre de equipo</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              minLength={3}   // Server also enforces min 3 chars
              maxLength={30}  // Server also enforces max 30 chars
              autoFocus
              placeholder="Nombre del equipo"
            />
          </div>
          <div className="auth-field">
            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={4}   // Server also enforces min 4 chars
            />
          </div>
          <div className="auth-field">
            <label>Confirmar contrasena</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          {/*
           * Submit button.
           * - Full width to match the Login page layout.
           * - Disabled during loading to prevent double-submit.
           * - Shows a spinner in place of text while the request is in-flight.
           */}
          <button className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'REGISTRAR EQUIPO'}
          </button>
        </form>

        {/* ── Link back to login for teams that already have an account ── */}
        <div className="auth-footer">
          Ya tienes cuenta? <Link to="/login">Iniciar sesion</Link>
        </div>

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
