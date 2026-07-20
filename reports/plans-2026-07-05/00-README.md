# Initiative Deep Review — Index
### 2026-07-05 · Fable 5 · Follow-up to reports/security-audit-fable5-2026-07-04.md

Five independent reviews + improvement plans. Everything below was verified live (on-chain, VPS cron/logs/processes, Pages dashboards) — not just from code.

| # | Initiative | Health | Headline | Plan |
|---|---|---|---|---|
| 1 | LP Miner | 🟢 Working | +$1.21 / 31d, delta-neutral, best automation in the portfolio | [01-lp-miner.md](01-lp-miner.md) |
| 2 | Mantle Trader | 🟡 Dormant | $7 treasury below $2 trade floor; signal pipeline burns API spend for aborts | [02-mantle-trader.md](02-mantle-trader.md) |
| 3 | Dynamic Fee Hook | 🟡 Demo done | 482 oracle updates into a $0-TVL pool; `--force` cron defeats its own staleness safety | [03-dynamic-fee-hook.md](03-dynamic-fee-hook.md) |
| 4 | Casper x402 | 🟢 Clean | Best codebase of the five; submission gated only on a YouTube URL | [04-casper-x402.md](04-casper-x402.md) |
| 5 | CROO Risk Desk | 🔴 At risk | SDK key leaked to logs (ROTATE); provider runs from /tmp; 0 completed orders, 7 days to deadline | [05-croo-risk-desk.md](05-croo-risk-desk.md) |

## Cross-initiative decisions for Gabriel

1. **CROO Day-0 actions (today):** rotate the leaked `croo_sk_…` key, fix the phantom EOA in reputation-proof.ts, move the provider out of /tmp. Everything else in plan 05 depends on orders landing this week.
2. **Trader fork:** top up ~$25–30 (resume the attested-decision track record) or hibernate cleanly (disable crons, stop API spend). Recommended: top up iff CROO gets traction — the trader's attestations are Sasha's reputation collateral.
3. **Hook sunset:** OKX submission is done; switch the oracle cron to heartbeat mode (~80% gas saved, staleness safety restored) and log the sunset decision.
4. **The compounding play** (appears in plans 4 & 5): wire Sasha's initiatives into one loop — CROO sells the risk packet → x402 lets agents pay for it directly → each delivery/decision attested on-chain (ERC-8004 / Casper). Each initiative currently proves a piece in isolation; connected, they're one coherent "autonomous agent economy" story no single hackathon entry has.
