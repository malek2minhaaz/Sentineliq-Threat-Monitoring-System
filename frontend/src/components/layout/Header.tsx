import { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Search, Menu, Sun, Moon,
  CheckCheck, Trash2, AlertTriangle, Info, AlertCircle, LogOut,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

// Isolated live clock — only this tiny component re-renders each second,
// not the whole header (which includes the notifications dropdown).
const LiveClock = memo(function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="live-clock" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 12px',
      borderRadius: 'var(--border-radius-sm)',
      background: 'var(--bg-tertiary)',
      border: 'var(--border-primary)',
      marginRight: 4,
    }}>
      <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-success)' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
        {now.toLocaleTimeString('en-GB')}
      </span>
    </div>
  );
});

interface HeaderProps {
  onMenuClick: () => void;
  onCommandPalette: () => void;
}

export default function Header({ onMenuClick, onCommandPalette }: HeaderProps) {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle size={14} color="#ef4444" />;
      case 'high': return <AlertTriangle size={14} color="#f97316" />;
      case 'medium': return <AlertTriangle size={14} color="#eab308" />;
      default: return <Info size={14} color="#3b82f6" />;
    }
  };

  return (
    <header style={{
      height: 'var(--header-height)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(var(--glass-blur))',
      borderBottom: 'var(--border-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onMenuClick}
          className="btn-icon btn-ghost mobile-menu-btn"
          style={{ display: 'none' }}
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}>
            SOC
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--accent-primary)',
            fontWeight: 600,
          }}>
            {user?.username || 'Analyst'}
          </span>
        </div>

        {/* Quick search trigger */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCommandPalette}
          className="btn btn-sm btn-ghost"
          style={{
            gap: 8,
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            border: 'var(--border-primary)',
            padding: '6px 14px',
            borderRadius: 'var(--border-radius-sm)',
          }}
        >
          <Search size={14} />
          <span style={{ fontSize: 'var(--font-size-xs)' }}>Quick search...</span>
          <kbd style={{
            padding: '2px 6px',
            background: 'var(--bg-tertiary)',
            borderRadius: 4,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            border: 'var(--border-primary)',
            marginLeft: 4,
          }}>
            Ctrl+K
          </kbd>
        </motion.button>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Live clock (isolated memo component) */}
        <LiveClock />

        {/* Theme toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="btn-icon btn-ghost"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn-icon btn-ghost"
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    background: 'var(--accent-danger)',
                    borderRadius: '50%',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 380,
                  maxHeight: 480,
                  background: 'var(--bg-card)',
                  border: 'var(--border-primary)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
                  zIndex: 200,
                }}
              >
                <div style={{
                  padding: '14px 16px',
                  borderBottom: 'var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary)',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    Notifications
                    {unreadCount > 0 && (
                      <span style={{ color: 'var(--accent-danger)', marginLeft: 6, fontSize: 'var(--font-size-xs)' }}>
                        ({unreadCount} new)
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={markAllRead}
                      className="btn-icon btn-ghost"
                      title="Mark all read"
                    >
                      <CheckCheck size={14} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={clearAll}
                      className="btn-icon btn-ghost"
                      title="Clear all"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                      <Bell size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                      <div>No notifications yet</div>
                    </div>
                  ) : (
                    notifications.slice(0, 30).map(notif => (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => { if (!notif.is_read) markRead(notif.id); }}
                        style={{
                          padding: '12px 16px',
                          borderBottom: 'var(--border-primary)',
                          cursor: 'pointer',
                          background: notif.is_read ? 'transparent' : 'rgba(56, 189, 248, 0.04)',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          transition: 'background 150ms ease',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = notif.is_read ? 'transparent' : 'rgba(56, 189, 248, 0.04)';
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: notif.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(56,189,248,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {severityIcon(notif.severity)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: notif.is_read ? 400 : 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {notif.title}
                          </div>
                          <div style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-tertiary)',
                            marginTop: 2,
                          }}>
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        </div>
                        {!notif.is_read && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'var(--accent-primary)',
                              flexShrink: 0,
                              marginTop: 6,
                              boxShadow: '0 0 4px rgba(56, 189, 248, 0.5)',
                            }}
                          />
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: 'white',
            cursor: 'pointer',
          }}
          title={user?.username || 'User'}
        >
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </motion.div>

        {/* Logout */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={logout}
          className="btn btn-sm btn-ghost"
          title="Logout"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            border: 'var(--border-primary)',
            padding: '6px 12px',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)',
            marginLeft: 4,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-danger)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          <LogOut size={14} />
          <span className="logout-label">Logout</span>
        </motion.button>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .logout-label { display: none !important; }
        }
        @media (max-width: 1100px) {
          .live-clock { display: none !important; }
        }
      `}</style>
    </header>
  );
}
