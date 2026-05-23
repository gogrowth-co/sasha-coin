#!/usr/bin/env python3
"""
One-time OAuth 2.0 flow to get a Google refresh token.
Requires: ~/.config/google-workspace/oauth-client.json (downloaded from GCP Console)
Run: python3 .claude/skills/google-workspace/scripts/get-token.py
"""

import json
import os
import sys
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import requests

SCOPES = " ".join([
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
])

REDIRECT_URI = "http://localhost:8080"

def load_env(workspace_root="."):
    env_path = Path(workspace_root) / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

def load_client():
    load_env()
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()

    if not client_id:
        client_id = input("Client ID: ").strip()
    if not client_secret:
        client_secret = input("Client Secret: ").strip()

    if not client_id or not client_secret:
        print("ERROR: Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.")
        sys.exit(1)

    return client_id, client_secret

auth_code = None

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        if "code" in params:
            auth_code = params["code"][0]
            self.wfile.write(b"<h2>Auth complete. Return to terminal.</h2>")
        elif "error" in params:
            self.wfile.write(f"<h2>Error: {params['error'][0]}</h2>".encode())
        else:
            self.wfile.write(b"<h2>No code received.</h2>")

    def log_message(self, *args):
        pass  # suppress request logs

def main():
    client_id, client_secret = load_client()

    auth_url = (
        "https://accounts.google.com/o/oauth2/auth?"
        + urllib.parse.urlencode({
            "client_id": client_id,
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPES,
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",  # forces refresh_token in response
        })
    )

    print("Starting local server on http://localhost:8080 ...")
    print("Opening browser for Google consent...\n")
    server = HTTPServer(("localhost", 8080), CallbackHandler)
    webbrowser.open(auth_url)
    server.handle_request()  # blocks until the redirect arrives

    if not auth_code:
        print("ERROR: No authorization code received.")
        sys.exit(1)

    print("Exchanging code for tokens...")
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": auth_code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    tokens = resp.json()

    if "refresh_token" not in tokens:
        print("ERROR: No refresh_token in response:")
        print(json.dumps(tokens, indent=2))
        print("\nTip: If you see 'invalid_grant', the consent screen may not be in test mode")
        print("     or this account wasn't added as a test user. Check GCP Console → OAuth consent screen.")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("SUCCESS. Add these to your .env file:")
    print("=" * 60)
    print(f"GOOGLE_CLIENT_ID={client_id}")
    print(f"GOOGLE_CLIENT_SECRET={client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={tokens['refresh_token']}")
    print("=" * 60)
    print(f"\nAccess token (valid 1h, for testing): {tokens.get('access_token','')[:40]}...")

if __name__ == "__main__":
    main()
