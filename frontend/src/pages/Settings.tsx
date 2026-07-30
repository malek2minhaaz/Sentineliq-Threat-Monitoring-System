import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, Moon, User, Shield,
  Palette, Monitor,
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
              background: '#0a0e1a',
              boxShadow: theme === 'dark' ? 'var(--glow-cyan)' : 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Moon size={24} style={{ color: '#06b6d4', marginBottom: 12 }} />
            <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>Cyberpunk SOC</div>
            <div style={{ color: '#64748b', fontSize: 'var(--font-size-xs)' }}>Dark theme with neon accents</div>
            {theme === 'dark' && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: '#06b6d4', fontWeight: 600 }}>✓ Active</div>
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
            <Sun size={24} style={{ color: '#0891b2', marginBottom: 12 }} />
            <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: 4 }}>Clean Light</div>
            <div style={{ color: '#64748b', fontSize: 'var(--font-size-xs)' }}>Minimal light theme</div>
            {theme === 'light' && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: '#0891b2', fontWeight: 600 }}>✓ Active</div>
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
