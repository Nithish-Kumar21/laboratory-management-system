import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaBoxes, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './NewStockRegister.css';

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'USA/Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+86', label: 'China (+86)' },
];

function NewStockRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    supplier_name: '',
    supplier_contact_country_code: '+91',
    supplier_contact_phone: '',
    supplier_email: '',
    remarks: '',
  });
  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', pack_size: '', no_of_packs: '1', unit: 'ml', rate: '', make: '', restock_level: '' }]);
  const [apparatusItems, setApparatusItems] = useState([{ apparatus_name: '', quantity_pieces: '', rate: '', make: '', restock_level: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const [chemicalNames, setChemicalNames] = useState([]);
  const [apparatusNames, setApparatusNames] = useState([]);
  const [supplierNames, setSupplierNames] = useState([]);
  const [chemMakes, setChemMakes] = useState([]);
  const [appMakes, setAppMakes] = useState([]);

  const [phoneError, setPhoneError] = useState('');
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
          api.get('/available_chemicals/names/').catch(() => ({ data: [] })),
          api.get('/available_apparatus/names/').catch(() => ({ data: [] })),
          api.get('/stock_register/supplier_names/').catch(() => ({ data: [] })),
          api.get('/stock_register/chemical_makes/').catch(() => ({ data: [] })),
          api.get('/stock_register/apparatus_makes/').catch(() => ({ data: [] }))
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
    setChemicalItems([...chemicalItems, { chemical_name: '', pack_size: '', no_of_packs: '1', unit: 'ml', rate: '', make: '', restock_level: '' }]);
    scrollToBottom();
  };

  const addApparatusRow = () => {
    setApparatusItems([...apparatusItems, { apparatus_name: '', quantity_pieces: '', rate: '', make: '', restock_level: '' }]);
    scrollToBottom();
  };

  const calcChemicalTotalQty = (item) => {
    const p = parseFloat(item.pack_size);
    const n = parseInt(item.no_of_packs);
    if (!isNaN(p) && !isNaN(n)) return p * n;
    return 0;
  };

  const calcChemicalTotalPrice = (item) => {
    const n = parseInt(item.no_of_packs);
    const r = parseFloat(item.rate);
    if (!isNaN(n) && !isNaN(r)) return n * r;
    return 0;
  };

  const calcApparatusTotalPrice = (item) => {
    const q = parseInt(item.quantity_pieces);
    const r = parseFloat(item.rate);
    if (!isNaN(q) && !isNaN(r)) return q * r;
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const phone = formData.supplier_contact_phone;
    if (phone && !/^\d{10}$/.test(phone)) {
      setPhoneError('Phone number must be exactly 10 digits');
      setSubmitting(false);
      return;
    }

    // Validate all numeric fields before submission — block with inline errors
    // instead of silently sending NaN to the backend.
    const errors = {};
    chemicalItems.forEach((it, i) => {
      if (!it.chemical_name) return; // skip empty rows
      if (it.pack_size === '' || isNaN(parseFloat(it.pack_size))) errors[`chem_${i}_pack_size`] = 'Required';
      if (it.no_of_packs === '' || isNaN(parseInt(it.no_of_packs))) errors[`chem_${i}_no_of_packs`] = 'Required';
      if (it.rate === '' || isNaN(parseFloat(it.rate))) errors[`chem_${i}_rate`] = 'Required';
    });
    apparatusItems.forEach((it, i) => {
      if (!it.apparatus_name) return; // skip empty rows
      if (it.quantity_pieces === '' || isNaN(parseInt(it.quantity_pieces))) errors[`app_${i}_quantity`] = 'Required';
      if (it.rate === '' || isNaN(parseFloat(it.rate))) errors[`app_${i}_rate`] = 'Required';
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setAlertDialog({ open: true, message: 'Please fill in all numeric fields with valid numbers.' });
      setSubmitting(false);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        chemical_items: chemicalItems.filter(it => it.chemical_name).map(it => ({
          chemical_name: it.chemical_name,
          pack_size: parseFloat(it.pack_size) || 0,
          no_of_packs: parseInt(it.no_of_packs) || 1,
          unit: it.unit,
          rate: parseFloat(it.rate) || 0,
          make: it.make,
          restock_level: it.restock_level !== '' ? parseFloat(it.restock_level) : null,
        })),
        apparatus_items: apparatusItems.filter(it => it.apparatus_name).map(it => ({
          apparatus_name: it.apparatus_name,
          quantity_pieces: parseInt(it.quantity_pieces) || 0,
          rate: parseFloat(it.rate) || 0,
          make: it.make,
          restock_level: it.restock_level !== '' ? parseInt(it.restock_level) : null,
        }))
      };
      await api.post('/stock_register/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      navigate('/stock-register');
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Validation failed';
      if (data) {
        if (data.error) {
          msg = data.error;
        } else if (typeof data === 'object') {
          const parts = [];
          Object.entries(data).forEach(([key, val]) => {
            if (key === 'non_field_errors') {
              (Array.isArray(val) ? val : [val]).forEach(m => parts.push(m));
            } else if (Array.isArray(val) && typeof val[0] === 'object') {
              val.forEach((item, idx) => {
                Object.entries(item).forEach(([subKey, subVal]) => {
                  const errMsg = Array.isArray(subVal) ? subVal.join(', ') : subVal;
                  parts.push(`${key} #${idx + 1} — ${subKey}: ${errMsg}`);
                });
              });
            } else {
              const errMsg = Array.isArray(val) ? val.join(', ') : val;
              parts.push(`${key}: ${errMsg}`);
            }
          });
          if (parts.length) msg = parts.join('\n');
        }
      }
      setAlertDialog({ open: true, message: 'Error: ' + msg });
    } finally {
      setSubmitting(false);
    }
  };

  const selectChemical = (i, n) => {
    const next = [...chemicalItems];
    next[i].chemical_name = n;
    // Auto-fill restock level from existing AvailableChemical
    const match = chemicalNames.find(c => c.name.toLowerCase() === n.toLowerCase());
    if (match && match.reorder_level != null) {
      next[i].restock_level = String(match.reorder_level);
    }
    setChemicalItems(next);
    setShowChemicalSuggestions({});
    setActiveSuggestionIndex(-1);
  };

  const selectApparatus = (i, n) => {
    const next = [...apparatusItems];
    next[i].apparatus_name = n;
    // Auto-fill restock level from existing AvailableApparatus
    const match = apparatusNames.find(a => a.name.toLowerCase() === n.toLowerCase());
    if (match && match.reorder_level != null) {
      next[i].restock_level = String(match.reorder_level);
    }
    setApparatusItems(next);
    setShowApparatusSuggestions({});
    setActiveSuggestionIndex(-1);
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

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} ref={formRef} className="nrf-stock-form">
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

          <div className="nrf-divider"></div>

          <div className="nrf-field">
            <label className="nrf-field-label">Supplier Details</label>
            <div className="nrf-supplier-row">
              <div className="nrf-autocomplete nrf-supplier-name">
                <input type="text" className="nrf-input" value={formData.supplier_name} required placeholder="Supplier name..."
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
              <div className="nrf-supplier-phone">
                <div className="nrf-composite">
                  <select className="nrf-input" value={formData.supplier_contact_country_code}
                    onChange={e => setFormData({ ...formData, supplier_contact_country_code: e.target.value })}>
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input type="text" className={`nrf-input${phoneError ? ' nrf-input-error' : ''}`} placeholder="Phone number" value={formData.supplier_contact_phone}
                    onBlur={() => {
                      const v = formData.supplier_contact_phone;
                      if (v && !/^\d{10}$/.test(v)) {
                        setPhoneError('Phone number must be exactly 10 digits');
                      } else {
                        setPhoneError('');
                      }
                    }}
                    onChange={e => {
                      const v = e.target.value;
                      if (v && !/^\d*$/.test(v)) {
                        setPhoneError('Only digits allowed');
                      } else {
                        if (v && v.length !== 10) {
                          setPhoneError('Phone number must be exactly 10 digits');
                        } else {
                          setPhoneError('');
                        }
                      }
                      setFormData({ ...formData, supplier_contact_phone: v });
                    }} />
                </div>
                {phoneError && <span className="nrf-field-error">{phoneError}</span>}
              </div>
              <div className="nrf-supplier-email">
                <input type="email" className="nrf-input" placeholder="Email address" value={formData.supplier_email}
                  onChange={e => setFormData({ ...formData, supplier_email: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="nrf-divider"></div>

          {/* Chemicals */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaFlask /> Chemicals</div>
              <button type="button" className="nrf-add-btn" onClick={addChemicalRow}><FaPlus /> Add Line</button>
            </div>
            {chemicalItems.map((it, i) => (
              <div key={i} className="nrf-chem-entry">
                {/* Row 1: Name + Pack size/Unit composite */}
                <div className="nrf-chem-row nrf-chem-row-1">
                  <div className="nrf-chem-field nrf-autocomplete">
                    <span className="nrf-chem-label">CHEMICAL NAME</span>
                    <input type="text" className="nrf-input" placeholder="Chemical name..." value={it.chemical_name} required autoComplete="off"
                      onChange={e => { const next = [...chemicalItems]; next[i].chemical_name = e.target.value; setChemicalItems(next); setShowChemicalSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                      onFocus={() => { setShowChemicalSuggestions({ [i]: true }); setActiveSuggestionIndex(-1); }}
                      onBlur={() => setTimeout(() => setShowChemicalSuggestions({}), 250)} />
                    {showChemicalSuggestions[i] && it.chemical_name && (
                      <ul className="nrf-suggestions">
                        {chemicalNames.filter(n => (n.name || '').toLowerCase().startsWith((it.chemical_name || '').toLowerCase())).map((n, idx) => (
                          <li key={idx} className={`nrf-suggestion-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                            onMouseDown={() => selectChemical(i, n.name)}>
                            <span>{n.name}</span>
                            <span className="nrf-stock">Stock: {n.available_quantity} {n.unit}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="nrf-chem-field">
                    <span className="nrf-chem-label">PACK SIZE / UNIT</span>
                    <div className="nrf-composite">
                      <input type="number" step="1" className={`nrf-input${fieldErrors[`chem_${i}_pack_size`] ? ' nrf-input-error' : ''}`} placeholder="Pack size" value={it.pack_size ?? ''} required
                        onChange={e => { const next = [...chemicalItems]; next[i].pack_size = e.target.value; setChemicalItems(next); setFieldErrors(prev => { const n = {...prev}; delete n[`chem_${i}_pack_size`]; return n; }); }} />
                      <select value={it.unit} className="nrf-input" onChange={e => { const next = [...chemicalItems]; next[i].unit = e.target.value; setChemicalItems(next); }}>
                        <option value="ml">mL</option>
                        <option value="g">g</option>
                      </select>
                    </div>
                  </div>
                  <div className="nrf-chem-field">
                    <span className="nrf-chem-label">NO. OF PACKS</span>
                    <input type="number" step="1" className={`nrf-input${fieldErrors[`chem_${i}_no_of_packs`] ? ' nrf-input-error' : ''}`} placeholder="No. of packs" value={it.no_of_packs ?? ''} required min="1"
                      onChange={e => { const next = [...chemicalItems]; next[i].no_of_packs = e.target.value; setChemicalItems(next); setFieldErrors(prev => { const n = {...prev}; delete n[`chem_${i}_no_of_packs`]; return n; }); }} />
                  </div>
                </div>

                {/* Row 2: Rate + Restock + Make */}
                <div className="nrf-chem-row nrf-chem-row-2">
                  <div className="nrf-chem-field">
                    <span className="nrf-chem-label">RATE PER PACK</span>
                    <input type="number" step="1" className={`nrf-input${fieldErrors[`chem_${i}_rate`] ? ' nrf-input-error' : ''}`} placeholder="Rate per pack (₹)" value={it.rate ?? ''} required
                      onChange={e => { const next = [...chemicalItems]; next[i].rate = e.target.value; setChemicalItems(next); setFieldErrors(prev => { const n = {...prev}; delete n[`chem_${i}_rate`]; return n; }); }} />
                  </div>
                  <div className="nrf-chem-field">
                    <span className="nrf-chem-label">RESTOCK LEVEL</span>
                    <input type="number" step="1" className="nrf-input" placeholder="Restock" value={it.restock_level ?? ''}
                      onChange={e => { const next = [...chemicalItems]; next[i].restock_level = e.target.value; setChemicalItems(next); }} />
                  </div>
                  <div className="nrf-chem-field nrf-autocomplete">
                    <span className="nrf-chem-label">MAKE / BRAND</span>
                    <input type="text" className="nrf-input" placeholder="Make / Brand" value={it.make} required
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
                </div>

                {/* Row 3: Total Qty + Total Price + Delete */}
                <div className="nrf-chem-row nrf-chem-row-3">
                  <div className="nrf-chem-field">
                    <span className="nrf-chem-label">TOTAL QTY</span>
                    <input type="text" className="nrf-input nrf-readonly" value={calcChemicalTotalQty(it) || ''} readOnly placeholder="Total qty" />
                  </div>
                  <div className="nrf-chem-field">
                    <span className="nrf-chem-label">TOTAL PRICE</span>
                    <input type="text" className="nrf-input nrf-readonly" value={calcChemicalTotalPrice(it) ? '₹' + calcChemicalTotalPrice(it).toFixed(2) : ''} readOnly placeholder="₹0.00" />
                  </div>
                  <button type="button" className="nrf-del-btn" onClick={() => setChemicalItems(chemicalItems.filter((_, idx) => idx !== i))} title="Remove"><FaTrash /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="nrf-divider"></div>

          {/* Apparatus */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaBoxes /> Apparatus</div>
              <button type="button" className="nrf-add-btn" onClick={addApparatusRow}><FaPlus /> Add Line</button>
            </div>
            {apparatusItems.map((it, i) => (
              <div key={i} className="nrf-app-entry">
                {/* Row 1: Name + Qty */}
                <div className="nrf-app-row nrf-app-row-1">
                  <div className="nrf-app-field nrf-autocomplete">
                    <span className="nrf-app-label">APPARATUS NAME</span>
                    <input type="text" className="nrf-input" placeholder="Apparatus name..." value={it.apparatus_name} required autoComplete="off"
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
                  <div className="nrf-app-field">
                    <span className="nrf-app-label">QTY (PCS)</span>
                    <input type="number" step="1" className={`nrf-input${fieldErrors[`app_${i}_quantity`] ? ' nrf-input-error' : ''}`} placeholder="Qty (pcs)" value={it.quantity_pieces ?? ''} required
                      onChange={e => { const next = [...apparatusItems]; next[i].quantity_pieces = e.target.value; setApparatusItems(next); setFieldErrors(prev => { const n = {...prev}; delete n[`app_${i}_quantity`]; return n; }); }} />
                  </div>
                </div>

                {/* Row 2: Rate + Restock */}
                <div className="nrf-app-row nrf-app-row-2">
                  <div className="nrf-app-field">
                    <span className="nrf-app-label">RATE PER PIECE</span>
                    <input type="number" step="1" className={`nrf-input${fieldErrors[`app_${i}_rate`] ? ' nrf-input-error' : ''}`} placeholder="Rate per piece (₹)" value={it.rate ?? ''} required
                      onChange={e => { const next = [...apparatusItems]; next[i].rate = e.target.value; setApparatusItems(next); setFieldErrors(prev => { const n = {...prev}; delete n[`app_${i}_rate`]; return n; }); }} />
                  </div>
                  <div className="nrf-app-field">
                    <span className="nrf-app-label">RESTOCK LEVEL</span>
                    <input type="number" step="1" className="nrf-input" placeholder="Restock" value={it.restock_level ?? ''}
                      onChange={e => { const next = [...apparatusItems]; next[i].restock_level = e.target.value; setApparatusItems(next); }} />
                  </div>
                </div>

                {/* Row 3: Make + Total Price + Delete */}
                <div className="nrf-app-row nrf-app-row-3">
                  <div className="nrf-app-field nrf-autocomplete">
                    <span className="nrf-app-label">MAKE / BRAND</span>
                    <input type="text" className="nrf-input" placeholder="Make / Brand" value={it.make} required
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
                  <div className="nrf-app-field">
                    <span className="nrf-app-label">TOTAL PRICE</span>
                    <input type="text" className="nrf-input nrf-readonly" value={calcApparatusTotalPrice(it) ? '₹' + calcApparatusTotalPrice(it).toFixed(2) : ''} readOnly placeholder="₹0.00" />
                  </div>
                  <button type="button" className="nrf-del-btn" onClick={() => setApparatusItems(apparatusItems.filter((_, idx) => idx !== i))} title="Remove"><FaTrash /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="nrf-divider"></div>

          <div className="nrf-field">
            <label className="nrf-field-label">Remarks / Description <span className="nrf-opt">(Optional)</span></label>
            <textarea className="nrf-textarea" rows="4" value={formData.remarks}
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
