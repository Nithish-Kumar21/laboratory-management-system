import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import api from '../utils/api';
import './LowStockToast.css';

function LowStockToast() {
    const [show, setShow] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);

    const checkLowStock = async () => {
        try {
            const [chemRes, appRes] = await Promise.all([
                api.get('/low_stock_chemicals/'),
                api.get('/low_stock_apparatus/')
            ]);

            const chemData = Array.isArray(chemRes.data) ? chemRes.data : chemRes.data.results || [];
            const appData = Array.isArray(appRes.data) ? appRes.data : appRes.data.results || [];
            const total = chemData.length + appData.length;

            if (total > 0 && total !== lowStockCount) {
                setLowStockCount(total);
                setShow(true);
                // Auto hide after 5 seconds
                setTimeout(() => setShow(false), 5000);
            } else if (total === 0) {
                setLowStockCount(0);
                setShow(false);
            }
        } catch (err) {
            console.error('Error checking low stock:', err);
        }
    };

    useEffect(() => {
        // Initial check
        checkLowStock();

        // Listen for custom "inventory-updated" event (same tab)
        const handleUpdate = () => checkLowStock();
        window.addEventListener('inventory-updated', handleUpdate);

        // Listen for storage events (different tabs/roles)
        const handleStorage = (e) => {
            if (e.key === 'inventory-updated') {
                checkLowStock();
            }
        };
        window.addEventListener('storage', handleStorage);

        // Faster polling fallback (every 3 seconds) for real-time feel
        const interval = setInterval(checkLowStock, 3000);

        return () => {
            window.removeEventListener('inventory-updated', handleUpdate);
            window.removeEventListener('storage', handleStorage);
            clearInterval(interval);
        };
    }, [lowStockCount]);

    if (!show) return null;

    return (
        <div className="low-stock-toast animate-slide-in">
            <div className="toast-icon">
                <FaExclamationTriangle />
            </div>
            <div className="toast-message">
                <strong>Low Stock Warning</strong>
                <p>{lowStockCount} item(s) are below reorder level!</p>
            </div>
            <button className="toast-close" onClick={() => setShow(false)}>
                <FaTimes />
            </button>
        </div>
    );
}

export default LowStockToast;
