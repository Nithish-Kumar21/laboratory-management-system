import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getRoleStyles = (role) => {
    switch (role) {
      case 'admin':
        return { backgroundColor: '#eff6ff', color: '#1e40af' };
      case 'hod':
        return { backgroundColor: '#fff7ed', color: '#9a3412' };
      case 'store_keeper':
        return { backgroundColor: '#eff6ff', color: '#1e40af' }; // Blue as in image
      case 'staff':
        return { backgroundColor: '#fdf4ff', color: '#86198f' };
      default:
        return { backgroundColor: '#f8fafc', color: '#475569' };
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'hod': return 'Head of Department';
      case 'store_keeper': return 'Store Keeper';
      case 'staff': return 'Staff';
      default: return role;
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
        <button
          onClick={() => navigate('/change-password')}
          className="btn-indigo"
          style={{ padding: '10px 24px' }}
        >
          Change Password
        </button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '20px', fontWeight: 'bold' }}>{error}</div>
      )}
      {success && (
        <div style={{ color: '#10b981', marginBottom: '20px', fontWeight: 'bold' }}>{success}</div>
      )}

      {/* Account Information Card */}
      <div className="profile-card">
        <div className="profile-card-header">
          <h2>Account Information</h2>
        </div>
        <div className="profile-card-body">
          <div className="info-grid">
            <div className="info-item">
              <label>Employee ID:</label>
              <span>{user?.employee_id || '-'}</span>
            </div>
            <div className="info-item">
              <label>Role:</label>
              <span
                className="badge-profile"
                style={getRoleStyles(user?.role)}
              >
                {getRoleDisplay(user?.role)}
              </span>
            </div>
            <div className="info-item">
              <label>Status:</label>
              <span
                className="badge-profile"
                style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
              >
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Update Profile Card */}
      <div className="profile-card">
        <div className="profile-card-header">
          <h2>Update Profile</h2>
        </div>
        <div className="profile-card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="input-profile"
                  placeholder="Enter full name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-profile"
                  placeholder="Enter email"
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 1' }}>
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input-profile"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="profile-actions">
              <button
                type="submit"
                disabled={loading}
                className="btn-indigo"
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn-hollow"
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
