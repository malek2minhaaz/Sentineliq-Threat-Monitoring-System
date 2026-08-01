import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Activity, AlertTriangle, Server, Globe, BarChart3 } from 'lucide-react';

// Simplified 3D particle effect using canvas
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and move particles
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

const features = [
  { icon: Activity, title: 'Real-Time Monitoring', desc: 'Continuous security event monitoring with sub-second alerting and live dashboards.' },
  { icon: AlertTriangle, title: 'Incident Management', desc: 'Full incident lifecycle management from detection through investigation to resolution.' },
  { icon: Server, title: 'EDR / XDR', desc: 'Advanced endpoint detection and response with cross-platform telemetry and threat hunting.' },
  { icon: Shield, title: 'Threat Intelligence', desc: 'IOC management, threat actor tracking, and automated indicator matching.' },
  { icon: Globe, title: 'WAF Protection', desc: 'Web application firewall with real-time traffic analysis and customizable rule engine.' },
  { icon: BarChart3, title: 'Advanced Analytics', desc: 'Beautiful dashboards with customizable widgets, charts, and security metrics.' },
];

const stats = [
  { value: '99.9%', label: 'Uptime' },
  { value: '< 100ms', label: 'Alert Latency' },
  { value: '1M+', label: 'Events/sec' },
  { value: '24/7', label: 'Monitoring' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Navbar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: scrolled ? 'var(--bg-glass)' : 'transparent',
        backdropFilter: scrolled ? 'blur(var(--glass-blur))' : 'none',
        borderBottom: scrolled ? 'var(--border-primary)' : 'none',
        transition: 'all var(--transition-base)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            Sentinal<span style={{ color: 'var(--accent-primary)' }}>IQ</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
          <button className="btn btn-primary" onClick={() => navigate('/register')}>
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '120px 32px 80px',
      }}>
        <ParticleBackground />

        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 800,
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--accent-primary)',
              marginBottom: 24,
            }}>
              🚀 Next-Gen SIEM Platform
            </div>

            <h1 style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: 24,
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Enterprise Security<br />Operations Platform
            </h1>

            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: 'var(--text-secondary)',
              marginBottom: 40,
              maxWidth: 600,
              margin: '0 auto 40px',
              lineHeight: 1.6,
            }}>
              Real-time threat detection, incident response, and security analytics
              powered by advanced AI. Protect your organization with enterprise-grade SIEM.
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/register')}
                style={{ fontSize: 'var(--font-size-base)', padding: '16px 32px' }}
              >
                Start Free Trial <ArrowRight size={18} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn btn-secondary btn-lg"
                onClick={() => navigate('/login')}
                style={{ fontSize: 'var(--font-size-base)', padding: '16px 32px' }}
              >
                View Demo
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          Scroll to explore
        </motion.div>
      </section>

      {/* Stats */}
      <section style={{ padding: '60px 32px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }} className="stats-grid">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {stat.value}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 4 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '100px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: 16 }}>
              Everything you need for <span style={{ color: 'var(--accent-primary)' }}>SOC Excellence</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-lg)', maxWidth: 600, margin: '0 auto' }}>
              Comprehensive security operations tools designed for modern SOC teams
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }} className="features-grid">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -4 }}
                  className="card"
                  style={{ padding: '28px' }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(56, 189, 248, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <Icon size={24} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 8 }}>{feature.title}</h3>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 32px', background: 'var(--bg-secondary)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          style={{
            maxWidth: 700,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: 16 }}>
            Ready to secure your organization?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 'var(--font-size-lg)' }}>
            Join thousands of security teams using SentinalIQ to protect their digital assets
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/register')}
            style={{ fontSize: 'var(--font-size-base)', padding: '16px 40px' }}
          >
            Get Started Free <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '24px 32px',
        borderTop: 'var(--border-primary)',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 'var(--font-size-sm)',
      }}>
        &copy; {new Date().getFullYear()} SentinalIQ. All rights reserved. Built with React 19 &amp; FastAPI.
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 24px !important; }
          .features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
