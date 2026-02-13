import React, { useState, useEffect } from 'react';
import {
    FaPlus,
    FaSearch,
    FaFilter,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaFlask, // Chemical icon
    FaTools, // Apparatus icon
    FaTrash,
    FaCalendarAlt,
    FaUser,
} from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import '../styles/App.css';

const StockRequest = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Form State
    const [reason, setReason] = useState('');
    const [chemicalItems, setChemicalItems] = useState([]);
    const [apparatusItems, setApparatusItems] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const { isStaff, user } = useAuth();

    useEffect(() => {
        fetchRequests();
    }, [statusFilter]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            let url = '/stock_request/';
            if (statusFilter !== 'all') {
                url += `?status=${statusFilter}`;
            }
            const response = await api.get(url);

            // Handle pagination
            if (Array.isArray(response.data)) {
                setRequests(response.data);
            } else if (response.data.results && Array.isArray(response.data.results)) {
                setRequests(response.data.results);
            } else {
                setRequests([]);
            }
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddChemical = () => {
        setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '' }]);
    };

    const handleRemoveChemical = (index) => {
        const list = [...chemicalItems];
        list.splice(index, 1);
        setChemicalItems(list);
    };

    const handleChemicalChange = (index, field, value) => {
        const list = [...chemicalItems];
        list[index][field] = value;
        setChemicalItems(list);
    };

    const handleAddApparatus = () => {
        setApparatusItems([...apparatusItems, { apparatus_name: '', quantity_pieces: '' }]);
    };

    const handleRemoveApparatus = (index) => {
        const list = [...apparatusItems];
        list.splice(index, 1);
        setApparatusItems(list);
    };

    const handleApparatusChange = (index, field, value) => {
        const list = [...apparatusItems];
        list[index][field] = value;
        setApparatusItems(list);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (chemicalItems.length === 0 && apparatusItems.length === 0) {
            setError('Please add at least one chemical or apparatus.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload = {
                reason,
                chemical_items: chemicalItems.filter(i => i.chemical_name && i.quantity_ml),
                apparatus_items: apparatusItems.filter(i => i.apparatus_name && i.quantity_pieces),
            };

            await api.post('/stock_request/', payload);

            // Reset form
            setReason('');
            setChemicalItems([]);
            setApparatusItems([]);
            setShowModal(false);
            fetchRequests();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'accepted':
                return <span className="status-badge-modern status-success"><FaCheckCircle /> Approved</span>;
            case 'rejected':
                return <span className="status-badge-modern status-danger"><FaTimesCircle /> Rejected</span>;
            default:
                return <span className="status-badge-modern status-warning"><FaClock /> Pending</span>;
        }
    };

    const filteredRequests = requests.filter(req => {
        const searchLower = searchTerm.toLowerCase();
        return (
            req.reason?.toLowerCase().includes(searchLower) ||
            req.requested_by_name?.toLowerCase().includes(searchLower) ||
            req.id.toString().includes(searchLower)
        );
    });

    return (
        <div className="modern-page-container">
            {/* Header Section */}
            <div className="modern-header">
                <div>
                    <h1 className="modern-title">Stock Requests</h1>
                    <p className="modern-subtitle">Manage laboratory resource requests efficiently</p>
                </div>
                <button className="primary-btn-modern" onClick={() => setShowModal(true)}>
                    <FaPlus /> New Request
                </button>
            </div>

            {/* Filters */}
            <div className="filter-bar-modern">
                <div className="search-box-modern">
                    <FaSearch className="search-icon-modern" />
                    <input
                        type="text"
                        placeholder="Search by ID, Reason, or Requester..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="select-box-modern">
                    <FaFilter className="filter-icon-modern" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="accepted">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Request Cards Grid */}
            <div className="cards-grid">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading requests...</p>
                    </div>
                ) : filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => (
                        <div key={req.id} className="request-card">
                            <div className="card-header">
                                <div className="request-id">#{req.id}</div>
                                <div className="request-date">
                                    <FaCalendarAlt /> {new Date(req.created_at).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="card-status">
                                {getStatusBadge(req.status)}
                            </div>

                            <div className="card-body">
                                <div className="requester-info">
                                    <FaUser className="user-icon" />
                                    <div>
                                        <span className="user-name">{req.requested_by_name}</span>
                                        <span className="user-role">{req.requested_by_id}</span>
                                    </div>
                                </div>

                                <div className="items-section">
                                    <h4>Items Requested</h4>
                                    <div className="items-list">
                                        {req.chemical_items.map((item, idx) => (
                                            <div key={`chem-${idx}`} className="item-badge chemical">
                                                <FaFlask /> {item.chemical_name} <span className="qty">{item.quantity_ml}ml</span>
                                            </div>
                                        ))}
                                        {req.apparatus_items.map((item, idx) => (
                                            <div key={`app-${idx}`} className="item-badge apparatus">
                                                <FaTools /> {item.apparatus_name} <span className="qty">{item.quantity_pieces}pcs</span>
                                            </div>
                                        ))}
                                        {req.chemical_items.length === 0 && req.apparatus_items.length === 0 && (
                                            <span className="no-items">No items listed</span>
                                        )}
                                    </div>
                                </div>

                                <div className="reason-section">
                                    <h4>Purpose</h4>
                                    <p>{req.reason}</p>
                                </div>
                            </div>

                            {req.reviewed_by_name && (
                                <div className="card-footer">
                                    <small>Reviewed by: <strong>{req.reviewed_by_name}</strong></small>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <h3>No Requests Found</h3>
                        <p>Try adjusting your search or create a new request.</p>
                    </div>
                )}
            </div>

            {/* Modern Modal */}
            {showModal && (
                <div className="modal-overlay-modern">
                    <div className="modal-content-modern">
                        <div className="modal-header-modern">
                            <h2>New Stock Request</h2>
                            <button className="close-btn-modern" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form-modern">
                            <div className="modal-body-scroll">
                                {error && <div className="error-alert">{error}</div>}

                                <div className="form-section-modern">
                                    <div className="section-title">
                                        <FaFlask className="section-icon chem" />
                                        <h3>Chemicals</h3>
                                    </div>
                                    <div className="items-container">
                                        {chemicalItems.map((item, index) => (
                                            <div key={index} className="item-input-group">
                                                <input
                                                    type="text"
                                                    className="input-modern name"
                                                    placeholder="Chemical Name"
                                                    value={item.chemical_name}
                                                    onChange={(e) => handleChemicalChange(index, 'chemical_name', e.target.value)}
                                                    required
                                                />
                                                <input
                                                    type="number"
                                                    className="input-modern qty"
                                                    placeholder="ml"
                                                    value={item.quantity_ml}
                                                    onChange={(e) => handleChemicalChange(index, 'quantity_ml', e.target.value)}
                                                    required
                                                    step="0.01"
                                                />
                                                <button type="button" className="delete-btn" onClick={() => handleRemoveChemical(index)}>
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" className="add-link-btn" onClick={handleAddChemical}>
                                            <FaPlus /> Add Chemical
                                        </button>
                                    </div>
                                </div>

                                <div className="form-section-modern">
                                    <div className="section-title">
                                        <FaTools className="section-icon app" />
                                        <h3>Apparatus</h3>
                                    </div>
                                    <div className="items-container">
                                        {apparatusItems.map((item, index) => (
                                            <div key={index} className="item-input-group">
                                                <input
                                                    type="text"
                                                    className="input-modern name"
                                                    placeholder="Apparatus Name"
                                                    value={item.apparatus_name}
                                                    onChange={(e) => handleApparatusChange(index, 'apparatus_name', e.target.value)}
                                                    required
                                                />
                                                <input
                                                    type="number"
                                                    className="input-modern qty"
                                                    placeholder="pcs"
                                                    value={item.quantity_pieces}
                                                    onChange={(e) => handleApparatusChange(index, 'quantity_pieces', e.target.value)}
                                                    required
                                                />
                                                <button type="button" className="delete-btn" onClick={() => handleRemoveApparatus(index)}>
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" className="add-link-btn" onClick={handleAddApparatus}>
                                            <FaPlus /> Add Apparatus
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group-modern">
                                    <label>Reason / Purpose</label>
                                    <textarea
                                        className="textarea-modern"
                                        rows="3"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Detailed reason for this request..."
                                        required
                                    ></textarea>
                                </div>
                            </div>
                            <div className="modal-footer-modern">
                                <button type="button" className="btn-text" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Creating...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockRequest;
