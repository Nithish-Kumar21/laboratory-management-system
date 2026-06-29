import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import PasswordChecklist from './auth/PasswordChecklist';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null);
  const [checkingToken, setCheckingToken] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
      setCheckingToken(false);
      return;
    }

    const verifyToken = async () => {
      try {
        await api.get(`/users/reset-password/verify/?token=${token}`);
        setTokenValid(true);
      } catch {
        setTokenValid(false);
        setError('This reset link is invalid or has expired.');
      } finally {
        setCheckingToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/users/reset-password/', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess(response.data.message || 'Password reset successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const data = err.response?.data;
      if (data?.error) setError(data.error);
      else if (data?.new_password) setError(data.new_password[0]);
      else setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ textAlign: 'center', color: '#666' }}>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Reset Password</h2>

        {error && !success && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {tokenValid && !success && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={styles.input}
                  disabled={loading}
                  minLength="8"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={styles.eyeBtn}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordChecklist password={newPassword} />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={styles.input}
                  disabled={loading}
                  minLength="8"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={styles.eyeBtn}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" style={{ ...styles.button, opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        {!tokenValid && !success && (
          <p style={{ textAlign: 'center', marginTop: 20 }}>
            <Link to="/forgot-password" style={{ color: '#667eea', textDecoration: 'none' }}>
              Request a new reset link
            </Link>
          </p>
        )}

        {success && (
          <p style={{ textAlign: 'center', marginTop: 10, fontSize: '0.85rem', color: '#666' }}>
            Redirecting to login...
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.9rem' }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
  },
  card: {
    background: 'white',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: 30,
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: 20,
    border: '1px solid #fcc',
  },
  success: {
    background: '#d4edda',
    color: '#155724',
    padding: '12px',
    borderRadius: '5px',
    marginBottom: 20,
    border: '1px solid #c3e6cb',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    marginBottom: 5,
    color: '#333',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '10px 36px 10px 10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9CA3AF',
    padding: 4,
  },
  button: {
    background: '#667eea',
    color: 'white',
    padding: '12px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default ResetPassword;
