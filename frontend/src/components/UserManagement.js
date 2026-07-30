import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbPencil, TbTrash, TbPlus } from 'react-icons/tb';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import './Settings.css';

const UserManagement = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState({ open: false, message: '', userId: null });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users/');
      const allUsers = Array.isArray(response.data) ? response.data : response.data.results || [];
      setUsers(allUsers.filter(user => user.role !== 'admin'));
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate, fetchUsers]);

  useEffect(() => {
    if (!isAdmin) return;
    const handleFocus = () => fetchUsers();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAdmin, fetchUsers]);

  useEffect(() => {
    if (!isAdmin || location.pathname !== '/users') return;
    fetchUsers();
  }, [isAdmin, location.pathname, fetchUsers]);

  const handleEdit = (user) => {
    navigate(`/users/edit/${user.employee_id}`);
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="text-[var(--text-muted)] text-sm">Loading users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="text-red-500 text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--text-main)]">User Management</h1>
        <button onClick={() => navigate('/users/create')} className="settings-create-btn">
          <span className="hidden md:inline">+ Create User</span>
          <span className="md:hidden"><TbPlus size={20} /></span>
        </button>
      </div>
      <div className="border-b border-[var(--border)]" />

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Employee ID</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Name</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Email</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Role</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-[var(--text-muted)]">No users found.</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-main)] transition-colors">
                <td className="px-4 py-3 text-sm text-[var(--text-main)] whitespace-nowrap">{user.employee_id || '-'}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-main)] font-medium whitespace-nowrap">{user.full_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{user.email || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={getRoleStyles(user.role)}>
                    {getRoleDisplay(user.role)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(user)} className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--border)] bg-transparent text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-main)] transition-colors whitespace-nowrap">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteClick(user.id)} className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-200 bg-transparent text-red-600 cursor-pointer hover:bg-red-50 transition-colors whitespace-nowrap">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile compact list */}
      <div className="md:hidden">
        {users.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">No users found.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {users.map((user) => {
              const initials = (user.full_name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={user.id} className="settings-user-row">
                  <div className="settings-user-avatar">{initials}</div>
                  <div className="settings-user-info">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-[var(--text-main)]">{user.full_name || '-'}</span>
                      <span className="settings-user-role-pill" style={getRoleStyles(user.role)}>
                        {getRoleDisplay(user.role)}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] truncate block max-w-full">{user.email || '-'}</span>
                  </div>
                  <div className="settings-user-actions">
                    <button onClick={() => handleEdit(user)} className="settings-action-icon" title="Edit">
                      <TbPencil size={16} />
                    </button>
                    <button onClick={() => handleDeleteClick(user.id)} className="settings-action-icon settings-action-danger" title="Delete">
                      <TbTrash size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
