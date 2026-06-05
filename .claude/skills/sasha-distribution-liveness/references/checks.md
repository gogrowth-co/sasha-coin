# Liveness checks — matrix + thresholds

The audit script `scripts/audit-sasha-distribution.mjs` implements these. Each emits a finding `{sev: ok|warn|fail, id, title, detail, fix}`; the overall status is the worst severity.

| # | Check | id | Signal | Severity |
|---|---|---|---|---|
| 1 | posted-log freshness | `stale-artifacts` / `aging-artifacts` | hours since newest entry vs 5/day cadence | >48h fail; >28h warn |
| 1b | no artifacts | `no-artifacts` | log empty | fail |
| 2 | content mix | `mix-no-voice` / `mix-low-voice` | persona+reply share over N days | 0 voice = fail; <40% = warn |
| 3 | Buffer reachability/auth | `buffer-auth` | HTTP 401/403 on `__typename` probe | warn |
| 4 | Buffer schema drift | `buffer-schema` | HTTP 400 / `errors[]` (e.g. PostPublishingError.code) | fail |
| 5 | Buffer↔log divergence | `buffer-log-divergence` | Buffer latest `sentAt` ≫ newest posted-log | warn |
| 6 | cron presence (--ssh) | `cron-missing` / `cron-post-missing` / `cron-reply-missing` | persona/reply cron absent in /etc/cron.d + crontab | fail |
| 7 | box overload (--ssh) | `box-overload` | load1 > 2× nproc; spawnSync ETIMEDOUT in logs | warn |
| 8 | dual state dir (--ssh) | `dual-state` | `.openclaw/state` vs `.openclaw/workspace/state` entry-count mismatch | warn |

## Cadence (BRT = UTC-3)
- Persona posts: 09 / 13 / 18 BRT = **12 / 16 / 21 UTC**.
- Replies: 11 / 16 BRT = **14 / 19 UTC**.
- Expected ≈ 5 fresh `posted-log.json` entries/day. A healthy gap is < 28h; > 48h means the engine is silent.

## Content classification
- `source === "reply"` → **reply**.
- `source ∈ {calendar, brief, scheduled}` → **persona** (unless the text screams a receipt).
- Text heuristics for **onchain-receipt**: a tx hash (`0x…`), explorer/oklink/basescan, "weekly … yield", mETH/APR/TVL/bps, "fee: N", "rebalanc", "funding rate".

## What "broken" looked like on 2026-06-03 (baseline)
- No `twitter-scheduled-post` / `twitter-reply-gal` cron on the VPS → `cron-missing` (fail).
- posted-log newest entry 2026-05-25 (workspace) / 2026-05-12 (core) → `stale-artifacts` (fail).
- Only Buffer-bound content = `weekly-yield-tweet.js` + auto-trade receipts → voice collapse risk.
- Buffer itself healthy (HTTP 200) — drift was NOT the cause.
- Box load ~11 on 2 vCPU → `box-overload` (warn), `spawnSync ETIMEDOUT` in yield-tweet/treasury/dust logs.
- `read-sasha-results/scripts/drain.mjs` missing → per-minute MODULE_NOT_FOUND (separate ops fix).

Use this baseline to confirm a future "fixed" verdict is real (observed-execution rule): the audit must show cron present + a fresh artifact after the next slot, not just a code change.
