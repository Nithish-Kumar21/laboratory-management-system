import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaLock, FaKey, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaArrowLeft } from 'react-icons/fa';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import PasswordChecklist from './auth/PasswordChecklist';
import './ChangePassword.css';

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();

  const isForced = location.state?.forced || false;
  const tempToken = sessionStorage.getItem('temp_token');
  const accessToken = localStorage.getItem('access_token');
  const isFirstLogin = !!tempToken;

  useEffect(() => {
    if (!tempToken && !accessToken) {
      navigate('/login', { replace: true });
      return;
    }
    if (isFirstLogin && !tempToken) {
      navigate('/login', { replace: true });
    }
  }, [isFirstLogin, tempToken, accessToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword === oldPassword && !isFirstLogin) {
      setError('New password cannot be the same as the current password');
      return;
    }

    setLoading(true);
    try {
      if (isFirstLogin) {
        const response = await api.post(
          '/users/change-password/',
          {
            new_password: newPassword,
            confirm_password: confirmPassword,
          },
          {
            headers: {
              Authorization: `Bearer ${tempToken}`,
            },
          }
        );

        const { access, refresh, user: userData } = response.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user', JSON.stringify(userData));
        updateUser(userData);
        sessionStorage.removeItem('temp_token');
        sessionStorage.removeItem('user_id');

        setSuccess('Password changed successfully!');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } else {
        const response = await api.post('/users/change-password/', {
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
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') setError(errorData);
        else if (errorData.error) setError(errorData.error);
        else if (errorData.old_password) setError(`Old Password: ${errorData.old_password[0]}`);
        else if (errorData.new_password) setError(`New Password: ${errorData.new_password[0]}`);
        else if (errorData.confirm_password) setError(`Confirm Password: ${errorData.confirm_password[0]}`);
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
          {isFirstLogin ? (
            <p>Welcome! For your security, you must set a permanent password before continuing.</p>
          ) : isForced ? (
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

        <form onSubmit={handleSubmit} className="change-password-form">
          {!isFirstLogin && (
            <div className="input-group">
              <label><FaKey /> Current Password</label>
              <div className="input-with-icon">
                <FaLock className="field-icon" />
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  disabled={loading}
                  autoFocus={!isFirstLogin}
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="eye-toggle"
                  tabIndex={-1}
                >
                  {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="input-group">
            <label><FaShieldAlt /> New Password</label>
            <div className="input-with-icon">
              <FaLock className="field-icon" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
                disabled={loading}
                minLength="8"
                autoFocus={isFirstLogin}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="eye-toggle"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordChecklist password={newPassword} />
          </div>

          <div className="input-group">
            <label><FaCheckCircle /> Confirm New Password</label>
            <div className="input-with-icon">
              <FaLock className="field-icon" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat new password"
                disabled={loading}
                minLength="8"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="eye-toggle"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="change-password-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Update Password'}
            </button>

            {!isForced && !isFirstLogin && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary"
                disabled={loading}
              >
                <FaArrowLeft style={{ marginRight: '8px' }} /> Back
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
