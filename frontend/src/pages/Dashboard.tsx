import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Shield, TrendingUp, TrendingDown,
  Terminal, Upload, Globe, User, RefreshCw,
  BarChart3, PieChart, Zap, Target, Eye, Radio,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { api } from '../utils/api';

// Stat Card Component with enhanced styling
function StatCard({ icon: Icon, label, value, change, color, prefix, subtitle }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: { value: number; positive: boolean };
  color?: string;
  prefix?: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className="stat-card"
      style={{ '--stat-color': color || 'var(--accent-primary)' } as React.CSSProperties}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {change && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              fontSize: 'var(--font-size-xs)',
              color: change.positive ? 'var(--accent-success)' : 'var(--accent-danger)',
            }}
          >
            {change.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(change.value)}% from last hour</span>
          </motion.div>
        )}
        {subtitle && (
          <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            {subtitle}
          </div>
        )}
      </div>
      <Icon size={48} className="stat-card-icon" style={{ opacity: 0.06 }} />
    </motion.div>
  );
}

// Severity colors — semantic mapping matching the design tokens & other pages
// (critical=red, high=orange, medium=yellow, low=green, info=blue)
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
};
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const severityColor = (name: string) => SEVERITY_COLORS[name.toLowerCase()] || '#64748b';

