import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaTrash, FaExclamationTriangle, FaTools, FaCalendarAlt, FaUserTie, FaGraduationCap } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './DamagedEntryDetail.css';

function DamagedEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [damagedEntry, setDamagedEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isStaff, isStoreKeeper } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, onConfirm: null });

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/damaged_entry/${id}/`)
      .then(res => { setDamagedEntry(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Load failed'); setLoading(false); });
  }, [id, isStaff, navigate]);

  const handleDelete = () => {
    setDialog({ open: true, message: 'Delete this entry? Inventory will be reverted.', showCancel: true, onConfirm: runDelete });
  };

  const runDelete = () => {
    setDeleting(true);
    api.delete(`/damaged_entry/${id}/`)
      .then(() => { window.dispatchEvent(new Event('inventory-updated')); navigate('/damaged-entry'); })
      .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Delete failed', showCancel: false }))
      .finally(() => setDeleting(false));
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!damagedEntry) return null;

  return (
    <div className="damaged-detail-page animate-up">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate('/damaged-entry')}>
          <FaArrowLeft />
        </button>
        <div className="header-title-box">
          <h2>Incident Report Details</h2>
          <p>ENTRY ID: #{damagedEntry.id}</p>
        </div>
      </div>

      <div className="detail-info-grid">
        <div className="info-card card">
          <label><FaUserTie /> Responsible Staff</label>
          <span>{damagedEntry.staff}</span>
        </div>
        <div className="info-card card">
          <label><FaGraduationCap /> Class / Division</label>
          <span>{damagedEntry.class_name}</span>
        </div>
        <div className="info-card card">
          <label><FaCalendarAlt /> Date of Incident</label>
          <span>{damagedEntry.date}</span>
        </div>
        <div className="info-card card details-full-width">
          <label>Investigation Details</label>
          <span>{damagedEntry.details}</span>
        </div>
      </div>

      {damagedEntry.damaged_items?.length > 0 && (
        <div className="items-section animate-fade">
          <h3><FaTools /> Damaged Apparatus List</h3>
          <div className="card no-padding">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Apparatus Name</th>
                  <th>Quantity Broken</th>
                  <th>Caused By</th>
                </tr>
              </thead>
              <tbody>
                {damagedEntry.damaged_items.map(it => (
                  <tr key={it.id}>
                    <td className="item-name">{it.apparatus_name}</td>
                    <td><span className="qty-badge">{it.quantity} pcs</span></td>
                    <td><span className="cause-tag">{it.caused_by}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isStoreKeeper && (
        <div className="delete-action-box">
          <div className="delete-text">
            <h4><FaExclamationTriangle /> Admin Actions</h4>
            <p>Removing this record will add the damaged quantities back to the available inventory.</p>
          </div>
          <button className="btn-delete-danger" onClick={handleDelete} disabled={deleting}>
            <FaTrash /> {deleting ? 'Reverting...' : 'Delete Incident Report'}
          </button>
        </div>
      )}

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

