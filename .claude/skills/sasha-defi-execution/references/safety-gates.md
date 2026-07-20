# Safety gates — the rules around any fund-moving action

These gates are non-negotiable. They come from CLAUDE.md ("Anything onchain → ALL execution requires explicit Gabriel confirmation") and the Clawlett SKILL.md policy.

## Gate 1 — dry-run is the default
Every mutating script runs read-only/preview unless `--execute` is passed. Always run `--dry-run` (or the `*:dry` npm alias) first and read the planned action before executing.

## Gate 2 — explicit Gabriel confirmation for sign/trade
Any action with `live_action_risk` of `sign` or `trade` in `docs/integrations/registry.json` needs Gabriel's explicit OK in the moment — a prior OK does not carry over to a new action. This includes: Clawlett swaps, Byreal trades, Hyperliquid orders, bridge execution, ERC-8004 writes, oracle pushes that move real fees.

## Gate 3 — env-gated live crons
Live execution from cron is scoped by env flags so it cannot fire from an ad-hoc run:
- `HEDGE_LIVE_OK=1` gates live Hyperliquid orders to the `sasha-hedge` cron only.
- The rebalancer/treasury crons pass `--execute`; running the same script by hand without the flag stays in preview.

## Gate 4 — kill switches (confirm-gated as of 2026-07-05, do not weaken)
- OOR-distance ≥5% beyond band, hedge-liq proximity ≤3%, stop-loss/emergency PnL, HF < 1.05, funding < −54.75% ann.
- As of 2026-07-05 (H-3, `reports/security-audit-fable5-2026-07-04.md`) every one of these carries
  `confirmGated: true` and requires `--confirm-kill` / `LP_KILL_OK=1` — none auto-execute from cron.
  Before that date, stop-loss/HF-emergency/funding-kill auto-executed with unvalidated thresholds;
  they were pulled back pending a price-history backtest (see `reports/plans-2026-07-05/01-lp-miner.md`).
  Changing this gate back to autonomous, or changing a threshold, is a Gate-2 decision.

## Gate 5 — never invent data
If a price/position/balance fetch fails (e.g. `spawnSync ETIMEDOUT` under box load), do NOT substitute a guessed value into a signing path. Skip the action and let the next run retry. A missing number is safe; a wrong number can sign a bad tx.

## Gate 6 — secrets
All keys read from env (VPS `.env`). Never hardcode, never echo a private key or token in logs, reports, or skill files. See `sasha-ops-hardening/references/secret-hygiene.md`.
