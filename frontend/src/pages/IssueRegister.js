import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaFileInvoice, FaCalendarAlt, FaChevronRight, FaClipboardList, FaUser, FaGraduationCap, FaFilter, FaSort } from 'react-icons/fa';
import api from '../utils/api';
import './StockRegister.css'; // Reuse the grid and card styles
import './IssueRegister.css'; // Issue-specific styles (request badge etc.)

function IssueRegister() {
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
    classField: '',
    status: '',
    chemicalName: ''
  });
  const navigate = useNavigate();

  const fetchRegisters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add sorting
      const orderPrefix = sortOrder === 'desc' ? '-' : '';
      params.append('ordering', `${orderPrefix}${sortBy}`);
      
      const res = await api.get(`/issue_register/?${params.toString()}`);
      setIssueRegisters(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Error fetching issue register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisters();
  }, [sortBy, sortOrder]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      staffName: '',
      classField: '',
      status: '',
      chemicalName: ''
    });
  };

  const applyFilters = (registers) => {
    return registers.filter(register => {
      // Date range filter
      if (filters.dateFrom && register.date < filters.dateFrom) return false;
      if (filters.dateTo && register.date > filters.dateTo) return false;
      
      // Staff name filter
      if (filters.staffName && !register.staff_name?.toLowerCase().includes(filters.staffName.toLowerCase())) {
        return false;
      }
      
      // Class filter
      if (filters.classField && !register.class_field?.toLowerCase().includes(filters.classField.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filters.status && !register.status?.toLowerCase().includes(filters.status.toLowerCase())) {
        return false;
      }
      
      // Chemical name filter (check nested chemicals)
      if (filters.chemicalName) {
        const hasChemical = register.chemicals?.some(chemical => 
          chemical.chemical_name.toLowerCase().includes(filters.chemicalName.toLowerCase())
        );
        if (!hasChemical) return false;
      }
      
      return true;
    });
  };

  const filtered = applyFilters(issueRegisters).filter(r =>
    r.staff_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.class_field?.toLowerCase().includes(search.toLowerCase()) ||
    String(r.ir_id || '').includes(search) ||
    (r.request_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="stock-register-page dept-issue animate-up">
      <div className="page-header">
        <div className="dept-title-container">
          <div className="dept-icon-box" style={{ color: 'var(--dept-issue)' }}>
            <FaClipboardList />
          </div>
          <div>
            <h1 className="page-title">Issue Register</h1>
            <p className="page-subtitle">Historical log of all chemical issues and actual usage.</p>
          </div>
        </div>
      </div>

      <div className="search-bar-container card">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search by ID, Staff, or Class..."
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
              <option value="ir_id">Issue ID</option>
              <option value="staff_name">Staff Name</option>
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
              <label>Staff Name:</label>
              <input
                type="text"
                placeholder="Staff name..."
                value={filters.staffName}
                onChange={(e) => handleFilterChange('staffName', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Class:</label>
              <input
                type="text"
                placeholder="Class name..."
                value={filters.classField}
                onChange={(e) => handleFilterChange('classField', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Status:</label>
              <input
                type="text"
                placeholder="Status..."
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
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
              key={register.ir_id}
              className="stock-card card animate-fade"
              onClick={() => navigate(`/issue-register/${register.ir_id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="stock-card-icon">
                <FaFileInvoice />
              </div>
              <div className="stock-card-content">
                <div className="stock-card-main-info">
                  <h3>
                    IR-#{register.ir_id}
                    {register.request_code && (
                      <span
                        className="ir-request-badge"
                        title={`Originated from Request ${register.request_code}`}
                      >
                        {register.request_code}
                      </span>
                    )}
                  </h3>
                  <p className="supplier"><FaUser /> {register.staff_name}</p>
                  <p className="class-info" style={{ fontSize: '0.85rem', color: '#666' }}>
                    <FaGraduationCap /> {register.class_field}
                  </p>
                </div>
                <div className="stock-card-details">
                  <span className="date">
                    <FaCalendarAlt /> {register.date}
                  </span>
                  <span className="items-count">
                    {register.chemicals?.length || 0} Chemicals
                  </span>
                </div>
              </div>
              <div className="stock-card-actions">
                <button
                  className="btn-view"
                  onClick={() => navigate(`/issue-register/${register.ir_id}`)}
                >
                  View Details <FaChevronRight />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No matching issue register entries found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssueRegister;
