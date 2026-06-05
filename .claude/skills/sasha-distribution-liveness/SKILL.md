---
name: sasha-distribution-liveness
description: Detect when Sasha's social autonomy silently degrades — persona posts stop, replies stall, the feed collapses into automated LP/yield receipts, or Buffer drifts. Runs a strictly read-only audit (local files + Buffer queue read + read-only VPS SSH) and returns healthy/degraded/broken. Use for "why isn't Sasha posting?", scheduled health checks, or before assuming the engine works. NEVER posts, replies, deletes, archives, or trades.
---

# Sasha Distribution Liveness

A watchdog for the failure mode that doesn't throw: the crons "succeed," the dashboard looks alive, but Sasha stopped being Sasha — no persona posts, no replies, just automated yield receipts. This skill catches that.

> **OWNERSHIP BOUNDARY.** This skill only **detects and reports**. Sasha's social distribution is **owned by the `marketing/` Sasha account manager** (2026-05-27 split). When this audit returns `degraded`/`broken`, **hand the finding to marketing** (task `SASHA-PERSONA-BRIEF-001`, `shared/decisions.md` 2026-06-03) — do not fix the content engine, scheduling, reply path, or brief from the runtime workspace. The exceptions are the **runtime/infra** findings (`box-overload`, dual-state, a missing drain cron), which belong to this workspace's VPS ops and still need Gabriel's go before any live change.

## When to use
- "Why isn't Sasha posting/replying?" / "Is the feed still in her voice?"
- A scheduled (daily) liveness check.
- Before claiming any social fix works (pair with the "observed execution" rule).

## Hard safety contract
**Read-only. Never** post, reply, delete, archive, schedule, bridge, sign, or trade. The audit reads local files, optionally does a read-only Buffer GraphQL query, and optionally reads VPS state/cron over read-only SSH. That is all.

## Run it
```
node scripts/audit-sasha-distribution.mjs                  # local-only, offline
node scripts/audit-sasha-distribution.mjs --ssh --buffer   # full read-only verdict
node scripts/audit-sasha-distribution.mjs --days 7 --json
```
Exit code: 0 healthy, 1 degraded, 2 broken (for cron alerting). Writes `reports/sasha-distribution-audit-YYYY-MM-DD.{json,md}`.

## The checks (detail in references/checks.md)
1. **Buffer sent/pending read** — reachability + auth (`__typename` probe) and, if `BUFFER_QUEUE_QUERY` is set, a real queue read.
2. **Buffer schema-drift detection** — catch HTTP 400 / `errors[]`, name `PostPublishingError.code` as the known-removed field to stop selecting.
3. **`sentAt` vs posted-log** — Buffer sending but the log not updating ⇒ broken write path.
4. **Cron-fires-but-no-artifact** — newest `posted-log.json` entry/mtime vs the 5-events/day cadence; with `--ssh`, **assert the persona/reply cron actually exists** (its absence is the #1 cause).
5. **Content-mix quality** — classify recent entries into onchain-receipt / persona / reply; flag when the voice share collapses toward all-automated receipts.
6. **(--ssh) box health + dual state dir** — load-vs-cores (spawnSync ETIMEDOUT), and the `.openclaw/state` vs `.openclaw/workspace/state` divergence.

## Status rubric
- **broken** 🔴: no fresh artifacts >48h, OR no persona/reply cron present, OR Buffer schema 400, OR zero persona+reply in window.
- **degraded** 🟡: aging artifacts (>28h), low voice share (<40%), Buffer auth fail, box overload, dual-state divergence.
- **healthy** 🟢: fresh artifacts within cadence + healthy mix + Buffer 200.

## VPS-deployed self-check
A slim copy lives in `skills/sasha-distribution-liveness/` so Sasha can self-audit on the VPS and Telegram-alert on `broken`. See `references/buffer-graphql.md` for the queue-read field rules.
