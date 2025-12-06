import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import './StockRegisterDetail.css';

function StockRegisterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stockRegister, setStockRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/stock_register/${id}/`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setStockRegister(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.message);
        setLoading(false);
      });
  }, [id]);

  const handleBack = () => {
    navigate('/stock-register');
  };

  if (loading) return <div className="loading-message">Loading details...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;
  if (!stockRegister) return <div className="error-message">No data found</div>;

  return (
    <div className="stock-detail-page">
      <button className="back-button" onClick={handleBack} title="Back to Stock Register">
        <FaArrowLeft />
      </button>

      <h2>Stock Register</h2>

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
