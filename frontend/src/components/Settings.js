import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import '../Settings.css';

function Settings() {
    const { isStoreKeeper } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [config, setConfig] = useState({
        use_common_reorder_level: false,
        common_chemical_reorder_level: 0,
        common_apparatus_reorder_level: 0,
    });
    const [chemicals, setChemicals] = useState([]);
    const [apparatus, setApparatus] = useState([]);

    // Separate toggles for chemicals and apparatus - persist in localStorage
    const [chemicalMode, setChemicalMode] = useState(() => {
        const saved = localStorage.getItem('chemicalMode');
        return saved || 'common'; // 'common' or 'separate'
    });
    const [apparatusMode, setApparatusMode] = useState(() => {
        const saved = localStorage.getItem('apparatusMode');
        return saved || 'common'; // 'common' or 'separate'
    });

    const [editingId, setEditingId] = useState(null);
    const [tempLevel, setTempLevel] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Save mode preferences to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('chemicalMode', chemicalMode);
    }, [chemicalMode]);

    useEffect(() => {
        localStorage.setItem('apparatusMode', apparatusMode);
    }, [apparatusMode]);

    useEffect(() => {
        if (isStoreKeeper) {
            fetchInventoryData();
        }
    }, [isStoreKeeper]);

    const fetchInventoryData = async () => {
        setLoading(true);
        try {
            const [configRes, chemRes, appRes] = await Promise.all([
                api.get('/lab_configuration/'),
                api.get('/available_chemicals/'),
                api.get('/available_apparatus/'),
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

    const updateCommonChemicalLevel = async () => {
        try {
            const res = await api.patch('/lab_configuration/1/', {
                ...config,
                use_common_reorder_level: true
            });
            setConfig(res.data);
            setMessage('Common chemical reorder level updated successfully');

            // Refresh chemicals data
            const chemRes = await api.get('/available_chemicals/');
            setChemicals(chemRes.data.results || chemRes.data);
            window.dispatchEvent(new Event('inventory-updated'));
            localStorage.setItem('inventory-updated', Date.now());
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Failed to update chemical level');
        }
    };

    const updateCommonApparatusLevel = async () => {
        try {
            const res = await api.patch('/lab_configuration/1/', {
                ...config,
                use_common_reorder_level: true
            });
            setConfig(res.data);
            setMessage('Common apparatus reorder level updated successfully');

            // Refresh apparatus data
            const appRes = await api.get('/available_apparatus/');
            setApparatus(appRes.data.results || appRes.data);
            window.dispatchEvent(new Event('inventory-updated'));
            localStorage.setItem('inventory-updated', Date.now());
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Failed to update apparatus level');
        }
    };

    const handleIndividualUpdate = async (id, itemType) => {
        if (tempLevel === '' || parseFloat(tempLevel) < 0) {
            alert('Please enter a valid quantity');
            return;
        }

        try {
            const endpoint = itemType === 'chemical' ? `/available_chemicals/${id}/` : `/available_apparatus/${id}/`;
            await api.patch(endpoint, { reorder_level: tempLevel });

            // Update local state
            if (itemType === 'chemical') {
                setChemicals(chemicals.map(c => c.id === id ? { ...c, reorder_level: tempLevel } : c));
            } else {
                setApparatus(apparatus.map(a => a.id === id ? { ...a, reorder_level: tempLevel } : a));
            }
            window.dispatchEvent(new Event('inventory-updated'));
            localStorage.setItem('inventory-updated', Date.now());

            setMessage('Updated successfully');
            setEditingId(null);
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Failed to update individual level');
        }
    };

    return (
        <div className="settings-page">
            <h2>Settings</h2>
            {message && <div className="success-banner">{message}</div>}

            {/* APPEARANCE SETTINGS - Available to all users */}
            <div className="settings-section">
                <h3>Appearance</h3>
                <div className="toggle-container">
                    <div className="toggle-row">
                        <div className="toggle-info">
                            <span className="toggle-label">Dark Mode</span>
                            <span className="toggle-description">
                                {isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isDarkMode}
                                onChange={toggleTheme}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>

            {/* INVENTORY SETTINGS - Store Keeper Only */}
            {isStoreKeeper && (
                <>
                    <div className="settings-divider"></div>

                    {/* CHEMICALS SECTION */}
                    <div className="settings-section">
                        <h3>Chemicals Reorder Level Settings</h3>
                        <div className="toggle-container">
                            <div className="toggle-row">
                                <span>Common reorder level for all chemicals</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={chemicalMode === 'common'}
                                        onChange={() => setChemicalMode(chemicalMode === 'common' ? 'separate' : 'common')}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            <div className="toggle-row">
                                <span>Separate reorder level for each chemical</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={chemicalMode === 'separate'}
                                        onChange={() => setChemicalMode(chemicalMode === 'separate' ? 'common' : 'separate')}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>

                        {chemicalMode === 'common' ? (
                            <div className="common-level-box animate-fade">
                                <div className="input-group">
                                    <label>Common Chemical Reorder Level (ml)</label>
                                    <input
                                        type="number"
                                        value={config.common_chemical_reorder_level}
                                        onChange={(e) => setConfig({ ...config, common_chemical_reorder_level: e.target.value })}
                                        placeholder="e.g. 500"
                                    />
                                </div>
                                <button className="btn-save" onClick={updateCommonChemicalLevel}>
                                    Apply to All Chemicals
                                </button>
                            </div>
                        ) : (
                            <div className="items-list-container animate-fade">
                                <h4 className="subsection-title">Individual Chemical Reorder Levels</h4>
                                <table className="settings-items-table">
                                    <thead>
                                        <tr>
                                            <th>Chemical Name</th>
                                            <th>Reorder Level (ml)</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chemicals.map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.chemical_name}</td>
                                                <td>
                                                    {editingId === item.id ? (
                                                        <input
                                                            type="number"
                                                            className="inline-edit-input"
                                                            value={tempLevel}
                                                            onChange={(e) => setTempLevel(e.target.value)}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="level-display">{item.reorder_level}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingId === item.id ? (
                                                        <div className="action-btn-group">
                                                            <button
                                                                className="btn-inline-save"
                                                                onClick={() => handleIndividualUpdate(item.id, 'chemical')}
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                className="btn-inline-cancel"
                                                                onClick={() => setEditingId(null)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            className="btn-inline-edit"
                                                            onClick={() => {
                                                                setEditingId(item.id);
                                                                setTempLevel(item.reorder_level);
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* APPARATUS SECTION */}
                    <div className="settings-section">
                        <h3>Apparatus Reorder Level Settings</h3>
                        <div className="toggle-container">
                            <div className="toggle-row">
                                <span>Common reorder level for all apparatus</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={apparatusMode === 'common'}
                                        onChange={() => setApparatusMode(apparatusMode === 'common' ? 'separate' : 'common')}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            <div className="toggle-row">
                                <span>Separate reorder level for each apparatus</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={apparatusMode === 'separate'}
                                        onChange={() => setApparatusMode(apparatusMode === 'separate' ? 'common' : 'separate')}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>

                        {apparatusMode === 'common' ? (
                            <div className="common-level-box animate-fade">
                                <div className="input-group">
                                    <label>Common Apparatus Reorder Level (pieces)</label>
                                    <input
                                        type="number"
                                        value={config.common_apparatus_reorder_level}
                                        onChange={(e) => setConfig({ ...config, common_apparatus_reorder_level: e.target.value })}
                                        placeholder="e.g. 5"
                                    />
                                </div>
                                <button className="btn-save" onClick={updateCommonApparatusLevel}>
                                    Apply to All Apparatus
                                </button>
                            </div>
                        ) : (
                            <div className="items-list-container animate-fade">
                                <h4 className="subsection-title">Individual Apparatus Reorder Levels</h4>
                                <table className="settings-items-table">
                                    <thead>
                                        <tr>
                                            <th>Apparatus Name</th>
                                            <th>Reorder Level (pieces)</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {apparatus.map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.apparatus_name}</td>
                                                <td>
                                                    {editingId === item.id ? (
                                                        <input
                                                            type="number"
                                                            className="inline-edit-input"
                                                            value={tempLevel}
                                                            onChange={(e) => setTempLevel(e.target.value)}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="level-display">{item.reorder_level}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingId === item.id ? (
                                                        <div className="action-btn-group">
                                                            <button
                                                                className="btn-inline-save"
                                                                onClick={() => handleIndividualUpdate(item.id, 'apparatus')}
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                className="btn-inline-cancel"
                                                                onClick={() => setEditingId(null)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            className="btn-inline-edit"
                                                            onClick={() => {
                                                                setEditingId(item.id);
                                                                setTempLevel(item.reorder_level);
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default Settings;
