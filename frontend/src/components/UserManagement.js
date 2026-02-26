import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUserShield, FaUserPlus, FaEdit, FaTrashAlt } from 'react-icons/fa';
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
      setUsers(Array.isArray(response.data) ? response.data : response.data.results || []);
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

  const getRoleColors = (role) => {
    switch (role) {
      case 'admin':
        return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
      case 'hod':
        return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' };
      case 'store_keeper':
        return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
      case 'staff':
        return { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
      default:
        return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' };
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'hod':
        return 'Head of Department';
      case 'store_keeper':
        return 'Store Keeper';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  };

  if (loading) {
    return <div className="user-management-loading">Loading users...</div>;
  }

  if (error) {
    return <div className="user-management-error">{error}</div>;
  }

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <h1 className="user-management-title">User Management</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn-create-user">
          <FaUserPlus style={{ marginRight: '10px' }} /> Create New User
        </button>
      </div>

      <div className="user-table-container">
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
            {users.map((user) => {
              const roleColors = getRoleColors(user.role);
              return (
                <tr key={user.id}>
                  <td>{user.employee_id || '-'}</td>
                  <td>{user.full_name || '-'}</td>
                  <td>{user.email || '-'}</td>
                  <td>
                    <span
                      className="role-badge"
                      style={{
                        backgroundColor: roleColors.bg,
                        color: roleColors.color,
                        border: `1.5px solid ${roleColors.color}33`,
                      }}
                    >
                      <FaUserShield style={{ fontSize: '0.8rem' }} />
                      {getRoleDisplay(user.role)}
                    </span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: user.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: user.is_active ? '#10b981' : '#ef4444',
                        border: user.is_active ? '1.5px solid rgba(16, 185, 129, 0.3)' : '1.5px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="user-actions">
                    <button
                      onClick={() => handleEdit(user)}
                      className="btn-edit-user"
                      title="Edit User"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user.id)}
                      className="btn-delete-user"
                      title="Delete User"
                    >
                      <FaTrashAlt /> Delete
                    </button>
                  </td>
                </tr>
              );
            })}
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
