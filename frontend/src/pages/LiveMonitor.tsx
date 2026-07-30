import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Shield, AlertTriangle, Radio, Globe,
  Search, Link as LinkIcon,
  Lock, Eye, EyeOff, Terminal, Code,
  Skull, Flame, Crosshair, Swords, Bug, Trash2,
  XCircle, Info, Loader, Target, Gauge,
  FileText, CornerDownRight, CheckCheck,
  Monitor, List,
} from 'lucide-react';
import { api } from '../utils/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScanFinding {
  type: string;
  severity: string;
  title: string;
  description: string;
  score: number;
  recommendation: string;
}

interface MonitoredWebsite {
  id: string;
  user_id: string;
  url: string;
  url_hash: string;
  hostname: string;
  threat_score: number;
  threat_level: string;
  status: string;
  findings: ScanFinding[];
  last_scan_at: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  scan_count: number;
  incident_count: number;
}

interface MonitorEvent {
  id: string;
  timestamp: string;
  event_type: string;
  severity: string;
  source_ip: string;
  source_country: string;
  target: string;
  method: string;
  path: string;
  payload: string;
  message: string;
  status: string;
  is_active: boolean;
}

interface WebsiteIncident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  source: string;
  category: string;
  created_at: string;
}

interface WebsiteMonitorData {
  monitor: MonitoredWebsite;
  findings: ScanFinding[];
  threat_score: number;
  threat_level: string;
  hostname: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
  safe: '#22c55e',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(239,68,68,0.15)',
  high: 'rgba(249,115,22,0.15)',
  medium: 'rgba(234,179,8,0.15)',
  low: 'rgba(34,197,94,0.15)',
  info: 'rgba(59,130,246,0.15)',
  safe: 'rgba(34,197,94,0.15)',
};

const THREAT_LEVEL_CONFIG = {
  safe: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', icon: Shield, label: 'Safe' },
  low: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: Info, label: 'Low Risk' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.15)', icon: AlertTriangle, label: 'Medium Risk' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.15)', icon: Flame, label: 'High Risk' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: Skull, label: 'Critical' },
};

const STATUS_COLORS: Record<string, string> = {
  blocked: '#ef4444',
  detected: '#f97316',
  investigating: '#eab308',
  mitigated: '#22c55e',
  monitoring: '#3b82f6',
  under_attack: '#ef4444',
  compromised: '#ef4444',
  clean: '#22c55e',
  scanning: '#eab308',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  injection: Bug,
  xss: Code,
  brute_force: Lock,
  scan: Radio,
  ddos: Flame,
  malware: Skull,
  path_traversal: Crosshair,
  csrf: Swords,
  incident: AlertTriangle,
  anomaly: Activity,
  info: Info,
  suspicious_tld: Globe,
  direct_ip: Monitor,
  url_shortener: LinkIcon,
  subdomain_abuse: CornerDownRight,
  suspicious_characters: Terminal,
  no_https: Lock,
  brand_impersonation: AlertTriangle,
  port_scan: Radio,
  dns_check: Globe,
};

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || 'var(--text-secondary)';
}

// ─── Threat Score Gauge ─────────────────────────────────────────────────────

function ThreatScoreGauge({ score, level }: { score: number; level: string }) {
  const config = THREAT_LEVEL_CONFIG[level as keyof typeof THREAT_LEVEL_CONFIG] || THREAT_LEVEL_CONFIG.safe;
  const Icon = config.icon;
  
  // Arc calculation
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 160, height: 90, overflow: 'hidden' }}>
        <svg width="160" height="90" viewBox="0 0 160 100">
          {/* Background arc */}
          <path
            d="M 20 90 A 60 60 0 0 1 140 90"
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Score arc */}
          <motion.path
            d="M 20 90 A 60 60 0 0 1 140 90"
            fill="none"
            stroke={config.color}
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeDasharray={circumference}
            style={{ transform: 'rotate(180deg)', transformOrigin: '80px 90px' }}
          />
        </svg>
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center',
        }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)', color: config.color, lineHeight: 1 }}
          >
            {score}
          </motion.div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            / 100
          </div>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 16px',
          background: config.bg,
          borderRadius: 999,
          color: config.color,
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
        }}
      >
        <Icon size={16} />
        {config.label}
      </motion.div>
    </div>
  );
}