interface DashboardData {
  stats: {
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
    my_scans: number;
    my_uploads: number;
    my_total_imported: number;
    monitored_websites: number;
    monitor_events_today: number;
  } | null;
  attackVectors: { name: string; value: number }[];
  severityBreakdown: { name: string; value: number }[];
  incidentTimeline: { date: string; count: number }[];
  recentActivity: any[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    stats: null,
    attackVectors: [],
    severityBreakdown: [],
    incidentTimeline: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch each endpoint independently so one failure doesn't zero out the whole dashboard
      const [stats, vectors, severity, timeline, activity] = await Promise.all([
        api.get<any>('/dashboard/stats').catch(() => null),
        api.get<{ name: string; value: number }[]>('/dashboard/attack-vectors').catch(() => []),
        api.get<{ name: string; value: number }[]>('/dashboard/severity-breakdown').catch(() => []),
        api.get<{ date: string; count: number }[]>('/dashboard/incident-timeline').catch(() => []),
        api.get<any[]>('/dashboard/recent-activity').catch(() => []),
      ]);
      setData({
        stats,
        attackVectors: vectors,
        severityBreakdown: severity,
        incidentTimeline: timeline,
        recentActivity: activity || [],
      });
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s (silent background refresh)
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const { stats, attackVectors, severityBreakdown, incidentTimeline, recentActivity } = data;

  // Sort severity slices most-dangerous first so the donut reads correctly
  const sortedSeverity = [...severityBreakdown].sort((a, b) => {
    const ra = SEVERITY_ORDER.indexOf(a.name.toLowerCase());
    const rb = SEVERITY_ORDER.indexOf(b.name.toLowerCase());
    return (ra === -1 ? SEVERITY_ORDER.length : ra) - (rb === -1 ? SEVERITY_ORDER.length : rb);
  });
  const totalIncidents = sortedSeverity.reduce((sum, s) => sum + s.value, 0);
  const pieData = sortedSeverity.length > 0 ? sortedSeverity : [{ name: 'Empty', value: 1 }];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Zap size={24} style={{ marginRight: 10, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
            Security Dashboard
          </h1>
          <p className="page-subtitle">
            <span className="badge badge-info" style={{ marginRight: 8 }}>Live</span>
            Real-time overview of your security posture and threat landscape
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="badge" style={{
            background: stats && stats.security_score > 70
              ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: stats && stats.security_score > 70 ? '#10b981' : '#ef4444',
            fontSize: 'var(--font-size-sm)',
            padding: '4px 14px',
          }}>
            <Shield size={14} style={{ marginRight: 6 }} />
            Security Score: {stats?.security_score ?? 0}/100
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setAutoRefresh(v => !v)}
                title={autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  background: autoRefresh ? 'rgba(16,185,129,0.12)' : 'var(--bg-tertiary)',
                  color: autoRefresh ? '#10b981' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <RefreshCw size={13} className={autoRefresh ? 'spin-slow' : ''} />
              </button>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => fetchData()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <StatCard icon={Target} label="Websites Monitored" value={stats?.monitored_websites ?? 0}
          color="#38bdf8" subtitle="Websites under active monitoring" />
        <StatCard icon={Eye} label="Security Events Today" value={stats?.monitor_events_today ?? 0}
          color="#f97316" subtitle="Real-time attack events detected" />
        <StatCard icon={AlertTriangle} label="Critical Incidents" value={stats?.critical_incidents ?? 0}
          color="#ef4444" subtitle="Requires immediate attention" />
        <StatCard icon={Shield} label="Active IOCs" value={stats?.total_iocs ?? 0}
          color="#3b82f6" subtitle="Threat intelligence indicators" />
        <StatCard icon={Radio} label="URL Scans" value={stats?.my_scans ?? 0}
          color="#10b981" subtitle="Websites & URLs scanned" />
        <StatCard icon={Upload} label="File Uploads" value={stats?.my_uploads ?? 0}
          color="#60a5fa" subtitle="Data ingestion completed" />
      </motion.div>

      {/* My Activity Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass"
        style={{
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-lg)',
          borderRadius: 'var(--border-radius-md)',
        }}
      >
        <div className="card-header">
          <h3 className="card-title">
            <User size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
            My Activity
          </h3>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-md)',
        }}>
          <motion.div
            whileHover={{ y: -2 }}
            style={{
              textAlign: 'center',
              padding: '20px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <Target size={24} style={{ color: '#38bdf8', marginBottom: 8 }} />
            <div className="stat-card-value" style={{ fontSize: 'var(--font-size-2xl)' }}>{stats?.monitored_websites ?? 0}</div>
            <div className="stat-card-label">Monitored Sites</div>
          </motion.div>
          <motion.div
            whileHover={{ y: -2 }}
            style={{
              textAlign: 'center',
              padding: '20px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <Eye size={24} style={{ color: '#f97316', marginBottom: 8 }} />
            <div className="stat-card-value" style={{ fontSize: 'var(--font-size-2xl)' }}>{stats?.monitor_events_today ?? 0}</div>
            <div className="stat-card-label">Events Today</div>
          </motion.div>
          <motion.div
            whileHover={{ y: -2 }}
            style={{
              textAlign: 'center',
              padding: '20px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <Globe size={24} style={{ color: 'var(--accent-primary)', marginBottom: 8 }} />
            <div className="stat-card-value" style={{ fontSize: 'var(--font-size-2xl)' }}>{stats?.my_scans ?? 0}</div>
            <div className="stat-card-label">URL Scans</div>
          </motion.div>
          <motion.div
            whileHover={{ y: -2 }}
            style={{
              textAlign: 'center',
              padding: '20px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <Upload size={24} style={{ color: '#60a5fa', marginBottom: 8 }} />
            <div className="stat-card-value" style={{ fontSize: 'var(--font-size-2xl)' }}>{stats?.my_uploads ?? 0}</div>
            <div className="stat-card-label">File Uploads</div>
          </motion.div>
          <motion.div
            whileHover={{ y: -2 }}
            style={{
              textAlign: 'center',
              padding: '20px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <Shield size={24} style={{ color: '#10b981', marginBottom: 8 }} />
            <div className="stat-card-value" style={{ fontSize: 'var(--font-size-2xl)' }}>{stats?.my_total_imported ?? 0}</div>
            <div className="stat-card-label">Records Imported</div>
          </motion.div>
        </div>
      </motion.div>

      {/* Charts Row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)',
        }}
        className="charts-grid"
      >
        {/* Attack Vectors */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <BarChart3 size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
              Attack Vectors
            </h3>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attackVectors.length > 0 ? attackVectors : [{ name: 'No Data', value: 1 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
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
                <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <PieChart size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
              Severity Breakdown
            </h3>
          </div>
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: '60%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={severityColor(item.name)}
                        style={{ filter: `drop-shadow(0 0 6px ${severityColor(item.name)}55)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: 'var(--border-primary)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                    }}
                  />
                </RePieChart>
              </ResponsiveContainer>
              {/* Center total */}
              {sortedSeverity.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}>
                  <div className="stat-card-value" style={{ fontSize: 'var(--font-size-2xl)' }}>
                    {totalIncidents.toLocaleString()}
                  </div>
                  <div className="stat-card-label">Incidents</div>
                </div>
              )}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedSeverity.map((item, idx) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 4 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'default',
                  }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: 4,
                    background: severityColor(item.name),
                    boxShadow: `0 0 8px ${severityColor(item.name)}40`,
                  }} />
                  <span style={{ color: 'var(--text-secondary)', minWidth: 56, textTransform: 'capitalize' }}>{item.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {item.value}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    {totalIncidents > 0 ? `${Math.round((item.value / totalIncidents) * 100)}%` : ''}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: 'var(--space-lg)',
        }}
        className="bottom-grid"
      >
        {/* Incident Timeline */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
              Incident Timeline
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-dot online pulse-dot" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Live</span>
            </div>
          </div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incidentTimeline.length > 0 ? incidentTimeline : [{ date: 'No Data', count: 0 }]}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: 'var(--border-primary)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#38bdf8" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="card" style={{ maxHeight: 400, overflow: 'hidden' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Terminal size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
              Live Activity
            </h3>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-success)',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
              display: 'inline-block',
            }} className="pulse-dot" />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 350 }}>
            {recentActivity.slice(0, 15).map((event, idx) => {
              const sevColor = event.severity === 'critical' ? '#ef4444'
                : event.severity === 'high' ? '#f97316'
                : event.severity === 'medium' ? '#eab308'
                : '#22c55e';
              return (
                <motion.div
                  key={event.id || idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  style={{
                    padding: '10px 0',
                    borderBottom: 'var(--border-primary)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <div className="sev-dot" style={{
                    background: sevColor,
                    boxShadow: `0 0 8px ${sevColor}40`,
                    marginTop: 3,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {event.message || 'Event recorded'}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      display: 'flex',
                      gap: 8,
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{event.source || ''}</span>
                      <span>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <style>{`
        @media (max-width: 1024px) {
          .charts-grid { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
