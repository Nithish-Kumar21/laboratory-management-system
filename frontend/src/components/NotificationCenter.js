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
import { getStatus } from '../utils/inventory';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const [lowStockCount, setLowStockCount] = useState(0);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [reviewedRequests, setReviewedRequests] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const notifRef = useRef(null);
    const navigate = useNavigate();
    const { isHOD, user, isStaff, isAdmin } = useAuth();
    const showLowStockInNotif = !isStaff && !isAdmin;

    const fetchNotificationData = useCallback(async () => {
        try {
            const requests = [];
            if (showLowStockInNotif) {
                requests.push(api.get('/available_chemicals/').catch(() => ({ data: [] })));
                requests.push(api.get('/available_apparatus/').catch(() => ({ data: [] })));
            }

            if (isHOD) {
                requests.push(api.get('/stock_request/?status=pending').catch(() => ({ data: [] })));
            } else if (user?.role === 'staff') {
                requests.push(api.get('/stock_request/reviewed/').catch(() => ({ data: [] })));
            }

            const results = await Promise.all(requests);
            let chemData = [];
            let appData = [];
            let pendingData = [];
            let reviewedData = [];

            if (showLowStockInNotif && results.length >= 2) {
                chemData = Array.isArray(results[0].data) ? results[0].data : (results[0].data?.results || []);
                appData = Array.isArray(results[1].data) ? results[1].data : (results[1].data?.results || []);
                if (isHOD && results[2]) {
                    pendingData = Array.isArray(results[2].data) ? results[2].data : (results[2].data?.results || []);
                } else if (user?.role === 'staff' && results[2]) {
                    reviewedData = Array.isArray(results[2].data) ? results[2].data : (results[2].data?.results || []);
                }
            } else if (isHOD && results[0]) {
                pendingData = Array.isArray(results[0].data) ? results[0].data : (results[0].data?.results || []);
            } else if (user?.role === 'staff' && results[0]) {
                reviewedData = Array.isArray(results[0].data) ? results[0].data : (results[0].data?.results || []);
            }

            let combinedLowStock = [];
            if (showLowStockInNotif) {
                const lowChem = chemData.filter(c => {
                    const qty = parseFloat(c.quantity);
                    const reorder = parseFloat(c.reorder_level || 0);
                    return getStatus(qty, reorder) !== 'healthy';
                }).map(item => ({
                    id: `chem-${item.id}`,
                    name: item.chemical_name,
                    type: 'Low Stock: Chemical',
                    qty: item.quantity,
                    unit: item.unit || 'ml',
                    isAlert: true
                }));
                const lowApp = appData.filter(a => {
                    const qty = parseFloat(a.available_quantity_pieces);
                    const reorder = parseFloat(a.reorder_level || 0);
                    return getStatus(qty, reorder) !== 'healthy';
                }).map(item => ({
                    id: `app-${item.id}`,
                    name: item.apparatus_name,
                    type: 'Low Stock: Apparatus',
                    qty: item.available_quantity_pieces,
                    unit: 'pcs',
                    isAlert: true
                }));
                combinedLowStock = [...lowChem, ...lowApp];
            }

            setLowStockItems(combinedLowStock);
            setLowStockCount(combinedLowStock.length);
            setPendingRequests(pendingData);
            setReviewedRequests(reviewedData);
        } catch (err) {
            console.error('Error fetching notification data:', err);
        }
    }, [isHOD, user, showLowStockInNotif]);

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

    const totalCount = (showLowStockInNotif ? lowStockCount : 0) + pendingRequests.length + reviewedRequests.length;

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

                        {showLowStockInNotif && lowStockItems.length > 0 && (
                            <>
                                <div className="dropdown-section-title">Low Stock Alerts</div>
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
                            </>
                        )}

                        {totalCount === 0 && (
                            <div className="empty-state">
                                <FaInfoCircle />
                                <p>No new notifications</p>
                            </div>
                        )}
                    </div>
                    {(pendingRequests.length > 0 || (showLowStockInNotif && lowStockItems.length > 0) || reviewedRequests.length > 0) && (
                        <div className="dropdown-footer" onClick={() => {
                            if (pendingRequests.length > 0) navigate('/requests?status=pending');
                            else if (showLowStockInNotif && lowStockItems.length > 0) navigate('/inventory');
                            else navigate('/requests');
                            setShowNotifDropdown(false);
                        }}>
                            {pendingRequests.length > 0 ? 'View All Requests' : (showLowStockInNotif && lowStockItems.length > 0 ? 'View Inventory' : 'View Requests')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
