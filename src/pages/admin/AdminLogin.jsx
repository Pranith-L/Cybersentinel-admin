import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../config/supabase';
import { User, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import '../Auth.css';
import './AdminLogin.css';

export default function AdminLogin({ defaultRole = 'ADMIN' }) {
  const [role, setRole] = useState(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { loginAdmin, adminLogin, loginCoordinator, coordinatorLogin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const getCredentialErrorToast = (error, emailExists = true) => {
    const emailValue = (email || '').trim();
    const passwordValue = password || '';
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    const passwordLooksMissing = !passwordValue || passwordValue.length < 4;

    if (!emailValue && !passwordValue) {
      return { title: 'Missing details', message: 'Please enter your email and password.', type: 'error' };
    }

    if (!emailValue) {
      return { title: 'Email is wrong', message: 'Please enter a valid email address.', type: 'error' };
    }

    if (!emailLooksValid) {
      return { title: 'Email is wrong', message: 'The email entered is incorrect.', type: 'error' };
    }

    if (!emailExists) {
      return { title: 'Email is wrong', message: 'This email is not registered in our system.', type: 'error' };
    }

    if (passwordLooksMissing) {
      return { title: 'Password is wrong', message: 'Please check the password and try again.', type: 'error' };
    }

    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('password')) {
      return { title: 'Password is wrong', message: 'The password you entered is incorrect.', type: 'error' };
    }

    if (msg.includes('email') || msg.includes('user') || msg.includes('not found')) {
      return { title: 'Email is wrong', message: 'This email is not registered in our system.', type: 'error' };
    }

    return { title: 'Password is wrong', message: 'The password you entered is incorrect.', type: 'error' };
  };

  const checkEmailExistsForRole = async () => {
    const emailValue = (email || '').trim();
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return false;
    }

    const lowerEmail = emailValue.toLowerCase();
    const demoAdminEmail = 'admin@cybersentinel.in';

    if (role === 'ADMIN') {
      if (lowerEmail === demoAdminEmail.toLowerCase()) {
        return true;
      }

      try {
        const { data } = await supabase.from('profiles').select('email').eq('role', 'ADMIN').ilike('email', emailValue);
        return Boolean(data?.length);
      } catch {
        return false;
      }
    }

    const knownCoordinatorEmails = [
      'PP@gmail.com',
      'paper@gmail.com',
      'UN@gmail.com',
      'CC@gmail.com',
      'WE@gmail.com',
      'XC@gmail.com',
      'GD@gmail.com',
      'SP@gmail.com',
      'CO@gmail.com',
      'FTB@gmail.com',
      'MS@gmail.com',
      'LIL@gmail.com',
      'TC@gmail.com',
      'FF@gmail.com',
      'esports@cybersentinel.in',
    ];

    if (knownCoordinatorEmails.some((known) => known.toLowerCase() === lowerEmail)) {
      return true;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'COORDINATOR')
        .ilike('email', emailValue);
      return Boolean(data?.length);
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast({
        title: 'Missing details',
        message: 'Please enter both email and password.',
        type: 'error',
      });
      return;
    }

    try {
      setIsLoading(true);
      const emailExists = await checkEmailExistsForRole();
      if (!emailExists) {
        addToast(getCredentialErrorToast(null, false));
        return;
      }

      if (role === 'ADMIN') {
        const doLogin = loginAdmin || adminLogin;
        await doLogin(email, password);
        addToast({ title: 'Welcome back', message: 'Admin authenticated successfully.', type: 'success' });
        navigate('/admin/dashboard');
      } else {
        const doLogin = loginCoordinator || coordinatorLogin;
        await doLogin(email, password);
        addToast({ title: 'Welcome back', message: 'Coordinator authenticated successfully.', type: 'success' });
        navigate('/coordinator/dashboard');
      }
    } catch (err) {
      console.error(`${role} login error:`, err);
      addToast(getCredentialErrorToast(err, true));
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="cyber-login-container">
      <div className="cyber-login-overlay" />

      {/* Main 2-Column Responsive Layout */}
      <div className="cyber-login-layout">
        {/* Left Side: CyberSentinel Brand Hero matching exact uploaded reference */}
        <div className="cyber-login-brand">
          {/* Logo with outer glow - fully inside circle */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-12px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(236, 72, 153, 0.45) 0%, rgba(168, 85, 247, 0.2) 65%, transparent 100%)',
                filter: 'blur(20px)',
              }}
            />
            <div
              className={`cyber-login-crest ${role === 'COORDINATOR' ? 'is-coordinator' : ''}`}
              style={{
                width: '215px',
                height: '215px',
                borderRadius: '50%',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#09071c',
                border: `3px solid ${role === 'ADMIN' ? '#ec4899' : '#00f0ff'}`,
                boxShadow:
                  role === 'ADMIN'
                    ? '0 0 35px rgba(236, 72, 153, 0.65), inset 0 0 15px rgba(236, 72, 153, 0.3)'
                    : '0 0 35px rgba(0, 240, 255, 0.65), inset 0 0 15px rgba(168, 85, 247, 0.3)',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
            >
              <img
                src="/assets/cybersentinel_crest_logo.jpg"
                alt="CyberSentinel 2K26 Emblem"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: '3px',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {/* Titles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '100%' }}>
            <h1 className="cyber-login-title">
              {role === 'ADMIN' ? 'ADMIN PORTAL' : 'COORDINATOR PORTAL'}
            </h1>
            <p className="cyber-login-subtitle">
              {role === 'ADMIN'
                ? 'Manage • Verify • Coordinate'
                : 'Verify • Supervise • Coordinate'}
            </p>
          </div>

          {/* Clean Cyber Event Badge (No AI Sparkles) */}
          <div className="cyber-event-badge">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 240, 255, 0.12)',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00f0ff',
                flexShrink: 0,
              }}
            >
              <Shield size={17} />
            </div>

            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                CyberSentinel 2K26
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', wordBreak: 'break-word' }}>
                National Level Techno-Cultural Extravaganza
              </div>
            </div>
          </div>

          {/* College Sub-caption */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.18em',
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            VEL TECH HIGH TECH COLLEGE
          </div>
        </div>

        {/* Right Side: SCI-FI HUD CARD with EXACT Cutout Shape */}
        <div className="cyber-hud-card-col">
          <div className="cyber-hud-card-wrapper">
            {/* SVG Card Cutout Frame with Exact Top-Left Step & Side Notches */}
            <svg
              viewBox="0 0 520 560"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <linearGradient id="hudStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" />
                  <stop offset="35%" stopColor="#818cf8" />
                  <stop offset="65%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <filter id="hudNeonGlow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Exact Cutout Outer Path */}
              <path
                d="
                  M 24 28
                  L 142 28
                  L 166 12
                  L 496 12
                  A 14 14 0 0 1 510 26
                  L 510 135
                  L 516 140
                  L 516 210
                  L 510 215
                  L 510 515
                  L 485 540
                  L 45 540
                  L 12 507
                  L 12 375
                  L 6 370
                  L 6 300
                  L 12 295
                  L 12 40
                  A 12 12 0 0 1 24 28
                  Z
                "
                fill="rgba(12, 10, 32, 0.90)"
                stroke="url(#hudStrokeGrad)"
                strokeWidth="2"
                filter="url(#hudNeonGlow)"
              />

              {/* Cyan Accent Highlights */}
              <line x1="142" y1="28" x2="166" y2="12" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round" />
              <line x1="110" y1="28" x2="142" y2="28" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round" />
              <line x1="6" y1="305" x2="6" y2="365" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round" />
              <line x1="12" y1="507" x2="45" y2="540" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round" />

              {/* Magenta Accent Highlights */}
              <line x1="516" y1="145" x2="516" y2="205" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" />
              <line x1="485" y1="540" x2="510" y2="515" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" />
            </svg>

            {/* Inner Form Content */}
            <div className="cyber-hud-form-body">
                {/* Header */}
              <div style={{ marginBottom: '24px' }}>
                <h2
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    color: role === 'ADMIN' ? '#00f0ff' : '#00f0ff',
                    letterSpacing: '-0.01em',
                    textShadow: '0 0 20px rgba(0, 240, 255, 0.5)',
                  }}
                >
                  {role === 'ADMIN' ? 'Admin Authentication' : 'Coordinator Access'}
                </h2>
                <p style={{ fontSize: '13.5px', color: '#cbd5e1', marginTop: '6px' }}>
                  {role === 'ADMIN'
                    ? 'Enter administrator credentials to proceed'
                    : 'Enter coordinator credentials to manage assigned events'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* ID / Email */}
                <div style={{ position: 'relative' }}>
                  <User
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                    }}
                  />
                  <input
                    type="text"
                    required
                    placeholder={role === 'ADMIN' ? 'Admin ID or Email' : 'Coordinator Email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="cyber-login-input"
                  />
                </div>

                {/* Password */}
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="cyber-login-input"
                    style={{ paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="cyber-auth-row">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        accentColor: '#00f0ff',
                        cursor: 'pointer',
                      }}
                    />
                    <span>Remember me</span>
                  </label>
                  <a
                    href="mailto:support@cybersentinel.in?subject=Password%20Reset%20Request"
                    style={{ color: '#00f0ff', textDecoration: 'none', fontWeight: 500 }}
                    onMouseEnter={(e) => (e.target.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.target.style.textDecoration = 'none')}
                  >
                    Forgot Password?
                  </a>
                </div>

                {/* Glowing Pill Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="cyber-login-btn"
                  style={{ marginTop: '8px' }}
                >
                  <span>{isLoading ? 'Authenticating...' : role === 'ADMIN' ? 'LOGIN AS ADMIN' : 'LOGIN AS COORDINATOR'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              {/* Portal Switchers */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '18px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setRole(role === 'ADMIN' ? 'COORDINATOR' : 'ADMIN')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: role === 'ADMIN' ? '#c084fc' : '#38bdf8',
                    fontWeight: 600,
                  }}
                >
                  {role === 'ADMIN' ? 'Switch to Coordinator Portal →' : 'Switch to Admin Portal →'}
                </button>
                <Link
                  to="/"
                  style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}
                >
                  ← Back to Public Portal Hub
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
