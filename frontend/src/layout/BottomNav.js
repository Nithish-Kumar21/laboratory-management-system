import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FaBoxes,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileAlt,
  FaEdit,
  FaChartBar
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import './BottomNav.css';

function BottomNav() {
  const location = useLocation();
  const { isHOD, isStoreKeeper, isStaff } = useAuth();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const tabs = [
    { path: '/inventory', label: 'Inventory', icon: FaBoxes, show: true },
    { path: '/stock-register', label: 'Stock', icon: FaClipboardList, show: isHOD || isStoreKeeper },
    { path: '/requests', label: 'Requests', icon: FaClipboardList, show: true },
    { path: '/damaged-entry', label: 'Damaged', icon: FaExclamationTriangle, show: isHOD || isStoreKeeper },
    { path: '/issue-register', label: 'Issue', icon: FaFileAlt, show: isHOD || isStoreKeeper },
    { path: '/drafts', label: 'Draft', icon: FaEdit, show: isStaff },
    { path: '/reports/year-end', label: 'Report', icon: FaChartBar, show: isHOD || isStoreKeeper },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.filter(t => t.show).map(tab => {
        const active = isActive(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`bottom-nav-link ${active ? 'active' : ''}`}
          >
            <tab.icon className="bottom-nav-icon" />
            <span className="bottom-nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
