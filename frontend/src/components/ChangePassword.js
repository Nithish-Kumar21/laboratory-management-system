import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();

  console.log('ChangePassword Component Rendering');

  const isForced = location.state?.forced || false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/users/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Update user in context to remove password_must_change flag
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.password_must_change = false;
      updateUser(storedUser);

      setSuccess('Password changed successfully!');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      const errorData = err.response?.data;
      console.error('Change password error:', errorData);
      if (errorData) {
        if (typeof errorData === 'string') {
          setError(errorData);
        } else if (errorData.error) {
          setError(errorData.error);
        } else if (errorData.old_password) {
          setError(`Old Password: ${errorData.old_password[0]}`);
        } else if (errorData.new_password) {
          setError(`New Password: ${errorData.new_password[0]}`);
        } else if (errorData.confirm_password) {
          setError(`Confirm Password: ${errorData.confirm_password[0]}`);
        } else {
          // Handle other field errors or fallback
          const firstEntry = Object.entries(errorData)[0];
          if (firstEntry) {
            const [field, messages] = firstEntry;
            const message = Array.isArray(messages) ? messages[0] : messages;
            setError(`${field}: ${message}`);
          } else {
            setError('Failed to change password');
          }
        }
      } else {
        setError('Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  console.log('ChangePassword rendering with state:', { isForced, error, success });

  return (
    <div style={{ padding: '50px', backgroundColor: 'white', minHeight: '100vh', color: 'black' }}>
      <h1>Change Password Page</h1>
      <p>If you see this, the component is rendering.</p>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Current Password</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            style={styles.input}
            disabled={loading}
            autoFocus
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={styles.input}
            disabled={loading}
            minLength="8"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={styles.input}
            disabled={loading}
            minLength="8"
          />
        </div>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Changing...' : 'Change Password'}
        </button>

        {!isForced && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={styles.cancelButton}
            disabled={loading}
          >
            Cancel
          </button>
        )}
      </form>
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
    marginBottom: '30px',
  },
  warning: {
    background: '#fff3cd',
    color: '#856404',
    padding: '12px',
    borderRadius: '5px',
    marginBottom: '20px',
    border: '1px solid #ffeaa7',
    textAlign: 'center',
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    border: '1px solid #fcc',
  },
  success: {
    background: '#d4edda',
    color: '#155724',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    border: '1px solid #c3e6cb',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    color: '#333',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    background: '#667eea',
    color: 'white',
    padding: '12px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  cancelButton: {
    background: '#6c757d',
    color: 'white',
    padding: '12px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

export default ChangePassword;
