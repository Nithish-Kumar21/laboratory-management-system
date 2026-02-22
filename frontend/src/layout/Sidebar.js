import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FaBoxes,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileAlt,
  FaHome,
  FaUsers,
  FaSignOutAlt,
  FaEdit
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Sidebar.css';

const Sidebar = ({ isOpen, isMobile }) => {
  const [lowStockCount, setLowStockCount] = useState(0);
  const location = useLocation();
  const { isAdmin, isStaff, logout } = useAuth();

  const fetchLowStockCount = async () => {
    if (isStaff || isAdmin) return;
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('/low_stock_chemicals/').catch(() => ({ data: [] })),
        api.get('/low_stock_apparatus/').catch(() => ({ data: [] })),
      ]);
      const chemData = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
      const appData = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];
      setLowStockCount(chemData.length + appData.length);
    } catch (err) {
      console.error('Error fetching count:', err);
    }
  };

  useEffect(() => {
    fetchLowStockCount();
    const interval = setInterval(fetchLowStockCount, 15000);
    window.addEventListener('inventory-updated', fetchLowStockCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener('inventory-updated', fetchLowStockCount);
    };
  }, [isStaff, isAdmin]);

  const menuItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: FaHome,
      show: !isAdmin, // Admin has no dashboard
      color: 'var(--dept-dashboard)'
    },
    {
      path: '/inventory',
      label: 'Inventory',
      icon: FaBoxes,
      show: !isAdmin, // No access for admin
      color: 'var(--dept-inventory)'
    },
    {
      path: '/stock-register',
      label: 'Stock Register',
      icon: FaClipboardList,
      show: !isStaff && !isAdmin, // No access for staff and admin
      color: 'var(--dept-stock)'
    },
    {
      path: '/issue-register',
      label: 'Issue Register',
      icon: FaFileAlt,
      show: !isStaff && !isAdmin, // Hide for staff and admin
      color: 'var(--dept-issue)'
    },
    {
      path: '/damaged-entry',
      label: 'Damaged Entry',
      icon: FaExclamationTriangle,
      show: !isStaff && !isAdmin, // Hide for staff and admin
      color: 'var(--dept-damaged)'
    },
    {
      path: '/users',
      label: 'Users',
      icon: FaUsers,
      show: isAdmin,
      color: 'var(--dept-users)'
    },
    {
      path: '/requests',
      label: 'Chemical Requests',
      icon: FaClipboardList,
      show: !isAdmin, // Hide for admin
      color: '#3498db'
    },
    {
      path: '/drafts',
      label: 'My Drafts',
      icon: FaEdit,
      show: isStaff,
      color: '#9b59b6'
    },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${isMobile ? 'mobile' : ''}`}>
      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          {menuItems.filter(item => item.show).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              style={{ '--active-color': item.color }}
            >
              <div className="nav-icon-box" style={{ '--item-color': item.color }}>
                <item.icon className="nav-icon" />
              </div>
              <span className="nav-text">{item.label}</span>
              {item.badge > 0 && (
                <span className="nav-badge animate-pulse" style={{ background: item.color }}>{item.badge}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className="nav-link logout-btn-sidebar" onClick={logout}>
          <div className="nav-icon-box logout-icon-box">
            <FaSignOutAlt className="nav-icon" />
          </div>
          <span className="nav-text">Logout</span>
        </button>
        <div className="version-info">
          <span>version 2.4.0</span>
          <span>© 2026 Laboratory Management System</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
