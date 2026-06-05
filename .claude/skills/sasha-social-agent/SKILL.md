---
name: sasha-social-agent
description: How Sasha's social distribution actually works end to end — the daily persona-post engine (Buffer), the reply engine, the content files that drive them, and the one-writer rule. Use when debugging why Sasha isn't posting/replying, touching post_to_buffer.js / the twitter-* runtime skills, or reasoning about the reply-path split. Content is AUTHORED in the marketing workspace; this skill is about the runtime plumbing, not writing copy.
---

# Sasha Social Agent (runtime plumbing)

Sasha posts to X two ways: **persona posts** (3/day, via Buffer queue) and **replies** (2/day). The runtime logic lives in the VPS-deployed skills `twitter-scheduled-post` and `twitter-reply-gal`; this skill documents the whole system so it can be kept alive. It does **not** write content — copy is authored in the `marketing/` workspace from `_context/`.

> **OWNERSHIP BOUNDARY (read this first).** Sasha's social distribution — posts, replies, threads, Buffer/Typefully scheduling, `calendar.json`, `reply-targets.json`, `active-brief.md` — is **owned by the `marketing/` Sasha account manager** (`marketing/.claude/agents/sasha-coin-am.md`), per the 2026-05-27 split. From this runtime workspace you may **read-only diagnose** (is she posting? is the feed in-voice?) but you do **not** fix the content engine, choose the reply path, refresh the brief, or change scheduling here. Route all of that to marketing (see `shared/decisions.md` 2026-06-03, task `SASHA-PERSONA-BRIEF-001`). This file is a runtime *reference*, not a fix-it surface.

## When to use
- "Why isn't Sasha posting/replying?" → start here, then run `sasha-distribution-liveness`.
- Editing `post_to_buffer.js`, `scripts/tweet.js`, `scripts/morning-reply-run.js`, `scripts/adb-reply.js`, or the twitter-* SKILL.md files.
- Reasoning about which content file feeds which engine.

## The one-writer rule
Local (marketing) writes content into `content/*.json`; `deploy.sh` syncs it; the VPS executes and writes runtime state. **The VPS never writes back to git.** Posting state lives in Buffer + VPS-only state files. Do not author or schedule content in this repo.

## Persona-post engine (3/day, 09/13/18 BRT = 12/16/21 UTC)
- Skill: `skills/twitter-scheduled-post/SKILL.md`. Precedence: `scheduled-posts.json` (exact text) → `active-brief.md` campaign topic → `calendar.json` rotation → skip (never invent).
- Posts via `node post_to_buffer.js --text "..."` (Buffer queue, `addToQueue`).
- Writes `state/calendar-state.json` (last_used_at) + appends `state/posted-log.json`.
- **Failure mode that bites the voice:** if `active-brief.md` is expired and the calendar is thin, it falls through to repetitive low-priority topics. Keep the brief current (marketing workspace).

## Reply engine (2/day, 11/16 BRT = 14/19 UTC)
- **Two conflicting paths exist — read `references/reply-paths.md`.** The VPS runtime skill (`twitter-reply-gal`) posts via `scripts/tweet.js` (X API). The local Mac runner `morning-reply-run.js` posts via ADB on a physical phone. Both write `state/replied-tweets.json`. Only one should be canonical.
- Hard rule: never reply to the same tweet twice — `state/replied-tweets.json` is a permanent dedup set (optimistic pre-write before posting). Never remove that guard.

## Buffer
- Endpoint `https://api.buffer.com`. Post mutation selects only `PostActionSuccess{post{id text}}` / `MutationError{message}`. **Never select `PostPublishingError.code`** on the queue-read query — it was removed and 400s. See `references/buffer.md`.
- Live probe 2026-06-03: endpoint+auth healthy (HTTP 200). Real failures observed were box-level `spawnSync ETIMEDOUT`, not GraphQL — see `sasha-ops-hardening`.

## Health & known breakage
Run `node scripts/audit-sasha-distribution.mjs --ssh --buffer` (owned by `sasha-distribution-liveness`). As of 2026-06-03 the persona/reply engines were **not scheduled on the VPS at all** — confirm cron presence before assuming a code bug.

## Files & references
- `references/buffer.md`, `references/reply-paths.md`, `references/content-files.md`.
- Registry rows: Buffer, X API v2, Apify, ADB, Typefully (owner `sasha-social-agent`).
