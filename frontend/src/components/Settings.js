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
    FaBoxes
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import './Settings.css';

function Settings() {
    const { isStoreKeeper } = useAuth();
    const { themeMode, setThemeMode } = useTheme();

    const [activeSection, setActiveSection] = useState('appearance');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });

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
            setConfig(configRes.data);
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
                ? { common_chemical_reorder_level: config.common_chemical_reorder_level }
                : { common_apparatus_reorder_level: config.common_apparatus_reorder_level };

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

    return (
        <div className="settings-container animate-up">
            <div className="settings-header">
                <h1 className="page-title">Settings</h1>
            </div>

            <div className="settings-content-grid">
                <div className="settings-menu card">
                    <button className={`menu-item ${activeSection === 'appearance' ? 'active' : ''}`} onClick={() => setActiveSection('appearance')}>
                        <div className="menu-item-icon"><FaPalette /></div>
                        <div className="menu-item-text"><span className="menu-label">Appearance</span></div>
                    </button>
                    {isStoreKeeper && (
                        <>
                            <button className={`menu-item ${activeSection === 'chem_levels' ? 'active' : ''}`} onClick={() => setActiveSection('chem_levels')}>
                                <div className="menu-item-icon"><FaFlask /></div>
                                <div className="menu-item-text"><span className="menu-label">Chemical Levels</span></div>
                            </button>
                            <button className={`menu-item ${activeSection === 'app_levels' ? 'active' : ''}`} onClick={() => setActiveSection('app_levels')}>
                                <div className="menu-item-icon"><FaBoxes /></div>
                                <div className="menu-item-text"><span className="menu-label">Apparatus Levels</span></div>
                            </button>
                        </>
                    )}
                </div>

                <div className="settings-panel card">
                    {message && <div className="settings-toast success animate-fade"><FaCheckCircle /> {message}</div>}

                    {activeSection === 'appearance' && (
                        <div className="panel-section animate-fade">
                            <h2 className="panel-title">Theme Preference</h2>
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
                    )}

                    {(activeSection === 'chem_levels' || activeSection === 'app_levels') && (
                        <div className="panel-section animate-fade">
                            <h2 className="panel-title">{activeSection === 'chem_levels' ? 'Chemical Reorder Levels' : 'Apparatus Reorder Levels'}</h2>

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
                    )}
                </div>
            </div>
            <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
        </div>
    );
}

export default Settings;
