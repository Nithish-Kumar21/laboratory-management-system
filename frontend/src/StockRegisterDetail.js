import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import './StockRegister.css';

function StockRegisterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stockEntry, setStockEntry] = useState(null);
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
        setStockEntry(data);
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

  if (loading) return <p>Loading details...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!stockEntry) return <p>No data found</p>;

  return (
    <div className="stock-detail-page">
      <button className="back-button" onClick={handleBack}>
        <FaArrowLeft />
      </button>

      <h2>Stock Register</h2>
      
      <div className="entry-info">
        <p><strong>Invoice No.:</strong> {stockEntry.invoice_number}</p>
        <p><strong>Date of Entry:</strong> {stockEntry.date}</p>
      </div>

      {stockEntry.chemical_items && stockEntry.chemical_items.length > 0 && (
        <>
          <h3>Chemical List</h3>
          <table className="minimal-table">
            <thead>
              <tr>
                <th>Chemical Name</th>
                <th>Quantity (mL)</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {stockEntry.chemical_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.chemical_name}</td>
                  <td>{item.quantity_ml}</td>
                  <td>{item.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {stockEntry.apparatus_items && stockEntry.apparatus_items.length > 0 && (
        <>
          <h3>Apparatus List</h3>
          <table className="minimal-table">
            <thead>
              <tr>
                <th>Apparatus Name</th>
                <th>Quantity (pieces)</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {stockEntry.apparatus_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.apparatus_name}</td>
                  <td>{item.quantity_pieces}</td>
                  <td>{item.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default StockRegisterDetail;
