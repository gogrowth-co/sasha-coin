#!/usr/bin/env bash
# Usage: sheet-append.sh <spreadsheetId> <range> <rows.json>
# Appends rows to a Google Sheet.
# rows.json must contain: {"values": [["col1", "col2", ...], ...]}
# Example: echo '{"values":[["2026-05-04","CE-042","done"]]}' > /tmp/rows.json
#          sheet-append.sh SHEET_ID "Sheet1!A:C" /tmp/rows.json

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

SHEET_ID="${1:?Usage: sheet-append.sh <spreadsheetId> <range> <rows.json>}"
RANGE="${2:?Usage: sheet-append.sh <spreadsheetId> <range> <rows.json>}"
ROWS_FILE="${3:?Usage: sheet-append.sh <spreadsheetId> <range> <rows.json>}"

ENCODED_RANGE=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${RANGE}'))")

curl -s -X POST \
  "https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${ENCODED_RANGE}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "@${ROWS_FILE}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR:', d['error']['message'], file=sys.stderr)
    sys.exit(1)
updates = d.get('updates', {})
print(f'Appended {updates.get(\"updatedRows\",\"?\")} rows to {updates.get(\"updatedRange\",\"\")}')
"
