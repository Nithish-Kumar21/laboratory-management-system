import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function ApparatusTable() {
  const [apparatus, setApparatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/available_apparatus/')
      .then((response) => {
        setApparatus(
          Array.isArray(response.data) ? response.data : response.data.results || []
        );
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading apparatus...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <table className="minimal-table">
      <thead>
        <tr>
          <th>Apparatus Name</th>
          <th>Available Quantity (pieces)</th>
          <th>Reorder Level</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        {apparatus.map((item) => (
          <tr key={item.id}>
            <td>{item.apparatus_name}</td>
            <td>{item.available_quantity_pieces}</td>
            <td>{item.reorder_level}</td>
            <td>{item.last_updated}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ApparatusTable;

