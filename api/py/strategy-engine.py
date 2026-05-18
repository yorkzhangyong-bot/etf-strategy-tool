"""strategy-engine Vercel Python Function."""
import sys, os
BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(BASE, 'functions', 'data-fetcher'))
sys.path.insert(0, os.path.join(BASE, 'functions', 'strategy-engine'))

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime, timedelta
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

            lookback_str = params.get("lookback", "6m")
            lookback_months = int(lookback_str.replace("m", "").replace("mo", ""))
            end_date = datetime.now().strftime("%Y-%m-%d")
            start_date = (datetime.now() - timedelta(days=(lookback_months + 12) * 30)).strftime("%Y-%m-%d")

            etf_scores = []
            for ticker in etf_tickers:
                prices_df = fetch_history(ticker, start_date, end_date)
                if prices_df is None or prices_df.empty:
                    continue
                info = fetch_info(ticker) or {}
                scores = calculate_factor_scores(0, ticker, prices_df, info, strategy_factors, params)
                etf_scores.append({"ticker": ticker, "name": info.get("name", ticker), "scores": scores})

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
