import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaFilter, FaSortUp, FaSortDown, FaCheck, FaTimes } from 'react-icons/fa';
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

const ALL_CLASS_OPTIONS = [
  'I B.Sc Chemistry', 'II B.Sc Chemistry', 'III B.Sc Chemistry',
  'I M.Sc Chemistry', 'II M.Sc Chemistry'
];

const StockRequest = ({ draftsOnly = false }) => {
  const { isStaff, isHOD, isStoreKeeper, user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', staff: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [removingIds, setRemovingIds] = useState([]);
  const [toast, setToast] = useState(null);

  const [hasActiveRequest, setHasActiveRequest] = useState(false);

  // Staff form state
  const [availableChemicals, setAvailableChemicals] = useState([]);
  const [formData, setFormData] = useState({
    chemical: '',
    quantity: '',
    unit: 'ml',
    purpose: '',
    className: ALL_CLASS_OPTIONS[0],
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
      } else if (isStoreKeeper) {
        params.append('status', 'accepted');
      }

      const queryStr = params.toString();
      const res = await api.get(url + (queryStr ? `?${queryStr}` : ''));
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];

      // Always filter out drafts from non-drafts views
      if (!draftsOnly) {
        data = data.filter(r => r.status !== 'draft');
      }

      setRequests(data);

      // Check active request for staff
      if (isStaff && !draftsOnly) {
        const allRes = await api.get('stock_request/');
        const allData = Array.isArray(allRes.data) ? allRes.data : allRes.data.results || [];
        const active = allData.some(r => r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'draft');
        setHasActiveRequest(active);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, [isStaff, isHOD, isStoreKeeper, draftsOnly]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (isStaff && !draftsOnly) {
      api.get('available_chemicals/')
        .then(res => setAvailableChemicals(Array.isArray(res.data) ? res.data : res.data.results || []))
        .catch(() => {});
    }
  }, [isStaff, draftsOnly]);

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

  const canSubmit = hasActiveRequest || draftsOnly;

  // ===== STAFF ACTIONS =====
  const validateForm = () => {
    const errs = {};
    if (!formData.chemical.trim()) errs.chemical = 'Required';
    const q = parseFloat(formData.quantity);
    if (!formData.quantity || isNaN(q) || q <= 0) {
      errs.quantity = 'Invalid quantity';
    } else {
      const selectedChem = availableChemicals.find(c => c.chemical_name === formData.chemical);
      if (selectedChem && q > parseFloat(selectedChem.available_quantity_ml)) {
        errs.quantity = `Exceeds available stock (Available: ${selectedChem.available_quantity_ml} ${formData.unit})`;
      }
    }
    if (!formData.purpose.trim()) errs.purpose = 'Required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStaffAction = async (submitForReal) => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        class_name: formData.className,
        reason: formData.purpose.trim(),
        date: new Date().toISOString().split('T')[0],
        status: (submitForReal && !canSubmit) ? 'pending' : 'draft',
        chemical_items: [{
          chemical_name: formData.chemical.trim(),
          quantity_ml: parseFloat(formData.quantity),
        }],
      };
      await api.post('stock_request/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      setFormData({ chemical: '', quantity: '', unit: 'ml', purpose: '', className: ALL_CLASS_OPTIONS[0] });
      setFormErrors({});
      showToast(submitForReal && !canSubmit ? 'Request submitted for approval' : 'Saved to drafts');
      fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Action failed';
      setFormErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ===== HOD ACTIONS =====
  const handleAccept = async (id) => {
    setRemovingIds(prev => [...prev, id]);
    setActionLoading(true);
    try {
      await api.post(`stock_request/${id}/accept/`);
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== id));
        setRemovingIds(prev => prev.filter(x => x !== id));
        showToast('Request approved');
      }, 300);
    } catch (err) {
      setRemovingIds(prev => prev.filter(x => x !== id));
      showToast(err.response?.data?.error || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    setRemovingIds(prev => [...prev, id]);
    setActionLoading(true);
    try {
      await api.post(`stock_request/${id}/reject/`, { rejection_reason: 'Rejected by HOD' });
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== id));
        setRemovingIds(prev => prev.filter(x => x !== id));
        showToast('Request rejected');
      }, 300);
    } catch (err) {
      setRemovingIds(prev => prev.filter(x => x !== id));
      showToast(err.response?.data?.error || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  // ===== STOREKEEPER ACTIONS =====
  const handleMarkAsIssued = async (id) => {
    setRemovingIds(prev => [...prev, id]);
    setActionLoading(true);
    try {
      await api.post(`stock_request/${id}/mark_as_issued/`);
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== id));
        setRemovingIds(prev => prev.filter(x => x !== id));
        showToast('Marked as issued — Issue Register updated');
      }, 300);
    } catch (err) {
      setRemovingIds(prev => prev.filter(x => x !== id));
      showToast(err.response?.data?.error || 'Failed to mark as issued');
    } finally {
      setActionLoading(false);
    }
  };

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
    const activeReq = requests.find(r => r.status === 'pending');
    const selectedChem = availableChemicals.find(c => c.chemical_name === formData.chemical);

    return (
      <div className="cr-page animate-up">
        {toast && <div className="cr-toast">{toast}</div>}

        {/* Title */}
        <div className="cr-title-row">
          <h1 className="cr-title">Chemical Request</h1>
        </div>

        {/* Active Request Banner */}
        {hasActiveRequest && (
          <div className="cr-staff-banner">
            <div className="cr-banner-left">
              <span className="cr-banner-icon">🔵</span>
              <span className="cr-banner-text">You have an active pending request — new requests will be auto-saved to draft</span>
            </div>
            <span className="cr-banner-pill cr-pill-pending">Pending</span>
          </div>
        )}

        {/* Request Form Card */}
        <div className="cr-card cr-form-card">
          <div className="cr-form-title">New Chemical Request</div>

          <div className="cr-form-row">
            <div className="cr-field">
              <label className="cr-label">CHEMICAL NAME</label>
              <div className="cr-autocomplete">
                <input
                  type="text"
                  className={`cr-input ${formErrors.chemical ? 'cr-input-error' : ''}`}
                  placeholder="Select chemical..."
                  value={formData.chemical}
                  onChange={(e) => { setFormData({ ...formData, chemical: e.target.value }); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                <span className="cr-chevron">❯</span>
                {showSuggestions && formData.chemical && (
                  <ul className="cr-suggestions">
                    {availableChemicals
                      .filter(c => c.chemical_name?.toLowerCase().includes(formData.chemical.toLowerCase()))
                      .map((c, i) => (
                        <li key={i} className="cr-suggestion-item" onMouseDown={() => { setFormData({ ...formData, chemical: c.chemical_name }); setShowSuggestions(false); }}>
                          <span>{c.chemical_name}</span>
                          <span className="cr-stock-info">Stock: {c.available_quantity_ml} ml</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              {formErrors.chemical && <span className="cr-field-error">{formErrors.chemical}</span>}
            </div>

            <div className="cr-field">
              <label className="cr-label">QUANTITY</label>
              <div className="cr-qty-row">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={`cr-input cr-qty-input ${formErrors.quantity ? 'cr-input-error' : ''}`}
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                <select
                  className="cr-input cr-unit-select"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              {formErrors.quantity && <span className="cr-field-error cr-error-stock">{formErrors.quantity}</span>}
            </div>
          </div>

          <div className="cr-field cr-field-full">
            <label className="cr-label">PURPOSE</label>
            <textarea
              className={`cr-input cr-textarea ${formErrors.purpose ? 'cr-input-error' : ''}`}
              placeholder="Describe the purpose of this request..."
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            />
            {formErrors.purpose && <span className="cr-field-error">{formErrors.purpose}</span>}
          </div>

          <div className="cr-field cr-field-full">
            <label className="cr-label">CLASS</label>
            <input
              type="text"
              className="cr-input"
              placeholder="e.g. I B.Sc Chemistry"
              value={formData.className}
              onChange={(e) => setFormData({ ...formData, className: e.target.value })}
              list="cr-class-list"
            />
            <datalist id="cr-class-list">
              {ALL_CLASS_OPTIONS.map((opt, i) => <option key={i} value={opt} />)}
            </datalist>
          </div>

          {formErrors.submit && <div className="cr-error-banner">{formErrors.submit}</div>}

          <div className="cr-form-actions">
            <button className="cr-btn-draft" onClick={() => handleStaffAction(false)} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save to Draft'}
            </button>
            <button className="cr-btn-submit" onClick={() => handleStaffAction(true)} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>

        {/* Active Request Status Card */}
        {activeReq && (
          <div className="cr-card cr-card-active">
            <div className="cr-card-active-title">Current Active Request</div>
            <div className="cr-grid-2x2">
              <div className="cr-gitem">
                <div className="cr-glabel">Chemical Name</div>
                <div className="cr-gvalue">{activeReq.chemical_items?.map(c => c.chemical_name).join(', ') || '—'}</div>
              </div>
              <div className="cr-gitem">
                <div className="cr-glabel">Quantity</div>
                <div className="cr-gvalue">{activeReq.chemical_items?.reduce((s, c) => s + (c.quantity_ml || 0), 0) || '—'} ml</div>
              </div>
              <div className="cr-gitem">
                <div className="cr-glabel">Purpose</div>
                <div className="cr-gvalue">{activeReq.reason || '—'}</div>
              </div>
              <div className="cr-gitem">
                <div className="cr-glabel">Submitted</div>
                <div className="cr-gvalue">{formatDate(activeReq.date)}</div>
              </div>
            </div>
            <div className="cr-status-center">
              <span className="cr-status-pill cr-pill-pending">Pending</span>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  // ===== DRAFTS VIEW =====
  if (draftsOnly) {
    return (
      <div className="cr-page animate-up">
        {toast && <div className="cr-toast">{toast}</div>}

        <div className="cr-title-row">
          <h1 className="cr-title">My Drafts</h1>
        </div>

        <div className="cr-search-row">
          <FaSearch className="cr-search-icon" />
          <input type="text" className="cr-search-input" placeholder="Search drafts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="cr-empty">
            <div className="cr-empty-icon">📝</div>
            <div className="cr-empty-title">No drafts</div>
            <div className="cr-empty-sub">Your saved drafts will appear here</div>
          </div>
        ) : (
          <div className="cr-card-list">
            {filtered.map(req => (
              <div key={req.id} className="cr-card cr-card-clickable" onClick={() => navigate(`/requests/${req.id}`)}>
                <div className="cr-ci-box">
                  <div className="cr-ci-avatar" style={{ background: '#EEF4FF', color: '#4A90D9' }}>{getInitials(req.requested_by_name)}</div>
                </div>
                <div className="cr-card-info">
                  <div className="cr-card-ref">{req.request_id}</div>
                  <div className="cr-card-sub">{req.reason || '—'}</div>
                </div>
                <div className="cr-card-date">📅 {formatDate(req.date)}</div>
                <span className="cr-status-pill cr-pill-draft">Draft</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== HOD VIEW =====
  if (isHOD) {
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
      <div className="cr-page animate-up">
        {/* Title */}
        <div className="cr-title-row">
          <h1 className="cr-title">Chemical Request</h1>
          <span className="cr-count-badge cr-count-blue">{pendingCount} Pending</span>
        </div>

        {/* Search + Filter Row */}
        <div className="cr-search-row">
          <div className="cr-search-left">
            <FaSearch className="cr-search-icon" />
            <input type="text" className="cr-search-input" placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="cr-search-divider" />
          <div className="cr-search-right">
            <button className={`cr-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <FaFilter /> Filters
            </button>
            <div className="cr-search-divider" />
            <div className="cr-sort-group">
              <span className="cr-sort-label">Sort by:</span>
              <select className="cr-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">Date</option>
              </select>
              <button className="cr-sort-order-btn" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="cr-filters-panel animate-fade">
            <div className="cr-filters-grid">
              <div className="cr-filter-group">
                <label>Date From:</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
              </div>
              <div className="cr-filter-group">
                <label>Date To:</label>
                <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
              </div>
              <div className="cr-filter-group">
                <label>Staff:</label>
                <input type="text" placeholder="Staff name..." value={filters.staff} onChange={(e) => handleFilterChange('staff', e.target.value)} />
              </div>
            </div>
            <div className="cr-filter-actions">
              <button className="cr-filter-clear" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>
        )}

        {/* Pending Cards */}
        {filtered.length === 0 ? (
          <div className="cr-empty">
            <div className="cr-empty-icon cr-empty-check">✓</div>
            <div className="cr-empty-title">All caught up!</div>
            <div className="cr-empty-sub">No pending requests at the moment</div>
          </div>
        ) : (
          <div className="cr-card-list">
            {filtered.map(req => (
              <div key={req.id} className={`cr-card cr-card-hod ${removingIds.includes(req.id) ? 'cr-removing' : ''}`}>
                <div className="cr-ci-avatar">{getInitials(req.requested_by_name)}</div>
                <div className="cr-card-info">
                  <div className="cr-card-ref">{req.requested_by_name}</div>
                  <div className="cr-card-detail-row">
                    {req.chemical_items?.map((c, i) => (
                      <span key={i} className="cr-chem-pill cr-chem-pill-blue">{c.chemical_name}</span>
                    ))}
                    <span className="cr-detail-text">{req.chemical_items?.reduce((s, c) => s + (c.quantity_ml || 0), 0) || 0} ml</span>
                    <span className="cr-dot">·</span>
                    <span className="cr-detail-text cr-detail-italic">{req.reason || '—'}</span>
                    <span className="cr-dot">·</span>
                    <span className="cr-detail-text">{req.class_name || '—'}</span>
                  </div>
                </div>
                <div className="cr-card-time">📅 {formatDate(req.date)}</div>
                <div className="cr-card-actions">
                  <button className="cr-btn-approve" onClick={() => handleAccept(req.id)} disabled={actionLoading}>
                    <FaCheck /> Approve
                  </button>
                  <button className="cr-btn-reject" onClick={() => handleReject(req.id)} disabled={actionLoading}>
                    <FaTimes /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  // ===== STOREKEEPER VIEW =====
  if (isStoreKeeper) {
    const approvedCount = requests.filter(r => r.status === 'accepted').length;

    return (
      <div className="cr-page animate-up">
        {/* Title */}
        <div className="cr-title-row">
          <h1 className="cr-title">Chemical Request</h1>
          <span className="cr-count-badge cr-count-green">{approvedCount} Approved</span>
        </div>

        {/* Search + Filter Row */}
        <div className="cr-search-row">
          <div className="cr-search-left">
            <FaSearch className="cr-search-icon" />
            <input type="text" className="cr-search-input" placeholder="Search approved requests..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="cr-search-divider" />
          <div className="cr-search-right">
            <button className={`cr-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <FaFilter /> Filters
            </button>
            <div className="cr-search-divider" />
            <div className="cr-sort-group">
              <span className="cr-sort-label">Sort by:</span>
              <select className="cr-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">Date</option>
              </select>
              <button className="cr-sort-order-btn" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="cr-filters-panel animate-fade">
            <div className="cr-filters-grid">
              <div className="cr-filter-group">
                <label>Date From:</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
              </div>
              <div className="cr-filter-group">
                <label>Date To:</label>
                <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
              </div>
              <div className="cr-filter-group">
                <label>Staff:</label>
                <input type="text" placeholder="Staff name..." value={filters.staff} onChange={(e) => handleFilterChange('staff', e.target.value)} />
              </div>
            </div>
            <div className="cr-filter-actions">
              <button className="cr-filter-clear" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>
        )}

        {/* Approved Cards */}
        {filtered.length === 0 ? (
          <div className="cr-empty">
            <div className="cr-empty-icon cr-empty-check">✓</div>
            <div className="cr-empty-title">No approved requests</div>
            <div className="cr-empty-sub">Approved requests from HOD will appear here</div>
          </div>
        ) : (
          <div className="cr-card-list">
            {filtered.map(req => (
              <div key={req.id} className={`cr-card cr-card-sk ${removingIds.includes(req.id) ? 'cr-removing' : ''}`}>
                <div className="cr-ci-avatar cr-av-green">{getInitials(req.requested_by_name)}</div>
                <div className="cr-card-info">
                  <div className="cr-card-ref">{req.requested_by_name}</div>
                  <div className="cr-card-detail-row">
                    {req.chemical_items?.map((c, i) => (
                      <span key={i} className="cr-chem-pill cr-chem-pill-green">{c.chemical_name}</span>
                    ))}
                    <span className="cr-detail-text">{req.chemical_items?.reduce((s, c) => s + (c.quantity_ml || 0), 0) || 0} ml</span>
                    <span className="cr-dot">·</span>
                    <span className="cr-detail-text cr-detail-italic">{req.reason || '—'}</span>
                    <span className="cr-dot">·</span>
                    <span className="cr-detail-text">{req.class_name || '—'}</span>
                  </div>
                  {req.reviewed_by_name && <div className="cr-approved-by">Approved by: {req.reviewed_by_name}</div>}
                </div>
                <div className="cr-card-time">📅 {formatDate(req.date)}</div>
                <button className="cr-btn-issue" onClick={() => handleMarkAsIssued(req.id)} disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : 'Mark as Issued'}
                </button>
              </div>
            ))}
          </div>
        )}

        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    );
  }

  return null;
};

export default StockRequest;
