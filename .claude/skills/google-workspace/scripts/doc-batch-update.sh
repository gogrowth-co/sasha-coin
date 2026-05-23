#!/usr/bin/env bash
# Usage: doc-batch-update.sh <docId> <requests.json>
# Runs a batchUpdate on a Google Doc.
# requests.json must be a file containing: {"requests": [...]}
# This is the core operation used by google-doc-formatter.

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

DOC_ID="${1:?Usage: doc-batch-update.sh <docId> <requests.json>}"
PAYLOAD="${2:?Usage: doc-batch-update.sh <docId> <requests.json>}"

if [ ! -f "$PAYLOAD" ]; then
  echo "ERROR: $PAYLOAD not found" >&2
  exit 1
fi

RESULT=$(curl -s -X POST \
  "https://docs.googleapis.com/v1/documents/${DOC_ID}:batchUpdate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "@${PAYLOAD}")

python3 -c "
import json, sys
d = json.loads('$RESULT' if False else open('/dev/stdin').read())
if 'error' in d:
    print('ERROR:', d['error']['message'], file=sys.stderr)
    sys.exit(1)
replies = d.get('replies', [])
print(f'batchUpdate OK — {len(replies)} operations applied')
print(f'Doc: https://docs.google.com/document/d/${DOC_ID}/edit')
" <<< "$RESULT"
