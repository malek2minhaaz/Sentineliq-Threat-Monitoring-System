import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, Shield,
  CheckCircle, Globe, Loader, FileText, File,
  Clock, RefreshCw,
} from 'lucide-react';
import { api } from '../utils/api';

interface IngestionRecord {
  id: string;
  user_id: string;
  type: string;
  source: string;
  file_type: string;
  records_count: number;
  status: string;
  summary: string;
  created_at: string;
}

interface ParseResult {
  imported: number;
  message: string;
  filename: string;
  file_type: string;
}

type UploadMode = 'threats' | 'logs';

export default function Ingestion() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ParseResult | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('threats');
  const [history, setHistory] = useState<IngestionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get<{ items: IngestionRecord[]; total: number }>('/ingestion/history');
      setHistory(res.items);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt,.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api.upload<ParseResult>('/ingestion/parse-file', formData);
        setImportResult(res);
        setActiveTab('history');
        fetchHistory();
      } catch { /* ignore */ }
      finally { setImporting(false); }
    };
    input.click();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  const tabStyle = (tab: string) => ({
    padding: '8px 16px',
    borderRadius: 'var(--border-radius-sm)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: activeTab === tab ? 600 : 400,
    background: activeTab === tab ? 'var(--accent-primary)' : 'var(--bg-secondary)',
    color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
    transition: 'all 150ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Ingestion</h1>
          <p className="page-subtitle">Upload logs, threats, and incidents for security analysis.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={tabStyle('upload')}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={14} /> File Upload
          </button>
          <button
            style={tabStyle('history')}
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
          >
            <Clock size={14} /> History
          </button>
        </div>
      </div>

      {/* ── File Upload Tab ── */}
      {activeTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }} className="ingestion-grid">
          {/* Upload Zone */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Upload size={24} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>File Upload</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Upload files to extract threat intel, log events, and IOCs
                </p>
              </div>
            </div>

            {/* Upload Mode Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setUploadMode('threats')}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 'var(--border-radius-sm)',
                  border: uploadMode === 'threats' ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                  cursor: 'pointer', background: uploadMode === 'threats' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-secondary)',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: uploadMode === 'threats' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'all 150ms ease', textAlign: 'center' as const,
                }}
              >
                <Shield size={16} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
                Threat Intel
              </button>
              <button
                onClick={() => setUploadMode('logs')}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 'var(--border-radius-sm)',
                  border: uploadMode === 'logs' ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                  cursor: 'pointer', background: uploadMode === 'logs' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-secondary)',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: uploadMode === 'logs' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'all 150ms ease', textAlign: 'center' as const,
                }}
              >
                <FileText size={16} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
                Log Files
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onClick={handleFileImport}
              style={{
                border: '2px dashed var(--border-primary)',
                borderRadius: 'var(--border-radius-md)', padding: 48,
                textAlign: 'center', cursor: 'pointer',
                transition: 'all var(--transition-fast)', background: 'var(--bg-secondary)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
              }}
            >
              {uploadMode === 'threats' ? (
                <Shield size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
              ) : (
                <FileText size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
              )}
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Click to Upload</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                {uploadMode === 'threats'
                  ? 'Supported: JSON, CSV — extracts threat indicators & IOCs'
                  : 'Supported: TXT, PDF, JSON, CSV — extracts log events & IOCs'}
              </p>
            </div>

            {importing && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontSize: 'var(--font-size-sm)' }}
              >
                <Loader size={16} className="loading-spinner" /> Parsing file...
              </motion.div>
            )}

            {importResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 16, padding: 12,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--border-radius-sm)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 'var(--font-size-sm)', color: '#10b981',
                }}
              >
                <CheckCircle size={18} />
                <div>
                  <div>{importResult.message}</div>
                  <div style={{ fontSize: 10, color: 'rgba(16, 185, 129, 0.7)', marginTop: 2 }}>
                    {importResult.filename} ({importResult.file_type})
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Format Guide */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <File size={24} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>Format Guide</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Supported formats and expected structures
                </p>
              </div>
            </div>

            {/* Format tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                padding: 12, borderRadius: 'var(--border-radius-sm)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <FileText size={16} style={{ color: 'var(--accent-warning)' }} />
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>.txt — Log Files</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Plain text logs. Each line is parsed as a log event.
                  IPs, domains, and URLs are automatically extracted as IOCs.
                  Lines containing "error", "failed", "blocked" get high severity.
                </p>
              </div>

              <div style={{
                padding: 12, borderRadius: 'var(--border-radius-sm)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <File size={16} style={{ color: 'var(--accent-danger)' }} />
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>.pdf — Documents</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  PDF documents with security reports, threat briefs. Text is extracted page by page.
                  IP addresses and domains found in the document are added as IOCs.
                  Threat-related keywords create higher severity log events.
                </p>
              </div>

              <div style={{
                padding: 12, borderRadius: 'var(--border-radius-sm)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Upload size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>.json / .csv — Threat Intel</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Structured threat intelligence. JSON array of IOC objects with fields:
                  type/value/threat_actor/malware_family/severity/confidence/tags.
                  CSV should have matching column headers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Clock size={24} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>My Ingestion History</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Your recent file uploads
                </p>
              </div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={fetchHistory} disabled={historyLoading}>
              <RefreshCw size={14} style={historyLoading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>

          {historyLoading && history.length === 0 && (
            <div className="loading-container"><div className="loading-spinner" /></div>
          )}

          {!historyLoading && history.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
              <Upload size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No ingestion history yet. Upload a file to get started.</p>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Records</th>
                    <th>Status</th>
                    <th>Summary</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <span className="badge" style={{
                          background: record.type === 'url_scan'
                            ? 'rgba(56, 189, 248, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                          color: record.type === 'url_scan' ? '#38bdf8' : '#60a5fa',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          {record.type === 'url_scan' ? <Globe size={12} /> : <Upload size={12} />}
                          {record.type === 'url_scan' ? 'URL Scan' : 'File Upload'}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {record.source.slice(0, 40)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{record.records_count}</td>
                      <td>
                        <span className={`badge ${record.status === 'failed' ? 'badge-critical' : 'badge-low'}`}>
                          {record.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {record.summary}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {formatDate(record.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .ingestion-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
