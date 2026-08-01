import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import CommandPalette from './components/layout/CommandPalette';
import Copilot from './components/copilot/Copilot';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy-loaded pages
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Logs = lazy(() => import('./pages/Logs'));
const Incidents = lazy(() => import('./pages/Incidents'));
const EDR = lazy(() => import('./pages/EDR'));
const WAF = lazy(() => import('./pages/WAF'));
const Threats = lazy(() => import('./pages/Threats'));
const Ingestion = lazy(() => import('./pages/Ingestion'));
const Settings = lazy(() => import('./pages/Settings'));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor'));

function LoadingPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
    }}>
      <div className="loading-spinner" />
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Public route (redirect if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <>{children}</>;
}

// Page title lookup for dynamic document titles
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/monitor': 'Live Monitor',
  '/logs': 'Log Explorer',
  '/incidents': 'Incidents',
  '/edr': 'EDR / XDR',
  '/waf': 'WAF Monitor',
  '/threats': 'Threat Intel',
  '/ingestion': 'Data Ingestion',
  '/settings': 'Settings',
};

function pageTitleFor(pathname: string): string {
  const match = Object.entries(PAGE_TITLES).find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : 'Security Operations';
}

// App Layout (sidebar + header + content)
function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Dynamic document title per page
  useEffect(() => {
    document.title = `${pageTitleFor(location.pathname)} · SentinalIQ`;
  }, [location.pathname]);

  // Track scroll position to show/hide the scroll-to-top button
  // (only calls setState when the value changes, so no re-render churn)
  const handleMainScroll = () => {
    const el = mainRef.current;
    if (!el) return;
    const shouldShow = el.scrollTop > 400;
    if (shouldShow !== showScrollTop) setShowScrollTop(shouldShow);
  };

  const scrollMainToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to top whenever the route changes (after exit animation completes)
  const handleExitComplete = () => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setShowScrollTop(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div style={{
        flex: 1,
        marginLeft: sidebarCollapsed ? 64 : 260,
        transition: 'margin-left 0.2s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minWidth: 0,
        overflow: 'hidden',
      }} className="main-content">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          onCommandPalette={() => setCommandPaletteOpen(true)}
        />
        {/* Single internal scroll container — the body never scrolls */}
        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
        >
          <ErrorBoundary>
            {/* mode="wait" renders one page at a time — prevents the old page
                from stacking below the new page (the "page appears twice" bug) */}
            <AnimatePresence mode="wait" onExitComplete={handleExitComplete} initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>

      {/* Scroll-to-top button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollMainToTop}
            aria-label="Scroll to top"
            style={{
              position: 'fixed',
              right: 24,
              bottom: 84, // offset above the Copilot FAB
              zIndex: 150,
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: 'var(--border-accent)',
              background: 'var(--bg-card)',
              color: 'var(--accent-primary)',
              boxShadow: 'var(--glow-border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.92 }}
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <Copilot />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <GlobalStateProvider>
              <BrowserRouter>
                <Suspense fallback={<LoadingPage />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

                    {/* Admin routes (separate session, own layout) */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminPanel />} />

                    {/* Protected routes with layout */}
                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/logs" element={<Logs />} />
                      <Route path="/incidents" element={<Incidents />} />
                      <Route path="/edr" element={<EDR />} />
                      <Route path="/waf" element={<WAF />} />
                      <Route path="/threats" element={<Threats />} />
                      <Route path="/ingestion" element={<Ingestion />} />
                      <Route path="/monitor" element={<LiveMonitor />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </GlobalStateProvider>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
