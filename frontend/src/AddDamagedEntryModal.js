import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaTrash } from 'react-icons/fa';
import api from './utils/api';
import './AddDamagedEntryModal.css';

function AddDamagedEntryModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    staff: '',
    class_name: '',
    date: new Date().toISOString().split('T')[0], // Today's date
    caused_by: '',
    details: '',
  });

  const [apparatusItems, setApparatusItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete data
  const [apparatusNames, setApparatusNames] = useState([]);
  const [showApparatusSuggestions, setShowApparatusSuggestions] = useState({});

  // Fetch autocomplete data
  useEffect(() => {
    if (isOpen) {
      api.get('/damaged_entry/apparatus_names/')
        .then(response => {
          const data = Array.isArray(response.data) ? response.data : response.data.results || [];
          setApparatusNames(data);
        })
        .catch(err => console.error('Error fetching apparatus names:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addApparatusRow = () => {
    setApparatusItems([...apparatusItems, { apparatus_name: '', quantity: '' }]);
  };

  const removeApparatusRow = (index) => {
    setApparatusItems(apparatusItems.filter((_, i) => i !== index));
  };

  const updateApparatusItem = (index, field, value) => {
    const updated = [...apparatusItems];
    updated[index][field] = value;
    setApparatusItems(updated);

    // Show suggestions when typing in name field
    if (field === 'apparatus_name') {
      setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: true });

      // If manually typed name matches exactly, sync available quantity
      const match = apparatusNames.find(a => a.name.toLowerCase() === value.toLowerCase());
      if (match) {
        updated[index].available_quantity = match.available_quantity;
      } else {
        delete updated[index].available_quantity;
      }
      setApparatusItems(updated);
    }
  };

  const selectApparatusSuggestion = (index, apparatus) => {
    const updated = [...apparatusItems];
    updated[index].apparatus_name = apparatus.name;
    updated[index].available_quantity = apparatus.available_quantity;
    setApparatusItems(updated);
    setShowApparatusSuggestions({ ...showApparatusSuggestions, [index]: false });
  };

  const filterSuggestions = (items, query) => {
    if (!query) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const validate = () => {
    const newErrors = {};

    // Validate staff
    if (!formData.staff.trim()) {
      newErrors.staff = 'Staff name is required';
    }

    // Validate class
    if (!formData.class_name.trim()) {
      newErrors.class_name = 'Class is required';
    }

    // Validate date
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    // Validate caused_by
    if (!formData.caused_by.trim()) {
      newErrors.caused_by = 'Caused by is required';
    }

    // Validate details
    if (!formData.details.trim()) {
      newErrors.details = 'Details are required';
    }

    // Validate at least one item
    if (apparatusItems.length === 0) {
      newErrors.items = 'At least one damaged apparatus item must be added';
    }

    // Validate apparatus items
    apparatusItems.forEach((item, index) => {
      if (!item.apparatus_name.trim()) {
        newErrors[`apparatus_name_${index}`] = 'Apparatus name is required';
      }

      const qty = parseInt(item.quantity);
      if (!item.quantity || qty <= 0) {
        newErrors[`apparatus_quantity_${index}`] = 'Quantity must be greater than 0';
      } else if (item.available_quantity !== undefined && qty > item.available_quantity) {
        newErrors[`apparatus_quantity_${index}`] = `Cannot exceed available stock (${item.available_quantity})`;
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
      staff: formData.staff,
      class_name: formData.class_name,
      date: formData.date,
      caused_by: formData.caused_by,
      details: formData.details,
      damaged_items: apparatusItems.map(item => ({
        apparatus_name: item.apparatus_name,
        quantity: parseInt(item.quantity)
      }))
    };

    console.log('Submitting payload:', payload); // Debug log

    try {
      const response = await api.post('/damaged_entry/', payload);

      console.log('Success! Created entry:', response.data);
      window.dispatchEvent(new Event('inventory-updated'));
      localStorage.setItem('inventory-updated', Date.now());
      onSuccess();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Submission error:', error);
      const errorData = error.response?.data;
      let errorMessage = 'Failed to create entry. ';

      if (errorData) {
        if (errorData.error) {
          errorMessage += errorData.error;
        } else {
          errorMessage += JSON.stringify(errorData);
        }
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }

      setErrors({ submit: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      staff: '',
      class_name: '',
      date: new Date().toISOString().split('T')[0],
      caused_by: '',
      details: '',
    });
    setApparatusItems([]);
    setErrors({});
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Damaged Entry</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Staff and Class */}
            <div className="form-row">
              <div className="form-group">
                <label>Staff *</label>
                <input
                  type="text"
                  value={formData.staff}
                  onChange={(e) => setFormData({ ...formData, staff: e.target.value })}
                  className={errors.staff ? 'error' : ''}
                  placeholder="Enter staff name"
                />
                {errors.staff && <span className="error-text">{errors.staff}</span>}
              </div>

              <div className="form-group">
                <label>Class *</label>
                <input
                  type="text"
                  value={formData.class_name}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  className={errors.class_name ? 'error' : ''}
                  placeholder="Enter class"
                />
                {errors.class_name && <span className="error-text">{errors.class_name}</span>}
              </div>
            </div>

            {/* Date and Caused By */}
            <div className="form-row">
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

              <div className="form-group">
                <label>Caused By *</label>
                <input
                  type="text"
                  value={formData.caused_by}
                  onChange={(e) => setFormData({ ...formData, caused_by: e.target.value })}
                  className={errors.caused_by ? 'error' : ''}
                  placeholder="Enter cause"
                />
                {errors.caused_by && <span className="error-text">{errors.caused_by}</span>}
              </div>
            </div>

            {/* Details */}
            <div className="form-group">
              <label>Details *</label>
              <textarea
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                className={errors.details ? 'error' : ''}
                placeholder="Enter details about the damage"
                rows="3"
              />
              {errors.details && <span className="error-text">{errors.details}</span>}
            </div>

            {errors.items && <div className="error-banner">{errors.items}</div>}

            {/* Apparatus Items */}
            <div className="items-section">
              <div className="section-header">
                <h3>Damaged Apparatus List</h3>
                <button type="button" className="add-row-btn" onClick={addApparatusRow}>
                  <FaPlus /> Add Apparatus
                </button>
              </div>

              {apparatusItems.map((item, index) => (
                <div key={index} className="item-row-damaged">
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
                    {showApparatusSuggestions[index] && (
                      <div className="suggestions-dropdown">
                        {filterSuggestions(apparatusNames, item.apparatus_name).map((app, i) => (
                          <div
                            key={i}
                            className="suggestion-item"
                            onMouseDown={() => selectApparatusSuggestion(index, app)}
                          >
                            <span>{app.name}</span>
                            <span className="available-hint">Stock: {app.available_quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {errors[`apparatus_name_${index}`] && <span className="error-text">{errors[`apparatus_name_${index}`]}</span>}
                  </div>

                  <div>
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateApparatusItem(index, 'quantity', e.target.value)}
                      className={errors[`apparatus_quantity_${index}`] ? 'error' : ''}
                    />
                    {errors[`apparatus_quantity_${index}`] && <span className="error-text">{errors[`apparatus_quantity_${index}`]}</span>}
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

export default AddDamagedEntryModal;
