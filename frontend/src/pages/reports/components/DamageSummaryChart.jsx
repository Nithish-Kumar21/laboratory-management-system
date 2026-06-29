import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

function DamageSummaryChart({ damageSummary }) {
  const chemData = (damageSummary?.chemicals || []).map((d) => ({
    name: d.name,
    quantity: d.total_quantity,
    type: 'Chemical',
  }));

  const appData = (damageSummary?.apparatus || []).map((d) => ({
    name: d.name,
    quantity: d.total_quantity,
    type: 'Apparatus',
  }));

  const chartData = [...chemData, ...appData];

  if (chartData.length === 0) {
    return (
      <div className="yer-chart-section">
        <h3 className="yer-chart-title">Damage Summary</h3>
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No damage records</p>
      </div>
    );
  }

  return (
    <div className="yer-chart-section">
      <h3 className="yer-chart-title">Damage Summary</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="quantity" fill="#EF4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DamageSummaryChart;
