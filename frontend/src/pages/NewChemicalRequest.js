import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaPlus, FaTrash, FaChevronDown, FaCalendarAlt, FaArrowRight } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ALL_CLASS_OPTIONS = [
  'I B.Sc Chemistry',
  'II B.Sc Chemistry',
  'III B.Sc Chemistry',
  'I M.Sc Chemistry',
  'II M.Sc Chemistry'
];

function NewChemicalRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  const classOptions = ALL_CLASS_OPTIONS;
  const [formData, setFormData] = useState({
    reason: '',
    class_name: classOptions[0],
    date: new Date().toISOString().split('T')[0],
    day_order: 'I',
    hour: [],
    purpose_type: 'practical_lab',
    experiment_name: '',
    student_name: ''
  });
  const [hourOpen, setHourOpen] = useState(false);
  const hourRef = useRef(null);
  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', quantity: '' }]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [availableChemicals, setAvailableChemicals] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState({});
  const [loadingDraft, setLoadingDraft] = useState(!!editId);

  useEffect(() => {
    api.get('/available_chemicals/')
      .then((res) => {
        setAvailableChemicals(Array.isArray(res.data) ? res.data : res.data.results || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    api.get(`stock_request/${editId}/`)
      .then((res) => {
        const data = res.data;
        setFormData({
          reason: data.reason || '',
          class_name: data.class_name,
          date: data.date || new Date(data.created_at).toISOString().split('T')[0],
          day_order: data.day_order || 'I',
          hour: data.hour || [],
          purpose_type: data.purpose_type || 'practical_lab',
          experiment_name: data.experiment_name || '',
          student_name: data.student_name || '',
        });
        if (data.chemical_items?.length) {
          setChemicalItems(data.chemical_items.map(item => ({
            chemical_name: item.chemical_name,
            quantity: item.quantity,
          })));
        }
      })
      .catch(() => navigate('/requests'))
      .finally(() => setLoadingDraft(false));
  }, [editId]);

  useEffect(() => {
    const handleClick = (e) => {
      if (hourRef.current && !hourRef.current.contains(e.target)) {
        setHourOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity: '' }]);
  };

  const removeChemicalRow = (i) => {
    if (chemicalItems.length > 1) {
      setChemicalItems(chemicalItems.filter((_, idx) => idx !== i));
    }
  };

  const updateChemicalItem = (index, field, value) => {
    const updated = [...chemicalItems];
    updated[index][field] = value;
    setChemicalItems(updated);
  };

  const validate = () => {
    const newErrors = {};
    const today = new Date().toISOString().split('T')[0];
    if (formData.date < today) newErrors.date = 'Date cannot be in the past.';
    if (!formData.day_order) newErrors.day_order = 'Required';
    if (!formData.hour.length) newErrors.hour = 'Select at least one hour';
    if (!formData.purpose_type) newErrors.purpose_type = 'Select a purpose type';
    if (formData.purpose_type && !formData.experiment_name?.trim()) newErrors.experiment_name = 'Required';
    if (formData.purpose_type === 'research_project' && !formData.student_name?.trim()) newErrors.student_name = 'Required';
    chemicalItems.forEach((item, i) => {
      if (!item.chemical_name?.trim()) newErrors[`chemical_name_${i}`] = 'Required';
      const q = parseFloat(item.quantity);
      if (!item.quantity || isNaN(q) || q <= 0) newErrors[`chemical_quantity_${i}`] = 'Invalid';
      const selectedChem = availableChemicals.find(c => c.chemical_name === item.chemical_name);
      if (selectedChem && q > parseFloat(selectedChem.quantity)) {
        newErrors[`chemical_quantity_${i}`] = `Exceeds stock (Available: ${selectedChem.quantity})`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAction = async (e, directSubmit = true) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      class_name: formData.class_name,
      reason: formData.reason.trim(),
      date: formData.date,
      day_order: formData.day_order,
      hour: formData.hour,
      purpose_type: formData.purpose_type,
      experiment_name: formData.experiment_name,
      student_name: formData.purpose_type === 'practical_lab' ? '' : formData.student_name,
      status: directSubmit ? 'pending' : 'draft',
      chemical_items: chemicalItems.map(item => ({
        chemical_name: item.chemical_name.trim(),
        quantity: parseFloat(item.quantity),
      })),
    };
    try {
      if (editId) {
        await api.put(`/stock_request/${editId}/`, payload);
      } else {
        await api.post('/stock_request/', payload);
      }
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      navigate('/requests');
    } catch (error) {
      const errData = error.response?.data;
      let errMsg = 'Transaction failed';
      if (errData) {
        if (typeof errData === 'string') errMsg = errData;
        else if (errData.detail) errMsg = errData.detail;
        else if (errData.error) errMsg = Array.isArray(errData.error) ? errData.error[0] : errData.error;
        else {
          const firstKey = Object.keys(errData)[0];
          if (firstKey && Array.isArray(errData[firstKey])) errMsg = errData[firstKey][0];
          else if (firstKey && typeof errData[firstKey] === 'string') errMsg = errData[firstKey];
        }
      }
      setErrors({ submit: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDraft) {
    return (
      <div className="cr-page nrf-page animate-up">
        <div className="nrf-form-container" style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          Loading draft...
        </div>
      </div>
    );
  }

  return (
    <div className="cr-page nrf-page animate-up">
      <div className="nrf-form-container">
        <div className="nrf-back-row" onClick={() => navigate('/requests')}>
          <FaArrowLeft />
          <span>{editId ? 'Edit Request' : 'New Request'}</span>
        </div>

        <div className="nrf-card">
        <div className="nrf-auto-row">
          <div className="nrf-auto-box">
            <div className="nrf-auto-label">ID</div>
            <div className="nrf-auto-value">{editId ? `#${editId}` : 'AUTO'}</div>
          </div>
          <div className="nrf-auto-box">
            <div className="nrf-auto-label">STAFF</div>
            <div className="nrf-auto-value">{user?.full_name || '...'}</div>
          </div>
        </div>

        <div className="nrf-field-row">
          <div className="nrf-field nrf-field-half">
            <label className="nrf-field-label">Class</label>
            <div className="nrf-field-control">
              <select
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                className="nrf-select"
              >
                {classOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <FaChevronDown className="nrf-chevron" />
            </div>
          </div>

          <div className="nrf-field nrf-field-half">
            <label className="nrf-field-label">Date</label>
            <div className="nrf-field-control">
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`nrf-date-input ${errors.date ? 'nrf-error' : ''}`}
              />
              <FaCalendarAlt className="nrf-cal-icon" />
            </div>
            {errors.date && <span className="nrf-field-err">{errors.date}</span>}
          </div>
        </div>

        <div className="nrf-field-row">
          <div className="nrf-field nrf-field-half">
            <label className="nrf-field-label">Day Order</label>
            <div className="nrf-field-control">
              <select
                value={formData.day_order}
                onChange={(e) => setFormData({ ...formData, day_order: e.target.value })}
                className={`nrf-select ${errors.day_order ? 'nrf-error' : ''}`}
              >
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="V">V</option>
                <option value="VI">VI</option>
              </select>
              <FaChevronDown className="nrf-chevron" />
            </div>
          </div>

          <div className="nrf-field nrf-field-half" ref={hourRef}>
            <label className="nrf-field-label">Hour</label>
            <div className="nrf-multi-select">
              <button
                type="button"
                className={`nrf-multi-btn ${errors.hour ? 'nrf-error' : ''}`}
                onClick={() => setHourOpen(!hourOpen)}
              >
                <span>{formData.hour.length ? formData.hour.sort((a, b) => a - b).join(', ') : 'Select hour(s)'}</span>
                <FaChevronDown className={`nrf-chevron ${hourOpen ? 'nrf-chevron-up' : ''}`} />
              </button>
              {hourOpen && (
                <div className="nrf-multi-dropdown">
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
        </div>

        <div className="nrf-chem-section">
          <div className="nrf-chem-header">
            <div className="nrf-chem-title">
              <FaFlask /> Chemical Requirements
            </div>
            <button type="button" className="nrf-add-btn" onClick={addChemicalRow}>
              <FaPlus /> Add Line
            </button>
          </div>

          <div className="nrf-chem-cols">
            <span>Chemical</span>
            <span>QTY</span>
            <span></span>
          </div>

          {chemicalItems.map((item, i) => (
            <div key={i} className="nrf-chem-row">
              <div className="nrf-chem-select">
                <input
                  type="text"
                  className={`nrf-chem-input ${errors[`chemical_name_${i}`] ? 'nrf-error' : ''}`}
                  placeholder="Select chemicals"
                  value={item.chemical_name}
                  onChange={(e) => {
                    updateChemicalItem(i, 'chemical_name', e.target.value);
                    if (e.target.value.trim()) setShowSuggestions({ [i]: true });
                  }}
                  onFocus={() => {
                    if (item.chemical_name?.trim()) setShowSuggestions({ [i]: true });
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions({}), 200)}
                />
                <FaChevronDown className="nrf-chevron-sm" />
                {errors[`chemical_name_${i}`] && <span className="nrf-field-err">Required</span>}
                {showSuggestions[i] && item.chemical_name && (
                  <ul className="nrf-suggestions">
                    {availableChemicals
                      .filter(c => (c.chemical_name || '').toLowerCase().startsWith((item.chemical_name || '').toLowerCase()))
                      .map((c, idx) => (
                        <li
                          key={idx}
                          className="nrf-suggestion-item"
                          onMouseDown={() => { updateChemicalItem(i, 'chemical_name', c.chemical_name); setShowSuggestions({}); }}
                        >
                          <span>{c.chemical_name}</span>
                          <span className="nrf-stock">Stock: {c.quantity} {c.unit}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="nrf-qty-wrap">
                <input
                  type="number"
                  step="1"
                  min="0"
                  className={`nrf-qty-input ${errors[`chemical_quantity_${i}`] ? 'nrf-error' : ''}`}
                  placeholder="0"
                  value={item.quantity === '' || item.quantity == null ? '' : item.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateChemicalItem(i, 'quantity', v === '' ? '' : v);
                  }}
                />
                <span className="nrf-qty-unit">{availableChemicals.find(c => c.chemical_name === item.chemical_name)?.unit}</span>
              </div>
              <button
                type="button"
                className="nrf-del-btn"
                onClick={() => removeChemicalRow(i)}
                disabled={chemicalItems.length === 1}
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="nrf-field">
          <label className="nrf-field-label">Purpose Type</label>
          <div className="nrf-radio-tabs">
            <button
              type="button"
              className={`nrf-radio-tab ${formData.purpose_type === 'practical_lab' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, purpose_type: 'practical_lab', student_name: '' })}
            >
              Practical Lab
            </button>
            <button
              type="button"
              className={`nrf-radio-tab ${formData.purpose_type === 'research_project' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, purpose_type: 'research_project' })}
            >
              Research / Project
            </button>
          </div>
          {errors.purpose_type && <span className="nrf-field-err">{errors.purpose_type}</span>}
        </div>

        {formData.purpose_type === 'practical_lab' && (
          <div className="nrf-field">
            <label className="nrf-field-label">Experiment Name(s)</label>
            <div className="nrf-field-control">
              <textarea
                value={formData.experiment_name}
                onChange={(e) => setFormData({ ...formData, experiment_name: e.target.value })}
                className={`nrf-text-input ${errors.experiment_name ? 'nrf-error' : ''}`}
                placeholder="Enter experiment name(s), one per line"
                rows={3}
              />
            </div>
            {errors.experiment_name && <span className="nrf-field-err">{errors.experiment_name}</span>}
          </div>
        )}

        {formData.purpose_type === 'research_project' && (
          <>
            <div className="nrf-field-row">
              <div className="nrf-field nrf-field-half">
                <label className="nrf-field-label">Student Name(s)</label>
                <div className="nrf-field-control">
                  <textarea
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className={`nrf-text-input ${errors.student_name ? 'nrf-error' : ''}`}
                    placeholder="Enter student name(s), one per line"
                    rows={3}
                  />
                </div>
                {errors.student_name && <span className="nrf-field-err">{errors.student_name}</span>}
              </div>
              <div className="nrf-field nrf-field-half">
                <label className="nrf-field-label">Experiment Name(s)</label>
                <div className="nrf-field-control">
                  <textarea
                    value={formData.experiment_name}
                    onChange={(e) => setFormData({ ...formData, experiment_name: e.target.value })}
                    className={`nrf-text-input ${errors.experiment_name ? 'nrf-error' : ''}`}
                    placeholder="Enter experiment name(s), one per line"
                    rows={3}
                  />
                </div>
                {errors.experiment_name && <span className="nrf-field-err">{errors.experiment_name}</span>}
              </div>
            </div>
          </>
        )}

        {errors.submit && <div className="nrf-submit-err">{errors.submit}</div>}

        <div className="nrf-action-row">
          <button type="button" className="nrf-btn nrf-btn-ghost" onClick={() => navigate('/requests')}>
            Cancel
          </button>
          <div className="nrf-spacer"></div>
          <button type="button" className="nrf-btn nrf-btn-draft" onClick={(e) => handleAction(e, false)}>
            Draft
          </button>
          <button type="submit" className="nrf-btn nrf-btn-submit" onClick={(e) => handleAction(e, true)} disabled={submitting}>
            {submitting ? '...' : <>Submit <FaArrowRight /></>}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default NewChemicalRequest;
