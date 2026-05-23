#!/usr/bin/env bash
# Usage: drive-create-folder.sh "Folder Name" [parent_folder_id]
# Creates a folder in Drive. Prints the new folder ID.

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

NAME="${1:?Usage: drive-create-folder.sh \"Name\" [parent_id]}"
PARENT="${2:-}"

if [ -n "$PARENT" ]; then
  BODY=$(python3 -c "import json; print(json.dumps({'name': '$NAME', 'mimeType': 'application/vnd.google-apps.folder', 'parents': ['$PARENT']}))")
else
  BODY=$(python3 -c "import json; print(json.dumps({'name': '$NAME', 'mimeType': 'application/vnd.google-apps.folder'}))")
fi

curl -s -X POST "https://www.googleapis.com/drive/v3/files" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'id' in d:
    print(f'Folder created: {d[\"name\"]}')
    print(f'ID: {d[\"id\"]}')
else:
    print('ERROR:', json.dumps(d, indent=2), file=sys.stderr)
    sys.exit(1)
"
