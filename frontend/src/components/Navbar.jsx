import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Timer from './Timer';

export default function Navbar({ status, isAdmin }) {
  const { teamName, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav style={{
      background: 'rgba(8,12,20,0.95)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(8px)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.5rem' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.3rem' }}>⚓</span>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.12em', lineHeight: 1 }}>MARSEC CYBER RANGE</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>EJERCICIO 2026</div>
          </div>
        </div>

        {/* Timer */}
        {!isAdmin && status && <Timer status={status} />}
        {isAdmin && <div style={{ fontSize: '0.75rem', color: 'var(--red)', letterSpacing: '0.1em' }}>■ MODO ADMINISTRADOR</div>}

        {/* Team + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite', display: 'inline-block', boxShadow: '0 0 6px var(--green)' }} />
              <span style={{ color: 'var(--text-dim)' }}>EQUIPO</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{teamName}</span>
            </div>
          )}
          <button className="btn" style={{ padding: '0.3rem 0.8rem', fontSize: '0.7rem' }} onClick={handleLogout}>
            SALIR
          </button>
        </div>
      </div>
    </nav>
  );
}
