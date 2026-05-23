#!/usr/bin/env bash
# Usage: file-upload.sh <local_path> "File Name" [folder_id] [mimeType]
# Uploads a local file to Google Drive via multipart upload.
# mimeType defaults to application/octet-stream for binary files.
# For Google-converted types use: application/vnd.google-apps.document, etc.

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

LOCAL="${1:?Usage: file-upload.sh <local_path> \"Name\" [folder_id] [mimeType]}"
NAME="${2:?Usage: file-upload.sh <local_path> \"Name\" [folder_id] [mimeType]}"
FOLDER="${3:-}"
MIME="${4:-application/octet-stream}"

# Build metadata JSON
if [ -n "$FOLDER" ]; then
  META=$(python3 -c "import json; print(json.dumps({'name': '$NAME', 'parents': ['$FOLDER']}))")
else
  META=$(python3 -c "import json; print(json.dumps({'name': '$NAME'}))")
fi

echo "$META" > /tmp/gw_upload_meta.json

curl -s -X POST \
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: multipart/related; boundary=gw_boundary" \
  --data-binary $'--gw_boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'"$(cat /tmp/gw_upload_meta.json)"$'\r\n--gw_boundary\r\nContent-Type: '"${MIME}"$'\r\n\r\n' \
  --data-binary "@${LOCAL}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR:', d['error']['message'], file=sys.stderr)
    sys.exit(1)
print(f'Uploaded: {d.get(\"name\",\"\")}')
print(f'ID: {d.get(\"id\",\"\")}')
print(f'URL: {d.get(\"webViewLink\",\"\")}')
"
