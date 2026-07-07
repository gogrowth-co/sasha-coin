#!/usr/bin/env bash
# Create a Browser Use Cloud session, poll it to completion, print the result.
# Usage: run-task.sh "<task instruction>" [--model MODEL] [--max-cost USD] [--keep-alive] [--timeout SECONDS]
set -euo pipefail

TASK="${1:?Usage: run-task.sh \"<task instruction>\" [--model MODEL] [--max-cost USD] [--keep-alive] [--timeout SECONDS]}"
shift || true

MODEL=""
MAX_COST=""
KEEP_ALIVE="false"
TIMEOUT=300

while [ $# -gt 0 ]; do
  case "$1" in
    --model) MODEL="$2"; shift 2 ;;
    --max-cost) MAX_COST="$2"; shift 2 ;;
    --keep-alive) KEEP_ALIVE="true"; shift ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

: "${BROWSER_USE_API:=${BROWSER_USE_API_KEY:-}}"
if [ -z "$BROWSER_USE_API" ]; then
  echo "No BROWSER_USE_API / BROWSER_USE_API_KEY found in environment. Source .env first." >&2
  exit 1
fi

API="https://api.browser-use.com/api/v3"
BODY=$(TASK="$TASK" MODEL="$MODEL" MAX_COST="$MAX_COST" KEEP_ALIVE="$KEEP_ALIVE" python3 -c '
import json, os
body = {"task": os.environ["TASK"], "keepAlive": os.environ["KEEP_ALIVE"] == "true"}
if os.environ["MODEL"]:
    body["model"] = os.environ["MODEL"]
if os.environ["MAX_COST"]:
    body["maxCostUsd"] = os.environ["MAX_COST"]
print(json.dumps(body))
')

CREATE_RESP=$(curl -s -X POST "$API/sessions" \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API" \
  -H "Content-Type: application/json" \
  -d "$BODY")

SESSION_ID=$(echo "$CREATE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' 2>/dev/null) || {
  echo "Failed to create session:" >&2
  echo "$CREATE_RESP" >&2
  exit 1
}

LIVE_URL=$(echo "$CREATE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("liveUrl") or "")')
echo "session $SESSION_ID created. live: $LIVE_URL" >&2

ELAPSED=0
INTERVAL=5
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
  STATUS_RESP=$(curl -s "$API/sessions/$SESSION_ID" -H "X-Browser-Use-API-Key: $BROWSER_USE_API")
  STATUS=$(echo "$STATUS_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  if [ "$STATUS" != "running" ] && [ "$STATUS" != "pending" ]; then
    echo "$STATUS_RESP"
    exit 0
  fi
done

echo "Timed out after ${TIMEOUT}s waiting on session $SESSION_ID (still running). Check with get-task.sh $SESSION_ID or stop it with stop-task.sh $SESSION_ID." >&2
exit 2