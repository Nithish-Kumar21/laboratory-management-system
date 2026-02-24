import React, { useEffect, useState, useRef } from 'react';
import { FaPlusCircle, FaTimes, FaTrashAlt, FaExclamationTriangle, FaUserTie, FaGraduationCap, FaCalendarAlt, FaTools } from 'react-icons/fa';
import api from '../../utils/api';
import ConfirmDialog from '../ConfirmDialog';
import './AddDamagedEntryModal.css';

function AddDamagedEntryModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        staff: '',
        class_name: '',
        date: new Date().toISOString().split('T')[0],
        details: '',
    });

    const [damagedItems, setDamagedItems] = useState([{ apparatus_name: '', quantity: '', caused_by: '' }]);
    const [apparatusNames, setApparatusNames] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ open: false, message: '' });
    const [showSuggestions, setShowSuggestions] = useState({});
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const modalRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
            api.get('available_apparatus/names/')
                .then(res => setApparatusNames(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error(err));
        }
    }, [isOpen]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                });
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    const onMouseDown = (e) => {
        if (e.target.closest('.modal-close')) return;
        if (e.target.closest('.modal-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            setTimeout(() => {
                scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }, 50);
        }
    };

    const addRow = () => {
        setDamagedItems([...damagedItems, { apparatus_name: '', quantity: '', caused_by: '' }]);
        scrollToBottom();
    };

    const handleKeyDown = (e) => {
        const { key, target } = e;
        const rowIdx = Object.keys(showSuggestions).find(idx => showSuggestions[idx]);

        if (rowIdx !== undefined) {
            const query = damagedItems[rowIdx].apparatus_name;
            const options = apparatusNames.filter(n => n.toLowerCase().includes(query.toLowerCase()));

            if (key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, options.length - 1)); return; }
            if (key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); return; }
            if (key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                selectApparatus(rowIdx, options[activeIndex]);
                return;
            }
            if (key === 'Escape' || key === 'Tab') { setShowSuggestions({}); return; }
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
            if (!modalRef.current) return;
            const inputs = Array.from(modalRef.current.querySelectorAll('input, select, textarea'));
            const index = inputs.indexOf(target);
            if (index === -1) return;

            const focusNext = (nextIdx) => {
                if (inputs[nextIdx]) {
                    e.preventDefault();
                    inputs[nextIdx].focus();
                    if (inputs[nextIdx].type !== 'number' && inputs[nextIdx].select) inputs[nextIdx].select();
                }
            };

            const gridStart = 3; // Staff, Class, Date are indices 0-2
            const perRow = 3; // Apparatus, Quantity, Caused By

            if (key === 'ArrowDown' || (key === 'Enter' && target.tagName !== 'TEXTAREA')) {
                // If in header, move 1 by 1. Once in grid, move by perRow.
                focusNext(index < gridStart ? index + 1 : index + perRow);
            } else if (key === 'ArrowUp') {
                // If at the first row of grid or above, move 1 by 1.
                focusNext(index <= gridStart ? index - 1 : index - perRow);
            } else if (key === 'ArrowRight') {
                let canMove = target.type !== 'text';
                if (!canMove) try { canMove = target.selectionEnd === target.value.length; } catch (e) { canMove = true; }
                if (canMove) focusNext(index + 1);
            } else if (key === 'ArrowLeft') {
                let canMove = target.type !== 'text';
                if (!canMove) try { canMove = target.selectionStart === 0; } catch (e) { canMove = true; }
                if (canMove) focusNext(index - 1);
            }
        }
    };

    const selectApparatus = (i, n) => {
        const next = [...damagedItems];
        next[i].apparatus_name = n;
        setDamagedItems(next);
        setShowSuggestions({});
        setActiveIndex(-1);
        // Auto-focus next field (Caused By)
        setTimeout(() => {
            if (modalRef.current) {
                const inputs = modalRef.current.querySelectorAll('input');
                const apparatusInputs = Array.from(inputs).filter(input => input.placeholder.includes('Search apparatus'));
                const currentIndex = apparatusInputs.findIndex(input => input === document.activeElement);
                if (currentIndex !== -1 && currentIndex < apparatusInputs.length - 1) {
                    apparatusInputs[currentIndex + 1].focus();
                }
            }
        }, 10);
    };

    const calculateDropdownPosition = (event) => {
        const rect = event.target.getBoundingClientRect();
        setDropdownPosition({
            top: rect.bottom,
            left: rect.left
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                damaged_items: damagedItems.filter(it => it.apparatus_name).map(it => ({
                    apparatus_name: it.apparatus_name,
                    quantity: parseInt(it.quantity),
                    caused_by: it.caused_by
                }))
            };
            await api.post('damaged_entry/', payload);
            window.dispatchEvent(new Event('inventory-updated'));
            onSuccess();
            onClose();
            setFormData({ staff: '', class_name: '', date: new Date().toISOString().split('T')[0], details: '' });
            setDamagedItems([{ apparatus_name: '', quantity: '', caused_by: '' }]);
        } catch (err) {
            setAlertDialog({ open: true, message: 'Error: ' + (err.response?.data?.error || 'Failed to submit report') });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content flexible animate-up"
                onClick={e => e.stopPropagation()}
                ref={modalRef}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
                <div className="modal-header danger-theme" onMouseDown={onMouseDown}>
                    <h2><FaExclamationTriangle /> Report Damaged Material</h2>
                    <button className="modal-close" onClick={onClose}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body" ref={scrollRef}>
                        <div className="form-grid-three">
                            <div className="form-group">
                                <label><FaUserTie /> Responsible Staff</label>
                                <input type="text" value={formData.staff} required placeholder="Name of staff"
                                    onChange={e => setFormData({ ...formData, staff: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label><FaGraduationCap /> Class / Division</label>
                                <input type="text" value={formData.class_name} required placeholder="e.g. 10th A"
                                    onChange={e => setFormData({ ...formData, class_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label><FaCalendarAlt /> Date of Incident</label>
                                <input type="date" value={formData.date} required
                                    onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                        </div>

                        <div className="damaged-list-section mt-30">
                            <div className="section-header">
                                <h3><FaTools /> Damaged Items List</h3>
                                <button type="button" className="btn-add-line" onClick={addRow}>
                                    <FaPlusCircle /> Add Line
                                </button>
                            </div>

                            <div className="damaged-grid-header">
                                <span><FaTools /> Apparatus Name</span>
                                <span>Quantity Broken</span>
                                <span>Caused By</span>
                                <span>Action</span>
                            </div>

                            {damagedItems.map((it, i) => (
                                <div key={i} className="damaged-row animate-fade">
                                    <div className="autocomplete-wrapper">
                                        <input type="text" className="grid-input" placeholder="Search apparatus..." value={it.apparatus_name} required autoComplete="off"
                                            onChange={e => {
                                                const next = [...damagedItems]; next[i].apparatus_name = e.target.value; setDamagedItems(next);
                                                setShowSuggestions({ [i]: true }); setActiveIndex(-1);
                                                calculateDropdownPosition(e);
                                            }}
                                            onFocus={e => {
                                                setShowSuggestions({ [i]: true });
                                                setActiveIndex(-1);
                                                calculateDropdownPosition(e);
                                            }}
                                            onBlur={() => setTimeout(() => setShowSuggestions({}), 250)} />
                                        {showSuggestions[i] && it.apparatus_name && (
                                            <div className="suggestions-dropdown" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
                                                {apparatusNames.filter(n => n.toLowerCase().includes(it.apparatus_name.toLowerCase())).map((n, idx) => (
                                                    <div key={idx} className={`suggestion-item ${activeIndex === idx ? 'active' : ''}`}
                                                        onMouseDown={() => selectApparatus(i, n)}>{n}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input type="number" className="grid-input" placeholder="Qty" value={it.quantity} required
                                        onChange={e => { const next = [...damagedItems]; next[i].quantity = e.target.value; setDamagedItems(next); }} />
                                    <input type="text" className="grid-input" placeholder="Caused by..." value={it.caused_by} required
                                        onChange={e => { const next = [...damagedItems]; next[i].caused_by = e.target.value; setDamagedItems(next); }} />
                                    <button type="button" className="btn-row-del" onClick={() => setDamagedItems(damagedItems.filter((_, idx) => idx !== i))} title="Remove item"><FaTrashAlt /></button>
                                </div>
                            ))}
                        </div>

                        <div className="form-group full-width mt-30">
                            <label>Incident Details / Observations</label>
                            <textarea rows="3" value={formData.details} required placeholder="Describe how it happened in detail..."
                                onChange={e => setFormData({ ...formData, details: e.target.value })} />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-cancel" onClick={onClose}>Discard</button>
                        <button type="submit" className="btn-submit danger-btn" disabled={submitting}>
                            {submitting ? 'Recording...' : 'File Damage Report'}
                        </button>
                    </div>
                </form>
            </div>
            <ConfirmDialog open={alertDialog.open} message={alertDialog.message} showCancel={false} confirmLabel="OK" onConfirm={() => setAlertDialog({ open: false })} />
        </div>
    );
}

export default AddDamagedEntryModal;
