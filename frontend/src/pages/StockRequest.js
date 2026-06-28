import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaFilter, FaSortUp, FaSortDown, FaClipboardList } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './StockRequest.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().substring(0, 2);
}

const StockRequest = ({ draftsOnly = false }) => {
  const { isStaff, isHOD, isStoreKeeper } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', staff: '' });

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      let url = 'stock_request/';
      const params = new URLSearchParams();

      if (draftsOnly) {
        params.append('status', 'draft');
      } else if (isHOD) {
        params.append('status', 'pending');
      }

      const queryStr = params.toString();
      const res = await api.get(url + (queryStr ? `?${queryStr}` : ''));
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];

      // Always filter out drafts from non-drafts views
      if (!draftsOnly) {
        data = data.filter(r => r.status !== 'draft');
      }

      setRequests(data);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, [isStaff, isHOD, isStoreKeeper, draftsOnly]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', staff: '' });
  };

  const applyFilters = (items) => {
    return items.filter(item => {
      if (filters.dateFrom && item.date < filters.dateFrom) return false;
      if (filters.dateTo && item.date > filters.dateTo) return false;
      if (filters.staff && !item.requested_by_name?.toLowerCase().includes(filters.staff.toLowerCase())) return false;
      return true;
    });
  };

  const filtered = applyFilters(requests).filter(r =>
    r.requested_by_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase()) ||
    r.class_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.chemical_items?.some(c => c.chemical_name?.toLowerCase().includes(search.toLowerCase()))
  );

  // ===== RENDER =====
  if (loading && requests.length === 0) {
    return (
      <div className="cr-page animate-up">
        <div className="cr-loading"><div className="loading-spinner" /></div>
      </div>
    );
  }

  // ===== STAFF VIEW =====
  if (isStaff && !draftsOnly) {
    const activeReq = requests.find(r => !['draft', 'completed', 'rejected'].includes(r.status));

    return (
      <div className="cr-page animate-up">
        <div className="sr-title-row">
          <h1 className="sr-title">Chemical Request</h1>
        </div>

        {activeReq && (
          <>
            <p className="cr-section-label">Active chemical request</p>
            {/* Desktop */}
            <div className="sr-card-list-desktop">
              <div className="sr-card sr-card-pending" onClick={() => navigate(`/requests/${activeReq.id}`)}>
                <div className="sr-card-icon-box">
                  <FaClipboardList />
                </div>
                <div className="sr-card-info">
                  <div className="sr-card-ref">{activeReq.request_id}</div>
                  <div className="sr-card-supplier">{activeReq.class_name || '—'}</div>
                </div>
                <div className="sr-card-date">📅 {formatDate(activeReq.date)}</div>
                <button className="sr-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${activeReq.id}`); }}>
                  View Details ›
                </button>
              </div>
            </div>

            {/* Mobile */}
            <div className="sr-card-list-mobile">
              <div className="sr-card-mobile sr-card-mobile-pending" onClick={() => navigate(`/requests/${activeReq.id}`)}>
                <div className="sr-mobile-icon-box"><FaClipboardList /></div>
                <div className="sr-mobile-ref">{activeReq.request_id}</div>
                <span className="sr-mobile-view" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${activeReq.id}`); }}>View ›</span>
                <div className="sr-mobile-supplier">{activeReq.class_name || '—'}</div>
                <div className="sr-mobile-meta">📅 {formatDate(activeReq.date)}</div>
              </div>
            </div>
          </>
        )}

        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  // ===== DRAFTS VIEW =====
  if (draftsOnly) {
    const draftCount = requests.filter(r => r.status === 'draft').length;

    return (
      <div className="cr-page animate-up">
        <div className="sr-title-row">
          <h1 className="sr-title">Draft</h1>
          <div className="sr-title-right">
            <span className="cr-count-badge cr-count-blue">{draftCount} Drafts</span>
          </div>
        </div>

        <div className="sr-search-row">
          <div className="sr-search-left">
            <FaSearch className="sr-search-icon" />
            <input type="text" className="sr-search-input" placeholder="Search drafts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="sr-search-divider" />
          <div className="sr-search-right">
            <button className={`sr-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <FaFilter /> Filters
            </button>
            <div className="sr-search-divider" />
            <div className="sr-sort-group">
              <span className="sr-sort-label">Sort by:</span>
              <select className="sr-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">Date</option>
              </select>
              <button className="sr-sort-order-btn" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
              </button>
            </div>
          </div>
        </div>

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
                <label>Search:</label>
                <input type="text" placeholder="Chemical name..." value={filters.staff} onChange={(e) => handleFilterChange('staff', e.target.value)} />
              </div>
            </div>
            <div className="sr-filter-actions">
              <button className="sr-filter-clear" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="sr-loading"><div className="loading-spinner" /></div>
        ) : filtered.length > 0 ? (
          <>
            <div className="sr-card-list-desktop">
              {filtered.map(req => (
                <div key={req.id} className="sr-card sr-card-draft" onClick={() => navigate(`/requests/${req.id}`)}>
                  <div className="sr-card-icon-box">
                    <FaClipboardList />
                  </div>
                  <div className="sr-card-info">
                    <div className="sr-card-ref">{req.request_id}</div>
                    <div className="sr-card-supplier">{req.class_name || '—'}</div>
                  </div>
                  <div className="sr-card-date">📅 {formatDate(req.date)}</div>
                  <button className="sr-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}>
                    View Details ›
                  </button>
                </div>
              ))}
            </div>

            <div className="sr-card-list-mobile">
              {filtered.map(req => (
                <div key={req.id} className="sr-card-mobile sr-card-mobile-draft" onClick={() => navigate(`/requests/${req.id}`)}>
                  <div className="sr-mobile-icon-box"><FaClipboardList /></div>
                  <div className="sr-mobile-ref">{req.request_id}</div>
                  <span className="sr-mobile-view" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}>View ›</span>
                  <div className="sr-mobile-supplier">{req.class_name || '—'}</div>
                  <div className="sr-mobile-meta">📅 {formatDate(req.date)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="sr-empty">
            <FaClipboardList className="sr-empty-icon" />
            <div className="sr-empty-title">No drafts</div>
            <div className="sr-empty-sub">Your saved drafts will appear here</div>
          </div>
        )}

        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  // ===== HOD VIEW =====
  if (isHOD) {
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
      <div className="cr-page animate-up">
        <div className="sr-title-row">
          <h1 className="sr-title">Chemical Request</h1>
          <div className="sr-title-right">
            <span className="cr-count-badge cr-count-blue">{pendingCount} Pending</span>
          </div>
        </div>

        <div className="sr-search-row">
          <div className="sr-search-left">
            <FaSearch className="sr-search-icon" />
            <input type="text" className="sr-search-input" placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="sr-search-divider" />
          <div className="sr-search-right">
            <button className={`sr-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <FaFilter /> Filters
            </button>
            <div className="sr-search-divider" />
            <div className="sr-sort-group">
              <span className="sr-sort-label">Sort by:</span>
              <select className="sr-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">Date</option>
              </select>
              <button className="sr-sort-order-btn" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
              </button>
            </div>
          </div>
        </div>

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
                <label>Staff:</label>
                <input type="text" placeholder="Staff name..." value={filters.staff} onChange={(e) => handleFilterChange('staff', e.target.value)} />
              </div>
            </div>
            <div className="sr-filter-actions">
              <button className="sr-filter-clear" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="sr-loading"><div className="loading-spinner" /></div>
        ) : filtered.length > 0 ? (
          <>
            <div className="sr-card-list-desktop">
              {filtered.map(req => (
                <div key={req.id} className="sr-card" onClick={() => navigate(`/requests/${req.id}`)}>
                  <div className="sr-card-icon-box">
                    <FaClipboardList />
                  </div>
                  <div className="sr-card-info">
                    <div className="sr-card-ref">{req.request_id}</div>
                    <div className="sr-card-supplier">{req.requested_by_name}</div>
                    <div className="sr-card-class">{req.class_name || '—'}</div>
                  </div>
                  <div className="sr-card-date">📅 {formatDate(req.date)}</div>
                  <button className="sr-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}>
                    View Details ›
                  </button>
                </div>
              ))}
            </div>

            <div className="sr-card-list-mobile">
              {filtered.map(req => (
                <div key={req.id} className="sr-card-mobile" onClick={() => navigate(`/requests/${req.id}`)}>
                  <div className="sr-mobile-icon-box"><FaClipboardList /></div>
                  <div className="sr-mobile-ref">{req.request_id}</div>
                  <span className="sr-mobile-view" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}>View ›</span>
                  <div className="sr-mobile-supplier">{req.requested_by_name}</div>
                  <div className="sr-mobile-meta">{req.class_name || '—'} · 📅 {formatDate(req.date)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="sr-empty">
            <FaClipboardList className="sr-empty-icon" />
            <div className="sr-empty-title">All caught up!</div>
            <div className="sr-empty-sub">No pending requests at the moment</div>
          </div>
        )}

        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  // ===== STOREKEEPER VIEW =====
  if (isStoreKeeper) {
    const approvedCount = requests.filter(r => r.status === 'accepted').length;
    const reportedCount = requests.filter(r => r.status === 'reported').length;

    return (
      <div className="cr-page animate-up">
        <div className="sr-title-row">
          <h1 className="sr-title">Chemical Request</h1>
          <div className="sr-title-right">
            <span className="cr-count-badge cr-count-green">{approvedCount} To Issue</span>
            {reportedCount > 0 && <span className="cr-count-badge cr-count-blue">{reportedCount} To Complete</span>}
          </div>
        </div>

        <div className="sr-search-row">
          <div className="sr-search-left">
            <FaSearch className="sr-search-icon" />
            <input type="text" className="sr-search-input" placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="sr-search-divider" />
          <div className="sr-search-right">
            <button className={`sr-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <FaFilter /> Filters
            </button>
            <div className="sr-search-divider" />
            <div className="sr-sort-group">
              <span className="sr-sort-label">Sort by:</span>
              <select className="sr-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">Date</option>
              </select>
              <button className="sr-sort-order-btn" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
              </button>
            </div>
          </div>
        </div>

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
                <label>Staff:</label>
                <input type="text" placeholder="Staff name..." value={filters.staff} onChange={(e) => handleFilterChange('staff', e.target.value)} />
              </div>
            </div>
            <div className="sr-filter-actions">
              <button className="sr-filter-clear" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="sr-loading"><div className="loading-spinner" /></div>
        ) : filtered.length > 0 ? (
          <>
            <div className="sr-card-list-desktop">
              {filtered.map(req => (
                <div key={req.id} className="sr-card" onClick={() => navigate(`/requests/${req.id}`)}>
                  <div className="sr-card-icon-box">
                    <FaClipboardList />
                  </div>
                  <div className="sr-card-info">
                    <div className="sr-card-ref">{req.request_id}</div>
                    <div className="sr-card-supplier">{req.requested_by_name}</div>
                    <div className="sr-card-class">{req.class_name || '—'}</div>
                  </div>
                  <div className="sr-card-date">📅 {formatDate(req.date)}</div>
                  <button className="sr-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}>
                    View Details ›
                  </button>
                </div>
              ))}
            </div>

            <div className="sr-card-list-mobile">
              {filtered.map(req => (
                <div key={req.id} className="sr-card-mobile" onClick={() => navigate(`/requests/${req.id}`)}>
                  <div className="sr-mobile-icon-box"><FaClipboardList /></div>
                  <div className="sr-mobile-ref">{req.request_id}</div>
                  <span className="sr-mobile-view" onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); }}>View ›</span>
                  <div className="sr-mobile-supplier">{req.requested_by_name}</div>
                  <div className="sr-mobile-meta">{req.class_name || '—'} · 📅 {formatDate(req.date)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="sr-empty">
            <FaClipboardList className="sr-empty-icon" />
            <div className="sr-empty-title">No pending actions</div>
            <div className="sr-empty-sub">Approved and reported requests will appear here</div>
          </div>
        )}

        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  return null;
};

export default StockRequest;
