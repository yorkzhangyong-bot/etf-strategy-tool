'use client';

import { useState } from 'react';
import { BacktestChart } from '@/components/BacktestChart';
import { MetricCard } from '@/components/MetricCard';
import type { BacktestResult } from '@/lib/types';
import { formatPct } from '@/lib/utils';

export default function BacktestPage() {
  const [tickers, setTickers] = useState('');
  const [weightsStr, setWeightsStr] = useState('');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [strategyId, setStrategyId] = useState('1');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRun() {
    const etfList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const weightList = weightsStr.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    if (etfList.length === 0 || weightList.length === 0) return;

    setLoading(true);
    setError('');

    const resp = await fetch('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'dev-secret-key' },
      body: JSON.stringify({
        strategy_id: parseInt(strategyId),
        etf_tickers: etfList,
        weights: weightList,
        start_date: startDate,
        end_date: endDate,
      }),
    });
    const data = await resp.json();
    if (data.error && !data.partial_data) {
      setError(data.detail);
    } else {
      setResult(data);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">组合回测</h2>

      <div className="grid grid-cols-2 gap-4 bg-white border rounded-lg p-4">
        <div>
          <label className="text-xs text-gray-500">ETF 代码 (逗号分隔)</label>
          <input className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="SPY,QQQ,VTI"
            value={tickers} onChange={e => setTickers(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">权重 (逗号分隔，和为1)</label>
          <input className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="0.4,0.3,0.3"
            value={weightsStr} onChange={e => setWeightsStr(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">开始日期</label>
          <input type="date" className="w-full border rounded px-3 py-2 text-sm mt-1"
            value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">结束日期</label>
          <input type="date" className="w-full border rounded px-3 py-2 text-sm mt-1"
            value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">策略 ID</label>
          <input className="w-full border rounded px-3 py-2 text-sm mt-1"
            value={strategyId} onChange={e => setStrategyId(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
            onClick={handleRun}
          >
            {loading ? '回测中...' : '运行回测'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {result && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="年化收益" value={formatPct(result.annual_return)} tooltipKey="annual_return" />
            <MetricCard label="夏普比" value={result.sharpe_ratio.toFixed(2)} tooltipKey="sharpe_ratio" />
            <MetricCard label="最大回撤" value={formatPct(result.max_drawdown)} tooltipKey="max_drawdown" negative />
            <MetricCard label="波动率" value={formatPct(result.volatility)} tooltipKey="volatility" />
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">收益曲线</h3>
            <BacktestChart dailyNav={result.daily_nav} />
          </div>
        </>
      )}
    </div>
  );
}
