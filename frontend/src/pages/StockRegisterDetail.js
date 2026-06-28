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

  return (
    <div className="staff-detail-wrapper">
      <div className="staff-detail-page animate-up">
        <div className="staff-detail-inner">

          <div className="sd-back-row" onClick={() => navigate('/stock-register')}>
            <FaArrowLeft />
            <span>Stock Entry Details</span>
          </div>

          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-req-id">REF: {stockRegister.invoice_number}</span>
              <div className="sd-header-right">
                <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                  <FaPrint />
                </button>
              </div>
            </div>
            <hr className="sd-divider" />
            <div className="sd-meta-grid">
              <div className="sd-meta-item">
                <div className="sd-meta-label">Invoice Number</div>
                <div className="sd-meta-value">{stockRegister.invoice_number}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Date of Entry</div>
                <div className="sd-meta-value">{formatDate(stockRegister.date)}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Supplier Name</div>
                <div className="sd-meta-value">{stockRegister.supplier_name}</div>
              </div>
            </div>
          </div>

          {chemItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaFlask /> Chemical Acquisitions
              </div>
              <hr className="sd-divider" />
              <div className="sd-chem-list">
                {chemItems.map(item => (
                  <div key={item.id} className="sd-chem-row multi-col">
                    <span className="sd-chem-name">{item.chemical_name}</span>
                    <span className="sd-chem-qty">{item.quantity}<span className="sd-chem-unit"> {item.unit || 'ml'}</span></span>
                    <span className="sd-chem-rate">₹{parseFloat(item.rate).toFixed(2)}</span>
                    <span className="sd-chem-make">{item.make || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaBoxes /> Apparatus Acquisitions
              </div>
              <hr className="sd-divider" />
              <div className="sd-chem-list">
                {appItems.map(item => (
                  <div key={item.id} className="sd-chem-row multi-col">
                    <span className="sd-chem-name">{item.apparatus_name}</span>
                    <span className="sd-chem-qty">{item.quantity_pieces}<span className="sd-chem-unit"> pcs</span></span>
                    <span className="sd-chem-rate">₹{parseFloat(item.rate).toFixed(2)}</span>
                    <span className="sd-chem-make">{item.make || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stockRegister.remarks && (
            <div className="sd-card">
              <div className="sd-card-title">Remarks / Description</div>
              <hr className="sd-divider" />
              <p className="sd-remarks-text">{stockRegister.remarks}</p>
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

export default StockRegisterDetail;
