import React from 'react';
import { FaFilePdf, FaFileExcel } from 'react-icons/fa';

function DownloadButtons({ selectedYear, onDownload }) {
  return (
    <>
      <button
        className="yer-download-btn pdf"
        onClick={() => onDownload('pdf')}
      >
        <FaFilePdf /> PDF
      </button>
      <button
        className="yer-download-btn excel"
        onClick={() => onDownload('excel')}
      >
        <FaFileExcel /> Excel
      </button>
    </>
  );
}

export default DownloadButtons;
