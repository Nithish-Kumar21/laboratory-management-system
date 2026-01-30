import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AddStockRegisterModal from '../components/modals/AddStockRegisterModal';
import './StockRegister.css';

function StockRegister() {
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ordering, setOrdering] = useState('-date');
  const [openDropdown, setOpenDropdown] = useState(null); // 'invoice' | 'date' | null
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const invoiceDropdownRef = useRef(null);
  const dateDropdownRef = useRef(null);
  const invoiceButtonRef = useRef(null);
  const dateButtonRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { isAdmin, isStoreKeeper, isStaff } = useAuth();

  useEffect(() => {
    if (openDropdown === 'invoice' && invoiceButtonRef.current) {
      const rect = invoiceButtonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.left });
    } else if (openDropdown === 'date' && dateButtonRef.current) {
      const rect = dateButtonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.left });
    }
  }, [openDropdown]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const inInvoice = invoiceDropdownRef.current?.contains(e.target);
      const inDate = dateDropdownRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inInvoice && !inDate && !inMenu) setOpenDropdown(null);
    };
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  const canAddEntry = isAdmin || isStoreKeeper;

  const fetchStockEntries = () => {
    setLoading(true);
    const params = ordering ? { ordering } : {};
    api
      .get('/stock_register/', { params })
      .then((response) => {
        setStockEntries(
          Array.isArray(response.data) ? response.data : response.data.results || []
        );
        setLoading(false);
      })
      .catch((error) => {
        setError(error.response?.data?.error || error.message || 'Network response was not ok');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isStaff) {
      navigate('/');
      return;
    }
    fetchStockEntries();
  }, [isStaff, navigate, ordering]);

  const handleInvoiceSort = (value) => {
    setOrdering(value || '-date');
    setOpenDropdown(null);
  };

  const handleDateSort = (value) => {
    setOrdering(value || '-date');
    setOpenDropdown(null);
  };

  const handleRowClick = (id) => {
    navigate(`/stock-register/${id}`);
  };

  const handleModalSuccess = () => {
    fetchStockEntries();
  };

  if (loading) return <p>Loading stock register...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="stock-register-page">
      <div className="page-header">
        <h2>Stock Register</h2>
        {canAddEntry && (
          <button className="add-entry-btn" onClick={() => setIsModalOpen(true)}>
            <FaPlus /> Add New Entry
          </button>
        )}
      </div>

      <table className="minimal-table clickable-table stock-register-table">
        <thead>
          <tr>
            <th className="sort-th" ref={invoiceDropdownRef}>
              Invoice Number{' '}
              <button
                ref={invoiceButtonRef}
                type="button"
                className="sort-arrow-char"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === 'invoice' ? null : 'invoice');
                }}
                aria-label="Sort by invoice number"
                aria-expanded={openDropdown === 'invoice'}
              >
                ⌄
              </button>
            </th>
            <th className="sort-th" ref={dateDropdownRef}>
              Date of Entry{' '}
              <button
                ref={dateButtonRef}
                type="button"
                className="sort-arrow-char"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === 'date' ? null : 'date');
                }}
                aria-label="Sort by date"
                aria-expanded={openDropdown === 'date'}
              >
                ⌄
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {stockEntries.map((entry) => (
            <tr key={entry.id} onClick={() => handleRowClick(entry.id)}>
              <td>{entry.invoice_number}</td>
              <td>{entry.date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {openDropdown === 'invoice' &&
        createPortal(
          <div
            ref={menuRef}
            className="sort-dropdown-menu sort-dropdown-menu-portal"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ul>
              <li>
                <button type="button" onClick={() => handleInvoiceSort('invoice_number')}>
                  Ascending to descending
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleInvoiceSort('-invoice_number')}>
                  Descending to ascending
                </button>
              </li>
            </ul>
          </div>,
          document.body
        )}

      {openDropdown === 'date' &&
        createPortal(
          <div
            ref={menuRef}
            className="sort-dropdown-menu sort-dropdown-menu-portal"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ul>
              <li>
                <button type="button" onClick={() => handleDateSort('-date')}>
                  Latest to oldest
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleDateSort('date')}>
                  Oldest to latest
                </button>
              </li>
            </ul>
          </div>,
          document.body
        )}

      <AddStockRegisterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default StockRegister;

