import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaFileInvoice, FaCalendarAlt, FaChevronRight, FaClipboardList, FaUser, FaGraduationCap } from 'react-icons/fa';
import api from '../utils/api';
import './StockRegister.css'; // Reuse the grid and card styles

function IssueRegister() {
  const [issueRegisters, setIssueRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchRegisters = async () => {
    try {
      const res = await api.get('/issue_register/');
      setIssueRegisters(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Error fetching issue register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisters();
  }, []);

  const filtered = (issueRegisters || []).filter(r =>
  (r.staff_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.class_field?.toLowerCase().includes(search.toLowerCase()) ||
    String(r.ir_id || '').includes(search))
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
      </div>

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
                  <h3>IR-#{register.ir_id}</h3>
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
