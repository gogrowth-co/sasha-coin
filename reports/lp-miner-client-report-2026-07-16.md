# LP Miner — Performance Report

**Strategy:** Delta-neutral concentrated liquidity (WETH/USDC)
**Venue:** Aerodrome Slipstream (Base) + Hyperliquid hedge
**Reporting date:** July 16, 2026 · Data reconciled live at 2026-07-17 00:00 UTC
**Period covered:** June 4 – July 16, 2026 (42.2 days)

---

## Executive Summary

The LP miner is running one delta-neutral position: concentrated WETH/USDC liquidity on Aerodrome (Base), hedged with a static ETH short on Hyperliquid. Over 42 days the strategy has produced a **net result of +$1.53 (+3.54%) on $43.16 of working capital**, driven almost entirely by swap fees. The hedge is doing its job: ETH rallied ~5.3% since entry, and the divergence loss after hedging is only −$0.29.

> **Key takeaway:** The carry engine works. Fees plus funding are outrunning divergence loss, with no kill switches armed. The one active risk is range proximity: price sits 4.3% below the upper bound of the LP range.

---

## Capital & Results

| Metric | Value |
|---|---|
| Working capital (return denominator) | $43.16 |
| — LP deployed basis | $40.28 |
| — Hedge margin in use | $2.88 |
| Net result (42.2 days) | **+$1.53** |
| Return on working capital | **+3.54%** |
| Annualized projection | ~38.3% APR (35.9% fees + 2.4% funding) |
| Idle capital (quarantined, not in return) | $22.59 |
| Total NAV footprint | $66.45 |

*The APR figure is annualized from 42 days of data. It is a projection, not a realized rate.*

---

## P&L Attribution

| Component | USD | Comment |
|---|---|---|
| Swap fees | +$1.70 | The engine. All still pending claim ($0.87 WETH + $0.83 USDC) |
| LP mark-to-market change | +$0.70 | Position value $40.98 vs $40.28 basis |
| Funding earned on short | +$0.12 | +1.4% annualized, mildly positive carry |
| Hedge unrealized PnL | −$0.99 | ETH rose $1,770.60 → $1,864; short underwater by design |
| Gas | $0.00 | No transactions in period |
| **Net result** | **+$1.53** | |

**Hedge effectiveness:** Impermanent loss vs. hodl is −$0.27. After the hedge, residual divergence is −$0.29. The position captured the fee stream while staying insulated from ETH's 5.3% move.

---

## Open Position

**WETH/USDC · Aerodrome Slipstream CL100 · Base**

| Attribute | Value |
|---|---|
| Status | Open, in range, 42.2 days old |
| Range | $1,590.87 – $1,943.07 |
| Current ETH price | $1,863 (77.3% through the range) |
| Distance to upper bound | 4.3% |
| Distance to lower bound | 17.1% |
| Position value | $40.98 |
| Composition | 32.17 USDC ($32.17) + 0.0047 WETH ($8.81) |
| NFT token ID | 71722642 |

The composition is USDC-heavy because the pool has been selling ETH into the rally, which is expected behavior near the top of a concentrated range.

---

## Hedge Position

**Short ETH perp · Hyperliquid · static (no auto-rebalance)**

| Attribute | Value |
|---|---|
| Size / side | 0.0106 ETH short, 5x isolated |
| Entry / mark | $1,770.60 / $1,864.40 |
| Notional | $19.76 |
| Unrealized PnL | −$0.99 |
| Liquidation price | $2,094 (10.9% away; kill trigger at 3% proximity) |
| Funding | +1.4% annualized, +$0.12 accrued |
| Net delta | −0.0059 ETH (~−$10.94), intentional static-hedge drift |

---

## Risk Controls

All kill switches are unarmed. Active triggers:

- Out-of-range longer than 12 hours
- Price more than 5% beyond the range boundary
- Hedge within 3% of liquidation
- Funding worse than −54.75% annualized

All kill actions require explicit operator confirmation before execution (policy set July 5, 2026).

---

## Watch Item & Outlook

> **Range exit risk:** ETH at $1,863 is 4.3% below the $1,943 upper bound. Another ~4% rally puts the position out of range (100% USDC, fee accrual stops). The playbook: if out of range for more than 24 hours, or ETH moves above ~$2,040, close both the LP and the hedge.

Absent a range exit, the position continues accruing fees at roughly the current pace. Pending fees of $1.70 will be claimed opportunistically to keep gas costs negligible relative to position size.

---

*Live dashboard: https://sasha-dashboards.pages.dev/lp-miner/ · All figures reconciled against on-chain state and Hyperliquid account data at report time.*
