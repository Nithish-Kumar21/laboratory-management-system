import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = {
  chemical: '#3B82F6',
  apparatus: '#10B981',
  total: '#8B5CF6',
};

function MonthlyTrendChart({ data }) {
  return (
    <div className="yer-chart-section">
      <h3 className="yer-chart-title">Monthly Purchase Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="chemicals_cost"
            name="Chemicals"
            stroke={COLORS.chemical}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="apparatus_cost"
            name="Apparatus"
            stroke={COLORS.apparatus}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="total_cost"
            name="Total"
            stroke={COLORS.total}
            strokeWidth={2}
            dot={{ r: 3 }}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MonthlyTrendChart;
