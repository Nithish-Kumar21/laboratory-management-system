import React from 'react';
import { FaSun, FaMoon, FaFlask } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from '../components/NotificationCenter';
import './Header.css';

function getInitials(user) {
  if (!user) return '?';
  const role = user.role || '';
  if (role === 'hod') return 'HD';
  if (role === 'store_keeper') return 'SK';
  if (role === 'staff') return 'ST';
  return user.full_name ? user.full_name.charAt(0).toUpperCase() : '?';
}

function getRoleLabel(role) {
  if (role === 'hod') return 'Head of Department';
  if (role === 'store_keeper') return 'Store Keeper';
  if (role === 'staff') return 'Staff';
  return role || '';
}

function Header() {
  const { themeMode, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="app-header">
      <div className="header-left">
        <FaFlask className="header-flask-icon" />
        <span className="header-lms">LMS</span>
      </div>
      <span className="header-lms-center">LMS</span>
      <div className="header-right">
        <div className="header-right-group">
          <NotificationCenter />
          <button className="header-theme-btn" onClick={toggleTheme} title="Toggle theme">
            {themeMode === 'dark' ? <FaSun /> : <FaMoon />}
          </button>
          <div className="header-user-group">
            <div className="header-avatar-circle">
              {getInitials(user)}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{getRoleLabel(user?.role)}</span>
              <span className="header-user-sub">Store Department</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
