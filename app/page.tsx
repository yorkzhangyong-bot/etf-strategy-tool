import { StrategySelector } from '@/components/StrategySelector';

export default function HomePage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">选择或定制投资策略</h2>
      <StrategySelector />
    </div>
  );
}
