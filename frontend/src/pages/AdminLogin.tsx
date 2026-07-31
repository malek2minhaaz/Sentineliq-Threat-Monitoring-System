import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, AlertCircle, Lock, User, KeyRound, ArrowLeft } from 'lucide-react';
import { adminApi, adminStorage } from '../utils/adminApi';

// Animated grid background (reused style from Login)
function AdminBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const orbs = [
      { x: 0, y: 0, vx: 0.2, vy: 0.15, r: 220, color: 'rgba(168, 85, 247, 0.07)' },
      { x: 0, y: 0, vx: -0.15, vy: 0.2, r: 260, color: 'rgba(6, 182, 212, 0.05)' },
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      orbs[0].x = canvas.width * 0.25;
      orbs[0].y = canvas.height * 0.3;
      orbs[1].x = canvas.width * 0.8;
      orbs[1].y = canvas.height * 0.65;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      orbs.forEach(orb => {
        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.r || orb.x > canvas.width + orb.r) orb.vx *= -1;
        if (orb.y < -orb.r || orb.y > canvas.height + orb.r) orb.vy *= -1;
      });
      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
    />
  );
}

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect to admin panel if already authenticated
  useEffect(() => {
    if (adminStorage.hasSession()) navigate('/admin', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await adminApi.post<{ access_token: string; user: unknown }>('/auth/login', {
        username,
        password,
      });
      adminStorage.setSession(res.access_token, res.user);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? (err.message.includes('Invalid credentials') ? 'Invalid admin credentials' : err.message) : 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <AdminBackground />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(168, 85, 247, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168, 85, 247, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        zIndex: 0,
      }} />

      {/* Back to main site */}
      <Link to="/" style={{
        position: 'absolute',
        top: 24,
        left: 24,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--font-size-sm)',
        color: 'var(--text-tertiary)',
        transition: 'color 150ms ease',
      }}>
        <ArrowLeft size={16} />
        Back to SentinalIQ
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}
          >
            <div style={{
              width: 52, height: 52,
              borderRadius: 14,
              background: 'rgba(168, 85, 247, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(168, 85, 247, 0.35)',
            }}>
              <ShieldCheck size={28} style={{ color: '#a855f7' }} />
            </div>
            <div>
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>Admin</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#a855f7' }}>Panel</span>
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}
          >
            Platform administration & user monitoring
          </motion.p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-glass"
          style={{
            padding: '36px 32px',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={20} style={{ color: '#a855f7' }} />
            Admin Access
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 28 }}>
            Restricted area — authorized personnel only
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              style={{
                padding: '12px 14px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--border-radius-sm)',
                color: '#ef4444',
                fontSize: 'var(--font-size-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                marginBottom: 6,
                color: 'var(--text-secondary)',
              }}>
                Admin Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)', zIndex: 1,
                }} />
                <input
                  type="text"
                  className="input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  autoComplete="username"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                marginBottom: 6,
                color: 'var(--text-secondary)',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)', zIndex: 1,
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  style={{ paddingLeft: 36, paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: 4,
                    zIndex: 1,
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              className="btn btn-lg"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                border: 'none',
                color: 'white',
                boxShadow: '0 4px 20px rgba(168, 85, 247, 0.35)',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Authenticating...
                </span>
              ) : 'Sign In to Admin Panel'}
            </motion.button>
          </form>

          {/* Credentials hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: 20,
              padding: '14px 16px',
              background: 'rgba(168, 85, 247, 0.06)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)',
              border: '1px solid rgba(168, 85, 247, 0.15)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={12} />
              Admin Credentials
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Username: <span className="text-mono" style={{ color: '#a855f7' }}>admin2004</span></span>
              <span>Password: <span className="text-mono" style={{ color: '#a855f7' }}>admin2412</span></span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
