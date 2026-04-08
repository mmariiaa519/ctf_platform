/**
 * @module Navbar
 * @description Top navigation bar for the MARSEC Cyber Range CTF platform.
 *
 * Renders a sticky header with glassmorphism styling that contains:
 * - Left side: TRUST Lab logo (PNG from Brand Book) + "MARSEC / Ejercicio Cyber Range" title
 * - Right side: either an ADMINISTRADOR badge (admin view) or the team name
 *   with a green online-indicator dot, plus a logout button ("Salir")
 *
 * The navbar uses `position: sticky` with `z-index: 100` so it remains visible
 * above the ParticleBackground canvas and all page content while scrolling.
 *
 * Visual design follows the TRUST Lab Brand Book:
 * - Background: semi-transparent dark gradient with LAB BLUE tint
 * - Border-bottom: subtle TRUST BLUE (#02eef0) separator
 * - Backdrop blur (12px) creates the glassmorphism effect
 *
 * @see ParticleBackground — the animated canvas that sits behind this navbar
 */

import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

/**
 * TrustLabLogo
 * @description Renders the official TRUST Lab logo as a PNG image.
 * The logo file (`/trustlab-logo.png`) is served from the Vite `public/` folder.
 *
 * @param {Object} props
 * @param {number} [props.height=32] - Height in pixels for the logo image.
 *   Width scales proportionally via the browser's intrinsic aspect ratio.
 * @returns {JSX.Element} An <img> element with display:block to remove
 *   inline whitespace artifacts.
 */
function TrustLabLogo({ height = 32 }) {
  return (
    <img
      src="/trustlab-logo.png"
      alt="TRUST Lab"
      height={height}
      style={{ display: 'block' }}
    />
  );
}

/**
 * Navbar
 * @description Main navigation bar component for authenticated views (Dashboard & Admin).
 *
 * Behaviour:
 * - On logout, calls the auth context's `logout()` (clears session cookie)
 *   then navigates to `/login`.
 * - Displays different right-side content depending on whether the current
 *   page is the admin panel (`isAdmin=true`) or the participant dashboard.
 *
 * @param {Object} props
 * @param {boolean} props.isAdmin - When true, shows the "ADMINISTRADOR" badge
 *   instead of the team name. Passed from the parent page component.
 * @returns {JSX.Element} A <nav> element with sticky positioning.
 */
export default function Navbar({ isAdmin }) {
  /**
   * `user` — current authenticated user object from AuthContext.
   *   Contains `teamName`, `teamId`, `isAdmin`, etc.
   * `logout` — async function that POSTs to /auth/logout to destroy the session.
   */
  const { user, logout } = useAuth();

  /** React Router navigation hook, used to redirect after logout. */
  const navigate = useNavigate();

  /**
   * handleLogout
   * Logs the user out by calling the API, then programmatically
   * navigates to the login page. Defined as async to await the
   * server-side session destruction before redirecting.
   */
  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <nav style={{
      /*
       * Glassmorphism background:
       * - 3-stop linear gradient with semi-transparent dark navy on edges
       *   and a faint LAB BLUE (#1625ee at 6% opacity) glow in the center
       * - backdrop-filter blur creates the frosted-glass look
       * - WebkitBackdropFilter for Safari compatibility
       */
      background: 'linear-gradient(90deg, rgba(12, 18, 35, 0.85), rgba(22, 37, 238, 0.06), rgba(12, 18, 35, 0.85))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      /* Thin TRUST BLUE bottom border separates navbar from page content */
      borderBottom: '1px solid rgba(2,238,240,0.10)',
      /* Sticky positioning keeps the navbar at the top on scroll */
      position: 'sticky',
      top: 0,
      /* z-index 100 ensures the navbar floats above the particle canvas (z:0)
         and any other absolutely-positioned elements */
      zIndex: 100,
      /* Soft shadow adds depth separation from the page body */
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.20)',
    }}>
      {/* Inner container: max-width 1200px centered, flex row layout */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '4rem',
        gap: '1rem',
      }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          {/* TRUST Lab logo PNG — `size` prop is passed but component uses `height` */}
          <TrustLabLogo size={42} />
          <div>
            {/* Primary title: "MARSEC" — the exercise/platform codename */}
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#e8eaf6',
              letterSpacing: '0.06em',
              lineHeight: 1.15,
            }}>
              MARSEC
            </div>
            {/* Subtitle: "Ejercicio Cyber Range" — describes the event type (Spanish) */}
            <div style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.03em',
            }}>
              Ejercicio Cyber Range
            </div>
          </div>
        </div>

        {/* Right: nav + user info / admin badge + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {isAdmin ? (
            /*
             * Admin badge: outlined pill in TRUST BLUE.
             * Shown only on the Admin panel page to clearly indicate the
             * elevated-privilege view. Uses border instead of fill to
             * keep it lightweight and distinct from action buttons.
             */
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--trust-blue)',
              letterSpacing: '0.08em',
              border: '1px solid var(--trust-blue)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius)',
            }}>
              ADMINISTRADOR
            </span>
          ) : (
            /*
             * Team indicator (participant view):
             * - Green dot: "online" status indicator (purely decorative —
             *   all authenticated users are considered active).
             * - "Equipo:" label + team name from the session user object.
             */
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
              {/* Green glowing dot — visual cue that the team session is active */}
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--success)',
                display: 'inline-block',
                boxShadow: '0 0 5px var(--success)',
                flexShrink: 0,
              }} />
              {/* "Equipo:" label (Spanish for "Team:") */}
              <span style={{ color: 'var(--text-muted)' }}>Equipo:</span>
              {/* Team name — uses optional chaining since `user` may be null briefly during logout */}
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{user?.teamName}</span>
            </div>
          )}

          {/* Logout button — "Salir" (Spanish for "Exit/Log out").
              Uses the small button variant (btn-sm) from the global stylesheet. */}
          <button className="btn btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </div>
    </nav>
  );
}
