import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaExclamationCircle,
    FaInfoCircle
} from 'react-icons/fa';
import api from '../utils/api';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const [lowStockCount, setLowStockCount] = useState(0);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const notifRef = useRef(null);
    const navigate = useNavigate();

    const fetchNotificationData = useCallback(async () => {
        try {
            const [chemRes, appRes] = await Promise.all([
                api.get('/low_stock_chemicals/').catch(() => ({ data: [] })),
                api.get('/low_stock_apparatus/').catch(() => ({ data: [] })),
            ]);

            const chemData = Array.isArray(chemRes.data) ? chemRes.data : (chemRes.data.results || []);
            const appData = Array.isArray(appRes.data) ? appRes.data : (appRes.data.results || []);

            const combinedItems = [
                ...chemData.map(item => ({
                    id: `chem-${item.id}`,
                    name: item.chemical_name,
                    type: 'Chemical',
                    qty: item.current_quantity_ml,
                    unit: 'ml'
                })),
                ...appData.map(item => ({
                    id: `app-${item.id}`,
                    name: item.apparatus_name,
                    type: 'Apparatus',
                    qty: item.current_quantity_pieces,
                    unit: 'pcs'
                }))
            ];

            setLowStockItems(combinedItems);
            setLowStockCount(combinedItems.length);
        } catch (err) {
            console.error('Error fetching notification data:', err);
        }
    }, []);

    useEffect(() => {
        fetchNotificationData();
        const interval = setInterval(fetchNotificationData, 5000);

        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('inventory-updated', fetchNotificationData);

        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('inventory-updated', fetchNotificationData);
        };
    }, [fetchNotificationData]);

    return (
        <div className="action-item" ref={notifRef}>
            <div
                className={`topbar-action-btn notif-btn ${lowStockCount > 0 ? 'has-alerts' : ''}`}
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title="Notifications"
            >
                <FaBell />
                {lowStockCount > 0 && (
                    <span className="badge">{lowStockCount}</span>
                )}
            </div>

            {showNotifDropdown && (
                <div className="dropdown notif-dropdown animate-fade-in">
                    <div className="dropdown-header">
                        <h3><FaBell /> Notifications</h3>
                        {lowStockCount > 0 && <span className="alert-count">{lowStockCount} Alerts</span>}
                    </div>
                    <div className="dropdown-content">
                        {lowStockItems.length > 0 ? (
                            lowStockItems.map((item) => (
                                <div key={item.id} className="dropdown-row">
                                    <div className="icon-container">
                                        <FaExclamationCircle />
                                    </div>
                                    <div className="row-info">
                                        <p className="row-title">{item.name}</p>
                                        <div className="row-sub">
                                            <span className="type-tag">{item.type}</span>
                                            <span>Stock: <span className="qty-alert">{item.qty} {item.unit}</span></span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <FaInfoCircle />
                                <p>All items are sufficiently stocked</p>
                            </div>
                        )}
                    </div>
                    {lowStockCount > 0 && (
                        <div className="dropdown-footer" onClick={() => { navigate('/inventory'); setShowNotifDropdown(false); }}>
                            View Inventory
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
