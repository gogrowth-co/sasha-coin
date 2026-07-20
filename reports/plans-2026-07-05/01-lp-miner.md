# LP Miner — Deep Review & Improvement Plan
### 2026-07-05 · Fable 5 · Initiative 1 of 5

## Current state (verified live)

| Metric | Value | Source |
|---|---|---|
| Open position | WETH/USDC CL100, NFT 71722642, ticks [-202600, -200600] ($1591–$1943) | VPS state + on-chain |
| Range status | In range, 48.9% of range, ETH ~$1759 | live dashboard (Pages, 12:45Z today) |
| Net result | **+$1.21 over 30.7 days (+2.74%)** on $45.55 working capital | live dashboard |
| Earnings mix | swap fees $1.17 (dominant), hedge uPnL $0.06, funding $0.06, LP MTM −$0.08 | live dashboard |
| Hedge | static 0.0106 ETH short, mark 15% from liq $2082, funding +1.4% ann | monitor log |
| Automation | monitor */30, rebalancer 3,33 * * * * --execute, hedge cron (no-op on static), weekly pool scan Mon 10:00 UTC, dashboard every 15 min | /etc/cron.d/ |

**What works well:** the position is genuinely delta-neutral and profitable; the monitor runs clean every 30 min with correct in-range/liq-proximity checks; confirm-gated KILLs are held for Gabriel with Telegram alerts; the dashboard pipeline (state → snapshot → reconcile → Pages deploy) is the strongest automation in the whole portfolio.

## Gaps (ordered by exposure)

1. **Audit M-2 — orphan-short sweep only fires on an empty book.** A leftover short from a closed LP survives if any other LP is open. Naked exposure risk.
2. **Audit M-3 — hedge state written without checking HL fill statuses.** Dashboard can claim delta-neutral for up to 30 min when it isn't.
3. **Audit H-3 — stop-loss CLOSE_POSITION auto-executes from cron** while the doc claims a universal confirmation gate. Decide the intended boundary; document it.
4. **Static hedge is invisible to automation by design** — hedgeUpdatedAt frozen since Jun 4. The manual KILL policy (OOR>24h / ETH<$1511 or >$2040 / hedge within 3% of liq) lives only in a memory + decision log. If Gabriel misses a Telegram alert, nothing else fires.
5. **Local state is a stale mirror** (lp-positions.json updatedAt Jun 4). One-writer rule says VPS wins, but nothing warns when local drift exceeds N days.
6. **Scanner v2 still unbuilt** — pool-scanner.js ranks on DefiLlama (unreliable for CL); the verified data stack (GeckoTerminal + DexScreener + on-chain fee() + 7d vol, spec'd in docs/integrations/lp-data-sources-api-reference.md) was never wired in. The weekly Monday scan produces rankings nobody should trust.
7. **Fee claim threshold unreachable:** rebalancer CLAIM_FEES fires at $5 pending; at ~$0.04/day the position will take ~4 months to hit it. Unclaimed fees sit in the NFT (not compounding).

## Plan

**P0 — safety correctness (this week, ~2h total) — SHIPPED 2026-07-05, see DEC-016**
- ✅ Fix orphan sweep: build the set of perp coins backed by an open LP; close any HL short in a coin outside that set, every run. Shipped in `hedge-executor.js`. Bonus catch: this exposed a stale `POOL_REGISTRY` pool address for WETH/USDC (pointed at a different fee-tier pool than the live position) that would have made the fixed sweep close the live hedge as "orphaned" — fixed the registry before shipping.
- ✅ Parse `res.response.data.statuses` after placeOrder; only write `hedgeSize` on confirmed fill; alert on rejection. Applied to all four order-placing call sites (orphan sweep, funding-kill, `--close`, main reconcile), not just the one M-3 named.
- ✅ Kill policy: Gabriel's call was gate-first, not auto-first — all five KILL triggers (stop-loss, emergency stop-loss, HF-emergency, funding-kill, OOR-distance, hedge-liq-proximity) now carry `confirmGated: true` in `position-monitor.js`, none auto-execute. Backtested against real ETH price (CoinGecko) + funding (Hyperliquid) history since the position opened: funding-kill and hedge-liq-proximity have wide safety margins (worst cases −3.81% ann vs −54.75% threshold; 11.5% vs 3% liq distance) and are reasonable to un-gate later; OOR-distance had a real near-miss (4.29% vs 5% threshold during the June dip to $1522.58) and should probably stay manual. Stop-loss/HF-emergency are currently dead code for this position (Base `valueUsd` never computed; `morpho` is null) so gating them is precautionary, not yet load-bearing. Full writeup: `docs/decision-log.md` DEC-016. CLAUDE.md, the pre-audit handover doc, and the `sasha-defi-execution` skill's safety-gates.md were all corrected to match (they previously claimed a universal confirmation gate that didn't exist in code).

**P1 — resilience (next 2 weeks)**
- Add a `staticHedgeWatch` block to position-monitor: check the three manual-KILL triggers explicitly and escalate (repeat Telegram every cycle while breached, not once). The policy should live in code, not memory.
- Drift alarm: monitor warns when VPS-state age vs local mirror exceeds 7 days (one-line check in the weekly preflight).
- Lower CLAIM_FEES threshold to $1.50 (still >10× gas on Base) or switch to time-based claims (monthly) so fees actually realize.

**P2 — growth (gated on capital decision)**
- Scanner v2 on the verified data stack — the single highest-leverage build (spec exists, ~1 day). Include the minFeeApr=15% fix and the on-chain-dominant signal weights.
- ✅ Phase 4 leverage gate — EVALUATED 2026-07-05, **NO-GO for now**, see DEC-017. Carry math clears comfortably (31.9–37% annualized realized carry vs live Morpho WETH/USDC borrow APY of 4.78%, a 6.7–7.7x margin — fresh-queried, not the stale prep-doc figure). But no leverage execution script exists (`scripts/lp-leverage.js` was never built), the absolute dollar gain at current size is ~$0.46/month, and leverage would introduce the position's first-ever liquidation risk onto a deliberately simple, `staticHedge`, manual-KILL-policy position. Revisit only if capital scales 5-10x or the leverage script gets validated elsewhere first.
- Consider range recenter: at 48.9% of range with 2.2%→lower / 19.6%→upper asymmetry earlier in the month, the June 10 snapshot showed 9.8% — the position drifts. A quarterly recenter policy (manual, confirm-gated) beats ad-hoc.

**KPI:** keep net result positive per 30d window; zero unhedged hours; scanner v2 shipped before adding any second position.
