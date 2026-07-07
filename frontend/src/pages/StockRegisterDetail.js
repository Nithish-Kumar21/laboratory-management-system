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
              {stockRegister.supplier_contact_phone && (
                <div className="sd-meta-item">
                  <div className="sd-meta-label">Supplier Contact</div>
                  <div className="sd-meta-value">{stockRegister.supplier_contact_country_code || ''} {stockRegister.supplier_contact_phone}</div>
                </div>
              )}
              {stockRegister.supplier_email && (
                <div className="sd-meta-item">
                  <div className="sd-meta-label">Supplier Email</div>
                  <div className="sd-meta-value">{stockRegister.supplier_email}</div>
                </div>
              )}
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
                  <div key={item.id} className="sd-chem-item">
                    <div className="sd-item-row-1">
                      <span className="sd-item-name">{item.chemical_name}</span>
                      {item.total_price != null && (
                        <span className="sd-item-total">₹{parseFloat(item.total_price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="sd-item-row-2">
                      <span className="sd-item-detail">{item.pack_size}<span className="sd-item-unit"> {item.unit} × {item.no_of_packs || 1} packs</span></span>
                      <span className="sd-item-make">{item.make || '-'}</span>
                    </div>
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
                  <div key={item.id} className="sd-chem-item">
                    <div className="sd-item-row-1">
                      <span className="sd-item-name">{item.apparatus_name}</span>
                      {item.total_price != null && (
                        <span className="sd-item-total">₹{parseFloat(item.total_price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="sd-item-row-2">
                      <span className="sd-item-detail">{item.quantity_pieces}<span className="sd-item-unit"> pcs × ₹{parseFloat(item.rate).toFixed(2)}/pc</span></span>
                      <span className="sd-item-make">{item.make || '-'}</span>
                    </div>
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
