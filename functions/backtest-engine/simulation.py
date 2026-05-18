"""Portfolio simulation engine."""

import pandas as pd
import numpy as np
from typing import Optional


def simulate_portfolio(
    price_data: dict[str, list[dict]],
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
    combined = combined.dropna()

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
