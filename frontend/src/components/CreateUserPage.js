import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbArrowLeft } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CreateUserPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/users/', formData);
      navigate('/settings', { state: { activeSection: 'user_management' } });
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') setError(errorData);
        else if (errorData.error) setError(errorData.error);
        else {
          const firstError = Object.values(errorData)[0];
          setError(Array.isArray(firstError) ? firstError[0] : 'Failed to create user');
        }
      } else {
        setError('Failed to create user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigate('/settings', { state: { activeSection: 'user_management' } });

  return (
    <div className="min-h-[calc(100vh-var(--topbar-height,80px))] bg-[var(--bg-main)] -mx-4 md:-mx-10 -mt-10 px-6 py-6 md:px-10 md:py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleCancel}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-surface)] transition-colors"
        >
          <TbArrowLeft size={18} />
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)] m-0">Create user</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Account section */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Employee ID <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                placeholder="Enter employee ID"
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                placeholder="Enter full name"
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contact section */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter email"
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Password <span className="text-red-500">*</span></label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter password"
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Role and access section */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">Role and access</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Designation</label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                placeholder="Enter designation"
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all appearance-none"
              >
                <option value="">Select Department</option>
                <option value="B.Sc Chemistry">B.Sc Chemistry</option>
                <option value="M.Sc Chemistry">M.Sc Chemistry</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)]">Role <span className="text-red-500">*</span></label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-main)] outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all appearance-none"
              >
                <option value="staff">Staff</option>
                <option value="store_keeper">Store Keeper</option>
                <option value="hod">Head of Department</option>
                <option value="admin">Administrator</option>
              </select>
              <p className="mt-1 text-xs text-amber-700">
                Only one Store Keeper and one HOD user can exist in the system. Creating another will fail if one already exists.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-main)] mb-2">Active User</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[var(--border)] text-[#6366f1] focus:ring-[#6366f1] cursor-pointer"
                />
                <span className="text-sm text-[var(--text-main)]">Account is active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Desktop action buttons */}
        <div className="hidden md:flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2.5 border border-[var(--border)] bg-transparent text-[var(--text-main)] rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[rgba(100,116,139,0.05)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-[#6366f1] text-white rounded-lg font-semibold text-sm border-none cursor-pointer transition-all hover:bg-[#4f46e5] hover:-translate-y-px disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>

      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border)] px-4 py-3 flex gap-3 z-50">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 py-3 border border-[var(--border)] bg-transparent text-[var(--text-main)] rounded-lg font-semibold text-sm cursor-pointer transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          onClick={handleSubmit}
          className="flex-1 py-3 bg-[#6366f1] text-white rounded-lg font-semibold text-sm border-none cursor-pointer transition-all hover:bg-[#4f46e5] disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create User'}
        </button>
      </div>
    </div>
  );
};

export default CreateUserPage;
