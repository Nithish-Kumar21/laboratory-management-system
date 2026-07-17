import React, { useEffect, useState, useCallback } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import api from '../utils/api';
import { getStatus } from '../utils/inventory';
import './LowStockAlert.css';

function LowStockAlert({ activeTab }) {
  const [lowStockChemicals, setLowStockChemicals] = useState([]);
  const [lowStockApparatus, setLowStockApparatus] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLowStock = useCallback(() => {
    Promise.all([
      api.get('/available_chemicals/').catch(() => ({ data: [] })),
      api.get('/available_apparatus/').catch(() => ({ data: [] }))
    ])
      .then(([chemRes, appRes]) => {
        const chemData = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
        const appData = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];

        const lowChem = chemData.filter(c => {
          const qty = parseFloat(c.quantity) || 0;
          const reorder = parseFloat(c.reorder_level || 0);
          return getStatus(qty, reorder) !== 'healthy';
        }).map(c => ({
          ...c,
          chemical_name: c.chemical_name,
          current_quantity: c.quantity,
          reorder_level: c.reorder_level
        }));

        const lowApp = appData.filter(a => {
          const qty = parseFloat(a.available_quantity_pieces) || 0;
          const reorder = parseFloat(a.reorder_level || 0);
          return getStatus(qty, reorder) !== 'healthy';
        }).map(a => ({
          ...a,
          apparatus_name: a.apparatus_name,
          current_quantity_pieces: a.available_quantity_pieces,
          reorder_level: a.reorder_level
        }));

        setLowStockChemicals(lowChem);
        setLowStockApparatus(lowApp);
      })
      .catch((error) => console.error('Error fetching low stock:', error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLowStock();

    window.addEventListener('inventory-updated', fetchLowStock);

    const handleStorage = (e) => {
      if (e.key === 'inventory-updated') {
        fetchLowStock();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('inventory-updated', fetchLowStock);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchLowStock]);

  const currentLowStock = activeTab === 'chemical' ? lowStockChemicals : lowStockApparatus;
  const shouldDisplay = currentLowStock.length > 0;

  if (loading || !shouldDisplay) {
    return null;
  }

  return (
    <div className="low-stock-alert">
      <div className="alert-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="alert-title">
          <span className="alert-icon-ring"></span>
          Low Stock Warning - {currentLowStock.length} item(s) need attention
        </span>
        <button className="alert-toggle">
          {isExpanded ? 'Hide Details' : 'View Items'}
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
                    <th>Stock</th>
                    <th>Minimum</th>
                  </>
                ) : (
                  <>
                    <th>Apparatus Name</th>
                    <th>Stock (pcs)</th>
                    <th>Minimum</th>
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
                      <td><span className="qty-pill">{item.current_quantity}</span></td>
                      <td>{item.reorder_level}</td>
                    </>
                  ) : (
                    <>
                      <td>{item.apparatus_name}</td>
                      <td><span className="qty-pill">{item.current_quantity_pieces}</span></td>
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

