import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaLock, FaKey, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './ChangePassword.css';

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

  const isForced = location.state?.forced || false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      await api.post('/users/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.password_must_change = false;
      updateUser(storedUser);

      setSuccess('Password changed successfully!');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') setError(errorData);
        else if (errorData.error) setError(errorData.error);
        else if (errorData.old_password) setError(`Old Password: ${errorData.old_password[0]}`);
        else if (errorData.new_password) setError(`New Password: ${errorData.new_password[0]}`);
        else setError('Failed to change password. Please check your entries.');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-container animate-fade">
      <div className="change-password-card animate-up">
        <div className="change-password-header">
          <div className="change-password-icon-box">
            <FaShieldAlt />
          </div>
          <h1>Security Update</h1>
          {isForced ? (
            <p>For your security, you must update your temporary password before proceeding.</p>
          ) : (
            <p>Change your account password to keep your laboratory data secure.</p>
          )}
        </div>

        {error && (
          <div className="alert-box alert-error">
            <FaExclamationTriangle /> {error}
          </div>
        )}
        {success && (
          <div className="alert-box alert-success">
            <FaCheckCircle /> {success}
          </div>
        )}
        {isForced && !error && (
          <div className="alert-box alert-warning">
            <FaLock /> Password update required.
          </div>
        )}

        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="input-group">
            <label><FaKey /> Current Password</label>
            <div className="input-with-icon">
              <FaLock className="field-icon" />
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                placeholder="Enter current password"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <div className="input-group">
            <label><FaShieldAlt /> New Password</label>
            <div className="input-with-icon">
              <FaLock className="field-icon" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
                disabled={loading}
                minLength="8"
              />
            </div>
          </div>

          <div className="input-group">
            <label><FaCheckCircle /> Confirm New Password</label>
            <div className="input-with-icon">
              <FaLock className="field-icon" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat new password"
                disabled={loading}
                minLength="8"
              />
            </div>
          </div>

          <div className="change-password-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Update Password'}
            </button>

            {!isForced && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary"
                disabled={loading}
              >
                <FaArrowLeft style={{ marginRight: '8px' }} /> Back to Profile
              </button>
            )}
          </div>
        </form>
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
