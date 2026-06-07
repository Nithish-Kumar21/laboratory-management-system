import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaFlask, FaIdCard, FaUser, FaGraduationCap, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaClock, FaTrash, FaEdit, FaClipboardList, FaExclamationTriangle } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AddRequestModal from '../components/modals/AddRequestModal';
import ConfirmDialog from '../components/ConfirmDialog';
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

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, variant: 'confirm', onConfirm: null });

    const handleAccept = () => {
        setDialog({
            open: true,
            message: 'Are you sure you want to approve this request?',
            showCancel: true,
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                api.post(`stock_request/${id}/accept/`)
                    .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); })
                    .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to approve', showCancel: false }))
                    .finally(() => setActionLoading(false));
            }
        });
    };

    const handleReject = async () => {
        const reason = rejectionReason.trim();
        if (!reason) {
            setDialog({ open: true, message: 'Please provide a reason for rejection.', showCancel: false, onConfirm: () => setDialog({ open: false }) });
            return;
        }
        setDialog({ open: false });
        setActionLoading(true);
        try {
            await api.post(`stock_request/${id}/reject/`, { rejection_reason: reason });
            setShowRejectModal(false);
            setRejectionReason('');
            fetchRequest();
            window.dispatchEvent(new CustomEvent('inventory-updated'));
        } catch (err) {
            setDialog({ open: true, message: err.response?.data?.error || err.response?.data?.rejection_reason?.[0] || 'Failed to reject', showCancel: false });
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkAsIssued = () => {
        setDialog({
            open: true,
            message: 'Are you sure you want to mark this request as issued? This will update the inventory.',
            showCancel: true,
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                api.post(`stock_request/${id}/mark_as_issued/`)
                    .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); })
                    .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to mark as issued', showCancel: false }))
                    .finally(() => setActionLoading(false));
            }
        });
    };

    const handleReportUsage = () => {
        setDialog({
            open: true,
            message: 'Are you sure you want to report usage? This cannot be undone.',
            showCancel: true,
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                const items = Object.keys(usageReport).map(k => ({ id: parseInt(k), actual_used_quantity_ml: parseFloat(usageReport[k]) }));
                api.post(`stock_request/${id}/report_usage/`, { items })
                    .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); })
                    .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to report usage', showCancel: false }))
                    .finally(() => setActionLoading(false));
            }
        });
    };

    const handleMarkAsCompleted = () => {
        setDialog({
            open: true,
            message: 'Are you sure you want to mark this request as completed? This will adjust inventory and log the transaction.',
            showCancel: true,
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                api.post(`stock_request/${id}/mark_as_completed/`)
                    .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); })
                    .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to complete request', showCancel: false }))
                    .finally(() => setActionLoading(false));
            }
        });
    };

    const handleSend = () => {
        setDialog({
            open: true,
            message: 'Are you sure you want to submit this request for approval?',
            showCancel: true,
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                api.post(`stock_request/${id}/submit/`)
                    .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); })
                    .catch(err => setDialog({ open: true, message: err.response?.data?.error || err.response?.data?.detail || 'Failed to submit', showCancel: false }))
                    .finally(() => setActionLoading(false));
            }
        });
    };

    const handleDelete = () => {
        setDialog({
            open: true,
            message: 'Are you sure you want to delete this request permanently?',
            showCancel: true,
            variant: 'danger',
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                api.delete(`stock_request/${id}/`)
                    .then(() => { window.dispatchEvent(new CustomEvent('inventory-updated')); navigate('/requests'); })
                    .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to delete', showCancel: false }))
                    .finally(() => setActionLoading(false));
            }
        });
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'accepted':
                return <span className="badge badge-accepted"><span className="badge-dot dot-accepted"></span>Approved</span>;
            case 'issued':
                return <span className="badge badge-issued"><span className="badge-dot dot-issued"></span>Issued</span>;
            case 'rejected':
                return <span className="badge badge-rejected"><span className="badge-dot dot-rejected"></span>Rejected</span>;
            case 'reported':
                return <span className="badge badge-reported"><span className="badge-dot dot-reported"></span>Reported</span>;
            case 'completed':
                return <span className="badge badge-completed"><span className="badge-dot dot-completed"></span>Completed</span>;
            case 'draft':
                return <span className="badge badge-draft"><span className="badge-dot dot-draft"></span>Draft</span>;
            default:
                return <span className="badge badge-pending"><span className="badge-dot dot-pending"></span>Pending</span>;
        }
    };

    const getTimelineSteps = (status) => {
        const isDraft = status === 'draft';
        const isRejected = status === 'rejected';

        if (isDraft) {
            return [
                { label: 'Draft', sub: null, done: false, active: true, pending: false },
                { label: 'Submitted', sub: null, done: false, active: false, pending: true },
                { label: 'Pending HOD Approval', sub: null, done: false, active: false, pending: true },
                { label: 'Approved & Issued', sub: null, done: false, active: false, pending: true },
                { label: 'Completed', sub: null, done: false, active: false, pending: true },
            ];
        }

        if (isRejected) {
            return [
                { label: 'Submitted', sub: request.created_at ? new Date(request.created_at).toLocaleDateString() : null, done: true, active: false, pending: false },
                { label: 'Rejected', sub: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : null, done: false, active: true, pending: false },
                { label: 'Approved & Issued', sub: null, done: false, active: false, pending: true },
                { label: 'Completed', sub: null, done: false, active: false, pending: true },
            ];
        }

        const steps = [];

        // Step 1: Submitted
        steps.push({
            label: 'Submitted',
            sub: request.created_at ? new Date(request.created_at).toLocaleDateString() : null,
            done: true,
            active: false,
            pending: status === 'pending'
        });

        if (status === 'pending') {
            steps.push({ label: 'Pending HOD Approval', sub: null, done: false, active: true, pending: false });
            steps.push({ label: 'Approved & Issued', sub: null, done: false, active: false, pending: true });
            steps.push({ label: 'Completed', sub: null, done: false, active: false, pending: true });
        } else if (status === 'accepted') {
            steps.push({
                label: 'Approved',
                sub: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({ label: 'Issued', sub: null, done: false, active: false, pending: true });
            steps.push({ label: 'Completed', sub: null, done: false, active: false, pending: true });
        } else if (status === 'issued') {
            steps.push({
                label: 'Approved',
                sub: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({
                label: 'Issued',
                sub: request.issued_at ? new Date(request.issued_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({ label: 'Completed', sub: null, done: false, active: false, pending: true });
        } else if (status === 'reported') {
            steps.push({
                label: 'Approved',
                sub: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({
                label: 'Issued',
                sub: request.issued_at ? new Date(request.issued_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({
                label: 'Usage Reported',
                sub: request.reported_at ? new Date(request.reported_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({ label: 'Complete Verification', sub: null, done: false, active: true, pending: false });
        } else if (status === 'completed') {
            steps.push({
                label: 'Approved',
                sub: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({
                label: 'Issued',
                sub: request.issued_at ? new Date(request.issued_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({
                label: 'Usage Reported',
                sub: request.reported_at ? new Date(request.reported_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
            steps.push({
                label: 'Completed',
                sub: request.completed_at ? new Date(request.completed_at).toLocaleDateString() : null,
                done: true,
                active: false,
                pending: false
            });
        }

        return steps;
    };

    if (loading) return <div className="loading-spinner"></div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!request) return null;

    // ===== STAFF DETAIL VIEW =====
    if (isStaff) {
        const steps = getTimelineSteps(request.status);
        const isOwn = user?.employee_id === request.requested_by_id;

        return (
            <div className="staff-detail-wrapper">
                <div className="staff-detail-page animate-up">
                    <div className="staff-detail-inner">

                    {/* Back Row */}
                    <div className="sd-back-row" onClick={() => navigate('/requests')}>
                        <FaArrowLeft />
                        <span>Request Details</span>
                    </div>

                    {/* Info Card */}
                    <div className="sd-card">
                        <div className="sd-card-header">
                            <span className="sd-req-id">{request.request_id}</span>
                            <div className="sd-header-right">
                                {getStatusBadge(request.status)}
                            </div>
                        </div>
                        <hr className="sd-divider" />
                        <div className="sd-meta-grid">
                            <div className="sd-meta-item">
                                <div className="sd-meta-label"><FaUser /> Staff</div>
                                <div className="sd-meta-value">{request.requested_by_name}</div>
                            </div>
                            <div className="sd-meta-item">
                                <div className="sd-meta-label"><FaIdCard /> Staff ID</div>
                                <div className="sd-meta-value">{request.requested_by_id}</div>
                            </div>
                            <div className="sd-meta-item">
                                <div className="sd-meta-label"><FaGraduationCap /> Class</div>
                                <div className="sd-meta-value">{request.class_name}</div>
                            </div>
                            <div className="sd-meta-item">
                                <div className="sd-meta-label"><FaCalendarAlt /> Date</div>
                                <div className="sd-meta-value">{request.date ? new Date(request.date).toLocaleDateString() : new Date(request.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>

                    {/* Chemical Requirements Card */}
                    <div className="sd-card">
                        <div className="sd-card-title">
                            <FaFlask /> Chemical Requirements
                        </div>
                        <hr className="sd-divider" />
                        <div className="sd-chem-list">
                            {request.chemical_items?.map((item, idx) => (
                                <div key={idx} className="sd-chem-row">
                                    <span className="sd-chem-name">{item.chemical_name}</span>
                                    <span className="sd-chem-qty">{item.quantity_ml}<span className="sd-chem-unit"> ml</span></span>
                                </div>
                            ))}
                            {(!request.chemical_items || request.chemical_items.length === 0) && (
                                <div className="sd-empty-text">No chemicals listed</div>
                            )}
                        </div>
                    </div>

                    {/* Purpose / Remarks Card */}
                    {request.reason && (
                        <div className="sd-card">
                            <div className="sd-card-title">Purpose / Remarks</div>
                            <hr className="sd-divider" />
                            <p className="sd-remarks-text">{request.reason}</p>
                        </div>
                    )}

                    {/* Request Status Card */}
                    <div className="sd-card">
                        <div className="sd-card-title">Request Status</div>
                        <hr className="sd-divider" />
                        <div className="sd-timeline">
                            {steps.map((step, i) => (
                                <div key={i} className="sd-tl-item">
                                    <div className="sd-tl-left">
                                        <div className={`sd-tl-dot ${step.done ? 'done' : ''} ${step.active ? 'active' : ''} ${step.pending ? 'pending' : ''}`}></div>
                                        {i < steps.length - 1 && <div className={`sd-tl-line ${step.done ? 'done' : ''}`}></div>}
                                    </div>
                                    <div className="sd-tl-content">
                                        <div className={`sd-tl-label ${step.active ? 'active' : ''} ${step.pending ? 'faded' : ''}`}>{step.label}</div>
                                        {step.sub && <div className="sd-tl-sub">{step.sub}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rejection Reason (if rejected) */}
                    {request.status === 'rejected' && request.rejection_reason && (
                        <div className="sd-card sd-card-error">
                            <div className="sd-card-title"><FaExclamationTriangle /> Rejection Reason</div>
                            <hr className="sd-divider" />
                            <p className="sd-remarks-text">{request.rejection_reason}</p>
                        </div>
                    )}

                    {/* Usage Reporting for Issued Status */}
                    {isOwn && request.status === 'issued' && (
                        <div className="sd-card">
                            <div className="sd-card-title"><FaClipboardList /> Report Actual Usage</div>
                            <hr className="sd-divider" />
                            <p className="sd-section-helper">Enter the quantity actually consumed. Inventory will be updated based on these values.</p>
                            <div className="sd-usage-table">
                                {request.chemical_items?.map(item => (
                                    <div key={item.id} className="sd-usage-row">
                                        <span className="sd-usage-name">{item.chemical_name}</span>
                                        <span className="sd-usage-requested">{item.quantity_ml} ml</span>
                                        <div className="sd-usage-input-wrap">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={usageReport[item.id] || ''}
                                                onChange={(e) => setUsageReport({ ...usageReport, [item.id]: e.target.value })}
                                                className="sd-usage-input"
                                                placeholder="0.00"
                                            />
                                            <span className="sd-input-unit">ml</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                className="sd-btn sd-btn-primary sd-btn-full"
                                onClick={handleReportUsage}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit Final Usage Report</>}
                            </button>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="sd-actions">
                        {isOwn && (request.status === 'draft' || request.status === 'rejected') && (
                            <button className="sd-btn sd-btn-outline" onClick={() => navigate(`/new-request?edit=${request.id}`)} disabled={actionLoading}>
                                <FaEdit /> Edit
                            </button>
                        )}
                        {isOwn && request.status === 'draft' && (
                            <button className="sd-btn sd-btn-primary" onClick={handleSend} disabled={actionLoading || hasActiveRequest}>
                                {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit</>}
                            </button>
                        )}
                        {isOwn && (request.status === 'draft' || request.status === 'pending' || request.status === 'rejected') && (
                            <button className="sd-btn sd-btn-danger" onClick={handleDelete} disabled={actionLoading}>
                                {actionLoading ? 'Deleting...' : <><FaTrash /> Delete</>}
                            </button>
                        )}
                    </div>

                    {hasActiveRequest && request.status === 'draft' && (
                        <div className="sd-warning">
                            <FaExclamationTriangle /> You already have an active request. Complete it before submitting this one.
                        </div>
                    )}

                </div>

                <AddRequestModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={fetchRequest}
                    editData={request}
                    hasActiveRequest={hasActiveRequest}
                />

                <ConfirmDialog
                    open={dialog.open}
                    message={dialog.message}
                    showCancel={dialog.showCancel}
                    confirmLabel="OK"
                    cancelLabel="Cancel"
                    variant={dialog.variant || 'confirm'}
                    onConfirm={() => { if (dialog.onConfirm) dialog.onConfirm(); else setDialog({ open: false }); }}
                    onCancel={() => setDialog({ open: false })}
                />
            </div>
            </div>
        );
    }

    // ===== HOD / STOREKEEPER VIEW =====
    return (
        <div className="request-detail-wrapper">
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
                    {(user?.employee_id === request.requested_by_id && (request.status === 'draft' || request.status === 'rejected')) && (
                        <button className="edit-request-btn" onClick={() => setShowEditModal(true)} disabled={actionLoading}>
                            <FaEdit /> Edit
                        </button>
                    )}
                    {(user?.employee_id === request.requested_by_id && (request.status === 'draft' || request.status === 'pending' || request.status === 'rejected')) && (
                        <button className="delete-request-btn" onClick={handleDelete} disabled={actionLoading}>
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
                    <span>{request.date ? new Date(request.date).toLocaleDateString() : new Date(request.created_at).toLocaleDateString()}</span>
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
                                <tr><td colSpan="2" className="empty-row text-center">No chemicals listed</td></tr>
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
                        {request.status === 'rejected' && request.rejection_reason && (
                            <li className="rejection-reason"><strong>Reason:</strong> {request.rejection_reason}</li>
                        )}
                        {request.issued_at && <li><strong>Issued:</strong> {new Date(request.issued_at).toLocaleString()} by {request.issued_by_name}</li>}
                        {request.reported_at && <li><strong>Reported:</strong> {new Date(request.reported_at).toLocaleString()}</li>}
                        {request.completed_at && <li><strong>Completed:</strong> {new Date(request.completed_at).toLocaleString()}</li>}
                    </ul>
                </div>
            )}

            {/* Completion Review for Store Keeper */}
            {isStoreKeeper && request.status === 'reported' && (
                <div className="completion-review-section animate-fade">
                    <div className="section-header">
                        <h3><FaCheckCircle /> Verify & Complete Request</h3>
                        <button className="btn-approve pulse-btn" onClick={handleMarkAsCompleted} disabled={actionLoading}>
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
                                            <td>{ret > 0 ? <span className="diff-badge positive"><FaArrowLeft /> {ret.toFixed(2)} ml</span> : <span className="diff-none">-</span>}</td>
                                            <td>{add > 0 ? <span className="diff-badge negative"><FaArrowRight /> {add.toFixed(2)} ml</span> : <span className="diff-none">-</span>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Read-Only Usage Summary */}
            {['reported', 'completed'].includes(request.status) && !(isStoreKeeper && request.status === 'reported') && !(user?.employee_id === request.requested_by_id && request.status === 'issued') && (
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
                                        <td className="text-right"><span className="qty-badge success highlight">{item.actual_used_quantity_ml} ml</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* HOD Actions */}
            {isHOD && request.status === 'pending' && (
                <div className="approval-actions animate-fade">
                    <button className="btn-reject" onClick={() => setShowRejectModal(true)} disabled={actionLoading}>
                        <FaTimesCircle /> Reject Request
                    </button>
                    <button className="btn-approve" onClick={handleAccept} disabled={actionLoading}>
                        {actionLoading ? 'Processing...' : <><FaCheckCircle /> Approve Request</>}
                    </button>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h3>Reason for Rejection</h3>
                            <button type="button" className="modal-close" onClick={() => setShowRejectModal(false)} aria-label="Close">×</button>
                        </div>
                        <div className="modal-body">
                            <p className="section-helper-text">Please provide a reason before rejecting this request. The requester will see this reason.</p>
                            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter reason for rejection..." rows={4} className="modern-textarea" style={{ width: '100%', marginTop: '8px' }} />
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={() => { setShowRejectModal(false); setRejectionReason(''); }} disabled={actionLoading}>Cancel</button>
                            <button type="button" className="btn-reject" onClick={handleReject} disabled={actionLoading || !rejectionReason.trim()}>{actionLoading ? 'Processing...' : 'Reject Request'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* StoreKeeper Issue Action */}
            {isStoreKeeper && request.status === 'accepted' && (
                <div className="approval-actions animate-fade">
                    <button className="btn-approve" onClick={handleMarkAsIssued} disabled={actionLoading}>
                        {actionLoading ? 'Processing...' : <><FaCheckCircle /> Mark as Issued</>}
                    </button>
                </div>
            )}

            {/* Draft Submit */}
            {user?.employee_id === request.requested_by_id && request.status === 'draft' && (
                <div className="approval-actions animate-fade">
                    {hasActiveRequest && (
                        <div className="active-request-warning margin-bottom-md">
                            <FaClock /> You already have an active request. Complete it before submitting this one.
                        </div>
                    )}
                    <button className={`btn-approve ${hasActiveRequest ? 'disabled' : ''}`} onClick={() => !hasActiveRequest && handleSend()} disabled={actionLoading || hasActiveRequest}>
                        {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit for Approval</>}
                    </button>
                </div>
            )}

            <AddRequestModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSuccess={fetchRequest} editData={request} hasActiveRequest={hasActiveRequest} />
            <ConfirmDialog open={dialog.open} message={dialog.message} showCancel={dialog.showCancel} confirmLabel="OK" cancelLabel="Cancel" variant={dialog.variant || 'confirm'} onConfirm={() => { if (dialog.onConfirm) dialog.onConfirm(); else setDialog({ open: false }); }} onCancel={() => setDialog({ open: false })} />
        </div>
        </div>
    );
};

export default StockRequestDetail;
