import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlusCircle, FaExclamationTriangle, FaUserShield, FaGraduationCap, FaCalendarAlt, FaClock, FaSearch, FaFilter, FaSort } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AddDamagedEntryModal from '../components/modals/AddDamagedEntryModal';
import './DamagedEntry.css';
import './StockRegister.css'; // Reuse filter and search styles

function DamagedEntry() {
  const [damagedEntries, setDamagedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    staff: '',
    className: '',
    causedBy: '',
    apparatusName: ''
  });
  const navigate = useNavigate();
  const { isAdmin, isStoreKeeper, isStaff } = useAuth();

  const canAddEntry = isAdmin || isStoreKeeper;

  const fetchDamagedEntries = () => {
    setLoading(true);
    const params = new URLSearchParams();
    
    // Add sorting
    const orderPrefix = sortOrder === 'desc' ? '-' : '';
    params.append('ordering', `${orderPrefix}${sortBy}`);
    
    api
      .get(`damaged_entry/?${params.toString()}`)
      .then((response) => {
        setDamagedEntries(
          Array.isArray(response.data) ? response.data : response.data.results || []
        );
      })
      .catch((error) => {
        console.error('Error fetching damaged entries:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isStaff) {
      navigate('/');
      return;
    }
    fetchDamagedEntries();
  }, [isStaff, navigate, sortBy, sortOrder]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      staff: '',
      className: '',
      causedBy: '',
      apparatusName: ''
    });
  };

  const applyFilters = (entries) => {
    return entries.filter(entry => {
      // Date range filter
      if (filters.dateFrom && entry.date < filters.dateFrom) return false;
      if (filters.dateTo && entry.date > filters.dateTo) return false;
      
      // Staff filter
      if (filters.staff && !entry.staff?.toLowerCase().includes(filters.staff.toLowerCase())) {
        return false;
      }
      
      // Class filter
      if (filters.className && !entry.class_name?.toLowerCase().includes(filters.className.toLowerCase())) {
        return false;
      }
      
      // Caused by filter
      if (filters.causedBy && !entry.caused_by?.toLowerCase().includes(filters.causedBy.toLowerCase())) {
        return false;
      }
      
      // Apparatus name filter (check nested items)
      if (filters.apparatusName) {
        const hasApparatus = entry.damaged_items?.some(item => 
          item.apparatus_name.toLowerCase().includes(filters.apparatusName.toLowerCase())
        );
        if (!hasApparatus) return false;
      }
      
      return true;
    });
  };

  const filtered = applyFilters(damagedEntries).filter(entry =>
    entry.staff?.toLowerCase().includes(search.toLowerCase()) ||
    entry.class_name?.toLowerCase().includes(search.toLowerCase()) ||
    entry.caused_by?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="damaged-entry-page dept-damaged animate-up">
      <div className="page-header">
        <div className="dept-title-container">
          <div className="dept-icon-box" style={{ color: 'var(--dept-damaged)' }}>
            <FaExclamationTriangle />
          </div>
          <div>
            <h1 className="page-title">Damaged Registry</h1>
            <p className="page-subtitle">Incident logs for laboratory damage and consumption.</p>
          </div>
        </div>
        {canAddEntry && (
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <FaPlusCircle /> Report Damage
          </button>
        )}
      </div>

      <div className="search-bar-container card">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search by Staff, Class, or Cause..."
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
              <option value="staff">Staff</option>
              <option value="class_name">Class</option>
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
              <label>Staff:</label>
              <input
                type="text"
                placeholder="Staff name..."
                value={filters.staff}
                onChange={(e) => handleFilterChange('staff', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Class:</label>
              <input
                type="text"
                placeholder="Class name..."
                value={filters.className}
                onChange={(e) => handleFilterChange('className', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Caused By:</label>
              <input
                type="text"
                placeholder="Cause..."
                value={filters.causedBy}
                onChange={(e) => handleFilterChange('causedBy', e.target.value)}
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
          </div>
          <div className="filter-actions">
            <button className="btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      <div className="table-actions animate-fade">
        <div className="action-buttons">
          <span className="info-text">Showing incident logs</span>
        </div>
      </div>

      <div className="table-card card animate-fade">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading incident reports...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FaExclamationTriangle className="empty-icon" />
            <h3>No records found</h3>
            <p>No incidents have been reported.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Responsible Staff</th>
                  <th>Class / Division</th>
                  <th>Date of Incident</th>
                  <th>Caused By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="table-row-hover"
                    onClick={() => navigate(`/damaged-entry/${entry.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="staff-info">
                        <FaUserShield className="row-icon" />
                        {entry.staff}
                      </div>
                    </td>
                    <td>
                      <div className="class-info">
                        <FaGraduationCap className="row-icon" />
                        {entry.class_name}
                      </div>
                    </td>
                    <td>
                      <div className="date-info">
                        <FaCalendarAlt className="row-icon-small" />
                        {entry.date}
                      </div>
                    </td>
                    <td><span className="cause-tag">{entry.caused_by}</span></td>
                    <td><span className="status-tag red">Recorded</span></td>
                    <td>
                      <button className="btn-table-view" onClick={() => navigate(`/damaged-entry/${entry.id}`)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddDamagedEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDamagedEntries}
      />
    </div>
  );
}

export default DamagedEntry;
