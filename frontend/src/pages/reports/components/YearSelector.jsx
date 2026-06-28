import React from 'react';

function YearSelector({ selectedYear, onChange }) {
  const currentYear = new Date().getMonth() >= 5
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;

  const years = [];
  for (let i = 0; i < 5; i++) {
    years.push(currentYear - i);
  }

  return (
    <select
      className="yer-year-select"
      value={selectedYear}
      onChange={(e) => onChange(parseInt(e.target.value))}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}–{y + 1}
        </option>
      ))}
    </select>
  );
}

export default YearSelector;
