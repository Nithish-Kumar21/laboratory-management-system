import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaFileInvoice, FaCalendarAlt, FaChevronRight, FaClipboardList, FaFilter, FaSort } from 'react-icons/fa';
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
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    supplier: '',
    chemicalName: '',
    apparatusName: '',
    make: ''
  });
  const navigate = useNavigate();

  const fetchRegisters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add sorting
      const orderPrefix = sortOrder === 'desc' ? '-' : '';
      params.append('ordering', `${orderPrefix}${sortBy}`);
      
      const res = await api.get(`stock_register/?${params.toString()}`);
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
  }, [sortBy, sortOrder]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      supplier: '',
      chemicalName: '',
      apparatusName: '',
      make: ''
    });
  };

  const applyFilters = (registers) => {
    return registers.filter(register => {
      // Date range filter
      if (filters.dateFrom && register.date < filters.dateFrom) return false;
      if (filters.dateTo && register.date > filters.dateTo) return false;
      
      // Supplier filter
      if (filters.supplier && !register.supplier_name?.toLowerCase().includes(filters.supplier.toLowerCase())) {
        return false;
      }
      
      // Chemical name filter (check nested items)
      if (filters.chemicalName) {
        const hasChemical = register.chemical_items?.some(item => 
          item.chemical_name.toLowerCase().includes(filters.chemicalName.toLowerCase())
        );
        if (!hasChemical) return false;
      }
      
      // Apparatus name filter (check nested items)
      if (filters.apparatusName) {
        const hasApparatus = register.apparatus_items?.some(item => 
          item.apparatus_name.toLowerCase().includes(filters.apparatusName.toLowerCase())
        );
        if (!hasApparatus) return false;
      }
      
      // Make filter (check both chemical and apparatus items)
      if (filters.make) {
        const chemicalHasMake = register.chemical_items?.some(item => 
          item.make?.toLowerCase().includes(filters.make.toLowerCase())
        );
        const apparatusHasMake = register.apparatus_items?.some(item => 
          item.make?.toLowerCase().includes(filters.make.toLowerCase())
        );
        if (!chemicalHasMake && !apparatusHasMake) return false;
      }
      
      return true;
    });
  };

  const filtered = applyFilters(stockRegisters).filter(r =>
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
        <div className="search-controls">
          <button 
            className="btn-filter"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle Filters"
          >
            <FaFilter /> Filters
          </button>
          <div className="sort-controls">
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="date">Date</option>
              <option value="invoice_number">Invoice Number</option>
            </select>
            <button 
              className="btn-sort-order"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              <FaSort />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="filters-panel card animate-fade">
          <h3><FaFilter /> Filters</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label>Date From:</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Date To:</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Supplier:</label>
              <input
                type="text"
                placeholder="Supplier name..."
                value={filters.supplier}
                onChange={(e) => handleFilterChange('supplier', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Chemical Name:</label>
              <input
                type="text"
                placeholder="Chemical name..."
                value={filters.chemicalName}
                onChange={(e) => handleFilterChange('chemicalName', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Apparatus Name:</label>
              <input
                type="text"
                placeholder="Apparatus name..."
                value={filters.apparatusName}
                onChange={(e) => handleFilterChange('apparatusName', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Make:</label>
              <input
                type="text"
                placeholder="Make/Brand..."
                value={filters.make}
                onChange={(e) => handleFilterChange('make', e.target.value)}
                className="filter-input"
              />
            </div>
          </div>
          <div className="filter-actions">
            <button className="btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      <div className="stock-list-grid">
        {loading ? (
          <div className="loading-spinner"></div>
        ) : filtered.length > 0 ? (
          filtered.map((register) => (
            <div
              key={register.id}
              className="stock-card card animate-fade"
              onClick={() => navigate(`/stock-register/${register.id}`)}
              style={{ cursor: 'pointer' }}
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
                    {(register.chemical_items_count || 0) + (register.apparatus_items_count || 0)} Items
                    {(register.chemical_items_count != null || register.apparatus_items_count != null) && (
                      <span className="items-breakdown">
                        ({(register.chemical_items_count || 0)} chemicals, {(register.apparatus_items_count || 0)} apparatus)
                      </span>
                    )}
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
