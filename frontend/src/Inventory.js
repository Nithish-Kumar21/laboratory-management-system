import React, { useState } from 'react';
import ChemicalTable from './ChemicalTable';
import ApparatusTable from './ApparatusTable';
import LowStockAlert from './LowStockAlert';
import './Inventory.css';

function Inventory() {
  const [activeTab, setActiveTab] = useState('chemical');

  return (
    <div className="inventory-page">
      <h2>Inventory</h2>
      <div className="inventory-tabs">
        <button
          className={activeTab === 'chemical' ? "tab-btn tab-btn--active" : "tab-btn"}
          onClick={() => setActiveTab('chemical')}
        >
          Chemical
        </button>
        <button
          className={activeTab === 'apparatus' ? "tab-btn tab-btn--active" : "tab-btn"}
          onClick={() => setActiveTab('apparatus')}
        >
          Apparatus
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
