/**
 * @file Admin.jsx
 * @description Administration panel for the MARSEC CTF Platform.
 *
 * Provides a full management interface for competition organisers, with
 * three tabbed sections:
 *
 * 1. **EQUIPOS** (Teams) -- Lists all registered teams with their points,
 *    solved challenge count, and registration date. Each team can be deleted.
 *
 * 2. **RETOS** (Challenges) -- Lists all CTF challenges with order number,
 *    title, category, points, and flag status. Supports:
 *    - **Create**: Opens an inline form to add a new challenge.
 *    - **Edit**: Opens the same form pre-filled with existing data.
 *    - **Delete**: Removes a challenge after confirmation.
 *
 * 3. **CONTROL** -- Danger zone with a full competition reset button that
 *    deletes all teams and submissions (challenges are preserved).
 *    Requires double confirmation to prevent accidental resets.
 *
 * The page also displays aggregate stats at the top (total teams, challenges,
 * submissions, and available points) and uses a flash message system for
 * operation feedback (auto-dismisses after 3.5 seconds).
 *
 * All data is fetched in a single parallel request on mount via `load()`.
 *
 * @see {@link ../lib/api.js} for the HTTP client used by admin endpoints
 * @see {@link ../hooks/useAuth.jsx} for the `logout` function
 * @see {@link ../components/Navbar.jsx} for the admin-variant navigation bar
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';

/**
 * Available challenge categories.
 * These map to the kill-chain phases used in the MARSEC exercise.
 * Order matters -- it determines the display order in the category dropdown.
 *
 * @type {string[]}
 */
const CATEGORIES = ['RECON', 'INTRUSION', 'FORENSICS', 'SIGINT', 'PRIVESC', 'PERSISTENCE', 'CRYPTO'];

/**
 * Human-readable Spanish labels for each category.
 * Used in the challenge table, badges, and the create/edit form dropdown.
 *
 * @type {Object<string, string>}
 */
const CAT_LABELS = {
  RECON: 'Reconocimiento', INTRUSION: 'Intrusion',
  FORENSICS: 'Analisis forense', SIGINT: 'Inteligencia',
  PRIVESC: 'Escalada de privilegios', PERSISTENCE: 'Persistencia',
  CRYPTO: 'Criptoanálisis',
};

/**
 * CSS colour values for each category badge.
 * References CSS custom properties defined in `index.css`.
 *
 * @type {Object<string, string>}
 */
const CAT_COLORS = {
  RECON: 'var(--cat-recon)', INTRUSION: 'var(--cat-intrusion)',
  FORENSICS: 'var(--cat-forensics)', SIGINT: 'var(--cat-sigint)',
  PRIVESC: 'var(--cat-privesc)', PERSISTENCE: 'var(--cat-persistence)',
  CRYPTO: 'var(--cat-crypto)',
};

/**
 * Admin -- Main admin panel component.
 *
 * State:
 * - `tab`        -- Active tab key ('EQUIPOS', 'RETOS', or 'CONTROL').
 * - `teams`      -- Array of team objects from GET /api/admin/teams.
 * - `challenges` -- Array of challenge objects from GET /api/admin/challenges.
 * - `stats`      -- Aggregate stats object from GET /api/admin/stats.
 * - `editing`    -- The id of the challenge currently being edited, or null.
 * - `creating`   -- `true` when the "new challenge" form is open.
 * - `form`       -- Controlled form data for the challenge create/edit form.
 * - `msg`        -- Flash message text (auto-clears after 3.5s).
 *
 * @returns {React.ReactElement} The full admin panel page.
 */
