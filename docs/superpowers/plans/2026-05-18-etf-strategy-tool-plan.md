# ETF Strategy Investment Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web application for ETF strategy selection, fund matching, comparison, and backtesting with global ETF coverage.

**Architecture:** Next.js App Router (TypeScript) serves UI and API routes; Python Vercel Functions handle data fetching, strategy computation, and backtest simulation; Neon Postgres stores metadata and results. Next.js middleware validates X-API-Key on write endpoints.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts, Python 3.12, yfinance, pandas, numpy, Neon Postgres (serverless driver), vercel.ts

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.mjs`
- Create: `requirements.txt`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd C:/ai/investigation
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack --yes
```

- [ ] **Step 2: Install additional npm dependencies**

```bash
npm install @vercel/postgres recharts
```

- [ ] **Step 3: Create Python requirements.txt**

```
yfinance>=0.2.40
pandas>=2.2.0
numpy>=1.26.0
fastapi>=0.115.0
uvicorn>=0.32.0
httpx>=0.28.0
```

- [ ] **Step 4: Create .env.local**

```
DATABASE_URL=postgresql://postgres:dev@localhost:5432/etf_invest
API_SECRET_KEY=dev-secret-key-change-in-prod
PYTHON_FUNCTION_URL=http://localhost:3000/api/py
```

- [ ] **Step 5: Create .gitignore for Python**

```
.gitignore should include:
.env.local
.venv/
__pycache__/
*.pyc
.superpowers/
```

- [ ] **Step 6: Create minimal postcss.config.mjs**

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
export default config;
```

- [ ] **Step 7: Verify project runs**

```bash
npm run dev
```
Expected: Next.js dev server on http://localhost:3000

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, Recharts, Python deps"
```

---

### Task 2: Database schema and seed

**Files:**
- Create: `scripts/schema.sql`
- Create: `scripts/seed.sql`

- [ ] **Step 1: Write schema.sql**

```sql
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
  name          VARCHAR(100) NOT NULL,
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
  ('动量策略', 'classic', '[{"name":"momentum","weight":1.0}]', '{"lookback":"6m","max_holdings":10,"rebalance":"quarterly"}'),
  ('低波动策略', 'classic', '[{"name":"low_vol","weight":1.0}]', '{"lookback":"12m","max_holdings":10,"rebalance":"quarterly"}'),
  ('股债平衡 60/40', 'classic', '[{"name":"momentum","weight":0.5},{"name":"low_vol","weight":0.5}]', '{"lookback":"12m","max_holdings":15,"rebalance":"monthly"}'),
  ('趋势跟踪', 'classic', '[{"name":"trend_strength","weight":1.0}]', '{"lookback":"3m","max_holdings":5,"rebalance":"monthly"}'),
  ('定投策略', 'classic', '[{"name":"momentum","weight":0.4},{"name":"expense","weight":0.6}]', '{"lookback":"12m","max_holdings":5,"rebalance":"monthly"}')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Write seed.sql**

```sql
INSERT INTO etfs (ticker, name, issuer, category, expense_ratio, aum, inception, currency, region, asset_class) VALUES
  ('SPY', 'SPDR S&P 500 ETF Trust', 'State Street', '大盘股', 0.0009, 520000000000, '1993-01-22', 'USD', '美国', 'Equity'),
  ('QQQ', 'Invesco QQQ Trust', 'Invesco', '科技股', 0.0020, 280000000000, '1999-03-10', 'USD', '美国', 'Equity'),
  ('VTI', 'Vanguard Total Stock Market ETF', 'Vanguard', '全市场', 0.0003, 420000000000, '2001-05-24', 'USD', '美国', 'Equity'),
  ('IWM', 'iShares Russell 2000 ETF', 'BlackRock', '小盘股', 0.0019, 72000000000, '2000-05-22', 'USD', '美国', 'Equity'),
  ('EFA', 'iShares MSCI EAFE ETF', 'BlackRock', '国际发达市场', 0.0033, 56000000000, '2001-08-14', 'USD', '全球', 'Equity'),
  ('EEM', 'iShares MSCI Emerging Markets ETF', 'BlackRock', '新兴市场', 0.0069, 27000000000, '2003-04-07', 'USD', '新兴市场', 'Equity'),
  ('TLT', 'iShares 20+ Year Treasury Bond ETF', 'BlackRock', '长期国债', 0.0015, 56000000000, '2002-07-22', 'USD', '美国', 'Bond'),
  ('GLD', 'SPDR Gold Trust', 'State Street', '黄金', 0.0040, 65000000000, '2004-11-18', 'USD', '全球', 'Commodity'),
  ('BND', 'Vanguard Total Bond Market ETF', 'Vanguard', '全市场债券', 0.0003, 110000000000, '2007-04-03', 'USD', '美国', 'Bond'),
  ('VWO', 'Vanguard FTSE Emerging Markets ETF', 'Vanguard', '新兴市场', 0.0008, 85000000000, '2005-03-04', 'USD', '新兴市场', 'Equity'),
  ('VEA', 'Vanguard FTSE Developed Markets ETF', 'Vanguard', '国际发达市场', 0.0005, 130000000000, '2007-07-20', 'USD', '全球', 'Equity'),
  ('VNQ', 'Vanguard Real Estate ETF', 'Vanguard', 'REIT', 0.0012, 60000000000, '2004-09-23', 'USD', '美国', 'RealEstate'),
  ('XLK', 'Technology Select Sector SPDR', 'State Street', '科技', 0.0009, 70000000000, '1998-12-16', 'USD', '美国', 'Equity'),
  ('XLV', 'Health Care Select Sector SPDR', 'State Street', '医疗健康', 0.0009, 42000000000, '1998-12-16', 'USD', '美国', 'Equity'),
  ('XLF', 'Financial Select Sector SPDR', 'State Street', '金融', 0.0009, 40000000000, '1998-12-16', 'USD', '美国', 'Equity'),
  ('ARKK', 'ARK Innovation ETF', 'ARK Invest', '创新科技', 0.0075, 8000000000, '2014-10-31', 'USD', '美国', 'Equity'),
  ('LQD', 'iShares iBoxx Inv Grade Corp Bond ETF', 'BlackRock', '投资级公司债', 0.0014, 37000000000, '2002-07-22', 'USD', '美国', 'Bond'),
  ('HYG', 'iShares iBoxx High Yield Corp Bond ETF', 'BlackRock', '高收益债', 0.0049, 18000000000, '2007-04-04', 'USD', '美国', 'Bond'),
  ('SCHD', 'Schwab US Dividend Equity ETF', 'Charles Schwab', '红利股票', 0.0006, 60000000000, '2011-10-20', 'USD', '美国', 'Equity'),
  ('DIA', 'SPDR Dow Jones Industrial Average ETF', 'State Street', '蓝筹股', 0.0016, 35000000000, '1998-01-13', 'USD', '美国', 'Equity')
