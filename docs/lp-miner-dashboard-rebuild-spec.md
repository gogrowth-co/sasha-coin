# LP Miner Dashboard — Rebuild Spec (true value + glanceable + multi-LP)

**Created:** 2026-06-02 (handoff from the marketing/ Sasha review session)
**Execute in:** this workspace (`sasha-coin/`). Runtime + dashboard + deploy live here.
**Decision support:** `reports/lp-miner-performance-2026-06-02.md` (+ `.html`) — the manual marked-to-market review this rebuild must reproduce automatically.
**Status:** SPEC / ready to build.

---

## Goal (Gabriel's words)

> "Update the LP miner dashboard to reflect true value. Display the LP range so I can see it. I need a true vision, accurate and precise, of the LP miner. Imagine we'll have more LPs in the future, so we need to view the setup and the performance at a glance."

Two deliverables: **(A)** the data is true (marked to market, no mixing), and **(B)** the front-end shows setup + performance at a glance, with the range visualized, scalable to N positions.

---

## Current state (verified 2026-06-02)

- Files: `web/lp-miner/index.html` (421 lines), `scripts/build-dashboard-data.js` (builds `web/lp-miner/data/dashboard.json`), `scripts/lp-reconcile.js`.
- **Local ↔ VPS are in sync** (identical hashes on all three). Keep it that way: edit here, deploy via `deploy.sh`, never hand-edit on the VPS.
- Deploy path: VPS cron rebuilds `dashboard.json` and publishes `web/` to Cloudflare Pages (`sasha-dashboards.pages.dev/lp-miner/`) every ~5 min. **Step 1 for the build: confirm the exact publish command/cron** before changing the contract.

### The bug to fix
The dashboard carries the LP at **deployed basis ($45 flat)** — `positions.items[].ilPct` and `netPnlPct` are `null`, note says "precise IL accounting pending the ledger." It then reports `overall.netPnlUsd` ≈ the hedge's mark-to-market gain as profit, and blends idle wallet + full hedge account into NAV. Net effect: **headline overstates the real result by ~4x** (+$2.05 shown vs +$0.45 real).

---

## A. Data accuracy fixes (`build-dashboard-data.js` / `lp-reconcile.js`)

1. **Mark the LP to market on-chain.** For each open position: read `slot0()` on the pool, combine with the NFT's `liquidity` + `tickLower/tickUpper` (from `positions(tokenId)` on NPM `0x827922686190790b37229fd06084350E74485b72`), compute current `amount0/amount1` via the standard CL formula, value at live token prices. This is the LP's real liquidation value. Stop carrying it at deposit basis.
2. **Separate organic vs emission yield.** While staked in the gauge the LP earns **AERO emissions** (via `gauge.getReward()` / `gauge.earned()`), NOT swap fees. Rename/structure the field honestly: `emissionsUsd` (AERO) distinct from `swapFeesUsd` (≈0 while staked). Do not label emissions as "fees."
3. **Separate working capital from idle/quarantined.** Emit `workingCapitalUsd` (LP deployed + hedge margin used) and `idleUsd` broken out (idle hedge buffer = hedge account − margin used; idle LP wallet). The return % must be computed on working capital, never on blended NAV.
4. **True net P&L per position:** `lpMtmChange (current LP value − deployed) + hedgeUPnl + emissionsUsd + fundingUsd − gasUsd`. Also expose the "net divergence after hedge offset" line (`lpMtmChange + hedgeUPnl`) — it's the honest IL-after-hedge number.
5. **Hedge entry from Hyperliquid, not the state file.** Use `clearinghouseState.entryPx` (real fill). The `lp-positions.json` `hedgeEntryMark` is a drift-tracking value, not the entry. (Real entry was $72,273.80; state file wrongly showed $67,945.)
6. **Stop reporting blended NAV as the headline.** Keep a NAV figure if useful, but the hero number is the marked-to-market net result on working capital.

### Verified reference numbers (the rebuilt pipeline must reproduce these, ±rounding, at the same prices)
| Field | Value |
|---|---|
| Pool | `0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb` |
| Gauge | `0x9B55cb6cAe1e303B5EDce6F9fcf90246D382809c` |
| NFT | #71397771 · liquidity 8,559,866 · ticks [−68000, −64000] · tickSpacing 2000 |
| Range | $65,000 – $88,000 · current tick −65157 (in range) |
| LP composition | 12.4930 USDC + 0.00043657 cbBTC |
| LP value (MTM) | ~$41.95 (vs $45.00 basis → −$3.05) |
| AERO emissions pending | ~$1.485 (~3.93 AERO @ $0.378) |
| Hedge | short 0.00043 BTC, entry $72,273.80, uPnL +$2.006, funding ~+$0.03 |
| Working capital | $59.54 (LP $45 + hedge margin $14.54) |
| Idle (quarantined) | hedge buffer ~$10.40 + LP wallet $2.88 |
| Gas (open+stake) | ~$0.01 |
| **Net result** | **≈ +$0.45 over ~7 days** |

---

## B. Front-end rebuild (route through designer agent + `dashboard-design` skill)

Per the design rules, do **not** hand-roll this. Run the designer agent, load `dashboard-design` (which loads `design-principles` as the floor) and **Sasha's `_context/brand-style.md`**. Build a from-scratch redesign, not a patch (ambition over increments).

### Requirements
- **One card per LP position**, designed so adding the 2nd, 3rd, Nth LP just adds a card. Top-of-page = book summary (totals, true net, working vs idle), then a card grid of positions.
- **Range visualization (mandatory).** A horizontal range bar per position: lower bound — current price marker — upper bound, with clear in-range (green) / out-of-range (red) state and the % of range used. This is the "show me the range" ask.
- **Setup at a glance:** pair, venue/chain, fee tier, range, staked?, hedge (side/size/venue), delta-neutral status.
- **Performance at a glance:** LP MTM value vs basis, IL, emissions (labeled as emissions), hedge PnL, funding, net result on working capital, time held. Idle capital shown on the side, visually separated, never inside the return.
- **Honesty by design:** the hero number is the marked-to-market net, not the blended NAV. Emissions are never called fees. Idle is never summed into performance.
- Keep it readable at a glance on desktop; mobile-friendly.

---

## Deploy + verification (do not skip)
1. Confirm the publish command/cron first (step 1 above).
2. Edit in the local sasha-coin tree. Diff vs VPS before deploy (currently in sync — keep it so).
3. `deploy.sh` to push. Let the next real build run.
4. **Verify on the live page** (`sasha-dashboards.pages.dev/lp-miner/`) that it shows the true marked-to-market values and the range bar before calling it done. Per the no-false-claims rule: do not say "fixed" until the live page is observed showing $41.95-class LP value and the range, not $45 flat.

---

## Scope guardrails
- LP miner only this round. The contract should be N-LP ready, but only the Aerodrome position exists today.
- No change to the LP/hedge strategy or capital. This is reporting + visualization accuracy only.
- Testnet/runtime safety: read-only on-chain calls for marking; no position changes.
