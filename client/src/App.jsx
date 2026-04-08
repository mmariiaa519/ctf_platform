/**
 * @file App.jsx
 * @description Root application component that defines all client-side routes
 * and enforces authentication-based access control for the MARSEC CTF Platform.
 *
 * Route map:
 * | Path         | Auth required | Role    | Component   |
 * |--------------|---------------|---------|-------------|
 * | /login       | No            | --      | Login       |
 * | /register    | No            | --      | Register    |
 * | /dashboard   | Yes           | Team    | Dashboard   |
 * | /admin       | Yes           | Admin   | Admin       |
 * | * (catch-all)| --            | --      | Redirect    |
 *
 * If an authenticated user visits /login, they are redirected to their
 * appropriate home page (admin -> /admin, team -> /dashboard).
 * The catch-all route ("*") uses the same logic to redirect unknown paths.
 *
 * The `ParticleBackground` component renders a decorative animated canvas
 * behind all pages for the TRUST Lab visual identity.
 *
 * @see {@link ./hooks/useAuth.jsx} for the `useAuth` hook consumed here
 * @see {@link ./components/ParticleBackground.jsx} for the background animation
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ParticleBackground from './components/ParticleBackground';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';

/**
 * ProtectedRoute -- Route guard for team-only pages.
 *
 * Behaviour:
 * 1. While auth state is still loading (`loading === true`), render a spinner
 *    to avoid a flash of the login page.
 * 2. If no user is authenticated, redirect to /login.
 * 3. If the authenticated user is an admin (not a team), redirect to /admin
 *    so admins cannot accidentally view the team dashboard.
 * 4. Otherwise, render the child component (the protected page).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The page component to render when access is granted.
 * @returns {React.ReactElement} Either a spinner, a redirect, or the protected content.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Show a full-page spinner while the initial auth check (/api/me) is in flight
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  // Not authenticated -- send to login
  if (!user) return <Navigate to="/login" replace />;

  // Admins should not land on /dashboard; redirect them to /admin
  if (user.isAdmin) return <Navigate to="/admin" replace />;

  // User is a regular team -- allow access
  return children;
}

/**
 * App -- Root component rendered inside `<BrowserRouter>` + `<AuthProvider>`.
 *
 * Renders:
 * - A full-viewport particle background (purely decorative, z-index behind content).
 * - A `<Routes>` block with all page routes and their auth logic.
 *
 * Auth-aware redirect logic per route:
 * - `/login`: if already logged in, redirect to the user's home page.
 * - `/register`: if already logged in, redirect to /dashboard.
 * - `/dashboard`: wrapped in `ProtectedRoute` (team-only).
 * - `/admin`: requires `user.isAdmin`; otherwise redirect to /login.
 * - `*` (catch-all): smart redirect based on auth state and role.
 *
 * @returns {React.ReactElement} The full application shell.
 */
export default function App() {
  const { user, loading } = useAuth();

  // Global loading state -- shown once on initial page load while /api/me resolves
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <>
    {/* Animated particle canvas sits behind all page content */}
    <ParticleBackground />
    <Routes>
      {/*
       * /login -- Public route.
       * If the user is already authenticated, redirect them away from login:
       *   - Admins go to /admin
       *   - Teams go to /dashboard
       */}
      <Route path="/login" element={user ? <Navigate to={user.isAdmin ? '/admin' : '/dashboard'} /> : <Login />} />

      {/*
       * /register -- Public route.
       * If the user is already authenticated, no need to register again;
       * redirect straight to /dashboard.
       */}
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

      {/*
       * /dashboard -- Protected team route.
       * ProtectedRoute handles: loading spinner, auth check, admin redirect.
       */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/*
       * /admin -- Admin-only route.
       * Simple inline guard: if user exists and is admin, show Admin page;
       * otherwise redirect to /login. No ProtectedRoute wrapper needed
       * because admins do not go through the same flow as teams.
       */}
      <Route path="/admin" element={user?.isAdmin ? <Admin /> : <Navigate to="/login" />} />

      {/*
       * Catch-all -- Any unrecognized path.
       * Redirects based on current auth state:
       *   - Authenticated admin -> /admin
       *   - Authenticated team  -> /dashboard
       *   - Unauthenticated     -> /login
       */}
      <Route path="*" element={<Navigate to={user ? (user.isAdmin ? '/admin' : '/dashboard') : '/login'} />} />
    </Routes>
    </>
  );
}
