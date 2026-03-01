import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        full_name: user.full_name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.patch(`/users/${user.id}/`, formData);
      updateUser({ ...user, ...response.data });
      setSuccess('Profile updated successfully!');
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') {
          setError(errorData);
        } else if (errorData.error) {
          setError(errorData.error);
        } else {
          // Handle object with field errors (e.g., { email: ["..."], phone: ["..."] })
          const firstError = Object.values(errorData)[0];
          setError(Array.isArray(firstError) ? firstError[0] : 'Failed to update profile');
        }
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-sm">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FaUser className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.full_name || 'User Name'}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{getRoleDisplay(user?.role)}</p>
            </div>
          </div>
          
          <nav className="space-y-1">
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
              <FaUser className="mr-3 h-4 w-4" />
              My Profile
            </a>
            <a 
              onClick={() => navigate('/change-password')}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FaKey className="mr-3 h-4 w-4" />
              Change Password
            </a>
            <a 
              onClick={() => navigate('/settings')}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FaCog className="mr-3 h-4 w-4" />
              Settings
            </a>
          </nav>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your profile information and preferences</p>

          <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-md border border-gray-100 dark:border-gray-800">
            {/* Profile Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                  <FaUser className="text-2xl text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user?.full_name || 'User Name'}</h2>
                  <p className="text-gray-600 dark:text-gray-400">{user?.email || 'email@example.com'}</p>
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200 flex items-center gap-3">
                  <FaExclamationCircle />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employee ID</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {user?.employee_id || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {user?.full_name || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {user?.email || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {user?.department || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {getRoleDisplay(user?.role) || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {user?.phone_number || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Join Date</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                    {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : '-'}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Update Profile</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter your email address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter your phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select Department</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Physics">Physics</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Biology">Biology</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select Role</option>
                        <option value="admin">Administrator</option>
                        <option value="hod">Head of Department</option>
                        <option value="store_keeper">Store Keeper</option>
                        <option value="staff">Staff</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          full_name: user?.full_name || '',
                          email: user?.email || '',
                          phone_number: user?.phone_number || '',
                          department: user?.department || '',
                          role: user?.role || ''
                        });
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Updating...' : 'Update Profile'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
