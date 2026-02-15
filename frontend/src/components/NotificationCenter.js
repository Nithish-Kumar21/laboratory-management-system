import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaExclamationCircle,
    FaInfoCircle,
    FaFlask
} from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const [lowStockCount, setLowStockCount] = useState(0);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [reviewedRequests, setReviewedRequests] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const notifRef = useRef(null);
    const navigate = useNavigate();
    const { isHOD, user } = useAuth();

    const fetchNotificationData = useCallback(async () => {
        try {
            const requests = [
                api.get('/low_stock_chemicals/').catch(() => ({ data: [] })),
                api.get('/low_stock_apparatus/').catch(() => ({ data: [] })),
            ];

            if (isHOD) {
                // Fetch full pending requests list instead of just count
                requests.push(api.get('/stock_request/?status=pending').catch(() => ({ data: [] })));
            } else if (user?.role === 'staff') {
                // Fetch reviewed requests for staff
                requests.push(api.get('/stock_request/reviewed/').catch(() => ({ data: [] })));
            }

            const results = await Promise.all(requests);
            const chemRes = results[0];
            const appRes = results[1];
            const thirdRes = results[2];

            const chemData = Array.isArray(chemRes.data) ? chemRes.data : (chemRes.data.results || []);
            const appData = Array.isArray(appRes.data) ? appRes.data : (appRes.data.results || []);

            let pendingData = [];
            let reviewedData = [];

            if (isHOD && thirdRes) {
                pendingData = Array.isArray(thirdRes.data) ? thirdRes.data : (thirdRes.data.results || []);
            } else if (user?.role === 'staff' && thirdRes) {
                reviewedData = Array.isArray(thirdRes.data) ? thirdRes.data : (thirdRes.data.results || []);
            }

            const combinedLowStock = [
                ...chemData.map(item => ({
                    id: `chem-${item.id}`,
                    name: item.chemical_name,
                    type: 'Low Stock: Chemical',
                    qty: item.current_quantity_ml,
                    unit: 'ml',
                    isAlert: true
                })),
                ...appData.map(item => ({
                    id: `app-${item.id}`,
                    name: item.apparatus_name,
                    type: 'Low Stock: Apparatus',
                    qty: item.current_quantity_pieces,
                    unit: 'pcs',
                    isAlert: true
                }))
            ];

            setLowStockItems(combinedLowStock);
            setLowStockCount(combinedLowStock.length);
            setPendingRequests(pendingData);
            setReviewedRequests(reviewedData);
        } catch (err) {
            console.error('Error fetching notification data:', err);
        }
    }, [isHOD, user]);

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

    const totalCount = lowStockCount + pendingRequests.length + reviewedRequests.length;

    return (
        <div className="action-item" ref={notifRef}>
            <div
                className={`topbar-action-btn notif-btn ${totalCount > 0 ? 'has-alerts' : ''}`}
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title="Notifications"
            >
                <FaBell />
                {totalCount > 0 && (
                    <span className="badge">{totalCount}</span>
                )}
            </div>

            {showNotifDropdown && (
                <div className="dropdown notif-dropdown animate-fade-in">
                    <div className="dropdown-header">
                        <h3><FaBell /> Notifications</h3>
                        {totalCount > 0 && <span className="alert-count">{totalCount} Alerts</span>}
                    </div>
                    <div className="dropdown-content">
                        {pendingRequests.length > 0 && (
                            <div className="dropdown-section-title">Pending Requests</div>
                        )}
                        {pendingRequests.map(req => (
                            <div
                                key={`req-${req.id}`}
                                className="dropdown-row pending-request-row"
                                onClick={() => { navigate(`/requests/${req.id}`); setShowNotifDropdown(false); }}
                            >
                                <div className="icon-container request-icon">
                                    <FaFlask />
                                </div>
                                <div className="row-info">
                                    <p className="row-title">{req.request_id}</p>
                                    <div className="row-sub">
                                        <span className="type-tag tag-pending">By {req.requested_by_name}</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {reviewedRequests.length > 0 && (
                            <div className="dropdown-section-title">Request Updates</div>
                        )}
                        {reviewedRequests.map(req => (
                            <div
                                key={`reviewed-${req.id}`}
                                className="dropdown-row reviewed-request-row"
                                onClick={() => { navigate(`/requests/${req.id}`); setShowNotifDropdown(false); }}
                            >
                                <div className={`icon-container ${req.status === 'accepted' ? 'approved-icon' : 'rejected-icon'}`}>
                                    <FaFlask />
                                </div>
                                <div className="row-info">
                                    <p className="row-title">{req.request_id}</p>
                                    <div className="row-sub">
                                        <span className={`type-tag ${req.status === 'accepted' ? 'tag-approved' : 'tag-rejected'}`}>
                                            {req.status === 'accepted' ? 'Approved' : 'Rejected'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {lowStockItems.length > 0 && (
                            <div className="dropdown-section-title">Low Stock Alerts</div>
                        )}
                        {lowStockItems.map((item) => (
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
                        ))}

                        {totalCount === 0 && (
                            <div className="empty-state">
                                <FaInfoCircle />
                                <p>No new notifications</p>
                            </div>
                        )}
                    </div>
                    {totalCount > 0 && (
                        <div className="dropdown-footer" onClick={() => {
                            if (pendingRequests.length > 0) navigate('/requests?status=pending');
                            else navigate('/inventory');
                            setShowNotifDropdown(false);
                        }}>
                            {pendingRequests.length > 0 ? 'View All Requests' : 'View Inventory'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
