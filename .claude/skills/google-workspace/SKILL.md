# google-workspace

Direct Google Workspace integration via OAuth 2.0 refresh tokens. The only path for Drive, Docs, Sheets, Gmail, and Calendar. No middleware — calls Google APIs directly, so there are no third-party connection expiry issues.

---

## Auth model

All scripts call `scripts/access-token.sh` first. That script exchanges `$GOOGLE_REFRESH_TOKEN_MANGA82` for a fresh 1-hour access token via a single curl POST. No session, no MCP server, no middleware.

Required env vars (in `.env`):
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN_MANGA82=...    # manga82@gmail.com (the only Google account)
```

---

## One-time setup

Run once (from the workspace root) to get the refresh token:

```bash
python3 .claude/skills/google-workspace/scripts/get-token-gtm.py
```

Prerequisites:
1. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set in `.env` (client ID is already there; get the secret from GCP Console → Credentials → MangaOS → Client secrets → Add secret)
2. `http://localhost:8080` added to Authorized redirect URIs on the MangaOS credential (done)

The script reads credentials from `.env`, opens your browser, handles the consent flow, and writes `GOOGLE_REFRESH_TOKEN_MANGA82` straight into the workspace `.env`. It never prints the token. (`get-token.py` is retired: it printed secrets.)

---

## Script reference

All scripts load env vars from the workspace `.env` automatically.

| Script | Args | What it does |
|---|---|---|
| `get-token-gtm.py` | _(interactive)_ | One-time OAuth flow → writes refresh token to `.env` (never prints it) |
| `access-token.sh` | `[account]` | Returns fresh access token (default / manga82) |
| `drive-list.sh` | `[folder_id]` | List files in Drive root or a specific folder |
| `drive-find.sh` | `"query"` | Search Drive — accepts any Drive query string |
| `drive-create-folder.sh` | `"name" [parent_id]` | Create a Drive folder, prints new folder ID |
| `doc-create.sh` | `"title" [folder_id]` | Create empty Google Doc, prints docId |
| `doc-read.sh` | `docId` | Read Doc content as plain text |
| `doc-batch-update.sh` | `docId requests.json` | Run batchUpdate — same as `google-doc-formatter` does |
| `sheet-read.sh` | `sheetId range` | Read spreadsheet range (e.g. `Sheet1!A1:Z100`) |
| `sheet-append.sh` | `sheetId range rows.json` | Append rows to a sheet |
| `file-upload.sh` | `local_path "name" [folder_id] [mimeType]` | Upload a file to Drive |

---

## Usage in skills and scripts

### Getting a token in a generated Python script

```python
import subprocess, os

def get_access_token(account="default"):
    skill_dir = os.path.join(os.path.dirname(__file__), "..", "access-token.sh")
    # Always resolve from workspace root
    result = subprocess.run(
        ["bash", ".claude/skills/google-workspace/scripts/access-token.sh", account],
        capture_output=True, text=True, cwd="."
    )
    return result.stdout.strip()

TOKEN = get_access_token()
GDOCS  = "https://docs.googleapis.com"
GDRIVE = "https://www.googleapis.com/drive/v3"
GSHEETS = "https://sheets.googleapis.com/v4"
```

### Calling the Google APIs directly

```python
TOKEN = get_access_token()  # from the helper above
GDOCS  = "https://docs.googleapis.com"
GDRIVE = "https://www.googleapis.com/drive/v3"
# curl ... -H f"Authorization: Bearer {TOKEN}"
# URL: f"{GDOCS}/v1/documents/{DOC_ID}:batchUpdate"
```

---

## API quick reference

| Operation | Method | URL |
|---|---|---|
| List Drive files | GET | `https://www.googleapis.com/drive/v3/files` |
| Search Drive | GET | `https://www.googleapis.com/drive/v3/files?q=...` |
| Create Drive file/folder | POST | `https://www.googleapis.com/drive/v3/files` |
| Upload file (multipart) | POST | `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` |
| Create Doc | POST | `https://docs.googleapis.com/v1/documents` |
| Get Doc | GET | `https://docs.googleapis.com/v1/documents/{docId}` |
| Doc batchUpdate | POST | `https://docs.googleapis.com/v1/documents/{docId}:batchUpdate` |
| Get Sheet values | GET | `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}` |
| Append Sheet rows | POST | `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:append?valueInputOption=USER_ENTERED` |

Auth header for all: `Authorization: Bearer {ACCESS_TOKEN}`

---

## Error handling

| Error | Cause | Fix |
|---|---|---|
| `invalid_grant` from token exchange | Refresh token revoked or account removed from test users | Re-run `get-token-gtm.py` |
| `403 Forbidden` from Drive/Docs | Wrong account token, or file not shared with that account | Check which account owns the file; use `account` arg |
| `400 Bad Request` on batchUpdate | Malformed requests JSON | Validate JSON; check index ordering (requests must be sequential) |
| `401 Unauthorized` | Access token expired mid-script | Access tokens last 1 hour; re-run `access-token.sh` at top of long scripts |

---

## Accounts

| Account | Env var | Use for |
|---|---|---|
| manga82 | `GOOGLE_REFRESH_TOKEN_MANGA82` | The only account (consolidated 2026-09-29) |
