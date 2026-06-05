# Sasha LP Review — Project 1: LP Miner (Aerodrome + Hyperliquid)

**As of:** 2026-06-02 ~20:30 UTC
**Period:** opened 2026-05-26 15:52 UTC → now (~7 days)
**Scope:** the delta-neutral LP miner only. Idle wallet cash is quarantined and reported on the side, never inside the return.
**Method:** LP marked to market live on-chain (not deployed-basis), hedge read from Hyperliquid, yield source verified in code.
**Data sources:** Base RPC (position NFT #71397771 + pool `0x3e66…a9fb` slot0), Hyperliquid `clearinghouseState`, VPS `lp-positions.json`, CoinGecko prices, on-chain tx receipts (gas).

---

> **⚠ CORRECTION (2026-06-02, later same day) — supersedes the +$0.45 headline below.**
> This report valued pending emissions off the VPS `pendingFeesUsd` field (3.93 AERO / $1.485). The dashboard rebuild then read the true on-chain **`gauge.earned()` = 0.44 AERO ($0.17)** (`lastClaimAt` is null, so that is the real cumulative figure). Corrected 7-day result is **≈ −$0.80 marked to market, not +$0.45.** The unit is currently slightly net-negative, profitable only if emissions accrue faster.
> The hedge is vindicated: **true IL vs HODL is only −$0.36** (the −$3.4 "vs deposit" is mostly the cbBTC price drop, which the hedge offsets). The ~19% realized emission APR this implies (0.44 AERO/7d on $45) matches the ~21% gauge-rewardRate estimate in `research/lp-data-sources-methodology-2026-06-02.md` — it was only the `pendingFeesUsd` field that lied, exactly as that note warned. **The live dashboard is now the source of truth for this position; the HTML companion's +$0.45 is likewise superseded.**

## What this project is

One delta-neutral unit, two legs that only make sense together:

- **LP leg** — Aerodrome Slipstream concentrated-liquidity position, USDC/cbBTC, range $65k–$88k, staked in gauge `0x9B55…809c`.
- **Hedge leg** — Hyperliquid short 0.00043 BTC, sized to neutralize the LP's cbBTC exposure.

I report LP value, AERO yield, hedge PnL, and funding as separate line items so nothing blurs.

---

## Capital: what's working vs. what's idle

| | USD | In the return? |
|---|---|---|
| LP deployed (basis) | $45.00 | ✅ working |
| Hedge margin actually used | $14.54 | ✅ working |
| **Working capital** | **$59.54** | **denominator** |
| Hedge idle buffer (acct $24.94 − margin $14.54) | ~$10.40 | ❌ quarantined |
| Idle LP wallet (0.37 USDC + 0.0013 ETH) | $2.88 | ❌ quarantined |

The dashboard's headline NAV ($72.94) blends all of this together. That blend is what made the result look better than it is.

---

## Live position (marked to market, not basis)

**LP — on-chain composition right now:**

| Field | Value |
|---|---|
| Liquidity | 8,559,866 (in range, tick −65,157 inside [−68,000, −64,000]) |
| Token balances | **12.4930 USDC + 0.00043657 cbBTC** |
| cbBTC value @ $67,481 | $29.46 |
| **LP liquidation value today** | **$41.95** |
| Deployed basis | $45.00 |
| **LP mark-to-market change** | **−$3.05** |

As BTC fell ~10% from open, the position did what CL LPs do: it rebalanced into the falling asset. It is now mostly cbBTC. The dashboard hid this by carrying the LP at $45 flat (`ilPct: null`).

**Hedge — Hyperliquid (source of truth):**

| Field | Value |
|---|---|
| Side / size | Short 0.00043 BTC |
| Entry / mark | $72,273.80 / ~$67,500 |
| Unrealized PnL | **+$2.006** |
| Funding since open | ~+$0.03 (net, negligible) |
| Margin used / account value | $14.54 / $24.94 |
| Liquidation | $124,055 (far away, safe) |

*(Note: the VPS state file lists a hedge "entry" of $67,945. That is a drift-tracking value, not the fill. The real entry from Hyperliquid is $72,273.80.)*

---

## The yield is AERO emissions, not swap fees

The position is **staked in the Aerodrome gauge**. Verified in `lp-harvest.js`: yield is claimed via `gauge.getReward()` and valued via `gauge.earned(account, tokenId)` in **AERO**. The field labeled `pendingFeesUsd` is a misnomer.

- Pending reward: **$1.485** (≈ 3.93 AERO @ $0.378).
- While staked, the LP earns AERO emissions and **forfeits organic swap fees** (they go to voters).

This is emission yield, not organic fee yield. It is the exact distinction the Mantle signal fix was built around. It matters because emission APR decays and AERO carries sell pressure.

---

## Honest P&L decomposition (since open, ~7 days)

| Component | USD |
|---|---|
| LP mark-to-market change | **−$3.05** |
| Hedge unrealized gain | **+$2.006** |
| Net divergence after the hedge offset | **−$1.04** |
| AERO emissions (claimable) | **+$1.485** |
| Funding carry | +$0.03 |
| Gas (open + stake) | −$0.01 |
| **Net economic result** | **≈ +$0.46** |

### Close-out test ("what would Sasha walk away with today")
- Put in: **~$67.93** (LP $45.00 + hedge account funded ~$22.93)
- Walk away today: LP $41.95 + AERO $1.485 + hedge account $24.94 = **~$68.38**
- **Net: ≈ +$0.45** before close fees and slippage.

On ~$59.54 of working capital, +$0.46 over 7 days is **+0.77%**. A 7-day micro-sample does not annualize reliably. Treat it as an absolute, not a rate.

---

## What this actually says

1. **The dashboard overstates the result by ~4x.** It reports +$2.05 / +2.89% by counting the hedge's +$2.006 mark-to-market gain as profit while carrying the LP at $45 flat. Mark the LP to market and the real result is **+$0.45**.
2. **The hedge worked, but under-covered.** LP lost $3.05, the short recovered $2.006. The ~$1.04 gap is the LP's structural divergence/IL cost that a static (non-rebalanced) hedge cannot recover.
3. **Profit is 100% emission-dependent.** Strip the AERO emissions and the delta-neutral unit is **net negative** over the period (≈ −$1.02). The only reason it is green is AERO, which is emission yield, not organic fees.
4. **Currently well delta-matched.** LP holds 0.000437 cbBTC; hedge shorts 0.00043 BTC. Net delta is near zero right now.
5. **Capital efficiency is poor.** Of ~$22.9 in the hedge account, only $14.5 works; ~$10.4 sits idle. Another $2.88 sits idle in the LP wallet. Roughly $13 of the unit's footprint earns nothing.

---

## Verdict

**Mechanically sound, currently neutral, profitable only on emissions.** Over 7 days the AERO emissions ($1.485) barely outran the LP's divergence loss after the hedge (−$1.04), netting about **+$0.45**. At $45 deployed, the absolute dollars are trivial and the idle-capital drag is large relative to the position.

The real decision is not "is it working" (it is, narrowly). It is:
- Does AERO emission APR justify the IL plus the ~$13 of idle capital this unit ties up?
- Should the hedge be rebalanced dynamically (it under-covered on the way down), or is a static hedge acceptable at this size?
- Is this a demo or a position you intend to scale? At this footprint the answer to that decides everything else.

---

## Receipts
- LP NFT: Aerodrome Slipstream #71397771 · pool `0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb` · gauge `0x9B55cb6cAe1e303B5EDce6F9fcf90246D382809c`
- Open tx: [0xd176d5da…f437e0e](https://basescan.org/tx/0xd176d5da1cbd869ecb76989584d16c03ad0cff4250b17224c3b282fa4f437e0e) · Stake tx: [0xe8dd7f99…afb3c10](https://basescan.org/tx/0xe8dd7f99be932c3dd39bf142dbcf37823fa3e3c81e22efd8eaa004cb2afb3c10)
- LP wallet (Base): `0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9`
- Hedge wallet (Hyperliquid): `0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04`
- Live dashboard: https://sasha-dashboards.pages.dev/lp-miner/
