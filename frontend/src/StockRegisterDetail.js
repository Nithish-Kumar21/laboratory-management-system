import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaTrash } from 'react-icons/fa';
import { useAuth } from './context/AuthContext';
import api from './utils/api';
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
    if (isStaff) {
      navigate('/');
      return;
    }
    api.get(`/stock_register/${id}/`)
      .then((response) => {
        setStockRegister(response.data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
        setLoading(false);
      });
  }, [id, isStaff, navigate]);

  const handleBack = () => {
    navigate('/stock-register');
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this entry? This will also update the inventory quantities.')) {
      setDeleting(true);
      try {
        await api.delete(`/stock_register/${id}/`);
        window.dispatchEvent(new Event('inventory-updated'));
        localStorage.setItem('inventory-updated', Date.now());
        alert('Entry deleted successfully');
        navigate('/stock-register');
      } catch (err) {
        alert('Failed to delete entry: ' + (err.response?.data?.error || err.message));
      } finally {
        setDeleting(false);
      }
    }
  };

  if (loading) return <div className="loading-message">Loading details...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;
  if (!stockRegister) return <div className="error-message">No data found</div>;

  return (
    <div className="stock-detail-page">
      <button className="back-button" onClick={handleBack} title="Back to Stock Register">
        <FaArrowLeft />
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Stock Register</h2>
        {isStoreKeeper && (
          <button
            className="delete-entry-btn"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 15px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <FaTrash /> {deleting ? 'Deleting...' : 'Delete Entry'}
          </button>
        )}
      </div>

      {/* Entry Information Card */}
      <div className="entry-info">
        <p><strong>Invoice No.:</strong> {stockRegister.invoice_number}</p>
        <p><strong>Date of Entry:</strong> {stockRegister.date}</p>
        <p><strong>Supplier:</strong> {stockRegister.supplier_name}</p>
      </div>

      {/* Chemical List */}
      {stockRegister.chemical_items && stockRegister.chemical_items.length > 0 && (
        <div className="items-section">
          <h3>Chemical List</h3>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Chemical Name</th>
                <th>Quantity (mL)</th>
                <th>Rate</th>
                <th>Make</th>
              </tr>
            </thead>
            <tbody>
              {stockRegister.chemical_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.chemical_name}</td>
                  <td>{item.quantity_ml}</td>
                  <td>{item.rate}</td>
                  <td>{item.make}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apparatus List */}
      {stockRegister.apparatus_items && stockRegister.apparatus_items.length > 0 && (
        <div className="items-section">
          <h3>Apparatus List</h3>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Apparatus Name</th>
                <th>Quantity (pieces)</th>
                <th>Rate</th>
                <th>Make</th>
              </tr>
            </thead>
            <tbody>
              {stockRegister.apparatus_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.apparatus_name}</td>
                  <td>{item.quantity_pieces}</td>
                  <td>{item.rate}</td>
                  <td>{item.make}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StockRegisterDetail;
