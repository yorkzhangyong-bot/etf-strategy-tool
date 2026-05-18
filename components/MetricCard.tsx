import { Tooltip } from './Tooltip';

interface MetricCardProps {
  label: string;
  value: string;
  tooltipKey: string;
  negative?: boolean;
}

export function MetricCard({ label, value, tooltipKey, negative }: MetricCardProps) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center shadow-sm">
      <div className="flex items-center justify-center gap-1 mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <Tooltip term={tooltipKey} />
      </div>
      <div className={`text-2xl font-bold ${negative ? 'text-red-500' : 'text-emerald-500'}`}>
        {value}
      </div>
    </div>
  );
}
