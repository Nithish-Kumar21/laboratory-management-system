import React from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981'];

function SpendDonutChart({ purchases }) {
  const chemTotal = purchases?.chemicals?.reduce((s, c) => s + c.total_cost, 0) || 0;
  const appTotal = purchases?.apparatus?.reduce((s, a) => s + a.total_cost, 0) || 0;

  const data = [
    { name: 'Chemicals', value: chemTotal },
    { name: 'Apparatus', value: appTotal },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="yer-chart-section">
        <h3 className="yer-chart-title">Spend by Category</h3>
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No data available</p>
      </div>
    );
  }

  return (
    <div className="yer-chart-section">
      <h3 className="yer-chart-title">Spend by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            label={({ name, value }) =>
              `${name}: ₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
            }
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SpendDonutChart;
