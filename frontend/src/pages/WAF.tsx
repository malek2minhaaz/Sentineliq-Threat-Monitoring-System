import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, RefreshCw, Activity, ToggleLeft, ToggleRight,
  BarChart3, AlertTriangle, ShieldAlert,
  Server, TrendingUp,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../utils/api';

interface WAFRule {
  id: string;
  name: string;
  description: string;
  category: string;
  action: string;
  priority: number;
  is_active: boolean;
  hits: number;
}

interface TrafficPoint {
  time: string;
  requests: number;
  blocked: number;
  anomalies: number;
}

const categoryColors: Record<string, string> = {
  'sql-injection': '#ef4444',
  'xss': '#f97316',
  'path-traversal': '#8b5cf6',
  'rate-limit': '#f59e0b',
  'command-injection': '#06b6d4',
  'ip-reputation': '#3b82f6',
};

export default function WAF() {
  const [rules, setRules] = useState<WAFRule[]>([]);
  const [traffic, setTraffic] = useState<TrafficPoint[]>([]);
  const [currentRps, setCurrentRps] = useState(0);
  const [totalBlocked, setTotalBlocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, trafficRes] = await Promise.all([
        api.get<{ items: WAFRule[] }>('/waf/rules', { category: categoryFilter || undefined }),
        api.get<{ traffic: TrafficPoint[]; current_rps: number; total_blocked_today: number }>('/monitor/traffic'),
      ]);
      setRules(rulesRes.items);
      setTraffic(trafficRes.traffic);
      setCurrentRps(trafficRes.current_rps);
      setTotalBlocked(trafficRes.total_blocked_today);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleRule = async (ruleId: string) => {
    try {
      await api.patch(`/waf/rules/${ruleId}`);
      fetchData();
    } catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldAlert size={24} style={{ marginRight: 10, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
            WAF Monitor
          </h1>
          <p className="page-subtitle">
            <span className="badge badge-info" style={{ marginRight: 8 }}>Web Application Firewall</span>
            Real-time traffic monitoring and rule management
          </p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Live Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}
      >
        <div className="stat-card">
          <Server size={24} className="stat-card-icon" />
          <div className="stat-card-label">Current RPS</div>
          <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>{currentRps.toLocaleString()}</div>
          <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            <TrendingUp size={12} style={{ marginRight: 4 }} />
            Requests per second
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-danger)' } as React.CSSProperties}>
          <AlertTriangle size={24} className="stat-card-icon" />
          <div className="stat-card-label">Blocked Today</div>
          <div className="stat-card-value" style={{ color: '#ef4444' }}>{totalBlocked.toLocaleString()}</div>
          <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            Threats neutralized
          </div>
        </div>
        <div className="stat-card">
          <Shield size={24} className="stat-card-icon" />
          <div className="stat-card-label">Active Rules</div>
          <div className="stat-card-value" style={{ color: '#10b981' }}>{rules.filter(r => r.is_active).length}/{rules.length}</div>
          <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            {rules.filter(r => r.is_active).length} of {rules.length} rules enabled
          </div>
        </div>
        <div className="stat-card">
          <Activity size={24} className="stat-card-icon" />
          <div className="stat-card-label">Security Posture</div>
          <div className="stat-card-value" style={{
            color: traffic.length > 0 && traffic[traffic.length - 1].anomalies > 10 ? '#ef4444' : '#10b981',
          }}>
            {traffic.length > 0 && traffic[traffic.length - 1].anomalies > 10 ? 'At Risk' : 'Protected'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="status-dot" style={{
              background: traffic.length > 0 && traffic[traffic.length - 1].anomalies > 10 ? '#ef4444' : '#10b981',
              boxShadow: traffic.length > 0 && traffic[traffic.length - 1].anomalies > 10
                ? '0 0 6px rgba(239,68,68,0.5)' : '0 0 6px rgba(16,185,129,0.5)',
            }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
              {traffic.length > 0 ? `${traffic[traffic.length - 1].anomalies} anomalies` : 'No data'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Traffic Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
        style={{ marginBottom: 'var(--space-xl)' }}
      >
        <div className="card-header">
          <h3 className="card-title">
            <BarChart3 size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
            Real-Time Traffic (Last 60s)
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 3, borderRadius: 1, background: '#06b6d4', display: 'inline-block' }} />
              Requests
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 3, borderRadius: 1, background: '#ef4444', display: 'inline-block' }} />
              Blocked
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 3, borderRadius: 1, background: '#f59e0b', display: 'inline-block' }} />
              Anomalies
            </span>
          </div>
        </div>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={traffic}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: 'var(--border-primary)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
              <Line type="monotone" dataKey="requests" stroke="#06b6d4" strokeWidth={2} name="Requests" dot={false} />
              <Line type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} name="Blocked" dot={false} />
              <Line type="monotone" dataKey="anomalies" stroke="#f59e0b" strokeWidth={2} name="Anomalies" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Rules Section */}
      <div className="page-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
          <Shield size={20} style={{ marginRight: 8, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
          WAF Rules
        </h2>
        <select className="select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          <option value="sql-injection">SQL Injection</option>
          <option value="xss">XSS</option>
          <option value="path-traversal">Path Traversal</option>
          <option value="rate-limit">Rate Limit</option>
          <option value="command-injection">Command Injection</option>
          <option value="ip-reputation">IP Reputation</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : rules.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <ShieldAlert size={48} className="empty-state-icon" />
            <div className="empty-state-title">No WAF rules found</div>
            <div className="empty-state-desc">Add rules to protect your web applications from threats.</div>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {rules.map((rule, idx) => {
            const categoryColor = categoryColors[rule.category] || '#64748b';
            return (
              <motion.div
                key={rule.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="rule-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                  {/* Active indicator */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: rule.is_active ? '#10b981' : '#64748b',
                    boxShadow: rule.is_active ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                    flexShrink: 0,
                    transition: 'all var(--transition-fast)',
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                        {rule.name}
                      </span>
                      <span className="pill" style={{
                        background: `${categoryColor}18`,
                        color: categoryColor,
                        fontSize: 10,
                      }}>
                        {rule.category}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rule.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  {/* Action badge */}
                  <span className="badge" style={{
                    background: rule.action === 'block' ? 'rgba(239,68,68,0.12)' : rule.action === 'log' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                    color: rule.action === 'block' ? '#ef4444' : rule.action === 'log' ? '#3b82f6' : '#10b981',
                  }}>
                    {rule.action}
                  </span>

                  {/* Priority */}
                  <div className="metric" style={{ alignItems: 'center' }}>
                    <span className="metric-label">Priority</span>
                    <span className="metric-value" style={{ fontSize: 'var(--font-size-sm)' }}>{rule.priority}</span>
                  </div>

                  {/* Hits */}
                  <div className="metric" style={{ alignItems: 'center' }}>
                    <span className="metric-label">Hits</span>
                    <span className="metric-value" style={{ fontSize: 'var(--font-size-sm)' }}>{rule.hits.toLocaleString()}</span>
                  </div>

                  {/* Toggle */}
                  <button
                    className="btn-icon btn-ghost"
                    onClick={() => toggleRule(rule.id)}
                    style={{
                      color: rule.is_active ? '#10b981' : '#64748b',
                      width: 40, height: 40,
                    }}
                    title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .rule-card { flex-direction: column; align-items: flex-start; }
          .rule-card > div:last-child { width: 100%; justify-content: space-between; }
        }
      `}</style>
    </div>
  );
}
