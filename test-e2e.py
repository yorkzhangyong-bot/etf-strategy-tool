"""E2E test — real data from yfinance, full strategy → rank → backtest flow."""
import sys
import os
import json

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE, 'functions', 'data-fetcher'))
sys.path.insert(0, os.path.join(BASE, 'functions', 'strategy-engine'))
sys.path.insert(0, os.path.join(BASE, 'functions', 'backtest-engine'))

from yfinance_client import fetch_history, fetch_info
from factors import calculate_factor_scores
from ranking import rank_etfs
from metrics import compute_metrics
from simulation import simulate_portfolio, generate_comparison_data

TEST_ETFS = ['SPY', 'QQQ', 'VTI', 'IWM']
TEST_FACTORS = [
    {"name": "momentum", "weight": 40},
    {"name": "low_vol", "weight": 30},
    {"name": "size", "weight": 20},
    {"name": "expense", "weight": 10},
]
PARAMS = {"lookback": "6m", "max_holdings": 5}

print("=" * 60)
print("E2E TEST: ETF Strategy Investment Tool")
print("=" * 60)

# 1. Data Fetching
print("\n[1/5] Fetching ETF data via yfinance...")
price_data = {}
etf_info = {}
for ticker in TEST_ETFS:
    df = fetch_history(ticker, "2020-01-01", "2026-01-01")
    info = fetch_info(ticker)
    if df is not None and not df.empty:
        price_data[ticker] = df
        etf_info[ticker] = info or {}
        print(f"  [OK] {ticker}: {len(df)} days of data, name={info.get('name', 'N/A')}")
    else:
        print(f"  [FAIL] {ticker}: FAILED")

assert len(price_data) >= 2, f"Need at least 2 ETFs, got {len(price_data)}"

# 2. Factor Scoring
print("\n[2/5] Computing factor scores...")
etf_scores = []
for ticker in TEST_ETFS:
    if ticker in price_data:
        scores = calculate_factor_scores(0, ticker, price_data[ticker], etf_info.get(ticker, {}), TEST_FACTORS, PARAMS)
        print(f"  {ticker}: {json.dumps(scores, indent=2)}")
        etf_scores.append({"ticker": ticker, "name": etf_info[ticker].get('name', ticker), "scores": scores})

assert len(etf_scores) > 0, "No ETF scores computed"

# 3. Ranking
print("\n[3/5] Ranking ETFs by weighted score...")
ranked = rank_etfs(etf_scores, TEST_FACTORS)
for i, r in enumerate(ranked):
    print(f"  #{i+1}: {r['ticker']} — score={r['score']} — {r['factor_scores']}")

assert len(ranked) > 0, "No ranking results"
assert ranked[0]['score'] > 0, "Top score should be > 0"

# 4. Comparison
print("\n[4/5] Comparing ETFs...")
price_dict = {}
for ticker in TEST_ETFS:
    if ticker in price_data:
        df = price_data[ticker]
        price_dict[ticker] = [{"date": str(idx.date()), "close": float(row["Close"])} for idx, row in df.iterrows()]

comparison, corr = generate_comparison_data(price_dict, list(price_dict.keys()), 36)
print(f"  Correlation matrix ({len(corr)}x{len(corr)}):")
for row in corr:
    print(f"    {row}")
for c in comparison:
    print(f"  {c['ticker']}: return={c.get('annual_return',0):.1%} sharpe={c.get('sharpe',0):.2f} vol={c.get('volatility',0):.1%} maxDD={c.get('max_drawdown',0):.1%}")

assert len(comparison) >= 2, "Need at least 2 ETFs for comparison"
assert len(corr) == len(comparison), "Correlation matrix size mismatch"

# 5. Portfolio Backtest
print("\n[5/5] Running portfolio backtest...")
n = len(price_dict)
weights = [1.0 / n] * n
tickers = list(price_dict.keys())
nav = simulate_portfolio(price_dict, weights, tickers, "2020-01-01", "2025-12-31")
metrics = compute_metrics(nav)

print(f"  Annual return:  {metrics['annual_return']:.2%}")
print(f"  Sharpe ratio:   {metrics['sharpe_ratio']:.2f}")
print(f"  Max drawdown:   {metrics['max_drawdown']:.2%}")
print(f"  Volatility:     {metrics['volatility']:.2%}")
print(f"  Total return:   {metrics['total_return']:.2%}")
print(f"  Years:          {metrics['years']}")
print(f"  NAV points:     {len(nav)}")

assert metrics['annual_return'] != 0, "Annual return should not be zero"
assert len(nav) > 100, f"Should have 100+ daily NAV points, got {len(nav)}"

print("\n" + "=" * 60)
print("ALL E2E TESTS PASSED [OK]")
print("=" * 60)
print(f"\n  ETFs tested:  {', '.join(TEST_ETFS)}")
print(f"  Factors used: {', '.join(f['name'] for f in TEST_FACTORS)}")
print(f"  Top pick:     {ranked[0]['ticker']} (score: {ranked[0]['score']})")
print(f"  Strategy:     Equal-weight {n}-ETF portfolio")
print(f"  Period:       2020-2025")
print(f"  Return:       {metrics['annual_return']:.2%} annualized")
print(f"  Sharpe:       {metrics['sharpe_ratio']:.2f}")
