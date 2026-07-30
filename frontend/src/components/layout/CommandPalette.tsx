import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, LayoutDashboard, FileSearch, AlertTriangle, Monitor, ShieldAlert, Shield, Upload, Settings, type LucideIcon } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  action: () => void;
  keywords: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const commands: Omit<CommandItem, 'action'>[] = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, keywords: 'home main stats overview' },
  { id: 'logs', label: 'Open Log Explorer', icon: FileSearch, keywords: 'events audit search' },
  { id: 'incidents', label: 'View Incidents', icon: AlertTriangle, keywords: 'alerts cases tickets' },
  { id: 'edr', label: 'Open EDR / XDR', icon: Monitor, keywords: 'endpoint detection response' },
  { id: 'waf', label: 'Open WAF Monitor', icon: ShieldAlert, keywords: 'firewall rules web' },
  { id: 'threats', label: 'Open Threat Intel', icon: Shield, keywords: 'ioc intelligence' },
  { id: 'ingestion', label: 'Data Ingestion', icon: Upload, keywords: 'import upload scan' },
  { id: 'settings', label: 'Open Settings', icon: Settings, keywords: 'preferences config profile' },
];

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.keywords.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const execute = useCallback((id: string) => {
    onClose();
    navigate(`/${id === 'dashboard' ? '' : id}`);
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      execute(filtered[selectedIndex].id);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: 520,
              maxWidth: '90vw',
              background: 'var(--bg-card)',
              border: 'var(--border-primary)',
              borderRadius: 'var(--border-radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 20px',
              borderBottom: 'var(--border-primary)',
            }}>
              <Search size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages and actions..."
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-base)',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              <kbd style={{
                padding: '4px 8px',
                background: 'var(--bg-tertiary)',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                border: 'var(--border-primary)',
              }}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 300, overflowY: 'auto', padding: 8 }}>                {filtered.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                    No results found
                  </div>
                ) : (
                  filtered.map((item, idx) => {
                    const IconComponent = item.icon as LucideIcon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => execute(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 'var(--border-radius-sm)',
                          cursor: 'pointer',
                          background: idx === selectedIndex ? 'var(--bg-card-hover)' : 'transparent',
                          border: idx === selectedIndex ? `1px solid var(--accent-primary)` : '1px solid transparent',
                          transition: 'all 100ms ease',
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <IconComponent size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                          {item.label}
                        </span>
                        <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                    );
                  })
                )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 16px',
              borderTop: 'var(--border-primary)',
              display: 'flex',
              gap: 16,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)',
            }}>
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>Esc Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
