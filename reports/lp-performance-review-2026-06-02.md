# Sasha LP — Performance Review

**As of:** 2026-06-02 12:36 UTC
**Period:** 2026-05-27 20:06 (hedge go-live baseline) → 2026-06-02 (~6 days)
**Book:** Liquidity-mining / delta-neutral LP
**Author:** MangaOS (Sasha account manager)
**Data sources:** live VPS runtime state — `lp-positions.json`, `lp-monitor-report.json`, `capital-pool.json`, `web/lp-miner/data/dashboard.json`, `web/okx/data/dashboard.json`, `treasury-yield-log.json`, `portfolio-history.json`. NAV anchored to `miner-baseline.json`.

---

## Executive summary

The delta-neutral LP machine is **mechanically healthy and running autonomously**. It has held one position in range 100% of the time, the hedge is safe and earning positive funding, and the risk engine is configured and quiet.

But two things matter more than the headline:

1. **The reported +$1.54 / +2.17% is mostly a mark-to-market artifact, not earned yield.** It is the hedge's unrealized gain from BTC falling 7.6%, which in a true delta-neutral book is offset by the LP's value decline that the dashboard does not yet book. Real economic edge over the period is the **$1.42 of LP fees plus a small positive funding carry, minus gas** — roughly flat to slightly positive.
2. **Capital is under-deployed and fragmented.** Only ~$45 of a ~$90 total footprint is in a yield position. About $19 sits idle or stranded across Solana, Mantle, and idle wallets, plus ~$15 of over-funded hedge margin.

This is a proof-of-concept that **proves the concept**. The open question is not "is it broken" (it is not) — it is **consolidate-and-scale, or keep as a demo.**

---

## The book at a glance

**NAV:** $70.89 (baseline, 2026-05-27) → **$72.43** (current). Net **+$1.54 / +2.17%** over ~6 days.
Intraday NAV has been stable around $72.0 across the full observable window (the one $68.97 print at 12:31 UTC was a transient stale read, recovered on the next tick).

### Capital census (where the ~$90 actually is)

| Bucket | USD | Status |
|---|---|---|
| LP deployed — Aerodrome (Base) | $45.00 | Earning fees |
| Hedge account — Hyperliquid | $24.47 | Only $9.34 margin used → ~$15 idle buffer |
| Solana wallet | $13.75 | Idle ($10.05 USDC + $3.69 SOL + dust) |
| LP wallet idle (Base) | $2.96 | Idle |
| X Layer agent | $3.57 | Demo only |
| Mantle wallet | $1.46 | Dust |
| **Total footprint** | **~$90.21** | **~$45 (50%) productively deployed** |

---

## Position detail

### Live: USDC/cbBTC — Aerodrome Slipstream (Base)

| Field | Value |
|---|---|
| Capital deployed | $45.00 |
| Pool | Aerodrome CL2000, fee tier 0.0338% |
| Range | $65,000 – $88,000 (BTC) |
| Current price | ~$69,197 — **in range** |
| Time out of range | **0 minutes** since open |
| Pending fees | **$1.42** (unclaimed; auto-claim threshold $4.50) |
| Live liquidity | 8,559,866 |
| Opened | 2026-05-26 15:52 UTC |
| Staked in gauge | 2026-05-26 15:57 UTC |
| NFT token ID | 71397771 |

### Hedge: short BTC perp — Hyperliquid

| Field | Value |
|---|---|
| Side / size | Short 0.00027 BTC |
| Entry / mark | $74,864 / $69,163 |
| Notional | $18.67 |
| Unrealized PnL | **+$1.54** (BTC −7.6%) |
| Funding | **+1.4% annualized — positive carry** |
| Liquidation price | $157,836 (≈2.3x headroom — very safe) |
| Margin used / account value | $9.34 / $24.47 |
| Delta-neutral | True |

---

## Honest P&L decomposition

The reported net **+$1.54** equals the hedge's unrealized gain almost exactly (0.00027 BTC × $5,701 move = $1.54). That gain exists because BTC fell. In a delta-neutral book it should be roughly offset by the LP's cbBTC exposure declining — but the dashboard values the LP at flat deployed basis and flags this directly: *"LP valued at deployed basis (in-range ≈ flat); precise IL accounting pending the ledger."*

So the headline overstates the result. Strip the MTM artifact and the true economic edge is:

- **+$1.42** LP swap fees over 7 days (real, unclaimed)
- **+1.4% annualized** funding carry (small, positive)
- **minus** gas costs and any net impermanent loss (not yet booked)

**Net true economic profit on $45 deployed: roughly flat to slightly positive.** For a delta-neutral fee-harvesting pilot held only 7 days, that is the strategy working as designed. The point is not to make directional money — it is to stay market-neutral and clip fees. It is doing that.

