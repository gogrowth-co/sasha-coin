#!/usr/bin/env bash
# Fetch current status/result of a Browser Use Cloud session without blocking.
# Usage: get-task.sh SESSION_ID
set -euo pipefail

SESSION_ID="${1:?Usage: get-task.sh SESSION_ID}"

: "${BROWSER_USE_API:=${BROWSER_USE_API_KEY:-}}"
if [ -z "$BROWSER_USE_API" ]; then
  echo "No BROWSER_USE_API / BROWSER_USE_API_KEY found in environment. Source .env first." >&2
  exit 1
fi

curl -s "https://api.browser-use.com/api/v3/sessions/$SESSION_ID" \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API"