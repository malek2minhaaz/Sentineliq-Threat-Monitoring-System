import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, Globe, Search, Upload, AlertTriangle,
  Shield, Activity, FileText, LogOut, ArrowLeft, KeyRound,
  Database, Radio, Server, ArrowUp, ArrowDown,
  X, Ban, UserCheck, RotateCcw, Trash2, Download, ChevronRight, Loader, CheckCircle2,
} from 'lucide-react';
import { adminApi, adminStorage } from '../utils/adminApi';
import { useAuth } from '../contexts/AuthContext';

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
  is_active: boolean;
  created_at: string | null;
  websites_scanned: number;
  url_scans: number;
  file_uploads: number;
  incidents: number;
  monitor_events: number;
}

interface UserDetail extends AdminUser {
  recent_incidents: Array<{ id: string; title: string; severity: string; status: string; created_at: string }>;
  recent_uploads: Array<{ id: string; type: string; source: string; status: string; created_at: string }>;
  recent_events: Array<{ id: string; event_type: string; severity: string; source_ip: string; timestamp: string; message: string }>;
}

type ConfirmAction = { type: 'delete' | 'suspend' | 'activate' | 'reset'; user: AdminUser } | null;

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

  // Drawer + actions
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [newPassword, setNewPassword] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuth();

  const adminUser = adminStorage.getUser() as { username?: string; role?: string } | null;

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!adminStorage.hasSession()) {
      navigate('/login', { replace: true });
      return;
    }
    loadData();
  }, [navigate, loadData]);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  // ── Drawer ───────────────────────────────────────────────────────────────
  const openUser = async (u: AdminUser) => {
    setDrawerUser(u);
    setUserDetail(null);
    setDetailLoading(true);
    try {
      const d = await adminApi.get<UserDetail>(`/admin/users/${u.id}`);
      setUserDetail(d);
    } catch {
      setUserDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerUser(null);
    setUserDetail(null);
    setNewPassword('');
  };

  // ── User actions ─────────────────────────────────────────────────────────
  const toggleActive = async (u: AdminUser) => {
    setConfirmAction(null);
    try {
      const next = !u.is_active;
      await adminApi.patch(`/admin/users/${u.id}`, { is_active: next });
      await loadData();
      if (userDetail?.id === u.id) setUserDetail(prev => prev ? { ...prev, is_active: next } : prev);
      showToast(next ? `Reactivated ${u.username}` : `Suspended ${u.username}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const changeRole = async (u: AdminUser, role: string) => {
    if (role === u.role) return;
    try {
      await adminApi.patch(`/admin/users/${u.id}`, { role });
      setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, role } : x)));
      if (userDetail?.id === u.id) setUserDetail(prev => prev ? { ...prev, role } : prev);
      loadData();
      showToast(`Role changed to ${role} for ${u.username}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const resetPassword = async (u: AdminUser) => {
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters');
      return;
    }
    setConfirmAction(null);
    try {
      await adminApi.post(`/admin/users/${u.id}/reset-password`, { new_password: newPassword });
      setNewPassword('');
      showToast(`Password reset for ${u.username}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const deleteUser = async (u: AdminUser) => {
    setConfirmAction(null);
    try {
      await adminApi.del(`/admin/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      closeDrawer();
      loadData();
      showToast(`Deleted user ${u.username}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed');
    }
  };

  // ── CSV export ───────────────────────────────────────────────────────────
  const exportCsv = async () => {
    const token = adminStorage.getToken();
    if (!token || exporting) return;
    setExporting(true);
    try {
      const res = await fetch('/api/admin/export/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sentinaliq_users.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Users exported as CSV');
    } catch {
      showToast('CSV export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    logout(); // clears both the admin-panel session and the regular session
    navigate('/login', { replace: true });
  };

  const isSelf = (u: AdminUser) => adminUser?.username === u.username;

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
        background: 'linear-gradient(135deg, rgba(96,165,250,0.12), rgba(37,99,235,0.05))',
        borderBottom: '1px solid rgba(96, 165, 250, 0.15)',
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
            background: 'rgba(96, 165, 250, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(96, 165, 250, 0.3)',
          }}>
            <ShieldCheck size={22} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
              SentinalIQ <span style={{ color: '#3b82f6' }}>Admin Panel</span>
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
              background: 'rgba(96, 165, 250, 0.1)',
              borderRadius: 999,
              fontSize: 'var(--font-size-xs)',
              color: '#7dd3fc',
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
            color="#3b82f6" subtitle="Registered platform accounts" />
          <AdminStatCard icon={Globe} label="Websites Monitored" value={stats?.total_websites ?? 0}
            color="#38bdf8" subtitle="All users combined" />
          <AdminStatCard icon={Radio} label="URL Scans" value={stats?.total_url_scans ?? 0}
            color="#10b981" subtitle={`${totalScans.toLocaleString()} by current users`} />
          <AdminStatCard icon={Upload} label="File Uploads" value={stats?.total_file_uploads ?? 0}
            color="#60a5fa" subtitle="Data ingestion files" />
          <AdminStatCard icon={Database} label="Records Imported" value={stats?.total_records_imported ?? 0}
            color="#f59e0b" subtitle="Across all ingestion" />
          <AdminStatCard icon={AlertTriangle} label="Total Incidents" value={stats?.total_incidents ?? 0}
            color="#ef4444" subtitle="Platform-wide" />
          <AdminStatCard icon={Shield} label="Active IOCs" value={stats?.total_iocs ?? 0}
            color="#3b82f6" subtitle="Threat intelligence" />
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
              <Users size={16} style={{ marginRight: 8, color: '#3b82f6' }} />
              Registered Users
              <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                {users.length} users
              </span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportCsv}
                className="btn btn-sm btn-ghost"
                title="Export users as CSV"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 'var(--font-size-xs)', color: 'var(--accent-primary)',
                  border: 'var(--border-primary)',
                }}
              >
                {exporting ? <Loader size={14} className="loading-spinner" /> : <Download size={14} />}
                Export CSV
              </motion.button>
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
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Websites</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>URL Scans</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Uploads</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Incidents</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Monitor Events</th>
                  <th style={{ padding: '10px 20px' }}>Joined</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}></th>
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
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => openUser(u)}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: u.role === 'admin'
                            ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
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
                                background: 'rgba(96,165,250,0.15)', color: '#7dd3fc',
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
                          ? 'rgba(96,165,250,0.12)' : 'rgba(56,189,248,0.1)',
                        color: u.role === 'admin' ? '#7dd3fc' : 'var(--accent-primary)',
                      }}>
                        {u.role || 'analyst'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="pill" style={{
                        fontSize: 10,
                        background: u.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        color: u.is_active ? '#34d399' : '#f87171',
                      }}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className="pill" style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        background: u.websites_scanned > 0 ? 'rgba(56,189,248,0.12)' : 'var(--bg-tertiary)',
                        color: u.websites_scanned > 0 ? '#7dd3fc' : 'var(--text-tertiary)',
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
                    <td style={{ padding: '12px 20px 12px 4px', textAlign: 'right' }}>
                      <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', verticalAlign: 'middle' }} />
                    </td>
                  </motion.tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
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
              <Server size={13} style={{ color: '#3b82f6' }} />
              <span className="text-mono">{totalWebsitesPerUser.toLocaleString()}</span> total websites across users
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} style={{ color: '#3b82f6' }} />
              <span className="text-mono">{totalScans.toLocaleString()}</span> URL scans across users
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} style={{ color: '#3b82f6' }} />
              <span className="text-mono">{stats?.total_log_events?.toLocaleString() ?? 0}</span> log events platform-wide
            </span>
          </div>
        </motion.div>
      </main>

      {/* ── User detail drawer ── */}
      <AnimatePresence>
        {drawerUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(2px)', zIndex: 200,
              }}
            />
            <motion.aside
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '92vw',
                background: 'var(--bg-card)', borderLeft: 'var(--border-primary)',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.3)', zIndex: 210,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
            >
              {/* Drawer header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: 'var(--border-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(96,165,250,0.08), transparent)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: (userDetail?.role ?? drawerUser.role) === 'admin'
                      ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                      : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: 'white',
                  }}>
                    {drawerUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                      {drawerUser.username}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{drawerUser.email}</div>
                  </div>
                </div>
                <button onClick={closeDrawer} className="btn-icon btn-ghost" title="Close">
                  <X size={18} />
                </button>
              </div>

              {/* Drawer body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {detailLoading ? (
                  <div className="loading-container" style={{ padding: 48 }}>
                    <div className="loading-spinner" />
                  </div>
                ) : userDetail ? (
                  <>
                    {/* Status + role row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                      <span className="pill" style={{
                        fontSize: 10,
                        background: userDetail.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        color: userDetail.is_active ? '#34d399' : '#f87171',
                      }}>
                        {userDetail.is_active ? '● Active' : '● Suspended'}
                      </span>
                      <span className="pill" style={{
                        fontSize: 10, textTransform: 'capitalize',
                        background: userDetail.role === 'admin' ? 'rgba(96,165,250,0.12)' : 'rgba(56,189,248,0.1)',
                        color: userDetail.role === 'admin' ? '#7dd3fc' : 'var(--accent-primary)',
                      }}>
                        {userDetail.role || 'analyst'}
                      </span>
                      <span className="pill" style={{ fontSize: 10, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                        {userDetail.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                      <span className="pill" style={{ fontSize: 10, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                        Joined {userDetail.created_at ? new Date(userDetail.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>

                    {/* Mini stats */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24,
                    }}>
                      {[
                        { label: 'Websites', value: userDetail.websites_scanned },
                        { label: 'URL Scans', value: userDetail.url_scans },
                        { label: 'Uploads', value: userDetail.file_uploads },
                        { label: 'Incidents', value: userDetail.incidents },
                        { label: 'Events', value: userDetail.monitor_events },
                        { label: 'Joined', value: userDetail.created_at ? new Date(userDetail.created_at).getFullYear() : '—' },
                      ].map(s => (
                        <div key={s.label} style={{
                          padding: '12px', background: 'var(--bg-secondary)',
                          borderRadius: 'var(--border-radius-sm)', textAlign: 'center',
                          border: 'var(--border-primary)',
                        }}>
                          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                            {s.value}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                        Manage Account
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Role change */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <KeyRound size={13} /> Role
                          </span>
                          <select
                            className="input"
                            value={userDetail.role}
                            onChange={e => changeRole(drawerUser, e.target.value)}
                            disabled={isSelf(drawerUser)}
                            style={{ paddingTop: 6, paddingBottom: 6, fontSize: 'var(--font-size-xs)', width: 150 }}
                          >
                            <option value="analyst">Analyst</option>
                            <option value="soc_lead">SOC Lead</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>

                        {/* Suspend / activate */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Ban size={13} /> Account status
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setConfirmAction({ type: userDetail.is_active ? 'suspend' : 'activate', user: drawerUser })}
                            disabled={isSelf(drawerUser)}
                            className="btn btn-sm"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)',
                              background: userDetail.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                              color: userDetail.is_active ? '#f87171' : '#34d399',
                              border: `1px solid ${userDetail.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                            }}
                          >
                            {userDetail.is_active ? <Ban size={13} /> : <UserCheck size={13} />}
                            {userDetail.is_active ? 'Suspend' : 'Activate'}
                          </motion.button>
                        </div>

                        {/* Reset password */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <RotateCcw size={13} /> Reset password
                          </span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              className="input"
                              placeholder="New password (min 6 chars)"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              style={{ paddingTop: 7, paddingBottom: 7, fontSize: 'var(--font-size-xs)', flex: 1 }}
                            />
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setConfirmAction({ type: 'reset', user: drawerUser })}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              Set
                            </motion.button>
                          </div>
                        </div>

                        {/* Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10, borderTop: 'var(--border-primary)' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Trash2 size={13} /> Danger zone
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setConfirmAction({ type: 'delete', user: drawerUser })}
                            disabled={isSelf(drawerUser)}
                            className="btn btn-sm"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)',
                              background: 'rgba(239,68,68,0.1)', color: '#f87171',
                              border: '1px solid rgba(239,68,68,0.3)',
                            }}
                          >
                            <Trash2 size={13} /> Delete user
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Recent activity */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                        Recent Activity
                      </div>

                      {userDetail.recent_incidents.length === 0 && userDetail.recent_uploads.length === 0 && userDetail.recent_events.length === 0 && (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                          No activity yet
                        </div>
                      )}

                      {userDetail.recent_incidents.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                            INCIDENTS ({userDetail.recent_incidents.length})
                          </div>
                          {userDetail.recent_incidents.map(inc => (
                            <div key={inc.id} style={{
                              padding: '10px 12px', background: 'var(--bg-secondary)',
                              borderRadius: 'var(--border-radius-sm)', marginBottom: 6,
                              border: 'var(--border-primary)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={12} style={{
                                  color: inc.severity === 'critical' ? '#ef4444'
                                    : inc.severity === 'high' ? '#f97316' : '#eab308',
                                }} />
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                                  {inc.title}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-mono">{inc.status}</span>
                                <span>{new Date(inc.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {userDetail.recent_uploads.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                            INGESTION ({userDetail.recent_uploads.length})
                          </div>
                          {userDetail.recent_uploads.map(rec => (
                            <div key={rec.id} style={{
                              padding: '10px 12px', background: 'var(--bg-secondary)',
                              borderRadius: 'var(--border-radius-sm)', marginBottom: 6,
                              border: 'var(--border-primary)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Upload size={12} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                                  {rec.source.slice(0, 32)}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-mono">{rec.type.replace('_', ' ')}</span>
                                <span>{new Date(rec.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {userDetail.recent_events.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                            MONITOR EVENTS ({userDetail.recent_events.length})
                          </div>
                          {userDetail.recent_events.map(ev => (
                            <div key={ev.id} style={{
                              padding: '10px 12px', background: 'var(--bg-secondary)',
                              borderRadius: 'var(--border-radius-sm)', marginBottom: 6,
                              border: 'var(--border-primary)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Activity size={12} style={{
                                  color: ev.severity === 'critical' ? '#ef4444'
                                    : ev.severity === 'high' ? '#f97316' : '#60a5fa',
                                }} />
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                                  {ev.message || ev.event_type}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-mono">{ev.event_type}</span>
                                <span>{new Date(ev.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                    Could not load user details
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Confirmation modal ── */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(3px)', zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              className="card"
              style={{ width: 400, padding: 28, background: 'var(--bg-card)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: confirmAction.type === 'delete' || confirmAction.type === 'suspend'
                    ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {confirmAction.type === 'delete' ? <Trash2 size={18} style={{ color: '#f87171' }} />
                    : confirmAction.type === 'suspend' ? <Ban size={18} style={{ color: '#f87171' }} />
                    : confirmAction.type === 'activate' ? <UserCheck size={18} style={{ color: '#34d399' }} />
                    : <RotateCcw size={18} style={{ color: '#34d399' }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                    {confirmAction.type === 'delete' ? 'Delete user?' :
                     confirmAction.type === 'suspend' ? 'Suspend user?' :
                     confirmAction.type === 'activate' ? 'Activate user?' : 'Reset password?'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                    @{confirmAction.user.username} · {confirmAction.user.email}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                {confirmAction.type === 'delete'
                  ? 'This permanently deletes the account and all of their data (websites, incidents, uploads, events). This cannot be undone.'
                  : confirmAction.type === 'suspend'
                    ? 'The user will no longer be able to log in until you reactivate them.'
                    : confirmAction.type === 'activate'
                      ? 'The user will regain access to their account.'
                      : `Set a new password for ${confirmAction.user.username}. They will need to use it on their next login.`}
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setConfirmAction(null)}
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (confirmAction.type === 'delete') deleteUser(confirmAction.user);
                    else if (confirmAction.type === 'suspend' || confirmAction.type === 'activate') toggleActive(confirmAction.user);
                    else resetPassword(confirmAction.user);
                  }}
                  className="btn btn-sm"
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    background: confirmAction.type === 'delete' || confirmAction.type === 'suspend'
                      ? '#ef4444' : '#10b981',
                    border: 'none', color: 'white',
                  }}
                >
                  {confirmAction.type === 'delete' ? 'Delete' :
                   confirmAction.type === 'suspend' ? 'Suspend' :
                   confirmAction.type === 'activate' ? 'Activate' : 'Reset'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{
              position: 'fixed', top: 20, right: 20, zIndex: 400,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', background: 'var(--bg-card)',
              border: '1px solid rgba(96,165,250,0.3)', borderRadius: 'var(--border-radius-sm)',
              boxShadow: 'var(--shadow-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)',
            }}
          >
            <CheckCircle2 size={16} style={{ color: '#34d399' }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
