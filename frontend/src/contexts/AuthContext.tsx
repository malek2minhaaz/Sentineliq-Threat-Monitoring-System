import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { adminStorage } from '../utils/adminApi';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string;
  created_at: string;
  is_verified: boolean;
  theme: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.get<User>('/auth/me')
        .then((u) => {
          setUser(u);
          // Keep the mirrored admin-panel session alive across page loads, so a
          // logged-in admin doesn't get bounced out of /admin after a refresh.
          if (u.role === 'admin') {
            adminStorage.setSession(api.getToken()!, u);
          }
        })
        .catch(() => api.clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<User> => {
    const res = await api.post<{ access_token: string; refresh_token: string; user: User }>(
      '/auth/login', { username, password }
    );
    api.setTokens(res.access_token, res.refresh_token);
    setUser(res.user);
    // Admins logging in through the regular page also get an admin-panel session,
    // so /admin recognizes them (the JWT already carries the admin role claim).
    // Non-admins clear any leftover admin session so they can't see /admin.
    if (res.user.role === 'admin') {
      adminStorage.setSession(res.access_token, res.user);
    } else {
      adminStorage.clear();
    }
    return res.user;
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await api.post<{ access_token: string; refresh_token: string; user: User }>(
      '/auth/register', { email, username, password }
    );
    api.setTokens(res.access_token, res.refresh_token);
    setUser(res.user);
    // New accounts are normal users — never leave a stale admin session behind.
    adminStorage.clear();
  }, []);

  const logout = useCallback(() => {
    api.clearTokens();
    adminStorage.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
