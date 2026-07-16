import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaArrowUp, FaFilter, FaSortUp, FaSortDown } from 'react-icons/fa';
import api from '../utils/api';
import './IssueRegister.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function IssueRegister() {
  const navigate = useNavigate();
  const [issueRegisters, setIssueRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    staffName: '',
    chemicalName: ''
  });

  const fetchRegisters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const orderPrefix = sortOrder === 'desc' ? '-' : '';
      params.append('ordering', `${orderPrefix}${sortBy}`);
      const res = await api.get(`/issue_register/?${params.toString()}`);
      setIssueRegisters(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Error fetching issue registers:', err);
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
    setFilters({ dateFrom: '', dateTo: '', staffName: '', chemicalName: '' });
  };

  const applyFilters = (registers) => {
    return registers.filter(register => {
      if (filters.dateFrom && register.date < filters.dateFrom) return false;
      if (filters.dateTo && register.date > filters.dateTo) return false;
      if (filters.staffName && !register.staff_name?.toLowerCase().includes(filters.staffName.toLowerCase())) return false;
      if (filters.chemicalName) {
        const has = register.chemicals?.some(c =>
          (c.chemical_name || '').toLowerCase().includes(filters.chemicalName.toLowerCase())
        );
        if (!has) return false;
      }
      return true;
    });
  };

  const formatted = (reg) => {
    const ref = `ISS-${String(reg.ir_id).padStart(3, '0')}`;
    const items = reg.chemicals?.length || 0;
    return { ref, items };
  };

  const filtered = applyFilters(issueRegisters).filter(r =>
    String(r.ir_id).includes(search) ||
    r.staff_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCardClick = (id) => {
    navigate(`/issue-register/${id}`);
  };

  return (
    <div className="ir-page animate-up">
      {/* Title Row */}
      <div className="ir-title-row">
        <h1 className="ir-title">Issue Register</h1>
      </div>

      {/* Search + Filter Row */}
      <div className="ir-search-row">
        <div className="ir-search-left">
          <FaSearch className="ir-search-icon" />
          <input
            type="text"
            className="ir-search-input"
            placeholder="Search issue entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ir-search-divider" />
        <div className="ir-search-right">
          <button
            className={`ir-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> Filters
          </button>
          <div className="ir-search-divider" />
          <div className="ir-sort-group">
            <span className="ir-sort-label">Sort by:</span>
            <select
              className="ir-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Date</option>
              <option value="ir_id">Issue ID</option>
            </select>
            <button
              className="ir-sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="ir-filters-panel animate-fade">
          <div className="ir-filters-grid">
            <div className="ir-filter-group">
              <label>Date From:</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
            </div>
            <div className="ir-filter-group">
              <label>Date To:</label>
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            </div>
            <div className="ir-filter-group">
              <label>Staff Name:</label>
              <input type="text" placeholder="Staff name..." value={filters.staffName} onChange={(e) => handleFilterChange('staffName', e.target.value)} />
            </div>
            <div className="ir-filter-group">
              <label>Chemical Name:</label>
              <input type="text" placeholder="Chemical name..." value={filters.chemicalName} onChange={(e) => handleFilterChange('chemicalName', e.target.value)} />
            </div>
          </div>
          <div className="ir-filter-actions">
            <button className="ir-filter-clear" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="ir-loading"><div className="loading-spinner" /></div>
      ) : filtered.length > 0 ? (
        <>
          {/* Desktop Cards */}
          <div className="ir-card-list-desktop">
            {filtered.map((register) => {
              const { ref, items } = formatted(register);
              return (
                <div
                  key={register.ir_id}
                  className="ir-card"
                  onClick={() => handleCardClick(register.ir_id)}
                >
                  <div className="ir-card-icon-box">
                    <FaArrowUp />
                  </div>
                  <div className="ir-card-info">
                    <div className="ir-card-ref">{ref}</div>
                    <div className="ir-card-sub">Issued By: Storekeeper</div>
                  </div>
                  <div className="ir-card-date">
                    📅 {formatDate(register.date)}
                  </div>
                  <div className="ir-card-to">
                    Issued To: {register.staff_name}
                  </div>
                  <div className="ir-card-count">
                    {items} Item{items !== 1 ? 's' : ''}
                  </div>
                  <button
                    className="ir-card-btn"
                    onClick={(e) => { e.stopPropagation(); handleCardClick(register.ir_id); }}
                  >
                    View Details ›
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mobile Cards */}
          <div className="ir-card-list-mobile">
            {filtered.map((register) => {
              const { ref, items } = formatted(register);
              return (
                <div
                  key={register.ir_id}
                  className="ir-card-mobile"
                  onClick={() => handleCardClick(register.ir_id)}
                >
                  <div className="ir-mobile-icon-box">
                    <FaArrowUp />
                  </div>
                  <div className="ir-mobile-ref">{ref}</div>
                  <span className="ir-mobile-view" onClick={(e) => { e.stopPropagation(); handleCardClick(register.ir_id); }}>
                    View ›
                  </span>
                  <div className="ir-mobile-by">Issued By: Storekeeper</div>
                  <div className="ir-mobile-meta">
                    📅 {formatDate(register.date)} · Issued To: {register.staff_name} · {items} Item{items !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="ir-empty">
          <FaArrowUp className="ir-empty-icon" />
          <div className="ir-empty-title">No issue records yet</div>
          <div className="ir-empty-sub">Issued chemicals will appear here automatically</div>
        </div>
      )}
    </div>
  );
}

export default IssueRegister;
