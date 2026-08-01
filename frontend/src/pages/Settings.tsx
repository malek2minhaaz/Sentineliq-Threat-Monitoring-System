import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, Moon, User, Shield,
  Palette, Monitor, Mail, Download, Loader,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [username, setUsername] = useState(user?.username || '');
  const [sendingReport, setSendingReport] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleSendReport = async () => {
    setSendingReport(true);
    try {
      const res = await api.post<{ sent: boolean; message: string; email: string; smtp_configured: boolean }>('/reports/send');
      if (res.sent) {
        addToast({ type: 'success', title: 'Report sent', message: `PDF report emailed to ${res.email}` });
      } else {
        addToast({
          type: 'error',
          title: 'Email not sent',
          message: res.smtp_configured
            ? res.message
            : 'Email sending is not configured. Fill in GMAIL_USER + GMAIL_APP_PASSWORD in backend/.env and restart the server, or use Download instead.',
        });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to generate report.' });
    } finally {
      setSendingReport(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const token = api.getToken();
      const res = await fetch('/api/reports/download', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinaliq-report-${user?.username || 'user'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Report downloaded', message: 'Your PDF report has been downloaded.' });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to download report.' });
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await api.put('/settings/profile', { username, theme });
      updateUser({ username, theme });
      addToast({ type: 'success', title: 'Settings saved', message: 'Your profile has been updated.' });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save settings.' });
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account, security preferences, and application theme</p>
        </div>
      </div>

      {/* Theme */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Palette size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
            Theme
          </h3>
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          Choose between dark cyberpunk SOC mode and clean light mode
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Dark Theme Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setTheme('dark')}
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 'var(--border-radius-md)',
              border: theme === 'dark' ? '2px solid var(--accent-primary)' : 'var(--border-primary)',
              cursor: 'pointer',
              background: '#04060c',
              boxShadow: theme === 'dark' ? 'var(--glow-cyan)' : 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Moon size={24} style={{ color: '#38bdf8', marginBottom: 12 }} />
            <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>Cyberpunk SOC</div>
            <div style={{ color: '#64748b', fontSize: 'var(--font-size-xs)' }}>Dark theme with neon accents</div>
            {theme === 'dark' && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: '#38bdf8', fontWeight: 600 }}>✓ Active</div>
            )}
          </motion.div>

          {/* Light Theme Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setTheme('light')}
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 'var(--border-radius-md)',
              border: theme === 'light' ? '2px solid var(--accent-primary)' : 'var(--border-primary)',
              cursor: 'pointer',
              background: '#ffffff',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Sun size={24} style={{ color: '#2563eb', marginBottom: 12 }} />
            <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: 4 }}>Clean Light</div>
            <div style={{ color: '#64748b', fontSize: 'var(--font-size-xs)' }}>Minimal light theme</div>
            {theme === 'light' && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: '#2563eb', fontWeight: 600 }}>✓ Active</div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header">
          <h3 className="card-title">
            <User size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
            Profile
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Username</label>
            <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} style={{ maxWidth: 300 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" className="input" value={user?.email || ''} disabled style={{ maxWidth: 300, opacity: 0.6 }} />
          </div>

          {/* Activity Report */}
          <div style={{
            padding: '16px 18px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
            border: 'var(--border-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Mail size={18} style={{ color: 'var(--accent-primary)' }} />
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Email Reports</div>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
              Generate a PDF summary of your activity — monitored websites, URL scans, file uploads,
              monitoring events, and incidents — and have it emailed to{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>{user?.email || 'your registered email'}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSendReport}
                disabled={sendingReport}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {sendingReport ? <Loader size={14} className="loading-spinner" /> : <Mail size={14} />}
                {sendingReport ? 'Sending...' : 'Send Report to Email'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadReport}
                disabled={downloadingReport}
                className="btn btn-sm btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {downloadingReport ? <Loader size={14} className="loading-spinner" /> : <Download size={14} />}
                {downloadingReport ? 'Downloading...' : 'Download PDF'}
              </motion.button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>Role</label>
            <input type="text" className="input" value={user?.role || ''} disabled style={{ maxWidth: 200, opacity: 0.6, textTransform: 'capitalize' }} />
          </div>
          <div>
            <button className="btn btn-primary" onClick={handleSaveProfile}>Save Changes</button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Shield size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
            Security
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--border-radius-sm)',
          }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Two-Factor Authentication</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Add an extra layer of security to your account</div>
            </div>
            <button className="btn btn-sm btn-ghost">Enable</button>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--border-radius-sm)',
          }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Sessions</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Manage active sessions</div>
            </div>
            <button className="btn btn-sm btn-ghost">View</button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Monitor size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
            About
          </h3>
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p><strong>SentinalIQ</strong> v1.0.0</p>
          <p>Enterprise Security Information and Event Management (SIEM) Platform</p>
          <p style={{ marginTop: 8 }}>Built with React 19, TypeScript, FastAPI, and SQLite</p>
        </div>
      </div>
    </div>
  );
}
