import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, RefreshCw, Upload, Globe,
  Hash, Link, AtSign, FileText, Shield,
  Clock, Activity,
} from 'lucide-react';
import { api } from '../utils/api';

interface RelatedLog {
  id: string;
  timestamp: string;
  source_ip: string;
  source: string;
  severity: string;
  event_type: string;
  message: string;
  endpoint: string;
}

interface Threat {
  id: string;
  ioc_type: string;
  ioc_value: string;
  threat_actor: string;
  malware_family: string;
  confidence: string;
  severity: string;
  description: string;
  first_seen: string;
  last_seen: string;
  tags: string[];
  source: string;
  is_active: boolean;
  log_events?: RelatedLog[];
  log_event_count?: number;
  log_severity_breakdown?: Record<string, number>;
}

const iocIcons: Record<string, React.ElementType> = {
  ip: Globe, domain: Globe, hash: Hash, url: Link, email: AtSign,
};

const iocColors: Record<string, string> = {
  ip: '#06b6d4',
  domain: '#8b5cf6',
  hash: '#f59e0b',
  url: '#10b981',
  email: '#3b82f6',
};

const iocBgColors: Record<string, string> = {
  ip: 'rgba(6, 182, 212, 0.1)',
  domain: 'rgba(139, 92, 246, 0.1)',
  hash: 'rgba(245, 158, 11, 0.1)',
  url: 'rgba(16, 185, 129, 0.1)',
  email: 'rgba(59, 130, 246, 0.1)',
};

const confidenceColors: Record<string, string> = {
  certain: '#ef4444', high: '#f97316', medium: '#eab308', low: '#64748b',
};

const severityColors: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6',
};

