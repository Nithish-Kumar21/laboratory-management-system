import React, { useEffect, useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import api from '../utils/api';
import './LowStockAlert.css';

function LowStockAlert({ activeTab }) {
  const [lowStockChemicals, setLowStockChemicals] = useState([]);
  const [lowStockApparatus, setLowStockApparatus] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLowStock();

    window.addEventListener('inventory-updated', fetchLowStock);

    const handleStorage = (e) => {
      if (e.key === 'inventory-updated') {
        fetchLowStock();
      }
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(fetchLowStock, 3000);

    return () => {
      window.removeEventListener('inventory-updated', fetchLowStock);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const fetchLowStock = () => {
    api
      .get('/low_stock_chemicals/')
      .then((response) =>
        setLowStockChemicals(
          Array.isArray(response.data) ? response.data : response.data.results || []
        )
      )
      .catch((error) =>
        // eslint-disable-next-line no-console
        console.error('Error fetching low stock chemicals:', error)
      );

    api
      .get('/low_stock_apparatus/')
      .then((response) =>
        setLowStockApparatus(
          Array.isArray(response.data) ? response.data : response.data.results || []
        )
      )
      .catch((error) =>
        // eslint-disable-next-line no-console
        console.error('Error fetching low stock apparatus:', error)
      )
      .finally(() => setLoading(false));
  };

  const currentLowStock = activeTab === 'chemical' ? lowStockChemicals : lowStockApparatus;
  const shouldDisplay = currentLowStock.length > 0;

  if (loading || !shouldDisplay) {
    return null;
  }

  return (
    <div className="low-stock-alert">
      <div className="alert-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="alert-title">
          ⚠️ Low Stock Alert - {currentLowStock.length} item(s) need reordering
        </span>
        <button className="alert-toggle">
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      </div>

      {isExpanded && (
        <div className="alert-content">
          <table className="low-stock-table">
            <thead>
              <tr>
                {activeTab === 'chemical' ? (
                  <>
                    <th>Chemical Name</th>
                    <th>Current Quantity (mL)</th>
                    <th>Reorder Level (mL)</th>
                  </>
                ) : (
                  <>
                    <th>Apparatus Name</th>
                    <th>Current Quantity (pieces)</th>
                    <th>Reorder Level</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {currentLowStock.map((item) => (
                <tr key={item.id}>
                  {activeTab === 'chemical' ? (
                    <>
                      <td>{item.chemical_name}</td>
                      <td>{item.current_quantity_ml}</td>
                      <td>{item.reorder_level}</td>
                    </>
                  ) : (
                    <>
                      <td>{item.apparatus_name}</td>
                      <td>{item.current_quantity_pieces}</td>
                      <td>{item.reorder_level}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LowStockAlert;

