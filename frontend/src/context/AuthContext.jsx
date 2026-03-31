import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('marsec_token'));
  const [teamName, setTeamName] = useState(() => localStorage.getItem('marsec_team'));
  const [teamId, setTeamId] = useState(() => localStorage.getItem('marsec_teamId'));
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('marsec_admin') === 'true');

  const login = (data) => {
    localStorage.setItem('marsec_token', data.token);
    localStorage.setItem('marsec_team', data.teamName || '');
    localStorage.setItem('marsec_teamId', data.teamId || '');
    localStorage.setItem('marsec_admin', data.isAdmin ? 'true' : 'false');
    setToken(data.token);
    setTeamName(data.teamName || '');
    setTeamId(data.teamId || '');
    setIsAdmin(!!data.isAdmin);
  };

  const logout = () => {
    ['marsec_token', 'marsec_team', 'marsec_teamId', 'marsec_admin'].forEach(k => localStorage.removeItem(k));
    setToken(null); setTeamName(null); setTeamId(null); setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ token, teamName, teamId, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
