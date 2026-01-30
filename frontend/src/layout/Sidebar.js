import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaBars,
  FaBoxes,
  FaChevronDown,
  FaClipboardList,
  FaCog,
  FaExclamationTriangle,
  FaFileAlt,
  FaHome,
  FaSignOutAlt,
  FaUser,
  FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/App.css';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth <= 768);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isStaff } = useAuth();

  const fetchLowStockCount = async () => {
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('/low_stock_chemicals/'),
        api.get('/low_stock_apparatus/'),
      ]);
      const chemData = Array.isArray(chemRes.data)
        ? chemRes.data
        : chemRes.data.results || [];
      const appData = Array.isArray(appRes.data)
        ? appRes.data
        : appRes.data.results || [];
      setLowStockCount(chemData.length + appData.length);
    } catch (err) {
      console.error('Error fetching count:', err);
    }
  };

  useEffect(() => {
    fetchLowStockCount();

    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('inventory-updated', fetchLowStockCount);

    const handleStorage = (e) => {
      if (e.key === 'inventory-updated') fetchLowStockCount();
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(fetchLowStockCount, 3000);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('inventory-updated', fetchLowStockCount);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    setShowUserMenu(false);
  };

  const handleNavLinkClick = () => {
    if (isMobile) {
      setIsCollapsed(true);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Top Header */}
      {isMobile && (
        <div className="mobile-toggle-header">
          <button className="mobile-toggle-btn" onClick={toggleSidebar}>
            <FaBars />
          </button>
          <span className="mobile-header-title">Lab Manager</span>
        </div>
      )}

      {/* Sidebar Backdrop */}
      {isMobile && !isCollapsed && (
        <div className="sidebar-backdrop" onClick={() => setIsCollapsed(true)} />
      )}

      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button className="toggle-btn" onClick={toggleSidebar}>
            <FaBars />
          </button>
          {!isCollapsed && <h2 className="sidebar-title">Lab Manager</h2>}
        </div>

        <nav className="sidebar-nav">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={handleNavLinkClick}>
            <FaHome className="nav-icon" />
            {!isCollapsed && <span>Home</span>}
          </Link>

          <Link
            to="/inventory"
            className={location.pathname === '/inventory' ? 'active' : ''}
            onClick={handleNavLinkClick}
          >
            <div className="nav-icon-wrapper">
              <FaBoxes className="nav-icon" />
              {isCollapsed && lowStockCount > 0 && (
                <span className="sidebar-dot"></span>
              )}
            </div>
            {!isCollapsed && (
              <>
                <span>Inventory</span>
                {lowStockCount > 0 && (
                  <span className="sidebar-right-count">{lowStockCount}</span>
                )}
              </>
            )}
          </Link>

          {!isStaff && (
            <>
              <Link
                to="/stock-register"
                className={location.pathname === '/stock-register' ? 'active' : ''}
                onClick={handleNavLinkClick}
              >
                <FaClipboardList className="nav-icon" />
                {!isCollapsed && <span>Stock Register</span>}
              </Link>

              <Link
                to="/issue-register"
                className={location.pathname === '/issue-register' ? 'active' : ''}
                onClick={handleNavLinkClick}
              >
                <FaFileAlt className="nav-icon" />
                {!isCollapsed && <span>Issue Register</span>}
              </Link>

              <Link
                to="/damaged-entry"
                className={location.pathname === '/damaged-entry' ? 'active' : ''}
                onClick={handleNavLinkClick}
              >
                <FaExclamationTriangle className="nav-icon" />
                {!isCollapsed && <span>Damaged Entry</span>}
              </Link>
            </>
          )}

          {isAdmin && (
            <Link to="/users" className={location.pathname === '/users' ? 'active' : ''} onClick={handleNavLinkClick}>
              <FaUsers className="nav-icon" />
              {!isCollapsed && <span>User Management</span>}
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-menu">
            <button
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div className="user-avatar">
                  {user?.full_name?.[0] || user?.employee_id?.[0] || 'U'}
                </div>
                {!isCollapsed && (
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div className="user-name">{user?.full_name || user?.employee_id}</div>
                    <div className="user-role">
                      {user?.role === 'admin'
                        ? 'Administrator'
                        : user?.role === 'hod'
                          ? 'Head of Dept.'
                          : user?.role === 'store_keeper'
                            ? 'Store Keeper'
                            : 'Staff'}
                    </div>
                  </div>
                )}
                {!isCollapsed && <FaChevronDown size={12} />}
              </div>
            </button>

            {showUserMenu && !isCollapsed && (
              <div className="user-dropdown">
                <button
                  onClick={() => {
                    navigate('/settings');
                    setShowUserMenu(false);
                    handleNavLinkClick();
                  }}
                >
                  <FaCog /> Settings
                </button>
                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowUserMenu(false);
                    handleNavLinkClick();
                  }}
                >
                  <FaUser /> My Profile
                </button>
                <button onClick={handleLogout} style={{ color: '#dc3545' }}>
                  <FaSignOutAlt /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};


export default Sidebar;

