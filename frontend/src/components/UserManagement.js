import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUserShield, FaUserPlus, FaEdit, FaTrashAlt } from 'react-icons/fa';
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
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400 text-lg">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-md border border-gray-200 dark:border-gray-800">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <FaUserPlus className="mr-2 h-4 w-4" /> 
                Create New User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#0f172a] divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => {
                  const roleColors = getRoleColors(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.employee_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                          style={{
                            backgroundColor: roleColors.bg,
                            color: roleColors.color,
                            borderColor: roleColors.color + '33',
                          }}
                        >
                          <FaUserShield className="mr-1 h-3 w-3" />
                          {getRoleDisplay(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' 
                              : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium text-xs"
                            title="Edit User"
                          >
                            <FaEdit className="mr-1 h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(user.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-red-600 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-xs"
                            title="Delete User"
                          >
                            <FaTrashAlt className="mr-1 h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
