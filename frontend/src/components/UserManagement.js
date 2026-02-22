import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDialog from './ConfirmDialog';

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

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return { bg: '#e3f2fd', color: '#1976d2' };
      case 'hod':
        return { bg: '#fff3e0', color: '#f57c00' };
      case 'store_keeper':
        return { bg: '#e8f5e9', color: '#388e3c' };
      case 'staff':
        return { bg: '#f3e5f5', color: '#7b1fa2' };
      default:
        return { bg: '#f3e5f5', color: '#7b1fa2' };
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
    return <div style={styles.loading}>Loading users...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>User Management</h1>
        <button onClick={() => setShowCreateModal(true)} style={styles.createButton}>
          + Create User
        </button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleColor = getRoleBadgeColor(user.role);
              return (
                <tr key={user.id} style={styles.tr}>
                  <td style={styles.td}>{user.employee_id || '-'}</td>
                  <td style={styles.td}>{user.full_name || '-'}</td>
                  <td style={styles.td}>{user.email || '-'}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.roleBadge,
                        backgroundColor: roleColor.bg,
                        color: roleColor.color,
                      }}
                    >
                      {getRoleDisplay(user.role)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: user.is_active ? '#e8f5e9' : '#ffebee',
                        color: user.is_active ? '#2e7d32' : '#c62828',
                      }}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleEdit(user)}
                      style={styles.editButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user.id)}
                      style={styles.deleteButton}
                    >
                      Delete
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

const styles = {
  container: {
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#2c3e50',
    margin: 0,
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    fontSize: '16px',
    color: '#666',
  },
  error: {
    padding: '40px',
    textAlign: 'center',
    fontSize: '16px',
    color: '#c33',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: '14px',
    borderBottom: '2px solid #e0e0e0',
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#2c3e50',
  },
  roleBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    display: 'inline-block',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    display: 'inline-block',
  },
  editButton: {
    padding: '6px 16px',
    backgroundColor: '#fff',
    color: '#6366f1',
    border: '1px solid #6366f1',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    marginRight: '8px',
  },
  deleteButton: {
    padding: '6px 16px',
    backgroundColor: '#fff',
    color: '#dc2626',
    border: '1px solid #dc2626',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default UserManagement;
