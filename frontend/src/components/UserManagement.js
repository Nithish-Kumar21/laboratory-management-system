import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDialog from './ConfirmDialog';
import './UserManagement.css';

const UserManagement = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialog, setDialog] = useState({ open: false, message: '', userId: null });

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users/');
      const allUsers = Array.isArray(response.data) ? response.data : response.data.results || [];
      // Filter out admin users from the list as requested
      setUsers(allUsers.filter(user => user.role !== 'admin'));
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeleteClick = (userId) => {
    setDialog({ open: true, message: 'Are you sure you want to delete this user?', userId });
  };

  const handleDeleteConfirm = async () => {
    const userId = dialog.userId;
    setDialog({ open: false, message: '', userId: null });
    try {
      await api.delete(`/users/${userId}/`);
      fetchUsers();
    } catch (err) {
      setDialog({ open: true, message: err.response?.data?.error || 'Failed to delete user', showCancel: false });
    }
  };

  const getRoleStyles = (role) => {
    switch (role) {
      case 'admin':
        return { backgroundColor: '#eff6ff', color: '#1e40af' };
      case 'hod':
        return { backgroundColor: '#fff7ed', color: '#9a3412' };
      case 'store_keeper':
        return { backgroundColor: '#f0fdf4', color: '#166534' };
      case 'staff':
        return { backgroundColor: '#fdf4ff', color: '#86198f' };
      default:
        return { backgroundColor: '#f8fafc', color: '#475569' };
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'hod': return 'Head of Department';
      case 'store_keeper': return 'Store Keeper';
      case 'staff': return 'Staff';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="user-mgmt-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#38bdf8', fontSize: '1.2rem' }}>Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-mgmt-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#ef4444', fontSize: '1.2rem' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="user-mgmt-container">
      <div className="user-mgmt-header">
        <h1>User Management</h1>
        <button className="btn-create-user" onClick={() => setShowCreateModal(true)}>
          + Create User
        </button>
      </div>

      <div className="user-table-card">
        <table className="user-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.employee_id || '-'}</td>
                <td>{user.full_name || '-'}</td>
                <td>{user.email || '-'}</td>
                <td>
                  <span className="role-badge" style={getRoleStyles(user.role)}>
                    {getRoleDisplay(user.role)}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-btns">
                    <button className="btn-edit" onClick={() => handleEdit(user)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDeleteClick(user.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUsers();
          }}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchUsers();
          }}
        />
      )}

      <ConfirmDialog
        open={dialog.open}
        message={dialog.message}
        showCancel={!!dialog.userId}
        confirmLabel={dialog.userId ? 'Delete' : 'OK'}
        cancelLabel="Cancel"
        variant={dialog.userId ? 'danger' : 'alert'}
        onConfirm={dialog.userId ? handleDeleteConfirm : () => setDialog({ open: false })}
        onCancel={() => setDialog({ open: false })}
      />
    </div>
  );
};

export default UserManagement;
