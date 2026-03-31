import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const CAT_COLORS = {
  RECON: '#00e5ff', INTRUSION: '#ff6b6b', FORENSICS: '#a78bfa',
  SIGINT: '#fbbf24', PRIVESC: '#f97316', PERSISTENCE: '#34d399', CRYPTO: '#f43f5e'
};

export default function ChallengeModal({ challenge: c, token, onClose, onSolve }) {
  const [flag, setFlag] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [hint, setHint] = useState(c.hintUnlocked ? '(cargando pista...)' : null);
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef(null);
  const color = CAT_COLORS[c.category] || 'var(--cyan)';

  useEffect(() => {
    inputRef.current?.focus();
    if (c.hintUnlocked) loadHint(true);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadHint = async (silent = false) => {
    if (!silent && !confirm(`Usar pista penaliza -${c.hint_cost} pts. ¿Continuar?`)) return;
    try {
      const data = await api.post(`/challenges/${c.id}/hint`, {}, token);
      setHint(data.hint);
      if (!silent && !data.alreadyUnlocked) setFeedback({ type: 'warn', msg: `-${c.hint_cost} pts descontados por usar la pista` });
    } catch (e) { setFeedback({ type: 'error', msg: e.message }); }
  };

  const submitFlag = async (e) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setLoading(true); setFeedback(null);
    try {
      const data = await api.post(`/challenges/${c.id}/submit`, { flag }, token);
      if (data.correct) {
        setFeedback({ type: 'success', msg: data.message });
        setTimeout(onSolve, 1200);
      } else {
        setShaking(true);
        setFeedback({ type: 'error', msg: data.message });
        setTimeout(() => setShaking(false), 500);
        setFlag('');
        inputRef.current?.focus();
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560,
        background: 'var(--bg2)', border: `1px solid ${color}44`,
        borderRadius: 10, padding: '2rem',
        boxShadow: `0 0 40px ${color}18`,
        animation: 'fadeUp 0.25s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}44`, marginBottom: '0.5rem' }}>{c.category}</span>
            <h2 style={{ fontSize: '1.1rem', marginTop: '0.3rem' }}>{c.name}</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color, marginTop: '0.2rem' }}>+{c.points} pts</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Description */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: '1.5rem' }}>{c.description}</p>

        {/* Hint */}
        {hint ? (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '0.8rem', marginBottom: '1.2rem', fontSize: '0.8rem', color: 'var(--yellow)', lineHeight: 1.5 }}>
            <strong>PISTA:</strong> {hint}
          </div>
        ) : c.hint && !c.solved ? (
          <button className="btn btn-warning" style={{ marginBottom: '1.2rem', fontSize: '0.72rem' }} onClick={() => loadHint()}>
            USAR PISTA (-{c.hint_cost} pts)
          </button>
        ) : null}

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: '0.6rem 0.9rem', borderRadius: 5, marginBottom: '1rem', fontSize: '0.8rem',
            background: feedback.type === 'success' ? 'rgba(52,211,153,0.1)' : feedback.type === 'warn' ? 'rgba(251,191,36,0.1)' : 'rgba(244,63,94,0.1)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(52,211,153,0.4)' : feedback.type === 'warn' ? 'rgba(251,191,36,0.4)' : 'rgba(244,63,94,0.4)'}`,
            color: feedback.type === 'success' ? 'var(--green)' : feedback.type === 'warn' ? 'var(--yellow)' : 'var(--red)'
          }}>
            {feedback.msg}
          </div>
        )}

        {/* Flag input */}
        {!c.solved && (
          <form onSubmit={submitFlag} className={shaking ? 'shake' : ''}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>FLAG</label>
              <input
                ref={inputRef}
                value={flag}
                onChange={e => setFlag(e.target.value)}
                placeholder="F14G{...} o FLAG{...} o MARSEC{...}"
                style={{ fontFamily: 'var(--font)', letterSpacing: '0.03em' }}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !flag.trim()}>
              {loading ? <span className="spinner" /> : 'ENVIAR FLAG'}
            </button>
          </form>
        )}

        {c.solved && (
          <div style={{ textAlign: 'center', padding: '1rem', color: color, fontWeight: 700, fontSize: '0.9rem' }}>
            ✓ RETO COMPLETADO
          </div>
        )}
      </div>
    </div>
  );
}
