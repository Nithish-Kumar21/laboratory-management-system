import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    FaBoxes,
    FaClipboardList,
    FaExclamationTriangle,
    FaFileAlt,
    FaHome,
    FaUsers,
    FaFlask,
    FaBars,
    FaTimes
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from '../components/NotificationCenter';
import './Navbar.css';

const Navbar = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const location = useLocation();
    const { isAdmin, isStaff } = useAuth();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const menuItems = [
        { path: '/', label: 'Dashboard', icon: FaHome, show: true },
        { path: '/inventory', label: 'Inventory', icon: FaBoxes, show: true },
        { path: '/stock-register', label: 'Stock Register', icon: FaClipboardList, show: !isStaff },
        { path: '/issue-register', label: 'Issue Register', icon: FaFileAlt, show: !isStaff },
        { path: '/damaged-entry', label: 'Damaged Entry', icon: FaExclamationTriangle, show: !isStaff },
        { path: '/users', label: 'Users', icon: FaUsers, show: isAdmin },
    ];

    const activeItem = menuItems.find(item => item.path === location.pathname) || menuItems[0];

    return (
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
            <div className="navbar-container">
                <div className="navbar-left">
                    <Link to="/" className="navbar-logo-link">
                        <div className="navbar-logo">
                            <FaFlask />
                        </div>
                        <span className="navbar-title">LabManager</span>
                    </Link>
                </div>

                <div className={`navbar-center ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                    {menuItems.filter(item => item.show).map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <item.icon className="nav-icon" />
                            <span className="nav-text">{item.label}</span>
                        </Link>
                    ))}
                </div>

                <div className="navbar-right">
                    <NotificationCenter />
                    <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
