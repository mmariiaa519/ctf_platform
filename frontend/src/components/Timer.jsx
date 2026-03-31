import { useState, useEffect } from 'react';

export default function Timer({ status }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calc = () => {
      if (!status?.ctfActive || !status?.ctfEndTime) return setRemaining(status?.timerDuration || 0);
      setRemaining(Math.max(0, Math.floor((status.ctfEndTime - Date.now()) / 1000)));
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const fmt = (n) => String(n).padStart(2, '0');

  const isLow = remaining < 600 && status?.ctfActive;
  const isDone = remaining === 0 && status?.ctfActive;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: '0.1rem' }}>
        {isDone ? 'EJERCICIO FINALIZADO' : status?.ctfActive ? 'TIEMPO RESTANTE' : 'EN ESPERA'}
      </div>
      <div style={{
        fontFamily: 'var(--font)',
        fontSize: '1.3rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: isDone ? 'var(--text-dim)' : isLow ? 'var(--red)' : 'var(--cyan)',
        animation: isLow && !isDone ? 'pulse 1s infinite' : 'none'
      }}>
        {fmt(h)}:{fmt(m)}:{fmt(s)}
      </div>
    </div>
  );
}