ON CONFLICT (ticker) DO NOTHING;
```

- [ ] **Step 3: Run schema and seed locally**

```bash
psql postgresql://postgres:dev@localhost:5432/postgres -c "CREATE DATABASE etf_invest;"
psql $DATABASE_URL -f scripts/schema.sql
psql $DATABASE_URL -f scripts/seed.sql
```
Expected: Tables created, 20 ETFs and 5 strategies inserted.

- [ ] **Step 4: Commit**

```bash
git add scripts/schema.sql scripts/seed.sql
git commit -m "feat: add database schema with indexes, seed 20 ETFs and 5 strategies"
```

---

### Task 3: TypeScript types and DB client

**Files:**
- Create: `lib/types.ts`
- Create: `lib/db.ts`
- Create: `lib/utils.ts`

- [ ] **Step 1: Write lib/types.ts**

```ts
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
```

- [ ] **Step 2: Write lib/db.ts**

```ts
import { sql } from '@vercel/postgres';

export const db = {
  query: async (text: string, params?: unknown[]) => {
    const result = await sql.query(text, params);
    return result;
  },
  sql,
};
```

- [ ] **Step 3: Write lib/utils.ts**

```ts
/** Validate weights sum to 1.0 (±0.01 tolerance) */
export function validateWeights(weights: number[]): boolean {
  const sum = weights.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.01;
}

/** Validate factor weights sum to 100 */
export function validateFactorWeights(factors: { name: string; weight: number }[]): boolean {
  const sum = factors.reduce((a, f) => a + f.weight, 0);
  return Math.abs(sum - 100) < 0.5;
}