// ─── Finding Item ───────────────────────────────────────────────────────────

function FindingItem({ finding, index }: { finding: ScanFinding; index: number }) {
  const Icon = TYPE_ICONS[finding.type] || AlertTriangle;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: 'flex', gap: 12, padding: '12px 14px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-sm)',
        border: `1px solid ${(finding.severity === 'high' || finding.severity === 'critical') ? SEVERITY_BG[finding.severity] : 'var(--border-primary)'}`,
        borderLeft: `3px solid ${SEVERITY_COLORS[finding.severity] || 'var(--text-tertiary)'}`,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: SEVERITY_BG[finding.severity],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={SEVERITY_COLORS[finding.severity]} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
            {finding.title}
          </span>
          {finding.score > 0 && (
            <span className="pill" style={{
              background: SEVERITY_BG[finding.severity],
              color: SEVERITY_COLORS[finding.severity],
              fontSize: 10, padding: '0 8px',
            }}>
              +{finding.score}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
          {finding.description}
        </div>
        {finding.recommendation && (
          <div style={{ fontSize: 11, color: 'var(--accent-info)', fontStyle: 'italic' }}>
            Recommendation: {finding.recommendation}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Website Card ───────────────────────────────────────────────────────────

function WebsiteCard({ website, selected, onClick, onDelete }: {
  website: MonitoredWebsite;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const config = THREAT_LEVEL_CONFIG[website.threat_level as keyof typeof THREAT_LEVEL_CONFIG] || THREAT_LEVEL_CONFIG.safe;
  const statusColor = getStatusColor(website.status);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      style={{
        padding: '12px 14px',
        background: selected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        border: selected ? `1px solid ${config.color}40` : 'var(--border-primary)',
        borderRadius: 'var(--border-radius-sm)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
      whileHover={{ borderColor: config.color + '40' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: statusColor,
            boxShadow: website.status === 'under_attack' ? `0 0 8px ${statusColor}` : 'none',
          }} />
          <span style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {website.hostname}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="pill" style={{
            background: config.bg, color: config.color,
            fontSize: 10, padding: '0 8px',
            fontFamily: 'var(--font-mono)',
          }}>
            {website.threat_score}
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="btn-icon btn-ghost"
            style={{ width: 24, height: 24, opacity: 0.4 }}
          >
            <Trash2 size={12} />
          </motion.button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span>{website.url.slice(0, 40)}{website.url.length > 40 ? '...' : ''}</span>
        <span>•</span>
        <span style={{ textTransform: 'capitalize', color: statusColor }}>{website.status}</span>
        <span>•</span>
        <span>{website.incident_count} incidents</span>
      </div>
    </motion.div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

// ─── Incident Card ──────────────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: WebsiteIncident }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '10px 14px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-sm)',
        border: `1px solid ${SEVERITY_BG[incident.severity] || 'var(--border-primary)'}`,
        borderLeft: `3px solid ${SEVERITY_COLORS[incident.severity] || 'var(--text-tertiary)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={12} color={SEVERITY_COLORS[incident.severity]} />
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
            {incident.title}
          </span>
        </div>
        <span className="pill" style={{
          background: SEVERITY_BG[incident.severity],
          color: SEVERITY_COLORS[incident.severity],
          fontSize: 10, padding: '0 8px',
          textTransform: 'capitalize',
        }}>
          {incident.severity}
        </span>
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
        {incident.description?.slice(0, 120)}{incident.description?.length > 120 ? '...' : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span className="pill" style={{
          background: `${STATUS_COLORS[incident.status] || 'var(--text-tertiary)'}15`,
          color: STATUS_COLORS[incident.status] || 'var(--text-secondary)',
          fontSize: 10, padding: '0 6px',
          textTransform: 'capitalize',
        }}>
          {incident.status}
        </span>
        <span>{formatDate(incident.created_at)}</span>
        <span>{incident.category}</span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LiveMonitor() {
  const [websites, setWebsites] = useState<MonitoredWebsite[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<MonitoredWebsite | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [incidents, setIncidents] = useState<WebsiteIncident[]>([]);
  const [websiteEvents, setWebsiteEvents] = useState<MonitorEvent[]>([]);
  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MonitorEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch websites ──────────────────────────────────────────────────────

  const fetchWebsites = useCallback(async () => {
    try {
      const data = await api.get<{ items: MonitoredWebsite[] }>('/monitor/websites');
      setWebsites(data.items);
      if (data.items.length > 0 && !selectedWebsite) {
        setSelectedWebsite(data.items[0]);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedWebsite]);

  useEffect(() => { fetchWebsites(); }, [fetchWebsites]);

  // ── Fetch website details ───────────────────────────────────────────────

  const fetchWebsiteDetails = useCallback(async (websiteId: string) => {
    try {
      const [detail, incidentData] = await Promise.all([
        api.get<MonitoredWebsite>(`/monitor/website/${websiteId}`),
        api.get<{ incidents: WebsiteIncident[]; events: MonitorEvent[] }>(`/monitor/website/${websiteId}/incidents`),
      ]);
      setSelectedWebsite(detail);
      setIncidents(incidentData.incidents);
      setWebsiteEvents(incidentData.events);
      // Update in list
      setWebsites(prev => prev.map(w => w.id === websiteId ? detail : w));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (selectedWebsite) {
      fetchWebsiteDetails(selectedWebsite.id);
    }
  }, [selectedWebsite?.id, fetchWebsiteDetails]);

  // ── Scan Website ────────────────────────────────────────────────────────

  const scanWebsite = async () => {
    if (!urlInput.trim() || scanning) return;
    setScanning(true);
    try {
      const data = await api.post<WebsiteMonitorData>('/monitor/scan-website', { url: urlInput.trim() });
      setUrlInput('');
      // Refresh the list and select the new website
      const websitesRes = await api.get<{ items: MonitoredWebsite[] }>('/monitor/websites');
      setWebsites(websitesRes.items);
      setSelectedWebsite(data.monitor);
      setIncidents([]);
      setWebsiteEvents([]);
    } catch {
      // Silently fail
    } finally {
      setScanning(false);
    }
  };

  // ── Resolve Incidents ───────────────────────────────────────────────────

  const resolveIncidents = async () => {
    if (!selectedWebsite || resolving) return;
    setResolving(true);
    try {
      const data = await api.post<any>(`/monitor/website/${selectedWebsite.id}/resolve`);
      if (data.website) {
        setSelectedWebsite(data.website);
        setWebsites(prev => prev.map(w => w.id === selectedWebsite.id ? data.website : w));
      }
      setIncidents([]);
      setWebsiteEvents(prev => prev.filter(e => !e.is_active));
    } catch { /* ignore */ }
    finally { setResolving(false); }
  };

  // ── Delete Website ──────────────────────────────────────────────────────

  const deleteWebsite = async (websiteId: string) => {
    try {
      await api.del(`/monitor/website/${websiteId}`);
    } catch { /* ignore */ }
    
    const remaining = websites.filter(w => w.id !== websiteId);
    setWebsites(remaining);
    
    if (selectedWebsite?.id === websiteId) {
      const currentIdx = websites.findIndex(w => w.id === websiteId);
      const nextIdx = Math.min(currentIdx, remaining.length - 1);
      setSelectedWebsite(remaining[nextIdx] || null);
    }
  };

  // ── Polling ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(async () => {
      if (selectedWebsite) {
        try {
          const data = await api.get<{ incidents: WebsiteIncident[]; events: MonitorEvent[] }>(
            `/monitor/website/${selectedWebsite.id}/incidents`
          );
          if (data.events.length > websiteEvents.length) {
            setWebsiteEvents(data.events);
          }
          setWebsiteEvents(data.events);
          setIncidents(data.incidents);
        } catch { /* ignore */ }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [liveMode, selectedWebsite?.id]);

  // ── WebSocket ───────────────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host === 'localhost:5173' ? 'localhost:8000' : window.location.host;
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => console.log('[WebSocket] Connected');

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'new_attack' && data.data) {
          const evt = data.data as MonitorEvent;
          // Only add if it matches our selected website
          if (selectedWebsite && (evt.target === selectedWebsite.url || evt.target === selectedWebsite.hostname)) {
            setWebsiteEvents(prev => [evt, ...prev].slice(0, 100));
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setTimeout(() => { if (liveMode) connectWebSocket(); }, 3000);
    };

    ws.onerror = () => ws.close();
    return ws;
  }, [liveMode, selectedWebsite]);

  useEffect(() => {
    const ws = connectWebSocket();
    return () => { ws.close(); wsRef.current = null; };
  }, [connectWebSocket]);

  // ── Auto scroll events ──────────────────────────────────────────────────

  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [websiteEvents.length]);

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Target size={24} style={{ marginRight: 10, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
            Website Security Monitor
          </h1>
          <p className="page-subtitle">
            <span className="badge" style={{
              background: liveMode ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
              color: liveMode ? '#10b981' : '#94a3b8',
              marginRight: 8,
            }}>
              <div className="pulse-dot" style={{
                width: 6, height: 6, borderRadius: '50%',
                background: liveMode ? '#10b981' : '#94a3b8',
                marginRight: 4,
              }} />
              {liveMode ? 'Live' : 'Paused'}
            </span>
            Enter a website URL to scan for threats and monitor in real-time
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn btn-sm ${liveMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLiveMode(!liveMode)}
          >
            {liveMode ? <Eye size={14} /> : <EyeOff size={14} />}
            {liveMode ? 'Live' : 'Paused'}
          </button>
        </div>
      </div>

      {/* URL Input Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass"
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          marginBottom: 'var(--space-xl)',
          borderRadius: 'var(--border-radius-md)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Globe size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scanWebsite()}
              placeholder="Enter website URL to monitor (e.g., https://example.com)"
              className="input"
              style={{ paddingLeft: 36, fontSize: 'var(--font-size-base)' }}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary btn-lg"
            onClick={scanWebsite}
            disabled={scanning || !urlInput.trim()}
            style={{ whiteSpace: 'nowrap', padding: '10px 24px' }}
          >
            {scanning ? (
              <Loader size={16} className="loading-spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <Search size={16} />
            )}
            {scanning ? 'Scanning...' : 'Start Monitoring'}
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-lg)' }}>
        
        {/* Sidebar - Website List */}
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="card-header">
              <h3 className="card-title">
                <List size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
                Monitored Sites
              </h3>
              <span className="pill" style={{ fontSize: 10 }}>{websites.length} sites</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflow: 'auto' }}>
              <AnimatePresence>
                {websites.length > 0 ? websites.map(w => (
                  <WebsiteCard
                    key={w.id}
                    website={w}
                    selected={selectedWebsite?.id === w.id}
                    onClick={() => setSelectedWebsite(w)}
                    onDelete={() => deleteWebsite(w.id)}
                  />
                )) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                    <Globe size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <div>No websites monitored</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>Enter a URL above to begin</div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick Stats */}
          {selectedWebsite && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <Activity size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
                  Statistics
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  <span>Scans Performed</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{selectedWebsite.scan_count}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  <span>Total Incidents</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: incidents.length > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                    {selectedWebsite.incident_count}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  <span>Security Events</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{websiteEvents.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  <span>Status</span>
                  <span className="pill" style={{
                    background: `${getStatusColor(selectedWebsite.status)}20`,
                    color: getStatusColor(selectedWebsite.status),
                    fontSize: 10, padding: '0 8px',
                    textTransform: 'capitalize',
                  }}>
                    {selectedWebsite.status}
                  </span>
                </div>
                {selectedWebsite.last_scan_at && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4 }}>
                    Last scan: {formatDate(selectedWebsite.last_scan_at)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Panel */}
        <div>
          {selectedWebsite ? (
            <>
              {/* Threat Score */}
              <div className="card" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--space-lg)',
              }}>
                <ThreatScoreGauge score={selectedWebsite.threat_score} level={selectedWebsite.threat_level} />
              </div>

              {/* Scan Findings */}
              {selectedWebsite.findings && selectedWebsite.findings.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div className="card-header">
                    <h3 className="card-title">
                      <FileText size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
                      Scan Findings
                      <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                        {selectedWebsite.findings.length} findings
                      </span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {['critical', 'high', 'medium', 'low', 'info'].filter(s => 
                        selectedWebsite.findings.some(f => f.severity === s)
                      ).map(s => (
                        <span key={s} className="pill" style={{
                          background: SEVERITY_BG[s],
                          color: SEVERITY_COLORS[s],
                          fontSize: 10, padding: '0 8px',
                        }}>
                          {s}: {selectedWebsite.findings.filter(f => f.severity === s).length}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedWebsite.findings.map((finding, idx) => (
                      <FindingItem key={idx} finding={finding} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Incidents */}
              <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                  <h3 className="card-title">
                    <AlertTriangle size={16} style={{ marginRight: 8, color: incidents.length > 0 ? '#ef4444' : 'var(--accent-primary)' }} />
                    Incident Response
                    <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                      {incidents.length} incidents
                    </span>
                  </h3>
                  {incidents.filter(i => i.status !== 'resolved').length > 0 && (
                    <button className="btn btn-sm btn-danger" onClick={resolveIncidents} disabled={resolving}>
                      {resolving ? <Loader size={12} className="loading-spinner" /> : <CheckCheck size={12} />}
                      Resolve All
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflow: 'auto' }}>
                  <AnimatePresence>
                    {incidents.length > 0 ? incidents.map(inc => (
                      <IncidentCard key={inc.id} incident={inc} />
                    )) : (
                      <div style={{ padding: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: 48, opacity: 0.1, marginBottom: 8 }}>
                          <AlertTriangle size={48} />
                        </div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                          No incidents detected for this website
                        </div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: 4 }}>
                          Use the attack simulator to test your incident response
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Security Events Log */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Terminal size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
                    Security Events for {selectedWebsite.hostname}
                    <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                      {websiteEvents.length} events
                    </span>
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: liveMode ? '#22c55e' : 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 'var(--font-size-xs)', color: liveMode ? '#22c55e' : 'var(--text-tertiary)' }}>
                      {liveMode ? 'Live' : 'Paused'}
                    </span>
                  </div>
                </div>

                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 80px 70px 1fr 90px 70px 20px',
                  gap: 8,
                  padding: '8px 14px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                  borderBottom: 'var(--border-primary)',
                  marginBottom: 8,
                }}>
                  <div />
                  <div>Time</div>
                  <div>Type</div>
                  <div>Message</div>
                  <div>Source IP</div>
                  <div>Status</div>
                  <div />
                </div>

                <div style={{ maxHeight: 400, overflow: 'auto' }} ref={eventsEndRef}>
                  <AnimatePresence>
                    {websiteEvents.length > 0 ? websiteEvents.map(event => {
                      const Icon = TYPE_ICONS[event.event_type] || AlertTriangle;
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          onClick={() => setSelectedEvent(event)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '28px 80px 70px 1fr 90px 70px 20px',
                            gap: 8,
                            alignItems: 'center',
                            padding: '8px 14px',
                            background: 'var(--bg-card)',
                            border: `1px solid ${SEVERITY_BG[event.severity] || 'var(--border-primary)'}`,
                            borderLeft: `3px solid ${SEVERITY_COLORS[event.severity] || 'var(--text-tertiary)'}`,
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                            fontSize: 'var(--font-size-xs)',
                            marginBottom: 4,
                          }}
                          whileHover={{ x: 2, borderColor: SEVERITY_COLORS[event.severity] || 'var(--border-primary)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Icon size={14} color={SEVERITY_COLORS[event.severity] || 'var(--text-tertiary)'} />
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {formatTime(event.timestamp)}
                          </div>
                          <div style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: 11, color: 'var(--text-primary)' }}>
                            {event.event_type.replace(/_/g, ' ')}
                          </div>
                          <div style={{
                            color: 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {event.message}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {event.source_ip}
                          </div>
                          <div>
                            <span className="pill" style={{
                              background: `${getStatusColor(event.status)}18`,
                              color: getStatusColor(event.status),
                              fontSize: 10, padding: '0 8px', textTransform: 'capitalize',
                            }}>
                              {event.status}
                            </span>
                          </div>
                          <div>
                            {event.is_active && <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />}
                          </div>
                        </motion.div>
                      );
                    }) : (
                      <div className="empty-state" style={{ padding: '40px 24px' }}>
                        <Shield size={48} className="empty-state-icon" />
                        <div className="empty-state-title">No Security Events</div>
                        <div className="empty-state-desc">
                          This website is clean. Launch a simulated attack to see security events in real-time.
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          ) : (
            /* No website selected */
            <div className="card" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 20,
                  background: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Target size={40} style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                </div>
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Start Monitoring a Website
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
                  Enter a URL above to scan for security threats, check phishing indicators, 
                  and monitor the website in real-time for attacks. Get detailed findings, 
                  threat scores, and incident response capabilities.
                </p>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24,
                }}>
                  {[
                    { icon: Search, label: 'Deep URL Scan', desc: 'Checks TLD, SSL, headers & more' },
                    { icon: Gauge, label: 'Threat Score', desc: '0-100 risk assessment' },
                    { icon: AlertTriangle, label: 'Incident Response', desc: 'Real-time attack monitoring' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <item.icon size={24} style={{ color: 'var(--accent-primary)', marginBottom: 6, opacity: 0.6 }} />
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 'var(--space-lg)',
            }}
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="card"
              style={{ maxWidth: 500, width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} color={SEVERITY_COLORS[selectedEvent.severity]} />
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {selectedEvent.event_type.replace(/_/g, ' ')} Event
                  </span>
                </div>
                <button className="btn-icon btn-ghost" onClick={() => setSelectedEvent(null)}>
                  <XCircle size={18} />
                </button>
              </div>
              <div className="detail-grid" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="detail-item">
                  <div className="detail-item-label">Time</div>
                  <span className="detail-item-value mono" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {formatTime(selectedEvent.timestamp)}
                  </span>
                </div>
                <div className="detail-item">
                  <div className="detail-item-label">Severity</div>
                  <span className="detail-item-value" style={{ textTransform: 'capitalize', color: SEVERITY_COLORS[selectedEvent.severity] }}>
                    {selectedEvent.severity}
                  </span>
                </div>
                <div className="detail-item">
                  <div className="detail-item-label">Source IP</div>
                  <span className="detail-item-value mono">{selectedEvent.source_ip}</span>
                </div>
                <div className="detail-item">
                  <div className="detail-item-label">Status</div>
                  <span className="detail-item-value" style={{ color: getStatusColor(selectedEvent.status), textTransform: 'capitalize' }}>
                    {selectedEvent.status}
                  </span>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                {selectedEvent.message}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
