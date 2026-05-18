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