/** Format decimal to percentage string */
export function formatPct(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Date distance in months */
export function monthsBetween(d1: Date, d2: Date): number {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/db.ts lib/utils.ts
git commit -m "feat: add TypeScript types, DB client, and validation utilities"
```

---

### Task 4: Python data fetcher

**Files:**
- Create: `functions/data-fetcher/index.py`
- Create: `functions/data-fetcher/yfinance_client.py`
- Create: `functions/data-fetcher/fallback_sources.py`

- [ ] **Step 1: Write yfinance_client.py**

```python
import yfinance as yf
import time
from typing import Optional
import pandas as pd


def fetch_history(ticker: str, start: str, end: str, retries: int = 3) -> Optional[pd.DataFrame]:
    """Fetch historical price data with exponential backoff retry."""
    for attempt in range(retries):
        try:
            etf = yf.Ticker(ticker)
            df = etf.history(start=start, end=end)
            if df.empty:
                return None
            return df
        except Exception:
            if attempt < retries - 1:
                time.sleep(3 ** attempt)  # 1s, 3s, 9s
            else:
                return None


def fetch_info(ticker: str) -> Optional[dict]:
    """Fetch ETF metadata info."""
    try:
        etf = yf.Ticker(ticker)
        info = etf.info
        return {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName", ticker),
            "issuer": info.get("fundFamily", ""),
            "category": info.get("category", ""),
            "expense_ratio": info.get("annualReportExpenseRatio") or info.get("expenseRatio", 0),
            "aum": info.get("totalAssets", 0),
            "inception": info.get("fundInceptionDate", None),
            "currency": info.get("currency", "USD"),
            "region": _infer_region(info),
            "asset_class": _infer_asset_class(info),
        }
    except Exception:
        return None


def search_etfs(query: str, limit: int = 20) -> list[dict]:
    """Search ETFs by ticker or name from yfinance."""
    # yfinance doesn't have a search API — use ticker lookup
    # For production: supplement with a static ETF list or Alpha Vantage search
    try:
        ticker = query.upper().strip()
        info = fetch_info(ticker)
        if info:
            return [info]
        return []
    except Exception:
        return []


def _infer_region(info: dict) -> str:
    country = info.get("country", "")
    if country == "United States":
        return "美国"
    region_map = {
        "China": "新兴市场", "India": "新兴市场", "Brazil": "新兴市场",
        "Japan": "全球", "United Kingdom": "全球", "Germany": "全球",
    }
    return region_map.get(country, "全球")


def _infer_asset_class(info: dict) -> str:
    category = info.get("category", "").lower()
    if "bond" in category or "treasury" in category:
        return "Bond"
    if "commodity" in category or "gold" in category:
        return "Commodity"
    if "real estate" in category or "reit" in category:
        return "RealEstate"
    return "Equity"
```

- [ ] **Step 2: Write fallback_sources.py**

```python
"""Fallback data sources when yfinance is unavailable."""

import httpx
from typing import Optional
import pandas as pd


async def fetch_from_alphavantage(ticker: str, api_key: str = "") -> Optional[dict]:
    """Alpha Vantage fallback — requires API key."""
    if not api_key:
        return None
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if "Global Quote" in data:
                return data["Global Quote"]
    return None


async def fetch_from_financialmodelingprep(ticker: str, api_key: str = "") -> Optional[dict]:
    """FMP fallback — requires API key."""
    if not api_key:
        return None
    url = f"https://financialmodelingprep.com/api/v3/profile/{ticker}?apikey={api_key}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return data[0]
    return None
```

- [ ] **Step 3: Write index.py (main handler)**

```python
"""data-fetcher Vercel Python Function entry point."""

from http.server import BaseHTTPRequestHandler
import json
import os
from yfinance_client import fetch_history, fetch_info, search_etfs
from urllib.parse import urlparse, parse_qs


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        try:
            if path.endswith('/fetch-history'):
                result = self._handle_fetch_history(body)
            elif path.endswith('/fetch-info'):
                result = self._handle_fetch_info(body)
            elif path.endswith('/search'):
                result = self._handle_search(body)
            else:
                result = {"error": "UNKNOWN_ACTION", "detail": f"Unknown path: {path}"}
                self._send_json(400, result)
                return

            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": "DATA_FETCH_FAILED", "detail": str(e)})

    def _handle_fetch_history(self, body):
        ticker = body.get("ticker", "")
        start = body.get("start_date", "2020-01-01")
        end = body.get("end_date", "2025-12-31")
        df = fetch_history(ticker, start, end)
        if df is None:
            return {"error": "FETCH_FAILED", "detail": f"Cannot fetch history for {ticker}"}
        prices = [{"date": str(idx.date()), "close": float(row["Close"])}
                  for idx, row in df.iterrows()]
        return {"ticker": ticker, "prices": prices, "data_freshness": "live"}

    def _handle_fetch_info(self, body):
        ticker = body.get("ticker", "")
        info = fetch_info(ticker)
        if info is None:
            return {"error": "FETCH_FAILED", "detail": f"Cannot fetch info for {ticker}"}
        return info

    def _handle_search(self, body):
        query = body.get("q", "")
        limit = body.get("limit", 10)
        results = search_etfs(query, limit)
        return {"results": results}

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
```

- [ ] **Step 4: Commit**

```bash
git add functions/data-fetcher/
git commit -m "feat: add Python data-fetcher with yfinance, retry, and fallback sources"
```

---

### Task 5: Python strategy engine — factors

**Files:**
- Create: `functions/strategy-engine/factors.py`

- [ ] **Step 1: Write factors.py**

```python
"""Strategy factor calculations."""

import pandas as pd
import numpy as np
from typing import Optional


def momentum_score(prices_df: pd.DataFrame, lookback_months: int = 6) -> Optional[float]:
    """Return cumulative return over lookback period (higher is better)."""
    if len(prices_df) < lookback_months * 21:
        return None
    close = prices_df["Close"]
    start_price = close.iloc[-lookback_months * 21]
    end_price = close.iloc[-1]
    return float((end_price / start_price) - 1)


def low_vol_score(prices_df: pd.DataFrame, lookback_months: int = 12) -> Optional[float]:
    """Return negative daily std dev (lower std = higher score)."""
    if len(prices_df) < 21:
        return None
    daily_returns = prices_df["Close"].pct_change().dropna()
    std = daily_returns.tail(lookback_months * 21).std()
    return float(-std)  # negative so higher score = lower volatility


def trend_strength_score(prices_df: pd.DataFrame) -> Optional[float]:
    """Return price deviation from 200-day MA (positive = above MA)."""
    if len(prices_df) < 200:
        return None
    close = prices_df["Close"]
    ma200 = close.rolling(200).mean().iloc[-1]
    current = close.iloc[-1]
    return float((current / ma200) - 1)


def expense_score(expense_ratio: float) -> float:
    """Return negative expense ratio (lower = higher score)."""
    return float(-expense_ratio)


def size_score(aum: float) -> float:
    """Return log AUM (larger = higher score)."""
    if aum <= 0:
        return 0.0
    return float(np.log(aum))


def liquidity_score(prices_df: pd.DataFrame) -> Optional[float]:
    """Return average daily volume (higher = better)."""
    if "Volume" not in prices_df.columns or len(prices_df) < 21:
        return None
    avg_vol = prices_df["Volume"].tail(21).mean()
    return float(np.log(avg_vol + 1))


def value_score(etf_info: dict) -> Optional[float]:
    """Return value score based on P/E. Lower P/E = higher score.
    Note: ETF P/E comes from underlying holdings, may not be available from yfinance."""
    pe = etf_info.get("trailingPE") or etf_info.get("forwardPE")
    if pe is None or pe <= 0:
        return None
    return float(-pe)  # lower P/E → higher score


def calculate_factor_scores(
    etf_id: int,
    ticker: str,
    prices_df: pd.DataFrame,
    etf_info: dict,
    factors: list[dict],
    params: dict,
) -> dict:
    """Compute all factor scores for one ETF. Returns {factor_name: score}."""
    lookback = int(params.get("lookback", "6").replace("m", "").replace("mo", ""))
    if not lookback:
        lookback = 6

    factor_calculators = {
        "momentum": lambda: momentum_score(prices_df, lookback),
        "low_vol": lambda: low_vol_score(prices_df, lookback),
        "trend_strength": lambda: trend_strength_score(prices_df),
        "expense": lambda: expense_score(etf_info.get("expense_ratio", 0)),
        "size": lambda: size_score(etf_info.get("aum", 0)),
        "liquidity": lambda: liquidity_score(prices_df),
        "value": lambda: value_score(etf_info),
    }

    scores = {}
    for factor in factors:
        name = factor["name"]
        calc = factor_calculators.get(name)
        if calc:
            val = calc()
            if val is not None:
                scores[name] = round(float(val), 6)
    return scores
```

- [ ] **Step 5: Commit**

```bash
git add functions/strategy-engine/factors.py
git commit -m "feat: add strategy factor calculators (momentum, vol, trend, expense, size, liquidity, value)"
```

---

### Task 6: Python strategy engine — ranking

**Files:**
- Create: `functions/strategy-engine/ranking.py`

- [ ] **Step 1: Write ranking.py**

```python
"""Multi-factor weighted ranking."""

import numpy as np


def normalize_scores(raw_scores: dict[str, float]) -> dict[str, float]:
    """Min-max normalize each factor score across ETFs to [0, 100] range."""
    # This receives scores for multiple ETFs grouped by factor
    # Input: raw_scores is per-ETF, normalization happens in rank_etfs
    return raw_scores


def rank_etfs(
    etf_scores: list[dict],  # [{"ticker": "SPY", "scores": {"momentum": 0.15, ...}}, ...]
    factor_weights: list[dict],  # [{"name": "momentum", "weight": 50}, ...]
) -> list[dict]:
    """
    Rank ETFs by weighted multi-factor score.
    Uses min-max normalization per factor, then weighted sum.
    """
    if not etf_scores:
        return []

    weight_map = {fw["name"]: fw["weight"] / 100.0 for fw in factor_weights}
    factor_names = list(weight_map.keys())

    # Collect raw scores per factor
    factor_values = {fn: [] for fn in factor_names}
    for etf in etf_scores:
        for fn in factor_names:
            factor_values[fn].append(etf["scores"].get(fn, None))

    # Min-max normalize each factor
    normalized = {fn: [] for fn in factor_names}
    for fn in factor_names:
        vals = [v for v in factor_values[fn] if v is not None]
        if len(vals) >= 2:
            min_v, max_v = min(vals), max(vals)
            for i, raw in enumerate(factor_values[fn]):
                if raw is not None and max_v > min_v:
                    normalized[fn].append((raw - min_v) / (max_v - min_v) * 100)
                else:
                    normalized[fn].append(50.0)  # neutral score when can't compute
        else:
            for _ in factor_values[fn]:
                normalized[fn].append(50.0)

    # Weighted sum
    results = []
    for i, etf in enumerate(etf_scores):
        weighted = 0.0
        factor_detail = {}
        for fn in factor_names:
            w = weight_map[fn]
            s = normalized[fn][i]
            weighted += w * s
            factor_detail[fn] = round(s, 1)
        results.append({
            "ticker": etf["ticker"],
            "name": etf.get("name", etf["ticker"]),
            "score": round(weighted, 1),
            "factor_scores": factor_detail,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results
```

- [ ] **Step 2: Commit**

```bash
git add functions/strategy-engine/ranking.py
git commit -m "feat: add multi-factor weighted ranking with min-max normalization"
```

---

### Task 7: Python strategy engine — entry point

**Files:**
- Create: `functions/strategy-engine/index.py`

- [ ] **Step 1: Write index.py**

```python
"""strategy-engine Vercel Python Function entry point."""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'data-fetcher'))

from yfinance_client import fetch_history, fetch_info
from factors import calculate_factor_scores
from ranking import rank_etfs


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        try:
            strategy_factors = body.get("factors", [])
            params = body.get("params", {"lookback": "6m", "max_holdings": 10})
            etf_tickers = body.get("etf_tickers", [])

            # Compute factor scores for each ETF
            etf_scores = []
            for ticker in etf_tickers:
                prices_df = fetch_history(ticker, "2020-01-01", "2026-01-01")
                if prices_df is None or prices_df.empty:
                    continue
                info = fetch_info(ticker) or {}
                scores = calculate_factor_scores(0, ticker, prices_df, info, strategy_factors, params)
                etf_scores.append({
                    "ticker": ticker,
                    "name": info.get("name", ticker),
                    "scores": scores,
                })

            max_holdings = params.get("max_holdings", 10)
            ranked = rank_etfs(etf_scores, strategy_factors)
            recommendations = ranked[:max_holdings]

            self._send_json(200, {"recommendations": recommendations})
        except Exception as e:
            self._send_json(500, {"error": "STRATEGY_FAILED", "detail": str(e)})

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
```

- [ ] **Step 2: Commit**

```bash
git add functions/strategy-engine/index.py
git commit -m "feat: add strategy-engine entry point — fetch data, score factors, rank ETFs"
```

---

### Task 8: Python backtest engine — metrics

**Files:**
- Create: `functions/backtest-engine/metrics.py`

- [ ] **Step 1: Write metrics.py**

```python
"""Backtest performance metrics."""

import pandas as pd
import numpy as np
from typing import Optional


def compute_metrics(daily_values: list[dict], risk_free_rate: float = 0.02) -> dict:
    """
    Compute performance metrics from daily portfolio values.
    daily_values: [{"date": "2020-01-02", "value": 1.0}, ...]
    """
    if not daily_values or len(daily_values) < 2:
        return _empty_metrics()

    values = [d["value"] for d in daily_values]
    dates = [d["date"] for d in daily_values]

    # Daily returns
    returns = pd.Series([(values[i] / values[i-1] - 1) for i in range(1, len(values))])

    # Annualized return
    total_return = values[-1] / values[0] - 1
    years = len(returns) / 252
    annual_return = (1 + total_return) ** (1 / max(years, 0.1)) - 1 if years > 0 else 0

    # Annualized volatility
    volatility = float(returns.std() * np.sqrt(252))

    # Sharpe ratio
    excess_return = annual_return - risk_free_rate
    sharpe = excess_return / volatility if volatility > 0 else 0

    # Max drawdown
    peak = values[0]
    max_dd = 0.0
    for v in values:
        if v > peak:
            peak = v
        dd = (v - peak) / peak
        if dd < max_dd:
            max_dd = dd

    return {
        "annual_return": round(float(annual_return), 4),
        "sharpe_ratio": round(float(sharpe), 2),
        "max_drawdown": round(float(max_dd), 2),
        "volatility": round(float(volatility), 2),
        "total_return": round(float(total_return), 4),
        "years": round(years, 2),
    }


def _empty_metrics() -> dict:
    return {
        "annual_return": 0.0,
        "sharpe_ratio": 0.0,
        "max_drawdown": 0.0,
        "volatility": 0.0,
        "total_return": 0.0,
        "years": 0.0,
    }
```

- [ ] **Step 2: Commit**

```bash
git add functions/backtest-engine/metrics.py
git commit -m "feat: add backtest metrics — annual return, sharpe, max drawdown, volatility"
```

---

### Task 9: Python backtest engine — simulation

**Files:**
- Create: `functions/backtest-engine/simulation.py`

- [ ] **Step 1: Write simulation.py**

```python
"""Portfolio simulation engine."""

import pandas as pd
import numpy as np
from typing import Optional


def simulate_portfolio(
    price_data: dict[str, list[dict]],  # {"SPY": [{"date":"...","close":100},...], ...}
    weights: list[float],
    tickers: list[str],
    start_date: str,
    end_date: str,
) -> list[dict]:
    """
    Simulate daily portfolio value given ETF price histories and weights.
    Returns daily NAV: [{"date": "2020-01-02", "value": 1.0}, ...]
    """
    if not price_data or not tickers or len(weights) != len(tickers):
        return []

    # Build aligned DataFrame of daily closes
    dfs = {}
    for ticker in tickers:
        prices = price_data.get(ticker, [])
        if not prices:
            return []
        df = pd.DataFrame(prices)
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
        dfs[ticker] = df["close"]

    combined = pd.DataFrame(dfs)
    combined = combined.dropna()  # only dates where all ETFs have data

    if combined.empty:
        return []

    # Filter to date range
    combined = combined[(combined.index >= start_date) & (combined.index <= end_date)]
    if combined.empty:
        return []

    # Normalize to 1.0 at start
    norm_values = combined / combined.iloc[0]

    # Weighted portfolio
    portfolio = (norm_values * weights).sum(axis=1)

    return [
        {"date": str(idx.date()), "value": round(float(v), 6)}
        for idx, v in portfolio.items()
    ]


def generate_comparison_data(
    price_data: dict[str, list[dict]],
    tickers: list[str],
    lookback_months: int = 36,
) -> tuple[list[dict], list[list[float]]]:
    """
    Generate comparison table and correlation matrix for multiple ETFs.
    Returns: (comparison_rows, correlation_matrix)
    """
    from metrics import compute_metrics

    comparison = []
    daily_returns = {}

    for ticker in tickers:
        prices = price_data.get(ticker, [])
        if not prices:
            comparison.append({"ticker": ticker, "error": "No data"})
            continue
        nav = [{"date": p["date"], "value": p["close"] / prices[0]["close"]} for p in prices]
        metrics = compute_metrics(nav)
        comparison.append({
            "ticker": ticker,
            "annual_return": metrics["annual_return"],
            "sharpe": metrics["sharpe_ratio"],
            "volatility": metrics["volatility"],
            "max_drawdown": metrics["max_drawdown"],
        })
        # Collect daily returns for correlation
        closes = [p["close"] for p in prices]
        rets = [(closes[i] / closes[i-1] - 1) for i in range(1, len(closes))]
        daily_returns[ticker] = rets

    # Correlation matrix
    tickers_with_data = [t for t in tickers if t in daily_returns]
    n = len(tickers_with_data)
    corr = [[0.0] * n for _ in range(n)]
    if n >= 2:
        # Align to min length
        min_len = min(len(daily_returns[t]) for t in tickers_with_data)
        aligned = {t: daily_returns[t][-min_len:] for t in tickers_with_data}
        rets_df = pd.DataFrame(aligned)
        corr_df = rets_df.corr()
        for i, ti in enumerate(tickers_with_data):
            for j, tj in enumerate(tickers_with_data):
                corr[i][j] = round(float(corr_df.loc[ti, tj]), 2)

    return comparison, corr
```

- [ ] **Step 2: Commit**

```bash
git add functions/backtest-engine/simulation.py
git commit -m "feat: add portfolio simulation and comparison data generation"
```

---

### Task 10: Python backtest engine — entry point

**Files:**
- Create: `functions/backtest-engine/index.py`

- [ ] **Step 1: Write index.py**

```python
"""backtest-engine Vercel Python Function entry point."""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'data-fetcher'))

