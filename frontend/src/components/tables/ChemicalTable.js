import React, { useEffect, useState } from 'react';
import { FaFlask, FaExclamationCircle, FaCheckCircle, FaHistory } from 'react-icons/fa';
import api from '../../utils/api';

function ChemicalTable({ showReorderLevel = true }) {
  const [chemicals, setChemicals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('available_chemicals/')
      .then((response) => {
        setChemicals(
          Array.isArray(response.data) ? response.data : response.data.results || []
        );
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"></div>;

  return (
    <div className="table-container animate-fade">
      <table className="premium-table">
        <thead>
          <tr>
            <th>Chemical Name</th>
            <th>Available Stock</th>
            {showReorderLevel && <th>Reorder Point</th>}
            <th>Last Logged</th>
          </tr>
        </thead>
        <tbody>
          {chemicals.map((item) => {
            const isLow = showReorderLevel && item.available_quantity_ml <= item.reorder_level;
            return (
              <tr key={item.id} className={isLow ? 'row-warning' : ''}>
                <td>
                  <div className="item-name-cell">
                    <FaFlask className="item-icon" style={{ color: isLow ? '#f59e0b' : '#6366f1' }} />
                    {item.chemical_name}
                  </div>
                </td>
                <td>
                  <span className={`stock-value ${isLow ? 'low' : ''}`}>
                    {item.available_quantity_ml} <span className="unit">ml</span>
                  </span>
                </td>
                {showReorderLevel && <td>{item.reorder_level} ml</td>}
                <td>
                  <div className="date-cell">
                    <FaHistory className="date-icon" />
                    {item.last_updated}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ChemicalTable;
