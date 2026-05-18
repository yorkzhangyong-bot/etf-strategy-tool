'use client';

import { useState } from 'react';
import { EtfTable } from '@/components/EtfTable';
import { CorrelationHeatmap } from '@/components/CorrelationHeatmap';
import type { EtfComparison } from '@/lib/types';

export default function ComparePage() {
  const [tickers, setTickers] = useState('');
  const [comparisonData, setComparisonData] = useState<EtfComparison[]>([]);
  const [corrMatrix, setCorrMatrix] = useState<number[][]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCompare() {
    const etfList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (etfList.length < 2) return;
    setLoading(true);
    setError('');

    const resp = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'dev-secret-key' },
      body: JSON.stringify({ etf_tickers: etfList }),
    });
    const data = await resp.json();
    if (data.error) {
      setError(data.detail);
    } else {
      setComparisonData(data.comparison || []);
      setCorrMatrix(data.correlation_matrix || []);
      const eq = etfList.filter(t => data.comparison?.some((c: EtfComparison) => c.ticker === t));
      const initWeights: Record<string, number> = {};
      eq.forEach(t => { initWeights[t] = 1 / eq.length; });
      setWeights(initWeights);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">多 ETF 横向对比</h2>

      <div className="flex gap-3">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="输入 ETF 代码，逗号分隔，如 SPY,QQQ,VTI"
          value={tickers}
          onChange={e => setTickers(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
          onClick={handleCompare}
        >
          {loading ? '对比中...' : '开始对比'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {comparisonData.length > 0 && (
        <>
          <EtfTable data={comparisonData} weights={weights} onWeightChange={(ticker, w) => setWeights(prev => ({ ...prev, [ticker]: w }))} />
          <CorrelationHeatmap matrix={corrMatrix} tickers={comparisonData.map(c => c.ticker)} />
        </>
      )}
    </div>
  );
}
