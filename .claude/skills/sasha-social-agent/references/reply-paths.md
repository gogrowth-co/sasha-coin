# Reply-path split — DECISION NEEDED

Sasha's reply engine exists in **two mutually exclusive implementations** that both write `state/replied-tweets.json`. This ambiguity is a reliability risk: each assumes it is the only writer, and neither runs reliably right now.

## Path A — VPS / X API (what the runtime skill documents)
- `skills/twitter-reply-gal/SKILL.md` → scrape via Apify (`kol-scraper`) → generate reply → **`node scripts/tweet.js --text "..." --reply-to <id>`** (X API v2).
- Appends the posted id to `state/replied-tweets.json`; appends a `source:"reply"` row to `state/posted-log.json`.
- Can run on the VPS (no phone needed). Costs X API quota. On 429 → stop, no retry, Telegram alert.

## Path B — local Mac / ADB (the richer runner)
- `scripts/morning-reply-run.js` → ADB reconnect to a physical phone → `scripts/adb-reply.js` taps the X app UI.
- Optimistic pre-write of the tweet id to `replied-tweets.json` *before* posting (survives a mid-post kill).
- **Cannot run on the VPS** (needs a real Android device). Triggered historically by a Telegram bridge (`run_reply_pipeline`); `sasha-bridge-trigger.log` last fired 2026-05-21.

## Live state (2026-06-03)
- No reply cron on the VPS. The bridge trigger stopped 2026-05-21. `replied-tweets.json`: core state dir empty; workspace state dir has 28 ids (newest 2026-05-25). → the reply engine has produced nothing for ~8+ days.

## Recommendation (needs Gabriel's call — do not silently pick)
Pick **one** canonical path:
- **A (VPS/X API)** is the only one that can run unattended on the server. Make it the canonical reply path, add the `0 14,19 * * *` UTC cron, retire Path B (or keep it as a manual local tool). Requires healthy X API creds + write permission.
- **B (ADB)** keeps zero API cost and the human-like posting, but needs an always-on phone + bridge. If kept, it must run from a reliably-online device, not the VPS.

Whichever is chosen: unify on **one** `replied-tweets.json` path (see the dual-state-dir note in `sasha-distribution-liveness`) and update the other skill's SKILL.md to point at it.
