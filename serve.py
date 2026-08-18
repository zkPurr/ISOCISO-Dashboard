#!/usr/bin/env python3
"""
Dev server for the dashboard.

`python3 -m http.server` sends no cache headers, which leaves the browser to
guess — and it guesses "reuse". For an app made of unhashed ES modules that
import each other, that is not a stale-by-a-bit app: an old module next to a
fresh one still imports fine, then throws on the interface that changed, and
the whole render dies leaving an empty shell. It also only shows up once you
close DevTools, because "Disable cache" is what was hiding it.

So: no-store on everything. Same reason nginx.conf sends no-cache in the image.

    python3 serve.py [port]        # default 8080
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # The default logger prints a line per module request — too noisy to read.
        if '200' not in (args[1] if len(args) > 1 else ''):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(NoCacheHandler, directory='.')
    with ThreadingHTTPServer(('', port), handler) as httpd:
        print(f'Dashboard op http://localhost:{port}  (geen caching — Ctrl+C om te stoppen)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nGestopt.')


if __name__ == '__main__':
    main()
