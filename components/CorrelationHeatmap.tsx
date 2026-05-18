import { Tooltip } from './Tooltip';

interface CorrelationHeatmapProps {
  matrix: number[][];
  tickers: string[];
}

const COLOR_SCALE = (v: number) => {
  if (v >= 0.8) return 'bg-red-500';
  if (v >= 0.5) return 'bg-orange-400';
  if (v >= 0.2) return 'bg-yellow-400';
  if (v >= -0.2) return 'bg-gray-300';
  if (v >= -0.5) return 'bg-green-400';
  return 'bg-emerald-500';
};

export function CorrelationHeatmap({ matrix, tickers }: CorrelationHeatmapProps) {
  if (!matrix.length || !tickers.length) return null;

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs text-gray-500">相关性矩阵</span>
        <Tooltip term="correlation" />
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1"></th>
              {tickers.map(t => <th key={t} className="p-1 font-medium">{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={tickers[i]}>
                <td className="p-1 font-medium">{tickers[i]}</td>
                {row.map((v, j) => (
                  <td key={j} className={`p-2 text-center text-white rounded ${COLOR_SCALE(v)}`}>
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
