import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <div className="header-user-group" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 cursor-pointer bg-transparent border-none"
            >
              <div className="header-user-info">
                <span className="header-user-name">{user?.full_name || getRoleLabel(user?.role)}</span>
                <span className="header-user-sub">{getRoleLabel(user?.role)}</span>
              </div>
              <div className="header-avatar-circle">
                {getInitials(user)}
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  Profile
                </button>
                <button
                  onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
