import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaTrash, FaFlask, FaBoxes, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './StockRegisterDetail.css';

function StockRegisterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stockRegister, setStockRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isStaff, isStoreKeeper } = useAuth();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isStaff) { navigate('/'); return; }
    api.get(`/stock_register/${id}/`)
      .then(res => { setStockRegister(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || 'Load failed'); setLoading(false); });
  }, [id, isStaff, navigate]);

  const handleDelete = async () => {
    if (window.confirm('Delete this entry? Inventory will be reverted.')) {
      setDeleting(true);
      try {
        await api.delete(`/stock_register/${id}/`);
        window.dispatchEvent(new Event('inventory-updated'));
        navigate('/stock-register');
      } catch (err) {
        alert(err.response?.data?.error || 'Delete failed');
      } finally { setDeleting(false); }
    }
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!stockRegister) return null;

  return (
    <div className="stock-detail-page animate-up">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate('/stock-register')}>
          <FaArrowLeft />
        </button>
        <div className="header-title-box">
          <h2>Stock Entry Details</h2>
          <p>REF: {stockRegister.invoice_number}</p>
        </div>
      </div>

      <div className="detail-info-grid">
        <div className="info-card card">
          <label>Invoice Number</label>
          <span>{stockRegister.invoice_number}</span>
        </div>
        <div className="info-card card">
          <label>Date of Entry</label>
          <span>{stockRegister.date}</span>
        </div>
        <div className="info-card card">
          <label>Supplier / Vendor</label>
          <span>{stockRegister.supplier_name || 'Generic Vendor'}</span>
        </div>
      </div>

      {stockRegister.chemical_items?.length > 0 && (
        <div className="items-section animate-fade">
          <h3><FaFlask /> Chemical Acquisitions</h3>
          <div className="card no-padding">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Chemical Name</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Make</th>
                </tr>
              </thead>
              <tbody>
                {stockRegister.chemical_items.map(it => (
                  <tr key={it.id}>
                    <td className="item-name">{it.chemical_name}</td>
                    <td><span className="qty-badge">{it.quantity_ml} ml</span></td>
                    <td>₹{it.rate}</td>
                    <td>{it.make}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stockRegister.apparatus_items?.length > 0 && (
        <div className="items-section animate-fade" style={{ animationDelay: '0.1s' }}>
          <h3><FaBoxes /> Apparatus Acquisitions</h3>
          <div className="card no-padding">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Apparatus Name</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Make</th>
                </tr>
              </thead>
              <tbody>
                {stockRegister.apparatus_items.map(it => (
                  <tr key={it.id}>
                    <td className="item-name">{it.apparatus_name}</td>
                    <td><span className="qty-badge">{it.quantity_pieces} pcs</span></td>
                    <td>₹{it.rate}</td>
                    <td>{it.make}</td>
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
            <h4><FaExclamationTriangle /> Danger Zone</h4>
            <p>Deleting this record will irreversibly undo inventory adjustments.</p>
          </div>
          <button className="btn-delete-danger" onClick={handleDelete} disabled={deleting}>
            <FaTrash /> {deleting ? 'Removing...' : 'Permanently Delete Entry'}
          </button>
        </div>
      )}
    </div>
  );
}

export default StockRegisterDetail;
