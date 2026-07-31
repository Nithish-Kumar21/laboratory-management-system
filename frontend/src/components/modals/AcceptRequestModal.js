import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../utils/api';
import './AcceptRequestModal.css';

function fmtQty(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '';
  return String(n);
}

function AcceptRequestModal({ request, onClose, onAccepted }) {
  const [quantities, setQuantities] = useState({});
  const [available, setAvailable] = useState({});
  const [hodRemarks, setHodRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!request) return;
    const initial = {};
    (request.chemical_items || []).forEach((it) => { initial[it.id] = it.quantity; });
    setQuantities(initial);
    setHodRemarks('');
    setError('');
    api.get('/available_chemicals/')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const map = {};
        data.forEach((c) => { map[String(c.chemical_name || '').toLowerCase()] = c; });
        setAvailable(map);
      })
      .catch((err) => console.error('Error fetching available chemicals:', err));
  }, [request]);

  if (!request) return null;

  const items = request.chemical_items || [];
  const availFor = (item) => available[String(item.chemical_name || '').toLowerCase()];

  const rowError = (item, val) => {
    if (val === '' || val === null || val === undefined) return 'Quantity is required.';
    const n = parseFloat(val);
    if (Number.isNaN(n) || n <= 0) return 'Enter a quantity greater than 0.';
    const a = availFor(item);
    if (a && n > parseFloat(a.quantity)) {
      return `Exceeds available stock (${fmtQty(a.quantity)} ${a.unit || item.unit}).`;
    }
    return '';
  };

  const hasChanges = items.some(
    (it) => parseFloat(quantities[it.id]) !== parseFloat(it.quantity)
  );

  const handleSubmit = () => {
    let firstError = '';
    const payload = items.map((it) => {
      const msg = rowError(it, quantities[it.id]);
      if (msg && !firstError) firstError = msg;
      return { chemical_item_id: it.id, quantity_ml: parseFloat(quantities[it.id]) };
    });
    if (firstError) {
      setError(firstError);
      return;
    }
    setError('');
    setSubmitting(true);
    api.post(`stock_request/${request.id}/accept/`, {
      chemical_items: payload,
      hod_remarks: hodRemarks.trim() || undefined,
    })
      .then(() => onAccepted({ adjusted: hasChanges }))
      .catch((err) => setError(err.response?.data?.error || 'Failed to approve request.'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="accept-overlay" onClick={onClose}>
      <div className="accept-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title-box">
            <FaCheckCircle className="header-icon accept-header-icon" />
            <h2>Approve Request</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <p className="accept-subtitle">
            Quantities are pre-filled from the staff request. Adjust any item, then confirm. Values above available stock are blocked.
          </p>

          {error && <div className="error-banner">{error}</div>}

          <div className="accept-items">
            {items.map((item) => {
              const err = rowError(item, quantities[item.id]);
              const a = availFor(item);
              return (
                <div key={item.id} className={`accept-item-row ${err ? 'has-error' : ''}`}>
                  <div className="accept-item-info">
                    <span className="accept-item-name">{item.chemical_name}</span>
                    <span className="accept-item-meta">
                      Requested: {fmtQty(item.quantity)} {item.unit}
                      {' • Available: '}
                      {a ? `${fmtQty(a.quantity)} ${a.unit || item.unit}` : '—'}
                    </span>
                  </div>
                  <div className="accept-item-input-wrap">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={quantities[item.id] ?? ''}
                      onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
                      className={`modern-input accept-qty-input ${err ? 'input-error' : ''}`}
                    />
                    <span className="accept-input-unit">{item.unit}</span>
                  </div>
                  {err && (
                    <div className="accept-item-error">
                      <FaExclamationTriangle /> {err}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="accept-remarks">
            <label>Remarks to staff (optional)</label>
            <textarea
              value={hodRemarks}
              onChange={(e) => setHodRemarks(e.target.value)}
              rows={2}
              className="modern-textarea"
              placeholder="e.g. Reduced due to limited stock"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn-primary-action" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Approving...' : <><FaCheckCircle /> Approve{hasChanges ? ' with Adjustments' : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AcceptRequestModal;
