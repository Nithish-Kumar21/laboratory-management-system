import React from 'react';

function RestockTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="yer-chart-section">
        <h3 className="yer-chart-title">Restock Recommendations</h3>
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>
          All items adequately stocked
        </p>
      </div>
    );
  }

  return (
    <div className="yer-chart-section">
      <h3 className="yer-chart-title">Restock Recommendations</h3>
      <div className="yer-table-container">
        <table className="yer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Avg Monthly</th>
              <th>Annual Need</th>
              <th>Current Stock</th>
              <th>Recommended</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}>
                <td>{r.name}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                <td>{r.avg_monthly_usage}</td>
                <td>{r.projected_annual_need}</td>
                <td>{r.current_stock}</td>
                <td style={{ fontWeight: 600, color: '#EF4444' }}>{r.recommended_purchase}</td>
                <td>{r.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RestockTable;
