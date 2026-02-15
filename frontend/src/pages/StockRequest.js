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
} from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AddRequestModal from '../components/modals/AddRequestModal';
import './StockRequest.css';
import '../styles/App.css';

const StockRequest = ({ draftsOnly = false }) => {
    const { isStaff, isHOD } = useAuth();
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(draftsOnly ? 'draft' : (isHOD ? 'pending' : 'all'));

    useEffect(() => {
        fetchRequests();
    }, [statusFilter, draftsOnly]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            let url = '/stock_request/';
            const params = new URLSearchParams();

            if (draftsOnly) {
                params.append('status', 'draft');
            } else if (statusFilter !== 'all') {
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
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <FaPlus /> New Request
                    </button>
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
                        <option value="rejected">Rejected</option>
                    </select>
                )}
            </div>

            <div className="stock-list-grid">
                {loading ? (
                    <div className="loading-spinner"></div>
                ) : filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => (
                        <div key={req.id} className="stock-card card animate-fade">
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
                                                    req.status === 'draft' ? 'Drafted' : 'Rejected'}
                                        </span>
                                    </div>
                                    <p className="supplier">{req.requested_by_name} • {req.class_name}</p>
                                </div>
                                <div className="stock-card-details">
                                    <span className="date">
                                        <FaCalendarAlt /> {new Date(req.created_at).toLocaleDateString()}
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
            />
        </div>
    );
};

export default StockRequest;
