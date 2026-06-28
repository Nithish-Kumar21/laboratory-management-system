import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaExclamationTriangle, FaTools, FaPrint } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './DamagedEntryDetail.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function DamagedEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isStaff, isStoreKeeper } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, onConfirm: null });

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/damaged_entry/${id}/`)
      .then(res => { setEntry(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Load failed'); setLoading(false); });
  }, [id, isStaff, navigate]);

  const runDelete = () => {
    setDeleting(true);
    api.delete(`/damaged_entry/${id}/`)
      .then(() => { window.dispatchEvent(new Event('inventory-updated')); navigate('/damaged-entry'); })
      .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Delete failed', showCancel: false }))
      .finally(() => setDeleting(false));
  };

  const handleDelete = () => {
    setDialog({ open: true, message: 'Delete this damaged entry? Inventory will be reverted.', showCancel: true, onConfirm: runDelete });
  };

  if (loading) return <div className="loading-spinner" />;
  if (error) return <div className="error-message">{error}</div>;
  if (!entry) return null;

  const damagedItems = entry.damaged_items || [];

  return (
    <div className="staff-detail-wrapper">
      <div className="staff-detail-page animate-up">
        <div className="staff-detail-inner">

          <div className="sd-back-row" onClick={() => navigate('/damaged-entry')}>
            <FaArrowLeft />
            <span>Damaged Entry Details</span>
          </div>

          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-req-id">REF: DMG-{String(entry.id).padStart(3, '0')}</span>
              <div className="sd-header-right">
                <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                  <FaPrint />
                </button>
              </div>
            </div>
            <hr className="sd-divider" />
            <div className="sd-meta-grid">
              <div className="sd-meta-item">
                <div className="sd-meta-label">Staff Name</div>
                <div className="sd-meta-value">{entry.staff || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Class / Division</div>
                <div className="sd-meta-value">{entry.class_name || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Date of Incident</div>
                <div className="sd-meta-value">{formatDate(entry.date)}</div>
              </div>
            </div>
          </div>

          {damagedItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaTools /> Damaged Items
              </div>
              <hr className="sd-divider" />
              <div className="sd-chem-list">
                {damagedItems.map(item => (
                  <div key={item.id} className="sd-chem-row multi-col">
                    <span className="sd-chem-name">{item.apparatus_name}</span>
                    <span className="sd-chem-qty">{item.quantity}<span className="sd-chem-unit"> pcs</span></span>
                    <span className="sd-chem-rate">{item.caused_by || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.details && (
            <div className="sd-card">
              <div className="sd-card-title">Incident Details</div>
              <hr className="sd-divider" />
              <p className="sd-remarks-text">{entry.details}</p>
            </div>
          )}

          {isStoreKeeper && (
            <div className="sd-actions">
              <button className="sd-btn sd-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Removing...' : 'Permanently Delete Entry'}
              </button>
            </div>
          )}

        </div>
      </div>

      <ConfirmDialog
        open={dialog.open}
        message={dialog.message}
        showCancel={dialog.showCancel}
        confirmLabel="OK"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { dialog.onConfirm?.(); if (!dialog.showCancel) setDialog({ open: false }); }}
        onCancel={() => setDialog({ open: false })}
      />
    </div>
  );
}

export default DamagedEntryDetail;
