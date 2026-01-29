import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './DamagedEntry.css';

function DamagedEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [damagedEntry, setDamagedEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isStaff, isStoreKeeper } = useAuth();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isStaff) {
      navigate('/');
      return;
    }
    api
      .get(`/damaged_entry/${id}/`)
      .then((response) => {
        setDamagedEntry(response.data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
        setLoading(false);
      });
  }, [id, isStaff, navigate]);

  const handleBack = () => {
    navigate('/damaged-entry');
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete this entry? This will also add the damaged quantities back to the inventory.'
      )
    ) {
      setDeleting(true);
      try {
        await api.delete(`/damaged_entry/${id}/`);
        window.dispatchEvent(new Event('inventory-updated'));
        localStorage.setItem('inventory-updated', Date.now());
        alert('Entry deleted successfully');
        navigate('/damaged-entry');
      } catch (err) {
        alert('Failed to delete entry: ' + (err.response?.data?.error || err.message));
      } finally {
        setDeleting(false);
      }
    }
  };

  if (loading) return <p>Loading details...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!damagedEntry) return <p>No data found</p>;

  return (
    <div className="damaged-detail-page">
      <button className="back-button" onClick={handleBack}>
        <FaArrowLeft />
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Damaged Entry</h2>
        {isStoreKeeper && (
          <button
            className="delete-entry-btn"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 15px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <FaTrash /> {deleting ? 'Deleting...' : 'Delete Entry'}
          </button>
        )}
      </div>

      <div className="entry-info">
        <p>
          <strong>Staff:</strong> {damagedEntry.staff}
        </p>
        <p>
          <strong>Class:</strong> {damagedEntry.class_name}
        </p>
        <p>
          <strong>Date:</strong> {damagedEntry.date}
        </p>
        <p>
          <strong>Caused By:</strong> {damagedEntry.caused_by}
        </p>
        <p>
          <strong>Details:</strong> {damagedEntry.details}
        </p>
      </div>

      {damagedEntry.damaged_items && damagedEntry.damaged_items.length > 0 && (
        <>
          <h3>Damaged Apparatus List</h3>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Apparatus Name</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {damagedEntry.damaged_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.apparatus_name}</td>
                  <td>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default DamagedEntryDetail;

