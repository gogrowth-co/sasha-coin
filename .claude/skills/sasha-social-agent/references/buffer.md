# Buffer GraphQL — correct usage + the PostPublishingError.code drift

Endpoint: `https://api.buffer.com` (GraphQL POST, `Authorization: Bearer <token>`).
Auth env (names only): `BUFFER_ACCESS_TOKEN_SASHA_COIN` (legacy `BUFFER_ACCESS_TOKEN`), `BUFFER_CHANNEL_ID_SASHA_COIN_X` (legacy `BUFFER_CHANNEL_ID`), `BUFFER_ORGANIZATION_ID_SASHA_COIN`.

## Post mutation (current, correct — used by post_to_buffer.js)
```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id text } }
    ... on MutationError { message }
  }
}
```
Variables: `{ input: { channelId, schedulingType: "automatic", mode: "addToQueue", text } }`.
- Read only `createPost.post.id` / `.text` on success and `MutationError.message` on failure.
- On error `duplicate` → rewrite once, retry; persistent error → append to `state/post-errors.json`, skip.

## The drift (why a queue READ can 400)
Buffer **removed `code` from `PostPublishingError`**. Any query that selects `... on PostPublishingError { code }` now returns **HTTP 400** before executing. The post mutation above never selected `.code`, so it is unaffected — but any **queue-read** query that does will break.
- ✅ Select `message` and/or `__typename` on error/publishing-status unions.
- ❌ Never select `PostPublishingError.code`.

## Reachability probe (schema-independent, safe)
`query { __typename }` always validates → use it to separate "auth/endpoint down" (non-200) from "query/schema drift" (200 + `errors[]` or 400 on a real query). `audit-sasha-distribution.mjs` uses exactly this, plus an optional real queue query via env `BUFFER_QUEUE_QUERY` so the current field selection can be updated without code edits.

## Reality check (2026-06)
Buffer endpoint+auth are healthy. The posts that failed (`weekly-yield-tweet`) failed with `spawnSync /bin/sh ETIMEDOUT` (box overload), not a Buffer error. Don't chase a GraphQL ghost when the box is the problem.
