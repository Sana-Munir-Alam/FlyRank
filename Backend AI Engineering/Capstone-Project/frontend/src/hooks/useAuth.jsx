import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  // 'loading' avoids a flash-redirect to /login before we know if a session cookie is valid
  const [status, setStatus] = useState('loading');

  const loadSession = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setTenant(data.tenant);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setTenant(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    setUser(data.user);
    setTenant(data.tenant);
    setStatus('authenticated');
    return data;
  }, []);

  const signup = useCallback(async (details) => {
    const data = await authApi.signup(details);
    setUser(data.user);
    setTenant(data.tenant);
    setStatus('authenticated');
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setTenant(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, tenant, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}