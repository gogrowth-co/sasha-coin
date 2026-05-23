#!/usr/bin/env bash
# Usage: access-token.sh [account]
# account: "manga82" or omit for default (gabriel.mangabeira@opascope.com)
# Prints a fresh Google OAuth access token to stdout.
# All other scripts call this at the top.

set -euo pipefail

# Find the workspace .env. Strategy:
#   1. Use $WORKSPACE_ENV if set (explicit override)
#   2. Use $PWD/.env if running from a project root (typical Claude Code invocation)
#   3. Walk up from the script location looking for .env
ENV_FILE=""
if [ -n "${WORKSPACE_ENV:-}" ] && [ -f "$WORKSPACE_ENV" ]; then
  ENV_FILE="$WORKSPACE_ENV"
elif [ -f "$PWD/.env" ]; then
  ENV_FILE="$PWD/.env"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  DIR="$SCRIPT_DIR"
  while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
    if [ -f "$DIR/.env" ]; then
      ENV_FILE="$DIR/.env"
      break
    fi
    DIR="$(dirname "$DIR")"
  done
fi

# Safely load specific vars from .env without sourcing the whole file
_load_var() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-
}

if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-$(_load_var GOOGLE_CLIENT_ID)}"
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-$(_load_var GOOGLE_CLIENT_SECRET)}"
  GOOGLE_REFRESH_TOKEN="${GOOGLE_REFRESH_TOKEN:-$(_load_var GOOGLE_REFRESH_TOKEN)}"
  GOOGLE_REFRESH_TOKEN_MANGA82="${GOOGLE_REFRESH_TOKEN_MANGA82:-$(_load_var GOOGLE_REFRESH_TOKEN_MANGA82)}"
fi

ACCOUNT="${1:-default}"

if [ "$ACCOUNT" = "manga82" ]; then
  REFRESH="${GOOGLE_REFRESH_TOKEN_MANGA82:-}"
else
  REFRESH="${GOOGLE_REFRESH_TOKEN:-}"
fi

if [ -z "${GOOGLE_CLIENT_ID:-}" ] || [ -z "${GOOGLE_CLIENT_SECRET:-}" ]; then
  echo "ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in .env" >&2
  exit 1
fi

if [ -z "$REFRESH" ]; then
  echo "ERROR: No refresh token for account '$ACCOUNT'. Run get-token.py first." >&2
  exit 1
fi

curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=${GOOGLE_CLIENT_ID}" \
  -d "client_secret=${GOOGLE_CLIENT_SECRET}" \
  -d "refresh_token=${REFRESH}" \
  -d "grant_type=refresh_token" \
  > /tmp/gw_token.json

python3 -c "
import json, sys
d = json.load(open('/tmp/gw_token.json'))
if 'access_token' not in d:
    print('ERROR: ' + d.get('error_description', str(d)), file=sys.stderr)
    sys.exit(1)
print(d['access_token'], end='')
"
