import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useAuth } from './context/AuthContext';
import api from './utils/api';
import AddStockRegisterModal from './AddStockRegisterModal';
import './StockRegister.css';

function StockRegister() {
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isStoreKeeper, isStaff } = useAuth();

  const canAddEntry = isAdmin || isStoreKeeper;

  const fetchStockEntries = () => {
    setLoading(true);
    api.get('/stock_register/')
      .then((response) => {
        setStockEntries(Array.isArray(response.data) ? response.data : response.data.results || []);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isStaff) {
      navigate('/');
      return;
    }
    fetchStockEntries();
  }, [isStaff, navigate]);

  const handleRowClick = (id) => {
    navigate(`/stock-register/${id}`);
  };

  const handleModalSuccess = () => {
    fetchStockEntries(); // Refresh the list
  };

  if (loading) return <p>Loading stock register...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="stock-register-page">
      <div className="page-header">
        <h2>Stock Register</h2>
        {canAddEntry && (
          <button className="add-entry-btn" onClick={() => setIsModalOpen(true)}>
            <FaPlus /> Add New Entry
          </button>
        )}
      </div>

      <table className="minimal-table clickable-table">
        <thead>
          <tr>
            <th>Invoice Number</th>
            <th>Date of Entry</th>
          </tr>
        </thead>
        <tbody>
          {stockEntries.map((entry) => (
            <tr key={entry.id} onClick={() => handleRowClick(entry.id)}>
              <td>{entry.invoice_number}</td>
              <td>{entry.date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <AddStockRegisterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default StockRegister;
