import React, { useEffect, useState, useRef } from 'react';
import { FaPlusCircle, FaTimes, FaTrashAlt, FaFlask, FaBoxes, FaTags } from 'react-icons/fa';
import api from '../../utils/api';
import ConfirmDialog from '../ConfirmDialog';
import './AddStockRegisterModal.css';

function AddStockRegisterModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    supplier_name: '',
  });

  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
  const [apparatusItems, setApparatusItems] = useState([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });

  const [chemicalNames, setChemicalNames] = useState([]);
  const [apparatusNames, setApparatusNames] = useState([]);

  const [showChemicalSuggestions, setShowChemicalSuggestions] = useState({});
  const [showApparatusSuggestions, setShowApparatusSuggestions] = useState({});
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const modalRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 }); // Reset position when opened
      api.get('/stock_register/chemical_names/')
        .then(res => setChemicalNames(Array.isArray(res.data) ? res.data : res.data.results || []))
        .catch(err => console.error('Error fetching chemical names:', err));
      api.get('/stock_register/apparatus_names/')
        .then(res => setApparatusNames(Array.isArray(res.data) ? res.data : res.data.results || []))
        .catch(err => console.error('Error fetching apparatus names:', err));
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
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
    scrollToBottom();
  };

  const resetForm = () => {
    setFormData({ invoice_number: '', date: new Date().toISOString().split('T')[0], supplier_name: '' });
    setChemicalItems([{ chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
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
    const isShowing = chemRowIdx !== undefined || appRowIdx !== undefined;

    if (isShowing) {
      const type = chemRowIdx !== undefined ? 'chemical' : 'apparatus';
      const rowIdx = type === 'chemical' ? chemRowIdx : appRowIdx;
      const query = type === 'chemical' ? chemicalItems[rowIdx].chemical_name : apparatusItems[rowIdx].apparatus_name;
      const options = type === 'chemical' ? chemicalNames.filter(n => n.toLowerCase().includes(query.toLowerCase())) : apparatusNames.filter(n => n.toLowerCase().includes(query.toLowerCase()));

      if (key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => Math.min(prev + 1, options.length - 1)); return; }
      if (key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => Math.max(prev - 1, 0)); return; }
      if (key === 'Enter' && activeSuggestionIndex >= 0) {
        e.preventDefault();
        const val = options[activeSuggestionIndex];
        if (type === 'chemical') selectChemical(rowIdx, val); else selectApparatus(rowIdx, val);
        return;
      }
      if (key === 'Escape' || key === 'Tab') { setShowChemicalSuggestions({}); setShowApparatusSuggestions({}); return; }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
      if (!modalRef.current) return;
      const inputs = Array.from(modalRef.current.querySelectorAll('input:not([type="hidden"])'));
      const index = inputs.indexOf(target);
      if (index === -1) return;

      const perRow = 4;
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
        const inputs = Array.from(modalRef.current.querySelectorAll('input:not([type="hidden"])'));
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
        const inputs = modalRef.current.querySelectorAll('input');
        const apparatusInputs = Array.from(inputs).filter(input => input.placeholder.includes('Item name'));
        const currentIndex = apparatusInputs.findIndex(input => input === document.activeElement);
        if (currentIndex !== -1 && currentIndex < apparatusInputs.length - 1) {
          apparatusInputs[currentIndex + 1].focus();
        }
      }
    }, 10);
  };

  const calculateDropdownPosition = (event) => {
    const rect = event.target.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom,
      left: rect.left
    });
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
      await api.post('/stock_register/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      onSuccess();
      onClose();
      setChemicalItems([{ chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
      setApparatusItems([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '' }]);
      setFormData({ invoice_number: '', date: new Date().toISOString().split('T')[0], supplier_name: '' });
    } catch (err) {
      setAlertDialog({ open: true, message: 'Error: ' + (err.response?.data?.error || 'Validation failed') });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content flexible animate-up"
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <div className="modal-header" onMouseDown={onMouseDown}>
          <h2><FaTags style={{ color: 'var(--primary)' }} /> Secure Stock Entry</h2>
          <button className="modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
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
                <input type="text" value={formData.supplier_name} required placeholder="Vendor full name..."
                  onChange={e => setFormData({ ...formData, supplier_name: e.target.value })} />
              </div>
            </div>

            <div className="items-section">
              <div className="section-header">
                <h3><FaFlask /> Chemical Materials</h3>
                <button type="button" className="btn-add-line" onClick={addChemicalRow}>
                  <FaPlusCircle /> Add Line
                </button>
              </div>

              <div className="grid-matrix-header">
                <span>Material Name</span>
                <span>Qty (ML)</span>
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
                        calculateDropdownPosition(e);
                      }}
                      onFocus={e => {
                        setShowChemicalSuggestions({ [i]: true });
                        setActiveSuggestionIndex(-1);
                        calculateDropdownPosition(e);
                      }}
                      onBlur={() => setTimeout(() => setShowChemicalSuggestions({}), 250)} />
                    {showChemicalSuggestions[i] && it.chemical_name && (
                      <div className="suggestions-dropdown" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
                        {chemicalNames.filter(n => n.toLowerCase().includes(it.chemical_name.toLowerCase())).map((n, idx) => (
                          <div key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                            onMouseDown={() => selectChemical(i, n)}>{n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" step="0.01" placeholder="Quantity" value={it.quantity_ml} required onChange={e => { const next = [...chemicalItems]; next[i].quantity_ml = e.target.value; setChemicalItems(next); }} />
                  <input type="number" step="0.01" placeholder="Price" value={it.rate} required onChange={e => { const next = [...chemicalItems]; next[i].rate = e.target.value; setChemicalItems(next); }} />
                  <input type="text" placeholder="Make" value={it.make} required onChange={e => { const next = [...chemicalItems]; next[i].make = e.target.value; setChemicalItems(next); }} />
                  <button type="button" className="btn-row-del" onClick={() => setChemicalItems(chemicalItems.filter((_, idx) => idx !== i))} title="Remove line"><FaTrashAlt /></button>
                </div>
              ))}
            </div>

            <div className="items-section">
              <div className="section-header">
                <h3><FaBoxes /> Apparatus Materials</h3>
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
                        calculateDropdownPosition(e);
                      }}
                      onFocus={e => {
                        setShowApparatusSuggestions({ [i]: true });
                        setActiveSuggestionIndex(-1);
                        calculateDropdownPosition(e);
                      }}
                      onBlur={() => setTimeout(() => setShowApparatusSuggestions({}), 250)} />
                    {showApparatusSuggestions[i] && it.apparatus_name && (
                      <div className="suggestions-dropdown" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
                        {apparatusNames.filter(n => n.toLowerCase().includes(it.apparatus_name.toLowerCase())).map((n, idx) => (
                          <div key={idx} className={`suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                            onMouseDown={() => selectApparatus(i, n)}>{n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" placeholder="Quantity" value={it.quantity_pieces} required onChange={e => { const next = [...apparatusItems]; next[i].quantity_pieces = e.target.value; setApparatusItems(next); }} />
                  <input type="number" step="0.01" placeholder="Price" value={it.rate} required onChange={e => { const next = [...apparatusItems]; next[i].rate = e.target.value; setApparatusItems(next); }} />
                  <input type="text" placeholder="Make" value={it.make} required onChange={e => { const next = [...apparatusItems]; next[i].make = e.target.value; setApparatusItems(next); }} />
                  <button type="button" className="btn-row-del" onClick={() => setApparatusItems(apparatusItems.filter((_, idx) => idx !== i))} title="Remove line"><FaTrashAlt /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Discard</button>
            <button type="submit" className="btn-submit" disabled={submitting}>{submitting ? 'Verifying...' : 'Finalize Stock Entry'}</button>
          </div>
        </form>
      </div>
      <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
    </div>
  );
}

export default AddStockRegisterModal;
