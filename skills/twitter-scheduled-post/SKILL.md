# Twitter Scheduled Post Skill

## When to use this skill
Triggered by cron with message: `[TWITTER_SCHEDULED_POST]`

## What Sasha does
1. Pick what to post next (precedence below).
2. Write the tweet in her voice (rules below).
3. Queue it to Buffer via `post_to_buffer.js`.
4. Update `state/calendar-state.json` so future runs avoid repeating the topic.
5. Append to `state/posted-log.json` so the local task board can mirror activity.
6. Report back to Telegram.

## Precedence — what to post

Check in this order. Use the first one that applies.

### 1. Pre-approved exact text (`content/scheduled-posts.json`)
Read `/data/.openclaw/workspace/content/scheduled-posts.json`. If any entry has:
- `status: "pending"`
- `publish_at` <= now (interpret as America/Sao_Paulo)
- `channel: "x"` or unset

…post the exact `text` as-is. Do not rewrite. Mark `status: "posted"` in `state/scheduled-posts-state.json` (VPS-only — do NOT modify the synced file).

### 2. Active campaign brief (`content/active-brief.md`)
If `/data/.openclaw/workspace/content/active-brief.md` exists AND today is within its date range, read the brief. Pick a topic from `content/calendar.json` whose `campaign` field matches the brief's slug. Within that subset, prefer `priority: "high"`, then oldest `last_used_at` (read from `state/calendar-state.json`).

### 3. Calendar rotation (`content/calendar.json`)
Read `/data/.openclaw/workspace/content/calendar.json`. Pick the topic with:
- highest priority band (high → medium → low)
- within that band, the oldest `last_used_at` in `state/calendar-state.json` (a topic never used has the lowest sort key, so it wins)

Use the `topic` and `angle` fields to write the tweet.

### 4. Fallback
If `content/calendar.json` is missing or empty, log an error to Telegram and skip this run. Do NOT invent topics.

## After picking the topic
Before writing, also load:
- `content/narrative-arc.md` — to avoid repeating beats Sasha already covered

## Tweet writing rules
- Max 240 characters
- No hashtags (feels spammy on small accounts)
- No links
- No emojis unless they add meaning
- One clear idea per tweet — a take, not a summary
- First sentence carries the full weight — someone should stop scrolling at line 1
- Write as Sasha: warm, direct, practitioner voice, first-person singular ("I", "my", never "we")
- Avoid: "I think", "in my opinion", "hot take", "exciting news", em dashes
- Banned words: revolutionary, to the moon, wen, fren, gm/gn (unless ironic), alpha (overused), bullish/bearish

### Good format examples
- "Most DeFi onboarding fails at the wallet step, not the concept step. The tech is fine. The UX assumes you already know what you are doing."
- "Volatility is uncomfortable. Losing your savings because someone on YouTube said it was a sure thing is devastating. Those are not the same risk."
- "The best crypto educators I know spend most of their time answering the same five questions. That is not a problem. That is the job."

## How to post
Run this command with the tweet text:
```
node /data/.openclaw/workspace/post_to_buffer.js --text "TWEET TEXT HERE"
```

Buffer credentials are loaded from environment (`BUFFER_ACCESS_TOKEN`, `BUFFER_CHANNEL_ID`).

If SUCCESS: capture the returned post ID and continue.
If ERROR `duplicate`: rewrite the tweet (different angle on same topic) and try once more.
If ERROR after retry: append to `state/post-errors.json` and skip this run.

## State updates (VPS-only — do not commit, do not sync back to git)

After a successful post, write to `/data/.openclaw/state/`:

**`calendar-state.json`** — track what Sasha used:
```json
{
  "topics": {
    "<topic-id>": { "last_used_at": "ISO8601 timestamp", "post_id": "buffer-id-or-tweet-id" }
  }
}
```

**`posted-log.json`** — append entry:
```json
{
  "id": "<topic-id-or-scheduled-id>",
  "source": "calendar|brief|scheduled",
  "topic_id": "<calendar topic id if applicable>",
  "tweet_text": "<full text>",
  "buffer_post_id": "<id>",
  "queued_at": "ISO8601 timestamp",
  "status": "queued"
}
```

The local task board reads these files via SSH to mirror activity.

## Report format (Telegram)
After each run, send to Telegram:
```
Posted to Buffer queue:
Source: <calendar|brief|scheduled>
Topic: <topic id or 'scheduled-post'>
Tweet: <the tweet text>
Buffer ID: <post id>
```

If skipped or errored, send:
```
Skipped scheduled post run: <reason>
```