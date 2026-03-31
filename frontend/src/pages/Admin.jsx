import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ActivityFeed from '../components/ActivityFeed';

const CATEGORIES = ['RECON', 'INTRUSION', 'FORENSICS', 'SIGINT', 'PRIVESC', 'PERSISTENCE', 'CRYPTO'];

const emptyChallenge = { name: '', category: 'RECON', points: 100, description: '', flag: '', hint: '', hint_cost: 50, order_index: 1, active: 1 };

export default function Admin() {
  const { token, logout } = useAuth();
  const [tab, setTab] = useState('EQUIPOS');
  const [teams, setTeams] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [activity, setActivity] = useState([]);
  const [settings, setSettings] = useState({ timerDuration: 7200, ctfActive: false });
  const [editChallenge, setEditChallenge] = useState(null);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [newChallenge, setNewChallenge] = useState(emptyChallenge);
  const [msg, setMsg] = useState('');
  const [timerInput, setTimerInput] = useState(7200);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [t, c, a, s] = await Promise.all([
        api.get('/admin/teams', token),
        api.get('/admin/challenges', token),
        api.get('/scoreboard/activity', token),
        api.get('/admin/settings', token),
      ]);
      setTeams(t); setChallenges(c); setActivity(a); setSettings(s);
      setTimerInput(s.timerDuration);
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const startCTF   = async () => { await api.post('/admin/timer/start', {}, token); flash('CTF iniciado'); load(); };
  const stopCTF    = async () => { await api.post('/admin/timer/stop', {}, token);  flash('CTF pausado');  load(); };
  const setTimer   = async () => { await api.put('/admin/timer', { duration: timerInput }, token); flash('Timer actualizado'); load(); };
  const resetAll   = async () => { if (!confirm('¿Resetear TODAS las puntuaciones? Esta acción no se puede deshacer.')) return; await api.post('/admin/reset', {}, token); flash('Reseteado'); load(); };
  const deleteTeam = async (id) => { if (!confirm('¿Eliminar equipo?')) return; await api.delete(`/admin/teams/${id}`, token); load(); };

  const saveChallenge = async () => {
    try {
      await api.put(`/admin/challenges/${editChallenge.id}`, editChallenge, token);
      flash('Reto actualizado'); setEditChallenge(null); load();
    } catch (e) { flash('Error: ' + e.message); }
  };

  const createChallenge = async () => {
    try {
      await api.post('/admin/challenges', newChallenge, token);
      flash('Reto creado'); setShowNewChallenge(false); setNewChallenge(emptyChallenge); load();
    } catch (e) { flash('Error: ' + e.message); }
  };

  const deleteChallenge = async (id) => {
    if (!confirm('¿Eliminar reto?')) return;
    await api.delete(`/admin/challenges/${id}`, token); load();
  };

  const TABS = ['EQUIPOS', 'RETOS', 'CONTROL', 'ACTIVIDAD'];

  return (
    <div className="page">
      <Navbar status={null} isAdmin />
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--cyan)', letterSpacing: '0.1em' }}>PANEL DE ADMINISTRACIÓN</h2>
          <button className="btn btn-danger" onClick={logout}>CERRAR SESIÓN</button>
        </div>

        {msg && <div style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid var(--cyan)', borderRadius: 4, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--cyan)' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', font: 'inherit', cursor: 'pointer',
              padding: '0.6rem 1rem', fontSize: '0.75rem', letterSpacing: '0.1em',
              color: tab === t ? 'var(--cyan)' : 'var(--text-dim)',
              borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent'
            }}>{t}</button>
          ))}
        </div>

        {/* EQUIPOS */}
        {tab === 'EQUIPOS' && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
                  {['EQUIPO', 'PUNTOS', 'RESUELTOS', 'REGISTRADO', ''].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, fontSize: '0.7rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>{t.name}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--cyan)', fontWeight: 700 }}>{t.score}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{t.solved.length}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>{new Date(t.created_at).toLocaleString('es-ES')}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <button className="btn btn-danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.65rem' }} onClick={() => deleteTeam(t.id)}>ELIMINAR</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* RETOS */}
        {tab === 'RETOS' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setShowNewChallenge(true)}>+ NUEVO RETO</button>
            </div>

            {showNewChallenge && (
              <ChallengeForm data={newChallenge} onChange={setNewChallenge} onSave={createChallenge} onCancel={() => setShowNewChallenge(false)} title="NUEVO RETO" />
            )}

            {editChallenge && (
              <ChallengeForm data={editChallenge} onChange={setEditChallenge} onSave={saveChallenge} onCancel={() => setEditChallenge(null)} title={`EDITAR — ${editChallenge.name}`} />
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  {['#', 'NOMBRE', 'CAT', 'PTS', 'FLAG', 'ESTADO', ''].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challenges.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: c.active ? 1 : 0.4 }}>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-dim)' }}>{c.order_index}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{c.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}><CatBadge cat={c.category} /></td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--cyan)' }}>{c.points}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-dim)', fontSize: '0.7rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.flag}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: c.active ? 'var(--green)' : 'var(--red)', fontSize: '0.7rem' }}>{c.active ? 'ACTIVO' : 'INACTIVO'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.4rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.65rem' }} onClick={() => setEditChallenge({ ...c })}>EDITAR</button>
                      <button className="btn btn-danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.65rem' }} onClick={() => deleteChallenge(c.id)}>BORRAR</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTROL */}
        {tab === 'CONTROL' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.85rem', letterSpacing: '0.1em', color: 'var(--cyan)', marginBottom: '1rem' }}>CONTROL DEL TIMER</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label>Duración (segundos)</label>
                <input type="number" value={timerInput} onChange={e => setTimerInput(parseInt(e.target.value))} min={60} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={setTimer}>GUARDAR DURACIÓN</button>
                <button className="btn btn-success" onClick={startCTF} disabled={settings.ctfActive}>INICIAR CTF</button>
                <button className="btn btn-warning" onClick={stopCTF} disabled={!settings.ctfActive}>PAUSAR CTF</button>
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Estado: <span style={{ color: settings.ctfActive ? 'var(--green)' : 'var(--yellow)' }}>{settings.ctfActive ? 'ACTIVO' : 'INACTIVO'}</span>
              </div>
            </div>
            <div className="card">
              <h3 style={{ fontSize: '0.85rem', letterSpacing: '0.1em', color: 'var(--red)', marginBottom: '1rem' }}>ZONA DE PELIGRO</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>Resetear elimina todas las puntuaciones, submissions y pistas usadas. Los equipos y retos se mantienen.</p>
              <button className="btn btn-danger" onClick={resetAll}>RESETEAR TODAS LAS PUNTUACIONES</button>
            </div>
          </div>
        )}

        {/* ACTIVIDAD */}
        {tab === 'ACTIVIDAD' && <ActivityFeed events={activity} onRefresh={() => api.get('/scoreboard/activity', token).then(setActivity)} />}
      </div>
    </div>
  );
}

