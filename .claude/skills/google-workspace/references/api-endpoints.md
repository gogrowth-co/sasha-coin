# Google Workspace API Endpoint Reference
**Last scraped:** 2026-05-13
**Docs source:** developers.google.com/workspace, /drive, /docs, /sheets, /gmail, /calendar
**Auth:** OAuth 2.0 Bearer token (via `access-token.sh`)

---

## Base URLs

```
Drive:    https://www.googleapis.com/drive/v3
Drive Up: https://www.googleapis.com/upload/drive/v3
Docs:     https://docs.googleapis.com/v1
Sheets:   https://sheets.googleapis.com/v4
Gmail:    https://gmail.googleapis.com/gmail/v1
Calendar: https://www.googleapis.com/calendar/v3
```

**Auth header (all endpoints):**
```bash
Authorization: Bearer $(bash .claude/skills/google-workspace/scripts/access-token.sh)
```

---

## Drive API (`/drive/v3/files`)

### List files in a folder
```
GET https://www.googleapis.com/drive/v3/files
```
| Param | Type | Notes |
|---|---|---|
| `q` | string | Drive query string — see query syntax below |
| `fields` | string | Field mask e.g. `files(id,name,mimeType,modifiedTime,size)` |
| `pageSize` | int | Max 100 (values above 100 capped at 100) |
| `pageToken` | string | From `nextPageToken` in previous response |
| `orderBy` | string | `name`, `modifiedTime desc`, `createdTime desc`, etc. |
| `corpora` | string | `user` (default), `domain`, `drive`, `allDrives` |

**Common query strings:**
```
'FOLDER_ID' in parents and trashed=false
name = 'My Doc'
name contains 'refresh' and mimeType = 'application/vnd.google-apps.document'
mimeType = 'application/vnd.google-apps.folder'
modifiedTime > '2026-01-01T00:00:00'
```

**Script:** `drive-list.sh [folder_id]` / `drive-find.sh "query"`

**Response:**
```json
{
  "kind": "drive#fileList",
  "files": [{ "id": "...", "name": "...", "mimeType": "...", "modifiedTime": "..." }],
  "nextPageToken": "..."
}
```

---

### Get file metadata
```
GET https://www.googleapis.com/drive/v3/files/{fileId}
     ?fields=id,name,mimeType,parents,webViewLink,modifiedTime
```

---

### Create file/folder
```
POST https://www.googleapis.com/drive/v3/files
Content-Type: application/json
```
```json
{
  "name": "Folder Name",
  "mimeType": "application/vnd.google-apps.folder",
  "parents": ["PARENT_FOLDER_ID"]
}
```

**Google MimeTypes:**
| Type | MimeType |
|---|---|
| Folder | `application/vnd.google-apps.folder` |
| Google Doc | `application/vnd.google-apps.document` |
| Google Sheet | `application/vnd.google-apps.spreadsheet` |
| Google Slides | `application/vnd.google-apps.presentation` |

**Script:** `drive-create-folder.sh "name" [parent_id]`

---

### Upload file (multipart)
```
POST https://www.googleapis.com/upload/drive/v3/files
     ?uploadType=multipart&fields=id,name,webViewLink
Content-Type: multipart/related; boundary=BOUNDARY
```
Body: two MIME parts — JSON metadata + file binary.
**Script:** `file-upload.sh <local_path> "Name" [folder_id] [mimeType]`

---

### Move file (update parents)
```
PATCH https://www.googleapis.com/drive/v3/files/{fileId}
      ?addParents=NEW_FOLDER_ID&removeParents=OLD_FOLDER_ID&fields=id,parents
```

---

## Docs API (`/v1/documents`)

### Create document
```
POST https://docs.googleapis.com/v1/documents
Content-Type: application/json

{ "title": "Document Title" }
```
Returns `documentId` and full document structure.
**Script:** `doc-create.sh "Title" [folder_id]`

---

### Get document
```
GET https://docs.googleapis.com/v1/documents/{documentId}
```
Returns full document body, including `content[]` array of structural elements.

**Script:** `doc-read.sh <docId>`

---

### batchUpdate (core operation)
```
POST https://docs.googleapis.com/v1/documents/{documentId}:batchUpdate
Content-Type: application/json
```
```json
{
  "requests": [ /* array of request objects */ ]
}
```

**Available request types:**
| Request | Purpose |
|---|---|
| `insertText` | Add text at a location |
| `deleteContentRange` | Remove content range |
| `updateTextStyle` | Bold, italic, font size, color |
| `updateParagraphStyle` | Heading level, alignment, spacing |
| `replaceAllText` | Find and replace throughout doc |
| `insertInlineImage` | Embed image by URL or Drive file |
| `insertTable` | Create a table |
| `insertTableRow` / `deleteTableRow` | Table row management |
| `createParagraphBullets` / `deleteParagraphBullets` | Lists |
| `updateDocumentStyle` | Page margins, size |
| `createNamedRange` / `deleteNamedRange` | Named ranges for bookmarks |
| `createHeader` / `createFooter` | Document header/footer |
| `insertSectionBreak` | Page/column breaks |
| `replaceNamedRangeContent` | Replace content in a named range |

**Common pattern — insert heading then body text:**
```json
{
  "requests": [
    {
      "insertText": {
        "location": { "index": 1 },
        "text": "Section Heading\n"
      }
    },
    {
      "updateParagraphStyle": {
        "range": { "startIndex": 1, "endIndex": 17 },
        "paragraphStyle": { "namedStyleType": "HEADING_1" },
        "fields": "namedStyleType"
      }
    }
  ]
}
```

**Script:** `doc-batch-update.sh <docId> requests.json`

