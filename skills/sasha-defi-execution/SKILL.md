---
name: sasha-defi-execution
description: Runtime reference for safe on-chain execution — LP monitor/rebalance, Hyperliquid hedge, Byreal trade, treasury, with dry-run-default and confirmation gates. Mirror of the dev skill.
---

# Sasha DeFi Execution (runtime mirror)

Everything that moves money or signs. **Dry-run by default; `--execute` only behind the documented gate; any sign/trade needs explicit Gabriel confirmation.**

## Signal → action
- `position-monitor.js` (every 30m, read-only) → writes `content/lp-rebalance-signal.json` if action needed.
- `lp-rebalancer.js --execute` → CLAIM_FEES | CLOSE_REOPEN | DELEVERAGE | KILL.
- `hedge-executor.js --execute` (HEDGE_LIVE_OK=1) → reconcile HL short to LP delta.
- `mantle-treasury.js --action report|compound-from-profit` → mETH treasury.
- `auto-trade.js` / `byreal-trade.js` → act on the fused signal.

## Kill switches (do not weaken)
OOR > 240 min → CLOSE_REOPEN. HF < 1.20 warn / < 1.05 DELEVERAGE. Funding < −54.75% ann → hedge kill. HL min order $10.

## Gates
1. `--dry-run` first, read the plan.
2. Explicit Gabriel confirmation for any `sign`/`trade`.
3. Live cron execution is env-gated (`HEDGE_LIVE_OK=1`, `--execute`).
4. Never substitute a guessed value into a signing path if a fetch fails (e.g. `spawnSync ETIMEDOUT`) — skip and retry next run.

Full version + execution map / safety gates: dev workspace `.claude/skills/sasha-defi-execution/`.
