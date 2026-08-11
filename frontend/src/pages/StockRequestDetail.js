import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaFlask, FaIdCard, FaUser, FaGraduationCap, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaClock, FaTrash, FaEdit, FaClipboardList, FaExclamationTriangle, FaPrint } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AddRequestModal from '../components/modals/AddRequestModal';
import ConfirmDialog from '../components/ConfirmDialog';
import './StockRequestDetail.css';

const STOREKEEPER_DELETABLE_STATUSES = ['draft', 'pending', 'accepted', 'rejected'];

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

    useEffect(() => {
        if (isHOD || isStoreKeeper) {
            api.get('available_chemicals/')
                .then((res) => {
                    const data = Array.isArray(res.data) ? res.data : res.data.results || [];
                    setAvailableChemicals(data);
                })
                .catch((err) => console.error('Error fetching available chemicals:', err));
        }
    }, [id, isHOD, isStoreKeeper]);

    const checkActiveRequests = async () => {
        try {
            const res = await api.get('/stock_request/');
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            // Active = any request that is NOT completed, NOT rejected, NOT draft, and NOT the current one (if current is not draft)
            // But here we only care if they have ANY other active request that would block submitting this draft.
            setHasActiveRequest(data.some(r => r.id !== parseInt(id) && r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'draft' && r.status !== 'cancelled'));
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
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, variant: 'confirm', onConfirm: null });

    // Inline Quantity Adjustment (HOD accept) State
    const [editMode, setEditMode] = useState(false);
    const [editQuantities, setEditQuantities] = useState({});
    const [availableChemicals, setAvailableChemicals] = useState([]);
    const [acceptError, setAcceptError] = useState('');

    const fmtQty = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const n = parseFloat(value);
        if (Number.isNaN(n)) return '';
        return String(n);
    };

    const availFor = (item) => availableChemicals.find(
        (c) => String(c.chemical_name || '').toLowerCase() === String(item.chemical_name || '').toLowerCase()
    );

    const rowError = (item, val) => {
        if (val === '' || val === null || val === undefined) return 'Quantity is required.';
        const n = parseFloat(val);
        if (Number.isNaN(n) || n <= 0) return 'Enter a quantity greater than 0.';
        const a = availFor(item);
        const availQty = a ? parseFloat(a.remaining ?? a.quantity) : 0;
        if (a && n > availQty) {
            return `Exceeds available stock (${fmtQty(availQty)} ${a.unit || item.unit}).`;
        }
        return '';
    };

    const toggleEditMode = () => {
        if (!editMode) {
            // Re-entering edit mode must not discard already-typed edits
            // (they are only committed together with the approval).
            if (!editQuantities || Object.keys(editQuantities).length === 0) {
                const initial = {};
                (request.chemical_items || []).forEach((it) => { initial[it.id] = it.quantity; });
                setEditQuantities(initial);
            }
            setAcceptError('');
            api.get('available_chemicals/')
                .then((res) => {
                    const data = Array.isArray(res.data) ? res.data : res.data.results || [];
                    setAvailableChemicals(data);
                })
                .catch((err) => console.error('Error fetching available chemicals:', err));
            setEditMode(true);
        } else {
            // "Done" just exits edit mode; it is not a save. Keep the typed
            // values so they are still applied when the request is approved.
            setEditMode(false);
            setAcceptError('');
        }
    };

    const handleAccept = () => {
        let firstError = '';
        const changed = [];
        // Apply any pending quantity edits even if the user already exited
        // edit mode ("Done" is not a save; edits commit with the approval).
        const hasEdits = editQuantities && Object.keys(editQuantities).length > 0;
        if (hasEdits) {
            (request.chemical_items || []).forEach((it) => {
                const msg = rowError(it, editQuantities[it.id]);
                if (msg && !firstError) firstError = msg;
                if (parseFloat(editQuantities[it.id]) !== parseFloat(it.quantity)) {
                    changed.push({ chemical_item_id: it.id, quantity_ml: parseFloat(editQuantities[it.id]) });
                }
            });
            if (firstError) {
                setAcceptError(firstError);
                return;
            }
        }
        const payload = {};
        if (changed.length) payload.chemical_items = changed;
        setActionLoading(true);
        api.post(`stock_request/${id}/accept/`, payload)
            .then(() => {
                fetchRequest();
                window.dispatchEvent(new CustomEvent('inventory-updated'));
                showToast(changed.length ? 'Request approved with adjusted quantities' : 'Request Approved');
                setEditMode(false);
                setEditQuantities({});
                setAcceptError('');
            })
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

    const handleReleaseCancel = () => {
        setActionLoading(true);
        api.post(`stock_request/${id}/cancel/`, { reason: cancelReason })
            .then(() => { setShowCancelModal(false); setCancelReason(''); fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Request Cancelled'); })
            .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to cancel request', showCancel: false }))
            .finally(() => setActionLoading(false));
    };

    const handleReportUsage = () => {
        setActionLoading(true);
        const items = Object.keys(usageReport).map(k => ({ id: parseInt(k) || 0, actual_used_quantity: parseFloat(usageReport[k]) || 0 }));
        api.post(`stock_request/${id}/report_usage/`, { items })
            .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Quantity Updated'); })
            .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Failed to report usage', showCancel: false }))
            .finally(() => setActionLoading(false));
    };

    const extractCompleteErrorMessage = (err, fallback) => {
        console.error('Complete request failed:', err);
        const data = err?.response?.data;
        if (data && typeof data === 'object') {
            if (data.error) return data.error;
            if (data.detail) return data.detail;
        }
        if (typeof data === 'string' && data.trim()) {
            const cleaned = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (cleaned) return cleaned.length > 300 ? cleaned.slice(0, 300) + '...' : cleaned;
        }
        return err?.response?.status ? `${fallback} Please contact support with error code ${err.response.status}.` : fallback;
    };

    const handleMarkAsCompleted = () => {
        setActionLoading(true);
        api.post(`stock_request/${id}/mark_as_completed/`)
            .then(() => { fetchRequest(); window.dispatchEvent(new CustomEvent('inventory-updated')); showToast('Request completed'); })
            .catch(err => setDialog({ open: true, message: extractCompleteErrorMessage(err, 'Failed to complete request'), showCancel: false }))
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
            message: 'Are you sure you want to delete this request? It will be removed from all feeds.',
            showCancel: true,
            variant: 'danger',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            onConfirm: () => {
                setDialog({ open: false });
                setActionLoading(true);
                api.delete(`stock_request/${id}/`)
                    .then(() => {
                        window.dispatchEvent(new CustomEvent('inventory-updated'));
                        sessionStorage.setItem('stock_request_deleted', 'Chemical request deleted');
                        navigate('/requests');
                    })
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

                    {/* Header */}
                    <div className="srq-header">
                        <div className="srq-header-left">
                            <div className="sd-back-row" onClick={() => navigate('/requests')}>
                                <FaArrowLeft />
                                <span>Request Details</span>
                            </div>
                        </div>
                        <div className="srq-header-actions">
                            <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                                <FaPrint />
                            </button>
                        </div>
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
                        <div className="srq-meta-grid">
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
                            <div className="sd-meta-item">
                                <div className="sd-meta-label">Venue</div>
                                <div className="sd-meta-value">{request.venue || '-'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Chemical Requirements Card */}
                    <div className="sd-card">
                        <div className="sd-card-title">
                            <FaFlask /> Chemical Requirements
                        </div>
                        <hr className="sd-divider" />
                        <div className="srq-chem-list">
                            {request.chemical_items?.map((item, idx) => (
                                <div key={idx} className="srq-chem-card">
                                    <div className="srq-chem-top">
                                        <span className="srq-chem-name">{item.chemical_name}</span>
                                        <span className="srq-chem-qty">{item.quantity}<span className="srq-chem-unit"> {item.unit}</span></span>
                                    </div>
                                    {item.actual_used_quantity != null && ['reported', 'completed'].includes(request.status) && (
                                        <div className="srq-chem-top" style={{ marginTop: 4 }}>
                                            <span className="srq-chem-name" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>Actual Used</span>
                                            <span className="srq-chem-qty" style={{ fontSize: 13, fontWeight: 600 }}>{item.actual_used_quantity}<span className="srq-chem-unit"> {item.unit}</span></span>
                                        </div>
                                    )}
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
                            <div className="srq-meta-grid">
                                <div className="sd-meta-item">
                                    <div className="sd-meta-label">Experiment Name(s)</div>
                                    <div className="sd-meta-value">{request.experiment_name || '-'}</div>
                                </div>
                                {request.purpose_type === 'research_project' && (
                                    <div className="sd-meta-item">
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

                {/* Header */}
                <div className="srq-header">
                    <div className="srq-header-left">
                        <div className="sd-back-row" onClick={() => navigate('/requests')}>
                            <FaArrowLeft />
                            <span>Request Details</span>
                        </div>
                    </div>
                    <div className="srq-header-actions">
                        <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                            <FaPrint />
                        </button>
                    </div>
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
                    <div className="srq-meta-grid">
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
                        <div className="sd-meta-item">
                            <div className="sd-meta-label">Venue</div>
                            <div className="sd-meta-value">{request.venue || '-'}</div>
                        </div>
                    </div>
                </div>

                {/* Chemical Requirements Card */}
                <div className="sd-card">
                    <div className="srq-card-title-row">
                        <div className="sd-card-title">
                            <FaFlask /> Chemical Requirements
                        </div>
                        {isHOD && request.status === 'pending' && (
                            <button
                                type="button"
                                className={`srq-chem-edit-btn ${editMode ? 'active' : ''}`}
                                onClick={toggleEditMode}
                                title={editMode ? 'Done editing quantities' : 'Edit quantities'}
                            >
                                <FaEdit /> {editMode ? 'Done' : 'Edit'}
                            </button>
                        )}
                    </div>
                    <hr className="sd-divider" />
                    {acceptError && <div className="error-banner">{acceptError}</div>}
                    {editMode ? (
                        <div className="sd-usage-table">
                            {request.chemical_items?.map((item) => {
                                const err = rowError(item, editQuantities[item.id]);
                                const stock = availFor(item);
                                const hasStock = stock !== undefined;
                                const remainingQty = hasStock ? fmtQty(stock.remaining ?? stock.quantity) : null;
                                const remainingUnit = hasStock ? (stock.unit || item.unit) : item.unit;
                                return (
                                    <div key={item.id} className="srq-chem-edit-row">
                                        <div className="srq-chem-edit-name">
                                            <span className="sd-usage-name">{item.chemical_name}</span>
                                        </div>
                                        <div className="srq-chem-qty-group">
                                            <div className="srq-chem-qty-item">
                                                <span className="srq-chem-qty-label">Requested</span>
                                                <div className="sd-usage-input-wrap">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={editQuantities[item.id] ?? item.quantity}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const n = parseFloat(raw);
                                                            if (raw === '' || Number.isNaN(n) || n <= 0) {
                                                                setEditQuantities({ ...editQuantities, [item.id]: item.quantity });
                                                            } else {
                                                                setEditQuantities({ ...editQuantities, [item.id]: raw });
                                                            }
                                                            if (acceptError) setAcceptError('');
                                                        }}
                                                        className={`sd-usage-input ${err ? 'input-error' : ''}`}
                                                    />
                                                    <span className="sd-input-unit">{item.unit}</span>
                                                </div>
                                            </div>
                                            <div className="srq-chem-qty-item">
                                                <span className="srq-chem-qty-label">Stock Available</span>
                                                <span className="srq-chem-qty">
                                                    {remainingQty !== null ? remainingQty : '—'}
                                                    {remainingQty !== null && <span className="srq-chem-unit"> {remainingUnit}</span>}
                                                </span>
                                            </div>
                                        </div>
                                        {err && (
                                            <div className="srq-chem-edit-error">
                                                <FaExclamationTriangle /> {err}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {(!request.chemical_items || request.chemical_items.length === 0) && (
                                <div className="sd-empty-text">No chemicals listed</div>
                            )}
                        </div>
                    ) : (
                        <div className="srq-chem-list">
                            {request.chemical_items?.map((item, idx) => {
                                const stock = availFor(item);
                                const hasStock = stock !== undefined;
                                const remainingQty = hasStock ? fmtQty(stock.remaining ?? stock.quantity) : null;
                                const remainingUnit = hasStock ? (stock.unit || item.unit) : item.unit;
                                return (
                                <div key={idx} className="srq-chem-card">
                                    <div className="srq-chem-top">
                                        <span className="srq-chem-name">{item.chemical_name}</span>
                                        <div className="srq-chem-qty-group">
                                            <div className="srq-chem-qty-item">
                                                <span className="srq-chem-qty-label">Requested</span>
                                                <span className="srq-chem-qty">{editQuantities[item.id] ?? item.quantity}<span className="srq-chem-unit"> {item.unit}</span></span>
                                            </div>
                                            {isHOD && (
                                                <div className="srq-chem-qty-item srq-chem-stock-desktop">
                                                    <span className="srq-chem-qty-label">Stock Available</span>
                                                    <span className="srq-chem-qty">{remainingQty !== null ? remainingQty : '—'}<span className="srq-chem-unit"> {remainingQty !== null ? remainingUnit : ''}</span></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isHOD && (
                                        <div className="srq-chem-stock-row">
                                            <span className="srq-chem-qty-label">Stock Available</span>
                                            <span className="srq-chem-qty">{remainingQty !== null ? remainingQty : '—'}<span className="srq-chem-unit"> {remainingQty !== null ? remainingUnit : ''}</span></span>
                                        </div>
                                    )}
                                    {item.actual_used_quantity != null && ['reported', 'completed'].includes(request.status) && (
                                        <div className="srq-chem-top" style={{ marginTop: 4 }}>
                                            <span className="srq-chem-name" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>Actual Used</span>
                                            <span className="srq-chem-qty" style={{ fontSize: 13, fontWeight: 600 }}>{item.actual_used_quantity}<span className="srq-chem-unit"> {item.unit}</span></span>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                            {(!request.chemical_items || request.chemical_items.length === 0) && (
                                <div className="sd-empty-text">No chemicals listed</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Purpose Type Card */}
                {request.purpose_type && (
                    <div className="sd-card">
                        <div className="sd-card-title">
                            {request.purpose_type === 'research_project' ? 'Research / Project' : 'Practical Lab'}
                        </div>
                        <hr className="sd-divider" />
                        <div className="srq-meta-grid">
                            <div className="sd-meta-item">
                                <div className="sd-meta-label">Experiment Name(s)</div>
                                <div className="sd-meta-value">{request.experiment_name || '-'}</div>
                            </div>
                            {request.purpose_type === 'research_project' && (
                                <div className="sd-meta-item">
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

                        {/* Desktop Table */}
                        <div className="vc-table-wrap">
                            <table className="vc-table">
                                <thead>
                                    <tr>
                                        <th className="vc-th-left">Chemical</th>
                                        <th className="vc-th-right">Requested</th>
                                        <th className="vc-th-right">Actual Used</th>
                                        <th className="vc-th-right">Returned</th>
                                        <th className="vc-th-right">Additional</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.chemical_items?.map(item => {
                                        const req = parseFloat(item.quantity) || 0;
                                        const act = parseFloat(item.actual_used_quantity) || 0;
                                        const ret = Math.max(0, req - act);
                                        const add = Math.max(0, act - req);
                                        return (
                                            <tr key={item.id}>
                                                <td className="vc-td-name">{item.chemical_name}</td>
                                                <td className="vc-td-right"><span className="vc-badge vc-badge-muted">{req} {item.unit}</span></td>
                                                <td className="vc-td-right"><span className="vc-badge vc-badge-primary">{act} {item.unit}</span></td>
                                                <td className="vc-td-right">{ret > 0 ? <span className="vc-diff vc-diff-positive"><FaArrowLeft /> {ret.toFixed(2)} {item.unit}</span> : <span className="vc-diff-none">—</span>}</td>
                                                <td className="vc-td-right">{add > 0 ? <span className="vc-diff vc-diff-negative"><FaArrowRight /> {add.toFixed(2)} {item.unit}</span> : <span className="vc-diff-none">—</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="vc-cards">
                            {request.chemical_items?.map(item => {
                                const req = parseFloat(item.quantity) || 0;
                                const act = parseFloat(item.actual_used_quantity) || 0;
                                const ret = Math.max(0, req - act);
                                const add = Math.max(0, act - req);
                                return (
                                    <div key={item.id} className="vc-card">
                                        <div className="vc-card-header">{item.chemical_name}</div>
                                        <div className="vc-card-row">
                                            <span className="vc-card-label">Requested</span>
                                            <span className="vc-badge vc-badge-muted">{req} {item.unit}</span>
                                        </div>
                                        <div className="vc-card-row">
                                            <span className="vc-card-label">Actual Used</span>
                                            <span className="vc-badge vc-badge-primary">{act} {item.unit}</span>
                                        </div>
                                        <div className="vc-card-row">
                                            <span className="vc-card-label">Returned</span>
                                            {ret > 0 ? <span className="vc-diff vc-diff-positive"><FaArrowLeft /> {ret.toFixed(2)} {item.unit}</span> : <span className="vc-diff-none">—</span>}
                                        </div>
                                        <div className="vc-card-row">
                                            <span className="vc-card-label">Additional</span>
                                            {add > 0 ? <span className="vc-diff vc-diff-negative"><FaArrowRight /> {add.toFixed(2)} {item.unit}</span> : <span className="vc-diff-none">—</span>}
                                        </div>
                                    </div>
                                );
                            })}
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
                        <div className="srq-chem-list">
                            {request.chemical_items?.map(item => (
                                <div key={item.id} className="srq-chem-card">
                                    <div className="srq-chem-top">
                                        <span className="srq-chem-name">{item.chemical_name}</span>
                                        <span className="srq-chem-qty">{item.actual_used_quantity}<span className="srq-chem-unit"> {item.unit}</span></span>
                                    </div>
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

                {/* Owner Cancel Pending Request */}
                {isStaff && user?.employee_id === request.requested_by_id && request.status === 'pending' && (
                    <div className="sd-actions">
                        <button className="sd-btn sd-btn-danger sd-btn-full" onClick={() => setShowCancelModal(true)} disabled={actionLoading}>
                            <FaTimesCircle /> Cancel & Release Stock
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
                    {isStoreKeeper && STOREKEEPER_DELETABLE_STATUSES.includes(request.status) && (
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

            {/* Cancel / Release Stock Modal */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Cancel Request</h3>
                            <button type="button" className="modal-close" onClick={() => setShowCancelModal(false)} aria-label="Close">×</button>
                        </div>
                        <div className="modal-body">
                            <p className="sd-section-helper">This will cancel the request. Reason is optional.</p>
                            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)..." rows={4} className="modern-textarea" style={{ width: '100%', marginTop: '8px' }} />
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={() => { setShowCancelModal(false); setCancelReason(''); }} disabled={actionLoading}>Close</button>
                            <button type="button" className="btn-reject" onClick={handleReleaseCancel} disabled={actionLoading}>{actionLoading ? 'Processing...' : 'Cancel & Release'}</button>
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
