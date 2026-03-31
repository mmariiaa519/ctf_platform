import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import KillChainProgress from '../components/KillChainProgress';
import ChallengeCard from '../components/ChallengeCard';
import ChallengeModal from '../components/ChallengeModal';
import Scoreboard from '../components/Scoreboard';
import ActivityFeed from '../components/ActivityFeed';

const TABS = ['RETOS', 'SCOREBOARD', 'ACTIVIDAD'];

export default function Dashboard() {
  const { token, teamName, teamId } = useAuth();
  const [tab, setTab] = useState('RETOS');
  const [challenges, setChallenges] = useState([]);
  const [scoreboard, setScoreboard] = useState([]);
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadChallenges = useCallback(async () => {
    try { setChallenges(await api.get('/challenges', token)); } catch {}
  }, [token]);

  const loadScoreboard = useCallback(async () => {
    try { setScoreboard(await api.get('/scoreboard', token)); } catch {}
  }, [token]);

  const loadActivity = useCallback(async () => {
    try { setActivity(await api.get('/scoreboard/activity', token)); } catch {}
  }, [token]);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api.get('/scoreboard/status', token)); } catch {}
  }, [token]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadChallenges(), loadScoreboard(), loadActivity(), loadStatus()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(() => {
      loadScoreboard();
      loadActivity();
      loadStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadChallenges, loadScoreboard, loadActivity, loadStatus]);

  const myScore = scoreboard.find(t => t.teamId === parseInt(teamId));
  const myRank  = scoreboard.findIndex(t => t.teamId === parseInt(teamId)) + 1;
  const solvedCount = challenges.filter(c => c.solved).length;
  const totalPts = status?.totalPoints || 0;

  const handleSolve = () => { loadChallenges(); loadScoreboard(); loadActivity(); };

  return (
    <div className="page">
      <Navbar status={status} />

      {/* Stats bar */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div className="page-content" style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'RETOS RESUELTOS', value: `${solvedCount}/${status?.totalChallenges || 7}` },
            { label: 'PUNTUACIÓN',      value: myScore?.score ?? 0 },
            { label: 'POSICIÓN',        value: myRank ? `#${myRank}` : '—' },
            { label: 'PTS DISPONIBLES', value: totalPts },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{s.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cyan)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-content">
        {/* Kill chain */}
        {!loading && <KillChainProgress challenges={challenges} />}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', font: 'inherit', cursor: 'pointer',
              padding: '0.6rem 1rem', fontSize: '0.75rem', letterSpacing: '0.1em',
              color: tab === t ? 'var(--cyan)' : 'var(--text-dim)',
              borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
              transition: 'color 0.2s'
            }}>{t}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : (
          <>
            {tab === 'RETOS' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {challenges.map((c, i) => (
                  <ChallengeCard key={c.id} challenge={c} index={i} onClick={() => c.unlocked && setSelected(c)} />
                ))}
              </div>
            )}
            {tab === 'SCOREBOARD' && <Scoreboard data={scoreboard} myTeamId={parseInt(teamId)} />}
            {tab === 'ACTIVIDAD'  && <ActivityFeed events={activity} onRefresh={loadActivity} />}
          </>
        )}
      </div>

      {selected && (
        <ChallengeModal
          challenge={selected}
          token={token}
          onClose={() => setSelected(null)}
          onSolve={() => { handleSolve(); setSelected(null); }}
        />
      )}
    </div>
  );
}
