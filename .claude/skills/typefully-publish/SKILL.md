---
name: typefully-publish
description: |
  Brand-agnostic publishing skill for X/Twitter threads (and multi-platform
  drafts) via Typefully's MCP server. Use this whenever an agent needs to:
  create a thread draft, schedule a thread for a future time, publish a
  thread now, list drafts/scheduled/published posts, or delete a draft.

  Default outbound pipe for X THREADS — Buffer cannot model X reply chains,
  and the X API direct path is expensive ($0.015 per text post, $0.20 per
  URL post, no free tier as of Feb 2026). Typefully's Free plan publishes 15
  threads/month per social set, includes API + MCP access, and treats a
  thread as one publishable unit (one create call, many tweets).

  Multi-account convention (mirrors buffer-publish):
    TYPEFULLY_API_KEY_<ACCOUNT>          — per-account API key
    _context/typefully-accounts.json     — logical-name → social_set_id map

  Transport: Streamable HTTP JSON-RPC to https://mcp.typefully.com/mcp.
  Works whether or not the MCP server is registered in the current Claude
  Code session — same auth via API-key query param.

  Use this skill for: X threads, scheduled multi-platform drafts, queue
  inspection. Do NOT use it for: X single-tweet posts where Buffer already
  works (Buffer remains the default for single posts to avoid burning the
  15-thread/month cap), LinkedIn posts (Buffer is cheaper and equally
  capable), or X replies (use Sasha's ADB phone bridge — Typefully cannot
  reply to arbitrary tweets, only chain a draft as a thread).
version: "1.0"
status: active
owner: social-media-agent
propagate_to_template: true
---

# Typefully Publish — X thread skill

## Why Typefully owns the X thread channel

| Channel | Owner | Reason |
|---|---|---|
| X single tweet | buffer-publish | Buffer paid plan already covers X API. No per-call cost. |
| X thread | **typefully-publish** | Buffer cannot model X reply chains. Typefully treats a thread as one draft, one create call. |
| X reply | Sasha ADB bridge (sasha-coin only) | Neither Buffer nor Typefully replies to arbitrary tweets. |
| X Article (Premium+) | None | No public API — UI-only. |
| LinkedIn / IG / etc. | buffer-publish | Buffer covers them. |

X API direct is not used. Pricing changed Feb 2026: free tier discontinued, $0.015 per plain post, $0.20 per URL post. For a 7-tweet thread with one link, that's ~$1.32 per thread on pay-per-use. Typefully Free covers 15 threads/month at $0.

## Multi-account setup (one-time per project)

### 1. Get the API key

In Typefully → Settings → Integrations → MCP, generate an API key. The same key gives both REST API and MCP access.

### 2. Register the env var

Append to the project's `.env`:

```
TYPEFULLY_API_KEY_<ACCOUNT>=hf...
```

`<ACCOUNT>` is the uppercased project/account slug. Examples:
- `TYPEFULLY_API_KEY_SASHA_COIN`
- `TYPEFULLY_API_KEY_MANGABEIRA`
- `TYPEFULLY_API_KEY_TOKEN_TRENDS`

### 3. Discover the social_set_id

```bash
node .claude/skills/typefully-publish/scripts/list-social-sets.js --account SASHA_COIN
```

Each connected X (or LinkedIn / Threads / Bluesky / Mastodon) account is a "social set." Free plan = 1 social set per Typefully account.

### 4. Write the registry

`<project>/_context/typefully-accounts.json`:

```json
{
  "default_account": "SASHA_COIN",
  "accounts": {
    "SASHA_COIN": {
      "social_set_id": 255726,
      "username": "SashaCoin95",
      "plan": "free",
      "monthly_post_cap": 15
    }
  }
}
```

### 5. (Optional) Register the MCP server

For interactive use from Claude Code:

```bash
claude mcp add --transport http --scope user typefully-<account-slug> \
  "https://mcp.typefully.com/mcp?TYPEFULLY_API_KEY=$TYPEFULLY_API_KEY_<ACCOUNT>"
```

Note: MCP tools only register at session start. The scripts in this skill bypass that — they call the same HTTP endpoint via JSON-RPC, so they work immediately without a session restart.

## Scripts

