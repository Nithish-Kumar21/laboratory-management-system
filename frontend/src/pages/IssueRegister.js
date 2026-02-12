import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaHandHolding, FaUserTie } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './IssueRegister.css';

function IssueRegister() {
  const [issueEntries, setIssueEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isStaff } = useAuth();

  useEffect(() => {
    if (isStaff) {
      navigate('/');
      return;
    }

    setLoading(true);
    // Mimicking fetch - replace with real API when ready
    setTimeout(() => {
      setIssueEntries([
        { id: 1, staff: 'Dr. Ramesh', items: 'Sulfuric Acid, Beakers', date: '2026-02-05', status: 'Active' },
        { id: 2, staff: 'Asst. Prof. Sneha', items: 'Microscope, Slides', date: '2026-02-04', status: 'Returned' },
      ]);
      setLoading(false);
    }, 600);
  }, [isStaff, navigate]);

  return (
    <div className="issue-register-page animate-up">
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Issue Register</h1>
          <p className="page-subtitle">Track items currently issued to staff and students for active sessions.</p>
        </div>
        <button className="btn-primary" onClick={() => { }}>
          <FaPlus /> Issue New Item
        </button>
      </div>

      {/* Table actions with search removed per user request */}
      <div className="table-actions animate-fade">
        <div className="action-buttons">
          <span className="info-text">Showing latest issues</span>
        </div>
      </div>

      <div className="table-card card animate-fade">
        {loading ? (
          <div className="loading-state"><div className="spinner"></div><p>Syncing issue logs...</p></div>
        ) : (
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Issued To</th>
                  <th>Items / Quantities</th>
                  <th>Date Issued</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issueEntries.map((entry) => (
                  <tr key={entry.id} className="table-row-hover">
                    <td>
                      <div className="staff-info">
                        <FaUserTie className="row-icon" />
                        {entry.staff}
                      </div>
                    </td>
                    <td>
                      <div className="item-details">
                        <FaHandHolding className="row-icon-small" />
                        {entry.items}
                      </div>
                    </td>
                    <td>{entry.date}</td>
                    <td>
                      <span className={`status-tag ${entry.status === 'Active' ? 'amber' : 'emerald'}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-text" onClick={() => { }}>Manage Return</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssueRegister;
