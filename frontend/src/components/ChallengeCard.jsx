const CAT_COLORS = {
  RECON: '#00e5ff', INTRUSION: '#ff6b6b', FORENSICS: '#a78bfa',
  SIGINT: '#fbbf24', PRIVESC: '#f97316', PERSISTENCE: '#34d399', CRYPTO: '#f43f5e'
};

export default function ChallengeCard({ challenge: c, index, onClick }) {
  const color = CAT_COLORS[c.category] || 'var(--cyan)';
  const locked = !c.unlocked;
  const delay = `${index * 0.06}s`;

  return (
    <div
      onClick={onClick}
      className="card fade-up"
      style={{
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.45 : 1,
        animationDelay: delay,
        position: 'relative',
        overflow: 'hidden',
        borderColor: c.solved ? `${color}55` : 'var(--border)',
        background: c.solved ? `${color}08` : 'var(--bg2)',
      }}
    >
      {/* Solved indicator */}
      {c.solved && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          color: color, fontSize: '0.75rem', fontWeight: 700,
          background: `${color}22`, padding: '0.15rem 0.5rem', borderRadius: 3
        }}>✓ RESUELTO</div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 6, flexShrink: 0,
          background: `${color}18`, border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem'
        }}>
          {locked ? '🔒' : { RECON: '🔍', INTRUSION: '💥', FORENSICS: '🔬', SIGINT: '📡', PRIVESC: '⬆️', PERSISTENCE: '🧬', CRYPTO: '🔐' }[c.category] || '🎯'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem', color: locked ? 'var(--text-dim)' : 'var(--text)' }}>
            {c.name}
          </div>
          <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{c.category}</span>
        </div>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {c.description}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>+{c.points} pts</span>
        {c.hintUnlocked && !c.solved && <span style={{ fontSize: '0.65rem', color: 'var(--yellow)' }}>PISTA USADA</span>}
      </div>
    </div>
  );
}
