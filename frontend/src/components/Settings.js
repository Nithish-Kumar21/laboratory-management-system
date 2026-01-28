import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import '../Settings.css';

function Settings() {
    const { isStoreKeeper } = useAuth();
    const navigate = useNavigate();
    const [config, setConfig] = useState({
        use_common_reorder_level: false,
        common_chemical_reorder_level: 0,
        common_apparatus_reorder_level: 0,
    });
    const [chemicals, setChemicals] = useState([]);
    const [apparatus, setApparatus] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('chemical');
    const [editingId, setEditingId] = useState(null);
    const [tempLevel, setTempLevel] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!isStoreKeeper) {
            navigate('/');
            return;
        }

        const fetchData = async () => {
            try {
                const [configRes, chemRes, appRes] = await Promise.all([
                    api.get('/lab_configuration/'),
                    api.get('/available_chemicals/'),
                    api.get('/available_apparatus/'),
                ]);

                setConfig(configRes.data);
                setChemicals(chemRes.data.results || chemRes.data);
                setApparatus(appRes.data.results || appRes.data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching settings:', err);
                setLoading(false);
            }
        };

        fetchData();
    }, [isStoreKeeper, navigate]);

    const handleToggle = async (type) => {
        const newConfig = { ...config };
        newConfig.use_common_reorder_level = (type === 'common');

        try {
            const res = await api.patch('/lab_configuration/1/', newConfig);
            setConfig(res.data);
            setMessage('Settings updated successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Failed to update settings');
        }
    };

    const updateCommonLevels = async () => {
        try {
            const res = await api.patch('/lab_configuration/1/', config);
            setConfig(res.data);
            setMessage('Common levels updated and applied to all items');
            // Refresh local data
            const [chemRes, appRes] = await Promise.all([
                api.get('/available_chemicals/'),
                api.get('/available_apparatus/'),
            ]);
            setChemicals(chemRes.data.results || chemRes.data);
            setApparatus(appRes.data.results || appRes.data);
            window.dispatchEvent(new Event('inventory-updated'));
            localStorage.setItem('inventory-updated', Date.now());
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Failed to update levels');
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

    if (loading) return <div className="settings-page">Loading...</div>;

    const currentItems = selectedCategory === 'chemical' ? chemicals : apparatus;
    const unit = selectedCategory === 'chemical' ? 'ml' : 'pieces';

    return (
        <div className="settings-page">
            <h2>Lab Inventory Settings</h2>
            {message && <div className="success-banner">{message}</div>}

            <div className="settings-section">
                <h3>Reorder Level Mode</h3>
                <div className="toggle-container">
                    <div className="toggle-row">
                        <span>Common reorder level for items</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={config.use_common_reorder_level}
                                onChange={() => handleToggle('common')}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                    <div className="toggle-row">
                        <span>Separate reorder level for items</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={!config.use_common_reorder_level}
                                onChange={() => handleToggle('separate')}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>

            {config.use_common_reorder_level ? (
                <div className="settings-section animate-fade">
                    <h3>Set Common Reorder Levels</h3>
                    <div className="common-input-grid">
                        <div className="input-group">
                            <label>Chemical (ml)</label>
                            <input
                                type="number"
                                value={config.common_chemical_reorder_level}
                                onChange={(e) => setConfig({ ...config, common_chemical_reorder_level: e.target.value })}
                                placeholder="e.g. 500"
                            />
                        </div>
                        <div className="input-group">
                            <label>Apparatus (pieces)</label>
                            <input
                                type="number"
                                value={config.common_apparatus_reorder_level}
                                onChange={(e) => setConfig({ ...config, common_apparatus_reorder_level: e.target.value })}
                                placeholder="e.g. 5"
                            />
                        </div>
                    </div>
                    <button className="btn-save" onClick={updateCommonLevels}>Apply Common Levels</button>
                </div>
            ) : (
                <div className="settings-section animate-fade">
                    <div className="section-header-flex">
                        <h3>Set Individual Reorder Levels</h3>
                        <div className="category-select-box">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="category-dropdown"
                            >
                                <option value="chemical">Chemicals</option>
                                <option value="apparatus">Apparatus</option>
                            </select>
                        </div>
                    </div>

                    <div className="items-list-container">
                        <table className="settings-items-table">
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Current Reorder Level ({unit})</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>{selectedCategory === 'chemical' ? item.chemical_name : item.apparatus_name}</td>
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
                                                        onClick={() => handleIndividualUpdate(item.id, selectedCategory)}
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
                </div>
            )}
        </div>
    );
}

export default Settings;
