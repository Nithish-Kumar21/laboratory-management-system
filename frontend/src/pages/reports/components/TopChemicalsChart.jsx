import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

function TopChemicalsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="yer-chart-section">
        <h3 className="yer-chart-title">Top Used Chemicals</h3>
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No data available</p>
      </div>
    );
  }

  const chartData = [...data].reverse().map((d) => ({
    name: d.name.length > 20 ? d.name.substring(0, 18) + '...' : d.name,
    used: d.total_used,
  }));

  return (
    <div className="yer-chart-section">
      <h3 className="yer-chart-title">Top Used Chemicals</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="used" fill="#3B82F6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TopChemicalsChart;
