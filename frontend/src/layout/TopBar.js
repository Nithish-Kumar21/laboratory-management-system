import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FaFlask,
    FaBars,
    FaSun,
    FaMoon,
    FaDesktop,
    FaCog
} from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from '../components/NotificationCenter';
import './TopBar.css';

const TopBar = ({ onToggleSidebar, isSidebarOpen }) => {
    const { themeMode, toggleTheme } = useTheme();
    const { user } = useAuth();
    const navigate = useNavigate();

    const getThemeIcon = () => {
        if (themeMode === 'light') return <FaSun />;
        if (themeMode === 'dark') return <FaMoon />;
        return <FaDesktop />;
    };

    return (
        <nav className="topbar">
            <div className={`topbar-left ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <button className="sidebar-toggle-btn" onClick={onToggleSidebar} title="Toggle Sidebar">
                    <FaBars />
                </button>
                <Link to="/" className="topbar-logo-link">
                    <div className="topbar-logo">
                        <FaFlask />
                    </div>
                    <span className="topbar-title">Laboratory Management System</span>
                </Link>
            </div>

            {/* Search has been removed from TopBar center per user request */}

            <div className="topbar-right">
                <div className="action-group">
                    <button className="topbar-action-btn" onClick={toggleTheme} title={`Theme: ${themeMode}`}>
                        {getThemeIcon()}
                    </button>

                    <button className="topbar-action-btn" onClick={() => navigate('/settings')} title="Settings">
                        <FaCog />
                    </button>

                    <NotificationCenter />
                </div>

                <div className="user-profile-section" onClick={() => navigate('/profile')}>
                    <div className="user-text">
                        <span className="user-name">{user?.full_name || user?.username}</span>
                        <span className="user-role">{user?.role?.replace(/_/g, ' ') || 'Staff'}</span>
                    </div>
                    <div className="user-avatar">
                        {user?.full_name?.[0] || user?.username?.[0] || 'U'}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default TopBar;
