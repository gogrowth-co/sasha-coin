#!/usr/bin/env bash
# Usage: drive-list.sh [folder_id]
# Lists files in Google Drive root or a specific folder.

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

FOLDER="${1:-root}"
Q="'${FOLDER}' in parents and trashed=false"

curl -s "https://www.googleapis.com/drive/v3/files" \
  -G \
  --data-urlencode "q=${Q}" \
  -d "fields=files(id,name,mimeType,modifiedTime,size)" \
  -d "pageSize=100" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
files = data.get('files', [])
print(f'{len(files)} files:')
for f in files:
    size = f.get('size', '')
    size_str = f' ({int(size)//1024}KB)' if size else ''
    print(f'  {f[\"id\"]}  {f[\"name\"]}{size_str}  [{f[\"mimeType\"].split(\".\")[-1]}]')
"
