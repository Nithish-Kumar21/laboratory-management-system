import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaUserTie, FaGraduationCap, FaCalendarAlt, FaTools, FaSort, FaClock, FaChevronDown } from 'react-icons/fa';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './NewDamagedEntry.css';

function extractErrorMessages(err) {
  if (typeof err === 'string') return [err];
  if (err === null || err === undefined) return [];
  if (Array.isArray(err)) return err.flatMap(extractErrorMessages);
  if (typeof err === 'object') return Object.values(err).flatMap(extractErrorMessages);
  return [String(err)];
}

function NewDamagedEntry() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    staff: '',
    class_name: '',
    date: new Date().toISOString().split('T')[0],
    details: '',
    day_order: '',
    hour: [],
  });
  const [damagedItems, setDamagedItems] = useState([{ apparatus_name: '', quantity: '', caused_by: '' }]);
  const [apparatusNames, setApparatusNames] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };
  const [showSuggestions, setShowSuggestions] = useState({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hourOpen, setHourOpen] = useState(false);

  const formRef = useRef(null);
  const scrollRef = useRef(null);
  const hourRef = useRef(null);

  useEffect(() => {
    api.get('/available_apparatus/names/')
      .then(res => setApparatusNames(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (hourRef.current && !hourRef.current.contains(e.target)) {
        setHourOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  };

  const addRow = () => {
    setDamagedItems([...damagedItems, { apparatus_name: '', quantity: '', caused_by: '' }]);
    scrollToBottom();
  };

  const selectApparatus = (i, n) => {
    const next = [...damagedItems];
    next[i].apparatus_name = n;
    setDamagedItems(next);
    setShowSuggestions({});
    setActiveIndex(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate numeric fields before submission
    const errors = {};
    damagedItems.forEach((it, i) => {
      if (!it.apparatus_name) return;
      if (it.quantity === '' || isNaN(parseInt(it.quantity))) errors[`item_${i}_qty`] = 'Required';
    });
    if (Object.keys(errors).length > 0) {
      setAlertDialog({ open: true, message: 'Please fill in all quantity fields with valid numbers.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        damaged_items: damagedItems.filter(it => it.apparatus_name).map(it => ({
          apparatus_name: it.apparatus_name,
          quantity: parseInt(it.quantity) || 0,
          caused_by: it.caused_by
        }))
      };
      await api.post('/damaged_entry/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      showToast('Damage report filed successfully');
      setTimeout(() => navigate('/damaged-entry'), 1500);
    } catch (err) {
      const serverErr = err.response?.data;
      const msg = serverErr?.error || (typeof serverErr === 'object' && serverErr !== null ? extractErrorMessages(serverErr).join('; ') : '') || 'Failed to submit report';
      setAlertDialog({ open: true, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    const { key } = e;
    const rowIdx = Object.keys(showSuggestions).find(idx => showSuggestions[idx]);

    if (rowIdx !== undefined) {
      const query = damagedItems[rowIdx].apparatus_name;
      const options = apparatusNames.filter(n => n.name.toLowerCase().startsWith(query.toLowerCase()));

      if (key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, options.length - 1)); return; }
      if (key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); return; }
      if (key === 'Enter' && activeIndex >= 0) { e.preventDefault(); selectApparatus(rowIdx, options[activeIndex].name); return; }
      if (key === 'Escape' || key === 'Tab') { setShowSuggestions({}); return; }
    }
  };

  return (
    <div className="nrf-page animate-up">
      <div className="nrf-form-container">
        <div className="nrf-back-row" onClick={() => navigate('/damaged-entry')}>
          <FaArrowLeft />
          <span>New Damaged Entry</span>
        </div>

        <form className="nrf-dmg-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} ref={formRef}>
        <div className="nrf-card">
          <div className="nrf-auto-row">
            <div className="nrf-field">
              <label className="nrf-field-label"><FaUserTie /> Responsible Staff</label>
              <input type="text" className="nrf-input" value={formData.staff} required placeholder="Name of staff"
                onChange={e => setFormData({ ...formData, staff: e.target.value })} />
            </div>
            <div className="nrf-field relative">
              <label className="nrf-field-label"><FaGraduationCap /> Class / Division</label>
              <select className="nrf-input" value={formData.class_name}
                onChange={e => setFormData({ ...formData, class_name: e.target.value })} required>
                <option value="">Select class / division</option>
                <option value="I B.Sc Chemistry">I B.Sc Chemistry</option>
                <option value="II B.Sc Chemistry">II B.Sc Chemistry</option>
                <option value="III B.Sc Chemistry">III B.Sc Chemistry</option>
                <option value="I M.Sc Chemistry">I M.Sc Chemistry</option>
                <option value="II M.Sc Chemistry">II M.Sc Chemistry</option>
              </select>
            </div>
          </div>

          <div className="nrf-divider"></div>

          <div className="nrf-incident-row">
            <div className="nrf-field relative">
              <label className="nrf-field-label"><FaSort /> Day Order</label>
              <select className="nrf-input" value={formData.day_order}
                onChange={e => setFormData({ ...formData, day_order: e.target.value })}>
                <option value="">Select day order</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="V">V</option>
                <option value="VI">VI</option>
              </select>
            </div>
            <div className="nrf-field relative" ref={hourRef}>
              <label className="nrf-field-label"><FaClock /> Hour</label>
              <div className="nrf-multi-select">
                <button
                  type="button"
                  className="nrf-multi-btn"
                  onClick={() => setHourOpen(!hourOpen)}
                >
                  <span>{formData.hour.length ? formData.hour.sort((a, b) => a - b).join(', ') : 'Select hour(s)'}</span>
                  <FaChevronDown className={`nrf-chevron ${hourOpen ? 'nrf-chevron-up' : ''}`} />
                </button>
                {hourOpen && (
                  <div className="nrf-multi-dropdown w-full left-0 max-w-[calc(100vw-2rem)] box-border">
                    {[1, 2, 3, 4, 5].map(h => (
                      <label key={h} className="nrf-multi-option">
                        <input
                          type="checkbox"
                          checked={formData.hour.includes(h)}
                          onChange={() => {
                            const next = formData.hour.includes(h)
                              ? formData.hour.filter(v => v !== h)
                              : [...formData.hour, h];
                            setFormData({ ...formData, hour: next });
                          }}
                        />
                        <span>Hour {h}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="nrf-field relative">
              <label className="nrf-field-label"><FaCalendarAlt /> Date of Incident</label>
              <input type="date" className="nrf-input" value={formData.date} required
                onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </div>
          </div>

          <div className="nrf-divider"></div>

          {/* Damaged Items */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaTools /> Damaged Items List</div>
              <button type="button" className="nrf-add-btn" onClick={addRow}><FaPlus /> Add Line</button>
            </div>
            {damagedItems.map((it, i) => (
              <div key={i} className="nrf-dmg-entry">
                <div className="nrf-dmg-field nrf-dmg-apparatus relative">
                  <span className="nrf-inline-label nrf-dmg-label">Apparatus Name</span>
                  <div className="nrf-autocomplete relative">
                    <input type="text" className="nrf-input" placeholder="Search apparatus..." value={it.apparatus_name} required autoComplete="off"
                      onChange={e => { const next = [...damagedItems]; next[i].apparatus_name = e.target.value; setDamagedItems(next); setShowSuggestions({ [i]: true }); setActiveIndex(-1); }}
                      onFocus={() => { setShowSuggestions({ [i]: true }); setActiveIndex(-1); }}
                      onBlur={() => setTimeout(() => setShowSuggestions({}), 250)} />
                    {showSuggestions[i] && it.apparatus_name && (
                      <ul className="nrf-suggestions w-full left-0 max-w-[calc(100vw-2rem)] box-border">
                        {apparatusNames.filter(n => n.name.toLowerCase().startsWith(it.apparatus_name.toLowerCase())).slice(0, 6).map((n, idx) => (
                          <li key={idx} className={`nrf-suggestion-item ${activeIndex === idx ? 'active' : ''}`}
                            onMouseDown={() => selectApparatus(i, n.name)}>
                            <span>{n.name}</span>
                            <span className="nrf-stock">Stock: {n.available_quantity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="nrf-dmg-field nrf-dmg-caused">
                  <span className="nrf-inline-label nrf-dmg-label">Caused By</span>
                  <input type="text" className="nrf-input" placeholder="Caused by..." value={it.caused_by} required
                    onChange={e => { const next = [...damagedItems]; next[i].caused_by = e.target.value; setDamagedItems(next); }} />
                </div>
                <div className="nrf-dmg-qty-wrap">
                  <div className="nrf-dmg-field nrf-dmg-qty">
                    <span className="nrf-inline-label nrf-dmg-label">Qty Broken</span>
                    <input type="number" step="1" className="nrf-input" placeholder="Qty" value={it.quantity ?? ''} required
                      onChange={e => { const next = [...damagedItems]; next[i].quantity = e.target.value; setDamagedItems(next); }} />
                  </div>
                  <button type="button" className="nrf-del-btn" onClick={() => setDamagedItems(damagedItems.filter((_, idx) => idx !== i))} title="Remove"><FaTrash /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="nrf-divider"></div>

          <div className="nrf-field">
            <label className="nrf-field-label">Incident Details / Observations</label>
            <textarea className="nrf-textarea" rows="3" value={formData.details} required placeholder="Describe how it happened in detail..."
              onChange={e => setFormData({ ...formData, details: e.target.value })} />
          </div>

          <div className="nrf-action-row">
            <button type="button" className="nrf-btn nrf-btn-ghost" onClick={() => navigate('/damaged-entry')}>
              Cancel
            </button>
            <div className="nrf-spacer"></div>
            <button type="submit" className="nrf-btn nrf-btn-submit" disabled={submitting}>
              {submitting ? 'Recording...' : 'File Damage Report'}
            </button>
          </div>
        </div>
        </form>

        <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
        {toast && <div className="cr-toast cr-toast-visible">{toast}</div>}
      </div>
    </div>
  );
}

export default NewDamagedEntry;
