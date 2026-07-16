import React, { useState, useEffect } from 'react';
import {
    FaPalette,
    FaDatabase,
    FaCheckCircle,
    FaSun,
    FaMoon,
    FaDesktop,
    FaCog,
    FaFlask,
    FaBoxes,
    FaLock,
    FaExclamationTriangle
} from 'react-icons/fa';
import { TbEye, TbEyeOff } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import './Settings.css';

function Settings() {
    const { isStoreKeeper, isAdmin } = useAuth();
    const { themeMode, setThemeMode } = useTheme();
    const navigate = useNavigate();

    const [activeSection, setActiveSection] = useState('appearance');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });

    // Change password state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    // User management state
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, message: '', userId: null });

    // Reorder level state
    const [config, setConfig] = useState({
        use_common_reorder_level: false,
        common_chemical_reorder_level: 0,
        common_apparatus_reorder_level: 0,
    });
    const [chemicals, setChemicals] = useState([]);
    const [apparatus, setApparatus] = useState([]);
    const [chemicalMode, setChemicalMode] = useState(localStorage.getItem('chemicalMode') || 'common');
    const [apparatusMode, setApparatusMode] = useState(localStorage.getItem('apparatusMode') || 'common');
    const [editingId, setEditingId] = useState(null);
    const [tempLevel, setTempLevel] = useState('');

    useEffect(() => {
        localStorage.setItem('chemicalMode', chemicalMode);
        localStorage.setItem('apparatusMode', apparatusMode);
    }, [chemicalMode, apparatusMode]);

    useEffect(() => {
        if (isStoreKeeper) {
            fetchInventoryData();
        }
    }, [isStoreKeeper]);

    const fetchInventoryData = async () => {
        setLoading(true);
        try {
            const [configRes, chemRes, appRes] = await Promise.all([
                api.get('/lab_configuration/').catch(() => ({ data: {} })),
                api.get('/available_chemicals/').catch(() => ({ data: [] })),
                api.get('/available_apparatus/').catch(() => ({ data: [] })),
            ]);
            // Coerce numeric config values at fetch time — API may return strings
            const raw = configRes.data;
            setConfig({
                ...raw,
                common_chemical_reorder_level: parseFloat(raw.common_chemical_reorder_level) || 0,
                common_apparatus_reorder_level: parseFloat(raw.common_apparatus_reorder_level) || 0,
            });
            setChemicals(chemRes.data.results || chemRes.data);
            setApparatus(appRes.data.results || appRes.data);
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateCommonLevel = async (type) => {
        setLoading(true);
        try {
            const payload = type === 'chemical'
                ? { common_chemical_reorder_level: parseFloat(config.common_chemical_reorder_level) || 0 }
                : { common_apparatus_reorder_level: parseFloat(config.common_apparatus_reorder_level) || 0 };

            await api.patch('/lab_configuration/1/', payload);
            setMessage(`Common ${type} reorder level updated!`);
            window.dispatchEvent(new Event('inventory-updated'));
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setAlertDialog({ open: true, message: 'Failed to update level' });
        } finally {
            setLoading(false);
        }
    };

    const handleIndividualUpdate = async (id, itemType) => {
        if (tempLevel === '' || parseFloat(tempLevel) < 0) return;
        try {
            const endpoint = itemType === 'chemical' ? `/available_chemicals/${id}/` : `/available_apparatus/${id}/`;
            await api.patch(endpoint, { reorder_level: tempLevel });

            if (itemType === 'chemical') {
                setChemicals(chemicals.map(c => c.id === id ? { ...c, reorder_level: tempLevel } : c));
            } else {
                setApparatus(apparatus.map(a => a.id === id ? { ...a, reorder_level: tempLevel } : a));
            }
            window.dispatchEvent(new Event('inventory-updated'));
            setEditingId(null);
            setMessage('Updated successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setAlertDialog({ open: true, message: 'Failed to update' });
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');

        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setPwError('Password must be at least 8 characters long');
            return;
        }

        setPwLoading(true);
        try {
            await api.post('/users/change-password/', {
                old_password: oldPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            setPwSuccess('Password changed successfully!');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPwSuccess(''), 3000);
        } catch (err) {
            const errorData = err.response?.data;
            if (errorData) {
                if (typeof errorData === 'string') setPwError(errorData);
                else if (errorData.error) setPwError(errorData.error);
                else if (errorData.old_password) setPwError(`Old Password: ${errorData.old_password[0]}`);
                else if (errorData.new_password) setPwError(`New Password: ${errorData.new_password[0]}`);
                else setPwError('Failed to change password. Please check your entries.');
            } else {
                setPwError('Network error. Please try again.');
            }
        } finally {
            setPwLoading(false);
        }
    };

    const resetPasswordForm = () => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwError('');
        setPwSuccess('');
    };

    // User management
    const fetchUsers = async () => {
        setUsersLoading(true);
        setUsersError('');
        try {
            const response = await api.get('/users/');
            const allUsers = Array.isArray(response.data) ? response.data : response.data.results || [];
            setUsers(allUsers.filter(user => user.role !== 'admin'));
        } catch (err) {
            setUsersError('Failed to load users');
            console.error(err);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin && activeSection === 'user_management') {
            fetchUsers();
        }
    }, [isAdmin, activeSection]);

    const getRoleStyles = (role) => {
        switch (role) {
            case 'admin': return { backgroundColor: '#eff6ff', color: '#1e40af' };
            case 'hod': return { backgroundColor: '#fff7ed', color: '#9a3412' };
            case 'store_keeper': return { backgroundColor: '#f0fdf4', color: '#166534' };
            case 'staff': return { backgroundColor: '#fdf4ff', color: '#86198f' };
            default: return { backgroundColor: '#f8fafc', color: '#475569' };
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

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setShowEditModal(true);
    };

    const handleDeleteClick = (userId) => {
        setDeleteDialog({ open: true, message: 'Are you sure you want to delete this user?', userId });
    };

    const handleDeleteConfirm = async () => {
        const userId = deleteDialog.userId;
        setDeleteDialog({ open: false, message: '', userId: null });
        try {
            await api.delete(`/users/${userId}/`);
            fetchUsers();
        } catch (err) {
            setDeleteDialog({ open: true, message: err.response?.data?.error || 'Failed to delete user', showCancel: false });
        }
    };

    return (
        <div className="settings-container animate-up">
            <div className="settings-header">
                <h1 className="page-title">Settings</h1>
            </div>

            <div className="settings-tabs overflow-x-auto md:overflow-visible flex-nowrap -webkit-overflow-scrolling-touch pb-px">
                <button className={`settings-tab ${activeSection === 'appearance' ? 'active' : ''}`} onClick={() => setActiveSection('appearance')}>
                    Appearance
                </button>
                <button className={`settings-tab ${activeSection === 'security' ? 'active' : ''}`} onClick={() => setActiveSection('security')}>
                    Security
                </button>
                {isAdmin && (
                    <button className={`settings-tab ${activeSection === 'user_management' ? 'active' : ''}`} onClick={() => setActiveSection('user_management')}>
                        User Management
                    </button>
                )}
                {isStoreKeeper && (
                    <>
                        <button className={`settings-tab ${activeSection === 'chem_levels' ? 'active' : ''}`} onClick={() => setActiveSection('chem_levels')}>
                            Chemical Levels
                        </button>
                        <button className={`settings-tab ${activeSection === 'app_levels' ? 'active' : ''}`} onClick={() => setActiveSection('app_levels')}>
                            Apparatus Levels
                        </button>
                    </>
                )}
            </div>

            <div className="settings-panel">
                {message && <div className="settings-toast success animate-fade"><FaCheckCircle /> {message}</div>}

                {activeSection === 'appearance' && (
                    <div className="space-y-6">
                        {/* Appearance */}
                        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                            <div className="px-6 py-5 border-b border-[var(--border)]">
                                <h2 className="text-lg font-bold text-[var(--text-main)] m-0">Theme Preference</h2>
                            </div>
                            <div className="p-6">
                                <div className="theme-selector-grid">
                                    {['light', 'dark', 'system'].map(mode => (
                                        <div key={mode} className={`theme-card ${themeMode === mode ? 'active' : ''}`} onClick={() => setThemeMode(mode)}>
                                            <div className={`theme-preview ${mode === 'system' ? 'system' : mode}`}>
                                                {mode === 'system' && <><div className="preview-half light" /><div className="preview-half dark" /></>}
                                            </div>
                                            <span className="theme-label">
                                                {mode === 'light' && <FaSun />}
                                                {mode === 'dark' && <FaMoon />}
                                                {mode === 'system' && <FaDesktop />}
                                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* About / Help */}
                        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                            <div className="px-6 py-5 border-b border-[var(--border)]">
                                <h2 className="text-lg font-bold text-[var(--text-main)] m-0">About / Help</h2>
                            </div>
                            <div className="p-6">
                                <p className="text-[var(--text-muted)] m-0">Will update soon.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'security' && (
                    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                        <div className="px-6 py-5 border-b border-[var(--border)]">
                            <h2 className="text-lg font-bold text-[var(--text-main)] m-0">Security</h2>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handlePasswordChange}>
                                {pwError && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium flex items-center gap-2">
                                        <FaExclamationTriangle /> {pwError}
                                    </div>
                                )}
                                {pwSuccess && (
                                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium flex items-center gap-2">
                                        <FaCheckCircle /> {pwSuccess}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Current Password</label>
                                        <div className="relative">
                                            <input
                                                type={showOld ? 'text' : 'password'}
                                                value={oldPassword}
                                                onChange={(e) => setOldPassword(e.target.value)}
                                                required
                                                placeholder="Enter current password"
                                                disabled={pwLoading}
                                                className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-[var(--text-main)] text-sm outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.1)] transition-all"
                                            />
                                            <button type="button" onClick={() => setShowOld(!showOld)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0">
                                                {showOld ? <TbEyeOff size={18} /> : <TbEye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-main)] mb-2">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showNew ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                required
                                                placeholder="At least 8 characters"
                                                disabled={pwLoading}
                                                minLength={8}
                                                className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-[var(--text-main)] text-sm outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.1)] transition-all"
                                            />
                                            <button type="button" onClick={() => setShowNew(!showNew)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0">
                                                {showNew ? <TbEyeOff size={18} /> : <TbEye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                                placeholder="Repeat new password"
                                                disabled={pwLoading}
                                                minLength={8}
                                                className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-[var(--text-main)] text-sm outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.1)] transition-all"
                                            />
                                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0">
                                                {showConfirm ? <TbEyeOff size={18} /> : <TbEye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button type="submit" disabled={pwLoading} className="bg-[#6366f1] text-white px-7 py-3 rounded-lg font-semibold border-none cursor-pointer transition-all hover:bg-[#4f46e5] hover:-translate-y-px disabled:opacity-50">
                                        {pwLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                    <button type="button" onClick={resetPasswordForm} className="px-7 py-3 border border-[var(--border)] bg-transparent text-[var(--text-main)] rounded-lg font-semibold cursor-pointer transition-all hover:bg-[rgba(100,116,139,0.05)]">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {activeSection === 'user_management' && isAdmin && (
                    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                        <div className="px-5 py-4 md:px-6 md:py-5 border-b border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                            <h2 className="text-base md:text-lg font-bold text-[var(--text-main)] m-0">User Management</h2>
                            <button onClick={() => setShowCreateModal(true)} className="bg-[#1A3C6E] text-white px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:bg-[#15315a] transition-all w-full md:w-auto text-center">
                                + Create User
                            </button>
                        </div>
                        <div className="p-4 md:p-6">
                            {usersLoading ? (
                                <div className="text-center py-8 text-sm text-[var(--text-muted)]">Loading users...</div>
                            ) : usersError ? (
                                <div className="text-center py-8 text-sm text-red-500">{usersError}</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-[var(--border)]">
                                                <th className="text-left px-2 md:px-4 py-2 md:py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Employee ID</th>
                                                <th className="text-left px-2 md:px-4 py-2 md:py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Name</th>
                                                <th className="text-left px-2 md:px-4 py-2 md:py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Email</th>
                                                <th className="text-left px-2 md:px-4 py-2 md:py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Role</th>
                                                <th className="text-left px-2 md:px-4 py-2 md:py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Status</th>
                                                <th className="text-left px-2 md:px-4 py-2 md:py-3 text-xs font-bold text-[#fff] bg-[#1A3C6E] uppercase tracking-wider whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.length === 0 ? (
                                                <tr><td colSpan={6} className="text-center py-8 text-sm text-[var(--text-muted)]">No users found.</td></tr>
                                            ) : users.map((user) => (
                                                <tr key={user.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-main)] transition-colors">
                                                    <td className="px-2 md:px-4 py-2 md:py-3 text-sm text-[var(--text-main)] whitespace-nowrap">{user.employee_id || '-'}</td>
                                                    <td className="px-2 md:px-4 py-2 md:py-3 text-sm text-[var(--text-main)] font-medium whitespace-nowrap">{user.full_name || '-'}</td>
                                                    <td className="px-2 md:px-4 py-2 md:py-3 text-sm text-[var(--text-muted)] hidden md:table-cell">{user.email || '-'}</td>
                                                    <td className="px-2 md:px-4 py-2 md:py-3 whitespace-nowrap">
                                                        <span className="inline-flex px-2 md:px-3 py-1 rounded-full text-xs font-bold" style={getRoleStyles(user.role)}>
                                                            {getRoleDisplay(user.role)}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 md:px-4 py-2 md:py-3 whitespace-nowrap">
                                                        <span className={`inline-flex px-2 md:px-3 py-1 rounded-full text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {user.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 md:px-4 py-2 md:py-3">
                                                        <div className="flex gap-1.5 md:gap-2">
                                                            <button onClick={() => handleEditUser(user)} className="px-2 md:px-3 py-1 md:py-1.5 text-xs font-semibold rounded-md border border-[var(--border)] bg-transparent text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-main)] transition-colors whitespace-nowrap">
                                                                Edit
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(user.id)} className="px-2 md:px-3 py-1 md:py-1.5 text-xs font-semibold rounded-md border border-red-200 bg-transparent text-red-600 cursor-pointer hover:bg-red-50 transition-colors whitespace-nowrap">
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {(activeSection === 'chem_levels' || activeSection === 'app_levels') && (
                    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                        <div className="px-6 py-5 border-b border-[var(--border)]">
                            <h2 className="text-lg font-bold text-[var(--text-main)] m-0">{activeSection === 'chem_levels' ? 'Chemical Reorder Levels' : 'Apparatus Reorder Levels'}</h2>
                        </div>
                        <div className="p-6">

                        <div className="mode-toggle-box">
                            <button className={`toggle-btn ${(activeSection === 'chem_levels' ? chemicalMode : apparatusMode) === 'common' ? 'active' : ''}`}
                                onClick={() => activeSection === 'chem_levels' ? setChemicalMode('common') : setApparatusMode('common')}>Common Level</button>
                            <button className={`toggle-btn ${(activeSection === 'chem_levels' ? chemicalMode : apparatusMode) === 'separate' ? 'active' : ''}`}
                                onClick={() => activeSection === 'chem_levels' ? setChemicalMode('separate') : setApparatusMode('separate')}>Individual Levels</button>
                        </div>

                        {((activeSection === 'chem_levels' ? chemicalMode : apparatusMode) === 'common') ? (
                            <div className="common-input-area">
                                <div className="input-group">
                                    <label>Minimum Stock Level ({activeSection === 'chem_levels' ? 'mL/g' : 'units'})</label>
                                    <input
                                        type="number"
                                        value={activeSection === 'chem_levels' ? config.common_chemical_reorder_level : config.common_apparatus_reorder_level}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            [activeSection === 'chem_levels' ? 'common_chemical_reorder_level' : 'common_apparatus_reorder_level']: e.target.value
                                        })}
                                    />
                                </div>
                                <button className="btn-primary-save" onClick={() => updateCommonLevel(activeSection === 'chem_levels' ? 'chemical' : 'apparatus')}>
                                    Apply to All
                                </button>
                            </div>
                        ) : (
                            <div className="individual-list">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Alert at Level</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(activeSection === 'chem_levels' ? chemicals : apparatus).map(item => (
                                            <tr key={item.id}>
                                                <td>{item.chemical_name || item.apparatus_name}</td>
                                                <td>
                                                    {editingId === item.id ? (
                                                        <input type="number" className="inline-edit-input" value={tempLevel} onChange={(e) => setTempLevel(e.target.value)} autoFocus />
                                                    ) : item.reorder_level}
                                                </td>
                                                <td>
                                                    {editingId === item.id ? (
                                                        <div className="action-btn-group">
                                                            <button className="btn-save-sm" onClick={() => handleIndividualUpdate(item.id, activeSection === 'chem_levels' ? 'chemical' : 'apparatus')}>Save</button>
                                                            <button className="btn-cancel-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <button className="btn-edit-sm" onClick={() => { setEditingId(item.id); setTempLevel(item.reorder_level); }}>Edit</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        </div>
                    </div>
                )}
            </div>
            <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />

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
                open={deleteDialog.open}
                message={deleteDialog.message}
                showCancel={!!deleteDialog.userId}
                confirmLabel={deleteDialog.userId ? 'Delete' : 'OK'}
                cancelLabel="Cancel"
                variant={deleteDialog.userId ? 'danger' : 'alert'}
                onConfirm={deleteDialog.userId ? handleDeleteConfirm : () => setDeleteDialog({ open: false })}
                onCancel={() => setDeleteDialog({ open: false })}
            />
        </div>
    );
}

export default Settings;
