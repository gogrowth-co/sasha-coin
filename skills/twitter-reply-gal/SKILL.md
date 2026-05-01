# Twitter Reply Gal Skill

## When to use this skill
Triggered by cron with message: `[TWITTER_REPLY_GAL]`

## Steps

### 1. Load reply targets
Read `/data/.openclaw/workspace/content/reply-targets.json`. Extract:
- `targets[].handle` → Twitter handles to scrape
- `selection_rules` → criteria (max replies, max age, signals threshold, topic allow/blocklist)
- `targets[].topics_of_interest` and `targets[].sasha_angle` → use these to inform reply angles

### 2. Scrape recent tweets via Apify
Make an HTTP POST to:
```
https://api.apify.com/v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items?token=$APIFY_TOKEN
```
Body:
```json
{"twitterHandles":[<handles from reply-targets.json>],"maxTweets":5}
```
Wait up to 120 seconds. Returns array of tweet objects with: `id`, `text`, `user.screen_name`, `created_at`, `favorite_count`.

### 3. Select up to N reply-worthy tweets
Where N = `selection_rules.max_replies_per_run` (default 2).

ALL criteria must pass:
- Posted within `selection_rules.tweet_age_max_hours` (default 6)
- Topic matches `topics_of_interest` for that handle AND falls in `topic_allowlist`
- Topic does NOT match `topic_blocklist`
- Engagement meets `min_signals` (default: at least 5 likes OR 2 replies)
- Skip if Sasha already replied (check `state/replied-tweets.json` for tweet IDs)

### 4. Write Sasha reply for each selected tweet

Use the matching target's `sasha_angle` as the prompt anchor.

Rules:
- Max 240 characters
- No hashtags, no links, no @mentions
- No emojis unless original tweet uses them
- Do NOT open with a compliment
- Add one concrete angle, question, or data point
- 1–2 sentences, warm and direct, peer not fan
- First-person singular ("I", "my")
- Banned words: revolutionary, to the moon, wen, fren, gm/gn (non-ironic), alpha (overused), bullish/bearish, em dashes

Good example: "The liquidity argument is real. Most newcomers I work with hit this wall in week two — it is where the education gap is sharpest."

Bad example: "Love this post! So true!"

### 5. Post each reply via tweet.js
Run for each reply:
```
node /data/.openclaw/workspace/scripts/tweet.js --text "REPLY_TEXT" --reply-to TWEET_ID
```

If SUCCESS: append the tweet ID to `state/replied-tweets.json` and continue to the next reply.
If ERROR 429 (rate limit): stop immediately, do not retry, send Telegram alert.
If ERROR 403: send Telegram alert with the error payload.

### 6. Append to posted-log
For each successful reply, append to `state/posted-log.json`:
```json
{
  "id": "reply-<tweet-id>",
  "source": "reply",
  "target_handle": "<handle>",
  "in_reply_to": "<original tweet id>",
  "tweet_text": "<reply text>",
  "tweet_id": "<new tweet id from API>",
  "posted_at": "ISO8601 timestamp",
  "status": "posted"
}
```

### 7. Report to Telegram
Format:
```
Tweets reviewed: N
Replies posted: M
Replies skipped: K (reason summary)
```
Then list each posted reply: `@handle - their tweet snippet - Sasha reply`