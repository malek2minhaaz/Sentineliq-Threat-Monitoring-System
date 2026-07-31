import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Users, Globe, Search, Upload, AlertTriangle,
  Shield, Activity, FileText, LogOut, ArrowLeft, KeyRound,
  Database, Radio, Server, ArrowUp, ArrowDown,
} from 'lucide-react';
import { adminApi, adminStorage } from '../utils/adminApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminStats {
  total_users: number;
  total_websites: number;
  total_url_scans: number;
  total_file_uploads: number;
  total_records_imported: number;
  total_incidents: number;
  total_iocs: number;
  total_monitor_events: number;
  total_log_events: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string | null;
  websites_scanned: number;
  url_scans: number;
  file_uploads: number;
  incidents: number;
  monitor_events: number;
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function AdminStatCard({ icon: Icon, label, value, color, subtitle }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className="stat-card"
      style={{ '--stat-color': color } as React.CSSProperties}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof AdminUser>('websites_scanned');
  const [sortAsc, setSortAsc] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const adminUser = adminStorage.getUser() as { username?: string; role?: string } | null;

  useEffect(() => {
    if (!adminStorage.hasSession()) {
      navigate('/admin/login', { replace: true });
      return;
    }
    const fetchData = async () => {
      // Fetch each endpoint independently so one failure doesn't blank the whole panel
      const [statsRes, usersRes] = await Promise.all([
        adminApi.get<AdminStats>('/admin/stats').catch(() => null),
        adminApi.get<{ items: AdminUser[]; total: number }>('/admin/users').catch(() => ({ items: [], total: 0 })),
      ]);
      if (!statsRes && !usersRes.items.length) {
        setError('Failed to load admin data');
      }
      setStats(statsRes);
      setUsers(usersRes.items);
      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    adminStorage.clear();
    navigate('/admin/login', { replace: true });
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return sortAsc ? cmp : -cmp;
  });

  const totalWebsitesPerUser = users.reduce((acc, u) => acc + u.websites_scanned, 0);
  const totalScans = users.reduce((acc, u) => acc + u.url_scans, 0);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Admin header */}
      <header style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(124,58,237,0.05))',
        borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
        backdropFilter: 'blur(var(--glass-blur))',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(168, 85, 247, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.3)',
          }}>
            <ShieldCheck size={22} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
              SentinalIQ <span style={{ color: '#a855f7' }}>Admin Panel</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Platform overview & user monitoring
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {adminUser && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px',
              background: 'rgba(168, 85, 247, 0.1)',
              borderRadius: 999,
              fontSize: 'var(--font-size-xs)',
              color: '#c084fc',
            }}>
              <KeyRound size={13} />
              <span className="text-mono">{adminUser.username || 'admin'}</span>
            </div>
          )}
          <Link to="/" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Back to site
          </Link>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="btn btn-sm btn-secondary"
          >
            <LogOut size={14} />
            Logout
          </motion.button>
        </div>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--border-radius-sm)',
            color: '#ef4444',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 'var(--space-lg)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <AdminStatCard icon={Users} label="Total Users" value={stats?.total_users ?? 0}
            color="#a855f7" subtitle="Registered platform accounts" />
          <AdminStatCard icon={Globe} label="Websites Monitored" value={stats?.total_websites ?? 0}
            color="#06b6d4" subtitle="All users combined" />
          <AdminStatCard icon={Radio} label="URL Scans" value={stats?.total_url_scans ?? 0}
            color="#10b981" subtitle={`${totalScans.toLocaleString()} by current users`} />
          <AdminStatCard icon={Upload} label="File Uploads" value={stats?.total_file_uploads ?? 0}
            color="#8b5cf6" subtitle="Data ingestion files" />
          <AdminStatCard icon={Database} label="Records Imported" value={stats?.total_records_imported ?? 0}
            color="#f59e0b" subtitle="Across all ingestion" />
          <AdminStatCard icon={AlertTriangle} label="Total Incidents" value={stats?.total_incidents ?? 0}
            color="#ef4444" subtitle="Platform-wide" />
          <AdminStatCard icon={Shield} label="Active IOCs" value={stats?.total_iocs ?? 0}
            color="#d946ef" subtitle="Threat intelligence" />
          <AdminStatCard icon={Activity} label="Monitor Events" value={stats?.total_monitor_events ?? 0}
            color="#3b82f6" subtitle="Live attack events" />
        </motion.div>

        {/* Users table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="card-header" style={{ padding: '18px 20px' }}>
            <h3 className="card-title">
              <Users size={16} style={{ marginRight: 8, color: '#a855f7' }} />
              Registered Users
              <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                {users.length} users
              </span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search users..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 'var(--font-size-xs)' }}
                />
              </div>
              <select
                className="input"
                value={sortKey}
                onChange={e => setSortKey(e.target.value as keyof AdminUser)}
                style={{ paddingTop: 7, paddingBottom: 7, fontSize: 'var(--font-size-xs)', width: 160 }}
              >
                <option value="websites_scanned">Sort: Websites</option>
                <option value="url_scans">Sort: URL Scans</option>
                <option value="file_uploads">Sort: Uploads</option>
                <option value="incidents">Sort: Incidents</option>
                <option value="created_at">Sort: Joined</option>
                <option value="username">Sort: Username</option>
              </select>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSortAsc(!sortAsc)}
                className="btn btn-sm btn-ghost"
                title={sortAsc ? 'Sorting ascending — click for descending' : 'Sorting descending — click for ascending'}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-xs)' }}
              >
                {sortAsc ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {sortAsc ? 'Asc' : 'Desc'}
              </motion.button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{
                  textAlign: 'left',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-tertiary)',
                  borderBottom: 'var(--border-primary)',
                }}>
                  <th style={{ padding: '10px 20px' }}>User</th>
                  <th style={{ padding: '10px 12px' }}>Role</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Websites</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>URL Scans</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Uploads</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Incidents</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Monitor Events</th>
                  <th style={{ padding: '10px 20px' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u, idx) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    style={{
                      borderBottom: 'var(--border-primary)',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: u.role === 'admin'
                            ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                            : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: 'white',
                        }}>
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {u.username}
                            {u.role === 'admin' && (
                              <span className="pill" style={{
                                marginLeft: 6, fontSize: 9, padding: '1px 7px',
                                background: 'rgba(168,85,247,0.15)', color: '#c084fc',
                              }}>ADMIN</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="pill" style={{
                        fontSize: 10, textTransform: 'capitalize',
                        background: u.role === 'admin'
                          ? 'rgba(168,85,247,0.12)' : 'rgba(6,182,212,0.1)',
                        color: u.role === 'admin' ? '#c084fc' : 'var(--accent-primary)',
                      }}>
                        {u.role || 'analyst'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className="pill" style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        background: u.websites_scanned > 0 ? 'rgba(6,182,212,0.12)' : 'var(--bg-tertiary)',
                        color: u.websites_scanned > 0 ? '#22d3ee' : 'var(--text-tertiary)',
                      }}>
                        {u.websites_scanned}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {u.url_scans}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {u.file_uploads}
                    </td>
                    <td style={{
                      padding: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)',
                      color: u.incidents > 0 ? '#f87171' : 'var(--text-tertiary)',
                    }}>
                      {u.incidents}
                    </td>
                    <td style={{
                      padding: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)',
                      color: u.monitor_events > 0 ? '#60a5fa' : 'var(--text-tertiary)',
                    }}>
                      {u.monitor_events}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      }) : '—'}
                    </td>
                  </motion.tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div style={{
            padding: '14px 20px',
            borderTop: 'var(--border-primary)',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-secondary)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={13} style={{ color: '#a855f7' }} />
              <span className="text-mono">{totalWebsitesPerUser.toLocaleString()}</span> total websites across users
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} style={{ color: '#a855f7' }} />
              <span className="text-mono">{totalScans.toLocaleString()}</span> URL scans across users
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} style={{ color: '#a855f7' }} />
              <span className="text-mono">{stats?.total_log_events?.toLocaleString() ?? 0}</span> log events platform-wide
            </span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
