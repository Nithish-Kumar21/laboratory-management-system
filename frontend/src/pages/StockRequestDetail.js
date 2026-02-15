import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaIdCard, FaUser, FaGraduationCap, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaClock, FaTrash, FaEdit } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AddRequestModal from '../components/modals/AddRequestModal';
import './StockRequestDetail.css';

function StockRequestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const { isHOD, user } = useAuth();

    useEffect(() => {
        fetchRequest();
    }, [id]);

    const fetchRequest = () => {
        setLoading(true);
        api.get(`/stock_request/${id}/`)
            .then(res => {
                setRequest(res.data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.response?.data?.error || 'Load failed');
                setLoading(false);
            });
    };

    const handleAccept = async () => {
        if (!window.confirm('Are you sure you want to approve this request?')) return;
        try {
            setActionLoading(true);
            await api.post(`/stock_request/${id}/accept/`);
            fetchRequest();
            // Trigger a notification update
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to approve');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!window.confirm('Are you sure you want to reject this request?')) return;
        try {
            setActionLoading(true);
            await api.post(`/stock_request/${id}/reject/`);
            fetchRequest();
            // Trigger a notification update
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reject');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSend = async () => {
        if (!window.confirm('Are you sure you want to submit this request for approval?')) return;
        try {
            setActionLoading(true);
            await api.post(`/stock_request/${id}/submit/`);
            fetchRequest();
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this request permanently?')) return;
        try {
            setActionLoading(true);
            await api.delete(`/stock_request/${id}/`);
            window.dispatchEvent(new CustomEvent('inventory-updated'));
            navigate('/requests');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'accepted':
                return <div className="detail-status status-success"><FaCheckCircle /> Approved</div>;
            case 'rejected':
                return <div className="detail-status status-danger"><FaTimesCircle /> Rejected</div>;
            case 'draft':
                return <div className="detail-status status-draft"><FaClock /> Drafted</div>;
            default:
                return <div className="detail-status status-pending"><FaClock /> Pending</div>;
        }
    };

    if (loading) return <div className="loading-spinner"></div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!request) return null;

    return (
        <div className="request-detail-page animate-up">
            <div className="detail-header">
                <button className="back-button" onClick={() => navigate('/requests')}>
                    <FaArrowLeft />
                </button>
                <div className="header-title-box">
                    <h2>Chemical Request Details</h2>
                    <p><FaIdCard /> {request.request_id}</p>
                </div>
                <div className="header-actions">
                    {(user?.employee_id === request.requested_by_id && ['draft', 'pending', 'rejected'].includes(request.status)) && (
                        <button
                            className="edit-request-btn"
                            onClick={() => setShowEditModal(true)}
                            disabled={actionLoading}
                            title="Edit Request"
                        >
                            <FaEdit /> Edit
                        </button>
                    )}
                    {(user?.employee_id === request.requested_by_id && ['pending', 'draft', 'rejected'].includes(request.status)) && (
                        <button
                            className="delete-request-btn"
                            onClick={handleDelete}
                            disabled={actionLoading}
                            title="Delete Request"
                        >
                            <FaTrash /> {actionLoading ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                </div>
            </div>

            <div className="detail-info-grid">
                <div className="info-card card">
                    <label><FaUser /> Requested By</label>
                    <span>{request.requested_by_name}</span>
                    <small>Emp ID: {request.requested_by_id}</small>
                </div>
                <div className="info-card card">
                    <label><FaGraduationCap /> Class</label>
                    <span>{request.class_name}</span>
                </div>
                <div className="info-card card">
                    <label><FaCalendarAlt /> Date</label>
                    <span>{new Date(request.created_at).toLocaleDateString()}</span>
                </div>
                <div className="info-card card">
                    <label>Status</label>
                    {getStatusBadge(request.status)}
                </div>
            </div>

            <div className="items-section animate-fade">
                <h3><FaFlask /> Requested Chemicals</h3>
                <div className="card no-padding">
                    <table className="detail-table">
                        <thead>
                            <tr>
                                <th>Chemical Name</th>
                                <th>Quantity Requested</th>
                            </tr>
                        </thead>
                        <tbody>
                            {request.chemical_items?.map((it, idx) => (
                                <tr key={idx}>
                                    <td className="item-name">{it.chemical_name}</td>
                                    <td><span className="qty-badge">{it.quantity_ml} ml</span></td>
                                </tr>
                            ))}
                            {(!request.chemical_items || request.chemical_items.length === 0) && (
                                <tr>
                                    <td colSpan="2" className="empty-row text-center">No chemicals listed</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {request.reason && (
                <div className="reason-section card animate-fade">
                    <h3>Purpose / Reason</h3>
                    <p className="reason-text">{request.reason}</p>
                </div>
            )}

            {request.reviewed_by_name && (
                <div className="review-info-section card animate-fade">
                    <label>Reviewed By</label>
                    <p><strong>{request.reviewed_by_name}</strong> on {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : 'N/A'}</p>
                </div>
            )}

            {isHOD && request.status === 'pending' && (
                <div className="approval-actions animate-fade">
                    <button
                        className="btn-reject"
                        onClick={handleReject}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : <><FaTimesCircle /> Reject Request</>}
                    </button>
                    <button
                        className="btn-approve"
                        onClick={handleAccept}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : <><FaCheckCircle /> Approve Request</>}
                    </button>
                </div>
            )}

            {user?.employee_id === request.requested_by_id && request.status === 'draft' && (
                <div className="approval-actions animate-fade">
                    <button
                        className="btn-approve"
                        onClick={handleSend}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit for Approval</>}
                    </button>
                </div>
            )}

            <AddRequestModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={fetchRequest}
                editData={request}
                hasActiveRequest={false} // Since we are editing an existing one, it doesn't block itself
            />
        </div>
    );
}

export default StockRequestDetail;
