import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaBoxes, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './NewStockRegister.css';

function NewStockRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    supplier_name: '',
    remarks: '',
  });
  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
  const [apparatusItems, setApparatusItems] = useState([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });

  const [chemicalNames, setChemicalNames] = useState([]);
  const [apparatusNames, setApparatusNames] = useState([]);
  const [supplierNames, setSupplierNames] = useState([]);
  const [chemMakes, setChemMakes] = useState([]);
  const [appMakes, setAppMakes] = useState([]);

  const [showChemicalSuggestions, setShowChemicalSuggestions] = useState({});
  const [showApparatusSuggestions, setShowApparatusSuggestions] = useState({});
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showChemMakesSuggestions, setShowChemMakesSuggestions] = useState({});
  const [showAppMakesSuggestions, setShowAppMakesSuggestions] = useState({});
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const formRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [chem, app, sup, cMake, aMake] = await Promise.all([
          api.get('available_chemicals/names/').catch(() => ({ data: [] })),
          api.get('available_apparatus/names/').catch(() => ({ data: [] })),
          api.get('stock_register/supplier_names/').catch(() => ({ data: [] })),
          api.get('stock_register/chemical_makes/').catch(() => ({ data: [] })),
          api.get('stock_register/apparatus_makes/').catch(() => ({ data: [] }))
        ]);
        const process = (res) => {
          const d = res.data;
          if (Array.isArray(d)) return d;
          if (d && Array.isArray(d.results)) return d.results;
          return [];
        };
        setChemicalNames(process(chem));
        setApparatusNames(process(app));
        setSupplierNames(process(sup));
        setChemMakes(process(cMake));
        setAppMakes(process(aMake));
      } catch (err) {
        console.error('Error in pre-fetch:', err);
      }
    };
    fetchAll();
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  };

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
    scrollToBottom();
  };

  const addApparatusRow = () => {
    setApparatusItems([...apparatusItems, { apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
    scrollToBottom();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        chemical_items: chemicalItems.filter(it => it.chemical_name).map(it => ({ ...it, quantity_ml: parseFloat(it.quantity_ml), rate: parseFloat(it.rate), make: it.make })),
        apparatus_items: apparatusItems.filter(it => it.apparatus_name).map(it => ({ ...it, quantity_pieces: parseInt(it.quantity_pieces), rate: parseFloat(it.rate), make: it.make }))
      };
      await api.post('stock_register/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      navigate('/stock-register');
    } catch (err) {
      setAlertDialog({ open: true, message: 'Error: ' + (err.response?.data?.error || 'Validation failed') });
    } finally {
      setSubmitting(false);
    }
  };

  const selectChemical = (i, n) => {
    const next = [...chemicalItems]; next[i].chemical_name = n; setChemicalItems(next);
    setShowChemicalSuggestions({}); setActiveSuggestionIndex(-1);
  };

  const selectApparatus = (i, n) => {
    const next = [...apparatusItems]; next[i].apparatus_name = n; setApparatusItems(next);
    setShowApparatusSuggestions({}); setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (e) => {
    const { key } = e;
    const chemRowIdx = Object.keys(showChemicalSuggestions).find(idx => showChemicalSuggestions[idx]);
    const appRowIdx = Object.keys(showApparatusSuggestions).find(idx => showApparatusSuggestions[idx]);
    const chemMakeRowIdx = Object.keys(showChemMakesSuggestions).find(idx => showChemMakesSuggestions[idx]);
    const appMakeRowIdx = Object.keys(showAppMakesSuggestions).find(idx => showAppMakesSuggestions[idx]);
    const isShowing = chemRowIdx !== undefined || appRowIdx !== undefined || showSupplierSuggestions || chemMakeRowIdx !== undefined || appMakeRowIdx !== undefined;

    if (isShowing) {
      let type, rowIdx, query, options;
      if (chemRowIdx !== undefined) { type = 'chemical'; rowIdx = chemRowIdx; query = chemicalItems[rowIdx].chemical_name; options = chemicalNames; }
      else if (appRowIdx !== undefined) { type = 'apparatus'; rowIdx = appRowIdx; query = apparatusItems[rowIdx].apparatus_name; options = apparatusNames; }
      else if (showSupplierSuggestions) { type = 'supplier'; query = formData.supplier_name; options = supplierNames; }
      else if (chemMakeRowIdx !== undefined) { type = 'chemmake'; rowIdx = chemMakeRowIdx; query = chemicalItems[rowIdx].make; options = chemMakes; }
      else if (appMakeRowIdx !== undefined) { type = 'appmake'; rowIdx = appMakeRowIdx; query = apparatusItems[rowIdx].make; options = appMakes; }

      const filteredOptions = options.filter(n => {
        const val = typeof n === 'object' ? (n.name || '') : (n || '');
        return val.toLowerCase().startsWith((query || '').toLowerCase());
      });

      if (key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => Math.min(prev + 1, filteredOptions.length - 1)); return; }
      if (key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => Math.max(prev - 1, 0)); return; }
      if (key === 'Enter' && activeSuggestionIndex >= 0) {
        e.preventDefault();
        const val = filteredOptions[activeSuggestionIndex];
        if (type === 'chemical') selectChemical(rowIdx, val.name);
        else if (type === 'apparatus') selectApparatus(rowIdx, val.name);
        else if (type === 'supplier') { setFormData({ ...formData, supplier_name: val }); setShowSupplierSuggestions(false); }
        else if (type === 'chemmake') { const n = [...chemicalItems]; n[rowIdx].make = val; setChemicalItems(n); setShowChemMakesSuggestions({}); }
        else if (type === 'appmake') { const n = [...apparatusItems]; n[rowIdx].make = val; setApparatusItems(n); setShowAppMakesSuggestions({}); }
        return;
      }
      if (key === 'Escape' || key === 'Tab') { setShowChemicalSuggestions({}); setShowApparatusSuggestions({}); setShowSupplierSuggestions(false); setShowChemMakesSuggestions({}); setShowAppMakesSuggestions({}); return; }
    }
  };

  return (
    <div className="nrf-page animate-up">
      <div className="nrf-form-container">
        <div className="nrf-back-row" onClick={() => navigate('/stock-register')}>
          <FaArrowLeft />
          <span>New Stock Entry</span>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} ref={formRef}>
        <div className="nrf-card">
          <div className="nrf-auto-row">
            <div className="nrf-field">
              <label className="nrf-field-label">Invoice Number</label>
              <input type="text" className="nrf-input" value={formData.invoice_number} required placeholder="INV-REF-001"
                onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} />
            </div>
            <div className="nrf-field">
              <label className="nrf-field-label">Date Received</label>
              <input type="date" className="nrf-input" value={formData.date} required max={new Date().toISOString().split('T')[0]}
                onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </div>
          </div>

          <div className="nrf-field">
            <label className="nrf-field-label">Supplier Details</label>
            <div className="nrf-autocomplete">
              <input type="text" className="nrf-input" value={formData.supplier_name} required placeholder="Vendor full name..."
                onChange={e => { setFormData({ ...formData, supplier_name: e.target.value }); setShowSupplierSuggestions(true); setActiveSuggestionIndex(-1); }}
                onFocus={() => { setShowSupplierSuggestions(true); setActiveSuggestionIndex(-1); }}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)} />
              {showSupplierSuggestions && formData.supplier_name && (
                <div className="nrf-suggestions">
                  {supplierNames.filter(n => n.toLowerCase().startsWith(formData.supplier_name.toLowerCase())).map((n, idx) => (
                    <div key={idx} className={`nrf-suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                      onMouseDown={() => { setFormData({ ...formData, supplier_name: n }); setShowSupplierSuggestions(false); }}>{n}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chemical Materials */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaFlask /> Chemical Materials</div>
              <button type="button" className="nrf-add-btn" onClick={addChemicalRow}><FaPlus /> Add Line</button>
            </div>
            <div className="nrf-grid-cols cols-4">
              <span>Material Name</span>
              <span>Qty (ML)</span>
              <span>Rate (₹)</span>
              <span>Make / Brand</span>
              <span></span>
            </div>
            {chemicalItems.map((it, i) => (
              <div key={i} className="nrf-grid-row cols-4">
                <div className="nrf-autocomplete">
                  <input type="text" className="nrf-input" placeholder="Item name..." value={it.chemical_name} required autoComplete="off"
                    onChange={e => { const next = [...chemicalItems]; next[i].chemical_name = e.target.value; setChemicalItems(next); setShowChemicalSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onFocus={() => { setShowChemicalSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onBlur={() => setTimeout(() => setShowChemicalSuggestions({}), 250)} />
                  {showChemicalSuggestions[i] && it.chemical_name && (
                    <ul className="nrf-suggestions">
                      {chemicalNames.filter(n => (n.name || '').toLowerCase().startsWith((it.chemical_name || '').toLowerCase())).map((n, idx) => (
                        <li key={idx} className={`nrf-suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                          onMouseDown={() => selectChemical(i, n.name)}>
                          <span>{n.name}</span>
                          <span className="nrf-stock">Stock: {n.available_quantity} ML</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <input type="number" step="1" className="nrf-input" placeholder="Qty" value={it.quantity_ml ?? ''} required
                  onChange={e => { const next = [...chemicalItems]; next[i].quantity_ml = e.target.value; setChemicalItems(next); }} />
                <input type="number" step="1" className="nrf-input" placeholder="Price" value={it.rate ?? ''} required
                  onChange={e => { const next = [...chemicalItems]; next[i].rate = e.target.value; setChemicalItems(next); }} />
                <div className="nrf-autocomplete">
                  <input type="text" className="nrf-input" placeholder="Make" value={it.make} required
                    onChange={e => { const next = [...chemicalItems]; next[i].make = e.target.value; setChemicalItems(next); setShowChemMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onFocus={() => { setShowChemMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onBlur={() => setTimeout(() => setShowChemMakesSuggestions({}), 250)} />
                  {showChemMakesSuggestions[i] && it.make && (
                    <ul className="nrf-suggestions">
                      {chemMakes.filter(n => n.toLowerCase().startsWith(it.make.toLowerCase())).map((n, idx) => (
                        <li key={idx} className={`nrf-suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                          onMouseDown={() => { const next = [...chemicalItems]; next[i].make = n; setChemicalItems(next); setShowChemMakesSuggestions({}); }}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" className="nrf-del-btn" onClick={() => setChemicalItems(chemicalItems.filter((_, idx) => idx !== i))} title="Remove"><FaTrash /></button>
              </div>
            ))}
          </div>

          {/* Apparatus Materials */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaBoxes /> Apparatus Materials</div>
              <button type="button" className="nrf-add-btn" onClick={addApparatusRow}><FaPlus /> Add Line</button>
            </div>
            <div className="nrf-grid-cols cols-4">
              <span>Material Name</span>
              <span>Qty (PCS)</span>
              <span>Rate (₹)</span>
              <span>Make / Brand</span>
              <span></span>
            </div>
            {apparatusItems.map((it, i) => (
              <div key={i} className="nrf-grid-row cols-4">
                <div className="nrf-autocomplete">
                  <input type="text" className="nrf-input" placeholder="Item name..." value={it.apparatus_name} required autoComplete="off"
                    onChange={e => { const next = [...apparatusItems]; next[i].apparatus_name = e.target.value; setApparatusItems(next); setShowApparatusSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onFocus={() => { setShowApparatusSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onBlur={() => setTimeout(() => setShowApparatusSuggestions({}), 250)} />
                  {showApparatusSuggestions[i] && it.apparatus_name && (
                    <ul className="nrf-suggestions">
                      {apparatusNames.filter(n => (n.name || '').toLowerCase().startsWith((it.apparatus_name || '').toLowerCase())).map((n, idx) => (
                        <li key={idx} className={`nrf-suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                          onMouseDown={() => selectApparatus(i, n.name)}>
                          <span>{n.name}</span>
                          <span className="nrf-stock">Stock: {n.available_quantity} PCS</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <input type="number" step="1" className="nrf-input" placeholder="Qty" value={it.quantity_pieces ?? ''} required
                  onChange={e => { const next = [...apparatusItems]; next[i].quantity_pieces = e.target.value; setApparatusItems(next); }} />
                <input type="number" step="1" className="nrf-input" placeholder="Price" value={it.rate ?? ''} required
                  onChange={e => { const next = [...apparatusItems]; next[i].rate = e.target.value; setApparatusItems(next); }} />
                <div className="nrf-autocomplete">
                  <input type="text" className="nrf-input" placeholder="Make" value={it.make} required
                    onChange={e => { const next = [...apparatusItems]; next[i].make = e.target.value; setApparatusItems(next); setShowAppMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onFocus={() => { setShowAppMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                    onBlur={() => setTimeout(() => setShowAppMakesSuggestions({}), 250)} />
                  {showAppMakesSuggestions[i] && it.make && (
                    <ul className="nrf-suggestions">
                      {appMakes.filter(n => n.toLowerCase().startsWith(it.make.toLowerCase())).map((n, idx) => (
                        <li key={idx} className={`nrf-suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                          onMouseDown={() => { const next = [...apparatusItems]; next[i].make = n; setApparatusItems(next); setShowAppMakesSuggestions({}); }}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" className="nrf-del-btn" onClick={() => setApparatusItems(apparatusItems.filter((_, idx) => idx !== i))} title="Remove"><FaTrash /></button>
              </div>
            ))}
          </div>

          <div className="nrf-field">
            <label className="nrf-field-label">Remarks / Description <span className="nrf-opt">(Optional)</span></label>
            <textarea className="nrf-textarea" rows="2" value={formData.remarks}
              placeholder="Any additional notes..."
              onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
          </div>

          <div className="nrf-action-row">
            <button type="button" className="nrf-btn nrf-btn-ghost" onClick={() => navigate('/stock-register')}>
              Cancel
            </button>
            <div className="nrf-spacer"></div>
            <button type="submit" className="nrf-btn nrf-btn-submit" disabled={submitting}>
              {submitting ? 'Verifying...' : 'Finalize Stock Entry'}
            </button>
          </div>
        </div>
        </form>

        <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
      </div>
    </div>
  );
}

export default NewStockRegister;
