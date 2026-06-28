import React, { useEffect, useState } from 'react';
import { FaSearch, FaFilter } from 'react-icons/fa';
import ChemicalTable from '../components/tables/ChemicalTable';
import ApparatusTable from '../components/tables/ApparatusTable';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Inventory.css';

function getStatus(qty, reorder) {
  if (qty <= reorder) return 'critical';
  if (qty <= reorder * 1.5) return 'low-stock';
  return 'healthy';
}

function Inventory() {
  const { isStaff } = useAuth();
  const [activeTab, setActiveTab] = useState('chemical');
  const [searchTerm, setSearchTerm] = useState('');
  const [warningItems, setWarningItems] = useState([]);
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  const showExtra = !isStaff;

  const checkLowStock = async () => {
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('available_chemicals/').catch(() => ({ data: [] })),
        api.get('available_apparatus/').catch(() => ({ data: [] })),
      ]);
      const chem = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
      const app = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];

      const lowChem = chem.filter(c => {
        const qty = parseFloat(c.quantity);
        const reorder = parseFloat(c.reorder_level || 0);
        return getStatus(qty, reorder) !== 'healthy';
      });
      const lowApp = app.filter(a => {
        const qty = parseFloat(a.available_quantity_pieces);
        const reorder = parseFloat(a.reorder_level || 0);
        return getStatus(qty, reorder) !== 'healthy';
      });
      setWarningItems([...lowChem, ...lowApp]);
    } catch (e) {
      console.error('Low stock check failed', e);
    }
  };

  useEffect(() => {
    checkLowStock();
    window.addEventListener('inventory-updated', checkLowStock);
    const interval = setInterval(checkLowStock, 60000);
    return () => {
      window.removeEventListener('inventory-updated', checkLowStock);
      clearInterval(interval);
    };
  }, []);

  const totalWarning = warningItems.length;

  return (
    <div className="inventory-page animate-up">
      <h1 className="inv-page-title">Inventory</h1>

      <div className="inv-tabs">
        <button
          className={`inv-tab ${activeTab === 'chemical' ? 'active' : ''}`}
          onClick={() => setActiveTab('chemical')}
        >
          Chemicals
        </button>
        <button
          className={`inv-tab ${activeTab === 'apparatus' ? 'active' : ''}`}
          onClick={() => setActiveTab('apparatus')}
        >
          Apparatus
        </button>
      </div>

      <div className="inv-search-row">
        <div className="inv-search-wrap">
          <FaSearch className="inv-search-icon" />
          <input
            type="text"
            className="inv-search-input"
            placeholder={`Search ${activeTab === 'chemical' ? 'chemicals' : 'apparatus'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="inv-filter-btn" type="button">
          <FaFilter />
        </button>
      </div>

      {showExtra && (
        <div className="inv-legend">
          <span><span className="legend-dot green" /> Healthy</span>
          <span><span className="legend-dot yellow" /> Low Stock</span>
          <span><span className="legend-dot red" /> Critical</span>
        </div>
      )}

      {showExtra && totalWarning > 0 && (
        <div className="inv-warning-banner">
          <span className="warning-text">
            <span className="warning-icon">🔴</span>
            Low Stock Warning — {totalWarning} item(s) need attention
          </span>
          <span className="warning-action" onClick={() => setShowOnlyLowStock(s => !s)} style={{ cursor: 'pointer' }}>
            {showOnlyLowStock ? 'Show All' : 'View Items'}
          </span>
        </div>
      )}

      {activeTab === 'chemical' ? (
        <ChemicalTable showExtra={showExtra} searchTerm={searchTerm} showOnlyLowStock={showOnlyLowStock} />
      ) : (
        <ApparatusTable showExtra={showExtra} searchTerm={searchTerm} showOnlyLowStock={showOnlyLowStock} />
      )}
    </div>
  );
}

export default Inventory;
