#!/usr/bin/env bash
# Usage: drive-find.sh "query"
# Searches Google Drive using Drive query syntax.
# Examples:
#   drive-find.sh "name = 'My Doc'"
#   drive-find.sh "name contains 'refresh' and mimeType = 'application/vnd.google-apps.document'"
#   drive-find.sh "'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' in parents"

set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$("$SCRIPTS_DIR/access-token.sh")

QUERY="${1:?Usage: drive-find.sh \"query\"}"

curl -s "https://www.googleapis.com/drive/v3/files" \
  -G \
  --data-urlencode "q=${QUERY} and trashed=false" \
  -d "fields=files(id,name,mimeType,modifiedTime,parents)" \
  -d "pageSize=50" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
files = data.get('files', [])
if not files:
    print('No results.')
else:
    print(f'{len(files)} results:')
    for f in files:
        print(f'  id: {f[\"id\"]}')
        print(f'     name: {f[\"name\"]}')
        print(f'     type: {f[\"mimeType\"]}')
        print(f'     modified: {f.get(\"modifiedTime\",\"\")}')
"
