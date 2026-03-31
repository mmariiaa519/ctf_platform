export default function Scoreboard({ data, myTeamId }) {
  if (!data.length) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Sin equipos registrados aún.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
            {['RANK', 'EQUIPO', 'PUNTOS', 'RETOS', 'ÚLTIMA FLAG', 'TENDENCIA'].map(h => (
              <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((team, i) => {
            const isMe = team.teamId === myTeamId;
            const isFirst = i === 0;
            return (
              <tr key={team.teamId} className="fade-up" style={{
                animationDelay: `${i * 0.04}s`,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isFirst ? 'rgba(0,229,255,0.04)' : isMe ? 'rgba(0,229,255,0.02)' : 'transparent',
                transition: 'background 0.2s'
              }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: isFirst ? 'var(--cyan)' : 'var(--text-dim)' }}>
                  {isFirst ? '👑 #1' : `#${i + 1}`}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--cyan)' : 'var(--text)' }}>
                  {team.teamName}
                  {isMe && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>(tú)</span>}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '1rem', color: isFirst ? 'var(--cyan)' : 'var(--text)' }}>
                  {team.score.toLocaleString()}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)' }}>{team.solvedCount}</td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                  {team.lastSolve ? new Date(team.lastSolve).toLocaleTimeString('es-ES') : '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '1rem' }}>
                  {team.trend === 'up' ? '📈' : '➡️'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
