/**
 * @file main.jsx
 * @description Application entry point for the MARSEC CTF Platform client.
 *
 * This file bootstraps the React application by:
 * 1. Creating a React root attached to the `#root` DOM element in `index.html`.
 * 2. Wrapping the entire component tree in `BrowserRouter` for client-side routing.
 * 3. Wrapping the tree in `AuthProvider` so every component can access
 *    authentication state (user, login, logout, register) via React Context.
 * 4. Importing the global stylesheet (`index.css`) which contains the full
 *    TRUST Lab design system (CSS custom properties, typography, layout).
 *
 * Render order (outermost to innermost):
 *   BrowserRouter -> AuthProvider -> App
 *
 * @see {@link ./App.jsx} for route definitions
 * @see {@link ./hooks/useAuth.jsx} for the AuthProvider / AuthContext
 * @see {@link ./styles/index.css} for the TRUST Lab design system
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import App from './App';
import './styles/index.css';

/**
 * Mount the React application.
 *
 * `createRoot` enables React 18 concurrent features.
 * The `#root` element is defined in `/client/index.html`.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  /* BrowserRouter provides history-based routing (pushState) to all child routes */
  <BrowserRouter>
    {/* AuthProvider must wrap App so that route guards (ProtectedRoute) can read auth state */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
