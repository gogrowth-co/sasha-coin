# Smoke-test catalog

Safe, read-only / dry-run commands to confirm an integration still works. None post, trade, or sign. Pulled from each registry entry's `smoke_test_command`.

| Integration | Smoke test | Confirms |
|---|---|---|
| Integration docs | `node scripts/check-integration-docs.mjs --json` | every docs/llms URL is 200 |
| Distribution | `node scripts/audit-sasha-distribution.mjs --ssh --buffer` | persona/reply liveness verdict |
| X Layer | `node scripts/xlayer-pool-state.js` | RPC + pool/oracle read |
| Oracle push | `node scripts/push-signal-to-xlayer.js --dry-run` | signal read + tx build (no send) |
| Signal fusion | `node scripts/mantle-signal.js --dry-run` | all judges reachable + fuse |
| Allora / Elfa / Polymarket | `node scripts/signals/{allora,elfa,polymarket}.js` | each source returns data |
| Pool scan | `node scripts/pool-scanner.js --dry-run` | DefiLlama yields reachable |
| Position monitor | `node scripts/position-monitor.js --dry-run` | Base/HL reads + kill-switch logic |
| Hedge | `node scripts/hedge-executor.js --dry-run` | HL state + drift calc (no order) |
| Treasury | `node scripts/mantle-treasury.js --action report` | Mantle read + yield snapshot |
| Buffer | `node post_to_buffer.js --text 'smoke' --dry-run` | mutation + variables shape (no post) |

## How to run with env (without leaking it)
On the VPS, scripts get env from the cron's `export $(grep ... .env | xargs)` pattern. Locally, source `.env` in a subshell that does not echo it. Never print the resulting environment.

## Cadence
- Weekly: docs check + the `read`-risk smoke tests above.
- Before any deploy: run `.claude/skills/protocol-changelog` + the relevant dry-run for the touched integration.
- Daily: the distribution audit (alert on `broken`).

## Interpreting failures
- `spawnSync ETIMEDOUT` on a smoke test → box overload, not integration death (see SKILL.md). Re-run when load is lower.
- HTTP 401/403 → key/auth issue (rotate per `secret-hygiene.md`, names only).
- HTTP 400 + GraphQL `errors[]` → schema drift (see `sasha-distribution-liveness/references/buffer-graphql.md`).
