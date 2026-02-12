import React, { useEffect, useState } from 'react';
import { FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import api from '../../utils/api';
import './AddStockRegisterModal.css';

function AddStockRegisterModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    supplier_name: '',
  });

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
        .then((response) =>
          setChemicalNames(Array.isArray(response.data) ? response.data : response.data.results || [])
        )
        .catch((err) => console.error('Error fetching chemical names:', err));

      api
        .get('/stock_register/apparatus_names/')
        .then((response) =>
          setApparatusNames(Array.isArray(response.data) ? response.data : response.data.results || [])
        )
        .catch((err) => console.error('Error fetching apparatus names:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '', rate: '', make: '' }]);
  };

  const addApparatusRow = () => {
    setApparatusItems([
      ...apparatusItems,
      { apparatus_name: '', quantity_pieces: '', rate: '', make: '' },
    ]);
  };

  const removeChemicalRow = (index) => {
    setChemicalItems(chemicalItems.filter((_, i) => i !== index));
  };

  const removeApparatusRow = (index) => {
    setApparatusItems(apparatusItems.filter((_, i) => i !== index));
  };

  const updateChemicalItem = (index, field, value) => {
    const updated = [...chemicalItems];
    updated[index][field] = value;
    setChemicalItems(updated);

    if (field === 'chemical_name') {
      setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: true });
    }
  };

  const updateApparatusItem = (index, field, value) => {
    const updated = [...apparatusItems];
    updated[index][field] = value;
    setApparatusItems(updated);

    if (field === 'apparatus_name') {
      setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: true });
    }
  };

  const selectChemicalSuggestion = (index, name) => {
    updateChemicalItem(index, 'chemical_name', name);
    setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: false });
  };

  const selectApparatusSuggestion = (index, name) => {
    updateApparatusItem(index, 'apparatus_name', name);
    setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: false });
  };

  const filterSuggestions = (items, query) => {
    if (!query) return items;
    return items.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.invoice_number.trim()) newErrors.invoice_number = 'Invoice number is required';
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.supplier_name.trim()) newErrors.supplier_name = 'Supplier name is required';

    if (chemicalItems.length === 0 && apparatusItems.length === 0) {
      newErrors.items = 'At least one chemical or apparatus item must be added';
    }

    chemicalItems.forEach((item, index) => {
      if (!item.chemical_name.trim()) newErrors[`chemical_name_${index}`] = 'Chemical name is required';
      const qtyMl = parseFloat(item.quantity_ml);
      if (!item.quantity_ml || isNaN(qtyMl) || qtyMl <= 0) {
        newErrors[`chemical_quantity_${index}`] = 'Quantity must be greater than 0';
      }
      const rateMl = parseFloat(item.rate);
      if (!item.rate || isNaN(rateMl) || rateMl <= 0) {
        newErrors[`chemical_rate_${index}`] = 'Rate must be greater than 0';
      }
      if (!item.make.trim()) newErrors[`chemical_make_${index}`] = 'Make is required';
    });

    apparatusItems.forEach((item, index) => {
      if (!item.apparatus_name.trim()) newErrors[`apparatus_name_${index}`] = 'Apparatus name is required';
      const qtyPieces = parseInt(item.quantity_pieces, 10);
      if (!item.quantity_pieces || isNaN(qtyPieces) || qtyPieces <= 0) {
        newErrors[`apparatus_quantity_${index}`] = 'Quantity must be greater than 0';
      }
      const rateApp = parseFloat(item.rate);
      if (!item.rate || isNaN(rateApp) || rateApp <= 0) {
        newErrors[`apparatus_rate_${index}`] = 'Rate must be greater than 0';
      }
      if (!item.make.trim()) newErrors[`apparatus_make_${index}`] = 'Make is required';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const payload = {
      invoice_number: formData.invoice_number.trim(),
      date: formData.date,
      supplier_name: formData.supplier_name.trim(),
      chemical_items: chemicalItems.map((item) => ({
        chemical_name: item.chemical_name.trim(),
        quantity_ml: parseFloat(item.quantity_ml),
        rate: parseFloat(item.rate),
        make: item.make.trim(),
      })),
      apparatus_items: apparatusItems.map((item) => ({
        apparatus_name: item.apparatus_name.trim(),
        quantity_pieces: parseInt(item.quantity_pieces, 10),
        rate: parseFloat(item.rate),
        make: item.make.trim(),
      })),
    };

    try {
      await api.post('/stock_register/', payload);
      window.dispatchEvent(new Event('inventory-updated'));
      localStorage.setItem('inventory-updated', Date.now());
      onSuccess();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Stock register submit error:', error?.response?.data || error);
      const errorData = error.response?.data;
      const status = error.response?.status;
      let errorMessage = 'Failed to create entry. ';

      if (status === 403) {
        errorMessage = 'You do not have permission to add stock register entries.';
      } else if (status === 401) {
        errorMessage = 'Please log in again. Your session may have expired.';
      } else if (status === 404) {
        errorMessage = 'API endpoint not found. Is the backend server running at http://127.0.0.1:8000?';
      } else if (status === 500) {
        errorMessage = 'Server error: Database or backend issue. Run migrations (python manage.py migrate) and ensure the database file is not locked.';
      } else if (typeof errorData === 'string') {
        if (errorData.includes('OperationalError') || errorData.includes('database')) {
          errorMessage = 'Database error. Run migrations: python manage.py migrate';
        } else {
          errorMessage = 'Server returned an error. Check the backend terminal for details.';
        }
      } else if (errorData && typeof errorData === 'object' && !Array.isArray(errorData)) {
        const parts = [];
        if (errorData.invoice_number) parts.push(Array.isArray(errorData.invoice_number) ? errorData.invoice_number[0] : errorData.invoice_number);
        if (errorData.error) parts.push(errorData.error);
        if (errorData.detail) parts.push(typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
        if (errorData.chemical_items && Array.isArray(errorData.chemical_items)) {
          errorData.chemical_items.forEach((err, i) => {
            if (err && typeof err === 'object') {
              Object.entries(err).forEach(([k, v]) => {
                if (Array.isArray(v)) parts.push(`Chemical ${i + 1} (${k}): ${v[0]}`);
                else if (v) parts.push(`Chemical ${i + 1}: ${v}`);
              });
            }
          });
        }
        if (errorData.apparatus_items && Array.isArray(errorData.apparatus_items)) {
          errorData.apparatus_items.forEach((err, i) => {
            if (err && typeof err === 'object') {
              Object.entries(err).forEach(([k, v]) => {
                if (Array.isArray(v)) parts.push(`Apparatus ${i + 1} (${k}): ${v[0]}`);
                else if (v) parts.push(`Apparatus ${i + 1}: ${v}`);
              });
            }
          });
        }
        const nonFieldKeys = ['invoice_number', 'error', 'detail', 'chemical_items', 'apparatus_items'];
        Object.entries(errorData).forEach(([k, v]) => {
          if (!nonFieldKeys.includes(k) && v) {
            const msg = Array.isArray(v) ? v[0] : (typeof v === 'string' ? v : JSON.stringify(v));
            parts.push(`${k}: ${msg}`);
          }
        });
        errorMessage += parts.length > 0 ? parts.join('. ') : JSON.stringify(errorData);
      } else {
        errorMessage += error.message || 'Unknown error occurred. Check the console for details.';
      }

      setErrors({ submit: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      invoice_number: '',
      date: new Date().toISOString().split('T')[0],
      supplier_name: '',
    });
    setChemicalItems([]);
    setApparatusItems([]);
    setErrors({});
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Stock Register Entry</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Invoice Number *</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className={errors.invoice_number ? 'error' : ''}
                  placeholder="Enter invoice number"
                />
                {errors.invoice_number && <span className="error-text">{errors.invoice_number}</span>}
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={errors.date ? 'error' : ''}
                />
                {errors.date && <span className="error-text">{errors.date}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>Supplier Name *</label>
              <input
                type="text"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                className={errors.supplier_name ? 'error' : ''}
                placeholder="Enter supplier name"
              />
              {errors.supplier_name && <span className="error-text">{errors.supplier_name}</span>}
            </div>

            {errors.items && <div className="error-banner">{errors.items}</div>}

            <div className="items-section">
              <div className="section-header">
                <h3>Chemical List</h3>
                <button type="button" className="add-row-btn" onClick={addChemicalRow}>
                  <FaPlus /> Add Chemical
                </button>
              </div>

              {chemicalItems.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="autocomplete-wrapper">
                    <input
                      type="text"
                      placeholder="Chemical name"
                      value={item.chemical_name}
                      onChange={(e) => updateChemicalItem(index, 'chemical_name', e.target.value)}
                      onFocus={() => setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: true })}
                      onBlur={() =>
                        setTimeout(
                          () => setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: false }),
                          200
                        )
                      }
                      className={errors[`chemical_name_${index}`] ? 'error' : ''}
                    />
                    {showChemicalSuggestions[index] && item.chemical_name && (
                      <div className="suggestions-dropdown">
                        {filterSuggestions(chemicalNames, item.chemical_name).map((name, i) => (
                          <div
                            key={i}
                            className="suggestion-item"
                            onMouseDown={() => selectChemicalSuggestion(index, name)}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    {errors[`chemical_name_${index}`] && (
                      <span className="error-text">{errors[`chemical_name_${index}`]}</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Quantity (mL)"
                      value={item.quantity_ml}
                      onChange={(e) => updateChemicalItem(index, 'quantity_ml', e.target.value)}
                      className={errors[`chemical_quantity_${index}`] ? 'error' : ''}
                    />
                    {errors[`chemical_quantity_${index}`] && (
                      <span className="error-text">{errors[`chemical_quantity_${index}`]}</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateChemicalItem(index, 'rate', e.target.value)}
                      className={errors[`chemical_rate_${index}`] ? 'error' : ''}
                    />
                    {errors[`chemical_rate_${index}`] && (
                      <span className="error-text">{errors[`chemical_rate_${index}`]}</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Make"
                      value={item.make}
                      onChange={(e) => updateChemicalItem(index, 'make', e.target.value)}
                      className={errors[`chemical_make_${index}`] ? 'error' : ''}
                    />
                    {errors[`chemical_make_${index}`] && (
                      <span className="error-text">{errors[`chemical_make_${index}`]}</span>
                    )}
                  </div>

                  <button type="button" className="delete-row-btn" onClick={() => removeChemicalRow(index)}>
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

            <div className="items-section">
              <div className="section-header">
                <h3>Apparatus List</h3>
                <button type="button" className="add-row-btn" onClick={addApparatusRow}>
                  <FaPlus /> Add Apparatus
                </button>
              </div>

              {apparatusItems.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="autocomplete-wrapper">
                    <input
                      type="text"
                      placeholder="Apparatus name"
                      value={item.apparatus_name}
                      onChange={(e) => updateApparatusItem(index, 'apparatus_name', e.target.value)}
                      onFocus={() => setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: true })}
                      onBlur={() =>
                        setTimeout(
                          () => setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: false }),
                          200
                        )
                      }
                      className={errors[`apparatus_name_${index}`] ? 'error' : ''}
                    />
                    {showApparatusSuggestions[index] && item.apparatus_name && (
                      <div className="suggestions-dropdown">
                        {filterSuggestions(apparatusNames, item.apparatus_name).map((name, i) => (
                          <div
                            key={i}
                            className="suggestion-item"
                            onMouseDown={() => selectApparatusSuggestion(index, name)}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    {errors[`apparatus_name_${index}`] && (
                      <span className="error-text">{errors[`apparatus_name_${index}`]}</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="number"
                      placeholder="Quantity (pieces)"
                      value={item.quantity_pieces}
                      onChange={(e) => updateApparatusItem(index, 'quantity_pieces', e.target.value)}
                      className={errors[`apparatus_quantity_${index}`] ? 'error' : ''}
                    />
                    {errors[`apparatus_quantity_${index}`] && (
                      <span className="error-text">{errors[`apparatus_quantity_${index}`]}</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateApparatusItem(index, 'rate', e.target.value)}
                      className={errors[`apparatus_rate_${index}`] ? 'error' : ''}
                    />
                    {errors[`apparatus_rate_${index}`] && (
                      <span className="error-text">{errors[`apparatus_rate_${index}`]}</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Make"
                      value={item.make}
                      onChange={(e) => updateApparatusItem(index, 'make', e.target.value)}
                      className={errors[`apparatus_make_${index}`] ? 'error' : ''}
                    />
                    {errors[`apparatus_make_${index}`] && (
                      <span className="error-text">{errors[`apparatus_make_${index}`]}</span>
                    )}
                  </div>

                  <button type="button" className="delete-row-btn" onClick={() => removeApparatusRow(index)}>
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
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddStockRegisterModal;

