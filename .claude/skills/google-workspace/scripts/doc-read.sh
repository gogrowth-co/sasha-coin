#!/usr/bin/env bash
# Usage: doc-read.sh <docId>
# Reads a Google Doc and prints its plain text content.

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

DOC_ID="${1:?Usage: doc-read.sh <docId>}"

curl -s "https://docs.googleapis.com/v1/documents/${DOC_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import json, sys

doc = json.load(sys.stdin)
if 'error' in doc:
    print('ERROR:', doc['error']['message'], file=sys.stderr)
    sys.exit(1)

print(f'Title: {doc.get(\"title\", \"\")}')
print(f'ID: {doc.get(\"documentId\", \"\")}')
print()

# Extract plain text from content
def extract_text(elements):
    text = ''
    for el in elements:
        if 'paragraph' in el:
            for pe in el['paragraph'].get('elements', []):
                if 'textRun' in pe:
                    text += pe['textRun'].get('content', '')
        elif 'table' in el:
            for row in el['table'].get('tableRows', []):
                for cell in row.get('tableCells', []):
                    text += extract_text(cell.get('content', []))
    return text

body = doc.get('body', {}).get('content', [])
print(extract_text(body))
"
