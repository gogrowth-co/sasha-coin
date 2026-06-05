# Content files — what feeds which engine

All authored in the `marketing/` workspace, synced here by `deploy.sh`, executed on the VPS. The engine reads them; it does not write them (one-writer rule).

| File | Read by | Shape | Notes |
|---|---|---|---|
| `content/scheduled-posts.json` | persona-post | `{ posts: [{ text, publish_at, status, channel }] }` | Exact pre-approved text. Highest precedence. Currently empty. |
| `content/active-brief.md` | persona-post + reply | markdown with a campaign window | If today is in-window, topics matching the brief slug win. **Expired (window ended 2026-05-28)** → engine falls through to plain calendar. |
| `content/calendar.json` | persona-post | `{ rules, topics: [{ id, priority, campaign, topic, angle, last_used_at }] }` | Rotation: highest priority band, oldest `last_used_at` wins. ~80 topics. |
| `content/narrative-arc.md` | persona-post | markdown memory | Loaded before writing to avoid repeating beats. |
| `content/reply-targets.json` | reply | `{ selection_rules, targets: [{ handle, topics_of_interest, sasha_angle }] }` | KOL handles + allow/blocklist + caps. |
| `content/kol-feed.json` | reply | scraper output | Written by `kol-scraper.js` from `reply-targets.json`. |
| `content/mantle-signal.json` | oracle/trade | fused risk | Produced by `sasha-signal-fusion`, not authored. |

## State written by the engines (VPS-only, never synced back to git)
- `state/calendar-state.json` — `{ topics: { <id>: { last_used_at, post_id } } }`
- `state/posted-log.json` — append-only log of posts + replies (the dashboard mirrors it read-only)
- `state/replied-tweets.json` — permanent reply dedup set
- `state/post-errors.json` — Buffer/X errors
- `state/scheduled-posts-state.json` — per-post publish status

## ⚠ Dual state dir
On the VPS there are two `state/` trees: `.openclaw/state/` (core) and `.openclaw/workspace/state/` (deploy artifact). The runtime SKILL.md points at `.openclaw/state/` but real reply data has been landing in `.openclaw/workspace/state/`. Pick one canonical path and align both the engine and the dashboard reader. See `sasha-distribution-liveness/references/checks.md`.

## Mandatory QA gate (from CLAUDE.md)
Every thread/Buffer post must tag at least one relevant protocol or KOL. Zero mentions = QA fail. (Authoring happens in `marketing/`; this is a runtime reminder, not a license to write here.)
