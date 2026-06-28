import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaExclamationTriangle, FaFilter, FaSortUp, FaSortDown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './DamagedEntry.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DamagedEntry() {
  const navigate = useNavigate();
  const { isStaff } = useAuth();
  const [damagedEntries, setDamagedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    staff: '',
    itemName: ''
  });

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const orderPrefix = sortOrder === 'desc' ? '-' : '';
      params.append('ordering', `${orderPrefix}${sortBy}`);
      const res = await api.get(`damaged_entry/?${params.toString()}`);
      setDamagedEntries(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Error fetching damaged entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) {
      navigate('/');
      return;
    }
    fetchEntries();
    window.addEventListener('inventory-updated', fetchEntries);
    return () => window.removeEventListener('inventory-updated', fetchEntries);
  }, [isStaff, navigate, sortBy, sortOrder]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', staff: '', itemName: '' });
  };

  const applyFilters = (entries) => {
    return entries.filter(entry => {
      if (filters.dateFrom && entry.date < filters.dateFrom) return false;
      if (filters.dateTo && entry.date > filters.dateTo) return false;
      if (filters.staff && !entry.staff?.toLowerCase().includes(filters.staff.toLowerCase())) return false;
      if (filters.itemName) {
        const hasItem = entry.damaged_items?.some(item =>
          item.apparatus_name?.toLowerCase().includes(filters.itemName.toLowerCase())
        );
        if (!hasItem) return false;
      }
      return true;
    });
  };

  const filtered = applyFilters(damagedEntries).filter(entry =>
    String(entry.id).includes(search) ||
    entry.staff?.toLowerCase().includes(search.toLowerCase()) ||
    entry.class_name?.toLowerCase().includes(search.toLowerCase()) ||
    entry.damaged_items?.some(item =>
      item.apparatus_name?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleCardClick = (id) => {
    navigate(`/damaged-entry/${id}`);
  };

  return (
    <div className="de-page animate-up">
      {/* Title Row */}
      <div className="de-title-row">
        <h1 className="de-title">Damaged Entry</h1>
        <div className="de-title-right"></div>
      </div>

      {/* Search + Filter Row */}
      <div className="de-search-row">
        <div className="de-search-left">
          <FaSearch className="de-search-icon" />
          <input
            type="text"
            className="de-search-input"
            placeholder="Search damaged entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="de-search-divider" />
        <div className="de-search-right">
          <button
            className={`de-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> Filters
          </button>
          <div className="de-search-divider" />
          <div className="de-sort-group">
            <span className="de-sort-label">Sort by:</span>
            <select
              className="de-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Date</option>
            </select>
            <button
              className="de-sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="de-filters-panel animate-fade">
          <div className="de-filters-grid">
            <div className="de-filter-group">
              <label>Date From:</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
            </div>
            <div className="de-filter-group">
              <label>Date To:</label>
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            </div>
            <div className="de-filter-group">
              <label>Staff:</label>
              <input type="text" placeholder="Staff name..." value={filters.staff} onChange={(e) => handleFilterChange('staff', e.target.value)} />
            </div>
            <div className="de-filter-group">
              <label>Item Name:</label>
              <input type="text" placeholder="Item name..." value={filters.itemName} onChange={(e) => handleFilterChange('itemName', e.target.value)} />
            </div>
          </div>
          <div className="de-filter-actions">
            <button className="de-filter-clear" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="de-loading"><div className="loading-spinner" /></div>
      ) : filtered.length > 0 ? (
        <>
          {/* Desktop Cards */}
          <div className="de-card-list-desktop">
            {filtered.map((entry) => {
              const ref = `DMG-${String(entry.id).padStart(3, '0')}`;
              const itemsCount = entry.damaged_items?.length || 0;
              return (
                <div
                  key={entry.id}
                  className="de-card"
                  onClick={() => handleCardClick(entry.id)}
                >
                  <div className="de-card-icon-box">
                    <FaExclamationTriangle />
                  </div>
                  <div className="de-card-info">
                    <div className="de-card-ref">{ref}</div>
                    <div className="de-card-staff">{entry.staff}</div>
                  </div>
                  <div className="de-card-date">
                    📅 {formatDate(entry.date)}
                  </div>
                  <div className="de-card-count">
                    {itemsCount} Item{itemsCount !== 1 ? 's' : ''}
                  </div>
                  <button
                    className="de-card-btn"
                    onClick={(e) => { e.stopPropagation(); handleCardClick(entry.id); }}
                  >
                    View Details ›
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mobile Cards */}
          <div className="de-card-list-mobile">
            {filtered.map((entry) => {
              const ref = `DMG-${String(entry.id).padStart(3, '0')}`;
              const itemsCount = entry.damaged_items?.length || 0;
              return (
                <div
                  key={entry.id}
                  className="de-card-mobile"
                  onClick={() => handleCardClick(entry.id)}
                >
                  <div className="de-mobile-icon-box">
                    <FaExclamationTriangle />
                  </div>
                  <div className="de-mobile-ref">{ref}</div>
                  <span className="de-mobile-view" onClick={(e) => { e.stopPropagation(); handleCardClick(entry.id); }}>
                    View ›
                  </span>
                  <div className="de-mobile-staff">{entry.staff}</div>
                  <div className="de-mobile-meta">
                    📅 {formatDate(entry.date)} · {itemsCount} Item{itemsCount !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="de-empty">
          <FaExclamationTriangle className="de-empty-icon" />
          <div className="de-empty-title">No damaged entries yet</div>
          <div className="de-empty-sub">Log damaged items using the button above</div>
        </div>
      )}

    </div>
  );
}

export default DamagedEntry;
