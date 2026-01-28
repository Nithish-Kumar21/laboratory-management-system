import React, { useState, useEffect } from 'react';
import ChemicalTable from './ChemicalTable';
import ApparatusTable from './ApparatusTable';
import LowStockAlert from './LowStockAlert';
import api from './utils/api';
import './Inventory.css';

function Inventory() {
  const [activeTab, setActiveTab] = useState('chemical');
  const [hasLowStockChem, setHasLowStockChem] = useState(false);
  const [hasLowStockApp, setHasLowStockApp] = useState(false);

  const checkLowStockStatus = async () => {
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('/low_stock_chemicals/'),
        api.get('/low_stock_apparatus/')
      ]);
      const chemData = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
      const appData = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];

      setHasLowStockChem(chemData.length > 0);
      setHasLowStockApp(appData.length > 0);
    } catch (err) {
      console.error('Error checking tab low stock:', err);
    }
  };

  useEffect(() => {
    checkLowStockStatus();
    window.addEventListener('inventory-updated', checkLowStockStatus);
    window.addEventListener('storage', (e) => {
      if (e.key === 'inventory-updated') checkLowStockStatus();
    });
    const interval = setInterval(checkLowStockStatus, 3000);
    return () => {
      window.removeEventListener('inventory-updated', checkLowStockStatus);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="inventory-page">
      <h2>Inventory</h2>
      <div className="inventory-tabs">
        <button
          className={activeTab === 'chemical' ? "tab-btn tab-btn--active" : "tab-btn"}
          onClick={() => setActiveTab('chemical')}
          style={{ position: 'relative' }}
        >
          Chemical
          {hasLowStockChem && <span className="tab-dot"></span>}
        </button>
        <button
          className={activeTab === 'apparatus' ? "tab-btn tab-btn--active" : "tab-btn"}
          onClick={() => setActiveTab('apparatus')}
          style={{ position: 'relative' }}
        >
          Apparatus
          {hasLowStockApp && <span className="tab-dot"></span>}
        </button>
      </div>

      {/* Low Stock Alert - Context aware */}
      <LowStockAlert activeTab={activeTab} />

      <div className="inventory-content">
        {activeTab === 'chemical' ? <ChemicalTable /> : <ApparatusTable />}
      </div>
    </div>
  );
}

export default Inventory;
