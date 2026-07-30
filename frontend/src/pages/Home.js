import React, { useState, useEffect } from 'react';
import { FaFlask, FaBoxes, FaClipboardList, FaExclamationTriangle, FaCheck, FaTimes, FaPlus, FaClock } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AddRequestModal from '../components/modals/AddRequestModal';
import './Home.css';
import { getStatus } from '../utils/inventory';
import './VintageClock.css';
import '../components/modals/AddDamagedEntryModal.css';
import '../pages/StockRequestDetail.css';
import '../components/modals/AddRequestModal.css';

function Home() {
  const { isStaff, isHOD, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    chemicals: 0,
    apparatus: 0,
    stockEntries: 0,
    damagedEntries: 0
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Request State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [rejectState, setRejectState] = useState({ show: false, id: null, reason: '' });
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = async () => {
    try {
      const [chemRes, appRes, stockRes, damagedRes] = await Promise.all([
        api.get('/available_chemicals/').catch(() => ({ data: [] })),
        api.get('/available_apparatus/').catch(() => ({ data: [] })),
        api.get('/stock_register/').catch(() => ({ data: [] })),
        api.get('/damaged_entry/').catch(() => ({ data: [] })),
      ]);

      const getCount = (response) => {
        if (!response.data) return 0;
        if (typeof response.data.count === 'number') return response.data.count;
        if (Array.isArray(response.data.results)) return response.data.results.length;
        if (Array.isArray(response.data)) return response.data.length;
        return 0;
      };

      setStats({
        chemicals: getCount(chemRes),
        apparatus: getCount(appRes),
        stockEntries: getCount(stockRes),
        damagedEntries: getCount(damagedRes)
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const fetchLowStockItems = async () => {
    if (isStaff || isAdmin) return;
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('/available_chemicals/').catch(() => ({ data: [] })),
        api.get('/available_apparatus/').catch(() => ({ data: [] })),
      ]);

      const chemData = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
      const appData = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];

      const lowChem = chemData.filter(c => {
        const qty = parseFloat(c.quantity);
        const reorder = parseFloat(c.reorder_level || 0);
        const status = getStatus(qty, reorder);
        return status === 'critical' || status === 'low-stock';
      }).map(item => ({ ...item, type: 'Chemical', icon: FaFlask, quantity: item.quantity }));

      const lowApp = appData.filter(a => {
        const qty = parseFloat(a.available_quantity_pieces);
        const reorder = parseFloat(a.reorder_level || 0);
        const status = getStatus(qty, reorder);
        return status === 'critical' || status === 'low-stock';
      }).map(item => ({ ...item, type: 'Apparatus', icon: FaBoxes, quantity_pieces: item.available_quantity_pieces }));

      setLowStockItems([...lowChem, ...lowApp].slice(0, 5));
    } catch (err) {
      console.error('Error fetching low stock:', err);
    }
  };

  const fetchRequests = () => {
    setRequestsLoading(true);
    const params = isHOD ? { status: 'pending' } : {};
    api
      .get('/stock_request/', { params })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (isHOD) {
          setPendingRequests(data);
        } else if (isStaff) {
          const hasActive = data.some(r => !['draft', 'completed', 'rejected'].includes(r.status));
          setHasPendingRequest(hasActive);
        }
      })
      .catch((err) => console.error('Error fetching requests:', err))
      .finally(() => setRequestsLoading(false));
  };

  useEffect(() => {
    fetchStats();
    fetchLowStockItems();
    fetchRequests();

    const interval = setInterval(() => {
      fetchStats();
      fetchLowStockItems();
      fetchRequests();
    }, 30000);

    return () => clearInterval(interval);
  }, [isHOD, isStaff, isAdmin]);

  const handleAccept = (id) => {
    setActionError('');
    api
      .post(`/stock_request/${id}/accept/`)
      .then(() => {
        fetchRequests();
        window.dispatchEvent(new CustomEvent('inventory-updated'));
      })
      .catch((err) => setActionError(err.response?.data?.error || 'Failed to accept'));
  };

  const handleRejectWithReason = () => {
    const reason = rejectState.reason.trim();
    if (!reason) return;
    setActionError('');
    api
      .post(`/stock_request/${rejectState.id}/reject/`, { rejection_reason: reason })
      .then(() => {
        setRejectState({ show: false, id: null, reason: '' });
        fetchRequests();
        window.dispatchEvent(new CustomEvent('inventory-updated'));
      })
      .catch((err) => setActionError(err.response?.data?.error || 'Failed to reject'));
  };

  const openRejectDialog = (id) => {
    setActionError('');
    setRejectState({ show: true, id, reason: '' });
  };

  const handleRequestSuccess = () => {
    setIsRequestModalOpen(false);
  };

  const cards = [
    { label: 'Total Chemicals', count: stats.chemicals, icon: FaFlask, color: 'var(--dept-inventory)', link: '/inventory' },
    { label: 'Total Apparatus', count: stats.apparatus, icon: FaBoxes, color: 'var(--dept-issue)', link: '/inventory' },
    { label: 'Stock Entries', count: stats.stockEntries, icon: FaClipboardList, color: 'var(--dept-stock)', link: '/stock-register' },
    { label: 'Damaged Items', count: stats.damagedEntries, icon: FaExclamationTriangle, color: 'var(--dept-damaged)', link: '/damaged-entry' },
  ];

  const statsData = [
    { name: 'Chemicals', value: stats.chemicals, color: 'var(--dept-inventory)' },
    { name: 'Apparatus', value: stats.apparatus, color: 'var(--dept-issue)' },
    { name: 'Stock', value: stats.stockEntries, color: 'var(--dept-stock)' },
    { name: 'Damaged', value: stats.damagedEntries, color: 'var(--dept-damaged)' }
  ];

  return (
    <div className="home-page dept-dashboard animate-up">
      <div className="page-header header-with-dept">
        <div className="dept-title-container">
          <div className="dept-details">
            <span className="dept-tag">Department of Chemistry</span>
            <h1 className="dept-main-title">B.Sc. CHEMISTRY</h1>
          </div>
        </div>
        <div className="status-badge-container home-clock-box">
          <div className="vintage-clock">
            <div className="clock-face">
              <div className="clock-center"></div>
              <div className="hour-hand" style={{ transform: `rotate(${(currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5}deg)` }}></div>
              <div className="minute-hand" style={{ transform: `rotate(${currentTime.getMinutes() * 6}deg)` }}></div>
              <div className="second-hand" style={{ transform: `rotate(${currentTime.getSeconds() * 6}deg)` }}></div>
              {[...Array(12)].map((_, i) => (
                <div key={i} className="hour-marker" style={{ transform: `rotate(${i * 30}deg)`, '--rotation': `${i * 30}deg` }}>
                  <span className="hour-number">{i === 0 ? 12 : i}</span>
                </div>
              ))}
            </div>
            <div className="clock-label">
              <span className="date-vintage">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {cards.map((card, idx) => (
          <Link to={card.link} key={idx} className="stat-card card animate-fade" style={{ '--card-color': card.color }}>
            <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}>
              <card.icon />
            </div>
            <div className="stat-content">
              <h3>{card.count}</h3>
              <p>{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="home-sections-grid">
        {/* Statistics Chart - Hide for Staff */}
        {!isStaff && (
          <div className="analytics-section card animate-fade">
            <div className="section-title-bar">
              <h3>📈 Inventory Analytics</h3>
            </div>
            <div className="chart-container" style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {statsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Low Stock Alerts - Hide for Staff and Admin */}
        {!isStaff && !isAdmin && lowStockItems.length > 0 && (
          <div className="low-stock-section card animate-fade">
            <div className="section-title-bar">
              <h3>⚠️ Low Stock Alerts</h3>
              <Link to="/inventory" className="view-all-link">View All</Link>
            </div>
            <div className="low-stock-list">
              {lowStockItems.map((item, idx) => (
                <div key={idx} className="low-stock-item">
                  <div className="stock-item-icon" style={{ color: 'var(--dept-damaged)' }}>
                    <item.icon />
                  </div>
                  <div className="stock-item-info">
                    <span className="stock-item-name">{item.chemical_name || item.apparatus_name}</span>
                    <span className="stock-item-type">{item.type}</span>
                  </div>
                  <div className="stock-item-quantity">
                    <span className="quantity-value">{item.quantity || item.quantity_pieces}</span>
                    <span className="quantity-unit">{item.quantity ? (item.unit || '').toUpperCase() : 'PCS'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



        {/* Staff Actions */}
        {isStaff && (
          <div className="staff-actions-section card animate-fade">
            <div className="section-title-bar">
              <h3>🚀 Quick Actions</h3>
            </div>
            <div className="request-action-box">
              <button
                type="button"
                className="home-request-btn"
                onClick={() => setIsRequestModalOpen(true)}
              >
                <FaPlus /> {hasPendingRequest ? 'Create New Draft' : 'Request Chemicals'}
              </button>
              {hasPendingRequest && (
                <p className="request-limit-msg">
                  <FaExclamationTriangle /> Active request exists. New requests will save as drafts.
                </p>
              )}
            </div>

            <AddRequestModal
              isOpen={isRequestModalOpen}
              onClose={() => setIsRequestModalOpen(false)}
              hasActiveRequest={hasPendingRequest}
              onSuccess={() => {
                handleRequestSuccess();
                fetchRequests();
              }}
            />
          </div>
        )}

        {/* HOD Pending Requests */}
        {isHOD && (
          <div className="hod-requests-section card animate-fade">
            <div className="section-title-bar">
              <h3>📋 Pending Chemical Approvals</h3>
              <Link to="/requests?status=pending" className="view-all-link">Manage All</Link>
            </div>
            {actionError && <div className="error-banner">{actionError}</div>}
            {requestsLoading ? (
              <p>Loading...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="home-empty">No new requests found.</p>
            ) : (
              <div className="home-requests-list">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`request-mini-card ${req.status}`}
                    onClick={() => navigate(`/requests/${req.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="request-mini-header">
                      <div className="requester-meta">
                        <strong>{req.requested_by_name}</strong>
                        <span className="request-date">{req.date ? new Date(req.date).toLocaleDateString() : new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="request-mini-actions">
                        <button className="btn-icon accept" title="Accept" onClick={(e) => { e.stopPropagation(); handleAccept(req.id); }}><FaCheck /></button>
                        <button className="btn-icon reject" title="Reject" onClick={(e) => { e.stopPropagation(); openRejectDialog(req.id); }}><FaTimes /></button>
                      </div>
                    </div>
                    <div className="request-summary">
                      <span className="req-id-label">{req.request_id}</span>
                      {req.reason && <p className="reason-text">{req.reason.substring(0, 60)}...</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reject Reason Modal */}
        {rejectState.show && (
          <div className="modal-overlay" onClick={() => setRejectState({ ...rejectState, show: false })}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Reason for Rejection</h3>
                <button type="button" className="modal-close" onClick={() => setRejectState({ ...rejectState, show: false })} aria-label="Close">×</button>
              </div>
              <div className="modal-body">
                <p className="section-helper-text">Please provide a reason before rejecting this request.</p>
                <textarea
                  value={rejectState.reason}
                  onChange={(e) => setRejectState({ ...rejectState, reason: e.target.value })}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                  className="modern-textarea"
                  style={{ width: '100%', marginTop: '8px' }}
                />
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setRejectState({ show: false, id: null, reason: '' })}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  onClick={handleRejectWithReason}
                  disabled={!rejectState.reason.trim()}
                >
                  Reject Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
