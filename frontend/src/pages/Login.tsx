import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, AlertCircle, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Animated gradient orbs background
function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const orbs: Array<{ x: number; y: number; vx: number; vy: number; r: number; color: string }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create gradient orbs
    orbs.push({ x: canvas.width * 0.2, y: canvas.height * 0.3, vx: 0.3, vy: 0.2, r: 200, color: 'rgba(56, 189, 248, 0.06)' });
    orbs.push({ x: canvas.width * 0.8, y: canvas.height * 0.6, vx: -0.2, vy: 0.3, r: 250, color: 'rgba(96, 165, 250, 0.04)' });
    orbs.push({ x: canvas.width * 0.5, y: canvas.height * 0.8, vx: 0.1, vy: -0.25, r: 180, color: 'rgba(56, 189, 248, 0.04)' });

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

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const loggedIn = await login(username, password);
      navigate(loggedIn.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
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
      <AnimatedBackground />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          zIndex: 1,
        }}
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
              background: 'rgba(56, 189, 248, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--glow-cyan)',
            }}>
              <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>Sentinal</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)' }}>IQ</span>
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}
          >
            Security Operations Center Platform
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
            border: 'var(--border-accent)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 28 }}>
            Sign in to access your SOC dashboard
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
                Username
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
                  placeholder="Enter your username"
                  autoComplete="username"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
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
                  placeholder="Enter your password"
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

            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <Link to="/forgot-password" style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--accent-primary)',
                transition: 'opacity var(--transition-fast)',
              }}>
                Forgot password?
              </Link>
            </div>

            <motion.button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', position: 'relative' }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </motion.button>
          </form>

          <div style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
          }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
              Create account
            </Link>
          </div>

        </motion.div>
      </motion.div>
    </div>
  );
}
