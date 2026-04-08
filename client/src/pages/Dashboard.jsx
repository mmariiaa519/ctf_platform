/**
 * @file Dashboard.jsx
 * @description Main CTF dashboard page for authenticated teams.
 *
 * This is the primary view participants use during the MARSEC exercise.
 * It is structured as a tabbed layout with two sections:
 *
 * 1. **Objetivos** (tab id: `RETOS`) -- A table listing all challenges (retos),
 *    their categories, point values, and solved status. Clicking a challenge
 *    opens a `ChallengeModal` where the team can submit a flag.
 *
 * 2. **Clasificacion** (tab id: `SCOREBOARD`) -- A live scoreboard showing
 *    all teams ranked by total points.
 *
 * Above the tabs, a stats bar shows the current team's progress:
 * solved count, score, ranking position, and total available points.
 *
 * Data fetching:
 * - Challenges and scoreboard are loaded in parallel on mount.
 * - The scoreboard auto-refreshes every 30 seconds via `setInterval`.
 * - After a successful flag submission (`onSolve`), both lists are reloaded.
 *
 * The page also supports a URL query parameter `?tab=scoreboard` to
 * deep-link directly to the scoreboard tab.
 *
 * @see {@link ../components/ChallengeCard.jsx} for the `ChallengeList` table
 * @see {@link ../components/ChallengeModal.jsx} for the flag submission modal
 * @see {@link ../components/Scoreboard.jsx} for the scoreboard component
 * @see {@link ../components/Navbar.jsx} for the top navigation bar
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import ChallengeList from '../components/ChallengeCard';
import ChallengeModal from '../components/ChallengeModal';
import Scoreboard from '../components/Scoreboard';

/**
 * Tab definitions for the dashboard.
 * - `id` is the internal key used in state.
 * - `label` is the user-facing text (Spanish: "Objetivos" / "Clasificacion").
 *
 * @type {Array<{id: string, label: string}>}
 */
const TABS = [
  { id: 'RETOS', label: 'Objetivos' },
  { id: 'SCOREBOARD', label: 'Clasificacion' },
];

