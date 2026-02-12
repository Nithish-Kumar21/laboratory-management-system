import React, { useEffect, useState } from 'react';
import { FaPlus, FaCheck, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AddRequestModal from '../components/modals/AddRequestModal';
import './Home.css';

function Home() {
  const { isStaff, isHOD } = useAuth();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPendingRequests = () => {
    if (!isHOD) return;
    setLoading(true);
    api
      .get('/stock_request/', { params: { status: 'pending' } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setPendingRequests(data);
      })
      .catch((err) => console.error('Error fetching requests:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPendingRequests();
  }, [isHOD]);

  const handleAccept = (id) => {
    api
      .post(`/stock_request/${id}/accept/`)
      .then(() => fetchPendingRequests())
      .catch((err) => console.error('Error accepting:', err));
  };

  const handleReject = (id) => {
    api
      .post(`/stock_request/${id}/reject/`)
      .then(() => fetchPendingRequests())
      .catch((err) => console.error('Error rejecting:', err));
  };

  const handleRequestSuccess = () => {
    setIsRequestModalOpen(false);
  };

  return (
    <div className="home-page">
      <h2>Home</h2>

      {isStaff && (
        <div className="home-staff-section">
          <button
            type="button"
            className="home-request-btn"
            onClick={() => setIsRequestModalOpen(true)}
          >
            <FaPlus /> Request Chemicals & Apparatus
          </button>
          <AddRequestModal
            isOpen={isRequestModalOpen}
            onClose={() => setIsRequestModalOpen(false)}
            onSuccess={handleRequestSuccess}
          />
        </div>
      )}

      {isHOD && (
        <div className="home-hod-section">
          <h3>Pending Requests</h3>
          {loading ? (
            <p>Loading...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="home-empty">No pending requests.</p>
          ) : (
            <div className="home-requests-list">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className={`request-card ${req.status}`}
                >
                  <div className="request-card-header">
                    <div>
                      <strong>{req.requested_by_name}</strong> ({req.requested_by_id})
                      <div className="request-card-meta">
                        {new Date(req.created_at).toLocaleString()}
                      </div>
                      {req.reason && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>{req.reason}</p>
                      )}
                    </div>
                    <div className="request-card-actions">
                      <button
                        type="button"
                        className="btn-accept"
                        onClick={() => handleAccept(req.id)}
                      >
                        <FaCheck /> Accept
                      </button>
                      <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleReject(req.id)}
                      >
                        <FaTimes /> Reject
                      </button>
                    </div>
                  </div>
                  {(req.chemical_items?.length > 0 || req.apparatus_items?.length > 0) && (
                    <div className="request-items-section">
                      {req.chemical_items?.length > 0 && (
                        <div>
                          <strong>Chemicals:</strong>
                          <ul className="request-items-list">
                            {req.chemical_items.map((c, i) => (
                              <li key={i}>
                                {c.chemical_name} — {c.quantity_ml} mL
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {req.apparatus_items?.length > 0 && (
                        <div>
                          <strong>Apparatus:</strong>
                          <ul className="request-items-list">
                            {req.apparatus_items.map((a, i) => (
                              <li key={i}>
                                {a.apparatus_name} — {a.quantity_pieces} pcs
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isStaff && !isHOD && (
        <p>Welcome to Lab Manager.</p>
      )}
    </div>
  );
}

export default Home;