export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('EQUIPOS');
  const [teams, setTeams] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(null);   // Challenge id being edited
  const [creating, setCreating] = useState(false); // Whether the "new" form is open
  const [form, setForm] = useState({});            // Shared form state for create/edit
  const [msg, setMsg] = useState('');              // Flash message text

  /**
   * flash -- Display a temporary feedback message.
   *
   * Sets the `msg` state which renders the `.admin-flash` banner,
   * then automatically clears it after 3.5 seconds.
   *
   * @param {string} m - The message to display.
   */
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  /**
   * load -- Fetch all admin data in a single parallel request.
   *
   * Loads teams, challenges, and stats simultaneously using `Promise.all`.
   * Called on mount and after every CRUD operation to keep the UI in sync.
   *
   * Wrapped in `useCallback` with empty deps for a stable reference.
   *
   * @async
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    try {
      const [t, c, s] = await Promise.all([
        api.get('/admin/teams'),
        api.get('/admin/challenges'),
        api.get('/admin/stats'),
      ]);
      setTeams(t); setChallenges(c); setStats(s);
    } catch {}
  }, []);

  // Fetch all data once on component mount
  useEffect(() => { load(); }, [load]);

  /**
   * handleLogout -- Log out the admin and redirect to the login page.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleLogout = async () => { await logout(); navigate('/login'); };

  /**
   * deleteTeam -- Delete a team and all its submissions.
   *
   * Shows a confirmation dialog before making the DELETE request.
   * After deletion, reloads all data and shows a flash message.
   *
   * @async
   * @param {string} id - The team ID to delete.
   * @returns {Promise<void>}
   */
  const deleteTeam = async (id) => {
    if (!window.confirm('Eliminar este equipo y todas sus submissions?')) return;
    await api.delete(`/admin/teams/${id}`);
    flash('Equipo eliminado');
    load();
  };

  /**
   * deleteChallenge -- Delete a challenge (reto).
   *
   * Shows a confirmation dialog before making the DELETE request.
   *
   * @async
   * @param {string} id - The challenge ID to delete.
   * @returns {Promise<void>}
   */
  const deleteChallenge = async (id) => {
    if (!window.confirm('Eliminar este reto?')) return;
    await api.delete(`/admin/challenges/${id}`);
    flash('Reto eliminado');
    load();
  };

  /**
   * resetAll -- Full competition reset.
   *
   * Deletes all teams, submissions, and hint unlocks. Challenges are preserved.
   * Requires TWO confirmation dialogs to prevent accidental data loss.
   * The server endpoint is POST /api/admin/reset.
   *
   * @async
   * @returns {Promise<void>}
   */
  const resetAll = async () => {
    // First confirmation
    if (!window.confirm('RESETEAR todas las puntuaciones, equipos y submissions?')) return;
    // Second confirmation -- emphasise irreversibility
    if (!window.confirm('Esta accion es irreversible. Confirmar reset completo?')) return;
    await api.post('/admin/reset');
    flash('Competicion reseteada');
    load();
  };

  /**
   * startEdit -- Open the challenge edit form pre-filled with existing data.
   *
   * Sets `editing` to the challenge id and populates `form` with current values.
   * The `flag` field is left empty so the admin must explicitly set a new flag
   * (leaving it blank means "keep the current flag" on the server).
   *
   * @param {Object} c - The challenge object to edit.
   */
  const startEdit = (c) => {
    setEditing(c.id);
    setForm({ title: c.title, description: c.description, category: c.category, points: c.points, flag: '' });
    setCreating(false); // Close the create form if it was open
  };

  /**
   * startCreate -- Open the challenge creation form with empty defaults.
   *
   * Sets default values: category RECON, 100 points.
   * Clears any active edit to avoid form conflicts.
   */
  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ title: '', description: '', category: 'RECON', points: 100, flag: '' });
  };

  /**
   * saveEdit -- Submit the edited challenge data to the server.
   *
   * Calls PUT /api/admin/challenges/:id with the form data.
   * On success, closes the form, shows a flash message, and reloads data.
   *
   * @async
   * @returns {Promise<void>}
   */
  const saveEdit = async () => {
    try {
      await api.put(`/admin/challenges/${editing}`, form);
      flash('Reto actualizado');
      setEditing(null);
      load();
    } catch (e) { flash('Error: ' + e.message); }
  };

  /**
   * saveCreate -- Submit a new challenge to the server.
   *
   * Calls POST /api/admin/challenges with the form data.
   * The server hashes the flag with SHA256 + salt before storing.
   *
   * @async
   * @returns {Promise<void>}
   */
  const saveCreate = async () => {
    try {
      await api.post('/admin/challenges', form);
      flash('Reto creado');
      setCreating(false);
      load();
    } catch (e) { flash('Error: ' + e.message); }
  };

  /** Tab identifiers for the admin panel navigation */
  const TABS = ['EQUIPOS', 'RETOS', 'CONTROL'];

  return (
    <div className="page">
      {/* Navbar with `isAdmin` prop to show admin-specific styling */}
      <Navbar isAdmin />
      <div className="page-body">

        {/* ── Page header with title and logout button ─────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <div>
            <h2 style={{ letterSpacing: '0.04em' }}>Panel de administracion</h2>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              MARSEC — Ejercicio Cyber Range
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Cerrar sesion</button>
        </div>

        {/* ── Flash message banner (auto-clears after 3.5s) ──── */}
        {msg && <div className="admin-flash">{msg}</div>}

        {/* ── Aggregate stats: teams, challenges, submissions, total points ── */}
        {stats && (
          <div className="glass" style={{ display: 'flex', gap: '2.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius)' }}>
            {[
              ['Equipos', stats.totalTeams],
              ['Retos', stats.totalChallenges],
              ['Submissions', stats.totalSubmissions],
              ['Puntos posibles', stats.totalPointsPossible],
            ].map(([l, v], i) => (
              /*
               * Each stat has a staggered fade-in animation (0.1s apart)
               * for a polished loading appearance.
               */
              <div key={l} style={{ animation: 'fadeIn 0.4s ease backwards', animationDelay: `${i * 0.1}s` }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{l}</div>
                <div className="stat-value">{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab navigation: EQUIPOS / RETOS / CONTROL ──────── */}
        <div className="tabs">
          {TABS.map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {/* ── EQUIPOS tab: team management table ──────────────── */}
        {tab === 'EQUIPOS' && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th style={{ textAlign: 'right' }}>Puntos</th>
                  <th style={{ textAlign: 'right' }}>Resueltos</th>
                  <th>Registro</th>
                  <th></th>{/* Actions column (delete button) */}
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    {/* Points displayed in TRUST BLUE with monospace font for visual emphasis */}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--trust-blue)', fontWeight: 700 }}>{t.total_points}</td>
                    <td style={{ textAlign: 'right' }}>{t.challenges_solved}</td>
                    {/* Registration date formatted in Spanish locale (dd/mm/yyyy HH:mm:ss) */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{new Date(t.created_at).toLocaleString('es-ES')}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-danger btn-sm" onClick={() => deleteTeam(t.id)}>Eliminar</button></td>
                  </tr>
                ))}
                {/* Empty state when no teams are registered */}
                {teams.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin equipos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RETOS tab: challenge management table + create/edit form ── */}
        {tab === 'RETOS' && (
          <div>
            {/* "Nuevo reto" button -- opens the creation form */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="btn btn-primary btn-sm" onClick={startCreate}>Nuevo reto</button>
            </div>

            {/*
             * Inline challenge form -- shown when either editing or creating.
             * Shared `ChallengeForm` component handles both modes via the
             * `isNew` prop and the `onSave` callback.
             */}
            {(editing || creating) && (
              <ChallengeForm
                form={form}
                setForm={setForm}
                onSave={editing ? saveEdit : saveCreate}
                onCancel={() => { setEditing(null); setCreating(false); }}
                isNew={creating}
              />
            )}

            {/* Challenge list table */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '3rem' }}>#</th>
                    <th>Titulo</th>
                    <th>Categoria</th>
                    <th style={{ textAlign: 'right' }}>Puntos</th>
                    <th>Flag</th>{/* Shows whether a flag hash is configured */}
                    <th></th>{/* Actions column (edit + delete) */}
                  </tr>
                </thead>
                <tbody>
                  {challenges.map(c => (
                    <tr key={c.id}>
                      {/* Order number from the server (used for manual sorting) */}
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{c.order_num}</td>
                      <td style={{ fontWeight: 500 }}>{c.title}</td>
                      <td><CatBadge cat={c.category} /></td>
                      {/* Point value in TRUST BLUE monospace */}
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--trust-blue)' }}>{c.points}</td>
                      {/*
                       * Flag status indicator:
                       * Green "Configurada" = flag hash exists in the DB.
                       * Red "Sin flag" = no flag set (challenge cannot be solved).
                       */}
                      <td style={{ color: c.hasFlag ? 'var(--success)' : 'var(--error)', fontSize: '0.78rem' }}>
                        {c.hasFlag ? 'Configurada' : 'Sin flag'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm" onClick={() => startEdit(c)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteChallenge(c.id)}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CONTROL tab: danger zone with competition reset ──── */}
        {tab === 'CONTROL' && (
          <div className="card" style={{ maxWidth: 520 }}>
            <h3 style={{ color: 'var(--error)', marginBottom: '0.75rem' }}>Zona de peligro</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.65 }}>
              Elimina todas las submissions y equipos registrados.
              Los retos se mantienen. Requiere doble confirmacion.
            </p>
            <button className="btn btn-danger" onClick={resetAll}>Resetear competicion</button>
          </div>
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
    </div>
  );
}

/**
 * CatBadge -- Renders a coloured category badge for a challenge.
 *
 * Uses `color-mix` to create a semi-transparent background tinted with
 * the category's accent colour, with the accent colour as the text.
 * Falls back to `var(--text-muted)` if the category is unknown.
 *
 * @param {Object} props
 * @param {string} props.cat - Category key (e.g. 'RECON', 'INTRUSION').
 * @returns {React.ReactElement} A `<span>` with the `.badge` class.
 */
function CatBadge({ cat }) {
  const c = CAT_COLORS[cat] || 'var(--text-muted)';
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
      {CAT_LABELS[cat] || cat}
    </span>
  );
}

/**
 * ChallengeForm -- Inline form for creating or editing a CTF challenge.
 *
 * Rendered inside the RETOS tab when either `editing` or `creating` is active.
 * Uses a 2-column CSS grid layout for compact presentation.
 *
 * Fields:
 * - **Titulo** (title) -- Challenge name.
 * - **Categoria** (category) -- Dropdown with all kill-chain categories.
 * - **Puntos** (points) -- Numeric point value.
 * - **Flag** -- The plaintext flag. For edits, leaving this blank preserves
 *   the existing flag hash on the server.
 * - **Descripcion** (description) -- Multi-line textarea for the challenge brief.
 *
 * @param {Object} props
 * @param {Object} props.form           - Controlled form data object.
 * @param {Function} props.setForm      - State setter for the form data.
 * @param {Function} props.onSave       - Callback to save (create or update).
 * @param {Function} props.onCancel     - Callback to close the form without saving.
 * @param {boolean} props.isNew         - `true` for creation mode, `false` for edit mode.
 * @returns {React.ReactElement} The challenge form card.
 */
function ChallengeForm({ form, setForm, onSave, onCancel, isNew }) {
  /**
   * up -- Helper to update a single field in the form object.
   *
   * Uses the functional form of `setForm` to merge the new key-value
   * into the existing form state without losing other fields.
   *
   * @param {string} key - The form field key to update.
   * @param {*} val      - The new value.
   */
  const up = (key, val) => setForm(f => ({ ...f, [key]: val }));
  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--border-hover)' }}>
      {/* Form title changes based on mode */}
      <h3 style={{ marginBottom: '1rem' }}>{isNew ? 'Nuevo reto' : 'Editar reto'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div><label>Titulo</label><input value={form.title} onChange={e => up('title', e.target.value)} /></div>
        <div>
          <label>Categoria</label>
          {/* Dropdown populated from the CATEGORIES constant */}
          <select value={form.category} onChange={e => up('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c] || c}</option>)}
          </select>
        </div>
        <div><label>Puntos</label><input type="number" value={form.points} onChange={e => up('points', parseInt(e.target.value))} /></div>
        <div>
          {/*
           * Flag input.
           * For new challenges: the flag is required.
           * For edits: leaving it blank means "keep the existing flag hash".
           * The placeholder text communicates this behaviour to the admin.
           */}
          <label>Flag {isNew ? '' : '(dejar vacio para no cambiar)'}</label>
          <input
            value={form.flag}
            onChange={e => up('flag', e.target.value)}
            placeholder={isNew ? 'Dato de inteligencia exacto' : 'Sin cambios'}
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        {/* Description spans both grid columns */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Descripcion</label>
          <textarea rows={3} value={form.description} onChange={e => up('description', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button className="btn btn-primary btn-sm" onClick={onSave}>Guardar</button>
        <button className="btn btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
