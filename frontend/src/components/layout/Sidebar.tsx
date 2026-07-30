import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LayoutDashboard, FileSearch, AlertTriangle, Monitor,
  ShieldAlert, Settings, ChevronLeft,
  ChevronRight, Upload, LogOut, Radio,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/monitor', icon: Radio, label: 'Live Monitor' },
  { to: '/logs', icon: FileSearch, label: 'Log Explorer' },
  { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { to: '/edr', icon: Monitor, label: 'EDR / XDR' },
  { to: '/waf', icon: ShieldAlert, label: 'WAF Monitor' },
  { to: '/threats', icon: Shield, label: 'Threat Intel' },
  { to: '/ingestion', icon: Upload, label: 'Data Ingestion' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const sidebarContent = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '16px 0' : '20px 20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: 'var(--border-primary)',
      }}>
        {!collapsed ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(6, 182, 212, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Sentinal
              </span>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)' }}>
                IQ
              </span>
            </div>
          </motion.div>
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(6, 182, 212, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
          </div>
        )}
        {!collapsed && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggle}
            className="btn-icon btn-ghost"
            style={{ width: 28, height: 28 }}
          >
            <ChevronLeft size={16} />
          </motion.button>
        )}
      </div>

      {/* Nav Items */}
      <nav style={{
        flex: 1,
        padding: collapsed ? '12px 8px' : '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
      }}>
        {navItems.map(item => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onMobileClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '14px 0' : '11px 14px',
                borderRadius: 'var(--border-radius-sm)',
                textDecoration: 'none',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                transition: 'all 150ms ease',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 600 : 400,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                if (!isActive) {
                  el.style.background = 'var(--bg-card-hover)';
                  el.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                if (!isActive) {
                  el.style.background = 'transparent';
                  el.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: collapsed ? 2 : 4,
                    bottom: collapsed ? 2 : 4,
                    width: 3,
                    background: 'var(--accent-primary)',
                    borderRadius: 2,
                    boxShadow: 'var(--glow-cyan)',
                  }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      {!collapsed ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '16px 16px',
            borderTop: 'var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 600, color: 'white', flexShrink: 0,
          }}>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--font-size-sm)', fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.username || 'User'}
            </div>
            <div style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)',
              textTransform: 'capitalize',
            }}>
              {user?.role || 'Analyst'}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={logout}
            className="btn-icon btn-ghost"
            title="Logout"
            style={{ width: 30, height: 30 }}
          >
            <LogOut size={15} />
          </motion.button>
        </motion.div>
      ) : (
        <div style={{
          padding: '12px 8px',
          borderTop: 'var(--border-primary)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggle}
            className="btn-icon btn-ghost"
            title="Expand sidebar"
            style={{ width: 32, height: 32 }}
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'black', zIndex: 90,
              display: 'none',
            }}
            className="mobile-overlay"
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 260 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        style={{
          background: 'var(--bg-sidebar)',
          borderRight: 'var(--border-primary)',
          height: '100vh',
          position: 'fixed',
          left: 0, top: 0,
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="sidebar-desktop"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'tween', duration: 0.2 }}
            style={{
              background: 'var(--bg-sidebar)',
              borderRight: 'var(--border-primary)',
              height: '100vh',
              position: 'fixed',
              left: 0, top: 0,
              width: 260,
              zIndex: 100,
              display: 'none',
            }}
            className="sidebar-mobile"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: flex !important; flex-direction: column; }
          .mobile-overlay { display: block !important; }
        }
        @media (min-width: 769px) {
          .sidebar-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
