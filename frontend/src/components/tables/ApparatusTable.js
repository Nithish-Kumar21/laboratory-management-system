import React, { useEffect, useState } from 'react';
import { FaBoxes, FaExclamationCircle, FaCheckCircle, FaHistory } from 'react-icons/fa';
import api from '../../utils/api';

function ApparatusTable() {
  const [apparatus, setApparatus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/available_apparatus/')
      .then((response) => {
        setApparatus(
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
            <th>Apparatus Name</th>
            <th>Available Stock</th>
            <th>Reorder Point</th>
            <th>Last Logged</th>
          </tr>
        </thead>
        <tbody>
          {apparatus.map((item) => {
            const isLow = item.available_quantity_pieces <= item.reorder_level;
            return (
              <tr key={item.id} className={isLow ? 'row-warning' : ''}>
                <td>
                  <div className="item-name-cell">
                    <FaBoxes className="item-icon" style={{ color: isLow ? '#f59e0b' : '#10b981' }} />
                    {item.apparatus_name}
                  </div>
                </td>
                <td>
                  <span className={`stock-value ${isLow ? 'low' : ''}`}>
                    {item.available_quantity_pieces} <span className="unit">pcs</span>
                  </span>
                </td>
                <td>{item.reorder_level} pcs</td>
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

export default ApparatusTable;
