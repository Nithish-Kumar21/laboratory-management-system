import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import Home from './Home';
import Inventory from './Inventory';
import StockRegister from './StockRegister';
import StockRegisterDetail from './StockRegisterDetail';
import IssueRegister from './IssueRegister';
import DamagedEntry from './DamagedEntry';
import DamagedEntryDetail from './DamagedEntryDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/stock-register" element={<StockRegister />} />
            <Route path="/stock-register/:id" element={<StockRegisterDetail />} />
            <Route path="/issue-register" element={<IssueRegister />} />
            <Route path="/damaged-entry" element={<DamagedEntry />} />
            <Route path="/damaged-entry/:id" element={<DamagedEntryDetail />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
