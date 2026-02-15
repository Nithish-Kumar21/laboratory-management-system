import React, { useEffect, useState } from 'react';
import { FaPlus, FaTimes, FaTrash, FaFlask, FaUser, FaIdCard, FaCalendarAlt, FaGraduationCap, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './AddRequestModal.css';

function AddRequestModal({ isOpen, onClose, onSuccess, hasActiveRequest, editData = null }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    reason: '',
    class_name: 'I B.Sc Chemistry',
    date: new Date().toISOString().split('T')[0]
  });
  const [chemicalItems, setChemicalItems] = useState([{ chemical_name: '', quantity_ml: '' }]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [availableChemicals, setAvailableChemicals] = useState([]);

  const classOptions = [
    'I B.Sc Chemistry',
    'II B.Sc Chemistry',
    'III B.Sc Chemistry',
    'I M.Sc Chemistry',
    'II M.Sc Chemistry'
  ];

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          reason: editData.reason || '',
          class_name: editData.class_name || 'I B.Sc Chemistry',
          date: editData.created_at ? new Date(editData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
        if (editData.chemical_items && editData.chemical_items.length > 0) {
          setChemicalItems(editData.chemical_items.map(item => ({
            chemical_name: item.chemical_name,
            quantity_ml: item.quantity_ml
          })));
        }
      } else {
        setFormData({
          reason: '',
          class_name: 'I B.Sc Chemistry',
          date: new Date().toISOString().split('T')[0]
        });
        setChemicalItems([{ chemical_name: '', quantity_ml: '' }]);
      }

      api
        .get('/available_chemicals/')
        .then((res) => {
          const data = Array.isArray(res.data) ? res.data : res.data.results || [];
          setAvailableChemicals(data);
        })
        .catch((err) => console.error('Error fetching chemicals:', err));
    }
  }, [isOpen, editData]);

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
    if (chemicalItems.length === 0) {
      newErrors.items = 'At least one chemical item must be added';
    }
    chemicalItems.forEach((item, i) => {
      if (!item.chemical_name?.trim()) newErrors[`chemical_name_${i}`] = 'Chemical selection is required';
      const q = parseFloat(item.quantity_ml);
      if (!item.quantity_ml || isNaN(q) || q <= 0)
        newErrors[`chemical_quantity_${i}`] = 'Quantity must be greater than 0';

      const selectedChem = availableChemicals.find(c => c.chemical_name === item.chemical_name);
      if (selectedChem && q > parseFloat(selectedChem.available_quantity_ml)) {
        newErrors[`chemical_quantity_${i}`] = `Max available: ${selectedChem.available_quantity_ml}ml`;
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
      status: (directSubmit && (!hasActiveRequest || (editData && editData.status !== 'pending'))) ? 'pending' : 'draft',
      chemical_items: chemicalItems.map((item) => ({
        chemical_name: item.chemical_name.trim(),
        quantity_ml: parseFloat(item.quantity_ml),
      })),
    };

    try {
      if (editData) {
        await api.put(`/stock_request/${editData.id}/`, payload);
      } else {
        await api.post('/stock_request/', payload);
      }
      onSuccess();
      setFormData({
        reason: '',
        class_name: 'I B.Sc Chemistry',
        date: new Date().toISOString().split('T')[0]
      });
      setChemicalItems([{ chemical_name: '', quantity_ml: '' }]);
      setErrors({});
      onClose();
    } catch (error) {
      const errData = error.response?.data;
      let msg = directSubmit ? 'Failed to submit request. ' : 'Failed to save draft. ';
      if (Array.isArray(errData?.non_field_errors)) {
        msg += errData.non_field_errors[0];
      } else if (errData?.reason) {
        msg += Array.isArray(errData.reason) ? errData.reason[0] : errData.reason;
      } else if (errData?.detail) {
        msg += String(errData.detail);
      } else if (typeof errData === 'object') {
        const firstErr = Object.values(errData)[0];
        msg += Array.isArray(firstErr) ? firstErr[0] : String(firstErr);
      } else {
        msg += error.message || 'Unknown error';
      }
      setErrors({ submit: msg });
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
            <h2>{editData ? 'Edit Chemical Request' : 'New Chemical Request'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form className="request-form">
          <div className="modal-body">
            <div className="info-grid">
              <div className="info-item">
                <label><FaIdCard /> Request ID</label>
                <div className="readonly-field">{editData?.request_id || 'Auto-generated'}</div>
              </div>
              <div className="info-item">
                <label><FaUser /> Staff Name</label>
                <div className="readonly-field">{user?.full_name || 'Loading...'}</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
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
              <div className="form-group flex-1">
                <label><FaCalendarAlt /> Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="modern-input"
                />
              </div>
            </div>

            <div className="items-section-header">
              <h3>Chemical Requirements</h3>
              <button type="button" className="add-chem-btn" onClick={addChemicalRow}>
                <FaPlus /> Add Line
              </button>
            </div>

            <div className="chemical-items-container">
              {chemicalItems.map((item, i) => (
                <div key={i} className="chemical-request-row">
                  <div className="chem-select-col">
                    <select
                      value={item.chemical_name}
                      onChange={(e) => updateChemicalItem(i, 'chemical_name', e.target.value)}
                      className={errors[`chemical_name_${i}`] ? 'error' : ''}
                    >
                      <option value="">Select Chemical</option>
                      {availableChemicals.map((chem) => (
                        <option key={chem.id} value={chem.chemical_name}>
                          {chem.chemical_name} • {chem.available_quantity_ml}ml available
                        </option>
                      ))}
                    </select>
                    {errors[`chemical_name_${i}`] && (
                      <span className="error-text">{errors[`chemical_name_${i}`]}</span>
                    )}
                  </div>
                  <div className="chem-qty-col">
                    <div className="qty-input-wrapper">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={item.quantity_ml}
                        onChange={(e) => updateChemicalItem(i, 'quantity_ml', e.target.value)}
                        className={errors[`chemical_quantity_${i}`] ? 'error' : ''}
                      />
                      <span className="unit-tag">ML</span>
                    </div>
                    {errors[`chemical_quantity_${i}`] && (
                      <span className="error-text">{errors[`chemical_quantity_${i}`]}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="remove-chem-btn"
                    onClick={() => removeChemicalRow(i)}
                    disabled={chemicalItems.length === 1}
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

            <div className="form-group margin-top-lg">
              <label>Purpose / Remarks (optional)</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Briefly describe what these chemicals will be used for..."
                rows={3}
                className="modern-textarea"
              />
            </div>

            {hasActiveRequest && !editData && (
              <div className="info-banner warning-banner margin-top-md">
                <FaExclamationTriangle /> You have an active pending request. This will be saved as a draft and can be submitted after your current request is reviewed.
              </div>
            )}
            {errors.submit && <div className="error-banner">{errors.submit}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <div className="footer-actions">
              {!hasActiveRequest && !editData && (
                <button
                  type="button"
                  className="btn-draft"
                  onClick={(e) => handleAction(e, false)}
                  disabled={submitting}
                >
                  Save as Draft
                </button>
              )}
              <button
                type="submit"
                className="btn-primary-action"
                disabled={submitting}
                onClick={(e) => handleAction(e, true)}
              >
                {submitting
                  ? 'Processing...'
                  : editData
                    ? 'Update Request'
                    : hasActiveRequest
                      ? 'Save as Draft (Queue)'
                      : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRequestModal;
