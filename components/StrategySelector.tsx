'use client';

import { useState, useEffect } from 'react';
import { Tooltip } from './Tooltip';
import type { Strategy, Factor, EtfRecommendation } from '@/lib/types';

const ALL_FACTORS = [
  { name: 'momentum', label: '动量因子' },
  { name: 'low_vol', label: '低波动因子' },
  { name: 'value', label: '价值因子' },
  { name: 'size', label: '规模因子' },
  { name: 'expense', label: '费用因子' },
  { name: 'trend_strength', label: '趋势强度' },
  { name: 'liquidity', label: '流动性因子' },
];

export function StrategySelector() {
  const [mode, setMode] = useState<'classic' | 'custom'>('classic');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customFactors, setCustomFactors] = useState<Factor[]>([]);
  const [factorWeight, setFactorWeight] = useState<Record<string, number>>({});
  const [recommendations, setRecommendations] = useState<EtfRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/strategies')
      .then(r => r.json())
      .then(setStrategies)
      .catch(console.error);
  }, []);

  function toggleFactor(name: string) {
    setCustomFactors(prev =>
      prev.some(f => f.name === name)
        ? prev.filter(f => f.name !== name)
        : [...prev, { name, weight: 0 }]
    );
  }

  async function handleRecommend() {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/strategies/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'dev-secret-key' },
        body: JSON.stringify({
          strategy_id: mode === 'classic' ? selectedId : -1,
          params: { lookback: '6m', max_holdings: 10 },
        }),
      });
      const data = await resp.json();
      if (data.error) {
        setError(data.detail || '策略推荐失败，请稍后重试');
      } else {
        setRecommendations(data.recommendations || []);
      }
    } catch {
      setError('无法连接计算服务，请检查 Python 函数是否已启动');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-6">
      {/* Left panel: strategy config */}
      <div className="w-80 flex-shrink-0 space-y-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            className={`flex-1 py-2 text-sm rounded-md ${mode === 'classic' ? 'bg-white shadow' : ''}`}
            onClick={() => setMode('classic')}
          >
            经典策略
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-md ${mode === 'custom' ? 'bg-white shadow' : ''}`}
            onClick={() => setMode('custom')}
          >
            定制策略
          </button>
        </div>

        {mode === 'classic' ? (
          <div className="space-y-2">
            {strategies.map(s => (
              <button
                key={s.id}
                className={`w-full text-left p-3 border rounded-lg text-sm ${selectedId === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-gray-500 text-xs">
                  {s.factors.map((f: Factor) => f.name).join(' + ')}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                选择因子
                <Tooltip term="momentum" />
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {ALL_FACTORS.map(f => {
                  const active = customFactors.some(cf => cf.name === f.name);
                  return (
                    <button
                      key={f.name}
                      className={`px-2 py-1 text-xs rounded-full border ${active ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300'}`}
                      onClick={() => toggleFactor(f.name)}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {customFactors.map(f => (
              <div key={f.name} className="flex items-center gap-2">
                <span className="text-sm w-24">{ALL_FACTORS.find(af => af.name === f.name)?.label}</span>
                <input
                  type="range" min="0" max="100" className="flex-1"
                  value={factorWeight[f.name] || 0}
                  onChange={e => setFactorWeight(prev => ({ ...prev, [f.name]: Number(e.target.value) }))}
                />
                <span className="text-xs w-8">{factorWeight[f.name] || 0}%</span>
              </div>
            ))}
          </div>
        )}

        <button
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={loading || (mode === 'classic' && selectedId === null)}
          onClick={handleRecommend}
        >
          {loading ? '计算中...' : '推荐 ETF'}
        </button>
      </div>

      {/* Right panel: recommendations */}
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-500 mb-3">推荐结果 (按评分排序)</h3>
        {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm mb-3">{error}</div>}
        {recommendations.length > 0 ? (
          <div className="border rounded-lg divide-y">
            {recommendations.map(rec => (
              <div key={rec.ticker} className="flex justify-between items-center p-3">
                <div>
                  <span className="font-semibold">{rec.ticker}</span>
                  <span className="text-gray-500 text-sm ml-2">{rec.name}</span>
                </div>
                <span className="text-blue-600 font-bold">{rec.score}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-12">
            选择策略后点击「推荐 ETF」查看结果
          </p>
        )}
      </div>
    </div>
  );
}
