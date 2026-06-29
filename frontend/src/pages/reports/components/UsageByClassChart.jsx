import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

function UsageByClassChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="yer-chart-section">
        <h3 className="yer-chart-title">Usage by Class</h3>
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No data available</p>
      </div>
    );
  }

  const chartData = [...data].reverse().map((d) => ({
    name: d.class_name,
    chemicals: d.total_chemicals_used,
    requests: d.total_requests,
  }));

  return (
    <div className="yer-chart-section">
      <h3 className="yer-chart-title">Usage by Class</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="chemicals" name="Chemicals Used" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default UsageByClassChart;
