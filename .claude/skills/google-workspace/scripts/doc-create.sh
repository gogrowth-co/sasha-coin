#!/usr/bin/env bash
# Usage: doc-create.sh "Document Title" [folder_id]
# Creates an empty Google Doc. Prints the document ID and URL.

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

TITLE="${1:?Usage: doc-create.sh \"Title\" [folder_id]}"
FOLDER="${2:-}"

# Create the doc via Docs API
DOC_RESP=$(curl -s -X POST "https://docs.googleapis.com/v1/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"title\": $(python3 -c "import json; print(json.dumps('$TITLE'))")}")

DOC_ID=$(python3 -c "import json, sys; d=json.loads('$DOC_RESP' if False else open('/dev/stdin').read()); print(d.get('documentId',''))" <<< "$DOC_RESP")

if [ -z "$DOC_ID" ]; then
  echo "ERROR creating doc: $DOC_RESP" >&2
  exit 1
fi

# Move to folder if specified
if [ -n "$FOLDER" ]; then
  # Get current parents
  PARENTS=$(curl -s "https://www.googleapis.com/drive/v3/files/${DOC_ID}?fields=parents" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(d.get('parents',[])))")

  curl -s -X PATCH "https://www.googleapis.com/drive/v3/files/${DOC_ID}?addParents=${FOLDER}&removeParents=${PARENTS}&fields=id,parents" \
    -H "Authorization: Bearer ${TOKEN}" > /dev/null
fi

echo "Document created: $TITLE"
echo "ID: $DOC_ID"
echo "URL: https://docs.google.com/document/d/${DOC_ID}/edit"
