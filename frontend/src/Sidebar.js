import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaBoxes, FaClipboardList, FaFileAlt, FaExclamationTriangle, FaBars, FaUser, FaUsers, FaSignOutAlt, FaChevronDown, FaCog } from 'react-icons/fa';
import { useAuth } from './context/AuthContext';
import api from './utils/api';
import './App.css';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isStaff, isStoreKeeper, isHOD } = useAuth();

  const fetchLowStockCount = async () => {
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('/low_stock_chemicals/'),
        api.get('/low_stock_apparatus/')
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
    window.addEventListener('inventory-updated', fetchLowStockCount);

    const handleStorage = (e) => {
      if (e.key === 'inventory-updated') fetchLowStockCount();
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(fetchLowStockCount, 3000);
    return () => {
      window.removeEventListener('inventory-updated', fetchLowStockCount);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    setShowUserMenu(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button className="toggle-btn" onClick={toggleSidebar}>
          <FaBars />
        </button>
        {!isCollapsed && <h2 className="sidebar-title">Lab Manager</h2>}
      </div>

      <nav className="sidebar-nav">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          <FaHome className="nav-icon" />
          {!isCollapsed && <span>Home</span>}
        </Link>

        <Link to="/inventory" className={location.pathname === '/inventory' ? 'active' : ''}>
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
            <Link to="/stock-register" className={location.pathname === '/stock-register' ? 'active' : ''}>
              <FaClipboardList className="nav-icon" />
              {!isCollapsed && <span>Stock Register</span>}
            </Link>

            <Link to="/issue-register" className={location.pathname === '/issue-register' ? 'active' : ''}>
              <FaFileAlt className="nav-icon" />
              {!isCollapsed && <span>Issue Register</span>}
            </Link>

            <Link to="/damaged-entry" className={location.pathname === '/damaged-entry' ? 'active' : ''}>
              <FaExclamationTriangle className="nav-icon" />
              {!isCollapsed && <span>Damaged Entry</span>}
            </Link>
          </>
        )}

        {isAdmin && (
          <Link to="/users" className={location.pathname === '/users' ? 'active' : ''}>
            <FaUsers className="nav-icon" />
            {!isCollapsed && <span>User Management</span>}
          </Link>
        )}
      </nav>

      {/* User Menu */}
      <div className="sidebar-footer">
        <div className="user-menu">
          <button
            className="user-menu-trigger"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <div className="user-avatar">
                {user?.full_name?.[0] || user?.employee_id?.[0] || 'U'}
              </div>
              {!isCollapsed && (
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="user-name">
                    {user?.full_name || user?.employee_id}
                  </div>
                  <div className="user-role">
                    {user?.role === 'admin' ? 'Administrator' :
                      user?.role === 'hod' ? 'Head of Dept.' :
                        user?.role === 'store_keeper' ? 'Store Keeper' : 'Staff'}
                  </div>
                </div>
              )}
              {!isCollapsed && <FaChevronDown size={12} />}
            </div>
          </button>

          {showUserMenu && !isCollapsed && (
            <div className="user-dropdown">
              <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }}>
                <FaCog /> Settings
              </button>
              <button onClick={() => { navigate('/profile'); setShowUserMenu(false); }}>
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
  );
}

export default Sidebar;
