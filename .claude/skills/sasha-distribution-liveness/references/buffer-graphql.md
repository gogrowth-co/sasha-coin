# Buffer GraphQL — fields to inspect for the queue read

The audit's Buffer check is read-only and schema-aware. Use this when the Buffer step reports `buffer-schema`.

## Two-stage probe
1. **Reachability/auth** — `query { __typename }`. Always valid. 200 ⇒ endpoint + token fine; 401/403 ⇒ auth; non-200 ⇒ endpoint.
2. **Queue read** — externalized via env `BUFFER_QUEUE_QUERY` so the current field selection can be pasted without editing code. The audit parses any object carrying `text` + (`sentAt`|`dueAt`|`createdAt`).

## Field rules (the drift)
- ❌ **Do NOT select `PostPublishingError.code`** — removed from Buffer's schema; selecting it returns **HTTP 400** before execution.
- ✅ On any error/publishing-status union, select **`message`** and/or **`__typename`**.
- ✅ On posts, select `id`, `text`, `sentAt`/`dueAt`, channel id.

## Authoring the queue query (when you have the current schema)
Buffer's GraphQL is private/unversioned. To get a known-good queue query, copy a working query from the Buffer web app's network tab, strip any `... on PostPublishingError { code }` selection, and set it as `BUFFER_QUEUE_QUERY`. Keep it minimal (id, text, sentAt/dueAt, status `message`/`__typename`).

## Interpreting results
- 200 + posts, latest `sentAt` recent ⇒ Buffer is sending.
- Buffer sending but `posted-log.json` stale ⇒ `buffer-log-divergence` (the write-back path, not Buffer, is broken).
- 400 / `errors[]` mentioning a field ⇒ fix the selection (likely `.code`), re-run.

## Safety
The audit only ever **reads**. It never calls `createPost`, `updatePost`, `deletePost`, or any mutation. If you extend it, keep it query-only.
