import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './UserProfile.css';

function getInitials(user) {
  if (!user) return '?';
  const role = user.role || '';
  if (role === 'hod') return 'HD';
  if (role === 'store_keeper') return 'SK';
  if (role === 'staff') return 'ST';
  return user.full_name
    ? user.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
}

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
      const data = err.response?.data;
      let msg = 'Failed to update profile';
      if (data) {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          msg = Array.isArray(val) ? val[0] : String(val);
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
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

  const roleDisplay = getRoleDisplay(user?.role);
  const statusText = user?.is_active ? 'Active' : 'Inactive';
  const initials = getInitials(user);

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
      </div>

      {error && (
        <div className="profile-alert profile-alert-error">{error}</div>
      )}
      {success && (
        <div className="profile-alert profile-alert-success">{success}</div>
      )}

      {/* ===== MOBILE LAYOUT ===== */}
      <div className="profile-mobile">
        {/* Identity Block */}
        <div className="profile-identity">
          <div className="profile-avatar profile-avatar--mobile">
            {initials}
          </div>
          <h2 className="profile-name">{user?.full_name || 'User'}</h2>
          <span className="badge-profile" style={{ backgroundColor: '#EAF2FB', color: '#1A3C6E' }}>
            {roleDisplay}
          </span>
        </div>

        {/* Stat Row */}
        <div className="profile-stat-row">
          <div className="profile-stat-card">
            <span className="profile-stat-label">Status</span>
            <span
              className="badge-profile badge-profile--sm"
              style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
            >
              {statusText}
            </span>
          </div>
          <div className="profile-stat-card">
            <span className="profile-stat-label">Employee ID</span>
            <span className="profile-stat-value">{user?.employee_id || '-'}</span>
          </div>
        </div>

        {/* Update Profile Card */}
        <div className="profile-card">
          <h3 className="profile-card-title">Update Profile</h3>
          <form onSubmit={handleSubmit}>
            <div className="profile-form-stack">
              <div className="profile-form-group">
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
              <div className="profile-form-group">
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
              <div className="profile-form-group">
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

            <div className="profile-actions profile-actions--stacked">
              <button type="submit" disabled={loading} className="btn-indigo">
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
              <button type="button" onClick={() => navigate('/')} className="btn-hollow">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT ===== */}
      <div className="profile-desktop">
        {/* Left Column - Identity */}
        <div className="profile-sidebar-card">
          <div className="profile-identity">
            <div className="profile-avatar profile-avatar--desktop">
              {initials}
            </div>
            <h2 className="profile-name">{user?.full_name || 'User'}</h2>
            <span className="badge-profile" style={{ backgroundColor: '#EAF2FB', color: '#1A3C6E' }}>
              {roleDisplay}
            </span>
            <span
              className="badge-profile badge-profile--sm"
              style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
            >
              {statusText}
            </span>
          </div>
        </div>

        {/* Right Column - Content */}
        <div className="profile-main-col">
          {/* Account Information Card */}
          <div className="profile-card">
            <h3 className="profile-card-title">Account Information</h3>
            <div className="profile-info-grid-3">
              <div className="profile-info-item">
                <span className="profile-info-label">Employee ID</span>
                <span className="profile-info-value">{user?.employee_id || '-'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Role</span>
                <span
                  className="badge-profile badge-profile--sm"
                  style={{ backgroundColor: '#EAF2FB', color: '#1A3C6E' }}
                >
                  {roleDisplay}
                </span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Status</span>
                <span
                  className="badge-profile badge-profile--sm"
                  style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                >
                  {statusText}
                </span>
              </div>
            </div>
          </div>

          {/* Update Profile Card */}
          <div className="profile-card">
            <h3 className="profile-card-title">Update Profile</h3>
            <form onSubmit={handleSubmit}>
              <div className="profile-form-grid-desktop">
                <div className="profile-form-group">
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
                <div className="profile-form-group">
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
                <div className="profile-form-group profile-form-group--half">
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

              <div className="profile-actions profile-actions--inline">
                <button type="submit" disabled={loading} className="btn-indigo">
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
                <button type="button" onClick={() => navigate('/')} className="btn-hollow">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
