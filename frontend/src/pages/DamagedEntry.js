import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlusCircle, FaExclamationTriangle, FaUserShield, FaGraduationCap, FaCalendarAlt, FaClock } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AddDamagedEntryModal from '../components/modals/AddDamagedEntryModal';
import './DamagedEntry.css';

function DamagedEntry() {
  const [damagedEntries, setDamagedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isStoreKeeper, isStaff } = useAuth();

  const canAddEntry = isAdmin || isStoreKeeper;

  const fetchDamagedEntries = () => {
    setLoading(true);
    api
      .get('damaged_entry/')
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
  }, [isStaff, navigate]);

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
        ) : damagedEntries.length === 0 ? (
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
                {damagedEntries.map((entry) => (
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