export default function Threats() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [iocType, setIocType] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  const fetchThreats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: Threat[]; total: number }>('/threats', {
        page, limit,
        search: search || undefined,
        ioc_type: iocType || undefined,
        severity: severity || undefined,
      });
      setThreats(res.items);
      setTotal(res.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, search, iocType, severity]);

  useEffect(() => { fetchThreats(); }, [fetchThreats]);

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.upload('/threats/import', formData);
        fetchThreats();
      } catch { /* ignore */ }
    };
    input.click();
  };

  // Compute stats from current page data
  const typeCounts = ['ip', 'domain', 'hash', 'url', 'email'].map(type => ({
    type,
    count: threats.filter(t => t.ioc_type === type).length,
    Icon: iocIcons[type] || FileText,
    color: iocColors[type] || '#64748b',
    bg: iocBgColors[type] || 'rgba(100, 116, 139, 0.1)',
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Shield size={24} style={{ marginRight: 10, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
            Threat Intelligence
          </h1>
          <p className="page-subtitle">
            <span className="badge badge-info" style={{ marginRight: 8 }}>IOC Database</span>
            {total.toLocaleString()} indicators · Track, analyze, and respond to threats
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={handleImport}>
            <Upload size={14} /> Import
          </button>
          <button className="btn btn-sm btn-secondary" onClick={fetchThreats}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 'var(--space-lg)' }}
      >
        {typeCounts.map(({ type, count, Icon, color, bg }, idx) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="card"
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: 'pointer',
              border: iocType === type ? `1px solid ${color}` : 'var(--border-primary)',
            }}
            onClick={() => { setIocType(iocType === type ? '' : type); setPage(1); }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {type}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
                {count}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrapper" style={{ minWidth: 260 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search IOC value, actor, or malware..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="select" value={iocType} onChange={e => { setIocType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="ip">IP Address</option>
          <option value="domain">Domain</option>
          <option value="hash">File Hash</option>
          <option value="url">URL</option>
          <option value="email">Email</option>
        </select>
        <select className="select" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      ) : threats.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Upload size={48} className="empty-state-icon" />
            <div className="empty-state-title">No threat indicators found</div>
            <div className="empty-state-desc">
              Import IOC data via the Import button or adjust your search filters to discover threats.
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {threats.map((threat, idx) => {
            const Icon = iocIcons[threat.ioc_type] || FileText;
            const iconColor = iocColors[threat.ioc_type] || '#64748b';
            const iconBg = iocBgColors[threat.ioc_type] || 'rgba(100, 116, 139, 0.1)';
            const sevColor = severityColors[threat.severity] || '#64748b';
            const isExpanded = expandedId === threat.id;

            return (
              <motion.div
                key={threat.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="ioc-card"
                style={{
                  borderLeftColor: sevColor,
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(isExpanded ? null : threat.id)}
              >
                {/* Top Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Type Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} style={{ color: iconColor }} />
                  </div>

                  {/* IOC Value */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {threat.ioc_value}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {threat.threat_actor && (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          🎭 {threat.threat_actor}
                        </span>
                      )}
                      {threat.malware_family && (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          🦠 {threat.malware_family}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span className={`badge badge-${threat.severity}`}>
                      {threat.severity}
                    </span>
                    <span className="badge" style={{
                      background: `${confidenceColors[threat.confidence] || '#64748b'}18`,
                      color: confidenceColors[threat.confidence] || '#64748b',
                    }}>
                      {threat.confidence}
                    </span>
                    {(threat.log_event_count ?? 0) > 0 && (
                      <span className="pill" style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        background: 'rgba(6, 182, 212, 0.12)',
                        color: '#06b6d4',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                      }}>
                        <Activity size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {threat.log_event_count} log{threat.log_event_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {threat.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="pill pill-cyan" style={{ fontSize: 10, padding: '2px 8px' }}>
                        {tag}
                      </span>
                    ))}
                    {threat.tags.length > 3 && (
                      <span className="pill" style={{ fontSize: 10, padding: '2px 8px' }}>
                        +{threat.tags.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Clock size={10} />
                    {new Date(threat.last_seen).toLocaleDateString()}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: 'var(--border-primary)',
                    }}
                  >
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-item-label">IOC Type</span>
                        <span className="detail-item-value" style={{ textTransform: 'uppercase' }}>{threat.ioc_type}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-item-label">Source</span>
                        <span className="detail-item-value">{threat.source || 'Unknown'}</span>
                      </div>
                      {threat.threat_actor && (
                        <div className="detail-item">
                          <span className="detail-item-label">Threat Actor</span>
                          <span className="detail-item-value">{threat.threat_actor}</span>
                        </div>
                      )}
                      {threat.malware_family && (
                        <div className="detail-item">
                          <span className="detail-item-label">Malware Family</span>
                          <span className="detail-item-value">{threat.malware_family}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <span className="detail-item-label">First Seen</span>
                        <span className="detail-item-value">{new Date(threat.first_seen).toLocaleString()}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-item-label">Last Seen</span>
                        <span className="detail-item-value">{new Date(threat.last_seen).toLocaleString()}</span>
                      </div>
                    </div>
                    {threat.description && (
                      <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div className="detail-item-label" style={{ marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {threat.description}
                        </div>
                      </div>
                    )}
                    {threat.tags.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {threat.tags.map(tag => (
                          <span key={tag} className="pill pill-cyan">{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Related Log Activity */}
                    {((threat.log_event_count ?? 0) > 0) && (
                      <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Activity size={14} style={{ color: '#06b6d4' }} />
                          <span className="detail-item-label" style={{ margin: 0 }}>
                            Related Log Activity
                          </span>
                          <span className="pill pill-cyan" style={{ fontSize: 10, padding: '2px 8px' }}>
                            {threat.log_event_count} match{threat.log_event_count !== 1 ? 'es' : ''}
                          </span>
                        </div>

                        {/* Severity breakdown */}
                        {threat.log_severity_breakdown && Object.keys(threat.log_severity_breakdown).length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {Object.entries(threat.log_severity_breakdown).map(([sev, count]) => (
                              <span key={sev} className="badge" style={{
                                background: `${severityColors[sev] || '#64748b'}1a`,
                                color: severityColors[sev] || '#64748b',
                                textTransform: 'capitalize',
                              }}>
                                {sev} · {count}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Recent matching log events */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(threat.log_events || []).slice(0, 5).map(log => (
                            <div key={log.id} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              padding: '8px 10px',
                              background: 'var(--bg-primary)',
                              borderRadius: 'var(--border-radius-sm)',
                              borderLeft: `3px solid ${severityColors[log.severity] || '#64748b'}`,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  {log.message}
                                </div>
                                <div style={{
                                  marginTop: 4,
                                  display: 'flex',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                  fontSize: 10,
                                  color: 'var(--text-tertiary)',
                                }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Clock size={10} /> {new Date(log.timestamp).toLocaleString()}
                                  </span>
                                  {log.source_ip && (
                                    <span>{log.source_ip}</span>
                                  )}
                                  {log.source && (
                                    <span style={{ textTransform: 'capitalize' }}>{log.source}</span>
                                  )}
                                  {log.event_type && (
                                    <span style={{ textTransform: 'uppercase' }}>{log.event_type}</span>
                                  )}
                                </div>
                              </div>
                              <span className={`badge badge-${log.severity}`} style={{ flexShrink: 0, textTransform: 'capitalize' }}>
                                {log.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="pagination">
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Page {page} of {Math.ceil(total / limit)} · {total.toLocaleString()} total IOC{total !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .filter-bar { flex-direction: column; }
          .ioc-card .detail-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
