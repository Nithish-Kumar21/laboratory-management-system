import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaUserTie, FaPhone, FaEnvelope, FaCalendarAlt, FaTools, FaIdCard, FaUser, FaBuilding } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './NewDamagedEntry.css';

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'USA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+7', label: 'Russia (+7)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+971', label: 'UAE (+971)' },
];

function extractErrorMessages(err) {
  if (typeof err === 'string') return [err];
  if (err === null || err === undefined) return [];
  if (Array.isArray(err)) return err.flatMap(extractErrorMessages);
  if (typeof err === 'object') return Object.values(err).flatMap(extractErrorMessages);
  return [String(err)];
}

function NewServiceEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    service_person_name: '',
    contact_country_code: '+91',
    contact_number: '',
    email: '',
    deliver_by_date: '',
    company_name: '',
    company_address: '',
    company_contact_country_code: '+91',
    company_contact_number: '',
  });
  const [items, setItems] = useState([{ apparatus_name: '', quantity: '' }]);
  const [apparatusNames, setApparatusNames] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });
  const [showSuggestions, setShowSuggestions] = useState({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('en-CA'));

  const scrollRef = useRef(null);

  useEffect(() => {
    api.get('/available_apparatus/names/')
      .then(res => setApparatusNames(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error(err));
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  };

  const addRow = () => {
    setItems([...items, { apparatus_name: '', quantity: '' }]);
    scrollToBottom();
  };

  const selectApparatus = (i, n) => {
    const next = [...items];
    next[i].apparatus_name = n;
    setItems(next);
    setShowSuggestions({});
    setActiveIndex(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate numeric fields before submission
    const errors = {};
    items.forEach((it, i) => {
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
        items: items.filter(it => it.apparatus_name).map(it => ({
          apparatus_name: it.apparatus_name,
          quantity: parseInt(it.quantity) || 0,
        })),
      };
      await api.post('/service-entries/', payload);
      navigate('/damaged-entry');
    } catch (err) {
      const serverErr = err.response?.data;
      const msg = serverErr?.error || (typeof serverErr === 'object' && serverErr !== null ? extractErrorMessages(serverErr).join('; ') : '') || 'Failed to submit service entry';
      setAlertDialog({ open: true, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    const { key } = e;
    const rowIdx = Object.keys(showSuggestions).find(idx => showSuggestions[idx]);
    if (rowIdx !== undefined) {
      const query = items[rowIdx].apparatus_name;
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
          <span>New Service Entry</span>
        </div>

        {/* Group 1 — Service ID, Date, Store Keeper */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4 mb-4">
          <div className="nrf-field">
            <label className="nrf-field-label"><FaIdCard /> Service ID</label>
            <input type="text" className="nrf-input" value="SVC-### (auto-generated)" disabled />
          </div>
          <div className="nrf-field">
            <label className="nrf-field-label"><FaCalendarAlt /> Date</label>
            <input type="date" className="nrf-input" value={entryDate}
              onChange={e => setEntryDate(e.target.value)} />
          </div>
          <div className="nrf-field">
            <label className="nrf-field-label"><FaUser /> Store Keeper</label>
            <input type="text" className="nrf-input" value={user?.full_name || '-'} disabled />
          </div>
        </div>

        <div className="nrf-divider" style={{ marginTop: 16, marginBottom: 8 }}></div>
        <div className="nrf-section" style={{ marginBottom: 12 }}>
          <div className="nrf-section-title"><FaUserTie /> Service Person Details</div>
        </div>

        <form className="nrf-service-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className="nrf-card">
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
            <div className="nrf-field">
              <label className="nrf-field-label"><FaUserTie /> Service Person Name</label>
              <input type="text" className="nrf-input" value={formData.service_person_name} required placeholder="Name of service person"
                onChange={e => setFormData({ ...formData, service_person_name: e.target.value })} />
            </div>
            <div className="nrf-field">
              <label className="nrf-field-label"><FaPhone /> Contact Number</label>
              <div className="nrf-composite">
                <select
                  className="nrf-input"
                  value={formData.contact_country_code}
                  onChange={e => setFormData({ ...formData, contact_country_code: e.target.value })}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="nrf-input min-w-0"
                  placeholder="10-digit number"
                  value={formData.contact_number}
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                  title="Exactly 10 digits"
                  onChange={e => setFormData({ ...formData, contact_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
              </div>
            </div>
            <div className="nrf-field">
              <label className="nrf-field-label"><FaEnvelope /> Email</label>
              <input type="email" className="nrf-input" value={formData.email} placeholder="service@example.com"
                onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="nrf-field">
              <label className="nrf-field-label"><FaCalendarAlt /> Tentative Delivery Date</label>
              <input type="date" className="nrf-input" value={formData.deliver_by_date}
                onChange={e => setFormData({ ...formData, deliver_by_date: e.target.value })} />
            </div>
          </div>

          <div className="nrf-divider"></div>

          {/* Company / Vendor Information */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaBuilding /> Company / Vendor Information</div>
            </div>
            <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
              <div className="nrf-field">
                <label className="nrf-field-label">Company Name</label>
                <input type="text" className="nrf-input" value={formData.company_name} placeholder="Name of company"
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
              </div>
              <div className="nrf-field">
                <label className="nrf-field-label">Company Contact</label>
                <div className="nrf-composite">
                  <select
                    className="nrf-input"
                    value={formData.company_contact_country_code}
                    onChange={e => setFormData({ ...formData, company_contact_country_code: e.target.value })}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="nrf-input min-w-0"
                    placeholder="10-digit number"
                    value={formData.company_contact_number}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    title="Exactly 10 digits"
                    onChange={e => setFormData({ ...formData, company_contact_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  />
                </div>
              </div>
            </div>
            <div className="nrf-field">
              <label className="nrf-field-label">Company Address</label>
              <textarea className="nrf-textarea" value={formData.company_address} placeholder="Company address" rows={3}
                onChange={e => setFormData({ ...formData, company_address: e.target.value })} />
            </div>
          </div>

          <div className="nrf-divider"></div>

          {/* Line Items */}
          <div className="nrf-section">
            <div className="nrf-section-header">
              <div className="nrf-section-title"><FaTools /> Apparatus Items</div>
              <button type="button" className="nrf-add-btn" onClick={addRow}><FaPlus /> Add Line</button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="nrf-app-entry md:flex md:flex-row md:items-center md:gap-3 md:flex-nowrap">
                <div className="nrf-autocomplete md:flex-1 md:min-w-0">
                  <input type="text" className="nrf-input" placeholder="Search apparatus..." value={it.apparatus_name} required autoComplete="off"
                    onChange={e => { const next = [...items]; next[i].apparatus_name = e.target.value; setItems(next); setShowSuggestions({ [i]: true }); setActiveIndex(-1); }}
                    onFocus={() => { setShowSuggestions({ [i]: true }); setActiveIndex(-1); }}
                    onBlur={() => setTimeout(() => setShowSuggestions({}), 250)} />
                  {showSuggestions[i] && it.apparatus_name && (
                    <ul className="nrf-suggestions">
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
                <div className="flex items-center gap-2 md:gap-3 flex-nowrap md:shrink-0">
                  <div className="nrf-labeled-field md:w-20 md:shrink-0">
                    <span className="nrf-inline-label md:hidden">Qty</span>
                    <input type="number" step="1" className="nrf-input" placeholder="Qty" value={it.quantity ?? ''} required min="1"
                      onChange={e => { const next = [...items]; next[i].quantity = e.target.value; setItems(next); }} />
                  </div>
                  <button type="button" className="nrf-del-btn md:w-9 md:h-9 md:shrink-0" onClick={() => setItems(items.filter((_, idx) => idx !== i))} title="Remove"><FaTrash /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="nrf-action-row">
            <button type="button" className="nrf-btn nrf-btn-ghost" onClick={() => navigate('/damaged-entry')}>
              Cancel
            </button>
            <div className="nrf-spacer"></div>
            <button type="submit" className="nrf-btn nrf-btn-submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send for Service'}
            </button>
          </div>
        </div>
        </form>

        <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
      </div>
    </div>
  );
}

export default NewServiceEntry;
