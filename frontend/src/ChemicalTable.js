import React, { useEffect, useState } from 'react';

function ChemicalTable() {
  const [chemicals, setChemicals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/available_chemicals/')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setChemicals(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.message);
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
          <th>Available Quantity (mL)</th>
          <th>Reorder Level (mL)</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        {chemicals.map((item) => (
          <tr key={item.id}>
            <td>{item.chemical_name}</td>
            <td>{item.available_quantity_ml}</td>
            <td>{item.reorder_level}</td>
            <td>{item.last_updated}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ChemicalTable;
