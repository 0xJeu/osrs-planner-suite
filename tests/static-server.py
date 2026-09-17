"""Static file server for the Playwright suite.

`python3 -m http.server` speaks HTTP/1.0, so it closes the socket after every
response. Each page pulls a couple dozen local icons, and with fullyParallel
workers that turns into hundreds of short-lived connections - enough to produce
dropped requests and BrokenPipeError noise, which then surfaces as bogus
"console errors on <page>" failures unrelated to any real change.

Keep-alive plus threading makes the suite deterministic.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class KeepAliveHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass  # keep the Playwright reporter readable


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8532
    ThreadingHTTPServer(("127.0.0.1", port), KeepAliveHandler).serve_forever()
