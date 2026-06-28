import React from 'react';

function StatCards({ summary }) {
  const stats = [
    {
      label: 'Total Spend',
      value: `₹${summary.total_spend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      className: 'rupee',
    },
    {
      label: 'Chemicals Purchased',
      value: summary.total_chemicals_purchased,
      suffix: 'items',
      className: 'blue',
    },
    {
      label: 'Total Used',
      value: summary.total_chemicals_used.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      suffix: 'units',
      className: 'green',
    },
    {
      label: 'Damaged Items',
      value: summary.total_damaged_chemicals + summary.total_damaged_apparatus,
      suffix: 'items',
      className: 'red',
    },
  ];

  return (
    <div className="yer-stat-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="yer-stat-card">
          <div className="yer-stat-label">{stat.label}</div>
          <div className={`yer-stat-value ${stat.className}`}>
            {stat.value}
            {stat.suffix && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>{stat.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatCards;
