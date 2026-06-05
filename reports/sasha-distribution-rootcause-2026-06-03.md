# Sasha Distribution — Root Cause & Remediation (read-only diagnosis)

**Date:** 2026-06-03 · **Verdict:** 🔴 BROKEN · **Method:** read-only VPS SSH + Buffer probe + local/live state inspection. No live posts, trades, or signing were performed. No live config was changed.

## TL;DR
Sasha's on-chain/DeFi automation is alive and healthy. Her **voice** is not. The persona-post and reply engines have produced **no artifacts since ~May 25** because **they are not scheduled on the VPS at all** — and the only content still reaching Buffer is the weekly yield tweet + auto-trade receipts, i.e. exactly the "repetitive automated posts instead of Sasha" failure. Buffer itself is healthy; the suspected GraphQL-400 was not the cause.

## Confirmed findings (evidence)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | 🔴 | **No persona/reply cron on the VPS** | `/etc/cron.d/` = `sasha-{dashboard,hedge,lp-miner,oracle,trade}` only; no `twitter-scheduled-post`/`twitter-reply-gal`; `openclaw.json` has no scheduler wiring for them. |
| 2 | 🔴 | **Stale artifacts (engine silent)** | `posted-log.json` newest: 2026-05-25 (workspace) / 2026-05-12 (core). `replied-tweets.json`: 28 ids (workspace, newest 05-25); 0 (core). ~8–20 days silent. |
| 3 | 🟡 | **Feed = automation only** | Only Buffer-bound content cron is `weekly-yield-tweet.js` (Mondays) + `auto-trade.js` receipts. |
| 4 | 🟡 | **Box oversubscribed → spawnSync ETIMEDOUT** | load 11.75 on **2 vCPU**; `spawnSync /bin/sh ETIMEDOUT` in `sasha-yield-tweet.log` (Buffer post failed 06-01), `sasha-treasury.log`, `sasha-dust.log`. |
| 5 | 🟡 | **Per-minute drain crashing** | `read-sasha-results/scripts/drain.mjs` MISSING → `sasha-drain` cron throws MODULE_NOT_FOUND every minute. |
| 6 | 🟡 | **Dual state dirs** | `.openclaw/state/posted-log.json` (1 entry) vs `.openclaw/workspace/state/posted-log.json` (30). Runtime skill + dashboard disagree on the canonical path. |
| 7 | 🟡 | **Reply-path split** | `twitter-reply-gal` SKILL → `tweet.js` (X API); local `morning-reply-run.js` → ADB phone. Both write `replied-tweets.json`. Bridge trigger last fired 2026-05-21. |
| — | ✅ | **Buffer healthy** | Live probe `HTTP 200 / kind=ok / hasErrors=false`. `PostPublishingError.code` 400 is NOT the live cause (documented defensively for the queue-read path). |
| — | ✅ | **DeFi automation healthy** | oracle (2h), lp-monitor/rebalancer (30m), hedge (30m), treasury, dashboard (5m) crons all current in `/var/log/sasha-*.log`. |

## Remediation (severity-ordered; each needs Gabriel's go — no live fix applied)

1. **Install the persona/reply cadence (root cause).** Add VPS cron (or OpenCLAW scheduler triggers) for `twitter-scheduled-post` (12/16/21 UTC) and the chosen reply path (14/19 UTC). **Verify (observed-execution rule):** after the next slot, `node scripts/audit-sasha-distribution.mjs --ssh` shows `post=true reply=true` AND a fresh `posted-log.json` entry. Do not call it fixed before that.
2. **Pick ONE canonical reply path** (`sasha-social-agent/references/reply-paths.md`). Recommended: X-API/`tweet.js` (only path that runs unattended on the VPS); retire/relegate ADB to a manual local tool. Requires healthy X API write creds.
3. **Refresh the persona content source.** `content/active-brief.md` expired 2026-05-28 → without it the scheduler falls to thin calendar rotation. **Hand off to the `marketing/` workspace** (content boundary) for a new brief + calendar top-up.
4. **Relieve box load.** Serialize the `*/30` crons, raise spawnSync timeouts, or move one OpenCLAW instance off the 2-vCPU box.
5. **Restore or disable `read-sasha-results/scripts/drain.mjs`** to stop the per-minute crash.
6. **Unify the state dir** — one canonical `posted-log.json`/`replied-tweets.json` path across engine + dashboard.

## How this is now monitored going forward
- `node scripts/audit-sasha-distribution.mjs --ssh --buffer` → `healthy|degraded|broken` (exit 0/1/2), writes `reports/sasha-distribution-audit-YYYY-MM-DD.{json,md}`. Owned by the `sasha-distribution-liveness` skill; slim VPS self-check mirror in `skills/`.
- `node scripts/check-integration-docs.mjs` → docs-freshness watchdog over `docs/integrations/registry.json`. Owned by `sasha-ops-hardening`.

## Remediation applied 2026-06-03 (Sasha-side only, reversible, no Maestro touch — see DEC-003b)
- **Box-load attribution corrected:** not a Sasha runaway. `mrzq` (Maestro) steady-state ~8%; the 790% was a burst from Maestro's **19** `docker exec` cron jobs on a **2-vCPU** host (shared under-provisioning). No CPU limits on either container.
- **WS1 ✅ verified:** disabled the vestigial `sasha-drain` cron (skill never existed; Slack/git flow, Sasha is Telegram). `sasha-drain.log` frozen; `marketing-drain` untouched.
- **WS2 ✅ applied (cron hygiene) — but OBSERVED that it does NOT fix the treasury ETIMEDOUT:** `sasha-dashboard` `*/5`→`*/15`; de-collided crons (monitor 0,30 · rebalancer 3,33 · hedge 5,35 · treasury 20,50). The 20:50 treasury run still hit `spawnSync ETIMEDOUT` at load ~2–4 → it's NOT contention. Real cause: `byreal-cli wallet balance` (wallet + 5 LP positions) exceeds its 60s timeout on the Solana RPC; **non-fatal** (carry-forward to last-good, flagged stale). Fix = raise `BYREAL_BALANCE_TIMEOUT_MS` (90–120s) / lower treasury cadence / lighten the query — NOT applied, your call.
- **WS3 ✅ verified:** unified state to `.openclaw/workspace/state` (canonical); archived stale core social files → `*.stale-20260603`; SKILL.md path fixed; audit no longer flags `dual-state`. Snapshot at `.openclaw/state-backup-20260603`.
- **Durable load fix still pending (your decision):** upsize the droplet (2→4 vCPU) or split `mrzq`/`h3mk`. Sasha-side relief cannot fix Maestro's burst load.
- **Unchanged / out of scope:** persona+reply cadence and brief → marketing (`SASHA-PERSONA-BRIEF-001`).
