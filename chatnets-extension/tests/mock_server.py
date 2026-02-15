#!/usr/bin/env python3
"""
Mock Backend Server for Chatnets Extension Testing
Simulates the chatnets-server API endpoints for testing
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import datetime

# In-memory storage
mock_data = {
    "sessions": {},
    "messages": [],
    "pipeline_triggers": []
}


class MockRequestHandler(BaseHTTPRequestHandler):
    """Handle HTTP requests mimicking chatnets-server"""

    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[Mock Server] {self.address_string()} - {format % args}")

    def send_json(self, data, status=200):
        """Send JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def send_text(self, text, status=200):
        """Send text response"""
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(text.encode())

    def do_GET(self):
        """Handle GET requests"""
        path = urlparse(self.path).path

        # Health check
        if path == '/health':
            self.send_text('OK')
            print("[Mock Server] Health check OK")
            return

        # Graph query
        if path == '/api/v1/graph/query':
            nodes = [
                {
                    "id": f"node-{sid}",
                    "type": "session",
                    "session_id": sid,
                    "title": session["title"],
                    "summary": "Test summary",
                    "created_at": datetime.datetime.now().isoformat(),
                    "visible_by_default": True
                }
                for sid, session in mock_data["sessions"].items()
            ]

            self.send_json({"nodes": nodes, "edges": []})
            print(f"[Mock Server] Graph query returned {len(nodes)} nodes")
            return

        # 404
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        """Handle POST requests"""
        path = urlparse(self.path).path

        # Message ingestion
        if path == '/api/v1/ingest/messages':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode())

            print(f"[Mock Server] Received {len(data.get('messages', []))} messages from {data.get('source', 'unknown')}")

            # Store messages
            for msg in data.get('messages', []):
                mock_data["messages"].append(msg)
                sid = msg.get('session_id')
                if sid and sid not in mock_data["sessions"]:
                    mock_data["sessions"][sid] = {
                        "id": sid,
                        "platform": data.get('source', 'unknown'),
                        "title": msg.get('title', 'Test Session'),
                        "url": msg.get('url', ''),
                        "started_at": msg.get('created_at'),
                    }

            self.send_json({"success": True, "count": len(data.get('messages', []))}, 201)
            return

        # Pipeline trigger
        if path == '/api/v1/pipeline/trigger':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode())

            print(f"[Mock Server] Pipeline trigger for session: {data.get('session_id')}")
            mock_data["pipeline_triggers"].append(data)

            self.send_json({
                "success": True,
                "message": "Pipeline triggered successfully",
                "pipeline_id": data.get('session_id')
            })
            return

        # 404
        self.send_json({"error": "Not found"}, 404)


def run_server(port=8765):
    """Start the mock server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, MockRequestHandler)

    print(f"[Mock Server] Starting on port {port}")
    print(f"[Mock Server] Health check: http://127.0.0.1:{port}/health")
    print(f"[Mock Server] Press Ctrl+C to stop")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Mock Server] Shutting down")
        httpd.shutdown()


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    run_server(port)
