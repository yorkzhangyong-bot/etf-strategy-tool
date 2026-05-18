-- ETF 元数据
CREATE TABLE IF NOT EXISTS etfs (
  id            SERIAL PRIMARY KEY,
  ticker        VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(200),
  issuer        VARCHAR(100),
  category      VARCHAR(50),
  expense_ratio DECIMAL(5,4),
  aum           BIGINT,
  inception     DATE,
  currency      VARCHAR(10) DEFAULT 'USD',
  region        VARCHAR(50),
  asset_class   VARCHAR(30),
  updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_etfs_updated_at ON etfs(updated_at);

-- 策略定义
CREATE TABLE IF NOT EXISTS strategies (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  type          VARCHAR(20) NOT NULL,
  factors       JSONB NOT NULL,
  params        JSONB NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 策略-ETF 评分
CREATE TABLE IF NOT EXISTS strategy_etf_scores (
  id            SERIAL PRIMARY KEY,
  strategy_id   INT NOT NULL REFERENCES strategies(id),
  etf_id        INT NOT NULL REFERENCES etfs(id),
  score         DECIMAL(5,2),
  factor_scores JSONB,
  scored_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(strategy_id, etf_id)
);
CREATE INDEX IF NOT EXISTS idx_scores_strategy ON strategy_etf_scores(strategy_id);
CREATE INDEX IF NOT EXISTS idx_scores_etf ON strategy_etf_scores(etf_id);

-- 回测结果
CREATE TABLE IF NOT EXISTS backtest_results (
  id            SERIAL PRIMARY KEY,
  strategy_id   INT REFERENCES strategies(id),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  annual_return DECIMAL(6,4),
  sharpe_ratio  DECIMAL(5,2),
  max_drawdown  DECIMAL(5,2),
  volatility    DECIMAL(5,2),
  daily_nav     JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_id);

-- 回测-ETF 关联表
CREATE TABLE IF NOT EXISTS backtest_etfs (
  id            SERIAL PRIMARY KEY,
  backtest_id   INT NOT NULL REFERENCES backtest_results(id) ON DELETE CASCADE,
  etf_id        INT NOT NULL REFERENCES etfs(id),
  weight        DECIMAL(5,4) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backtest_etfs_bid ON backtest_etfs(backtest_id);

-- 经典策略初始数据
INSERT INTO strategies (name, type, factors, params) VALUES
  ('动量策略', 'classic', '[{"name":"momentum","weight":100}]', '{"lookback":"6m","max_holdings":10,"rebalance":"quarterly"}'),
  ('低波动策略', 'classic', '[{"name":"low_vol","weight":100}]', '{"lookback":"12m","max_holdings":10,"rebalance":"quarterly"}'),
  ('股债平衡 60/40', 'classic', '[{"name":"momentum","weight":50},{"name":"low_vol","weight":50}]', '{"lookback":"12m","max_holdings":15,"rebalance":"monthly"}'),
  ('趋势跟踪', 'classic', '[{"name":"trend_strength","weight":100}]', '{"lookback":"3m","max_holdings":5,"rebalance":"monthly"}'),
  ('定投策略', 'classic', '[{"name":"momentum","weight":40},{"name":"expense","weight":60}]', '{"lookback":"12m","max_holdings":5,"rebalance":"monthly"}')
ON CONFLICT (name) DO NOTHING;
