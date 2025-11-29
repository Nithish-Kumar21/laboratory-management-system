import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaTrash } from 'react-icons/fa';
import './AddStockRegisterModal.css';

function AddStockRegisterModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0], // Today's date
  });

  const [chemicalItems, setChemicalItems] = useState([]);
  const [apparatusItems, setApparatusItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete data
  const [chemicalNames, setChemicalNames] = useState([]);
  const [apparatusNames, setApparatusNames] = useState([]);
  const [showChemicalSuggestions, setShowChemicalSuggestions] = useState({});
  const [showApparatusSuggestions, setShowApparatusSuggestions] = useState({});

  // Fetch autocomplete data
  useEffect(() => {
    if (isOpen) {
      fetch('http://127.0.0.1:8000/api/stock_register/chemical_names/')
        .then(res => res.json())
        .then(data => setChemicalNames(data))
        .catch(err => console.error('Error fetching chemical names:', err));

      fetch('http://127.0.0.1:8000/api/stock_register/apparatus_names/')
        .then(res => res.json())
        .then(data => setApparatusNames(data))
        .catch(err => console.error('Error fetching apparatus names:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addChemicalRow = () => {
    setChemicalItems([...chemicalItems, { chemical_name: '', quantity_ml: '', rate: '' }]);
  };

  const addApparatusRow = () => {
    setApparatusItems([...apparatusItems, { apparatus_name: '', quantity_pieces: '', rate: '' }]);
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
    
    // Show suggestions when typing in name field
    if (field === 'chemical_name') {
      setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: true });
    }
  };

  const updateApparatusItem = (index, field, value) => {
    const updated = [...apparatusItems];
    updated[index][field] = value;
    setApparatusItems(updated);
    
    // Show suggestions when typing in name field
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
    return items.filter(item => 
      item.toLowerCase().includes(query.toLowerCase())
    );
  };

  const validate = () => {
    const newErrors = {};

    // Validate invoice number
    if (!formData.invoice_number.trim()) {
      newErrors.invoice_number = 'Invoice number is required';
    }

    // Validate date
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    // Validate at least one item
    if (chemicalItems.length === 0 && apparatusItems.length === 0) {
      newErrors.items = 'At least one chemical or apparatus item must be added';
    }

    // Validate chemical items
    chemicalItems.forEach((item, index) => {
      if (!item.chemical_name.trim()) {
        newErrors[`chemical_name_${index}`] = 'Chemical name is required';
      }
      if (!item.quantity_ml || parseFloat(item.quantity_ml) <= 0) {
        newErrors[`chemical_quantity_${index}`] = 'Quantity must be greater than 0';
      }
      if (!item.rate || parseFloat(item.rate) <= 0) {
        newErrors[`chemical_rate_${index}`] = 'Rate must be greater than 0';
      }
    });

    // Validate apparatus items
    apparatusItems.forEach((item, index) => {
      if (!item.apparatus_name.trim()) {
        newErrors[`apparatus_name_${index}`] = 'Apparatus name is required';
      }
      if (!item.quantity_pieces || parseInt(item.quantity_pieces) <= 0) {
        newErrors[`apparatus_quantity_${index}`] = 'Quantity must be greater than 0';
      }
      if (!item.rate || parseFloat(item.rate) <= 0) {
        newErrors[`apparatus_rate_${index}`] = 'Rate must be greater than 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    const payload = {
      invoice_number: formData.invoice_number,
      date: formData.date,
      chemical_items: chemicalItems.map(item => ({
        chemical_name: item.chemical_name,
        quantity_ml: parseFloat(item.quantity_ml),
        rate: parseFloat(item.rate)
      })),
      apparatus_items: apparatusItems.map(item => ({
        apparatus_name: item.apparatus_name,
        quantity_pieces: parseInt(item.quantity_pieces),
        rate: parseFloat(item.rate)
      }))
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/api/stock_register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onSuccess();
        resetForm();
        onClose();
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.invoice_number?.[0] || 'Failed to create entry' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      invoice_number: '',
      date: new Date().toISOString().split('T')[0],
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
            {/* Invoice Number and Date */}
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

            {errors.items && <div className="error-banner">{errors.items}</div>}

            {/* Chemical Items */}
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
                      onBlur={() => setTimeout(() => setShowChemicalSuggestions({ ...showChemicalSuggestions, [index]: false }), 200)}
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
                    {errors[`chemical_name_${index}`] && <span className="error-text">{errors[`chemical_name_${index}`]}</span>}
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
                    {errors[`chemical_quantity_${index}`] && <span className="error-text">{errors[`chemical_quantity_${index}`]}</span>}
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
                    {errors[`chemical_rate_${index}`] && <span className="error-text">{errors[`chemical_rate_${index}`]}</span>}
                  </div>

                  <button
                    type="button"
                    className="delete-row-btn"
                    onClick={() => removeChemicalRow(index)}
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

            {/* Apparatus Items */}
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
                      onBlur={() => setTimeout(() => setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: false }), 200)}
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
                    {errors[`apparatus_name_${index}`] && <span className="error-text">{errors[`apparatus_name_${index}`]}</span>}
                  </div>

                  <div>
                    <input
                      type="number"
                      placeholder="Quantity (pieces)"
                      value={item.quantity_pieces}
                      onChange={(e) => updateApparatusItem(index, 'quantity_pieces', e.target.value)}
                      className={errors[`apparatus_quantity_${index}`] ? 'error' : ''}
                    />
                    {errors[`apparatus_quantity_${index}`] && <span className="error-text">{errors[`apparatus_quantity_${index}`]}</span>}
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
                    {errors[`apparatus_rate_${index}`] && <span className="error-text">{errors[`apparatus_rate_${index}`]}</span>}
                  </div>

                  <button
                    type="button"
                    className="delete-row-btn"
                    onClick={() => removeApparatusRow(index)}
                  >
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
