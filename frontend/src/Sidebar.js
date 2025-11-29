import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaHome, 
  FaBoxes, 
  FaClipboardList, 
  FaFileAlt, 
  FaExclamationTriangle,
  FaBars 
} from 'react-icons/fa';
import logo from './logo.svg';
import './App.css';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        {!isCollapsed && <h1 className="sidebar-title">LMS</h1>}
        <button className="toggle-btn" onClick={toggleSidebar}>
          <FaBars />
        </button>
      </div>

      <nav className="sidebar-nav">
        <Link 
          to="/" 
          className={location.pathname === '/' ? 'active' : ''}
        >
          <FaHome className="icon" />
          {!isCollapsed && <span>Home</span>}
        </Link>

        <Link 
          to="/inventory" 
          className={location.pathname === '/inventory' ? 'active' : ''}
        >
          <FaBoxes className="icon" />
          {!isCollapsed && <span>Inventory</span>}
        </Link>

        <Link 
          to="/stock-register" 
          className={location.pathname.startsWith('/stock-register') ? 'active' : ''}
        >
          <FaClipboardList className="icon" />
          {!isCollapsed && <span>Stock Register</span>}
        </Link>

        <Link 
          to="/issue-register" 
          className={location.pathname === '/issue-register' ? 'active' : ''}
        >
          <FaFileAlt className="icon" />
          {!isCollapsed && <span>Issue Register</span>}
        </Link>

        <Link 
          to="/damaged-entry" 
          className={location.pathname.startsWith('/damaged-entry') ? 'active' : ''}
        >
          <FaExclamationTriangle className="icon" />
          {!isCollapsed && <span>Damaged Entry</span>}
        </Link>

      </nav>
    </div>
  );
}

export default Sidebar;
