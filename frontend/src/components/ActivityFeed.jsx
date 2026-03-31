const TYPE_STYLES = {
  solve:  { color: 'var(--green)',  dot: '#34d399', label: 'SOLVE'  },
  hint:   { color: 'var(--yellow)', dot: '#fbbf24', label: 'PISTA'  },
  fail:   { color: 'var(--red)',    dot: '#f43f5e', label: 'FALLO'  },
  system: { color: 'var(--cyan)',   dot: '#00e5ff', label: 'SISTEMA' },
};

const fmtTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function ActivityFeed({ events, onRefresh }) {
  if (!events.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
      <div style={{ fontSize: '0.85rem' }}>Sin actividad registrada</div>
      {onRefresh && <button className="btn" style={{ marginTop: '1rem' }} onClick={onRefresh}>ACTUALIZAR</button>}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {onRefresh && <button className="btn" style={{ fontSize: '0.7rem' }} onClick={onRefresh}>↻ ACTUALIZAR</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {events.map((ev, i) => {
          const style = TYPE_STYLES[ev.type] || TYPE_STYLES.system;
          return (
            <div key={ev.id} className="fade-up" style={{
              animationDelay: `${i * 0.03}s`,
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '0.7rem 1rem',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${style.dot}`, borderRadius: 6,
              fontSize: '0.8rem'
            }}>
              <span style={{
                flexShrink: 0, padding: '0.1rem 0.45rem', borderRadius: 3,
                background: `${style.dot}22`, color: style.color,
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', marginTop: '0.1rem'
              }}>{style.label}</span>
              <span style={{ flex: 1, color: 'var(--text)', lineHeight: 1.5 }}>{ev.message}</span>
              <span style={{ flexShrink: 0, color: 'var(--text-dim)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                {fmtTime(ev.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
