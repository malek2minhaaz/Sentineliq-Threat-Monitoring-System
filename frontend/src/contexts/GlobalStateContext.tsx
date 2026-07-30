import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';

interface DashboardStats {
  total_incidents: number;
  open_incidents: number;
  critical_incidents: number;
  total_events: number;
  events_24h: number;
  active_endpoints: number;
  total_endpoints: number;
  total_iocs: number;
  waf_blocked: number;
  security_score: number;
}

interface GlobalStateType {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
}

const GlobalState = createContext<GlobalStateType | null>(null);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<DashboardStats>('/dashboard/stats');
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  return (
    <GlobalState.Provider value={{ stats, loading, error, refreshStats }}>
      {children}
    </GlobalState.Provider>
  );
}

export function useGlobalState() {
  const ctx = useContext(GlobalState);
  if (!ctx) throw new Error('useGlobalState must be used within GlobalStateProvider');
  return ctx;
}
