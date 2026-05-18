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
