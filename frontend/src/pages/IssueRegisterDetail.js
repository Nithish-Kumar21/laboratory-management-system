import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaFlask, FaIdCard, FaUser, FaGraduationCap, FaCalendarAlt, FaCheckCircle } from 'react-icons/fa';
import api from '../utils/api';
import './StockRegisterDetail.css';
import './IssueRegister.css';

function IssueRegisterDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [issueRegister, setIssueRegister] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get(`/issue_register/${id}/`)
            .then(res => {
                setIssueRegister(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching issue detail:', err);
                setError(err.response?.data?.detail || 'Failed to load issue details');
                setLoading(false);
            });
    }, [id]);

    if (loading) return <div className="loading-spinner"></div>;
    if (error) return <div className="error-message card">{error}</div>;
    if (!issueRegister) return null;

    return (
        <div className="stock-detail-page animate-up">
            <div className="detail-header">
                <button className="back-button" onClick={() => navigate('/issue-register')}>
                    <FaArrowLeft />
                </button>
                <div className="header-title-box">
                    <h2>Issue Register Entry</h2>
                    <p>
                        IR-#{issueRegister.ir_id}
                        {issueRegister.request_code && (
                            <span className="ir-header-req-badge" title="Originated from this Request Form">
                                · {issueRegister.request_code}
                            </span>
                        )}
                    </p>
                </div>
                <div className="status-indicator success">
                    <FaCheckCircle /> {issueRegister.status}
                </div>
            </div>

            <div className="detail-info-grid">
                <div className="info-card card">
                    <label><FaIdCard /> Entry ID</label>
                    <span>
                        IR-#{issueRegister.ir_id}
                        {issueRegister.request_code && (
                            <span className="ir-inline-req"> · {issueRegister.request_code}</span>
                        )}
                    </span>
                </div>
                <div className="info-card card">
                    <label><FaUser /> Staff Name</label>
                    <span>{issueRegister.staff_name}</span>
                </div>
                <div className="info-card card">
                    <label><FaGraduationCap /> Class</label>
                    <span>{issueRegister.class_field}</span>
                </div>
                <div className="info-card card">
                    <label><FaCalendarAlt /> Date of Completion</label>
                    <span>{issueRegister.date}</span>
                </div>
            </div>

            <div className="items-section animate-fade">
                <h3><FaFlask /> Chemical Issue Details</h3>
                <div className="card no-padding">
                    <table className="detail-table">
                        <thead>
                            <tr>
                                <th>Chemical Name</th>
                                <th>Issued (ml)</th>
                                <th>Actual Usage (ml)</th>
                                <th>Returned (ml)</th>
                                <th>Additional (ml)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issueRegister.chemicals?.map((it, idx) => (
                                <tr key={idx}>
                                    <td className="item-name">{it.chemical_name}</td>
                                    <td><span className="qty-badge">{it.issued_quantity}</span></td>
                                    <td><span className="qty-badge info">{it.actual_usage}</span></td>
                                    <td>
                                        <span className={`qty-badge ${parseFloat(it.returned || 0) > 0 ? 'success' : ''}`}>
                                            {it.returned || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`qty-badge ${parseFloat(it.additional || 0) > 0 ? 'danger' : ''}`}>
                                            {it.additional || 0}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="info-banner success-banner margin-top-lg">
                <FaCheckCircle /> This record is finalized and linked to the historical laboratory issue log.
            </div>
        </div>
    );
}

export default IssueRegisterDetail;