*Note on annualizing: $1.42 in 7 days on $45 implies a very high gross APR, but a 7-day micro-sample is not a reliable basis for extrapolation. Treat the fee figure as an absolute, not a rate.*

---

## Per-leg assessment

**Aerodrome USDC/cbBTC — the only working position.** In range the entire time, fees accruing, mechanically sound. This is the strategy.

**Hyperliquid hedge — doing its job, slightly over-capitalized.** Delta-neutral, safe liquidation distance, positive funding. But only $9.34 of the $24.47 account is working margin; ~$15 is idle buffer that could be trimmed or redeployed.

**Solana / Byreal — stranded capital.** $13.75 sits idle ($10 USDC). Earlier SOL/USD1 LP activity (posted to X May 27–29) appears to have been closed; the capital was never redeployed. This is the single largest pool of dead capital.

**Mantle mETH "treasury yield" — economically dead.** A $1.46 position whose mETH balance has been flat for a week, with daily yield in fractions of a gwei (rate noise, negative on some days). Not worth the daily monitoring cron. The Mantle trading bot is a separate system with its own log and is out of scope here.

**X Layer / OKX dynamic-fee hook — a demo, not a position.** Pool TVL is **$1.30**; agent holdings $3.57. The fee oracle pushes every 2 hours (86 pushes to date, all "risk-on / 0.05%") and **burns OKB gas on each push for zero economic activity.** It is a working tech demo from the hackathon and a fine narrative artifact, but it is a cost center, not a yield source.

---

## Risk posture — conservative and sound

- In range 100% of the time; 0 OOR minutes.
- Hedge liquidation $157,836 vs $69,163 mark — ~2.3x headroom.
- Positive funding carry (paid to hold the short).
- Kill switches configured and quiet: OOR timeout 240 min, hedge drift 5%, HF deleverage 1.2 / emergency 1.05, funding kill −54.75%. **None armed.**

The residual risks are **operational** (multi-chain dust, occasional stale-read NAV blips, the known byreal/Solana balance-read timeout) and **opportunity cost** (idle capital), not market risk.

---

## Findings and recommendations

1. **Consolidate the stranded capital.** Sweep the ~$19 idle across Solana ($13.75), Mantle ($1.46), and the idle LP wallet ($2.96) into a working position. Decide whether to scale the existing Aerodrome position or open a second delta-neutral pool.
2. **Trim the hedge buffer.** ~$15 of the Hyperliquid account is idle margin. Right-size it to the actual notional plus a safety band and redeploy the rest.
3. **Retire or accept the dead legs.** The Mantle mETH staking yield and the X Layer demo earn nothing and cost gas/monitoring overhead. Either decommission their cron jobs or keep them explicitly as narrative artifacts with that label.
4. **Fix the P&L ledger.** Until the LP side books impermanent loss against the hedge gain, every NAV report will mislead on directional days. This is the highest-value engineering fix for trusting the dashboard.
5. **Scale decision.** At ~$45 deployed, absolute returns are trivial and the "look at my onchain treasury" narrative is thin. If this is meant to be a real proof point, it needs more capital and fewer fragments. If it is a demo, label it as one and stop optimizing it.

---

## Tracking baseline for next review

| Metric | Value (2026-06-02) |
|---|---|
| NAV | $72.43 |
| Deployed capital | $45.00 |
| Idle / stranded | ~$19 + ~$15 hedge buffer |
| Open positions | 1 (Aerodrome USDC/cbBTC) |
| Pending unclaimed fees | $1.42 |
| Funding (annualized) | +1.4% |
| Capital utilization | ~50% deployed |

---

## Receipts

- **LP NFT:** Aerodrome Slipstream #71397771
- **Open tx:** [0xd176d5da…f437e0e](https://basescan.org/tx/0xd176d5da1cbd869ecb76989584d16c03ad0cff4250b17224c3b282fa4f437e0e)
- **Stake tx:** [0xe8dd7f99…afb3c10](https://basescan.org/tx/0xe8dd7f99be932c3dd39bf142dbcf37823fa3e3c81e22efd8eaa004cb2afb3c10)
- **LP wallet (Base):** `0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9`
- **Hedge wallet (Hyperliquid):** `0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04`
- **Solana wallet:** `647TT6SWA48yrmH8Csb2QakeYMnCNh2oSFijLQpRksJw`
- **X Layer pool:** `0x4d3946dfb8ac9f3145e41b67e55eb2ffb02bf0c027c24ca8ffb3e55381f617cc`
- **Live dashboard:** https://sasha-dashboards.pages.dev/mantle
