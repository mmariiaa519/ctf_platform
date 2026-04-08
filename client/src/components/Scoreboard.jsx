/**
 * @module Scoreboard
 * @description Ranking table that displays all teams sorted by total points.
 *
 * Shown in the "Clasificacion" (Classification/Ranking) tab on the Dashboard page.
 * Renders a styled HTML table with the following columns:
 * | Pos. (rank) | Equipo (team name) | Puntos (points) | Retos (challenges solved) | Ultima flag (last solve time) |
 *
 * Key features:
 * - The #1 ranked team gets a "LIDER" (Leader) badge in TRUST BLUE and a
 *   subtle TRUST BLUE row highlight — but only if they have >0 points.
 * - The current user's own team row gets a LAB BLUE highlight background
 *   and a "(tu equipo)" annotation (Spanish for "your team").
 * - Clicking any team row expands/collapses an inline TeamHistory panel
 *   showing that team's individual flag submissions.
 * - An optional "Actualizar" (Refresh) button triggers `onRefresh` to
 *   reload scoreboard data from the server.
 *
 * @see TeamHistory — the expandable submission history rendered inside the table
 */

import React, { useState } from 'react';
import TeamHistory from './TeamHistory';

/**
 * Scoreboard
 * @description Renders the full scoreboard ranking table with expandable team history.
 *
 * @param {Object} props
 * @param {Array<Object>} props.data - Array of team ranking objects, pre-sorted by the
 *   server. Each object must contain:
 *   - {string} id              — unique team identifier
 *   - {string} name            — team display name
 *   - {number} rank            — 1-based rank position
 *   - {number} total_points    — cumulative score
 *   - {number} challenges_solved — count of solved challenges
 *   - {string|null} last_solve — ISO timestamp of most recent correct submission, or null
 * @param {string} props.myTeamId - The ID of the currently authenticated team.
 *   Used to highlight the user's own row with a different background color
 *   and the "(tu equipo)" label.
 * @param {Function|null} [props.onRefresh] - Optional callback to reload scoreboard data.
 *   When provided, an "Actualizar" (Refresh) button is rendered.
 *   When null/undefined, the button is hidden.
 * @returns {JSX.Element} The scoreboard table UI, or an empty-state message.
 */
