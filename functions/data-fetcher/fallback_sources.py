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