/**
 * Dashboard -- Main authenticated team view.
 *
 * State:
 * - `tab`         -- Currently active tab id ('RETOS' or 'SCOREBOARD').
 * - `challenges`  -- Array of challenge objects from GET /api/challenges.
 * - `scoreboard`  -- Array of team score objects from GET /api/scoreboard.
 * - `selected`    -- The challenge object currently open in the modal, or null.
 * - `loading`     -- `true` until the initial data fetch completes.
 *
 * @returns {React.ReactElement} The dashboard page with stats, tabs, and content.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();

  // Allow deep-linking to the scoreboard tab via URL query parameter: ?tab=scoreboard
  const defaultTab = location.search.includes('tab=scoreboard') ? 'SCOREBOARD' : 'RETOS';
  const [tab, setTab] = useState(defaultTab);

  // ── Data state ────────────────────────────────────────────────
  const [challenges, setChallenges] = useState([]);
  const [scoreboard, setScoreboard] = useState([]);
  const [selected, setSelected] = useState(null);   // Challenge shown in modal
  const [loading, setLoading] = useState(true);

  /**
   * loadChallenges -- Fetches the full challenge list for the current team.
   *
   * The server returns each challenge with a `solved` boolean indicating
   * whether this team has already submitted the correct flag.
   *
   * Wrapped in `useCallback` with empty deps so the reference is stable
   * for inclusion in the `useEffect` dependency array.
   *
   * @async
   * @returns {Promise<void>}
   */
  const loadChallenges = useCallback(async () => {
    try { setChallenges(await api.get('/challenges')); } catch {}
  }, []);

  /**
   * loadScoreboard -- Fetches the current scoreboard (all teams, ranked).
   *
   * Called on mount and every 30 seconds to keep the ranking live.
   *
   * @async
   * @returns {Promise<void>}
   */
  const loadScoreboard = useCallback(async () => {
    try { setScoreboard(await api.get('/scoreboard')); } catch {}
  }, []);

  /**
   * Initial data fetch + polling setup.
   *
   * - On mount: loads challenges and scoreboard in parallel, then sets
   *   `loading` to false.
   * - Sets a 30-second interval to refresh the scoreboard, so teams see
   *   near-real-time ranking updates without manual refresh.
   * - Cleanup: clears the interval when the component unmounts (e.g.
   *   when the user logs out or navigates away).
   *
   * Dependencies: `loadChallenges` and `loadScoreboard` are stable callbacks
   * so this effect runs exactly once on mount.
   */
  useEffect(() => {
    Promise.all([loadChallenges(), loadScoreboard()]).then(() => setLoading(false));
    const interval = setInterval(() => { loadScoreboard(); }, 30000);
    return () => clearInterval(interval);
  }, [loadChallenges, loadScoreboard]);

  // ── Derived stats for the stats bar ───────────────────────────

  /** Find the current team's entry in the scoreboard array */
  const mySb = scoreboard.find(t => t.id === user?.teamId);

  /** Current team's 1-based rank (0 if not found, displayed as '-') */
  const myRank = scoreboard.findIndex(t => t.id === user?.teamId) + 1;

  /** Number of challenges this team has solved */
  const solvedCount = challenges.filter(c => c.solved).length;

  /** Sum of all challenge point values (total available points in the CTF) */
  const totalPts = challenges.reduce((s, c) => s + c.points, 0);

  /**
   * onSolve -- Callback invoked by ChallengeModal after a successful flag submission.
   *
   * Refreshes both the challenge list (to update solved status) and the
   * scoreboard (to update rankings), then closes the modal.
   */
  const onSolve = () => {
    loadChallenges();
    loadScoreboard();
    setSelected(null);
  };

  return (
    <div className="page">
      {/* Top navigation bar with brand logo and logout */}
      <Navbar />

      {/* ── Stats bar: 4 summary metrics for the current team ─────── */}
      <div className="stats-bar">
        <div className="stats-bar-inner">
          {[
            { label: 'Retos resueltos', value: `${solvedCount} / ${challenges.length}` },
            { label: 'Puntuacion', value: mySb?.total_points ?? 0 },
            { label: 'Posicion', value: myRank > 0 ? `#${myRank}` : '-' },
            { label: 'Puntos disponibles', value: totalPts },
          ].map((s, i) => (
            /*
             * Each stat item has a staggered fade-in animation.
             * The `animationDelay` is incremented by 0.1s per item
             * to create a cascading reveal effect on page load.
             */
            <div className="stat-item" key={s.label} style={{ animation: 'fadeIn 0.4s ease backwards', animationDelay: `${i * 0.1}s` }}>
              <label>{s.label}</label>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────────────── */}
      <div className="page-body">
        {/* Tab buttons: Objetivos (challenges) and Clasificacion (scoreboard) */}
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content area: show spinner during initial load, then the active tab */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : (
          <>
            {/* Objetivos tab: table of challenges with click-to-open modal */}
            {tab === 'RETOS' && (
              <ChallengeList challenges={challenges} onSelect={setSelected} />
            )}
            {/* Clasificacion tab: live scoreboard with manual refresh button */}
            {tab === 'SCOREBOARD' && (
              <Scoreboard data={scoreboard} myTeamId={user?.teamId} onRefresh={loadScoreboard} />
            )}
          </>
        )}
      </div>

      {/* ── Institutional footer: TRUST Lab + UPCT ──────────────── */}
      <footer className="page-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>MARSEC Cyber Range &mdash; TRUST Lab</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <img src="/upct-logo.png" alt="Universidad Politecnica de Cartagena" height={32} style={{ opacity: 0.7 }} />
        </div>
      </footer>

      {/*
       * Challenge detail modal.
       * Rendered conditionally when a challenge is selected (clicked from the table).
       * Contains the challenge description and a flag submission form.
       * `onClose` clears the selection; `onSolve` refreshes data and closes.
       */}
      {selected && (
        <ChallengeModal
          challenge={selected}
          onClose={() => setSelected(null)}
          onSolve={onSolve}
        />
      )}
    </div>
  );
}
