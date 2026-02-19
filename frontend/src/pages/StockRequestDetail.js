import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaFlask, FaIdCard, FaUser, FaGraduationCap, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaClock, FaTrash, FaEdit, FaClipboardList } from 'react-icons/fa';
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
    const [hasActiveRequest, setHasActiveRequest] = useState(false);

    // Usage Reporting State
    const [usageReport, setUsageReport] = useState({});

    const { isHOD, isStoreKeeper, user, isStaff } = useAuth();

    useEffect(() => {
        fetchRequest();
        if (isStaff) {
            checkActiveRequests();
        }
    }, [id]);

    const checkActiveRequests = async () => {
        try {
            const res = await api.get('/stock_request/');
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            // Active = any request that is NOT completed, NOT rejected, NOT draft, and NOT the current one (if current is not draft)
            // But here we only care if they have ANY other active request that would block submitting this draft.
            setHasActiveRequest(data.some(r => r.id !== parseInt(id) && r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'draft'));
        } catch (err) {
            console.error('Error checking active requests:', err);
        }
    };

    const fetchRequest = () => {
        setLoading(true);
        api.get(`stock_request/${id}/`)
            .then(res => {
                setRequest(res.data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.response?.data?.error || 'Load failed');
                setLoading(false);
            });
    };

    // Initialize usage report state when request loads
    useEffect(() => {
        if (request && request.status === 'issued' && request.chemical_items) {
            const initialReport = {};
            request.chemical_items.forEach(item => {
                initialReport[item.id] = item.quantity_ml; // Default to requested qty
            });
            setUsageReport(initialReport);
        }
    }, [request]);

    const handleAccept = async () => {
        if (!window.confirm('Are you sure you want to approve this request?')) return;
        try {
            setActionLoading(true);
            await api.post(`stock_request/${id}/accept/`);
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
            await api.post(`stock_request/${id}/reject/`);
            fetchRequest();
            // Trigger a notification update
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reject');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkAsIssued = async () => {
        if (!window.confirm('Are you sure you want to mark this request as issued? This will update the inventory.')) return;
        try {
            setActionLoading(true);
            await api.post(`stock_request/${id}/mark_as_issued/`);
            fetchRequest();
            // Trigger a notification update
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to mark as issued');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReportUsage = async () => {
        if (!window.confirm('Are you sure you want to report usage? This cannot be undone.')) return;
        try {
            setActionLoading(true);

            const items = Object.keys(usageReport).map(id => ({
                id: parseInt(id),
                actual_used_quantity_ml: parseFloat(usageReport[id])
            }));

            await api.post(`stock_request/${id}/report_usage/`, { items });
            fetchRequest();
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to report usage');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkAsCompleted = async () => {
        if (!window.confirm('Are you sure you want to mark this request as completed? This will adjust inventory and log the transaction.')) return;
        try {
            setActionLoading(true);
            await api.post(`stock_request/${id}/mark_as_completed/`);
            fetchRequest();
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to complete request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSend = async () => {
        if (!window.confirm('Are you sure you want to submit this request for approval?')) return;
        try {
            setActionLoading(true);
            await api.post(`stock_request/${id}/submit/`);
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
            await api.delete(`stock_request/${id}/`);;
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
            case 'issued':
                return <div className="detail-status status-issued"><FaCheckCircle /> Issued</div>;
            case 'rejected':
                return <div className="detail-status status-danger"><FaTimesCircle /> Rejected</div>;
            case 'reported':
                return <div className="detail-status status-reported"><FaClipboardList /> Reported</div>;
            case 'completed':
                return <div className="detail-status status-completed"><FaCheckCircle /> Completed</div>;
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
                    <label>History</label>
                    <ul className="history-list">
                        <li><strong>Requested:</strong> {new Date(request.created_at).toLocaleString()} by {request.requested_by_name}</li>
                        {request.reviewed_at && <li><strong>{request.status === 'rejected' ? 'Rejected' : 'Approved'}:</strong> {new Date(request.reviewed_at).toLocaleString()} by {request.reviewed_by_name}</li>}
                        {request.issued_at && <li><strong>Issued:</strong> {new Date(request.issued_at).toLocaleString()} by {request.issued_by_name}</li>}
                        {request.reported_at && <li><strong>Reported:</strong> {new Date(request.reported_at).toLocaleString()}</li>}
                        {request.completed_at && <li><strong>Completed:</strong> {new Date(request.completed_at).toLocaleString()}</li>}
                    </ul>
                </div>
            )}


            {/* Usage Reporting Form for Staff */}
            {
                user?.employee_id === request.requested_by_id && request.status === 'issued' && (
                    <div className="usage-report-section animate-fade">
                        <h3><FaClipboardList /> Report Actual Usage</h3>
                        <p className="section-helper-text">Enter the quantity actually consumed. Inventory will be updated based on these values.</p>

                        <div className="card no-padding overflow-hidden margin-top-md">
                            <table className="detail-table">
                                <thead>
                                    <tr>
                                        <th>Chemical Name</th>
                                        <th>Requested Quantity</th>
                                        <th className="text-right">Actual Used Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.chemical_items?.map(item => (
                                        <tr key={item.id}>
                                            <td className="item-name">{item.chemical_name}</td>
                                            <td><span className="qty-badge info">{item.quantity_ml} ml</span></td>
                                            <td className="text-right">
                                                <div className="inline-input-wrapper">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={usageReport[item.id] || ''}
                                                        onChange={(e) => setUsageReport({ ...usageReport, [item.id]: e.target.value })}
                                                        className="qty-input-field"
                                                        placeholder="0.00"
                                                    />
                                                    <span className="input-unit">ml</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="action-footer margin-top-lg">
                            <button
                                className="btn-primary-glow full-width-btn"
                                onClick={handleReportUsage}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit Final Usage Report</>}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Completion Review for Store Keeper */}
            {
                isStoreKeeper && request.status === 'reported' && (
                    <div className="completion-review-section animate-fade">
                        <div className="section-header">
                            <h3><FaCheckCircle /> Verify & Complete Request</h3>
                            <button
                                className="btn-approve pulse-btn"
                                onClick={handleMarkAsCompleted}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Processing...' : <><FaCheckCircle /> Confirm & Adjust Inventory</>}
                            </button>
                        </div>
                        <p className="section-helper-text">Review the usage report submitted by the staff. Inventory will be automatically adjusted upon confirmation.</p>

                        <div className="card no-padding margin-top-md">
                            <table className="detail-table comparison-mode">
                                <thead>
                                    <tr>
                                        <th>Chemical</th>
                                        <th>Requested</th>
                                        <th>Actual Used</th>
                                        <th>Returned to Stock</th>
                                        <th>Additional Used</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.chemical_items?.map(item => {
                                        const req = parseFloat(item.quantity_ml);
                                        const act = parseFloat(item.actual_used_quantity_ml || 0);
                                        const ret = Math.max(0, req - act);
                                        const add = Math.max(0, act - req);
                                        return (
                                            <tr key={item.id}>
                                                <td className="item-name">{item.chemical_name}</td>
                                                <td><span className="qty-badge muted">{req} ml</span></td>
                                                <td><span className="qty-badge primary">{act} ml</span></td>
                                                <td>
                                                    {ret > 0 ? (
                                                        <span className="diff-badge positive">
                                                            <FaArrowLeft /> {ret.toFixed(2)} ml
                                                        </span>
                                                    ) : <span className="diff-none">-</span>}
                                                </td>
                                                <td>
                                                    {add > 0 ? (
                                                        <span className="diff-badge negative">
                                                            <FaArrowRight /> {add.toFixed(2)} ml
                                                        </span>
                                                    ) : <span className="diff-none">-</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* View Read-Only Usage for Completed/Reported Requests */}
            {
                ['reported', 'completed'].includes(request.status) && !(isStoreKeeper && request.status === 'reported') && !(user?.employee_id === request.requested_by_id && request.status === 'issued') && (
                    <div className="usage-summary-section animate-fade">
                        <h3><FaClipboardList /> Execution Summary</h3>
                        <div className="card no-padding margin-top-md">
                            <table className="detail-table">
                                <thead>
                                    <tr>
                                        <th>Chemical</th>
                                        <th>Requested</th>
                                        <th className="text-right">Actual Consumed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.chemical_items?.map(item => (
                                        <tr key={item.id}>
                                            <td className="item-name">{item.chemical_name}</td>
                                            <td><span className="qty-badge muted">{item.quantity_ml} ml</span></td>
                                            <td className="text-right">
                                                <span className="qty-badge success highlight">
                                                    {item.actual_used_quantity_ml} ml
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {
                isHOD && request.status === 'pending' && (
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
                )
            }

            {
                isStoreKeeper && request.status === 'accepted' && (
                    <div className="approval-actions animate-fade">
                        <button
                            className="btn-approve"
                            onClick={handleMarkAsIssued}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Processing...' : <><FaCheckCircle /> Mark as Issued</>}
                        </button>
                    </div>
                )
            }

            {
                user?.employee_id === request.requested_by_id && request.status === 'draft' && (
                    <div className="approval-actions animate-fade">
                        {hasActiveRequest && (
                            <div className="active-request-warning margin-bottom-md">
                                <FaClock /> You already have an active request. Complete it before submitting this one.
                            </div>
                        )}
                        <button
                            className={`btn-approve ${hasActiveRequest ? 'disabled' : ''}`}
                            onClick={() => !hasActiveRequest && handleSend()}
                            disabled={actionLoading || hasActiveRequest}
                        >
                            {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit for Approval</>}
                        </button>
                    </div>
                )
            }

            <AddRequestModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={fetchRequest}
                editData={request}
                hasActiveRequest={hasActiveRequest}
            />
        </div>
    );
}

export default StockRequestDetail;
