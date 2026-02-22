import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="login-page-wrapper">
      {/* Green Header */}
      <header className="login-header">
        <div className="header-left">
          <img src="/gnc_logo.png" alt="GNC Logo" className="header-logo" />
          <div className="header-text">
            <div className="college-name">Guru Nanak College (Autonomous)</div>
            <div className="accreditation">Accredited at A++ Grade by NAAC</div>
            <div className="header-location">Chennai - 600 042.</div>
          </div>
        </div>
        <div className="header-center">
          <h1 className="main-title">Laboratory Management System</h1>
          <h2 className="dept-title">PG and Research Programme of Chemistry (GAS)</h2>
        </div>
        <div className="header-right"></div>
      </header>

      {/* Main Content with Background */}
      <main className="login-main-content">
        <div className="login-container">
          <div className="glass-card">
            <h2 className="login-card-title">Login</h2>

            {error && <div className="login-error-msg">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form-group">
                <label className="login-label">Employee ID</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="login-input"
                  disabled={loading}
                  autoFocus
                  placeholder="Enter employee ID (e.g. admin)"
                />
              </div>

              <div className="login-form-group">
                <label className="login-label">Password</label>
                <div className="login-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="login-input"
                    disabled={loading}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="login-links-container">
              <a href="/forgot-password" hidden className="login-link-item">
                Forgot Password?
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
