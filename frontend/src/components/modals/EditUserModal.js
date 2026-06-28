import React, { useState } from 'react';
import api from '../../utils/api';
import './UserModal.css';

const EditUserModal = ({ user, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        employee_id: user.employee_id || '',
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role || 'staff',
        is_active: user.is_active,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.patch(`/users/${user.id}/`, formData);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="user-modal-container" onClick={onClose}>
            <div className="user-modal-content" onClick={(e) => e.stopPropagation()}>
                <h2 className="user-modal-title">Edit User</h2>
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
                    <div className="user-modal-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                        <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            id="is_active_checkbox"
                        />
                        <label htmlFor="is_active_checkbox" style={{ marginBottom: 0, cursor: 'pointer' }}>Account Active</label>
                    </div>
                    <div className="user-modal-actions">
                        <button type="button" onClick={onClose} className="btn-modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-modal-submit">
                            {loading ? 'Updating...' : 'Update User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;
