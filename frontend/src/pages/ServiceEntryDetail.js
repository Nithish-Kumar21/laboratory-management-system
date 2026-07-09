import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaTools, FaCheck, FaUndo, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './DamagedEntryDetail.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function extractErrorMessages(err) {
  if (typeof err === 'string') return [err];
  if (err === null || err === undefined) return [];
  if (Array.isArray(err)) return err.flatMap(extractErrorMessages);
  if (typeof err === 'object') return Object.values(err).flatMap(extractErrorMessages);
  return [String(err)];
}

function ServiceEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isStaff, isStoreKeeper } = useAuth();
  const [detailTab, setDetailTab] = useState('service');
  const [actionPopup, setActionPopup] = useState({ open: false, itemId: null, actionType: '', quantity: '', error: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  const fetchEntry = () => {
    api.get(`/service-entries/${id}/`)
      .then(res => { setEntry(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Load failed'); setLoading(false); });
  };

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    fetchEntry();
  }, [id, isStaff, navigate]);

  const openActionPopup = (itemId, actionType) => {
    setActionPopup({ open: true, itemId, actionType, quantity: '', error: '' });
  };

  const submitAction = async () => {
    if (actionLoading || !actionPopup.quantity) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/service-entries/${id}/action_item/?item_id=${actionPopup.itemId}`, {
        action_type: actionPopup.actionType,
        quantity: parseInt(actionPopup.quantity),
      });
      setEntry(res.data);
      setActionPopup({ open: false, itemId: null, actionType: '', quantity: '', error: '' });
    } catch (err) {
      const serverErr = err.response?.data;
      const msg = serverErr?.error || (typeof serverErr === 'object' && serverErr !== null ? extractErrorMessages(serverErr).join('; ') : '') || 'Action failed';
      setActionPopup(prev => ({ ...prev, error: msg }));
    } finally {
      setActionLoading(false);
    }
  };

  const allComplete = entry?.items?.every(it => it.quantity_remaining === 0);

  if (loading) return <div className="loading-spinner" />;
  if (error) return <div className="error-message">{error}</div>;
  if (!entry) return null;

  const getQuantityField = (item) => {
    if (detailTab === 'service') return { label: 'In Service', value: item.quantity_remaining };
    if (detailTab === 'returned') return { label: 'Repaired', value: item.quantity_repaired };
    return { label: 'Damaged', value: item.quantity_damaged };
  };

  return (
    <div className="staff-detail-wrapper">
      <div className="staff-detail-page animate-up">
        <div className="staff-detail-inner">

          <div className="sd-back-row" onClick={() => navigate('/damaged-entry')}>
            <FaArrowLeft />
            <span>Service Entry Details</span>
          </div>

          {/* Card 1: Header Summary */}
          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-req-id">REF: {entry.service_code}</span>
              <span className={`status-badge-modern ${entry.status === 'completed' ? 'status-completed' : 'status-warning'}`}>
                {entry.status === 'completed' ? 'Completed' : 'In Service'}
              </span>
            </div>
            <hr className="sd-divider" />
            <div className="sd-meta-grid">
              <div className="sd-meta-item">
                <div className="sd-meta-label">Date</div>
                <div className="sd-meta-value">{formatDate(entry.date)}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Store Keeper</div>
                <div className="sd-meta-value">{entry.storekeeper || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Service Person</div>
                <div className="sd-meta-value">{entry.service_person_name || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Contact</div>
                <div className="sd-meta-value">{entry.contact_country_code || ''} {entry.contact_number || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Email</div>
                <div className="sd-meta-value">{entry.email || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Tentative Delivery</div>
                <div className="sd-meta-value">{entry.deliver_by_date ? formatDate(entry.deliver_by_date) : '—'}</div>
              </div>
            </div>
            {entry.completed_at && (
              <p style={{ marginTop: '16px', fontSize: '13px', color: '#9AA3AF' }}>
                Completed on: {new Date(entry.completed_at).toLocaleString('en-GB')}
              </p>
            )}
          </div>

          {/* Card 2: Apparatus Status with radio tabs */}
          <div className="sd-card">
            <div className="sd-card-title"><FaTools /> Apparatus Status</div>
            <hr className="sd-divider" />

            {/* Radio-style tabs */}
            <div className="de-tabs" style={{ marginBottom: '16px' }}>
              <button
                className={`de-tab ${detailTab === 'service' ? 'active' : ''}`}
                onClick={() => setDetailTab('service')}
              >
                Service
              </button>
              <button
                className={`de-tab ${detailTab === 'returned' ? 'active' : ''}`}
                onClick={() => setDetailTab('returned')}
              >
                Returned
              </button>
              <button
                className={`de-tab ${detailTab === 'damaged' ? 'active' : ''}`}
                onClick={() => setDetailTab('damaged')}
              >
                Damaged
              </button>
            </div>

            <div className="sd-chem-list">
              {entry.items.map(item => {
                const qf = getQuantityField(item);
                return (
                  <div key={item.id} className="sd-chem-row multi-col">
                    <span className="sd-chem-name">{item.apparatus_name}</span>
                    <span className="sd-chem-qty">{qf.value}<span className="sd-chem-unit"> pcs</span></span>
                    {detailTab === 'service' && isStoreKeeper && entry.status === 'in_service' && (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="sd-action-btn repaired-btn"
                          onClick={() => openActionPopup(item.id, 'repaired')}
                          disabled={item.quantity_remaining === 0}
                          title={item.quantity_remaining === 0 ? 'No items remaining' : 'Mark as repaired'}
                        >
                          <FaCheck /> Repaired
                        </button>
                        <button
                          className="sd-action-btn damaged-btn"
                          onClick={() => openActionPopup(item.id, 'damaged')}
                          disabled={item.quantity_remaining === 0}
                          title={item.quantity_remaining === 0 ? 'No items remaining' : 'Mark as damaged'}
                        >
                          <FaTrash /> Damaged
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete button */}
          {isStoreKeeper && entry.status === 'in_service' && (
            <div className="sd-actions">
              <button
                className="sd-btn sd-complete-btn"
                disabled={!allComplete || completing}
                onClick={async () => {
                  setCompleting(true);
                  setCompleteError('');
                  try {
                    await api.post(`/service-entries/${id}/complete/`);
                    navigate('/damaged-entry');
                  } catch (err) {
                    const serverErr = err.response?.data;
                    const msg = serverErr?.error || (typeof serverErr === 'object' && serverErr !== null ? extractErrorMessages(serverErr).join('; ') : '') || 'Failed to complete';
                    setCompleteError(msg);
                    setCompleting(false);
                  }
                }}
                title={!allComplete ? 'All items must reach zero remaining' : 'Complete this service entry'}
              >
                <FaCheck /> {completing ? 'Completing...' : 'Complete Entry'}
              </button>
              {completeError && (
                <p style={{ marginTop: '8px', fontSize: '13px', color: '#EF4444' }}>{completeError}</p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Action Popup */}
      {actionPopup.open && (
        <div className="modal-overlay-modern" onClick={() => setActionPopup({ ...actionPopup, open: false })}>
          <div className="modal-content-modern" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header-modern">
              <h2>{actionPopup.actionType === 'repaired' ? 'Mark as Repaired' : 'Mark as Damaged'}</h2>
              <button className="close-btn-modern" onClick={() => setActionPopup({ ...actionPopup, open: false })}>&times;</button>
            </div>
            <div className="modal-body-scroll">
              <p style={{ marginBottom: '16px', fontSize: '14px', color: '#4A4A4A' }}>
                Enter the quantity to mark as <strong>{actionPopup.actionType}</strong>:
              </p>
              <input
                type="number"
                min="1"
                className="nrf-input"
                placeholder="Quantity"
                value={actionPopup.quantity}
                onChange={e => setActionPopup({ ...actionPopup, quantity: e.target.value })}
                autoFocus
              />
              {actionPopup.error && (
                <p style={{ marginTop: '8px', fontSize: '13px', color: '#EF4444' }}>{actionPopup.error}</p>
              )}
            </div>
            <div className="modal-footer-modern">
              <button className="btn-text" onClick={() => setActionPopup({ ...actionPopup, open: false })}>Cancel</button>
              <button className="btn-primary" onClick={submitAction} disabled={actionLoading || !actionPopup.quantity}>
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceEntryDetail;
