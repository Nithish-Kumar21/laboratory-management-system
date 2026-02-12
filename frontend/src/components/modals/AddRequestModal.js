import React, { useEffect, useState } from 'react';
import { FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import api from '../../utils/api';
import './AddRequestModal.css';

function AddRequestModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ reason: '' });
  const [chemicalItems, setChemicalItems] = useState([]);
  const [apparatusItems, setApparatusItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [chemicalNames, setChemicalNames] = useState([]);
  const [apparatusNames, setApparatusNames] = useState([]);
  const [showChemicalSuggestions, setShowChemicalSuggestions] = useState({});
  const [showApparatusSuggestions, setShowApparatusSuggestions] = useState({});

  useEffect(() => {
    if (isOpen) {
      api
        .get('/stock_register/chemical_names/')
        .then((res) =>
          setChemicalNames(Array.isArray(res.data) ? res.data : res.data.results || [])
        )
        .catch((err) => console.error('Error fetching chemical names:', err));
      api
        .get('/stock_register/apparatus_names/')
        .then((res) =>
          setApparatusNames(Array.isArray(res.data) ? res.data : res.data.results || [])
        )
        .catch((err) => console.error('Error fetching apparatus names:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '' }]);
  };
  const addApparatusRow = () => {
    setApparatusItems([...apparatusItems, { apparatus_name: '', quantity_pieces: '' }]);
  };
  const removeChemicalRow = (i) => setChemicalItems(chemicalItems.filter((_, idx) => idx !== i));
  const removeApparatusRow = (i) => setApparatusItems(apparatusItems.filter((_, idx) => idx !== i));

  const updateChemicalItem = (index, field, value) => {
    const updated = [...chemicalItems];
    updated[index][field] = value;
    setChemicalItems(updated);
    if (field === 'chemical_name')
      setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: true });
  };
  const updateApparatusItem = (index, field, value) => {
    const updated = [...apparatusItems];
    updated[index][field] = value;
    setApparatusItems(updated);
    if (field === 'apparatus_name')
      setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: true });
  };

  const selectChemicalSuggestion = (index, name) => {
    updateChemicalItem(index, 'chemical_name', name);
    setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: false });
  };
  const selectApparatusSuggestion = (index, name) => {
    updateApparatusItem(index, 'apparatus_name', name);
    setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: false });
  };

  const filterSuggestions = (items, query) =>
    !query ? items : items.filter((item) => item.toLowerCase().includes(query.toLowerCase()));

  const validate = () => {
    const newErrors = {};
    if (chemicalItems.length === 0 && apparatusItems.length === 0) {
      newErrors.items = 'At least one chemical or apparatus item must be added';
    }
    chemicalItems.forEach((item, i) => {
      if (!item.chemical_name?.trim()) newErrors[`chemical_name_${i}`] = 'Chemical name is required';
      const q = parseFloat(item.quantity_ml);
      if (!item.quantity_ml || isNaN(q) || q <= 0)
        newErrors[`chemical_quantity_${i}`] = 'Quantity must be greater than 0';
    });
    apparatusItems.forEach((item, i) => {
      if (!item.apparatus_name?.trim()) newErrors[`apparatus_name_${i}`] = 'Apparatus name is required';
      const q = parseInt(item.quantity_pieces, 10);
      if (!item.quantity_pieces || isNaN(q) || q <= 0)
        newErrors[`apparatus_quantity_${i}`] = 'Quantity must be greater than 0';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const payload = {
      reason: formData.reason.trim(),
      chemical_items: chemicalItems.map((item) => ({
        chemical_name: item.chemical_name.trim(),
        quantity_ml: parseFloat(item.quantity_ml),
      })),
      apparatus_items: apparatusItems.map((item) => ({
        apparatus_name: item.apparatus_name.trim(),
        quantity_pieces: parseInt(item.quantity_pieces, 10),
      })),
    };

    try {
      await api.post('/stock_request/', payload);
      onSuccess();
      setFormData({ reason: '' });
      setChemicalItems([]);
      setApparatusItems([]);
      setErrors({});
      onClose();
    } catch (error) {
      const errData = error.response?.data;
      let msg = 'Failed to submit request. ';
      if (errData?.reason) msg += Array.isArray(errData.reason) ? errData.reason[0] : errData.reason;
      else if (errData?.detail) msg += String(errData.detail);
      else if (typeof errData === 'object') msg += JSON.stringify(errData);
      else msg += error.message || 'Unknown error';
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay add-request-overlay" onClick={onClose}>
      <div className="modal-content add-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request Chemicals & Apparatus</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Reason (optional)</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Enter reason for this request"
                rows={3}
                className="add-request-textarea"
              />
            </div>

            {errors.items && <div className="error-banner">{errors.items}</div>}

            <div className="items-section">
              <div className="section-header">
                <h3>Chemicals</h3>
                <button type="button" className="add-row-btn" onClick={addChemicalRow}>
                  <FaPlus /> Add Chemical
                </button>
              </div>
              {chemicalItems.map((item, i) => (
                <div key={i} className="item-row add-request-item-row">
                  <div className="autocomplete-wrapper">
                    <input
                      type="text"
                      placeholder="Chemical name"
                      value={item.chemical_name}
                      onChange={(e) => updateChemicalItem(i, 'chemical_name', e.target.value)}
                      onFocus={() => setShowChemicalSuggestions({ ...showChemicalSuggestions, [i]: true })}
                      onBlur={() =>
                        setTimeout(
                          () => setShowChemicalSuggestions({ ...showChemicalSuggestions, [i]: false }),
                          200
                        )
                      }
                      className={errors[`chemical_name_${i}`] ? 'error' : ''}
                    />
                    {showChemicalSuggestions[i] && item.chemical_name && (
                      <div className="suggestions-dropdown">
                        {filterSuggestions(chemicalNames, item.chemical_name).map((name, j) => (
                          <div
                            key={j}
                            className="suggestion-item"
                            onMouseDown={() => selectChemicalSuggestion(i, name)}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    {errors[`chemical_name_${i}`] && (
                      <span className="error-text">{errors[`chemical_name_${i}`]}</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Qty (mL)"
                      value={item.quantity_ml}
                      onChange={(e) => updateChemicalItem(i, 'quantity_ml', e.target.value)}
                      className={errors[`chemical_quantity_${i}`] ? 'error' : ''}
                    />
                    {errors[`chemical_quantity_${i}`] && (
                      <span className="error-text">{errors[`chemical_quantity_${i}`]}</span>
                    )}
                  </div>
                  <button type="button" className="delete-row-btn" onClick={() => removeChemicalRow(i)}>
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

            <div className="items-section">
              <div className="section-header">
                <h3>Apparatus</h3>
                <button type="button" className="add-row-btn" onClick={addApparatusRow}>
                  <FaPlus /> Add Apparatus
                </button>
              </div>
              {apparatusItems.map((item, i) => (
                <div key={i} className="item-row add-request-item-row">
                  <div className="autocomplete-wrapper">
                    <input
                      type="text"
                      placeholder="Apparatus name"
                      value={item.apparatus_name}
                      onChange={(e) => updateApparatusItem(i, 'apparatus_name', e.target.value)}
                      onFocus={() => setShowApparatusSuggestions({ ...showApparatusSuggestions, [i]: true })}
                      onBlur={() =>
                        setTimeout(
                          () => setShowApparatusSuggestions({ ...showApparatusSuggestions, [i]: false }),
                          200
                        )
                      }
                      className={errors[`apparatus_name_${i}`] ? 'error' : ''}
                    />
                    {showApparatusSuggestions[i] && item.apparatus_name && (
                      <div className="suggestions-dropdown">
                        {filterSuggestions(apparatusNames, item.apparatus_name).map((name, j) => (
                          <div
                            key={j}
                            className="suggestion-item"
                            onMouseDown={() => selectApparatusSuggestion(i, name)}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    {errors[`apparatus_name_${i}`] && (
                      <span className="error-text">{errors[`apparatus_name_${i}`]}</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Qty (pcs)"
                      value={item.quantity_pieces}
                      onChange={(e) => updateApparatusItem(i, 'quantity_pieces', e.target.value)}
                      className={errors[`apparatus_quantity_${i}`] ? 'error' : ''}
                    />
                    {errors[`apparatus_quantity_${i}`] && (
                      <span className="error-text">{errors[`apparatus_quantity_${i}`]}</span>
                    )}
                  </div>
                  <button type="button" className="delete-row-btn" onClick={() => removeApparatusRow(i)}>
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

            {errors.submit && <div className="error-banner">{errors.submit}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRequestModal;
