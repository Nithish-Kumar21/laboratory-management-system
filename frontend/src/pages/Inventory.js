import React, { useEffect, useState } from 'react';
import { FaBoxes, FaClock } from 'react-icons/fa';
import ApparatusTable from '../components/tables/ApparatusTable';
import ChemicalTable from '../components/tables/ChemicalTable';
import LowStockAlert from '../components/LowStockAlert';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Inventory.css';

function Inventory() {
  const { isStaff, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('chemical');
  const [hasLowStockChem, setHasLowStockChem] = useState(false);
  const [hasLowStockApp, setHasLowStockApp] = useState(false);

  const showLowStockFeature = !isStaff && !isAdmin;
  const showReorderLevel = !isStaff;

  const checkLowStockStatus = async () => {
    if (!showLowStockFeature) return;
    try {
      const [chemRes, appRes] = await Promise.all([
        api.get('low_stock_chemicals/').catch(() => ({ data: [] })),
        api.get('low_stock_apparatus/').catch(() => ({ data: [] })),
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
    const interval = setInterval(checkLowStockStatus, 60000);
    return () => {
      window.removeEventListener('inventory-updated', checkLowStockStatus);
      clearInterval(interval);
    };
  }, [showLowStockFeature]);

  return (
    <div className="inventory-page dept-inventory animate-up">
      <div className="page-header">
        <div className="dept-title-container">
          <div className="dept-icon-box" style={{ color: 'var(--dept-inventory)' }}>
            <FaBoxes />
          </div>
          <div>
            <h1 className="page-title">Inventory Management</h1>
            <p className="page-subtitle">Real-time tracking of chemicals and laboratory apparatus.</p>
          </div>
        </div>
        {showLowStockFeature && (
          <div className="status-badge-container">
            <span className={`status-badge ${hasLowStockChem || hasLowStockApp ? 'warning' : 'success'}`}>
              {hasLowStockChem || hasLowStockApp ? 'Attention Required' : 'Stock Optimal'}
            </span>
          </div>
        )}
      </div>

      <div className="inventory-tabs">
        <button
          className={`tab-item ${activeTab === 'chemical' ? 'active' : ''}`}
          onClick={() => setActiveTab('chemical')}
        >
          <span className="tab-text">Chemicals</span>
          {showLowStockFeature && hasLowStockChem && <span className="tab-indicator warning animate-pulse"></span>}
        </button>
        <button
          className={`tab-item ${activeTab === 'apparatus' ? 'active' : ''}`}
          onClick={() => setActiveTab('apparatus')}
        >
          <span className="tab-text">Apparatus</span>
          {showLowStockFeature && hasLowStockApp && <span className="tab-indicator warning animate-pulse"></span>}
        </button>
        <div className="tab-slider" style={{ left: activeTab === 'chemical' ? '0%' : '50%' }}></div>
      </div>

      {showLowStockFeature && (
        <div className="inventory-alert-box animate-fade">
          <LowStockAlert activeTab={activeTab} />
        </div>
      )}

      <div className="inventory-card card animate-fade">
        <div className="table-responsive">
          {activeTab === 'chemical' ? (
            <ChemicalTable showReorderLevel={showReorderLevel} />
          ) : (
            <ApparatusTable showReorderLevel={showReorderLevel} />
          )}
        </div>
      </div>
    </div >
  );
}

export default Inventory;
