import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaFileInvoice, FaFilter, FaSortUp, FaSortDown } from 'react-icons/fa';
import api from '../utils/api';
import './StockRegister.css';

function StockRegister() {
  const navigate = useNavigate();
  const [stockRegisters, setStockRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const fetchRegisters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
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
      if (filters.dateFrom && register.date < filters.dateFrom) return false;
      if (filters.dateTo && register.date > filters.dateTo) return false;
      if (filters.supplier && !register.supplier_name?.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
      if (filters.chemicalName) {
        const hasChemical = register.chemical_items?.some(item =>
          item.chemical_name.toLowerCase().includes(filters.chemicalName.toLowerCase())
        );
        if (!hasChemical) return false;
      }
      if (filters.apparatusName) {
        const hasApparatus = register.apparatus_items?.some(item =>
          item.apparatus_name.toLowerCase().includes(filters.apparatusName.toLowerCase())
        );
        if (!hasApparatus) return false;
      }
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

  const handleCardClick = (id) => {
    navigate(`/stock-register/${id}`);
  };

  return (
    <div className="sr-page animate-up">
      {/* Title Row */}
      <div className="sr-title-row">
        <h1 className="sr-title">Stock Register</h1>
        <div className="sr-title-right"></div>
      </div>

      {/* Search + Filter Row */}
      <div className="sr-search-row">
        <div className="sr-search-left">
          <FaSearch className="sr-search-icon" />
          <input
            type="text"
            className="sr-search-input"
            placeholder="Search stock entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sr-search-divider" />
        <div className="sr-search-right">
          <button
            className={`sr-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> Filters
          </button>
          <div className="sr-search-divider" />
          <div className="sr-sort-group">
            <span className="sr-sort-label">Sort by:</span>
            <select
              className="sr-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Date</option>
              <option value="invoice_number">Invoice Number</option>
            </select>
            <button
              className="sr-sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="sr-filters-panel animate-fade">
          <div className="sr-filters-grid">
            <div className="sr-filter-group">
              <label>Date From:</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
            </div>
            <div className="sr-filter-group">
              <label>Date To:</label>
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            </div>
            <div className="sr-filter-group">
              <label>Supplier:</label>
              <input type="text" placeholder="Supplier name..." value={filters.supplier} onChange={(e) => handleFilterChange('supplier', e.target.value)} />
            </div>
            <div className="sr-filter-group">
              <label>Chemical Name:</label>
              <input type="text" placeholder="Chemical name..." value={filters.chemicalName} onChange={(e) => handleFilterChange('chemicalName', e.target.value)} />
            </div>
            <div className="sr-filter-group">
              <label>Apparatus Name:</label>
              <input type="text" placeholder="Apparatus name..." value={filters.apparatusName} onChange={(e) => handleFilterChange('apparatusName', e.target.value)} />
            </div>
            <div className="sr-filter-group">
              <label>Make:</label>
              <input type="text" placeholder="Make/Brand..." value={filters.make} onChange={(e) => handleFilterChange('make', e.target.value)} />
            </div>
          </div>
          <div className="sr-filter-actions">
            <button className="sr-filter-clear" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="sr-loading"><div className="loading-spinner" /></div>
      ) : filtered.length > 0 ? (
        <>
          {/* Desktop Cards */}
          <div className="sr-card-list-desktop">
            {filtered.map((register) => {
              const chemCount = register.chemical_items_count || 0;
              const appCount = register.apparatus_items_count || 0;
              const totalItems = chemCount + appCount;
              return (
                <div
                  key={register.id}
                  className="sr-card"
                  onClick={() => handleCardClick(register.id)}
                >
                  <div className="sr-card-icon-box">
                    <FaFileInvoice />
                  </div>
                  <div className="sr-card-info">
                    <div className="sr-card-ref">{register.invoice_number}</div>
                    <div className="sr-card-supplier">{register.supplier_name}</div>
                  </div>
                  <div className="sr-card-date">
                    📅 {register.date}
                  </div>
                  <div className="sr-card-count">
                    {totalItems} Items ({chemCount} chemicals, {appCount} apparatus)
                  </div>
                  <button
                    className="sr-card-btn"
                    onClick={(e) => { e.stopPropagation(); handleCardClick(register.id); }}
                  >
                    View Details ›
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mobile Cards */}
          <div className="sr-card-list-mobile">
            {filtered.map((register) => {
              const chemCount = register.chemical_items_count || 0;
              const appCount = register.apparatus_items_count || 0;
              const totalItems = chemCount + appCount;
              return (
                <div
                  key={register.id}
                  className="sr-card-mobile"
                  onClick={() => handleCardClick(register.id)}
                >
                  <div className="sr-mobile-icon-box">
                    <FaFileInvoice />
                  </div>
                  <div className="sr-mobile-ref">{register.invoice_number}</div>
                  <span className="sr-mobile-view" onClick={(e) => { e.stopPropagation(); handleCardClick(register.id); }}>
                    View ›
                  </span>
                  <div className="sr-mobile-supplier">{register.supplier_name}</div>
                  <div className="sr-mobile-meta">
                    📅 {register.date} · {totalItems} Items
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="sr-empty">
          <FaFileInvoice className="sr-empty-icon" />
          <div className="sr-empty-title">No stock entries yet</div>
          <div className="sr-empty-sub">Add new stock using the button above</div>
        </div>
      )}

    </div>
  );
}

export default StockRegister;
