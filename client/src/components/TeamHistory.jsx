/**
 * @module TeamHistory
 * @description Expandable submission history panel for a single team.
 *
 * This component is rendered inline inside the Scoreboard table when a user
 * clicks on a team row. It fetches and displays that team's individual
 * correct flag submissions in a compact sub-table.
 *
 * Table columns:
 * | Reto (Challenge title) | Categoria (Category) | Puntos (Points) | Hora (Time) |
 *
 * Data flow:
 * 1. On mount (or when `teamId` changes), fetches submissions from
 *    `GET /scoreboard/submissions/:teamId`.
 * 2. While loading, shows a centered spinner.
 * 3. If no submissions exist, shows "Sin flags enviadas" (No flags submitted).
 * 4. Otherwise, renders the submissions table with TRUST BLUE point values
 *    and Spanish-locale timestamps.
 *
 * Note: The hint column was intentionally removed during the TRUST Lab redesign
 * since the hints system is not exposed in the participant UI.
 *
 * @see Scoreboard — the parent component that renders TeamHistory inside table rows
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

/**
 * TeamHistory
 * @description Fetches and displays the submission history for a specific team.
 *
 * This is a self-contained data-fetching component: it manages its own loading
 * state and API call. It does NOT receive submission data as props — instead it
 * fetches on mount based on the `teamId` prop.
 *
 * @param {Object} props
 * @param {string} props.teamId - The unique identifier of the team whose
 *   submission history should be displayed. When this prop changes (unlikely
 *   in normal use since Scoreboard unmounts/remounts via React.Fragment key),
 *   the effect re-fetches data for the new team.
 * @returns {JSX.Element} A loading spinner, empty-state message, or a sub-table
 *   of flag submissions.
 */
export default function TeamHistory({ teamId }) {
  /**
   * @state {Array<Object>} subs - Array of submission objects fetched from the API.
   * Each object contains:
   * - {string} challenge_title — display name of the solved challenge
   * - {string} category        — challenge category key (e.g., "RECON")
   * - {number} points_awarded  — points the team earned for this solve
   * - {string} submitted_at    — ISO 8601 timestamp of the submission
   */
  const [subs, setSubs] = useState([]);

  /**
   * @state {boolean} loading - True while the API request is in-flight.
   * Controls whether the spinner or the content/empty-state is rendered.
   */
  const [loading, setLoading] = useState(true);

  /**
   * Effect: fetch submission history from the server when the component mounts
   * or when `teamId` changes.
   *
   * Endpoint: GET /scoreboard/submissions/:teamId
   * - On success: populates `subs` with the returned array.
   * - On error (network failure, 404, etc.): silently sets `subs` to an empty
   *   array, which triggers the "Sin flags enviadas" empty state.
   * - Finally: sets loading to false regardless of outcome.
   */
  useEffect(() => {
    setLoading(true);
    api.get(`/scoreboard/submissions/${teamId}`)
      .then(setSubs)
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [teamId]);

  /* Loading state: show a centered spinner while the API call is in progress.
     Uses the global `.spinner` CSS class (animated rotating circle). */
  if (loading) return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <span className="spinner" />
    </div>
  );

  /* Empty state: team has not submitted any correct flags yet.
     "Sin flags enviadas" = "No flags submitted" (Spanish). */
  if (!subs.length) return (
    <div style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
      Sin flags enviadas.
    </div>
  );

  return (
    /* Container: slightly darker background (--bg-tertiary) to visually
       distinguish the history panel from the main scoreboard rows above it.
       Padding provides breathing room around the sub-table. */
    <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem 1.25rem 1rem' }}>
      {/* Section header: "Historial de flags" = "Flag history" (Spanish).
          Uppercase, small font, muted color — acts as a subtle label. */}
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
        Historial de flags
      </div>
      <table>
        <thead>
          <tr>
            {/* Column headers (Spanish):
                Reto = Challenge, Categoria = Category,
                Puntos = Points, Hora = Time */}
            <th>Reto</th>
            <th>Categoria</th>
            <th style={{ textAlign: 'right' }}>Puntos</th>
            <th style={{ textAlign: 'right' }}>Hora</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s, i) => (
            /* Key uses array index since submissions don't have unique IDs
               and the list is fetched fresh each time (no reordering risk). */
            <tr key={i}>
              {/* Challenge title: medium weight for readability */}
              <td style={{ fontWeight: 500 }}>{s.challenge_title}</td>

              {/* Category: raw category string from the server (e.g., "RECON").
                  Displayed in small, muted text since the badge styling is
                  reserved for the main ChallengeList table. */}
              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.category}</td>

              {/* Points awarded: right-aligned, monospace, bold, TRUST BLUE (#02eef0).
                  The accent color draws attention to point values, which are the
                  primary metric participants track. */}
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--trust-blue)' }}>
                {s.points_awarded}
              </td>

              {/* Submission timestamp: formatted as HH:MM:SS in Spanish locale (es-ES).
                  Uses toLocaleTimeString for locale-appropriate formatting.
                  Only the time is shown (not the date) since the exercise is single-day. */}
              <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {new Date(s.submitted_at).toLocaleTimeString('es-ES')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