All scripts accept `--account <ACCOUNT>` and read the rest from env + registry.

### `whoami.js`
Verify auth.
```bash
node scripts/whoami.js --account SASHA_COIN
```

### `list-social-sets.js`
List connected accounts.
```bash
node scripts/list-social-sets.js --account SASHA_COIN
```

### `create-draft.js`
Create a draft, schedule a thread, or publish now.

Three input modes (mutually exclusive):
- `--thread "tweet 1" --thread "tweet 2" ...` — repeated arg, one per tweet
- `--text "single tweet"` — single tweet shortcut
- `--file path/to/thread.md` — file with tweets separated by 4 consecutive newlines

Scheduling:
- (default) save as draft
- `--schedule "next-free-slot"` — use the auto-schedule queue
- `--schedule "2026-05-20T14:00:00Z"` — explicit ISO datetime
- `--publish` — publish immediately

Channels (default `x`):
- `--channels x` — X only
- `--channels x,linkedin` — multi-platform from same content

Examples:
```bash
# Save a 3-tweet thread as a draft
node scripts/create-draft.js --account SASHA_COIN \
  --thread "tweet 1" --thread "tweet 2" --thread "tweet 3"

# Publish a thread from a file at the next free queue slot
node scripts/create-draft.js --account SASHA_COIN \
  --file social/x/2026-05-20-thread.md \
  --schedule "next-free-slot"

# Publish immediately (counts against 15/month free cap)
node scripts/create-draft.js --account SASHA_COIN \
  --file thread.md --publish
```

Output: compact JSON with `draft_id`, `status`, `scheduled_date`, `private_url`. Set `TYPEFULLY_DEBUG=1` for full API body on stderr.

### `list-drafts.js`
List by status.
```bash
node scripts/list-drafts.js --account SASHA_COIN --status draft
node scripts/list-drafts.js --account SASHA_COIN --status scheduled
node scripts/list-drafts.js --account SASHA_COIN --status published --limit 25
```

### `get-queue.js`
Show the auto-schedule slot times and the scheduled queue.
```bash
node scripts/get-queue.js --account SASHA_COIN
```

### `delete-draft.js`
Delete a draft.
```bash
node scripts/delete-draft.js --account SASHA_COIN --draft-id 9156633
```

## Thread file convention

Tweets in a `.md` file are separated by **four consecutive newlines** (two blank lines + a newline). This matches Typefully's own thread parsing rule.

```
First tweet text here.



Second tweet.



Third tweet.
```

Each tweet is bound by X's 280-char rule per tweet (the API rejects overflow). Use `wc -m` or a 280-char linter before scheduling.

## Free-plan economics

| Cap | Free plan | Pro plan |
|---|---|---|
| Posts/month | 15 | unlimited |
| Social sets | 1 | up to 10 |
| Media upload max | 5 MB | 20 MB |
| API + MCP | included | included |

A "post" = one published draft. A thread is one draft regardless of tweet count, so a 7-tweet thread counts as 1 against the 15/month cap. (Verified empirically May 2026 — the create endpoint accepts a `posts[]` array under a single draft object.)

15 posts/month = ~1 every other day. Plenty for a single-persona cadence. To run a second account on Free, create a second Typefully account with a different email — or upgrade to Pro for multi-social-set support.

## Anti-patterns

1. **Don't queue single tweets through Typefully.** Burn through the 15-post cap on threads only; use Buffer for single tweets.
2. **Don't autopublish without review.** Default to `--schedule "next-free-slot"`, not `--publish`. The 15-post cap is a tight budget — every accidental publish costs a thread.
3. **Don't store the API key in `_context/typefully-accounts.json`.** Key goes in `.env` only. The registry holds public IDs.
4. **Don't try to post X Articles.** No API exists. Threads + unroll is the only path.
5. **Don't use Typefully for cross-tweet replies.** The MCP creates new threads, not replies to existing public tweets. Use the ADB phone bridge for replies.

## References

- `references/endpoints.md` — full MCP tool catalog with input schemas
- Typefully API docs: https://typefully.com/docs/api
- MCP setup doc: https://support.typefully.com/en/articles/13128440-typefully-mcp-server
- Pricing: https://typefully.com/pricing
