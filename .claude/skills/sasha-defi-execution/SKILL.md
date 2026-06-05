---
name: sasha-defi-execution
description: Correct, safe usage of Sasha's on-chain execution stack — LP position monitor/rebalancer, Hyperliquid delta-neutral hedge, Byreal CLMM trades, LiFi bridging, Clawlett Safe signing, and the Mantle mETH treasury. Use whenever running or debugging any script that moves funds, opens/closes positions, hedges, bridges, or signs. Encodes the dry-run-by-default and Gabriel-confirmation gates.
---

# Sasha DeFi Execution

Everything Sasha does that can move money or sign a transaction. The golden rule: **dry-run by default; `--execute` only behind the documented gate; any new signing/trade needs explicit Gabriel confirmation.** See `references/safety-gates.md`.

## When to use
- Running/debugging `position-monitor.js`, `lp-rebalancer.js`, `hedge-executor.js`, `byreal-trade.js`, `auto-trade.js`, `mantle-treasury.js`, `lp-opener.js`, `bridge-to-mantle.js`, `dust-consolidator.js`, or any `Clawlett/` script.
- Before touching anything with `live_action_risk` of `sign` or `trade` in the registry.

## The execution map (signal → action)
1. **Monitor** (`position-monitor.js`, every 30 min) reads `state/lp-positions.json`, marks to market, checks kill-switches, and writes `content/lp-rebalance-signal.json` if action is needed. Read-only — safe to run anytime.
2. **Rebalance** (`lp-rebalancer.js --execute`, 3 min after monitor) consumes the signal: `CLAIM_FEES | CLOSE_REOPEN | DELEVERAGE | KILL`.
3. **Hedge** (`hedge-executor.js --execute`, every 30 min, `HEDGE_LIVE_OK=1`) reconciles the Hyperliquid short to live LP delta (rehedge >5% drift), runs the funding kill-switch.
4. **Treasury** (`mantle-treasury.js`) snapshots the mETH pool, compounds profit (daily/weekly crons).
5. **Trade** (`auto-trade.js`, 3x/day; `byreal-trade.js`) acts on the fused signal.

## Kill-switch thresholds (do not change without Gabriel)
- Out-of-range > **240 min** → CLOSE_REOPEN.
- Health factor < **1.20** warn / < **1.05** → DELEVERAGE.
- Funding < **−54.75% annualized** → hedge kill switch.
- Hyperliquid min order value **$10** (smaller orders are skipped — seen in `sasha-hedge.log`).

## Live ops reality (2026-06-03)
The LP/hedge/oracle/treasury crons ARE firing (logs current). But the box is oversubscribed (load ~11 on 2 vCPU) → some scripts hit `spawnSync /bin/sh ETIMEDOUT` on balance fetches. Treat a single ETIMEDOUT as transient, not a position emergency; see `sasha-ops-hardening`.

## Reuse, don't reinvent
- LP/tick/hedge math → `.claude/skills/defi-lp-math`.
- Base contracts/tokens → `.claude/skills/base-defi-stack`.
- Hyperliquid API → `.claude/skills/hyperliquid-perps`.
- Byreal CLI → `.claude/skills/byreal-cli`; Solana CLMM → `.claude/skills/solana-clmm`.
- ERC-8004 identity/attestation → `.claude/skills/mantle-agent`.
- Protocol drift before any deploy → `.claude/skills/protocol-changelog`.
- Pool data (volume/TVL/fee/APR sources, what to trust) → `docs/integrations/lp-data-sources-api-reference.md` (weekly-verified). Rule: GeckoTerminal/DexScreener for volume+TVL, The Graph for exact daily history + tick-level in-range depth on Base/Ethereum (key `THE_GRAPH_API_KEY`), on-chain `fee()` for the rate, Revert for realized APR; **never** DefiLlama APY for a CL sizing decision.

## Files & references
- `references/execution-map.md`, `references/safety-gates.md`.
- Registry owner of Byreal/Hyperliquid/LiFi/Clawlett/Mantle/Base/Solana/Arbitrum/Trenches rows.