from yfinance_client import fetch_history
from simulation import simulate_portfolio, generate_comparison_data
from metrics import compute_metrics


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        try:
            if '/run' in self.path:
                result = self._handle_run(body)
            elif '/compare' in self.path:
                result = self._handle_compare(body)
            else:
                result = {"error": "UNKNOWN_ACTION", "detail": f"Unknown path: {self.path}"}
                self._send_json(400, result)
                return

            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": "BACKTEST_FAILED", "detail": str(e), "partial_data": False})

    def _handle_run(self, body):
        tickers = body.get("etf_tickers", [])
        weights = body.get("weights", [])
        start = body.get("start_date", "2020-01-01")
        end = body.get("end_date", "2025-12-31")

        # Fetch all price data
        price_data = {}
        failed = []
        for ticker in tickers:
            df = fetch_history(ticker, start, end)
            if df is not None and not df.empty:
                price_data[ticker] = [
                    {"date": str(idx.date()), "close": float(row["Close"])}
                    for idx, row in df.iterrows()
                ]
            else:
                failed.append(ticker)

        if not price_data:
            return {"error": "BACKTEST_FAILED", "detail": f"Cannot fetch data for any ticker: {tickers}", "partial_data": False}

        # Simulate
        nav = simulate_portfolio(price_data, weights, list(price_data.keys()), start, end)
        if not nav:
            return {"error": "BACKTEST_FAILED", "detail": "Simulation produced no results", "partial_data": False}

        metrics = compute_metrics(nav)

        result = {
            "annual_return": metrics["annual_return"],
            "sharpe_ratio": metrics["sharpe_ratio"],
            "max_drawdown": metrics["max_drawdown"],
            "volatility": metrics["volatility"],
            "daily_nav": nav,
            "data_freshness": "stale" if failed else "live",
        }
        if failed:
            result["partial_data"] = True
            result["failed_tickers"] = failed
        return result

    def _handle_compare(self, body):
        tickers = body.get("etf_tickers", [])
        lookback = body.get("lookback_months", 36)

        # Fetch price data for all tickers
        price_data = {}
        failed = []
        for ticker in tickers:
            df = fetch_history(ticker, "2016-01-01", "2026-01-01")
            if df is not None and not df.empty:
                price_data[ticker] = [
                    {"date": str(idx.date()), "close": float(row["Close"])}
                    for idx, row in df.iterrows()
                ]
            else:
                failed.append(ticker)

        comparison, corr_matrix = generate_comparison_data(price_data, list(price_data.keys()), lookback)

        result = {"comparison": comparison, "correlation_matrix": corr_matrix}
        if failed:
            result["partial_data"] = True
            result["failed_tickers"] = failed
        return result

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
```

- [ ] **Step 2: Commit**

```bash
git add functions/backtest-engine/index.py
git commit -m "feat: add backtest-engine entry point — run backtests and compare ETFs"
```

---

### Task 11: API route — strategies CRUD

**Files:**
- Create: `app/api/strategies/route.ts`
- Create: `app/api/strategies/[id]/route.ts`

- [ ] **Step 1: Write app/api/strategies/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateFactorWeights } from '@/lib/utils';

export async function GET() {
  const result = await db.query('SELECT * FROM strategies ORDER BY created_at DESC');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, type, factors, params } = body;

  if (!name || !type || !factors || !params) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Missing required fields' }, { status: 400 });
  }
  if (!validateFactorWeights(factors)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Factor weights must sum to 100' }, { status: 400 });
  }

  const result = await db.query(
    'INSERT INTO strategies (name, type, factors, params) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, type, JSON.stringify(factors), JSON.stringify(params)]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
```

