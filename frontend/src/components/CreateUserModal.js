import React, { useState } from 'react';
import api from '../utils/api';

const CreateUserModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    employee_id: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'staff',
    designation: '',
    department: '',
    is_active: true,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/users/', formData);
      onSuccess();
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') {
          setError(errorData);
        } else if (errorData.error) {
          setError(errorData.error);
        } else {
          // Handle object with field errors
          const firstEntry = Object.entries(errorData)[0];
          if (firstEntry) {
            const [field, messages] = firstEntry;
            const message = Array.isArray(messages) ? messages[0] : messages;
            setError(`${field}: ${message}`);
          } else {
            setError('Failed to create user');
          }
        }
      } else {
        setError('Failed to create user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Create New User</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Employee ID *</label>
              <input
                type="text"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="Enter employee ID"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name *</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="Enter full name"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="Enter email"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="Enter password"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter phone number"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Designation</label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter designation"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="">Select Department</option>
                <option value="B.Sc Chemistry">B.Sc Chemistry</option>
                <option value="M.Sc Chemistry">M.Sc Chemistry</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Role *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                style={styles.input}
              >
                <option value="staff">Staff</option>
                <option value="store_keeper">Store Keeper</option>
                <option value="hod">Head of Department</option>
                <option value="admin">Administrator</option>
              </select>
              <p style={{ marginTop: 6, fontSize: 12, color: '#b45309' }}>
                Only one Store Keeper and one HOD user can exist in the system. Creating another will fail if one already exists.
              </p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  style={styles.checkbox}
                />
                <span style={styles.checkboxText}>Active User</span>
              </label>
            </div>
          </div>

          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={styles.submitButton}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1000,
    paddingTop: 60,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#2c3e50',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },
  error: {
    margin: '16px 24px',
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    fontSize: '14px',
  },
  formGrid: {
    padding: '24px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#2c3e50',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    marginTop: '24px',
  },
  checkbox: {
    marginRight: '8px',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '14px',
    color: '#2c3e50',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #e0e0e0',
  },
  cancelButton: {
    padding: '10px 24px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#666',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  submitButton: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#6366f1',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
};

export default CreateUserModal;
