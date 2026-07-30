import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Download, RefreshCw, ChevronDown, ChevronUp,
  Clock, AlertCircle, AlertTriangle, Info, Terminal,
} from 'lucide-react';
import { api } from '../utils/api';

interface LogEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  event_type: string;
  message: string;
  source: string;
  severity: string;
  endpoint: string;
}

const severityConfig: Record<string, { color: string; bg: string; Icon: React.ElementType }> = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)', Icon: AlertCircle },
  high: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.06)', Icon: AlertTriangle },
  medium: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.06)', Icon: AlertTriangle },
  low: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.04)', Icon: Info },
  info: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.04)', Icon: Info },
};

export default function Logs() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: LogEvent[]; total: number }>('/logs', {
        page, limit, search: search || undefined,
        event_type: eventType || undefined,
        severity: severity || undefined,
        source: source || undefined,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch {
      // Fallback to empty
    } finally {
      setLoading(false);
    }
  }, [page, search, eventType, severity, source]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Terminal size={24} style={{ marginRight: 10, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
            Log Explorer
          </h1>
          <p className="page-subtitle">
            <span className="badge badge-info" style={{ marginRight: 8 }}>Event Viewer</span>
            Search and analyze {total.toLocaleString()} security events across your infrastructure
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={fetchLogs}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-sm btn-secondary">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Severity Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 'var(--space-lg)',
        }}
      >
        {['critical', 'high', 'medium', 'low', 'info'].map(sev => {
          const count = logs.filter(l => l.severity === sev).length;
          const cfg = severityConfig[sev] || severityConfig.info;
          return (
            <div
              key={sev}
              className="card"
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                border: severity === sev ? `1px solid ${cfg.color}` : 'var(--border-primary)',
              }}
              onClick={() => { setSeverity(severity === sev ? '' : sev); setPage(1); }}
            >
              <cfg.Icon size={18} style={{ color: cfg.color }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {sev}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-lg)', color: cfg.color }}>
                  {count}
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrapper" style={{ minWidth: 260 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search logs by message, IP, or endpoint..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="select" value={eventType} onChange={e => { setEventType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select className="select" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select className="select" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
          <option value="">All Sources</option>
          <option value="web-server">Web Server</option>
          <option value="database">Database</option>
          <option value="firewall">Firewall</option>
          <option value="endpoint">Endpoint</option>
          <option value="ids">IDS</option>
        </select>
      </div>

      {/* Log List */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Terminal size={48} className="empty-state-icon" />
            <div className="empty-state-title">No log events found</div>
            <div className="empty-state-desc">
              Try adjusting your search filters or refresh to pull in new events.
            </div>
          </div>
        </div>
      ) : (
        <div ref={tableRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Column Headers */}
          <div className="log-row" style={{
            background: 'var(--bg-secondary)',
            cursor: 'default',
            fontWeight: 600,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            transform: 'none',
          }}>
            <span>Timestamp</span>
            <span>Severity</span>
            <span>Type</span>
            <span>Source</span>
            <span>Message</span>
            <span>Source IP</span>
            <span></span>
          </div>

          <AnimatePresence>
            {logs.map((log, idx) => {
              const cfg = severityConfig[log.severity] || severityConfig.info;
              const isExpanded = expandedId === log.id;

              return (
                <motion.div
                  key={log.id || idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  transition={{ delay: idx * 0.01 }}
                  className="log-row"
                  style={{
                    borderLeft: `3px solid ${cfg.color}`,
                    background: isExpanded ? cfg.bg : undefined,
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span>
                    <span className={`badge badge-${log.severity}`}>
                      {log.severity}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{log.event_type}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{log.source}</span>
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>
                    {log.message}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: 10 }}>
                    {log.source_ip}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>

                  {/* Expandable Detail */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        gridColumn: '1 / -1',
                        padding: '12px 16px',
                        marginTop: 8,
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--border-radius-sm)',
                        border: 'var(--border-primary)',
                      }}
                    >
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-item-label">Event ID</span>
                          <span className="detail-item-value mono">{log.id}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-item-label">Endpoint</span>
                          <span className="detail-item-value">{log.endpoint || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-item-label">Event Type</span>
                          <span className="detail-item-value">{log.event_type}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-item-label">Source</span>
                          <span className="detail-item-value">{log.source}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="detail-item-label">Full Message</span>
                        <div style={{
                          marginTop: 4,
                          padding: 10,
                          background: 'var(--bg-card)',
                          borderRadius: 'var(--border-radius-sm)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {log.message}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="pagination">
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()} events
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 12px',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn btn-sm btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .log-row { grid-template-columns: 140px 80px 80px 80px 1fr 0 30px; }
          .log-row > span:nth-child(6) { display: none; }
          .log-row > span:nth-child(3),
          .log-row > span:nth-child(4) { font-size: 9px; }
        }
        @media (max-width: 768px) {
          .filter-bar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
