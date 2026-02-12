import React, { useEffect, useState } from 'react';
import { FaFlask, FaBoxes, FaClipboardList, FaExclamationTriangle, FaHome, FaClock, FaWarehouse, FaPlusCircle, FaFileInvoice, FaChartLine } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../utils/api';
import './Home.css';
import './VintageClock.css';

function Home() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        chemicals: 0,
        apparatus: 0,
        stockEntries: 0,
        damagedEntries: 0
    });
    const [lowStockItems, setLowStockItems] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchStats = async () => {
        try {
            const [chemRes, appRes, stockRes, damagedRes] = await Promise.all([
                api.get('/chemicals/').catch(() => ({ data: [] })),
                api.get('/apparatus/').catch(() => ({ data: [] })),
                api.get('/stock_register/').catch(() => ({ data: [] })),
                api.get('/damaged_entry/').catch(() => ({ data: [] })),
            ]);

            // Helper function to extract count from various response formats
            const getCount = (response) => {
                if (!response.data) return 0;
                // If it's a paginated response with count field
                if (typeof response.data.count === 'number') return response.data.count;
                // If it's a paginated response with results array
                if (Array.isArray(response.data.results)) return response.data.results.length;
                // If it's a direct array
                if (Array.isArray(response.data)) return response.data.length;
                return 0;
            };

            setStats({
                chemicals: getCount(chemRes),
                apparatus: getCount(appRes),
                stockEntries: getCount(stockRes),
                damagedEntries: getCount(damagedRes)
            });

            console.log('Dashboard Stats:', {
                chemicals: getCount(chemRes),
                apparatus: getCount(appRes),
                stockEntries: getCount(stockRes),
                damagedEntries: getCount(damagedRes)
            });
        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
        }
    };

    const fetchLowStockItems = async () => {
        try {
            const [chemRes, appRes] = await Promise.all([
                api.get('/low_stock_chemicals/').catch(() => ({ data: [] })),
                api.get('/low_stock_apparatus/').catch(() => ({ data: [] })),
            ]);

            const chemData = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
            const appData = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];

            const combined = [
                ...chemData.map(item => ({ ...item, type: 'Chemical', icon: FaFlask })),
                ...appData.map(item => ({ ...item, type: 'Apparatus', icon: FaBoxes }))
            ].slice(0, 5); // Get top 5 low stock items

            setLowStockItems(combined);
        } catch (err) {
            console.error('Error fetching low stock:', err);
        }
    };

    const fetchRecentActivity = async () => {
        try {
            const [stockRes, damagedRes] = await Promise.all([
                api.get('/stock_register/').catch(() => ({ data: [] })),
                api.get('/damaged_entry/').catch(() => ({ data: [] })),
            ]);

            const stockData = Array.isArray(stockRes.data) ? stockRes.data : stockRes.data.results || [];
            const damagedData = Array.isArray(damagedRes.data) ? damagedRes.data : damagedRes.data.results || [];

            const activities = [
                ...stockData.map(item => ({
                    id: item.id,
                    type: 'stock',
                    title: `Stock Entry #${item.invoice_number}`,
                    date: item.date,
                    icon: FaClipboardList,
                    color: 'var(--dept-stock)'
                })),
                ...damagedData.map(item => ({
                    id: item.id,
                    type: 'damaged',
                    title: `Damage Report #${item.id}`,
                    date: item.date_reported,
                    icon: FaExclamationTriangle,
                    color: 'var(--dept-damaged)'
                }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

            setRecentActivity(activities);
        } catch (err) {
            console.error('Error fetching recent activity:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchLowStockItems();
        fetchRecentActivity();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchStats();
            fetchLowStockItems();
            fetchRecentActivity();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const cards = [
        { label: 'Stock Entries', count: stats.stockEntries, icon: FaClipboardList, color: 'var(--dept-stock)', link: '/stock-register' },
        { label: 'Damaged Items', count: stats.damagedEntries, icon: FaExclamationTriangle, color: 'var(--dept-damaged)', link: '/damaged-entry' },
    ];

    const quickActions = [
        { label: 'View Inventory', icon: FaWarehouse, color: 'var(--dept-inventory)', action: () => navigate('/inventory') },
        { label: 'Stock Register', icon: FaFileInvoice, color: 'var(--dept-stock)', action: () => navigate('/stock-register') },
        { label: 'Issue Register', icon: FaChartLine, color: 'var(--dept-issue)', action: () => navigate('/issue-register') },
    ];

    const systemHealth = {
        percentage: stats.damagedEntries === 0 ? 100 : Math.max(80, 100 - (stats.damagedEntries * 2)),
        status: stats.damagedEntries === 0 ? 'Excellent' : stats.damagedEntries < 5 ? 'Good' : 'Attention Needed',
        color: stats.damagedEntries === 0 ? 'var(--dept-inventory)' : stats.damagedEntries < 5 ? '#f59e0b' : 'var(--dept-damaged)'
    };

    return (
        <div className="home-page dept-dashboard animate-up">
            <div className="page-header header-with-dept">
                <div className="dept-title-container">
                    <div className="dept-details">
                        <span className="dept-tag">Department of Chemistry</span>
                        <h1 className="dept-main-title">B.Sc. CHEMISTRY</h1>
                    </div>
                </div>
                <div className="status-badge-container home-clock-box">
                    <div className="vintage-clock">
                        <div className="clock-face">
                            <div className="clock-center"></div>
                            <div className="hour-hand" style={{ transform: `rotate(${(currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5}deg)` }}></div>
                            <div className="minute-hand" style={{ transform: `rotate(${currentTime.getMinutes() * 6}deg)` }}></div>
                            <div className="second-hand" style={{ transform: `rotate(${currentTime.getSeconds() * 6}deg)` }}></div>
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="hour-marker" style={{ transform: `rotate(${i * 30}deg)`, '--rotation': `${i * 30}deg` }}>
                                    <span className="hour-number">{i === 0 ? 12 : i}</span>
                                </div>
                            ))}
                        </div>
                        <div className="clock-label">
                            <span className="date-vintage">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>
                </div>
            </div>


            <div className="dashboard-grid">
                {cards.map((card, idx) => (
                    <Link to={card.link} key={idx} className="stat-card card animate-fade" style={{ '--card-color': card.color }}>
                        <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}>
                            <card.icon />
                        </div>
                        <div className="stat-content">
                            <h3>{card.count}</h3>
                            <p>{card.label}</p>
                        </div>
                    </Link>
                ))}
            </div>



            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
                <div className="low-stock-section card animate-fade">
                    <div className="section-title-bar">
                        <h3>⚠️ Low Stock Alerts</h3>
                        <Link to="/inventory" className="view-all-link">View All</Link>
                    </div>
                    <div className="low-stock-list">
                        {lowStockItems.map((item, idx) => (
                            <div key={idx} className="low-stock-item">
                                <div className="stock-item-icon" style={{ color: 'var(--dept-damaged)' }}>
                                    <item.icon />
                                </div>
                                <div className="stock-item-info">
                                    <span className="stock-item-name">{item.chemical_name || item.apparatus_name}</span>
                                    <span className="stock-item-type">{item.type}</span>
                                </div>
                                <div className="stock-item-quantity">
                                    <span className="quantity-value">{item.quantity_ml || item.quantity_pieces}</span>
                                    <span className="quantity-unit">{item.quantity_ml ? 'ML' : 'PCS'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

export default Home;
