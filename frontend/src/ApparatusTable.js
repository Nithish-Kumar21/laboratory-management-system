import React, { useEffect, useState } from 'react';

function ApparatusTable() {
  const [apparatus, setApparatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/available_apparatus/')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setApparatus(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.message);
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
