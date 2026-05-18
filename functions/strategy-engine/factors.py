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
    """Return value score based on P/E. Lower P/E = higher score."""
    pe = etf_info.get("trailingPE") or etf_info.get("forwardPE")
    if pe is None or pe <= 0:
        return None
    return float(-pe)


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
