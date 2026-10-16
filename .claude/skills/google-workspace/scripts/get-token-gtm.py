#!/usr/bin/env python3
"""OAuth flow for the manga82 Google account with Tag Manager scopes.

Unlike get-token.py, this NEVER prints token values. It writes
GOOGLE_REFRESH_TOKEN_MANGA82 directly into the workspace .env.

Usage: python3 get-token-gtm.py  (run from the marketing workspace root)
Opens a browser; sign in with manga82@gmail.com and approve.
"""
import json
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import webbrowser

import requests

SCOPES = " ".join([
    # keep the workspace scopes so this token can serve everything
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    # added 2026-09-29 (account consolidation): Gmail + Search Console so manga82 can replace the default account
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/webmasters",
    # Tag Manager
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.publish",
    "https://www.googleapis.com/auth/tagmanager.manage.users",
    # Analytics. analytics.edit is what the GA4 Admin API needs to mark key
    # events; analytics.readonly keeps Data API reporting on the same token.
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/analytics.edit",
    # added 2026-10-01 (Manga OS V4 Money page): read-only AdSense earnings
    "https://www.googleapis.com/auth/adsense.readonly",
])

REDIRECT_URI = "http://localhost:8080"
ENV_KEY = "GOOGLE_REFRESH_TOKEN_MANGA82"

auth_code = None


class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        auth_code = (params.get("code") or [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        msg = "Authorized. You can close this tab." if auth_code else "No code received."
        self.wfile.write(f"<h2>{msg}</h2>".encode())

    def log_message(self, *args):
        pass


def load_env_var(env_path, key):
    for line in env_path.read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return None


def save_env_var(env_path, key, value):
    lines = env_path.read_text().splitlines()
    out, done = [], False
    for line in lines:
        if line.startswith(key + "="):
            out.append(f"{key}={value}")
            done = True
        else:
            out.append(line)
    if not done:
        out.append(f"{key}={value}")
    env_path.write_text("\n".join(out) + "\n")


def main():
    env_path = Path(".env")
    if not env_path.exists():
        print("ERROR: run from the workspace root containing .env")
        sys.exit(1)
    client_id = load_env_var(env_path, "GOOGLE_CLIENT_ID")
    client_secret = load_env_var(env_path, "GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("ERROR: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env")
        sys.exit(1)

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent select_account",
        "login_hint": "manga82@gmail.com",
    })

    print("Waiting for browser consent on http://localhost:8080 ...")
    server = HTTPServer(("localhost", 8080), CallbackHandler)
    webbrowser.open(auth_url)
    server.handle_request()

    if not auth_code:
        print("ERROR: no authorization code received")
        sys.exit(1)

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
        safe = {k: v for k, v in tokens.items() if k not in ("refresh_token", "access_token", "id_token")}
        print("ERROR: no refresh_token in response:", json.dumps(safe))
        print("Tip: account may not be a test user on the OAuth consent screen.")
        sys.exit(1)

    save_env_var(env_path, ENV_KEY, tokens["refresh_token"])
    print(f"SUCCESS: {ENV_KEY} saved to .env (value not displayed).")


if __name__ == "__main__":
    main()