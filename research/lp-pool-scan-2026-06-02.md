# Sasha LP — Pool Scan (find the most profitable LPs)

**Date:** 2026-06-02
**Goal:** Test whether switching pools / fee-capture mode flips Sasha's LP miner from flat to genuinely earning (per DEC-002: the narrative requires positive returns + finding the best LPs).
**Method:** Validated precision stack (see `lp-data-sources-methodology-2026-06-02.md`). Discovery via GeckoTerminal, TVL/volume cross-checked GeckoTerminal vs DexScreener (agreed to 0.1%), fee rate from on-chain `fee()`, fee APR computed on **7-day-average volume** (not the volatility-spiked 24h), emissions from the on-chain gauge. DefiLlama deliberately excluded as unreliable.
**Scope:** Base, hedgeable volatile/stable concentrated-liquidity pairs (volatile leg must have a Hyperliquid perp). 60 pools pulled, 20 hedgeable candidates, top fee-APR pools verified on-chain.

---

## Headline finding

**Sasha is in the worst cbBTC/USDC pool on Aerodrome.** Her pool yields ~17-21% APR. A pool for the *identical pair*, on the *same DEX*, needing the *same BTC hedge*, yields **~118% durable fee APR**. The lever is pool selection, not fee-vs-emission mode.

---

## Ranking (durable fee APR on 7-day-avg volume, on-chain fee)

| Pool (Aerodrome Slipstream, Base) | tickSpacing | on-chain fee | TVL | 7d vol/day | **Durable fee APR** | Hedge |
|---|---|---|---|---|---|---|
| **cbBTC/USDC** `0x4e962b…e778` | ts100 | 0.028% | $11.1M | $128M | **~118%** | BTC (have it) |
| cbBTC/USDC `0x160d7e…eb12` | ts50 | 0.033% | $2.46M | $23.3M | ~114% | BTC (have it) |
| WETH/USDC `0xb2cc22…9dc59` | ts100 | 0.110% | $11.4M | $133M | ~470%* | ETH (new leg) |
| **Sasha — USDC/cbBTC** `0x3e66…a9fb` | ts2000 | 0.037% | $2.94M | $3.7M | **~17% fee / ~21% emission** | BTC (current) |

*WETH 470% is volatility-elevated (fee 0.11% is dynamic and spiked this week); treat as "very high, verify in calm market."

### Current pool, fee vs emission (resolved on-chain)
- Fee APR (durable): **~17%** (forfeited while staked).
- Gauge emits 0.0518 AERO/sec = ~$617K/yr; on ~$2.94M staked = **~21% emission APR** (the figure Sasha actually earns).
- **Verdict: a wash (~17% vs ~21%).** Staking was defensible. The problem is the pool, not the mode.

---

## Recommendation

**Primary (minimal change, maximal effect): migrate the cbBTC LP to the ts100 cbBTC/USDC pool (`0x4e962b…e778`).**
- ~118% durable fee APR vs ~17-21% today: roughly **6x**, same BTC exposure, same hedge, deeper liquidity ($11.1M / $128M-a-day).
- Collect fees directly (organic), which is the DEC-002 narrative: "an agent that finds the most profitable LPs." No AERO sell-pressure, no emission-decay risk.
- This is the move that flips the proof artifact from "flat / emission-dependent" to "visibly earning real fees."

**Secondary / expansion:** WETH/USDC ts100 (~470% fee APR) as a second, ETH-hedged position once the first is proven. Highest yield, but adds an ETH short leg.

---

## Caveats (precision honesty — do not skip before committing)

1. **Tighter tick spacing = more management.** ts100 is far tighter than Sasha's ts2000. To capture that 118% she must hold a tighter active range and rebalance more often (more gas, more out-of-range risk). She automates rebalancing, so feasible, but the rebalancer must be tested at ts100 before real capital.
2. **Dynamic Slipstream fees.** The fee is not fixed; 118% is a 7-day estimate at the current fee. It will vary with volatility. Re-check before and during.
3. **Pool-average vs your share.** The APR assumes you earn proportional to active liquidity in-range. A tight, well-placed range can earn more or less. Validate with Revert's simulator on the actual range.
4. **Does the ts100 pool have a gauge?** Not yet checked. If it is also gauge-incentivized, staking there reintroduces a fee-vs-emission choice (but at 118% fee, collecting fees likely dominates unless emissions are unusually high). One on-chain check before migrating.
5. **Scale.** At $45 this is still pennies in absolute terms. The point is the APR and the narrative, not the dollars. Size up only after the ts100 rebalancer is proven.

---

## Open precision item (one read left)
Confirm whether `0x4e962b…e778` has an Aerodrome gauge and its emission APR, to decide fee-collect vs stake in the new pool. Everything else is verified.

## What this proves for strategy (DEC-002)
The hypothesis holds: **a pool switch flips Sasha from flat to earning, with no change to the hedge.** Pool selection is the dominant lever (confirmed: 6x within the same pair). Fee-vs-emission is secondary and pool-specific. The dashboard's pool-health v2 should rank pools exactly this way (7d-vol fee APR, on-chain fee, hedgeable filter) so Sasha can hunt pools continuously, which is the "finds the most profitable LPs" story itself.