- [ ] **Step 2: Write app/api/strategies/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateFactorWeights } from '@/lib/utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.query('SELECT * FROM strategies WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, factors, params: sp } = body;

  if (factors && !validateFactorWeights(factors)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Factor weights must sum to 100' }, { status: 400 });
  }

  const result = await db.query(
    `UPDATE strategies SET name = COALESCE($1, name), factors = COALESCE($2::jsonb, factors),
     params = COALESCE($3::jsonb, params) WHERE id = $4 RETURNING *`,
    [name, factors ? JSON.stringify(factors) : null, sp ? JSON.stringify(sp) : null, id]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.query('DELETE FROM strategies WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/strategies/
git commit -m "feat: add strategies CRUD API (GET/POST list, GET/PUT/DELETE by id)"
```

---

### Task 12: API route — ETF search and detail

**Files:**
- Create: `app/api/etfs/route.ts`
- Create: `app/api/etfs/[ticker]/route.ts`

- [ ] **Step 1: Write app/api/etfs/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const category = searchParams.get('category') || '';
  const region = searchParams.get('region') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (q) {
    conditions.push(`(ticker ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`);
    values.push(`%${q}%`);
    paramIndex++;
  }
  if (category) {
    conditions.push(`category = $${paramIndex}`);
    values.push(category);
    paramIndex++;
  }
  if (region) {
    conditions.push(`region = $${paramIndex}`);
    values.push(region);
    paramIndex++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const countResult = await db.query(`SELECT COUNT(*) FROM etfs ${where}`, values.slice(0, paramIndex - 1));
  const total = parseInt(countResult.rows[0].count);

  const result = await db.query(
    `SELECT * FROM etfs ${where} ORDER BY aum DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values
  );

  return NextResponse.json({ data: result.rows, total, page, limit });
}
```

- [ ] **Step 2: Write app/api/etfs/[ticker]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const result = await db.query('SELECT * FROM etfs WHERE ticker = $1', [ticker.toUpperCase()]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: `ETF ${ticker} not found` }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/etfs/
git commit -m "feat: add ETF search (paginated, filtered) and detail API"
```

---

### Task 13: API route — strategy recommend

**Files:**
- Create: `app/api/strategies/recommend/route.ts`

- [ ] **Step 1: Write route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { strategy_id, params } = body;

  // Load strategy
  const stratResult = await db.query('SELECT * FROM strategies WHERE id = $1', [strategy_id]);
  if (stratResult.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  const strategy = stratResult.rows[0];

  // Load all ETFs
  const etfResult = await db.query('SELECT * FROM etfs ORDER BY aum DESC');
  const etfs = etfResult.rows;

  // Call Python strategy engine
  const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';
  const resp = await fetch(`${pythonUrl}/strategy-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      factors: strategy.factors,
      params: params || strategy.params,
      etf_tickers: etfs.map((e: { ticker: string }) => e.ticker),
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json(err, { status: 502 });
  }

  const data = await resp.json();

  // Store scores in DB
  for (const rec of data.recommendations) {
    const etf = etfs.find((e: { ticker: string }) => e.ticker === rec.ticker);
    if (etf) {
      await db.query(
        `INSERT INTO strategy_etf_scores (strategy_id, etf_id, score, factor_scores)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (strategy_id, etf_id) DO UPDATE SET score = $3, factor_scores = $4, scored_at = NOW()`,
        [strategy_id, etf.id, rec.score, JSON.stringify(rec.factor_scores)]
      );
    }
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/strategies/recommend/route.ts
git commit -m "feat: add strategy recommend API — calls Python engine, stores scores"
```

---

### Task 14: API route — backtest and compare

**Files:**
- Create: `app/api/backtest/route.ts`
- Create: `app/api/backtest/[id]/route.ts`
- Create: `app/api/compare/route.ts`

- [ ] **Step 1: Write app/api/backtest/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateWeights } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { strategy_id, etf_tickers, weights, start_date, end_date } = body;

  if (!strategy_id || !etf_tickers?.length || !weights?.length || !start_date || !end_date) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Missing required fields' }, { status: 400 });
  }
  if (etf_tickers.length !== weights.length) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'weights length must equal etf_tickers length' }, { status: 400 });
  }
  if (!validateWeights(weights)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Weights must sum to 1.0' }, { status: 400 });
  }
  if (new Date(start_date) >= new Date(end_date)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'start_date must be before end_date' }, { status: 400 });
  }

  const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';
  const resp = await fetch(`${pythonUrl}/backtest-engine/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etf_tickers, weights, start_date, end_date }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json(err, { status: 502 });
  }

  const data = await resp.json();
  if (data.error && !data.partial_data) {
    return NextResponse.json(data, { status: 500 });
  }

  // Look up ETF IDs for the junction table
  const etfIds: number[] = [];
  for (const ticker of etf_tickers) {
    const r = await db.query('SELECT id FROM etfs WHERE ticker = $1', [ticker]);
    if (r.rows.length > 0) etfIds.push(r.rows[0].id);
  }

  // Store result
  const result = await db.query(
    `INSERT INTO backtest_results (strategy_id, start_date, end_date, annual_return, sharpe_ratio, max_drawdown, volatility, daily_nav)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [strategy_id, start_date, end_date, data.annual_return, data.sharpe_ratio, data.max_drawdown, data.volatility, JSON.stringify(data.daily_nav)]
  );
  const backtestId = result.rows[0].id;

  // Insert junction rows
  for (let i = 0; i < etfIds.length; i++) {
    await db.query('INSERT INTO backtest_etfs (backtest_id, etf_id, weight) VALUES ($1, $2, $3)',
      [backtestId, etfIds[i], weights[i]]);
  }

  return NextResponse.json({ id: backtestId, ...data });
}
```

- [ ] **Step 2: Write app/api/backtest/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.query('SELECT * FROM backtest_results WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Backtest not found' }, { status: 404 });
  }
  const bt = result.rows[0];
  const etfs = await db.query(
    `SELECT be.weight, e.ticker, e.name FROM backtest_etfs be JOIN etfs e ON be.etf_id = e.id WHERE be.backtest_id = $1`,
    [id]
  );
  return NextResponse.json({ ...bt, etfs: etfs.rows });
}
```

