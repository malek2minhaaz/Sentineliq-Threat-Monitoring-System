import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, AlertTriangle,
  User, Calendar, Clock, MessageSquare, CheckCircle, XCircle,
  ArrowRight, Users, UserCheck, ChevronDown,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignee: string;
  source: string;
  category: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface Analyst {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar: string;
}

const severityConfig: Record<string, { color: string; bg: string; gradient: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), transparent)' },
  high: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12), transparent)' },
  medium: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', gradient: 'linear-gradient(135deg, rgba(234,179,8,0.12), transparent)' },
  low: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.06)', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.1), transparent)' },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  open: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  investigating: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  resolved: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  closed: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
};

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { user } = useAuth();
  const { addToast } = useToast();
  const canAssign = user?.role === 'soc_lead' || user?.role === 'admin';

  // Analyst roster for assignment
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [showAnalysts, setShowAnalysts] = useState(false);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: Incident[]; total: number }>('/incidents', {
        page, limit,
        search: search || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      setIncidents(res.items);
      setTotal(res.total);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, severityFilter]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const fetchAnalysts = useCallback(async () => {
    try {
      const res = await api.get<{ items: Analyst[]; total: number }>('/analysts');
      setAnalysts(res.items);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => { if (canAssign) fetchAnalysts(); }, [canAssign, fetchAnalysts]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/incidents/${id}`, { status });
      fetchIncidents();
    } catch { /* ignore */ }
  };

  const assignIncident = async (username: string) => {
    if (!selected) return;
    setAssigningTo(username);
    try {
      const updated = await api.patch<Incident>(`/incidents/${selected.id}`, { assignee: username });
      setIncidents(prev => prev.map(i => (i.id === updated.id ? updated : i)));
      setSelected(updated);
      setShowAnalysts(false);
      addToast({
        type: 'success',
        title: 'Investigation Assigned',
        message: `"${updated.title}" was assigned to ${username}. A notification was sent to their dashboard.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Assignment Failed',
        message: 'Could not assign this incident. Please try again.',
      });
    } finally {
      setAssigningTo(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <AlertTriangle size={24} style={{ marginRight: 10, color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
            Incidents
          </h1>
          <p className="page-subtitle">
            <span className="badge badge-info" style={{ marginRight: 8 }}>Incident Response</span>
            {total} total incidents — manage your security incidents lifecycle
          </p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={fetchIncidents}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrapper" style={{ minWidth: 240 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search incidents..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select className="select" value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selected ? '1fr 360px' : '1fr',
        gap: 'var(--space-lg)',
        alignItems: 'start',
      }} className="incidents-layout">
        {/* List */}
        <div>
          {loading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : incidents.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <AlertTriangle size={48} className="empty-state-icon" />
                <div className="empty-state-title">No incidents found</div>
                <div className="empty-state-desc">Adjust your filters or wait for new security events to trigger incidents.</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incidents.map(incident => {
                const sev = severityConfig[incident.severity] || severityConfig.low;
                const stat = statusConfig[incident.status] || statusConfig.closed;
                const isSelected = selected?.id === incident.id;

                return (
                  <motion.div
                    key={incident.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    style={{
                      padding: '18px 20px',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${sev.color}`,
                      background: isSelected ? sev.bg : undefined,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onClick={() => setSelected(isSelected ? null : incident)}
                    whileHover={{ y: -2 }}
                  >
                    {/* Gradient background */}
                    <div style={{
                      position: 'absolute',
                      top: 0, right: 0,
                      width: 200, height: '100%',
                      background: sev.gradient,
                      pointerEvents: 'none',
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span className={`badge badge-${incident.severity}`}>{incident.severity}</span>
                            <span className="badge" style={{
                              background: stat.bg,
                              color: stat.color,
                            }}>
                              {incident.status}
                            </span>
                            {incident.category && (
                              <span className="pill pill-blue" style={{ fontSize: 10 }}>{incident.category}</span>
                            )}
                          </div>
                          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                            {incident.title}
                          </h3>
                          {incident.description && (
                            <p style={{
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--text-secondary)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.5,
                            }}>
                              {incident.description}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 4, whiteSpace: 'nowrap' }}>
                            <Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                            {new Date(incident.created_at).toLocaleDateString()}
                          </div>
                          {incident.assignee && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              <User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                              {incident.assignee}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        {incident.status === 'open' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn-xs btn-primary"
                            onClick={(e) => { e.stopPropagation(); updateStatus(incident.id, 'investigating'); }}
                          >
                            <ArrowRight size={12} /> Start Investigation
                          </motion.button>
                        )}
                        {incident.status === 'investigating' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn-xs btn-primary"
                            onClick={(e) => { e.stopPropagation(); updateStatus(incident.id, 'resolved'); }}
                          >
                            <CheckCircle size={12} /> Resolve
                          </motion.button>
                        )}
                        {incident.status !== 'closed' && incident.status !== 'resolved' && (
                          <button className="btn btn-xs btn-ghost" onClick={(e) => { e.stopPropagation(); updateStatus(incident.id, 'closed'); }}>
                            <XCircle size={12} /> Close
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="pagination">
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Page {page} of {totalPages} · {total} total incidents
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="card"
              style={{
                position: 'sticky',
                // Just below the sticky header — no empty gap above the card.
                top: 'calc(var(--header-height) + 4px)',
                // Keep the card within the viewport: if the content is taller
                // it scrolls INSIDE the card, so the actions at the bottom are
                // always reachable without losing sight of the incident list.
                maxHeight: 'calc(100vh - 84px)',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className={`badge badge-${selected.severity}`}>{selected.severity}</span>
                  <span className="badge" style={{
                    background: `${(statusConfig[selected.status] || statusConfig.closed).bg}`,
                    color: (statusConfig[selected.status] || statusConfig.closed).color,
                  }}>
                    {selected.status}
                  </span>
                </div>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, lineHeight: 1.4 }}>{selected.title}</h3>
              </div>

              <div className="detail-grid" style={{ marginBottom: 12 }}>
                <div className="detail-item">
                  <span className="detail-item-label">Assignee</span>
                  <span className="detail-item-value">
                    <User size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {selected.assignee || 'Unassigned'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Source</span>
                  <span className="detail-item-value">
                    <MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {selected.source}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Created</span>
                  <span className="detail-item-value">
                    <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {new Date(selected.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Updated</span>
                  <span className="detail-item-value">
                    <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {new Date(selected.updated_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Assignment — SOC leads & admins can assign an analyst to investigate */}
              {canAssign && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="detail-item-label" style={{ marginBottom: 0 }}>Assignment</span>
                    {selected.assignee && (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                        <UserCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {selected.assignee}
                      </span>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="btn btn-sm btn-secondary"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                    onClick={() => setShowAnalysts(v => !v)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={14} />
                      {selected.assignee ? 'Reassign Analyst' : 'Assign to Analyst'}
                    </span>
                    <ChevronDown size={14} style={{
                      transform: showAnalysts ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms ease',
                    }} />
                  </motion.button>

                  <AnimatePresence>
                    {showAnalysts && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          marginTop: 8,
                          border: 'var(--border-primary)',
                          borderRadius: 'var(--border-radius-sm)',
                          background: 'var(--bg-secondary)',
                          maxHeight: 240,
                          overflowY: 'auto',
                        }}>
                          {analysts.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                              <Users size={20} style={{ opacity: 0.3, marginBottom: 6 }} />
                              <div>No analysts available in the database</div>
                            </div>
                          ) : (
                            analysts.map(a => {
                              const isAssigned = selected.assignee === a.username;
                              const isAssigning = assigningTo === a.username;
                              return (
                                <motion.div
                                  key={a.id}
                                  whileHover={{ background: 'var(--bg-card-hover)' }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px',
                                    borderBottom: 'var(--border-primary)',
                                    cursor: isAssigned ? 'default' : 'pointer',
                                  }}
                                  onClick={() => { if (!isAssigned) assignIncident(a.username); }}
                                >
                                  <div style={{
                                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                    background: isAssigned ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.12)',
                                    color: isAssigned ? '#10b981' : 'var(--accent-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 13, fontWeight: 600,
                                  }}>
                                    {a.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {a.username}
                                    </div>
                                    <div style={{
                                      fontSize: 10, color: 'var(--text-tertiary)',
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                      {a.email}
                                    </div>
                                  </div>
                                  {isAssigned ? (
                                    <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10 }}>
                                      <UserCheck size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Assigned
                                    </span>
                                  ) : (
                                    <button
                                      className="btn btn-xs btn-primary"
                                      disabled={isAssigning}
                                      onClick={(e) => { e.stopPropagation(); assignIncident(a.username); }}
                                    >
                                      {isAssigning ? 'Assigning…' : 'Assign'}
                                    </button>
                                  )}
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div className="detail-item-label" style={{ marginBottom: 6 }}>Description</div>
                <div style={{
                  padding: 10,
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  maxHeight: 84,
                  overflowY: 'auto',
                }}>
                  {selected.description || 'No description provided.'}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selected.status === 'open' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary btn-sm"
                    onClick={() => updateStatus(selected.id, 'investigating')}
                  >
                    <ArrowRight size={14} /> Start Investigation
                  </motion.button>
                )}
                {selected.status === 'investigating' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary btn-sm"
                    onClick={() => updateStatus(selected.id, 'resolved')}
                  >
                    <CheckCircle size={14} /> Mark as Resolved
                  </motion.button>
                )}
                {selected.status !== 'closed' && selected.status !== 'resolved' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(selected.id, 'closed')}>
                    <XCircle size={14} /> Close Incident
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .incidents-layout { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .filter-bar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
