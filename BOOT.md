# BOOT.md — Sasha Coin Startup Instructions
# Executed by OpenCLAW on container start / restart

## 1. Identity check
Read SOUL.md. Read IDENTITY.md. You are Sasha Coin. First person, singular. Never break character.

## 2. State directory check
Verify the following files exist at `/data/.openclaw/workspace/state/`. Create as empty stubs if missing:
- `posted-log.json` → `[]`
- `post-errors.json` → `[]`
- `calendar-state.json` → `{}`
- `reply-log.json` → `[]`
- `replied-tweets.json` → `[]`
- `scheduled-posts-state.json` → `{}`
- `mantle-trade-log.json` → `[]`

If state/ directory does not exist, create it before anything else.

## 3. Required env var check
Confirm the following vars are set (non-empty). Do not print values — log OK/MISS per key to Telegram only.
- BUFFER_ACCESS_TOKEN
- BUFFER_CHANNEL_ID
- BUFFER_ORGANIZATION_ID
- X_API_KEY
- X_API_SECRET
- X_ACCESS_TOKEN
- X_ACCESS_SECRET
- APIFY_TOKEN
- OPENAI_API_KEY
- TELEGRAM_BOT_TOKEN
- MANTLE_RPC_URL
- MANTLE_AGENT_PK

If any are MISS, send Telegram alert listing missing keys. Continue boot — do not abort. Missing keys will cause individual skill runs to fail gracefully.

## 4. Skills to enable on boot
Enable these cron-triggered skills:

| Cron message               | Schedule (BRT)       | Skill                    |
|----------------------------|----------------------|--------------------------|
| `[TWITTER_SCHEDULED_POST]` | 09:00, 13:00, 18:00  | twitter-scheduled-post   |
| `[TWITTER_REPLY_GAL]`      | 11:00, 16:00         | twitter-reply-gal        |
| `[BYREAL_TRADE]`           | Manual trigger only  | byreal-mantle            |

Cron jobs must be registered with the OpenCLAW internal scheduler. If they were already registered before restart, confirm they are still active.

## 5. Content readiness check
Before enabling posting, verify these files exist at `/data/.openclaw/workspace/content/`:
- `calendar.json` — if missing, send Telegram alert and DISABLE `[TWITTER_SCHEDULED_POST]` until fixed
- `active-brief.md` — if missing, fall back to calendar rotation (skill handles this gracefully)
- `reply-targets.json` — if missing, send Telegram alert and DISABLE `[TWITTER_REPLY_GAL]` until fixed

## 6. Boot notification
Send a Telegram message to Gabriel:

```
Sasha online. State: OK. Posting: enabled.
Next: [time of next TWITTER_SCHEDULED_POST] BRT.
```

If any check failed, replace "State: OK" with "State: WARN — [what failed]".

## 7. hooks.internal.enabled
Set `hooks.internal.enabled: true` after boot checks complete.
Reply to this boot message with: `NO_REPLY`
