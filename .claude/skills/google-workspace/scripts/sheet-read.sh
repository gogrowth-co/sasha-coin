#!/usr/bin/env bash
# Usage: sheet-read.sh <spreadsheetId> <range>
# Reads values from a Google Sheet range.
# Example: sheet-read.sh 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms "Sheet1!A1:E20"

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

SHEET_ID="${1:?Usage: sheet-read.sh <spreadsheetId> <range>}"
RANGE="${2:?Usage: sheet-read.sh <spreadsheetId> <range>}"

curl -s "https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/$(python3 -c "import urllib.parse; print(urllib.parse.quote('${RANGE}'))")" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR:', d['error']['message'], file=sys.stderr)
    sys.exit(1)
values = d.get('values', [])
print(f'Range: {d.get(\"range\",\"\")}  ({len(values)} rows)')
for i, row in enumerate(values):
    print(f'  {i+1}: {row}')
"
