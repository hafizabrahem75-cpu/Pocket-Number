import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User } from '@workspace/api-client-react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pn_token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('pn_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [, setLocation] = useLocation();

  // Register a global token getter so all API calls automatically send Authorization headers
  useEffect(() => {
    setAuthTokenGetter(() => token);
    return () => setAuthTokenGetter(null);
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('pn_token', newToken);
    localStorage.setItem('pn_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('pn_token');
    localStorage.removeItem('pn_user');
    setToken(null);
    setUser(null);
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
