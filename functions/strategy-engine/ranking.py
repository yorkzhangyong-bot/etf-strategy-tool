"""Multi-factor weighted ranking."""

import numpy as np


def rank_etfs(
    etf_scores: list[dict],
    factor_weights: list[dict],
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
                    normalized[fn].append(50.0)
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
