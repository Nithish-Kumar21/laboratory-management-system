import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaPhone, FaIdCard, FaUserShield, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import api from '../utils/api';
import './UserProfile.css';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        full_name: user.full_name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.patch(`/users/${user.id}/`, formData);
      updateUser({ ...user, ...response.data });
      setSuccess('Profile updated successfully!');
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') {
          setError(errorData);
        } else if (errorData.error) {
          setError(errorData.error);
        } else {
          const firstError = Object.values(errorData)[0];
          setError(Array.isArray(firstError) ? firstError[0] : 'Failed to update profile');
        }
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'hod':
        return 'Head of Department';
      case 'store_keeper':
        return 'Store Keeper';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  };

  return (
    <div className="user-profile-container">
      <div className="user-profile-header">
        <h1 className="user-profile-title">My Profile</h1>
        <button
          onClick={() => navigate('/change-password')}
          className="btn-change-password"
        >
          Change Password
        </button>
      </div>

      <div className="user-profile-content">
        <div className="profile-card">
          <h2 className="profile-section-title"><FaIdCard /> Account Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label className="info-label">Employee ID</label>
              <span className="info-value">{user?.employee_id || '-'}</span>
            </div>
            <div className="info-item">
              <label className="info-label">Role</label>
              <span className="role-badge">
                <FaUserShield style={{ marginRight: '8px' }} />
                {getRoleDisplay(user?.role)}
              </span>
            </div>
            <div className="info-item">
              <label className="info-label">Status</label>
              <span
                className="status-badge"
                style={{
                  backgroundColor: user?.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: user?.is_active ? '#10b981' : '#ef4444',
                  border: user?.is_active ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h2 className="profile-section-title"><FaUser /> Update Profile</h2>

          {error && <div className="alert-message alert-error"><FaExclamationCircle /> {error}</div>}
          {success && <div className="alert-message alert-success"><FaCheckCircle /> {success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="profile-form-grid">
              <div className="profile-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="profile-input"
                  placeholder="Enter full name"
                />
              </div>

              <div className="profile-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="profile-input"
                  placeholder="Enter email"
                  required
                />
              </div>

              <div className="profile-form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="profile-input"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="profile-actions">
              <button
                type="submit"
                disabled={loading}
                className="btn-update-profile"
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn-cancel"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
