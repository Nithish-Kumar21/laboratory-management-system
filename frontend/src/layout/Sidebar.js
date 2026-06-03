import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FaBoxes,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileAlt,
  FaSignOutAlt,
  FaEdit,
  FaCog
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

function Sidebar() {
  const location = useLocation();
  const { isHOD, isStoreKeeper, isStaff, logout } = useAuth();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const menuItems = [
    { path: '/inventory', label: 'Inventory', icon: FaBoxes, show: true },
    { path: '/stock-register', label: 'Stock Register', icon: FaClipboardList, show: isHOD || isStoreKeeper },
    { path: '/requests', label: 'Chemical Request', icon: FaClipboardList, show: true },
    { path: '/damaged-entry', label: 'Damaged Entry', icon: FaExclamationTriangle, show: isHOD || isStoreKeeper },
    { path: '/issue-register', label: 'Issue Register', icon: FaFileAlt, show: isHOD || isStoreKeeper },
    { path: '/drafts', label: 'My Draft', icon: FaEdit, show: isStaff },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-top-divider" />
      <nav className="sidebar-nav">
        {menuItems.filter(m => m.show).map(item => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${active ? 'active' : ''}`}
            >
              <item.icon className="sidebar-link-icon" />
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-bottom-divider" />
        <Link
          to="/settings"
          className={`sidebar-link ${isActive('/settings') ? 'active' : ''}`}
        >
          <FaCog className="sidebar-link-icon" />
          <span className="sidebar-link-label">Settings</span>
        </Link>
        <button className="sidebar-logout" onClick={logout}>
          <FaSignOutAlt className="sidebar-link-icon" />
          <span className="sidebar-link-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
