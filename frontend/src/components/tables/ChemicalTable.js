import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

function getStatus(qty, reorder) {
  if (qty <= reorder) return 'critical';
  if (qty <= reorder * 1.5) return 'low-stock';
  return 'healthy';
}

function getStatusColor(status) {
  if (status === 'critical') return { border: '#C62828', bg: '#FFEBEE', text: '#C62828', label: 'Critical' };
  if (status === 'low-stock') return { border: '#E65100', bg: '#FFF3E0', text: '#E65100', label: 'Low Stock' };
  return { border: '#2E7D32', bg: '#E8F5E9', text: '#2E7D32', label: 'Healthy' };
}

function ChemicalTable({ showExtra = true, searchTerm = '' }) {
  const [chemicals, setChemicals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('available_chemicals/')
      .then((res) => {
        setChemicals(
          Array.isArray(res.data) ? res.data : res.data.results || []
        );
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="inv-loading"><div className="loading-spinner" /></div>;

  const filtered = chemicals.filter((item) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return item.chemical_name.toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    return <div className="inv-empty">No chemicals found.</div>;
  }

  return (
    <>
      <div className="inv-table-wrapper">
        <table className="inv-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th className="col-name">Name</th>
              <th className="col-qty">Quantity</th>
              {showExtra && <th className="col-rl">Reorder Level</th>}
              {showExtra && <th className="col-status">Status</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const qty = parseFloat(item.available_quantity_ml);
              const reorder = parseFloat(item.reorder_level || 0);
              const status = showExtra ? getStatus(qty, reorder) : null;
              const colors = status ? getStatusColor(status) : null;
              return (
                <tr key={item.id} className={showExtra && status ? `row-${status}` : ''}>
                  <td className="col-index">{idx + 1}</td>
                  <td className="col-name"><span className="item-name">{item.chemical_name}</span></td>
                  <td className="col-qty">{qty} <span className="unit-text">ml</span></td>
                  {showExtra && <td className="col-rl">{reorder} <span className="unit-text">ml</span></td>}
                  {showExtra && (
                    <td className="col-status">
                      <span className={`status-badge ${status}`}>{colors.label}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="inv-card-grid">
        {filtered.map((item) => {
          const qty = parseFloat(item.available_quantity_ml);
          const reorder = parseFloat(item.reorder_level || 0);
          const status = showExtra ? getStatus(qty, reorder) : null;
          return (
            <div key={item.id} className={`inv-card${showExtra && status ? ` card-${status}` : ''}`}>
              <div className="inv-card-name">{item.chemical_name}</div>
              <div className="inv-card-row">
                <span className="inv-card-label">
                  Qty: <span className="inv-card-value">{qty} <span className="unit-text">ml</span></span>
                </span>
                {showExtra && (
                  <span className="inv-card-label">
                    RL: <span className="inv-card-value">{reorder} <span className="unit-text">ml</span></span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default ChemicalTable;
