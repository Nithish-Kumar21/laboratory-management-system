import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import YearSelector from './components/YearSelector';
import StatCards from './components/StatCards';
import MonthlyTrendChart from './components/MonthlyTrendChart';
import TopChemicalsChart from './components/TopChemicalsChart';
import SpendDonutChart from './components/SpendDonutChart';
import UsageByClassChart from './components/UsageByClassChart';
import DamageSummaryChart from './components/DamageSummaryChart';
import RestockTable from './components/RestockTable';
import DownloadButtons from './components/DownloadButtons';
import { FaFilePdf, FaFileExcel } from 'react-icons/fa';
import './YearEndReport.css';

function YearEndReport() {
  const { isStaff } = useAuth();

  const currentYear = new Date().getMonth() >= 5
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async (year) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/year-end/?year=${year}`);
      setReportData(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to access reports.');
      } else {
        setError('Failed to load report. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(selectedYear);
  }, [selectedYear, fetchReport]);

  const downloadFile = async (type) => {
    try {
      const response = await api.get(
        `/reports/year-end/download/${type}/?year=${selectedYear}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `year_end_report_${selectedYear}_${selectedYear + 1}.${type === 'pdf' ? 'pdf' : 'xlsx'}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download file. Please try again.');
    }
  };

  if (isStaff) {
    return null;
  }

  return (
    <div className="yer-container animate-up">
      <div className="yer-header">
        <div className="yer-header-left">
          <h1>Year-End Audit Report</h1>
          <p>
            Chemistry Dept, Guru Nanak College
            {reportData && ` — ${reportData.academic_year}`}
          </p>
        </div>
        <div className="yer-header-actions">
          <YearSelector
            selectedYear={selectedYear}
            onChange={setSelectedYear}
          />
          <DownloadButtons
            selectedYear={selectedYear}
            onDownload={downloadFile}
          />
        </div>
      </div>

      {loading && (
        <>
          <div className="yer-stat-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="yer-skeleton yer-skeleton-card" />
            ))}
          </div>
          <div className="yer-skeleton yer-skeleton-chart" />
          <div className="yer-chart-grid">
            <div className="yer-skeleton yer-skeleton-chart" />
            <div className="yer-skeleton yer-skeleton-chart" />
          </div>
          <div className="yer-skeleton yer-skeleton-table" />
        </>
      )}

      {error && !loading && (
        <div className="yer-error">
          <p>{error}</p>
          <button className="yer-retry-btn" onClick={() => fetchReport(selectedYear)}>
            Retry
          </button>
        </div>
      )}

      {reportData && !loading && !error && (
        <>
          <StatCards summary={reportData.summary} />
          <MonthlyTrendChart data={reportData.monthly_purchase_trend} />
          <div className="yer-chart-grid">
            <TopChemicalsChart data={reportData.top_used_chemicals} />
            <SpendDonutChart purchases={reportData.purchases} />
          </div>
          <div className="yer-chart-grid">
            <UsageByClassChart data={reportData.usage_by_class} />
            <DamageSummaryChart damageSummary={reportData.damage_summary} />
          </div>
          <RestockTable data={reportData.restock_recommendations} />

          <div className="yer-mobile-download-bar">
            <button
              className="yer-download-btn pdf"
              onClick={() => downloadFile('pdf')}
            >
              <FaFilePdf /> Download PDF
            </button>
            <button
              className="yer-download-btn excel"
              onClick={() => downloadFile('excel')}
            >
              <FaFileExcel /> Download Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default YearEndReport;
