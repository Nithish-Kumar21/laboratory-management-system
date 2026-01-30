import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function ChemicalTable() {
  const [chemicals, setChemicals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/available_chemicals/')
      .then((response) => {
        setChemicals(
          Array.isArray(response.data) ? response.data : response.data.results || []
        );
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading chemicals...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <table className="minimal-table">
      <thead>
        <tr>
          <th>Chemical Name</th>
          <th>Stock <span className="hide-mobile">(mL)</span></th>
          <th>Reorder <span className="hide-mobile">Level</span></th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {chemicals.map((item) => (
          <tr key={item.id}>
            <td data-label="Chemical">{item.chemical_name}</td>
            <td data-label="Stock">{item.available_quantity_ml}</td>
            <td data-label="Reorder">{item.reorder_level}</td>
            <td data-label="Updated">{item.last_updated}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ChemicalTable;

