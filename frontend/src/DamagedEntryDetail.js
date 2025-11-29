import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import './DamagedEntry.css';

function DamagedEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [damagedEntry, setDamagedEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/damaged_entry/${id}/`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setDamagedEntry(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.message);
        setLoading(false);
      });
  }, [id]);

  const handleBack = () => {
    navigate('/damaged-entry');
  };

  if (loading) return <p>Loading details...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!damagedEntry) return <p>No data found</p>;

  return (
    <div className="damaged-detail-page">
      <button className="back-button" onClick={handleBack}>
        <FaArrowLeft />
      </button>

      <h2>Damaged Entry</h2>
      
      <div className="entry-info">
        <p><strong>Staff:</strong> {damagedEntry.staff}</p>
        <p><strong>Class:</strong> {damagedEntry.class_name}</p>
        <p><strong>Date:</strong> {damagedEntry.date}</p>
        <p><strong>Caused By:</strong> {damagedEntry.caused_by}</p>
        <p><strong>Details:</strong> {damagedEntry.details}</p>
      </div>

      {damagedEntry.damaged_items && damagedEntry.damaged_items.length > 0 && (
        <>
          <h3>Damaged Apparatus List</h3>
          <table className="minimal-table">
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
