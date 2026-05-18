"""backtest-engine Vercel Python Function."""
import sys, os
BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(BASE, 'functions', 'data-fetcher'))
sys.path.insert(0, os.path.join(BASE, 'functions', 'backtest-engine'))

from http.server import BaseHTTPRequestHandler
import json
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
                self._send_json(400, {"error": "UNKNOWN_ACTION", "detail": f"Unknown path: {self.path}"})
                return
            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": "BACKTEST_FAILED", "detail": str(e), "partial_data": False})

    def _handle_run(self, body):
        tickers = body.get("etf_tickers", [])
        weights = body.get("weights", [])
        start = body.get("start_date", "2020-01-01")
        end = body.get("end_date", "2025-12-31")

        price_data = {}
        aligned_weights = []
        failed = []
        for i, ticker in enumerate(tickers):
            df = fetch_history(ticker, start, end)
            if df is not None and not df.empty:
                price_data[ticker] = [{"date": str(idx.date()), "close": float(row["Close"])} for idx, row in df.iterrows()]
                aligned_weights.append(weights[i] if i < len(weights) else 0)
            else:
                failed.append(ticker)

        if not price_data:
            return {"error": "BACKTEST_FAILED", "detail": f"Cannot fetch data for any: {tickers}", "partial_data": False}

        weight_sum = sum(aligned_weights)
        if weight_sum > 0:
            aligned_weights = [w / weight_sum for w in aligned_weights]

        nav = simulate_portfolio(price_data, aligned_weights, list(price_data.keys()), start, end)
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
        price_data = {}
        failed = []
        for ticker in tickers:
            df = fetch_history(ticker, "2016-01-01", "2026-01-01")
            if df is not None and not df.empty:
                price_data[ticker] = [{"date": str(idx.date()), "close": float(row["Close"])} for idx, row in df.iterrows()]
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
