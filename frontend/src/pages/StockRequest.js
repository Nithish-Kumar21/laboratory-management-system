import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaPlus,
    FaSearch,
    FaFilter,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaCalendarAlt,
    FaUser,
    FaGraduationCap,
    FaIdCard,
    FaFileInvoice,
    FaChevronRight,
    FaClipboardList,
    FaExclamationTriangle,
} from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AddRequestModal from '../components/modals/AddRequestModal';
import './StockRequest.css';
import '../styles/App.css';

const StockRequest = ({ draftsOnly = false }) => {
    const { isStaff, isHOD, isStoreKeeper } = useAuth();
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(
        draftsOnly ? 'draft' : (isHOD ? 'pending' : (isStoreKeeper ? 'accepted' : 'all'))
    );
    const [hasActiveRequest, setHasActiveRequest] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [statusFilter, draftsOnly]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            let url = 'stock_request/';
            const params = new URLSearchParams();

            if (draftsOnly) {
                params.append('status', 'draft');
            } else {
                params.append('status', statusFilter);
            }

            const queryString = params.toString();
            const response = await api.get(url + (queryString ? `?${queryString}` : ''));

            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data.results && Array.isArray(response.data.results)) {
                data = response.data.results;
            }

            // Calculate if any request is "active" (not completed and not rejected)
            // Note: We use the full list for this check, but fetchRequests might be filtered.
            // However, the backend for staff already returns all their requests.
            // If the current view is status-filtered, we might miss the active one if it's not in the filter.
            // So we should ideally fetch ALL once or check the data if statusFilter is 'all'.
            // Actually, let's just use the current data if statusFilter is 'all', 
            // but for reliability, if we are staff, we should check specifically.
            if (isStaff) {
                const active = data.some(r => r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'draft');
                // If the view is filtered, we might not see the active one.
                // But the user usually stays on "All Status".
                // To be safe, we can do a quick check if statusFilter is NOT 'all'
                if (statusFilter !== 'all' && !active) {
                    const allRes = await api.get('stock_request/');
                    const allData = Array.isArray(allRes.data) ? allRes.data : allRes.data.results || [];
                    setHasActiveRequest(allData.some(r => r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'draft'));
                } else {
                    setHasActiveRequest(active);
                }
            }

            // Strict Enforcement: If not in draftsOnly mode, ALWAYS filter out drafts
            if (!draftsOnly) {
                data = data.filter(r => r.status !== 'draft');
            } else {
                // If in draftsOnly mode, ONLY allow drafts
                data = data.filter(r => r.status === 'draft');
            }

            setRequests(data);
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestSuccess = () => {
        fetchRequests();
        setShowModal(false);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'accepted':
                return <span className="status-badge-modern status-success"><FaCheckCircle /> Approved</span>;
            case 'issued':
                return <span className="status-badge-modern status-issued"><FaCheckCircle /> Issued</span>;
            case 'reported':
                return <span className="status-badge-modern status-reported"><FaClipboardList /> Reported</span>;
            case 'completed':
                return <span className="status-badge-modern status-completed"><FaCheckCircle /> Completed</span>;
            case 'rejected':
                return <span className="status-badge-modern status-danger"><FaTimesCircle /> Rejected</span>;
            default:
                return <span className="status-badge-modern status-requested"><FaClock /> Requested</span>;
        }
    };

    const filteredRequests = requests.filter(req => {
        const searchLower = searchTerm.toLowerCase();
        return (
            req.reason?.toLowerCase().includes(searchLower) ||
            req.requested_by_name?.toLowerCase().includes(searchLower) ||
            req.request_id?.toLowerCase().includes(searchLower) ||
            req.class_name?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="stock-register-page chemical-requests animate-up">
            <div className="page-header">
                <div className="dept-title-container">
                    <div className="dept-icon-box" style={{ color: 'var(--dept-stock)' }}>
                        <FaFileInvoice />
                    </div>
                    <div>
                        <h1 className="page-title">{draftsOnly ? 'My Drafts' : 'Chemical Requests'}</h1>
                        <p className="page-subtitle">
                            {draftsOnly
                                ? 'Manage your saved chemical request drafts.'
                                : 'Unified log of all laboratory chemical requisitions.'}
                        </p>
                    </div>
                </div>
                {isStaff && !draftsOnly && (
                    <div className="header-actions">
                        {hasActiveRequest && (
                            <span className="active-request-warning">
                                <FaExclamationTriangle /> You have an active request. New forms must be saved as drafts.
                            </span>
                        )}
                        <button
                            className="btn-primary"
                            onClick={() => setShowModal(true)}
                        >
                            <FaPlus /> New Request
                        </button>
                    </div>
                )}
            </div>

            <div className="search-bar-container card">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by ID, Reason, or Staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
                {!draftsOnly && (
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="status-filter-select"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Requested</option>
                        <option value="accepted">Approved</option>
                        <option value="issued">Issued</option>
                        <option value="reported">Reported</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                    </select>
                )}
            </div>

            <div className="stock-list-grid">
                {loading ? (
                    <div className="loading-spinner"></div>
                ) : filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => (
                        <div
                            key={req.id}
                            className="stock-card card animate-fade"
                            onClick={() => navigate(`/requests/${req.id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="stock-card-icon">
                                <FaFileInvoice />
                            </div>
                            <div className="stock-card-content">
                                <div className="stock-card-main-info">
                                    <div className="id-status-row">
                                        <h3>{req.request_id}</h3>
                                        <span className={`status-badge-compact ${req.status}`}>
                                            {req.status === 'pending' ? 'Requested' :
                                                req.status === 'accepted' ? 'Approved' :
                                                    req.status === 'issued' ? 'Issued' :
                                                        req.status === 'reported' ? 'Reported' :
                                                            req.status === 'completed' ? 'Completed' :
                                                                req.status === 'draft' ? 'Drafted' : 'Rejected'}
                                        </span>
                                    </div>
                                    <p className="supplier">{req.requested_by_name} • {req.class_name}</p>
                                </div>
                                <div className="stock-card-details">
                                    <span className="date">
                                        <FaCalendarAlt /> {req.date ? new Date(req.date).toLocaleDateString() : new Date(req.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="items-count">
                                        {req.chemical_items?.length || 0} Items
                                    </span>
                                </div>
                            </div>
                            <div className="stock-card-actions">
                                <button
                                    className="btn-view"
                                    onClick={() => navigate(`/requests/${req.id}`)}
                                >
                                    View Details <FaChevronRight />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <p>No {draftsOnly ? 'drafts' : 'requests'} found.</p>
                    </div>
                )}
            </div>

            <AddRequestModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={handleRequestSuccess}
                hasActiveRequest={hasActiveRequest}
            />
        </div>
    );
};

export default StockRequest;
