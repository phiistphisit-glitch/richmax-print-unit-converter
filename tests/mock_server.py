# Serves the app and records POSTs (stands in for the Apps Script web app).
import http.server, json, os, sys
ROOT = sys.argv[1]; POSTS = []
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def do_POST(s):
        body = s.rfile.read(int(s.headers.get('Content-Length', 0))).decode('utf-8')
        POSTS.append({'path': s.path, 'ctype': s.headers.get('Content-Type'), 'body': body})
        s.send_response(200); s.send_header('Content-Type', 'application/json'); s.end_headers(); s.wfile.write(b'{"ok":true}')
    def do_GET(s):
        if s.path.startswith('/__posts'):
            d = json.dumps(POSTS).encode(); s.send_response(200); s.send_header('Content-Type','application/json'); s.end_headers(); s.wfile.write(d); return
        if s.path.startswith('/__reset'):
            POSTS.clear(); s.send_response(200); s.end_headers(); return
        super().do_GET()
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()
