const CAT_COLORS = {
  RECON: '#00e5ff', INTRUSION: '#ff6b6b', FORENSICS: '#a78bfa',
  SIGINT: '#fbbf24', PRIVESC: '#f97316', PERSISTENCE: '#34d399', CRYPTO: '#f43f5e'
};

export default function KillChainProgress({ challenges }) {
  if (!challenges.length) return null;

  return (
    <div style={{ margin: '1rem 0 1.75rem', padding: '1.2rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: '1.2rem' }}>KILL CHAIN — PROGRESO</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {challenges.map((c, i) => {
          const color = CAT_COLORS[c.category] || 'var(--cyan)';
          const isLast = i === challenges.length - 1;
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid ${c.solved ? color : c.unlocked ? color : 'rgba(255,255,255,0.12)'}`,
                  background: c.solved ? `${color}22` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  color: c.solved ? color : c.unlocked ? color : 'var(--text-dim)',
                  boxShadow: c.solved ? `0 0 10px ${color}44` : 'none',
                  animation: c.unlocked && !c.solved ? 'pulse 2s infinite' : 'none',
                  transition: 'all 0.3s'
                }}>
                  {c.solved ? '✓' : c.unlocked ? i + 1 : '🔒'}
                </div>
                <div style={{ fontSize: '0.6rem', color: c.solved ? color : 'var(--text-dim)', textAlign: 'center', maxWidth: 64, lineHeight: 1.2 }}>
                  {c.name.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
              {/* Connector */}
              {!isLast && (
                <div style={{
                  flex: 1, height: 2,
                  background: c.solved ? `linear-gradient(90deg, ${color}, ${CAT_COLORS[challenges[i + 1]?.category] || color})` : 'rgba(255,255,255,0.08)',
                  margin: '0 0.25rem', minWidth: 20, marginBottom: '1.5rem',
                  transition: 'background 0.4s'
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
