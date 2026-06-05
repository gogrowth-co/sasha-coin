---
name: sasha-ops-hardening
description: Keep Sasha's integration docs, env hygiene, and runtime reliability honest. Owns the docs/integrations/registry.json upkeep, the docs-freshness watchdog, secret hygiene (names-only, gitignore-verified), the smoke-test catalog, and triage of the systemic VPS issues (box overload / spawnSync ETIMEDOUT, missing drain.mjs, dual state dirs). Use for periodic maintenance, after adding/rotating an integration, or when "automation works but quietly fails."
---

# Sasha Ops Hardening

The meta-skill that stops silent rot: docs going stale, env vars drifting, secrets leaking, the box quietly choking. It maintains the registry and the two check scripts, and triages infrastructure failures that don't throw.

## When to use
- After wiring, rotating, or removing any integration → update `docs/integrations/registry.json`.
- Weekly/periodic: run the docs-freshness watchdog + smoke tests.
- When automation "succeeds" but artifacts don't change, balance fetches time out, or alerts stop.

## Owned assets
- `docs/integrations/registry.json` — source of truth (env NAMES only). See `references/registry-maintenance.md`.
- `scripts/check-integration-docs.mjs` — verifies every docs/llms URL is 200 and hashes content to catch silent rewrites: `node scripts/check-integration-docs.mjs --hash --json`.
- `scripts/audit-sasha-distribution.mjs` — owned by `sasha-distribution-liveness` but run as part of ops health.
- `references/secret-hygiene.md`, `references/smoke-tests.md`.

## Secret hygiene (verified, not assumed)
- `.env` and `.env.bak` are **gitignored** and were **never committed** (`git log --all --full-history -- .env` is empty). `.env.example` uses placeholders. → **No exposure-driven rotation is needed.** Keep it that way.
- Registry, skills, reports, and the check scripts print env-var **names only**, never values. If you ever find a real-looking secret in a tracked file, report the path + var name (never the value) and recommend rotation. See `references/secret-hygiene.md`.

## Systemic VPS issues to triage (baseline 2026-06-03)
1. **Box overload** — `openclaw-h3mk` + `openclaw-mrzq` + many crons on **2 vCPU**, 1-min load ~11 → `spawnSync /bin/sh ETIMEDOUT` in `weekly-yield-tweet`, `treasury-monitor`, `dust-consolidator`. Fix options: serialize the `*/30` crons, raise spawnSync timeouts, or move one OpenCLAW instance off the box.
2. **Missing `read-sasha-results/scripts/drain.mjs`** → the per-minute `sasha-drain` cron crashes (MODULE_NOT_FOUND) every minute, adding load + noise. Restore the script or disable the cron.
3. **No persona/reply cron** → owned by `sasha-distribution-liveness` (the social degradation).
4. **Dual state dirs** → `.openclaw/state` vs `.openclaw/workspace/state`; pick one canonical path.

## Cadence (suggested)
- Daily: `audit-sasha-distribution.mjs --ssh --buffer` (alert on `broken`).
- Weekly: `check-integration-docs.mjs --hash`; review `last_checked` dates; run smoke tests for `read`-risk integrations.
- On change: update the registry entry + `last_checked`, re-run the docs check.

These complement (do not replace) the marketing-workspace ops skills (`ops-daily-preflight`, `ops-weekly-maintenance`, `ops-monthly-infra-review`).
