import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlusCircle, FaTimes, FaTrashAlt, FaFlask, FaBoxes, FaTag } from 'react-icons/fa';
import api from '../../utils/api';
import ConfirmDialog from '../ConfirmDialog';
import './AddStockRegisterModal.css';

function AddStockRegisterModal({ isOpen, onClose, onSuccess, standalone }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    supplier_name: '',
    remarks: '',
  });

  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', quantity: '', unit: 'ml', rate: '', make: '' }]);
  const [apparatusItems, setApparatusItems] = useState([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
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

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const modalRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });

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
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const onMouseDown = (e) => {
    // Only drag if clicking the header itself (not buttons inside it)
    if (e.target.closest('.modal-close')) return;
    if (e.target.closest('.modal-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  // Auto-scroll to bottom functionality for flexibility
  const scrollToBottom = () => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  };

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity: '', unit: 'ml', rate: '', make: '' }]);
    scrollToBottom();
  };

  const resetForm = () => {
    setFormData({ invoice_number: '', date: new Date().toISOString().split('T')[0], supplier_name: '', remarks: '' });
    setChemicalItems([{ chemical_name: '', quantity: '', unit: 'ml', rate: '', make: '' }]);
    setApparatusItems([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
    setErrors({});
  };

  const addApparatusRow = () => {
    setApparatusItems([...apparatusItems, { apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
    scrollToBottom();
  };

  const handleKeyDown = (e) => {
    const { key, target } = e;
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

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
      if (!modalRef.current) return;
      const inputs = Array.from(modalRef.current.querySelectorAll('input:not([type="hidden"]), select'));
      const index = inputs.indexOf(target);
      if (index === -1) return;

      const perRow = 5;
      const header = 3;

      const focusNext = (nextIdx) => {
        if (inputs[nextIdx]) {
          e.preventDefault();
          inputs[nextIdx].focus();
          if (inputs[nextIdx].type !== 'number' && inputs[nextIdx].select) inputs[nextIdx].select();
        }
      };

      if (key === 'ArrowDown' || (key === 'Enter' && !e.shiftKey)) {
        focusNext(index < header ? index + 1 : index + perRow);
      } else if (key === 'ArrowUp') {
        focusNext(index < header ? index - 1 : index - perRow);
      } else if (key === 'ArrowRight') {
        let canMove = target.type !== 'text';
        if (!canMove) try { canMove = target.selectionEnd === target.value.length; } catch (e) { canMove = true; }
        if (canMove) focusNext(index + 1);
      } else if (key === 'ArrowLeft') {
        let canMove = target.type !== 'text';
        if (!canMove) try { canMove = target.selectionStart === 0; } catch (e) { canMove = true; }
        if (canMove) focusNext(index - 1);
      }
    }
  };

  const selectChemical = (i, n) => {
    const next = [...chemicalItems]; next[i].chemical_name = n; setChemicalItems(next);
    setShowChemicalSuggestions({}); setActiveSuggestionIndex(-1);
    // Auto-focus the next field (Quantity)
    setTimeout(() => {
      if (modalRef.current) {
      const inputs = Array.from(modalRef.current.querySelectorAll('input:not([type="hidden"]), select'));
        const currentIndex = inputs.findIndex(inp => inp.value === n); // Approximate, or use better logic
        // Reliable way: find the quantity input for THIS row
        const rowInputs = modalRef.current.querySelectorAll('.grid-row');
        const targetRow = rowInputs[i];
        if (targetRow) {
          const quantityInput = targetRow.querySelectorAll('input')[1];
          if (quantityInput) quantityInput.focus();
        }
      }
    }, 10);
  };

  const selectApparatus = (i, n) => {
    const next = [...apparatusItems]; next[i].apparatus_name = n; setApparatusItems(next);
    setShowApparatusSuggestions({}); setActiveSuggestionIndex(-1);
    // Auto-focus the next field (Quantity)
    setTimeout(() => {
      if (modalRef.current) {
        const rowInputs = modalRef.current.querySelectorAll('.grid-row');
        const targetRow = rowInputs[chemicalItems.length + i]; // Apparatus rows follow chemical rows
        if (targetRow) {
          const quantityInput = targetRow.querySelectorAll('input')[1];
          if (quantityInput) quantityInput.focus();
        }
      }
    }, 10);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        chemical_items: chemicalItems.filter(it => it.chemical_name).map(it => ({ ...it, quantity: parseFloat(it.quantity), rate: parseFloat(it.rate), make: it.make })),
        apparatus_items: apparatusItems.filter(it => it.apparatus_name).map(it => ({ ...it, quantity_pieces: parseInt(it.quantity_pieces), rate: parseFloat(it.rate), make: it.make }))
      };
      await api.post('stock_register/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      onSuccess();
      if (standalone) {
        navigate('/stock-register');
      } else {
        onClose();
      }
    setChemicalItems([{ chemical_name: '', quantity: '', unit: 'ml', rate: '', make: '' }]);
      setApparatusItems([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
      setFormData({ invoice_number: '', date: new Date().toISOString().split('T')[0], supplier_name: '', remarks: '' });
    } catch (err) {
      setAlertDialog({ open: true, message: 'Error: ' + (err.response?.data?.error || 'Validation failed') });
    } finally {
      setSubmitting(false);
    }
  };

  const renderFormContent = () => (
    <>
      <div className="modal-body" ref={scrollRef}>
        <div className="form-header-card">
          <div className="form-group">
            <label>Invoice Number</label>
            <input type="text" value={formData.invoice_number} required placeholder="INV-REF-001"
              onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Date Received</label>
            <input type="date" value={formData.date} required max={new Date().toISOString().split('T')[0]}
              onChange={e => setFormData({ ...formData, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Supplier Details</label>
            <div className="autocomplete-wrapper">
              <input type="text" value={formData.supplier_name} required placeholder="Vendor full name..."
                onChange={e => { setFormData({ ...formData, supplier_name: e.target.value }); setShowSupplierSuggestions(true); setActiveSuggestionIndex(-1); }}
                onFocus={() => { setShowSupplierSuggestions(true); setActiveSuggestionIndex(-1); }}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)} />
              {showSupplierSuggestions && formData.supplier_name && (
                <div className="suggestions-dropdown">
                  {supplierNames.filter(n => n.toLowerCase().startsWith(formData.supplier_name.toLowerCase())).map((n, idx) => (
                    <div key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                      onMouseDown={() => { setFormData({ ...formData, supplier_name: n }); setShowSupplierSuggestions(false); }}>{n}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="items-section">
          <div className="section-header">
            <h3><FaFlask className="section-title-icon" /> Chemical Materials</h3>
            <button type="button" className="btn-add-line" onClick={addChemicalRow}>
              <FaPlusCircle /> Add Line
            </button>
          </div>

          <div className="grid-matrix-header">
            <span>Material Name</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Rate (₹)</span>
            <span>Make / Brand</span>
            <span></span>
          </div>
          {chemicalItems.map((it, i) => (
            <div key={i} className="grid-row animate-fade">
              <div className="autocomplete-wrapper">
                <input type="text" placeholder="Item name..." value={it.chemical_name} required autoComplete="off"
                  onChange={e => {
                    const next = [...chemicalItems]; next[i].chemical_name = e.target.value; setChemicalItems(next);
                    setShowChemicalSuggestions({ [i]: true }); setActiveSuggestionIndex(-1);
                  }}
                  onFocus={e => {
                    setShowChemicalSuggestions({ [i]: true });
                    setActiveSuggestionIndex(-1);
                  }}
                  onBlur={() => setTimeout(() => setShowChemicalSuggestions({}), 250)} />
                {showChemicalSuggestions[i] && it.chemical_name && (
                  <ul className="suggestions-dropdown list-style-none">
                    {chemicalNames.filter(n => (n.name || '').toLowerCase().startsWith((it.chemical_name || '').toLowerCase())).map((n, idx) => (
                      <li key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                        onMouseDown={() => selectChemical(i, n.name)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span>{n.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>Stock: {n.quantity} {n.unit}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input type="number" step="1" placeholder="Quantity" value={it.quantity ?? ''} required onChange={e => { const next = [...chemicalItems]; next[i].quantity = e.target.value; setChemicalItems(next); }} />
              <select value={it.unit} onChange={e => { const next = [...chemicalItems]; next[i].unit = e.target.value; setChemicalItems(next); }}>
                <option value="ml">mL</option>
                <option value="g">g</option>
              </select>
              <input type="number" step="1" placeholder="Price" value={it.rate ?? ''} required onChange={e => { const next = [...chemicalItems]; next[i].rate = e.target.value; setChemicalItems(next); }} />
              <div className="autocomplete-wrapper">
                <input type="text" placeholder="Make" value={it.make} required
                  onChange={e => { const next = [...chemicalItems]; next[i].make = e.target.value; setChemicalItems(next); setShowChemMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                  onFocus={() => { setShowChemMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                  onBlur={() => setTimeout(() => setShowChemMakesSuggestions({}), 250)} />
                {showChemMakesSuggestions[i] && it.make && (
                  <ul className="suggestions-dropdown list-style-none">
                    {chemMakes.filter(n => n.toLowerCase().startsWith(it.make.toLowerCase())).map((n, idx) => (
                      <li key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                        onMouseDown={() => { const next = [...chemicalItems]; next[i].make = n; setChemicalItems(next); setShowChemMakesSuggestions({}); }}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="btn-row-del" onClick={() => setChemicalItems(chemicalItems.filter((_, idx) => idx !== i))} title="Remove line"><FaTrashAlt /></button>
            </div>
          ))}
        </div>

        <div className="items-section">
          <div className="section-header">
            <h3><FaBoxes className="section-title-icon" /> Apparatus Materials</h3>
            <button type="button" className="btn-add-line" onClick={addApparatusRow}>
              <FaPlusCircle /> Add Line
            </button>
          </div>

          <div className="grid-matrix-header">
            <span>Material Name</span>
            <span>Qty (PCS)</span>
            <span>Rate (₹)</span>
            <span>Make / Brand</span>
            <span></span>
          </div>
          {apparatusItems.map((it, i) => (
            <div key={i} className="grid-row animate-fade">
              <div className="autocomplete-wrapper">
                <input type="text" placeholder="Item name..." value={it.apparatus_name} required autoComplete="off"
                  onChange={e => {
                    const next = [...apparatusItems]; next[i].apparatus_name = e.target.value; setApparatusItems(next);
                    setShowApparatusSuggestions({ [i]: true }); setActiveSuggestionIndex(-1);
                  }}
                  onFocus={e => {
                    setShowApparatusSuggestions({ [i]: true });
                    setActiveSuggestionIndex(-1);
                  }}
                  onBlur={() => setTimeout(() => setShowApparatusSuggestions({}), 250)} />
                {showApparatusSuggestions[i] && it.apparatus_name && (
                  <ul className="suggestions-dropdown list-style-none">
                    {apparatusNames.filter(n => (n.name || '').toLowerCase().startsWith((it.apparatus_name || '').toLowerCase())).map((n, idx) => (
                      <li key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                        onMouseDown={() => selectApparatus(i, n.name)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span>{n.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>Stock: {n.available_quantity} PCS</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input type="number" step="1" placeholder="Quantity" value={it.quantity_pieces ?? ''} required onChange={e => { const next = [...apparatusItems]; next[i].quantity_pieces = e.target.value; setApparatusItems(next); }} />
              <input type="number" step="1" placeholder="Price" value={it.rate ?? ''} required onChange={e => { const next = [...apparatusItems]; next[i].rate = e.target.value; setApparatusItems(next); }} />
              <div className="autocomplete-wrapper">
                <input type="text" placeholder="Make" value={it.make} required
                  onChange={e => { const next = [...apparatusItems]; next[i].make = e.target.value; setApparatusItems(next); setShowAppMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                  onFocus={() => { setShowAppMakesSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                  onBlur={() => setTimeout(() => setShowAppMakesSuggestions({}), 250)} />
                {showAppMakesSuggestions[i] && it.make && (
                  <ul className="suggestions-dropdown list-style-none">
                    {appMakes.filter(n => n.toLowerCase().startsWith(it.make.toLowerCase())).map((n, idx) => (
                      <li key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                        onMouseDown={() => { const next = [...apparatusItems]; next[i].make = n; setApparatusItems(next); setShowAppMakesSuggestions({}); }}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="btn-row-del" onClick={() => setApparatusItems(apparatusItems.filter((_, idx) => idx !== i))} title="Remove line"><FaTrashAlt /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-cancel" onClick={standalone ? () => navigate('/stock-register') : onClose}>
          {standalone ? 'Cancel' : 'Discard'}
        </button>
        <button type="submit" className="btn-submit" disabled={submitting}>{submitting ? 'Verifying...' : 'Finalize Stock Entry'}</button>
      </div>
    </>
  );

  if (standalone) {
    return (
      <div className="new-entry-page">
        <div className="new-entry-container">
          <div className="new-entry-header">
            <button className="new-entry-back" onClick={() => navigate('/stock-register')}>
              <FaArrowLeft />
            </button>
            <h2><FaTag /> New Stock Entry</h2>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} ref={modalRef}>
            {renderFormContent()}
          </form>
        </div>
        <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content flexible animate-up stock-entry-modal"
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <div className="modal-header danger-theme" onMouseDown={onMouseDown}>
          <h2 className="stock-register-header-text"><FaTag /> Secure Stock Register</h2>
          <button className="modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          {renderFormContent()}
        </form>
      </div>
      <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
    </div>
  );
}

export default AddStockRegisterModal;
