import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaBoxes, FaPrint, FaEdit, FaEllipsisV, FaTrash } from 'react-icons/fa';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/stock_register/${id}/`)
      .then(res => { setStockRegister(res.data); setLoading(false); })
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
  const totalValue = [...chemItems, ...appItems].reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);

  return (
    <div className="staff-detail-wrapper">
      <div className="staff-detail-page animate-up">
        <div className="staff-detail-inner">

          {/* Header */}
          <div className="srd-header">
            <div className="sd-back-row" onClick={() => navigate('/stock-register')}>
              <FaArrowLeft />
              <span>Stock Entry Details</span>
            </div>
            <div className="srd-header-actions">
              <div className="srd-desktop-actions">
                <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                  <FaPrint />
                </button>
                <button className="sd-action-icon-btn" title="Edit (coming soon)" disabled style={{ opacity: 0.4 }}>
                  <FaEdit />
                </button>
              </div>
              <div className="srd-mobile-menu" ref={menuRef}>
                <button className="sd-action-icon-btn" onClick={() => setMenuOpen(!menuOpen)} title="More actions">
                  <FaEllipsisV />
                </button>
                {menuOpen && (
                  <div className="srd-dropdown">
                    <button className="srd-dropdown-item" onClick={() => { setMenuOpen(false); window.print(); }}>
                      <FaPrint /> Print
                    </button>
                    <button className="srd-dropdown-item" disabled style={{ opacity: 0.4 }}>
                      <FaEdit /> Edit
                    </button>
                    {isStoreKeeper && (
                      <button className="srd-dropdown-item srd-dropdown-danger" onClick={() => { setMenuOpen(false); handleDelete(); }}>
                        <FaTrash /> Delete Entry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Line */}
          <div className="srd-summary">
            <span className="sd-req-id">REF: {stockRegister.invoice_number}</span>
            <span className="srd-total-value">Total Value: ₹{totalValue.toFixed(2)}</span>
          </div>

          {/* Metadata Section */}
          <div className="sd-card">
            <div className="srd-meta-grid">
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

          {/* Chemical Acquisitions */}
          {chemItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaFlask /> Chemical Acquisitions
              </div>
              <div className="sd-chem-list">
                {chemItems.map(item => (
                  <div key={item.id} className="sd-chem-item">
                    <div className="srd-item-top">
                      <span className="sd-item-name">{item.chemical_name}</span>
                      {item.total_price != null && (
                        <span className="sd-item-total">₹{parseFloat(item.total_price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="srd-item-make">Make: {item.make || '-'}</div>
                    <div className="srd-card-divider" />
                    <div className="srd-item-stats">
                      <div className="sd-metric">
                        <span className="sd-metric-label">Pack Size</span>
                        <span className="sd-metric-value">{parseFloat(item.pack_size).toLocaleString()} {item.unit}</span>
                      </div>
                      <div className="sd-metric">
                        <span className="sd-metric-label">No. of Packs</span>
                        <span className="sd-metric-value">{item.no_of_packs}</span>
                      </div>
                      <div className="sd-metric">
                        <span className="sd-metric-label">Rate/Pack</span>
                        <span className="sd-metric-value">₹{parseFloat(item.rate).toFixed(2)}</span>
                      </div>
                      <div className="sd-metric">
                        <span className="sd-metric-label">Total Qty</span>
                        <span className="sd-metric-value">{parseFloat(item.total_quantity).toLocaleString()} {item.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apparatus Acquisitions */}
          {appItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaBoxes /> Apparatus Acquisitions
              </div>
              <div className="sd-chem-list">
                {appItems.map(item => (
                  <div key={item.id} className="sd-chem-item">
                    <div className="srd-item-top">
                      <span className="sd-item-name">{item.apparatus_name}</span>
                      {item.total_price != null && (
                        <span className="sd-item-total">₹{parseFloat(item.total_price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="srd-item-make">Make: {item.make || '-'}</div>
                    <div className="srd-card-divider" />
                    <div className="srd-item-stats">
                      <div className="sd-metric">
                        <span className="sd-metric-label">Pieces</span>
                        <span className="sd-metric-value">{item.quantity_pieces} pcs</span>
                      </div>
                      <div className="sd-metric">
                        <span className="sd-metric-label">Rate/Piece</span>
                        <span className="sd-metric-value">₹{parseFloat(item.rate).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {stockRegister.remarks && (
            <div className="sd-card">
              <div className="sd-card-title">Remarks / Description</div>
              <p className="sd-remarks-text">{stockRegister.remarks}</p>
            </div>
          )}

          {/* Desktop Delete */}
          {isStoreKeeper && (
            <div className="srd-delete-row">
              <button className="srd-delete-btn" onClick={handleDelete} disabled={deleting}>
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

export default StockRegisterDetail;
