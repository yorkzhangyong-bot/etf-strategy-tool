'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { NavPoint } from '@/lib/types';

interface BacktestChartProps {
  dailyNav: NavPoint[];
}

export function BacktestChart({ dailyNav }: BacktestChartProps) {
  if (!dailyNav || dailyNav.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">暂无数据</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dailyNav}>
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(0, 7)}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 11 }}
          />
          <RechartsTooltip
            labelFormatter={(d: string) => `日期: ${d}`}
            formatter={(v: number) => [`${v.toFixed(4)}`, '净值']}
          />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
