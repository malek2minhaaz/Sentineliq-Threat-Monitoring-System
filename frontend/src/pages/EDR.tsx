import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor, Search, RefreshCw, HardDrive, Cpu, MemoryStick,
  Activity, AlertTriangle,
} from 'lucide-react';
import { api } from '../utils/api';

interface Endpoint {
  id: string;
  hostname: string;
  ip_address: string;
  os: string;
  status: string;
  agent_version: string;
  last_seen: string;
  risk_score: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  running_processes: number;
  alerts_count: number;
  tags: string[];
}

const statusColors: Record<string, string> = {
  online: '#10b981',
  offline: '#64748b',
  compromised: '#ef4444',
  maintenance: '#f59e0b',
};

export default function EDR() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: Endpoint[] }>('/endpoints', {
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setEndpoints(res.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">EDR / XDR</h1>
          <p className="page-subtitle">Endpoint Detection and Response — monitor and protect your endpoints</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={fetchEndpoints}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }} className="filters-row">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input type="text" className="input input-search" placeholder="Search by hostname or IP..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="compromised">Compromised</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-lg)' }}>
          {endpoints.map((ep, idx) => (
            <motion.div
              key={ep.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="card"
              style={{
                borderLeft: `4px solid ${statusColors[ep.status] || '#64748b'}`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Risk indicator */}
              <div style={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span className="status-dot" style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: ep.risk_score > 70 ? '#ef4444' : ep.risk_score > 40 ? '#f59e0b' : '#10b981',
                  boxShadow: `0 0 6px ${ep.risk_score > 70 ? 'rgba(239,68,68,0.5)' : ep.risk_score > 40 ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.5)'}`,
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Score: {Math.round(ep.risk_score)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Monitor size={24} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{ep.hostname}</h3>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {ep.ip_address}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <span className={`badge`} style={{ background: `${statusColors[ep.status]}20`, color: statusColors[ep.status] }}>
                  <span className={`status-dot ${ep.status}`} style={{ width: 6, height: 6 }} />
                  {ep.status}
                </span>
                <span className="badge badge-info">{ep.os?.split(' ').slice(0, 2).join(' ') || ep.os}</span>
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span><Cpu size={12} style={{ display: 'inline', marginRight: 4 }} />CPU</span>
                    <span>{ep.cpu_usage}%</span>
                  </div>
                  <div className="severity-bar">
                    <div className="severity-bar-segment" style={{
                      width: `${ep.cpu_usage}%`,
                      background: ep.cpu_usage > 80 ? '#ef4444' : ep.cpu_usage > 50 ? '#f59e0b' : '#10b981',
                    }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span><MemoryStick size={12} style={{ display: 'inline', marginRight: 4 }} />Memory</span>
                    <span>{ep.memory_usage}%</span>
                  </div>
                  <div className="severity-bar">
                    <div className="severity-bar-segment" style={{ width: `${ep.memory_usage}%`, background: ep.memory_usage > 80 ? '#ef4444' : ep.memory_usage > 50 ? '#f59e0b' : '#3b82f6' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span><HardDrive size={12} style={{ display: 'inline', marginRight: 4 }} />Disk</span>
                    <span>{ep.disk_usage}%</span>
                  </div>
                  <div className="severity-bar">
                    <div className="severity-bar-segment" style={{ width: `${ep.disk_usage}%`, background: ep.disk_usage > 80 ? '#ef4444' : ep.disk_usage > 50 ? '#f59e0b' : '#3b82f6' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span><Activity size={12} style={{ display: 'inline', marginRight: 4 }} />Processes</span>
                    <span>{ep.running_processes}</span>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {ep.alerts_count > 0 && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: 'var(--border-radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 'var(--font-size-xs)',
                  color: '#ef4444',
                }}>
                  <AlertTriangle size={14} />
                  <span>{ep.alerts_count} active {ep.alerts_count === 1 ? 'alert' : 'alerts'}</span>
                </div>
              )}

              <div style={{
                marginTop: 12,
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-tertiary)',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>Agent v{ep.agent_version}</span>
                <span>Last seen: {new Date(ep.last_seen).toLocaleString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .filters-row { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
