"""Local Python dev server for ETF Strategy Tool — runs on port 3001."""
import sys, os, json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE, 'functions', 'data-fetcher'))
sys.path.insert(0, os.path.join(BASE, 'functions', 'strategy-engine'))
sys.path.insert(0, os.path.join(BASE, 'functions', 'backtest-engine'))

from yfinance_client import fetch_history, fetch_info
from factors import calculate_factor_scores
from ranking import rank_etfs
from metrics import compute_metrics
from simulation import simulate_portfolio, generate_comparison_data


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        try:
            if '/strategy-engine' in path:
                result = self._strategy(body)
            elif '/backtest-engine/run' in path:
                result = self._backtest_run(body)
            elif '/backtest-engine/compare' in path:
                result = self._backtest_compare(body)
            elif '/data-fetcher' in path:
                result = self._data_fetcher(body)
            else:
                result = (400, {"error": "NOT_FOUND", "path": path})
            if isinstance(result, tuple):
                self._json(result[0], result[1])
            else:
                self._json(200, result)
        except Exception as e:
            self._json(500, {"error": "INTERNAL", "detail": str(e)})

    def _strategy(self, body):
        factors = body.get("factors", [])
        params = body.get("params", {"lookback": "6m", "max_holdings": 10})
        tickers = body.get("etf_tickers", [])

        lookback_str = params.get("lookback", "6m")
        lookback_m = int(lookback_str.replace("m", "").replace("mo", ""))
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=(lookback_m + 12) * 30)).strftime("%Y-%m-%d")

        etf_scores = []
        for ticker in tickers:
            df = fetch_history(ticker, start, end)
            if df is None or df.empty:
                continue
            info = fetch_info(ticker) or {}
            scores = calculate_factor_scores(0, ticker, df, info, factors, params)
            etf_scores.append({"ticker": ticker, "name": info.get("name", ticker), "scores": scores})

        ranked = rank_etfs(etf_scores, factors)
        return {"recommendations": ranked[:params.get("max_holdings", 10)]}

    def _backtest_run(self, body):
        tickers = body.get("etf_tickers", [])
        weights = body.get("weights", [])
        start = body.get("start_date", "2020-01-01")
        end = body.get("end_date", "2025-12-31")

        price_data, aligned_w, failed = {}, [], []
        for i, t in enumerate(tickers):
            df = fetch_history(t, start, end)
            if df is not None and not df.empty:
                price_data[t] = [{"date": str(idx.date()), "close": float(r["Close"])} for idx, r in df.iterrows()]
                aligned_w.append(weights[i] if i < len(weights) else 0)
            else:
                failed.append(t)

        if not price_data:
            return (500, {"error": "BACKTEST_FAILED", "detail": "No data for any ticker"})

        wsum = sum(aligned_w)
        if wsum > 0:
            aligned_w = [w / wsum for w in aligned_w]

        nav = simulate_portfolio(price_data, aligned_w, list(price_data.keys()), start, end)
        if not nav:
            return (500, {"error": "BACKTEST_FAILED", "detail": "No simulation results"})

        m = compute_metrics(nav)
        result = {"annual_return": m["annual_return"], "sharpe_ratio": m["sharpe_ratio"],
                  "max_drawdown": m["max_drawdown"], "volatility": m["volatility"],
                  "daily_nav": nav, "data_freshness": "stale" if failed else "live"}
        if failed:
            result["partial_data"] = True
            result["failed_tickers"] = failed
        return result

    def _backtest_compare(self, body):
        tickers = body.get("etf_tickers", [])
        lookback = body.get("lookback_months", 36)

        price_data, failed = {}, []
        for t in tickers:
            df = fetch_history(t, "2016-01-01", "2026-01-01")
            if df is not None and not df.empty:
                price_data[t] = [{"date": str(idx.date()), "close": float(r["Close"])} for idx, r in df.iterrows()]
            else:
                failed.append(t)

        comparison, corr = generate_comparison_data(price_data, list(price_data.keys()), lookback)
        result = {"comparison": comparison, "correlation_matrix": corr}
        if failed:
            result["partial_data"] = True
            result["failed_tickers"] = failed
        return result

    def _data_fetcher(self, body):
        if '/fetch-info' in self.path:
            info = fetch_info(body.get("ticker", ""))
            return info if info else (500, {"error": "FETCH_FAILED"})
        elif '/fetch-history' in self.path:
            df = fetch_history(body.get("ticker", ""), body.get("start_date", "2020-01-01"), body.get("end_date", "2025-12-31"))
            if df is None:
                return (500, {"error": "FETCH_FAILED"})
            prices = [{"date": str(idx.date()), "close": float(r["Close"])} for idx, r in df.iterrows()]
            return {"ticker": body["ticker"], "prices": prices}
        return (400, {"error": "UNKNOWN"})

    def _json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, fmt, *args):
        print(f"[py:{self.path}] {args[0]}")


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    HTTPServer(('localhost', port), Handler).serve_forever()
