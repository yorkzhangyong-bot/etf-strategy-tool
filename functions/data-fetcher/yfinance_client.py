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
