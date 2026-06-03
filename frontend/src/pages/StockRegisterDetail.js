import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaBoxes, FaPrint } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './StockRegisterDetail.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function StockRegisterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stockRegister, setStockRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isStaff, isStoreKeeper } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState({ open: false, message: '', showCancel: true, onConfirm: null });

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/stock_register/${id}/`)
      .then(res => { setStockRegister(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Load failed'); setLoading(false); });
  }, [id, isStaff, navigate]);

  const runDelete = () => {
    setDeleting(true);
    api.delete(`/stock_register/${id}/`)
      .then(() => { window.dispatchEvent(new Event('inventory-updated')); navigate('/stock-register'); })
      .catch(err => setDialog({ open: true, message: err.response?.data?.error || 'Delete failed', showCancel: false }))
      .finally(() => setDeleting(false));
  };

  const handleDelete = () => {
    setDialog({ open: true, message: 'Delete this entry? Inventory will be reverted.', showCancel: true, onConfirm: runDelete });
  };

  if (loading) return <div className="loading-spinner" />;
  if (error) return <div className="error-message">{error}</div>;
  if (!stockRegister) return null;

  const chemItems = stockRegister.chemical_items || [];
  const appItems = stockRegister.apparatus_items || [];
  const chemCount = chemItems.length;
  const appCount = appItems.length;

  return (
    <div className="srd-page animate-up">
      {/* ===== STICKY TOP BAR ===== */}
      <div className="srd-topbar">
        {/* ---- Desktop ---- */}
        <div className="srd-topbar-desktop-content">
          <div className="srd-topbar-left">
            <button className="srd-back-btn" onClick={() => navigate('/stock-register')}>
              <FaArrowLeft />
            </button>
            <div className="srd-topbar-title-group">
              <span className="srd-topbar-title">Stock Entry Details</span>
              <span className="srd-ref-pill">REF: {stockRegister.invoice_number}</span>
            </div>
          </div>
          <button className="srd-print-btn" onClick={() => window.print()}>
            <FaPrint /> Print
          </button>
          <button className="srd-print-icon-btn" onClick={() => window.print()}>
            <FaPrint />
          </button>
        </div>

        {/* ---- Mobile ---- */}
        <div className="srd-topbar-mobile-content">
          <button className="srd-back-btn-mobile" onClick={() => navigate('/stock-register')}>
            <FaArrowLeft />
          </button>
          <span className="srd-topbar-title-mobile">Stock Details</span>
        </div>
      </div>

      <div className="srd-body">
        {/* ===== INFO STRIP (Desktop) ===== */}
        <div className="srd-info-strip">
          <div className="srd-info-card">
            <div className="srd-info-label">Invoice Number</div>
            <div className="srd-info-value">{stockRegister.invoice_number}</div>
          </div>
          <div className="srd-info-card">
            <div className="srd-info-label">Date of Entry</div>
            <div className="srd-info-value">{formatDate(stockRegister.date)}</div>
          </div>
          <div className="srd-info-card">
            <div className="srd-info-label">Added By</div>
            <div className="srd-info-value">{stockRegister.supplier_name}</div>
          </div>
        </div>

        {/* ===== INFO CARD (Mobile) ===== */}
        <div className="srd-mobile-info-card">
          <div className="srd-card-label">INVOICE INFO</div>
          <div className="srd-mobile-info-grid">
            <div className="srd-mobile-info-col">
              <div className="srd-mobile-info-label">Invoice Number</div>
              <div className="srd-mobile-info-value">{stockRegister.invoice_number}</div>
            </div>
            <div className="srd-mobile-info-vdivider" />
            <div className="srd-mobile-info-col">
              <div className="srd-mobile-info-label">Date Received</div>
              <div className="srd-mobile-info-value">{formatDateShort(stockRegister.date)}</div>
            </div>
          </div>
          <div className="srd-mobile-info-hdivider" />
          <div className="srd-mobile-info-bottom">
            <div className="srd-mobile-info-label">Supplier Name</div>
            <div className="srd-mobile-info-value">{stockRegister.supplier_name}</div>
          </div>
        </div>

        {/* ===== CHEMICAL ACQUISITIONS ===== */}
        {chemCount > 0 && (
          <div className="srd-section">
            <div className="srd-section-header">
              <div className="srd-section-title">
                <FaFlask className="srd-section-icon" />
                <span>Chemical Acquisitions</span>
              </div>
              <span className="srd-count-badge chem-badge">{chemCount} items</span>
            </div>

            <div className="srd-mobile-section-top">
              <div className="srd-card-label">CHEMICAL LIST</div>
              <div className="srd-mobile-section-divider" />
            </div>

            <div className="srd-table-wrap">
              <table className="srd-table">
                <thead>
                  <tr>
                    <th className="srd-th-name">Chemical</th>
                    <th className="srd-th-qty">Qty</th>
                    <th className="srd-th-rate">Rate</th>
                    <th className="srd-th-make">Make</th>
                  </tr>
                </thead>
                <tbody>
                  {chemItems.map(item => (
                    <tr key={item.id}>
                      <td className="srd-td-name">{item.chemical_name}</td>
                      <td className="srd-td-qty"><span className="srd-qty-pill">{item.quantity_ml} ml</span></td>
                      <td className="srd-td-rate">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="srd-td-make">{item.make}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== APPARATUS ACQUISITIONS ===== */}
        {appCount > 0 && (
          <div className="srd-section">
            <div className="srd-section-header">
              <div className="srd-section-title">
                <FaBoxes className="srd-section-icon" />
                <span>Apparatus Acquisitions</span>
              </div>
              <span className="srd-count-badge app-badge">{appCount} items</span>
            </div>

            <div className="srd-mobile-section-top">
              <div className="srd-card-label">APPARATUS LIST</div>
              <div className="srd-mobile-section-divider" />
            </div>

            <div className="srd-table-wrap">
              <table className="srd-table">
                <thead>
                  <tr>
                    <th className="srd-th-name">Apparatus</th>
                    <th className="srd-th-qty">Qty</th>
                    <th className="srd-th-rate">Rate</th>
                    <th className="srd-th-make">Make</th>
                  </tr>
                </thead>
                <tbody>
                  {appItems.map(item => (
                    <tr key={item.id}>
                      <td className="srd-td-name">{item.apparatus_name}</td>
                      <td className="srd-td-qty"><span className="srd-qty-pill">{item.quantity_pieces} pcs</span></td>
                      <td className="srd-td-rate">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="srd-td-make">{item.make}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== DANGER ZONE ===== */}
        {isStoreKeeper && (
          <div className="srd-danger-zone">
            <div className="srd-danger-title">⚠️ Danger Zone</div>
            <div className="srd-danger-sub">Deleting this record will permanently undo inventory quantity adjustments.</div>
            <button className="srd-delete-btn" onClick={handleDelete} disabled={deleting}>
              🗑 {deleting ? 'Removing...' : 'Permanently Delete Entry'}
            </button>
          </div>
        )}
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

export default StockRegisterDetail;