const CatBadge = ({ cat }) => {
  const colors = { RECON: '#00e5ff', INTRUSION: '#ff6b6b', FORENSICS: '#a78bfa', SIGINT: '#fbbf24', PRIVESC: '#f97316', PERSISTENCE: '#34d399', CRYPTO: '#f43f5e' };
  const c = colors[cat] || '#64748b';
  return <span className="badge" style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}>{cat}</span>;
};

const ChallengeForm = ({ data, onChange, onSave, onCancel, title }) => (
  <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-hover)' }}>
    <h3 style={{ fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--cyan)', marginBottom: '1rem' }}>{title}</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      {[
        { key: 'name', label: 'Nombre' },
        { key: 'order_index', label: 'Orden (#)', type: 'number' },
        { key: 'points', label: 'Puntos', type: 'number' },
        { key: 'hint_cost', label: 'Coste pista', type: 'number' },
        { key: 'flag', label: 'Flag' },
        { key: 'hint', label: 'Pista (texto)' },
      ].map(f => (
        <div key={f.key}>
          <label>{f.label}</label>
          <input type={f.type || 'text'} value={data[f.key] || ''} onChange={e => onChange({ ...data, [f.key]: f.type === 'number' ? parseInt(e.target.value) : e.target.value })} />
        </div>
      ))}
      <div>
        <label>Categoría</label>
        <select value={data.category} onChange={e => onChange({ ...data, category: e.target.value })}>
          {['RECON', 'INTRUSION', 'FORENSICS', 'SIGINT', 'PRIVESC', 'PERSISTENCE', 'CRYPTO'].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label>Estado</label>
        <select value={data.active} onChange={e => onChange({ ...data, active: parseInt(e.target.value) })}>
          <option value={1}>Activo</option>
          <option value={0}>Inactivo</option>
        </select>
      </div>
    </div>
    <div style={{ marginTop: '0.75rem' }}>
      <label>Descripción</label>
      <textarea rows={3} value={data.description} onChange={e => onChange({ ...data, description: e.target.value })} style={{ resize: 'vertical' }} />
    </div>
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
      <button className="btn btn-primary" onClick={onSave}>GUARDAR</button>
      <button className="btn" onClick={onCancel}>CANCELAR</button>
    </div>
  </div>
);
