import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaExclamationTriangle, FaTools, FaPrint, FaEdit, FaEllipsisV, FaTrash } from 'react-icons/fa';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/damaged_entry/${id}/`)
      .then(res => { setEntry(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Load failed'); setLoading(false); });
  }, [id, isStaff, navigate]);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
  const totalItemsDamaged = damagedItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

  return (
    <div className="staff-detail-wrapper">
      <div className="staff-detail-page animate-up">
        <div className="staff-detail-inner">

          {/* Header */}
          <div className="dgd-header">
            <div className="sd-back-row" onClick={() => navigate('/damaged-entry')}>
              <FaArrowLeft />
              <span>Damaged Entry Details</span>
            </div>
            <div className="dgd-header-actions">
              <div className="dgd-desktop-actions">
                <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                  <FaPrint />
                </button>
                <button className="sd-action-icon-btn" title="Edit (coming soon)" disabled style={{ opacity: 0.4 }}>
                  <FaEdit />
                </button>
              </div>
              <div className="dgd-mobile-menu" ref={menuRef}>
                <button className="sd-action-icon-btn" onClick={() => setMenuOpen(!menuOpen)} title="More actions">
                  <FaEllipsisV />
                </button>
                {menuOpen && (
                  <div className="dgd-dropdown">
                    <button className="dgd-dropdown-item" onClick={() => { setMenuOpen(false); window.print(); }}>
                      <FaPrint /> Print
                    </button>
                    <button className="dgd-dropdown-item" disabled style={{ opacity: 0.4 }}>
                      <FaEdit /> Edit
                    </button>
                    {isStoreKeeper && (
                      <button className="dgd-dropdown-item dgd-dropdown-danger" onClick={() => { setMenuOpen(false); handleDelete(); }}>
                        <FaTrash /> Delete Entry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Line */}
          <div className="dgd-summary">
            <span className="sd-req-id">REF: DMG-{String(entry.id).padStart(3, '0')}</span>
            <span className="dgd-total-value">Total Items Damaged: {totalItemsDamaged}</span>
          </div>

          {/* Metadata Section */}
          <div className="sd-card">
            <div className="dgd-meta-grid">
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
              <div className="sd-meta-item">
                <div className="sd-meta-label">Day Order</div>
                <div className="sd-meta-value">{entry.day_order || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Hour</div>
                <div className="sd-meta-value">{entry.hour?.length ? entry.hour.join(', ') : '—'}</div>
              </div>
            </div>
          </div>

          {/* Damaged Items */}
          {damagedItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaTools /> Damaged Items
              </div>
              <div className="dgd-item-list">
                {damagedItems.map(item => (
                  <div key={item.id} className="dgd-item-card">
                    <div className="dgd-item-top">
                      <span className="dgd-item-name">{item.apparatus_name}</span>
                      <span className="dgd-item-qty">{item.quantity}<span className="dgd-item-unit"> pcs</span></span>
                    </div>
                    {item.caused_by && (
                      <div className="dgd-item-subtitle">Caused By: {item.caused_by}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incident Details */}
          {entry.details && (
            <div className="sd-card">
              <div className="sd-card-title">Incident Details</div>
              <hr className="sd-divider" />
              <p className="sd-remarks-text">{entry.details}</p>
            </div>
          )}

          {/* Desktop Delete */}
          {isStoreKeeper && (
            <div className="dgd-delete-row">
              <button className="dgd-delete-btn" onClick={handleDelete} disabled={deleting}>
                <FaTrash /> {deleting ? 'Removing...' : 'Delete Entry'}
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
