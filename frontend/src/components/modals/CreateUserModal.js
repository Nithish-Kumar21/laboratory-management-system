import React, { useState } from 'react';
import api from '../../utils/api';
import './UserModal.css';

const CreateUserModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        employee_id: '',
        full_name: '',
        email: '',
        password: '',
        role: 'staff',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/users/', formData);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="user-modal-container" onClick={onClose}>
            <div className="user-modal-content" onClick={(e) => e.stopPropagation()}>
                <h2 className="user-modal-title">Create New User</h2>
                {error && <div className="user-modal-error">{error}</div>}
                <form onSubmit={handleSubmit} className="user-modal-form">
                    <div className="user-modal-group">
                        <label>Employee ID</label>
                        <input
                            type="text"
                            value={formData.employee_id}
                            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                            className="user-modal-input"
                            required
                            placeholder="e.g. STF123"
                        />
                    </div>
                    <div className="user-modal-group">
                        <label>Full Name</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="user-modal-input"
                            required
                            placeholder="Enter full name"
                        />
                    </div>
                    <div className="user-modal-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="user-modal-input"
                            required
                            placeholder="email@example.com"
                        />
                    </div>
                    <div className="user-modal-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="user-modal-input"
                            required
                            placeholder="Minimum 6 characters"
                        />
                    </div>
                    <div className="user-modal-group">
                        <label>Role</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="user-modal-input"
                        >
                            <option value="staff">Staff</option>
                            <option value="hod">Head of Department</option>
                            <option value="store_keeper">Store Keeper</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                    <div className="user-modal-actions">
                        <button type="button" onClick={onClose} className="btn-modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-modal-submit">
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
