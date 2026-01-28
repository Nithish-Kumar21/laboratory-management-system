import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useAuth } from './context/AuthContext';
import api from './utils/api';
import AddDamagedEntryModal from './AddDamagedEntryModal';
import './DamagedEntry.css';

function DamagedEntry() {
  const [damagedEntries, setDamagedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isStoreKeeper, isStaff, isHOD } = useAuth();

  const canAddEntry = isAdmin || isStoreKeeper;

  const fetchDamagedEntries = () => {
    setLoading(true);
    api.get('/damaged_entry/')
      .then((response) => {
        setDamagedEntries(Array.isArray(response.data) ? response.data : response.data.results || []);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
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

  const handleRowClick = (id) => {
    navigate(`/damaged-entry/${id}`);
  };

  const handleModalSuccess = () => {
    fetchDamagedEntries(); // Refresh the list
  };

  if (loading) return <p>Loading damaged entries...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="damaged-entry-page">
      <div className="page-header">
        <h2>Damaged Entry</h2>
        {canAddEntry && (
          <button className="add-entry-btn" onClick={() => setIsModalOpen(true)}>
            <FaPlus /> Add New Entry
          </button>
        )}
      </div>

      <table className="minimal-table clickable-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Class</th>
            <th>Date</th>
            <th>Caused By</th>
          </tr>
        </thead>
        <tbody>
          {damagedEntries.map((entry) => (
            <tr key={entry.id} onClick={() => handleRowClick(entry.id)}>
              <td>{entry.staff}</td>
              <td>{entry.class_name}</td>
              <td>{entry.date}</td>
              <td>{entry.caused_by}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <AddDamagedEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default DamagedEntry;
