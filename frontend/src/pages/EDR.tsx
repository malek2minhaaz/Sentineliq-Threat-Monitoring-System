import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Search, RefreshCw, HardDrive, Cpu, MemoryStick,
  Activity, AlertTriangle, ShieldOff, ShieldCheck, ScanLine,
  Trash2, Ban, Siren, History, X, MoreVertical, Loader, Lock,
  Terminal,
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

interface EndpointAction {
  action: string;
  detail: string;
  timestamp: string;
}

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
  isolated: boolean;
  isolation_reason: string;
  isolation_started_at: string | null;
  action_history: EndpointAction[];
}

const statusColors: Record<string, string> = {
  online: '#10b981',
  offline: '#64748b',
  compromised: '#ef4444',
  maintenance: '#f59e0b',
};

// Pretty labels for action types in history
const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  isolate: { label: 'Isolated', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  unisolate: { label: 'Released', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  scan: { label: 'Scanned', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  kill_process: { label: 'Process Killed', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  block_ip: { label: 'IP Blocked', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  escalate: { label: 'Escalated', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  isolate: ShieldOff,
  unisolate: ShieldCheck,
  scan: ScanLine,
  kill_process: Trash2,
  block_ip: Ban,
  escalate: Siren,
};

interface ConfirmState {
  endpoint: Endpoint;
  kind: 'isolate' | 'unisolate' | 'kill_process' | 'block_ip' | 'escalate';
}

export default function EDR() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [historyEndpoint, setHistoryEndpoint] = useState<Endpoint | null>(null);
  // Inputs for confirm modal
  const [confirmInput, setConfirmInput] = useState('');
  const { addToast } = useToast();

  // Close the action dropdown when clicking anywhere else
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

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

  const updateEndpointInList = (updated: Endpoint) => {
    setEndpoints(prev => prev.map(e => e.id === updated.id ? updated : e));
  };

  // ── Response actions ───────────────────────────────────────────────────

  const runAction = async (ep: Endpoint, endpoint: string, body?: unknown) => {
    setBusyId(ep.id);
    try {
      const res = await api.post<Endpoint & { message?: string; findings?: string[] }>(endpoint, body);
      updateEndpointInList(res);
      setOpenMenuId(null);
      return res;
    } catch (e: any) {
      let msg = 'Action failed';
      try { msg = JSON.parse(e.message || '{}').detail || msg; } catch { /* ignore */ }
      addToast({ type: 'error', title: 'Action failed', message: msg });
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const handleIsolate = async () => {
    if (!confirm) return;
    const reason = confirmInput.trim() || 'Suspicious activity detected';
    const res = await runAction(confirm.endpoint, `/endpoints/${confirm.endpoint.id}/isolate`, { reason });
    if (res) addToast({ type: 'success', title: 'Endpoint isolated', message: `${confirm.endpoint.hostname} quarantined from the network` });
    setConfirm(null);
    setConfirmInput('');
  };

  const handleUnisolate = async () => {
    if (!confirm) return;
    const res = await runAction(confirm.endpoint, `/endpoints/${confirm.endpoint.id}/unisolate`);
    if (res) addToast({ type: 'success', title: 'Endpoint released', message: `${confirm.endpoint.hostname} restored to the network` });
    setConfirm(null);
  };

  const handleScan = async (ep: Endpoint, kind: 'quick' | 'full') => {
    const res = await runAction(ep, `/endpoints/${ep.id}/scan`, { type: kind });
    if (res?.message) {
      addToast({ type: res.findings?.length ? 'warning' : 'success', title: 'Scan complete', message: res.message });
    }
  };

  const handleKillProcess = async () => {
    if (!confirm) return;
    const process = confirmInput.trim();
    if (!process) { addToast({ type: 'warning', title: 'Process name required', message: 'Enter the process name to terminate.' }); return; }
    const res = await runAction(confirm.endpoint, `/endpoints/${confirm.endpoint.id}/kill-process`, { process });
    if (res) addToast({ type: 'success', title: 'Process terminated', message: `${process} killed on ${confirm.endpoint.hostname}` });
    setConfirm(null);
    setConfirmInput('');
  };

  const handleBlockIp = async () => {
    if (!confirm) return;
    const ip = confirmInput.trim();
    if (!ip) { addToast({ type: 'warning', title: 'IP required', message: 'Enter the IP address to block.' }); return; }
    const res = await runAction(confirm.endpoint, `/endpoints/${confirm.endpoint.id}/block-ip`, { ip });
    if (res) addToast({ type: 'success', title: 'IP blocked', message: `${ip} blocked on ${confirm.endpoint.hostname} (IOC + WAF rule created)` });
    setConfirm(null);
    setConfirmInput('');
  };

  const handleEscalate = async () => {
    if (!confirm) return;
    const note = confirmInput.trim();
    const res = await runAction(confirm.endpoint, `/endpoints/${confirm.endpoint.id}/escalate`, { severity: 'high', note });
    if (res) addToast({ type: 'success', title: 'Incident created', message: `${confirm.endpoint.hostname} escalated to a high severity incident` });
    setConfirm(null);
    setConfirmInput('');
  };

  const openConfirm = (ep: Endpoint, kind: ConfirmState['kind']) => {
    setConfirmInput('');
    setConfirm({ endpoint: ep, kind });
    setOpenMenuId(null);
  };

  const openHistory = (ep: Endpoint) => {
    setHistoryEndpoint(ep);
    setOpenMenuId(null);
  };

  // ── Confirm modal config ───────────────────────────────────────────────

  const confirmConfig = confirm ? ({
    isolate: {
      title: `Isolate ${confirm.endpoint.hostname}?`,
      desc: 'This quarantines the endpoint from the network to stop lateral movement and data exfiltration. Use an optional reason.',
      placeholder: 'Reason for isolation (e.g., ransomware detected)',
      button: 'Isolate Endpoint',
      color: '#ef4444',
      icon: ShieldOff,
      submit: handleIsolate,
    },
    unisolate: {
      title: `Release ${confirm.endpoint.hostname}?`,
      desc: 'The endpoint will be restored to the network and marked online again.',
      placeholder: '',
      button: 'Release Endpoint',
      color: '#10b981',
      icon: ShieldCheck,
      submit: handleUnisolate,
    },
    kill_process: {
      title: `Terminate process on ${confirm.endpoint.hostname}?`,
      desc: 'Enter the name of the suspicious process to terminate.',
      placeholder: 'Process name (e.g., powershell.exe)',
      button: 'Terminate Process',
      color: '#f59e0b',
      icon: Trash2,
      submit: handleKillProcess,
    },
    block_ip: {
      title: `Block IP from ${confirm.endpoint.hostname}?`,
      desc: 'The IP is added to Threat Intel as an IOC and a WAF rule is created to block it at the edge (XDR).',
      placeholder: 'Source IP (e.g., 185.234.72.18)',
      button: 'Block IP',
      color: '#8b5cf6',
      icon: Ban,
      submit: handleBlockIp,
    },
    escalate: {
      title: `Escalate ${confirm.endpoint.hostname} to an incident?`,
      desc: 'Creates a high severity security incident that appears in your Incidents list.',
      placeholder: 'Optional notes for the incident',
      button: 'Escalate to Incident',
      color: '#f97316',
      icon: Siren,
      submit: handleEscalate,
    },
  } as const)[confirm.kind] : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">EDR / XDR</h1>
          <p className="page-subtitle">Endpoint Detection and Response — monitor, isolate, and remediate your endpoints</p>
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
                borderLeft: `4px solid ${ep.isolated ? '#ef4444' : statusColors[ep.status] || '#64748b'}`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Isolated banner */}
              {ep.isolated && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  background: 'rgba(239,68,68,0.14)',
                  borderBottom: '1px solid rgba(239,68,68,0.3)',
                  padding: '6px 14px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 600, color: '#ef4444',
                }}>
                  <Lock size={12} />
                  ISOLATED{ep.isolation_reason ? ` — ${ep.isolation_reason}` : ''}
                </div>
              )}

              {/* Risk indicator + action menu */}
              <div style={{
                position: 'absolute',
                top: ep.isolated ? 44 : 16,
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
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn-icon btn-ghost"
                    style={{ width: 28, height: 28, borderRadius: 8, opacity: 0.8 }}
                    onClick={() => setOpenMenuId(openMenuId === ep.id ? null : ep.id)}
                    aria-label="Response actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                  <AnimatePresence>
                    {openMenuId === ep.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -4 }}
                        transition={{ duration: 0.12 }}
                        style={{
                          position: 'absolute', right: 0, top: 34, zIndex: 50,
                          width: 230,
                          background: 'var(--bg-card)',
                          border: 'var(--border-primary)',
                          borderRadius: 'var(--border-radius-md)',
                          boxShadow: 'var(--shadow-lg)',
                          padding: 6,
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{
                          padding: '6px 10px', fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: 'var(--text-tertiary)',
                        }}>
                          Response Actions
                        </div>
                        {!ep.isolated ? (
                          <MenuItem icon={ShieldOff} color="#ef4444" label="Isolate Endpoint" onClick={() => openConfirm(ep, 'isolate')} />
                        ) : (
                          <MenuItem icon={ShieldCheck} color="#10b981" label="Release / Unisolate" onClick={() => openConfirm(ep, 'unisolate')} />
                        )}
                        <MenuItem icon={ScanLine} color="#3b82f6" label="Run Quick Scan" onClick={() => handleScan(ep, 'quick')} />
                        <MenuItem icon={ScanLine} color="#60a5fa" label="Run Full Scan" onClick={() => handleScan(ep, 'full')} />
                        <MenuItem icon={Trash2} color="#f59e0b" label="Kill Process" onClick={() => openConfirm(ep, 'kill_process')} />
                        <MenuItem icon={Ban} color="#8b5cf6" label="Block Source IP" onClick={() => openConfirm(ep, 'block_ip')} />
                        <MenuItem icon={Siren} color="#f97316" label="Escalate to Incident" onClick={() => openConfirm(ep, 'escalate')} />
                        <div style={{ borderTop: 'var(--border-primary)', margin: '4px 0' }} />
                        <MenuItem icon={History} color="var(--text-secondary)" label="Action History" onClick={() => openHistory(ep)} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: ep.isolated ? 44 : 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: ep.isolated ? 'rgba(239,68,68,0.12)' : 'rgba(56,189,248,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Monitor size={22} style={{ color: ep.isolated ? '#ef4444' : 'var(--accent-primary)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.hostname}</h3>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {ep.ip_address}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className={`badge`} style={{ background: `${statusColors[ep.status]}20`, color: statusColors[ep.status] }}>
                  <span className={`status-dot ${ep.status}`} style={{ width: 6, height: 6 }} />
                  {ep.status}
                </span>
                <span className="badge badge-info">{ep.os?.split(' ').slice(0, 2).join(' ') || ep.os}</span>
                {ep.isolated && (
                  <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                    <Lock size={10} style={{ display: 'inline', marginRight: 3 }} /> Isolated
                  </span>
                )}
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
                alignItems: 'center',
              }}>
                <span>Agent v{ep.agent_version}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Last seen: {new Date(ep.last_seen).toLocaleString()}</span>
                  {busyId === ep.id && <Loader size={12} className="loading-spinner" />}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Confirm action modal */}
      <AnimatePresence>
        {confirm && confirmConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 'var(--space-lg)',
            }}
            onClick={() => { setConfirm(null); setConfirmInput(''); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="card"
              style={{ maxWidth: 460, width: '100%' }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, marginBottom: 14,
                background: `${confirmConfig.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <confirmConfig.icon size={24} style={{ color: confirmConfig.color }} />
              </div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 8 }}>
                {confirmConfig.title}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 16, lineHeight: 1.5 }}>
                {confirmConfig.desc}
              </p>
              {confirmConfig.placeholder && (
                <input
                  className="input"
                  style={{ marginBottom: 16 }}
                  placeholder={confirmConfig.placeholder}
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmConfig.submit()}
                  autoFocus
                />
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => { setConfirm(null); setConfirmInput(''); }}>
                  Cancel
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: confirmConfig.color, border: 'none', color: 'white' }}
                  onClick={confirmConfig.submit}
                  disabled={busyId === confirm.endpoint.id}
                >
                  {busyId === confirm.endpoint.id ? <Loader size={12} className="loading-spinner" /> : <confirmConfig.icon size={12} />}
                  {confirmConfig.button}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action history modal */}
      <AnimatePresence>
        {historyEndpoint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 'var(--space-lg)',
            }}
            onClick={() => setHistoryEndpoint(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="card"
              style={{ maxWidth: 560, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <History size={18} style={{ color: 'var(--accent-primary)' }} />
                    Action History
                  </h2>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {historyEndpoint.hostname} · {historyEndpoint.ip_address}
                  </div>
                </div>
                <button className="btn-icon btn-ghost" onClick={() => setHistoryEndpoint(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ overflow: 'auto', flex: 1 }}>
                {historyEndpoint.action_history?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...historyEndpoint.action_history].reverse().map((act, i) => {
                      const cfg = ACTION_LABELS[act.action] || { label: act.action, color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' };
                      const Icon = ACTION_ICONS[act.action] || Terminal;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          style={{
                            display: 'flex', gap: 12, padding: '10px 14px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--border-radius-sm)',
                            border: 'var(--border-primary)',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: cfg.bg, color: cfg.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon size={14} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: cfg.color, textTransform: 'capitalize' }}>
                                {cfg.label}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                                {new Date(act.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {act.detail}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <History size={40} className="empty-state-icon" />
                    <div className="empty-state-title">No actions recorded</div>
                    <div className="empty-state-desc">Use the response menu to isolate, scan, or remediate this endpoint.</div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .filters-row { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

// ─── Dropdown menu item ─────────────────────────────────────────────────────

function MenuItem({ icon: Icon, color, label, onClick }: {
  icon: React.ElementType;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: 'none', border: 'none',
        borderRadius: 'var(--border-radius-sm)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 500,
        color: 'var(--text-primary)',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      {label}
    </button>
  );
}
