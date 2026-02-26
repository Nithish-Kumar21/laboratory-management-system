import React, { useEffect, useState } from 'react';
import { FaPlus, FaTimes, FaTrash, FaFlask, FaUser, FaIdCard, FaCalendarAlt, FaGraduationCap, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './AddRequestModal.css';

const ALL_CLASS_OPTIONS = [
  'I B.Sc Chemistry',
  'II B.Sc Chemistry',
  'III B.Sc Chemistry',
  'I M.Sc Chemistry',
  'II M.Sc Chemistry'
];

function getClassOptionsByDepartment(department) {
  if (!department) return ALL_CLASS_OPTIONS;
  if (department.includes('B.Sc')) return ALL_CLASS_OPTIONS.filter(c => c.includes('B.Sc'));
  if (department.includes('M.Sc')) return ALL_CLASS_OPTIONS.filter(c => c.includes('M.Sc'));
  return ALL_CLASS_OPTIONS;
}

function AddRequestModal({ isOpen, onClose, onSuccess, hasActiveRequest, editData = null }) {
  const { user } = useAuth();
  const classOptions = getClassOptionsByDepartment(user?.department);
  const defaultClass = classOptions.length ? classOptions[0] : 'I B.Sc Chemistry';
  const [formData, setFormData] = useState({
    reason: '',
    class_name: defaultClass,
    date: new Date().toISOString().split('T')[0]
  });
  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', quantity_ml: '' }]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [availableChemicals, setAvailableChemicals] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        const opts = getClassOptionsByDepartment(user?.department);
        const editClass = editData.class_name && opts.includes(editData.class_name) ? editData.class_name : (opts[0] || 'I B.Sc Chemistry');
        const editDate = editData.date ? editData.date.split('T')[0] : (editData.created_at ? new Date(editData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setFormData({
          reason: editData.reason || '',
          class_name: editClass,
          date: editDate
        });
        if (editData.chemical_items && editData.chemical_items.length > 0) {
          setChemicalItems(editData.chemical_items.map(item => ({
            chemical_name: item.chemical_name,
            quantity_ml: item.quantity_ml
          })));
        }
      } else {
        const opts = getClassOptionsByDepartment(user?.department);
        setFormData({
          reason: '',
          class_name: opts.length ? opts[0] : 'I B.Sc Chemistry',
          date: new Date().toISOString().split('T')[0]
        });
        setChemicalItems([{ chemical_name: '', quantity_ml: '' }]);
      }

      api
        .get('available_chemicals/')
        .then((res) => {
          const data = Array.isArray(res.data) ? res.data : res.data.results || [];
          setAvailableChemicals(data);
        })
        .catch((err) => console.error('Error fetching chemicals:', err));
    }
  }, [isOpen, editData, user?.department]);

  if (!isOpen) return null;

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '' }]);
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
    if (formData.date < today) {
      newErrors.date = 'Date cannot be in the past.';
    }
    if (chemicalItems.length === 0) {
      newErrors.items = 'At least one chemical item must be added';
    }
    chemicalItems.forEach((item, i) => {
      if (!item.chemical_name?.trim()) newErrors[`chemical_name_${i}`] = 'Required';
      const q = parseFloat(item.quantity_ml);
      if (!item.quantity_ml || isNaN(q) || q <= 0)
        newErrors[`chemical_quantity_${i}`] = 'Invalid';

      const selectedChem = availableChemicals.find(c => c.chemical_name === item.chemical_name);
      if (selectedChem && q > parseFloat(selectedChem.available_quantity_ml)) {
        newErrors[`chemical_quantity_${i}`] = `Max: ${selectedChem.available_quantity_ml}ml`;
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
      status: (directSubmit && !hasActiveRequest) ? 'pending' : 'draft',
      chemical_items: chemicalItems.map((item) => ({
        chemical_name: item.chemical_name.trim(),
        quantity_ml: parseFloat(item.quantity_ml),
      })),
    };

    try {
      if (editData) {
        await api.put(`stock_request/${editData.id}/`, payload);
      } else {
        await api.post('stock_request/', payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      setErrors({ submit: error.response?.data?.detail || 'Transaction failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay add-request-overlay" onClick={onClose}>
      <div className="modal-content add-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title-box">
            <FaFlask className="header-icon" />
            <h2>{editData ? 'Edit Request' : 'New Request'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form className="request-form" onSubmit={(e) => e.preventDefault()}>
          <div className="modal-body">
            <div className="info-grid">
              <div className="info-item">
                <label><FaIdCard /> ID</label>
                <div className="readonly-field">{editData?.request_id || 'AUTO'}</div>
              </div>
              <div className="info-item">
                <label><FaUser /> Staff</label>
                <div className="readonly-field">{user?.full_name || '...'}</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label><FaGraduationCap /> Class</label>
                <select
                  value={formData.class_name}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  className="modern-select"
                >
                  {classOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label><FaCalendarAlt /> Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="modern-input"
                />
              </div>
            </div>

            <div className="items-section chemical-requirements-section">
              <div className="items-section-header">
                <h3><FaFlask /> Chemical Requirements</h3>
                <button type="button" className="btn-add-line" onClick={addChemicalRow}>
                  <FaPlus /> Add Line
                </button>
              </div>

              <div className="chemical-requirements-table">
                <div className="grid-matrix-header">
                  <span>Chemical</span>
                  <span>Qty (ML)</span>
                  <span></span>
                </div>

                {chemicalItems.map((item, i) => (
                  <div key={i} className="grid-row chemical-row animate-fade">
                    <div className="autocomplete-wrapper">
                      <input
                        type="text"
                        className="grid-input"
                        placeholder="Select Chemical"
                        value={item.chemical_name}
                        autoComplete="off"
                        onChange={(e) => {
                          updateChemicalItem(i, 'chemical_name', e.target.value);
                          setShowSuggestions({ [i]: true });
                        }}
                        onFocus={() => setShowSuggestions({ [i]: true })}
                        onBlur={() => setTimeout(() => setShowSuggestions({}), 200)}
                      />
                      {showSuggestions[i] && item.chemical_name && (
                        <ul className="suggestions-dropdown list-style-none">
                          {availableChemicals
                            .filter(c =>
                              (c.chemical_name || '').toLowerCase().startsWith((item.chemical_name || '').toLowerCase())
                            )
                            .map((c, idx) => (
                              <li
                                key={idx}
                                className="suggestion-item"
                                onMouseDown={() => {
                                  updateChemicalItem(i, 'chemical_name', c.chemical_name);
                                  setShowSuggestions({});
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                  <span>{c.chemical_name}</span>
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      color: '#ef4444',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    Stock: {c.available_quantity_ml} ML
                                  </span>
                                </div>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>

                    <div className="qty-ml-wrapper">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="grid-input grid-input-qty"
                        placeholder="0.00 ML"
                        value={
                          item.quantity_ml !== ''
                            ? `${item.quantity_ml} ML`
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          updateChemicalItem(i, 'quantity_ml', raw);
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-row-del"
                      onClick={() => removeChemicalRow(i)}
                      disabled={chemicalItems.length === 1}
                      title="Remove line"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '30px' }}>
              <label>Purpose / Remarks (Optional)</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Details..."
                rows={3}
                className="modern-textarea"
              />
            </div>

            {hasActiveRequest && !editData && (
              <div className="info-banner warning-banner">
                <FaExclamationTriangle /> Active request pending. This will be saved as draft.
              </div>
            )}
            {errors.submit && <div className="error-banner">{errors.submit}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <div className="footer-actions">
              {!editData && (
                <button
                  type="button"
                  className="btn-draft"
                  onClick={(e) => handleAction(e, false)}
                >
                  Draft
                </button>
              )}
              <button
                type="submit"
                className="btn-primary-action"
                onClick={(e) => handleAction(e, true)}
                disabled={submitting || (hasActiveRequest && !editData)}
              >
                {submitting ? '...' : editData ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRequestModal;
