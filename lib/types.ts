// ETF
export interface Etf {
  id: number;
  ticker: string;
  name: string;
  issuer: string;
  category: string;
  expense_ratio: number;
  aum: number;
  inception: string;
  currency: string;
  region: string;
  asset_class: string;
  updated_at: string;
}

// Strategy factor
export interface Factor {
  name: string;
  weight: number;
}

// Strategy definition
export interface Strategy {
  id: number;
  name: string;
  type: 'classic' | 'custom';
  factors: Factor[];
  params: StrategyParams;
  created_at: string;
}

export interface StrategyParams {
  lookback: string;
  max_holdings: number;
  rebalance: string;
}

// Strategy-ETF recommendation
export interface EtfRecommendation {
  ticker: string;
  name: string;
  score: number;
  factor_scores: Record<string, number>;
}

// ETF comparison row
export interface EtfComparison {
  ticker: string;
  annual_return: number;
  sharpe: number;
  volatility: number;
  max_drawdown: number;
  expense_ratio: number;
}

// Backtest result
export interface BacktestResult {
  id: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  volatility: number;
  daily_nav: NavPoint[];
  data_freshness: 'live' | 'stale';
}

export interface NavPoint {
  date: string;
  value: number;
}

// API error
export interface ApiError {
  error: string;
  detail: string;
  partial_data: boolean;
}
