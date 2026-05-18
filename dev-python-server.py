"""Local Python dev server — runs all 3 function handlers on one port."""
import sys
import os
import json
import io
import importlib.util
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.abspath(__file__))

def _load_handler(module_path, file_name):
    """Load a Python module from a file path and return its handler class."""
    full_path = os.path.join(BASE, 'functions', module_path, file_name)
    spec = importlib.util.spec_from_file_location(
        module_path.replace('-', '_'), full_path
    )
    mod = importlib.util.module_from_spec(spec)
    # Inject data-fetcher path so relative imports work
    data_fetcher_path = os.path.join(BASE, 'functions', 'data-fetcher')
    if data_fetcher_path not in sys.path:
        sys.path.insert(0, data_fetcher_path)
    spec.loader.exec_module(mod)
    return mod.handler

DataFetcherHandler = _load_handler('data-fetcher', 'index.py')
StrategyEngineHandler = _load_handler('strategy-engine', 'index.py')
BacktestEngineHandler = _load_handler('backtest-engine', 'index.py')


class RouterHandler(BaseHTTPRequestHandler):
    """Routes requests to the appropriate function handler based on URL path."""

    def do_POST(self):
        path = urlparse(self.path).path

        if '/strategy-engine' in path:
            self._delegate(StrategyEngineHandler)
        elif '/backtest-engine' in path:
            self._delegate(BacktestEngineHandler)
        elif '/data-fetcher' in path:
            self._delegate(DataFetcherHandler)
        else:
            self._send_json(404, {"error": "Not found", "path": path})

    def _delegate(self, HandlerClass):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length > 0 else b''

        # Create a mini-request for the sub-handler
        sub_handler = HandlerClass(self.request, self.client_address, self.server)
        sub_handler.rfile = io.BytesIO(body)
        sub_handler.wfile = io.BytesIO()
        sub_handler.path = self.path
        sub_handler.headers = self.headers

        try:
            sub_handler.do_POST()
            # Read response from the sub-handler's wfile
            sub_handler.wfile.seek(0)
            response_data = sub_handler.wfile.read()
            # Parse status and body
            # The BaseHTTPRequestHandler writes full response, we proxy it back
            # Since we can't easily extract status from sub_handler, re-invoke
            self._proxy_response(sub_handler, body)
        except Exception as e:
            self._send_json(500, {"error": "HANDLER_FAILED", "detail": str(e)})

    def _proxy_response(self, sub_handler, body):
        """Re-execute the handler and capture its output to proxy back."""
        # Simpler approach: just call the sub-handler's internal methods directly
        sub_handler.rfile = io.BytesIO(body)
        sub_handler.wfile = self.wfile
        sub_handler.do_POST()

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, format, *args):
        print(f"[python-server] {args[0]}")


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    server = HTTPServer(('localhost', port), RouterHandler)
    print(f'Python dev server running on http://localhost:{port}')
    print(f'  /strategy-engine  → strategy engine')
    print(f'  /backtest-engine  → backtest engine (use /run or /compare in path)')
    print(f'  /data-fetcher     → data fetcher')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
