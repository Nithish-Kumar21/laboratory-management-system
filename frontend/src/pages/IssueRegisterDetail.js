import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaPrint } from 'react-icons/fa';
import api from '../utils/api';
import './StockRequestDetail.css';

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

          {/* Header */}
          <div className="srq-header">
            <div className="srq-header-left">
              <div className="sd-back-row" onClick={() => navigate('/issue-register')}>
                <FaArrowLeft />
                <span>Issue Register Details</span>
              </div>
            </div>
            <div className="srq-header-actions">
              <button className="sd-action-icon-btn" onClick={() => window.print()} title="Print">
                <FaPrint />
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-req-id">{issId}</span>
            </div>
            <hr className="sd-divider" />
            <div className="srq-meta-grid">
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
              <div className="sd-meta-item">
                <div className="sd-meta-label">Day Order</div>
                <div className="sd-meta-value">{reg.source_request?.day_order || '-'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Hour</div>
                <div className="sd-meta-value">{reg.source_request?.hour?.length ? [...reg.source_request.hour].sort((a,b)=>a-b).join(', ') : '-'}</div>
              </div>
              <div className="sd-meta-item">
                <div className="sd-meta-label">Venue</div>
                <div className="sd-meta-value">{reg.venue || '—'}</div>
              </div>
            </div>
          </div>

          {/* Purpose Type Card */}
          {reg.source_request?.purpose_type && (
            <div className="sd-card">
              <div className="sd-card-title">
                {reg.source_request.purpose_type === 'research_project' ? 'Research / Project' : 'Practical Lab'}
              </div>
              <hr className="sd-divider" />
              <div className="srq-meta-grid">
                <div className="sd-meta-item">
                  <div className="sd-meta-label">Experiment Name(s)</div>
                  <div className="sd-meta-value">{reg.source_request.experiment_name || '-'}</div>
                </div>
                {reg.source_request.purpose_type === 'research_project' && (
                  <div className="sd-meta-item">
                    <div className="sd-meta-label">Student Name(s)</div>
                    <div className="sd-meta-value">{reg.source_request.student_name || '-'}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chemical Usage Card */}
          {chemItems.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">
                <FaFlask /> Chemical Usage
              </div>
              <hr className="sd-divider" />
              <div className="srq-chem-list">
                {chemItems.map((item, idx) => (
                  <div key={idx} className="srq-chem-card">
                    <div className="srq-chem-top">
                      <span className="srq-chem-name">{item.chemical_name}</span>
                      <span className="srq-chem-qty">{item.issued_quantity}<span className="srq-chem-unit"> {item.unit}</span></span>
                    </div>
                    {item.actual_usage && (
                      <div className="srq-chem-top" style={{ marginTop: 4 }}>
                        <span className="srq-chem-name" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>Actual</span>
                        <span className="srq-chem-qty" style={{ fontSize: 13, fontWeight: 600 }}>{item.actual_usage}<span className="srq-chem-unit"> {item.unit}</span></span>
                      </div>
                    )}
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
