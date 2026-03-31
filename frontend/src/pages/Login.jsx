import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ teamName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      login({ ...data, isAdmin: false });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleAdmin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.post('/auth/admin-login', { username: form.teamName, password: form.password });
      login({ ...data, isAdmin: true, teamName: 'ADMIN' });
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-box fade-up">
        <div className="auth-logo">
          <div className="anchor">⚓</div>
          <h1>MARSEC CYBER RANGE</h1>
          <p>EJERCICIO 2026 — ACCESO AUTORIZADO</p>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre de equipo</label>
            <input value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} required placeholder="EQUIPO_ALFA" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.6rem' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'ACCEDER'}
          </button>
          <button type="button" className="btn" style={{ width: '100%', fontSize: '0.7rem' }} onClick={handleAdmin} disabled={loading}>
            ACCESO ADMINISTRADOR
          </button>
        </form>
        <div className="auth-switch">
          ¿Sin cuenta? <Link to="/register">Registrar equipo</Link>
        </div>
      </div>
    </div>
  );
}