- [ ] **Step 3: Write app/api/compare/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { etf_tickers, lookback_months } = body;

  if (!etf_tickers?.length || etf_tickers.length < 2) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Need at least 2 ETFs to compare' }, { status: 400 });
  }
  if (etf_tickers.length > 10) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Maximum 10 ETFs at a time' }, { status: 400 });
  }

  const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';
  const resp = await fetch(`${pythonUrl}/backtest-engine/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etf_tickers, lookback_months: lookback_months || 36 }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json(err, { status: 502 });
  }

  const data = await resp.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/backtest/ app/api/compare/
git commit -m "feat: add backtest run/retrieve and ETF compare API endpoints"
```

---

### Task 15: API route — data refresh cron endpoint

**Files:**
- Create: `app/api/data/refresh/route.ts`

- [ ] **Step 1: Write route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Refresh ETF metadata from yfinance for all ETFs in DB
    const etfs = await db.query('SELECT ticker FROM etfs');
    const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';

    let updated = 0;
    let failed = 0;

    for (const etf of etfs.rows) {
      const resp = await fetch(`${pythonUrl}/data-fetcher/fetch-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: (etf as { ticker: string }).ticker }),
      });
      if (resp.ok) {
        const info = await resp.json();
        if (!info.error) {
          await db.query(
            `UPDATE etfs SET name = $1, issuer = $2, category = $3, expense_ratio = $4,
             aum = $5, updated_at = NOW() WHERE ticker = $6`,
            [info.name, info.issuer, info.category, info.expense_ratio, info.aum, info.ticker]
          );
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    }

    return NextResponse.json({ updated, failed, total: etfs.rows.length });
  } catch (e) {
    return NextResponse.json({ error: 'REFRESH_FAILED', detail: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/data/refresh/route.ts
git commit -m "feat: add data refresh endpoint for cron job"
```

---

### Task 16: Tooltip dictionary

**Files:**
- Create: `dictionaries/zh.json`

- [ ] **Step 1: Write dictionaries/zh.json**

```json
{
  "momentum": "基于过去N个月的价格表现：涨幅大的 ETF 评分高，认为趋势会延续",
  "low_vol": "优选价格波动较小的 ETF。波动越低 = 评分越高，适合风险厌恶型投资者",
  "value": "衡量 ETF 持仓的估值水平。PE/PB 越低评分越高，寻找被低估的标的",
  "size": "基于 ETF 的资产管理规模(AUM)。规模越大流动性通常越好，跟踪误差更小",
  "expense": "ETF 的管理费率和运营成本。费用越低评分越高，长期持有节省更多成本",
  "trend_strength": "当前价格相对于200日均线的偏离程度。高位=趋势向上，低位=趋势向下",
  "liquidity": "日均成交量。成交量越大交易越便利，买卖价差越小",
  "lookback": "用于计算动量、波动率等指标的历史数据窗口。例如「6个月」= 用最近半年的数据来计算评分",
  "rebalance": "多久重新调整一次持仓比例。「季度」= 每3个月调整一次，使组合重新回到目标权重",
  "max_holdings": "策略最多持有多少只 ETF，避免持仓过于分散",
  "annual_return": "按年折算后的平均收益率。如果3年总收益30%，年化约9.1%（复利计算）",
  "sharpe_ratio": "每承担一单位风险能赚多少超额收益。>1 算不错，>2 优秀。衡量的是「性价比」",
  "max_drawdown": "历史上从峰值跌到谷底的最大跌幅。-28.5% 表示曾经从最高点跌了28.5%。衡量「最坏情况」下你会亏多少",
  "volatility": "年度化的价格波动标准差。越高 = 风险越大，涨跌都更剧烈",
  "correlation": "衡量 ETF 之间涨跌的同步程度。范围 -1 到 +1。越接近 +1 说明两只 ETF 走势越像，分散效果越差"
}
```

- [ ] **Step 2: Commit**

```bash
git add dictionaries/zh.json
git commit -m "feat: add Chinese tooltip dictionary for investment terminology"
```

---

### Task 17: Tooltip React component

**Files:**
- Create: `components/Tooltip.tsx`

- [ ] **Step 1: Write Tooltip.tsx**

```tsx
'use client';

import { useState } from 'react';
import dictionary from '@/dictionaries/zh.json';

interface TooltipProps {
  term: string;
  children?: React.ReactNode;
}

export function Tooltip({ term, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const text = (dictionary as Record<string, string>)[term];

  if (!text) return children ?? <span>{term}</span>;

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <span className="text-blue-500 text-xs border-b border-dashed border-blue-400">
        ⓘ
      </span>
      {show && (
        <span className="absolute bottom-full left-0 mb-1 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

export function getTooltip(term: string): string {
  return (dictionary as Record<string, string>)[term] || '';
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Tooltip.tsx
git commit -m "feat: add Tooltip component with Chinese investment terminology"
```

---

### Task 18: MetricCard component

**Files:**
- Create: `components/MetricCard.tsx`

- [ ] **Step 1: Write MetricCard.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/MetricCard.tsx
git commit -m "feat: add MetricCard component for backtest performance display"
```

---

### Task 19: StrategySelector component

**Files:**
- Create: `components/StrategySelector.tsx`

- [ ] **Step 1: Write StrategySelector.tsx**

```tsx
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
    const factors = mode === 'classic'
      ? strategies.find(s => s.id === selectedId)?.factors || []
      : customFactors.map(f => ({ ...f, weight: factorWeight[f.name] || 0 }));

    const resp = await fetch('/api/strategies/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'dev-secret-key' },
      body: JSON.stringify({
        strategy_id: mode === 'classic' ? selectedId : -1,
        params: { lookback: '6m', max_holdings: 10 },
      }),
    });
    const data = await resp.json();
    setRecommendations(data.recommendations || []);
    setLoading(false);
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
```

- [ ] **Step 2: Commit**

```bash
git add components/StrategySelector.tsx
git commit -m "feat: add StrategySelector with classic/custom mode and factor builder"
```

---

### Task 20: EtfTable component

**Files:**
- Create: `components/EtfTable.tsx`

- [ ] **Step 1: Write EtfTable.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/EtfTable.tsx
git commit -m "feat: add EtfTable component for multi-ETF comparison with weight editing"
```

---

### Task 21: BacktestChart component

**Files:**
- Create: `components/BacktestChart.tsx`

- [ ] **Step 1: Write BacktestChart.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/BacktestChart.tsx
git commit -m "feat: add BacktestChart with Recharts line chart for NAV display"
```

---

### Task 22: CorrelationHeatmap component

**Files:**
- Create: `components/CorrelationHeatmap.tsx`

- [ ] **Step 1: Write CorrelationHeatmap.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/CorrelationHeatmap.tsx
git commit -m "feat: add CorrelationHeatmap with color-coded correlation matrix"
```

---

### Task 23: Home page (strategies)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ETF 策略投资工具',
  description: '全球 ETF 策略推荐、基金匹配与历史回测',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-white border-b px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">ETF 策略投资工具</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:text-blue-600">策略</a>
              <a href="/compare" className="hover:text-blue-600">对比</a>
              <a href="/backtest" className="hover:text-blue-600">回测</a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Write app/page.tsx**

```tsx
import { StrategySelector } from '@/components/StrategySelector';

export default function HomePage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">选择或定制投资策略</h2>
      <StrategySelector />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: add layout with navigation and home page with strategy selector"
```

---

### Task 24: Compare page

**Files:**
- Create: `app/compare/page.tsx`

- [ ] **Step 1: Write app/compare/page.tsx**

```tsx
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
      // Set equal weights initially
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
```

- [ ] **Step 2: Commit**

```bash
git add app/compare/page.tsx
git commit -m "feat: add compare page with ETF search, comparison table, and correlation heatmap"
```

---

### Task 25: Backtest page

**Files:**
- Create: `app/backtest/page.tsx`

- [ ] **Step 1: Write app/backtest/page.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add app/backtest/page.tsx
git commit -m "feat: add backtest page with form inputs, metric cards, and NAV chart"
```

---

### Task 26: Middleware (API key auth)

**Files:**
- Create: `app/middleware.ts`

- [ ] **Step 1: Write app/middleware.ts**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const WRITE_METHODS = ['POST', 'PUT', 'DELETE'];

export function middleware(req: NextRequest) {
  const method = req.method;
  const path = req.nextUrl.pathname;

  // Only protect write endpoints
  if (path.startsWith('/api/') && WRITE_METHODS.includes(method)) {
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = process.env.API_SECRET_KEY;

    if (!expectedKey) {
      // In dev without the env var set, allow through
      return NextResponse.next();
    }

    if (apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', detail: 'Missing or invalid API key' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

- [ ] **Step 2: Commit**

```bash
git add app/middleware.ts
git commit -m "feat: add API key middleware protecting POST/PUT/DELETE endpoints"
```

---

### Task 27: Vercel configuration

**Files:**
- Create: `vercel.ts`

- [ ] **Step 1: Write vercel.ts**

```ts
import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
  functions: {
    'functions/backtest-engine/index.py': {
      maxDuration: 300,
      memory: 1024,
    },
    'functions/strategy-engine/index.py': {
      maxDuration: 60,
      memory: 512,
    },
    'functions/data-fetcher/index.py': {
      maxDuration: 30,
      memory: 256,
    },
  },
  crons: [
    { path: '/api/data/refresh', schedule: '0 6 * * *' }
  ],
};
```

- [ ] **Step 2: Update .gitignore**

Ensure these lines are in .gitignore:
```
.env.local
.venv/
__pycache__/
*.pyc
.superpowers/
```

- [ ] **Step 3: Install vercel config package**

```bash
npm install @vercel/config
```

- [ ] **Step 4: Commit**

```bash
git add vercel.ts .gitignore package.json package-lock.json
git commit -m "feat: add vercel.ts config and finalize project setup"
```

---

### Task 28: Python venv setup and integration test

**Files:** None new

- [ ] **Step 1: Create Python virtual environment**

```bash
cd C:/ai/investigation
python -m venv .venv
source .venv/Scripts/activate  # Windows Git Bash
# OR: .venv\Scripts\activate   # Windows CMD/PowerShell
pip install -r requirements.txt
```

Expected: All Python packages installed successfully.

- [ ] **Step 2: Verify database connectivity**

```bash
# Start local PostgreSQL if not running
# Then test connection
node -e "const {db} = require('./lib/db'); db.query('SELECT 1').then(r => console.log('DB OK', r.rows[0]))"
```

Expected: DB OK message.

- [ ] **Step 3: Test full flow manually**

```bash
npm run dev
```

Then in another terminal:
```bash
# Test strategy list
curl http://localhost:3000/api/strategies

# Test ETF search
curl "http://localhost:3000/api/etfs?q=SPY"

# Test strategy recommend (with API key)
curl -X POST http://localhost:3000/api/strategies/recommend \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-secret-key-change-in-prod" \
  -d '{"strategy_id":1,"params":{"lookback":"6m","max_holdings":5}}'
```

Expected: JSON responses with strategy list, ETF data, and recommendations.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: finalize dev environment with venv, verify integration"
```

---

## Plan Self-Review

**Spec coverage check:**
- Architecture (Section 3) → Tasks 1, 3-10, 27
- Security (Section 4) → Task 26
- API design (Section 5) → Tasks 11-15
- Input validation (Section 6) → Embedded in Tasks 11, 14
- Database (Section 7) → Task 2
- UI (Section 8) → Tasks 17-25
- Error handling (Section 9) → Embedded in Python functions and API routes
- Project structure (Section 10) → All tasks
- Local dev (Section 11) → Task 28
- Vercel deploy (Section 12) → Task 27
- Factor system (Section 13) → Tasks 5-6

**Placeholder scan:** No TBD, TODO, or vague instructions found.

**Type consistency check:**
- `EtfRecommendation.factor_scores: Record<string, number>` used consistently across types.ts, StrategySelector.tsx, and route handlers
- `BacktestResult.daily_nav: NavPoint[]` matches BacktestChart props
- Python `score` field name matches TypeScript `score` — no snake_case/camelCase mismatch (Python functions use dicts with `score` key, TypeScript consumes via JSON)
- `validateWeights` / `validateFactorWeights` called with correct argument types in API routes
