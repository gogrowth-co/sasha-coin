---
name: sasha-distribution-liveness
description: Runtime self-check for Sasha's social distribution — detects when persona posts/replies silently stop or the feed degrades to automated receipts. Read-only; never posts/trades. Mirror of the dev skill.
triggers:
  - "[DISTRIBUTION_LIVENESS]"
  - "check if sasha is still posting"
  - "is the feed degraded"
---

# Sasha Distribution Liveness (runtime self-check)

Catches the silent failure: crons "succeed" but Sasha stopped posting/replying, or the feed collapses into automated LP/yield receipts.

## Run (read-only)
```
node scripts/audit-sasha-distribution.mjs --ssh --buffer
```
Exit 0 healthy / 1 degraded / 2 broken. Writes `reports/sasha-distribution-audit-YYYY-MM-DD.{json,md}`.

## Hard safety contract
**Never** post, reply, delete, archive, schedule, bridge, sign, or trade. Reads only: local files, a read-only Buffer query, read-only VPS state/cron.

## What it checks
1. posted-log freshness vs the 5/day cadence (09/13/18 + 11/16 BRT).
2. content mix: persona vs reply vs onchain-receipt (flag voice collapse).
3. Buffer reachability/auth + schema drift (never select `PostPublishingError.code`).
4. Buffer `sentAt` vs posted-log divergence.
5. persona/reply CRON presence on the VPS (its absence is the #1 cause).
6. box overload (spawnSync ETIMEDOUT) + dual state-dir divergence.

## On `broken`
Telegram-alert Gabriel with the failing finding ids. Do NOT attempt a fix autonomously. **Social distribution is owned by the `marketing/` workspace** — content/scheduling/reply-path/brief repairs are marketing's call. Only the runtime/infra findings (`box-overload`, dual-state, missing drain) belong to runtime ops, and still need explicit confirmation.

Full version + check matrix / Buffer GraphQL field rules: dev workspace `.claude/skills/sasha-distribution-liveness/`.
