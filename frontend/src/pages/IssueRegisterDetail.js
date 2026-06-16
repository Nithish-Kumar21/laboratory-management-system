import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaPrint } from 'react-icons/fa';
import api from '../utils/api';
import './StockRegisterDetail.css';
import './IssueRegisterDetail.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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
  if (error) return <div className="error-message">{error}</div>;
  if (!reg) return null;

  const chemItems = reg.chemicals || [];
  const issId = `ISS-${String(reg.ir_id).padStart(3, '0')}`;

  return (
    <div className="staff-detail-wrapper">
      <div className="staff-detail-page animate-up">
        <div className="staff-detail-inner">

          <div className="sd-back-row" onClick={() => navigate('/issue-register')}>
            <FaArrowLeft />
            <span>Issue Register Details</span>
          </div>

          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-req-id">{issId}</span>
              <div className="sd-header-right">
                <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                  <FaPrint />
                </button>
              </div>
            </div>
            <hr className="sd-divider" />
            <div className="sd-meta-grid">
              <div className="sd-meta-item">
                <div className="sd-meta-label">Issue ID</div>
                <div className="sd-meta-value">{issId}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Request ID</div>
                <div className="sd-meta-value">{reg.request_code || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Staff Name</div>
                <div className="sd-meta-value">{reg.staff_name}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Class</div>
                <div className="sd-meta-value">{reg.class_field || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Status</div>
                <div className="sd-meta-value">{reg.status || '—'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Date</div>
                <div className="sd-meta-value">{formatDate(reg.date)}</div>
              </div>
            </div>
          </div>

          {chemItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaFlask /> Chemical Usage
              </div>
              <hr className="sd-divider" />
              <div className="sd-chem-list">
                <div className="sd-chem-row multi-col" style={{gridTemplateColumns: '1fr 100px 100px', color: '#9AA3AF', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', paddingBottom: 8, borderBottom: '0.5px solid #e2e8f0'}}>
                  <span>Chemical</span>
                  <span style={{textAlign: 'right'}}>Requested</span>
                  <span style={{textAlign: 'right'}}>Actual</span>
                </div>
                {chemItems.map((item, idx) => (
                  <div key={idx} className="sd-chem-row multi-col" style={{gridTemplateColumns: '1fr 100px 100px'}}>
                    <span className="sd-chem-name">{item.chemical_name}</span>
                    <span className="sd-chem-qty">{item.issued_quantity}<span className="sd-chem-unit"> {item.unit || 'ml'}</span></span>
                    <span className="sd-chem-qty">{item.actual_usage || '—'}<span className="sd-chem-unit"> {item.unit || 'ml'}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default IssueRegisterDetail;
