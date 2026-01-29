import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(username, password);

      // Check if password change is required
      if (userData.password_must_change) {
        navigate('/change-password', { state: { forced: true } });
      } else {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageWrapper}>
      {/* Green Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/gnc_logo.png" alt="GNC Logo" style={styles.headerLogo} />
          <div style={styles.headerText}>
            <div style={styles.collegeName}>Guru Nanak College (Autonomous)</div>
            <div style={styles.accreditation}>Accredited at A++ Grade by NAAC</div>
            <div style={styles.location}>Chennai - 600 042.</div>
          </div>
        </div>
        <div style={styles.headerCenter}>
          <h1 style={styles.mainTitle}>Laboratory Management System</h1>
          <h2 style={styles.deptTitle}>PG and Research Programme of Chemistry (GAS)</h2>
        </div>
        <div style={styles.headerRight}></div>
      </header>

      {/* Main Content with Background */}
      <main style={styles.mainContent}>
        <div style={styles.loginContainer}>
          <div style={styles.glassCard}>
            <h2 style={styles.loginTitle}>Login</h2>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={styles.input}
                  disabled={loading}
                  autoFocus
                  placeholder="Enter employee ID"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={styles.input}
                  disabled={loading}
                  placeholder="Enter password"
                />
              </div>

              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div style={styles.links}>
              <a href="/forgot-password" style={styles.link}>
                Forgot Password?
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const styles = {
  pageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  header: {
    background: '#1b5e20', // Dark Green
    color: 'white',
    padding: '15px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flex: 1,
  },
  headerLogo: {
    width: '65px',
    height: '65px',
    background: 'white',
    borderRadius: '50%',
    padding: '2px',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
  },
  collegeName: {
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  accreditation: {
    fontSize: '13px',
    opacity: 0.9,
  },
  location: {
    fontSize: '13px',
    opacity: 0.8,
  },
  headerCenter: {
    textAlign: 'center',
    flex: 3,
  },
  headerRight: {
    flex: 1,
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: '800',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
  },
  deptTitle: {
    fontSize: '16px',
    fontWeight: '500',
    margin: '5px 0 0 0',
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
    backgroundImage: 'url("/gnc_bg.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    justifyContent: 'flex-start', // Align login to the left
    alignItems: 'center',
    paddingLeft: '10%', // Offset from the left
    position: 'relative',
  },
  loginContainer: {
    width: '100%',
    maxWidth: '420px',
  },
  glassCard: {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
  },
  loginTitle: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '30px',
    textAlign: 'center',
    textShadow: '1px 1px 4px rgba(0,0,0,0.3)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroup: {
    marginBottom: '25px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '15px',
    fontWeight: '600',
    color: 'white',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    color: '#333',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'all 0.3s',
  },
  button: {
    background: '#2e7d32', // Medium Green
    color: 'white',
    padding: '16px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s',
    marginTop: '10px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  error: {
    background: 'rgba(211, 47, 47, 0.9)',
    color: 'white',
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: '14px',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  links: {
    marginTop: '25px',
    textAlign: 'center',
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    opacity: 0.9,
    transition: 'opacity 0.3s',
  },
};

export default Login;
