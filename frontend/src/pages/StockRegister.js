import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AddStockRegisterModal from '../components/modals/AddStockRegisterModal';
import './StockRegister.css';

function StockRegister() {
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ordering, setOrdering] = useState('-date');
  const navigate = useNavigate();
  const { isAdmin, isStoreKeeper, isStaff } = useAuth();

  const canAddEntry = isAdmin || isStoreKeeper;

  const fetchStockEntries = () => {
    setLoading(true);
    const params = ordering ? { ordering } : {};
    api
      .get('/stock_register/', { params })
      .then((response) => {
        setStockEntries(
          Array.isArray(response.data) ? response.data : response.data.results || []
        );
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
  }, [isStaff, navigate, ordering]);

  const handleInvoiceSort = (e) => {
    const value = e.target.value;
    setOrdering(value || '-date'); // default: date latest first
  };

  const handleDateSort = (e) => {
    const value = e.target.value;
    setOrdering(value || '-date');
  };

  const handleRowClick = (id) => {
    navigate(`/stock-register/${id}`);
  };

  const handleModalSuccess = () => {
    fetchStockEntries();
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

      <table className="minimal-table clickable-table stock-register-table">
        <thead>
          <tr>
            <th>Invoice Number</th>
            <th className="sort-th">
              <select
                className="sort-dropdown"
                value={ordering === 'invoice_number' || ordering === '-invoice_number' ? ordering : ''}
                onChange={handleInvoiceSort}
                onClick={(e) => e.stopPropagation()}
                aria-label="Sort by invoice number"
              >
                <option value="">—</option>
                <option value="invoice_number">Ascending</option>
                <option value="-invoice_number">Descending</option>
              </select>
            </th>
            <th>Date of Entry</th>
            <th className="sort-th">
              <select
                className="sort-dropdown"
                value={ordering === 'date' || ordering === '-date' ? ordering : ''}
                onChange={handleDateSort}
                onClick={(e) => e.stopPropagation()}
                aria-label="Sort by date"
              >
                <option value="">—</option>
                <option value="-date">Latest to oldest</option>
                <option value="date">Oldest to latest</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {stockEntries.map((entry) => (
            <tr key={entry.id} onClick={() => handleRowClick(entry.id)}>
              <td>{entry.invoice_number}</td>
              <td />
              <td>{entry.date}</td>
              <td />
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

