import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaFileInvoice, FaCalendarAlt, FaChevronRight, FaClipboardList } from 'react-icons/fa';
import api from '../utils/api';
import AddStockRegisterModal from '../components/modals/AddStockRegisterModal';
import { useAuth } from '../context/AuthContext';
import './StockRegister.css';

function StockRegister() {
  const { isStoreKeeper, isAdmin } = useAuth();
  const [stockRegisters, setStockRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchRegisters = async () => {
    try {
      const res = await api.get('/stock_register/');
      setStockRegisters(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Error fetching stock registers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisters();
    window.addEventListener('inventory-updated', fetchRegisters);
    return () => window.removeEventListener('inventory-updated', fetchRegisters);
  }, []);

  const filtered = stockRegisters.filter(r =>
    r.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="stock-register-page dept-stock animate-up">
      <div className="page-header">
        <div className="dept-title-container">
          <div className="dept-icon-box" style={{ color: 'var(--dept-stock)' }}>
            <FaClipboardList />
          </div>
          <div>
            <h1 className="page-title">Stock Register</h1>
            <p className="page-subtitle">Unified log of all laboratory inventory acquisitions.</p>
          </div>
        </div>
        {(isStoreKeeper || isAdmin) && (
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <FaPlus /> New Stock Entry
          </button>
        )}
      </div>

      <div className="search-bar-container card">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search by Invoice or Supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="stock-list-grid">
        {loading ? (
          <div className="loading-spinner"></div>
        ) : filtered.length > 0 ? (
          filtered.map((register) => (
            <div
              key={register.id}
              className="stock-card card animate-fade"
            >
              <div className="stock-card-icon">
                <FaFileInvoice />
              </div>
              <div className="stock-card-content">
                <div className="stock-card-main-info">
                  <h3>{register.invoice_number}</h3>
                  <p className="supplier">{register.supplier_name || 'Generic Supplier'}</p>
                </div>
                <div className="stock-card-details">
                  <span className="date">
                    <FaCalendarAlt /> {register.date}
                  </span>
                  <span className="items-count">
                    {(register.chemical_items?.length || 0) + (register.apparatus_items?.length || 0)} Items
                  </span>
                </div>
              </div>
              <div className="stock-card-actions">
                <button
                  className="btn-view"
                  onClick={() => navigate(`/stock-register/${register.id}`)}
                >
                  View Details <FaChevronRight />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No matching stock entries found.</p>
          </div>
        )}
      </div>

      <AddStockRegisterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchRegisters}
      />
    </div>
  );
}

export default StockRegister;
