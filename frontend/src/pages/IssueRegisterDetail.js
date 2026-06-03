import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaPrint } from 'react-icons/fa';
import api from '../utils/api';
import './IssueRegisterDetail.css';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mon  = String(d.getMonth() + 1).padStart(2, '0');
  const yr   = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

function IssueRegisterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/issue_register/${id}/`)
      .then(r => { setReg(r.data); setLoading(false); })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to load'); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading-spinner" />;
  if (error)   return <div className="error-message">{error}</div>;
  if (!reg)    return null;

  const chemItems = reg.chemicals || [];
  const chemCount = chemItems.length;
  const issId = `ISS-${String(reg.ir_id).padStart(3, '0')}`;
  const statusLower = (reg.status || 'completed').toLowerCase();
  const statusLabel = statusLower.charAt(0).toUpperCase() + statusLower.slice(1);
  const statColor =
    statusLower === 'completed' ? '#2E7D32' :
    statusLower === 'pending'   ? '#E65100' :
                                  '#1A3C6E';

  const tlDates = [
    { label: 'Date Requested', date: '—' },
    { label: 'Date Issued',    date: fmtDate(reg.date) },
    { label: 'Date Returned',  date: '—' },
    { label: 'Date Completed', date: '—' },
  ];
  const stepsDone = tlDates.filter(d => d.date !== '—').length;

  return (
    <div className="ird-page animate-up">
      {/* ===== TOP BAR ===== */}
      <div className="ird-topbar">
        <div className="ird-topbar-left">
          <button className="ird-back-btn" onClick={() => navigate('/issue-register')}>
            <FaArrowLeft />
          </button>
          <span className="ird-topbar-title">Issue Details</span>
          <div className="ird-status-inline" style={{ color: statColor }}>
            <span className="ird-si-dot" style={{ background: statColor }} />
            {statusLabel}
          </div>
        </div>
        <button className="ird-print-btn" onClick={() => window.print()}>
          <FaPrint /> Print
        </button>
      </div>

      {/* ===== MOBILE STATUS BADGE ===== */}
      <div className="ird-mobile-status">
        <span className="ird-ms-dot" style={{ background: statColor }} />
        <span className="ird-ms-text" style={{ color: statColor }}>{statusLabel}</span>
      </div>

      <div className="ird-body">
        {/* ===== DESKTOP ROW: REQUEST INFO + STAFF DETAILS ===== */}
        <div className="ird-row-2">
          {/* --- Card 1: REQUEST INFO --- */}
          <div className="ird-card">
            <div className="ird-section-label">REQUEST INFO</div>
            <div className="ird-grid-2x2">
              <div className="ird-gitem">
                <div className="ird-glabel">Issue ID</div>
                <div className="ird-gvalue">{issId}</div>
              </div>
              <div className="ird-gitem">
                <div className="ird-glabel">Request ID</div>
                <div className="ird-gvalue">{reg.request_code || '—'}</div>
              </div>
              <div className="ird-gitem">
                <div className="ird-glabel">Class</div>
                <div className="ird-gvalue">{reg.class_field || '—'}</div>
              </div>
              <div className="ird-gitem">
                <div className="ird-glabel">Purpose</div>
                <div className="ird-gvalue">—</div>
              </div>
            </div>
          </div>

          {/* --- Card 2: STAFF DETAILS --- */}
          <div className="ird-card">
            <div className="ird-section-label">STAFF DETAILS</div>
            <div className="ird-grid-2">
              <div className="ird-gitem">
                <div className="ird-glabel">Staff Name</div>
                <div className="ird-gvalue">{reg.staff_name}</div>
              </div>
              <div className="ird-gitem">
                <div className="ird-glabel">Staff ID</div>
                <div className="ird-gvalue">—</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== CARD 3: CHEMICAL USAGE ===== */}
        {chemCount > 0 && (
          <div className="ird-card">
            <div className="ird-section-label">CHEMICAL USAGE</div>
            <div className="ird-chem-scroll">
              <table className="ird-ct">
                <thead>
                  <tr>
                    <th className="ird-cth-name">Chemical</th>
                    <th className="ird-cth-center">Requested</th>
                    <th className="ird-cth-actual">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {chemItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="ird-ctd-name">{item.chemical_name}</td>
                      <td className="ird-ctd-req">{item.issued_quantity} ml</td>
                      <td className="ird-ctd-act">{item.actual_usage || '—'} ml</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== CARD 4: TIMELINE ===== */}
        <div className="ird-card">
          <div className="ird-section-label">TIMELINE</div>

          {/* Desktop: Horizontal stepper */}
          <div className="ird-stepper">
            {tlDates.map((tl, i) => (
              <React.Fragment key={tl.label}>
                {i > 0 && (
                  <div className={`ird-conn ${tl.date !== '—' ? 'ird-conn-done' : 'ird-conn-pend'}`} />
                )}
                <div className={`ird-step ${tl.date !== '—' ? 'ird-step-done' : 'ird-step-pend'}`}>
                  <div className="ird-step-dot-wrap">
                    <div className={`ird-step-dot ${tl.date !== '—' ? 'ird-dot-filled' : 'ird-dot-empty'}`} />
                  </div>
                  <div className="ird-step-lbl">{tl.label}</div>
                  <div className="ird-step-date">{tl.date}</div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Mobile: 2×2 grid */}
          <div className="ird-tl-grid">
            {tlDates.map(tl => (
              <div key={tl.label} className="ird-tl-gitem">
                <div className="ird-tl-glabel">{tl.label}</div>
                <div className="ird-tl-gvalue">{tl.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IssueRegisterDetail;