export default function Scoreboard({ data, myTeamId, onRefresh }) {
  /**
   * @state {string|null} selectedTeam - The ID of the team whose history is
   * currently expanded, or null if no team history is open.
   * Clicking a row toggles between expanding (set to team.id) and collapsing
   * (set back to null). Only one team's history can be open at a time.
   */
  const [selectedTeam, setSelectedTeam] = useState(null);

  /* Empty state: no teams registered yet.
     "Sin equipos registrados" = "No teams registered" (Spanish).
     Still shows the refresh button if onRefresh is provided. */
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Sin equipos registrados.
        {onRefresh && (
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-sm" onClick={onRefresh}>Actualizar</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Refresh button: right-aligned above the table.
          "Actualizar" = "Refresh/Update" (Spanish).
          Only rendered when the parent passes an onRefresh callback. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        {onRefresh && <button className="btn btn-sm" onClick={onRefresh}>Actualizar</button>}
      </div>

      {/* Table container: dark background with border, matching the design system */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {/* Scoreboard table — uses `.scoreboard-table` class from index.css
            for row styling, hover effects, and font sizing */}
        <table className="scoreboard-table">
          <thead>
            <tr>
              {/* Column headers (Spanish):
                  Pos. = Position/Rank, Equipo = Team, Puntos = Points,
                  Retos = Challenges (solved count), Ultima flag = Last flag (timestamp) */}
              <th style={{ width: '3.5rem', paddingLeft: '1.25rem' }}>Pos.</th>
              <th>Equipo</th>
              <th style={{ textAlign: 'right' }}>Puntos</th>
              <th style={{ textAlign: 'right' }}>Retos</th>
              <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Ultima flag</th>
            </tr>
          </thead>
          <tbody>
            {data.map((team, idx) => {
              /** Whether this row is the currently authenticated user's team */
              const isMe = team.id === myTeamId;

              /**
               * Whether this team holds the #1 rank AND has points > 0.
               * The points check prevents showing the LIDER badge when all teams
               * are at 0 points (e.g., at the start of the exercise before any
               * flags have been submitted).
               */
              const isFirst = team.rank === 1 && team.total_points > 0;
              return (
                /*
                 * React.Fragment with key: needed because each team renders
                 * TWO <tr> elements (the main row + the optional history row).
                 * Fragment allows returning both without a wrapping <div>
                 * (which would be invalid inside <tbody>).
                 */
                <React.Fragment key={team.id}>
                  <tr
                    /* Toggle team history: click to expand, click again to collapse */
                    onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
                    style={{
                      cursor: 'pointer',
                      /*
                       * Row background highlighting:
                       * - #1 team: faint TRUST BLUE glow (rgba 2,238,240 at 7%)
                       * - Current user's team: faint LAB BLUE glow (rgba 22,37,238 at 8%)
                       * - Other teams: default (transparent / inherited from CSS)
                       */
                      background: isFirst
                        ? 'rgba(2,238,240,0.07)'
                        : isMe
                        ? 'rgba(22,37,238,0.08)'
                        : undefined,
                      /* Staggered row entrance animation (40ms delay per row) */
                      animationDelay: `${idx * 0.04}s`,
                    }}
                  >
                    {/* Column 1: Rank number — prefixed with #, monospace font.
                        TRUST BLUE color for the leader, muted gray for others. */}
                    <td style={{ paddingLeft: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: isFirst ? 'var(--trust-blue)' : 'var(--text-muted)', fontSize: '0.88rem' }}>
                      #{team.rank}
                    </td>

                    {/* Column 2: Team name + optional annotations */}
                    <td>
                      {/* Team name: bold if it's the current user's team */}
                      <span style={{ fontWeight: isMe ? 700 : 500 }}>{team.name}</span>
                      {/* "(tu equipo)" annotation — Spanish for "(your team)".
                          Only shown for the authenticated user's own team row. */}
                      {isMe && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(tu equipo)</span>
                      )}
                      {/* "LIDER" badge — Spanish for "LEADER".
                          Only shown for the #1 ranked team with points > 0.
                          Uses `.leader-badge` CSS class: TRUST BLUE pill styling. */}
                      {isFirst && team.total_points > 0 && (
                        <span className="leader-badge">LIDER</span>
                      )}
                    </td>

                    {/* Column 3: Total points — right-aligned, monospace, bold.
                        TRUST BLUE for the leader, default text color for others.
                        toLocaleString() adds thousand separators for large scores. */}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isFirst ? 'var(--trust-blue)' : 'var(--text)', fontSize: '0.92rem' }}>
                      {team.total_points.toLocaleString()}
                    </td>

                    {/* Column 4: Number of challenges solved */}
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {team.challenges_solved}
                    </td>

                    {/* Column 5: Timestamp of the team's most recent correct flag submission.
                        Formatted as HH:MM:SS in Spanish (es-ES) locale.
                        Shows an em-dash "—" if the team has not solved any challenges yet. */}
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {team.last_solve ? new Date(team.last_solve).toLocaleTimeString('es-ES') : '—'}
                    </td>
                  </tr>

                  {/* Expandable team history row:
                      Rendered conditionally when this team's row is clicked (selectedTeam matches).
                      Uses a full-width <td colSpan={5}> to embed the TeamHistory component
                      seamlessly inside the table layout. */}
                  {selectedTeam === team.id && (
                    <tr key={`${team.id}-history`}>
                      <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
                        {/* TeamHistory fetches and displays this team's individual submissions */}
                        <TeamHistory teamId={team.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
