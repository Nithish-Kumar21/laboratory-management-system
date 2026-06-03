import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaPrint, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './DamagedEntryDetail.css';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DamagedEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStaff, isStoreKeeper, isHOD } = useAuth();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, onConfirm: null });

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/damaged_entry/${id}/`)
      .then(res => { setEntry(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Failed to load'); setLoading(false); });
  }, [id, isStaff, navigate]);

  const handleDelete = () => {
    setDialog({ open: true, message: 'Delete this damaged entry? The damaged item quantities will be restored to inventory.', showCancel: true, onConfirm: runDelete });
  };

  const runDelete = () => {
    setDeleting(true);
    api.delete(`/damaged_entry/${id}/`)
      .then(() => { window.dispatchEvent(new Event('inventory-updated')); navigate('/damaged-entry'); })
      .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Delete failed', showCancel: false }))
      .finally(() => setDeleting(false));
  };

  if (loading) return <div className="loading-spinner" />;
  if (error) return <div className="error-message">{error}</div>;
  if (!entry) return null;

  const ref = `DMG-${String(entry.id).padStart(3, '0')}`;
  const itemNames = entry.damaged_items?.map(i => i.apparatus_name).join(', ') || '—';
  const totalQty = entry.damaged_items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
  const reason = entry.caused_by || '—';
  const actionTaken = entry.details || '—';
  const status = 'Logged';
  const statColor = '#E65100';

  const tlDates = [
    { label: 'Date Logged', date: fmtDate(entry.date) },
    { label: 'Date Reviewed', date: '—' },
    { label: 'Date Resolved', date: '—' },
    { label: 'Last Updated', date: fmtDate(entry.date) },
  ];

  return (
    <div className="ded-page animate-up">
      {/* ===== TOP BAR ===== */}
      <div className="ded-topbar">
        <div className="ded-topbar-left">
          <button className="ded-back-btn" onClick={() => navigate('/damaged-entry')}>
            <FaArrowLeft />
          </button>
          <span className="ded-topbar-title">Damaged Entry Details</span>
          <span className="ded-ref-pill">{ref}</span>
          <div className="ded-status-inline" style={{ color: statColor }}>
            <span className="ded-si-dot" style={{ background: statColor }} />
            {status}
          </div>
        </div>
        <button className="ded-print-btn" onClick={() => window.print()}>
          <FaPrint /> Print
        </button>
      </div>

      {/* ===== MOBILE STATUS BADGE ===== */}
      <div className="ded-mobile-status">
        <span className="ded-ms-dot" style={{ background: statColor }} />
        <span className="ded-ms-text" style={{ color: statColor }}>{status}</span>
      </div>

      <div className="ded-body">
        {/* ===== DESKTOP ROW: ENTRY INFO + ITEM DETAILS ===== */}
        <div className="ded-row-2">
          {/* --- Card 1: ENTRY INFO --- */}
          <div className="ded-card ded-card-orange">
            <div className="ded-section-label">ENTRY INFO</div>
            <div className="ded-grid-2x2">
              <div className="ded-gitem">
                <div className="ded-glabel">DMG Reference</div>
                <div className="ded-gvalue">{ref}</div>
              </div>
              <div className="ded-gitem">
                <div className="ded-glabel">Date Logged</div>
                <div className="ded-gvalue">{formatDate(entry.date)}</div>
              </div>
              <div className="ded-gitem">
                <div className="ded-glabel">Logged By</div>
                <div className="ded-gvalue">{entry.staff || '—'}</div>
              </div>
              <div className="ded-gitem">
                <div className="ded-glabel">Type</div>
                <div className="ded-gvalue">
                  <span className="ded-type-badge ded-type-apparatus">Apparatus</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- Card 2: ITEM DETAILS --- */}
          <div className="ded-card ded-card-orange">
            <div className="ded-section-label">ITEM DETAILS</div>
            <div className="ded-grid-2x2">
              <div className="ded-gitem">
                <div className="ded-glabel">Item Name</div>
                <div className="ded-gvalue">{itemNames}</div>
              </div>
              <div className="ded-gitem">
                <div className="ded-glabel">Category</div>
                <div className="ded-gvalue">—</div>
              </div>
              <div className="ded-gitem">
                <div className="ded-glabel">Quantity Damaged</div>
                <div className="ded-gvalue ded-qty-damaged">{totalQty}</div>
              </div>
              <div className="ded-gitem">
                <div className="ded-glabel">Unit</div>
                <div className="ded-gvalue">pcs</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== CARD 3: DAMAGE INFORMATION ===== */}
        <div className="ded-card ded-card-orange">
          <div className="ded-section-label">DAMAGE INFORMATION</div>
          <div className="ded-damage-row">
            <div className="ded-damage-reason">
              <div className="ded-glabel">Reason for Damage</div>
              <div className="ded-damage-value">{reason}</div>
            </div>
            <div className="ded-damage-severity-box">
              <div className="ded-glabel">Damage Severity</div>
              <span className="ded-sev-badge">—</span>
            </div>
            <div className="ded-damage-action">
              <div className="ded-glabel">Action Taken</div>
              <div className="ded-damage-value">{actionTaken}</div>
            </div>
          </div>
        </div>

        {/* ===== CARD 4: TIMELINE ===== */}
        <div className="ded-card">
          <div className="ded-section-label">TIMELINE</div>

          {/* Desktop: Horizontal stepper */}
          <div className="ded-stepper">
            {tlDates.map((tl, i) => (
              <React.Fragment key={tl.label}>
                {i > 0 && (
                  <div className={`ded-conn ${tl.date !== '—' ? 'ded-conn-done' : 'ded-conn-pend'}`} />
                )}
                <div className={`ded-step ${tl.date !== '—' ? 'ded-step-done' : 'ded-step-pend'}`}>
                  <div className="ded-step-dot-wrap">
                    <div className={`ded-step-dot ${tl.date !== '—' ? 'ded-dot-filled' : 'ded-dot-empty'}`} />
                  </div>
                  <div className="ded-step-lbl">{tl.label}</div>
                  <div className="ded-step-date">{tl.date}</div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Mobile: 2×2 grid */}
          <div className="ded-tl-grid">
            {tlDates.map(tl => (
              <div key={tl.label} className="ded-tl-gitem">
                <div className="ded-tl-glabel">{tl.label}</div>
                <div className="ded-tl-gvalue">{tl.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== DANGER ZONE ===== */}
        {isStoreKeeper && (
          <div className="ded-card">
            <div className="ded-danger-box">
              <div className="ded-danger-left">
                <div className="ded-danger-title">⚠️ Danger Zone</div>
                <div className="ded-danger-sub">Deleting this record will not restore the damaged item quantity.</div>
              </div>
              <button className="ded-danger-btn" onClick={handleDelete} disabled={deleting}>
                🗑 {deleting ? 'Deleting...' : 'Delete Entry'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={dialog.open}
        title="Confirm Delete"
        message={dialog.message}
        showCancel={dialog.showCancel}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { dialog.onConfirm?.(); if (!dialog.showCancel) setDialog({ open: false }); }}
        onCancel={() => setDialog({ open: false })}
      />
    </div>
  );
}

export default DamagedEntryDetail;
