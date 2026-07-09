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
    const [toast, setToast] = useState(null);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

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
                initialReport[item.id] = item.quantity; // Default to requested qty
            });
            setUsageReport(initialReport);
        }
    }, [request]);

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, variant: 'confirm', onConfirm: null });

    const handleAccept = () => {
        setActionLoading(true);
        api.post(`stock_request/${id}/accept/`)
            .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Request Approved'); })
            .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to approve', showCancel: false }))
            .finally(() => setActionLoading(false));
    };

    const handleReject = async () => {
        const reason = rejectionReason.trim();
        if (!reason) {
            showToast('Please provide a reason for rejection.');
            return;
        }
        setActionLoading(true);
        try {
            await api.post(`stock_request/${id}/reject/`, { rejection_reason: reason });
            setShowRejectModal(false);
            setRejectionReason('');
            fetchRequest();
            window.dispatchEvent(new CustomEvent('inventory-updated'));
            showToast('Request Rejected');
        } catch (err) {
            setDialog({ open: true, message: err.response?.data?.error || err.response?.data?.rejection_reason?.[0] || 'Failed to reject', showCancel: false });
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkAsIssued = () => {
        setActionLoading(true);
        api.post(`stock_request/${id}/mark_as_issued/`)
            .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Marked as Issued'); })
            .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to mark as issued', showCancel: false }))
            .finally(() => setActionLoading(false));
    };

    const handleReportUsage = () => {
        setActionLoading(true);
        const items = Object.keys(usageReport).map(k => ({ id: parseInt(k), actual_used_quantity: parseFloat(usageReport[k]) }));
        api.post(`stock_request/${id}/report_usage/`, { items })
            .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Quantity Updated'); })
            .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to report usage', showCancel: false }))
            .finally(() => setActionLoading(false));
    };

    const handleMarkAsCompleted = () => {
        setActionLoading(true);
        api.post(`stock_request/${id}/mark_as_completed/`)
            .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Request completed'); })
            .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to complete request', showCancel: false }))
            .finally(() => setActionLoading(false));
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
                            <div className="sd-meta-item">
                                <div className="sd-meta-label">Day Order</div>
                                <div className="sd-meta-value">{request.day_order || '-'}</div>
                            </div>
                            <div className="sd-meta-item">
                                <div className="sd-meta-label">Hour</div>
                                <div className="sd-meta-value">{request.hour?.length ? request.hour.sort((a,b)=>a-b).join(', ') : '-'}</div>
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
                                    <span className="sd-chem-qty">{item.quantity}<span className="sd-chem-unit"> {item.unit}</span></span>
                                </div>
                            ))}
                            {(!request.chemical_items || request.chemical_items.length === 0) && (
                                <div className="sd-empty-text">No chemicals listed</div>
                            )}
                        </div>
                    </div>

                    {/* Purpose Type Card */}
                    {request.purpose_type && (
                        <div className="sd-card">
                            <div className="sd-card-title">
                                {request.purpose_type === 'research_project' ? 'Research / Project' : 'Practical Lab'}
                            </div>
                            <hr className="sd-divider" />
                            <div className="sd-meta-grid">
                                <div className="sd-meta-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="sd-meta-label">Experiment Name(s)</div>
                                    <div className="sd-meta-value">{request.experiment_name || '-'}</div>
                                </div>
                                {request.purpose_type === 'research_project' && (
                                    <div className="sd-meta-item" style={{ gridColumn: '1 / -1' }}>
                                        <div className="sd-meta-label">Student Name(s)</div>
                                        <div className="sd-meta-value">{request.student_name || '-'}</div>
                                    </div>
                                )}
                            </div>
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
                                        <span className="sd-usage-requested">{item.quantity} {item.unit}</span>
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
                                            <span className="sd-input-unit">{item.unit}</span>
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
                {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
            </div>
            </div>
        );
    }

    // ===== HOD / STOREKEEPER VIEW =====
    const steps = getTimelineSteps(request.status);
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
                            <div className="sd-meta-label"><FaUser /> Requested By</div>
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
                        <div className="sd-meta-item">
                            <div className="sd-meta-label">Day Order</div>
                            <div className="sd-meta-value">{request.day_order || '-'}</div>
                        </div>
                        <div className="sd-meta-item">
                            <div className="sd-meta-label">Hour</div>
                            <div className="sd-meta-value">{request.hour?.length ? request.hour.sort((a,b)=>a-b).join(', ') : '-'}</div>
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
                                <span className="sd-chem-qty">{item.quantity}<span className="sd-chem-unit"> {item.unit}</span></span>
                            </div>
                        ))}
                        {(!request.chemical_items || request.chemical_items.length === 0) && (
                            <div className="sd-empty-text">No chemicals listed</div>
                        )}
                    </div>
                </div>

                {/* Purpose Type Card */}
                {request.purpose_type && (
                    <div className="sd-card">
                        <div className="sd-card-title">
                            {request.purpose_type === 'research_project' ? 'Research / Project' : 'Practical Lab'}
                        </div>
                        <hr className="sd-divider" />
                        <div className="sd-meta-grid">
                            <div className="sd-meta-item" style={{ gridColumn: '1 / -1' }}>
                                <div className="sd-meta-label">Experiment Name(s)</div>
                                <div className="sd-meta-value">{request.experiment_name || '-'}</div>
                            </div>
                            {request.purpose_type === 'research_project' && (
                                <div className="sd-meta-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="sd-meta-label">Student Name(s)</div>
                                    <div className="sd-meta-value">{request.student_name || '-'}</div>
                                </div>
                            )}
                        </div>
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

                {/* Completion Review for Store Keeper */}
                {isStoreKeeper && request.status === 'reported' && (
                    <div className="sd-card">
                        <div className="sd-card-title"><FaCheckCircle /> Verify & Complete Request</div>
                        <hr className="sd-divider" />
                        <p className="sd-section-helper">Review the usage report submitted by the staff. Inventory will be automatically adjusted upon confirmation.</p>
                        <div className="card no-padding">
                            <table className="detail-table comparison-mode">
                                <thead>
                                    <tr>
                                        <th>Chemical</th>
                                        <th>Requested</th>
                                        <th>Actual Used</th>
                                        <th>Returned</th>
                                        <th>Additional</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.chemical_items?.map(item => {
                                        const req = parseFloat(item.quantity);
                                        const act = parseFloat(item.actual_used_quantity || 0);
                                        const ret = Math.max(0, req - act);
                                        const add = Math.max(0, act - req);
                                        return (
                                            <tr key={item.id}>
                                                <td className="item-name">{item.chemical_name}</td>
                                                <td><span className="qty-badge muted">{req} {item.unit}</span></td>
                                                <td><span className="qty-badge primary">{act} {item.unit}</span></td>
                                                <td>{ret > 0 ? <span className="diff-badge positive"><FaArrowLeft /> {ret.toFixed(2)} {item.unit}</span> : <span className="diff-none">-</span>}</td>
                                                <td>{add > 0 ? <span className="diff-badge negative"><FaArrowRight /> {add.toFixed(2)} {item.unit}</span> : <span className="diff-none">-</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <button className="sd-btn sd-btn-primary sd-btn-full" onClick={handleMarkAsCompleted} disabled={actionLoading} style={{marginTop: '16px'}}>
                            {actionLoading ? 'Processing...' : <><FaCheckCircle /> Confirm & Adjust Inventory</>}
                        </button>
                    </div>
                )}

                {/* Read-Only Usage Summary */}
                {['reported', 'completed'].includes(request.status) && !(isStoreKeeper && request.status === 'reported') && (
                    <div className="sd-card">
                        <div className="sd-card-title"><FaClipboardList /> Execution Summary</div>
                        <hr className="sd-divider" />
                        <div className="sd-chem-list">
                            {request.chemical_items?.map(item => (
                                <div key={item.id} className="sd-chem-row">
                                    <span className="sd-chem-name">{item.chemical_name}</span>
                                    <span className="sd-chem-qty">{item.actual_used_quantity}<span className="sd-chem-unit"> {item.unit}</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* HOD Actions */}
                {isHOD && request.status === 'pending' && (
                    <div className="sd-actions">
                        <button className="sd-btn sd-btn-danger" onClick={() => setShowRejectModal(true)} disabled={actionLoading}>
                            <FaTimesCircle /> Reject
                        </button>
                        <button className="sd-btn sd-btn-primary" onClick={handleAccept} disabled={actionLoading}>
                            {actionLoading ? 'Processing...' : <><FaCheckCircle /> Approve</>}
                        </button>
                    </div>
                )}

                {/* StoreKeeper Issue Action */}
                {isStoreKeeper && request.status === 'accepted' && (
                    <div className="sd-actions">
                        <button className="sd-btn sd-btn-primary sd-btn-full" onClick={handleMarkAsIssued} disabled={actionLoading}>
                            {actionLoading ? 'Processing...' : <><FaCheckCircle /> Mark as Issued</>}
                        </button>
                    </div>
                )}

                {/* Draft Submit */}
                {user?.employee_id === request.requested_by_id && request.status === 'draft' && (
                    <div className="sd-actions">
                        {hasActiveRequest && (
                            <div className="sd-warning">
                                <FaClock /> You already have an active request. Complete it before submitting this one.
                            </div>
                        )}
                        <button className="sd-btn sd-btn-primary sd-btn-full" onClick={() => !hasActiveRequest && handleSend()} disabled={actionLoading || hasActiveRequest}>
                            {actionLoading ? 'Submitting...' : <><FaCheckCircle /> Submit for Approval</>}
                        </button>
                    </div>
                )}

                {/* Edit / Delete */}
                <div className="sd-actions">
                    {user?.employee_id === request.requested_by_id && (request.status === 'draft' || request.status === 'rejected') && (
                        <button className="sd-btn sd-btn-outline" onClick={() => setShowEditModal(true)} disabled={actionLoading}>
                            <FaEdit /> Edit
                        </button>
                    )}
                    {user?.employee_id === request.requested_by_id && (request.status === 'draft' || request.status === 'pending' || request.status === 'rejected') && (
                        <button className="sd-btn sd-btn-danger" onClick={handleDelete} disabled={actionLoading}>
                            <FaTrash /> {actionLoading ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                </div>

            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Reason for Rejection</h3>
                            <button type="button" className="modal-close" onClick={() => setShowRejectModal(false)} aria-label="Close">×</button>
                        </div>
                        <div className="modal-body">
                            <p className="sd-section-helper">Please provide a reason before rejecting this request. The requester will see this reason.</p>
                            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter reason for rejection..." rows={4} className="modern-textarea" style={{ width: '100%', marginTop: '8px' }} />
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={() => { setShowRejectModal(false); setRejectionReason(''); }} disabled={actionLoading}>Cancel</button>
                            <button type="button" className="btn-reject" onClick={handleReject} disabled={actionLoading || !rejectionReason.trim()}>{actionLoading ? 'Processing...' : 'Reject Request'}</button>
                        </div>
                    </div>
                </div>
            )}

            <AddRequestModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSuccess={fetchRequest} editData={request} hasActiveRequest={hasActiveRequest} />
            <ConfirmDialog open={dialog.open} message={dialog.message} showCancel={dialog.showCancel} confirmLabel="OK" cancelLabel="Cancel" variant={dialog.variant || 'confirm'} onConfirm={() => { if (dialog.onConfirm) dialog.onConfirm(); else setDialog({ open: false }); }} onCancel={() => setDialog({ open: false })} />
            {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
        </div>
        </div>
    );
};

export default StockRequestDetail;