**Note:** Requests are applied in order. Indices shift after each mutation — work from end to start when deleting, or use `replaceAllText` / named ranges for targeted updates.

---

## Sheets API (`/v4/spreadsheets`)

### Get values
```
GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
```
| Param | Values | Default |
|---|---|---|
| `majorDimension` | `ROWS`, `COLUMNS` | `ROWS` |
| `valueRenderOption` | `FORMATTED_VALUE`, `UNFORMATTED_VALUE`, `FORMULA` | `FORMATTED_VALUE` |
| `dateTimeRenderOption` | `SERIAL_NUMBER`, `FORMATTED_STRING` | `SERIAL_NUMBER` |

**Script:** `sheet-read.sh <sheetId> "Sheet1!A1:Z100"`

**Response:**
```json
{
  "range": "Sheet1!A1:Z100",
  "majorDimension": "ROWS",
  "values": [["col1", "col2"], ["val1", "val2"]]
}
```

---

### Append rows
```
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}:append
     ?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS
Content-Type: application/json
```
```json
{ "values": [["col1", "col2", "col3"]] }
```
| `valueInputOption` | Meaning |
|---|---|
| `USER_ENTERED` | Parse dates, formulas, numbers (preferred) |
| `RAW` | Store as-is, no parsing |

| `insertDataOption` | Meaning |
|---|---|
| `INSERT_ROWS` | Insert new rows (preferred — non-destructive) |
| `OVERWRITE` | Overwrite existing data after the table |

**Script:** `sheet-append.sh <sheetId> "Sheet1!A:C" rows.json`

**Response:**
```json
{
  "spreadsheetId": "...",
  "tableRange": "Sheet1!A1:C5",
  "updates": { "updatedRows": 1, "updatedRange": "Sheet1!A6:C6" }
}
```

---

### Update values (overwrite range)
```
PUT https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
    ?valueInputOption=USER_ENTERED
Content-Type: application/json

{ "values": [["new1", "new2"]] }
```

---

## Gmail API (`/gmail/v1/users/{userId}/messages`)

### List messages (search)
```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
```
| Param | Type | Notes |
|---|---|---|
| `q` | string | Gmail search syntax (same as search box) |
| `maxResults` | int | Default 100, max 500 |
| `pageToken` | string | Pagination |
| `labelIds[]` | string[] | Filter by label IDs |
| `includeSpamTrash` | bool | Include SPAM/TRASH (default false) |

**Common query strings:**
```
from:someone@example.com
subject:invoice
is:unread
after:2026/01/01
label:INBOX
has:attachment
```

**Response:** `{ "messages": [{ "id": "...", "threadId": "..." }], "nextPageToken": "...", "resultSizeEstimate": 42 }`
Note: List returns only `id` and `threadId`. Call `messages.get` for full content.

---

### Get message
```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}
    ?format=full
```
`format` options: `minimal`, `full`, `raw`, `metadata`

---

### List labels
```
GET https://gmail.googleapis.com/gmail/v1/users/me/labels
```

**Note:** Gmail via this skill is read-only. No send, draft, or modify.

---

## Calendar API (`/calendar/v3`)

### List events
```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
```
| Param | Type | Notes |
|---|---|---|
| `calendarId` | string | `primary` for default, or specific calendar ID |
| `timeMin` | datetime | RFC3339 with timezone offset e.g. `2026-01-01T00:00:00Z` |
| `timeMax` | datetime | RFC3339 with timezone offset |
| `maxResults` | int | Default 250, max 2500 |
| `q` | string | Free text search across title, description, location, attendees |
| `singleEvents` | bool | Expand recurring events (required for `orderBy=startTime`) |
| `orderBy` | string | `startTime` (requires singleEvents=true) or `updated` |
| `pageToken` | string | Pagination |

**Response:** `{ "items": [{ "id": "...", "summary": "...", "start": {...}, "end": {...} }], "nextPageToken": "..." }`

---

### Create event
```
POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
Content-Type: application/json
```
```json
{
  "summary": "Event Title",
  "description": "Optional details (HTML supported)",
  "location": "Free-form location string",
  "start": { "dateTime": "2026-05-15T09:00:00-03:00" },
  "end":   { "dateTime": "2026-05-15T10:00:00-03:00" },
  "attendees": [{ "email": "guest@example.com" }]
}
```
For all-day events: use `"date": "2026-05-15"` instead of `dateTime`.

---

### Update event
```
PUT https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
Content-Type: application/json
```
Send full event object (not partial).

---

### Delete event
```
DELETE https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
```

---

### List calendars
```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
```

---

## Error Handling

| HTTP Code | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Token expired or invalid | Re-run `access-token.sh` — tokens last 1 hour |
| `403 Forbidden` | Wrong account or file not shared | Check which account owns the file; use `account` arg |
| `400 Bad Request` | Malformed request body | Validate JSON; check index ordering in batchUpdate |
| `429 Too Many Requests` | Rate limit hit | Back off; Drive API limit is 12,000 queries/min per project |

**Token refresh pattern:**
```bash
TOKEN=$(bash .claude/skills/google-workspace/scripts/access-token.sh)
# or for manga82 account:
TOKEN=$(bash .claude/skills/google-workspace/scripts/access-token.sh manga82)
```

---

## OAuth Scopes Required

| Service | Scopes |
|---|---|
| Drive | `drive`, `drive.file`, `drive.metadata`, or `drive.readonly` |
| Docs | `documents` or `documents.readonly` |
| Sheets | `spreadsheets` or `spreadsheets.readonly` |
| Gmail | `gmail.readonly` (read-only enforced in this workspace) |
| Calendar | `calendar`, `calendar.events`, or `calendar.readonly` |
