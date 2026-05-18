'use client';

import { useState } from 'react';
import type { EtfComparison } from '@/lib/types';
import { formatPct } from '@/lib/utils';

interface EtfTableProps {
  data: EtfComparison[];
  onWeightChange: (ticker: string, weight: number) => void;
  weights: Record<string, number>;
}

export function EtfTable({ data, onWeightChange, weights }: EtfTableProps) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left">
          <th className="p-2">ETF</th>
          <th className="p-2">年化收益</th>
          <th className="p-2">夏普比</th>
          <th className="p-2">波动率</th>
          <th className="p-2">最大回撤</th>
          <th className="p-2">费用率</th>
          <th className="p-2">权重</th>
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.ticker} className="border-b hover:bg-gray-50">
            <td className="p-2 font-semibold">{row.ticker}</td>
            <td className={`p-2 ${row.annual_return >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatPct(row.annual_return)}
            </td>
            <td className="p-2">{row.sharpe.toFixed(2)}</td>
            <td className="p-2">{formatPct(row.volatility)}</td>
            <td className="p-2 text-red-500">{formatPct(row.max_drawdown)}</td>
            <td className="p-2">{formatPct(row.expense_ratio, 2)}</td>
            <td className="p-2">
              <input
                type="number" min="0" max="100" step="5"
                className="w-16 border rounded px-1 py-0.5 text-center"
                value={Math.round((weights[row.ticker] || 0) * 100)}
                onChange={e => onWeightChange(row.ticker, Number(e.target.value) / 100)}
              />
              <span className="text-xs text-gray-400 ml-1">%</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
