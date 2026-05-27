# LP Miner — Strategy Review vs. Deployed Reality
**Date:** 2026-05-27 · **Reviewer:** Claude (Opus 4.7) · **Scope:** designed thesis (spec v1.0 + winning-thesis) vs. what is actually running, with EV/risk-return rework.

> **Framework in play:** Sprint (Knapp/Zeratsky/Kowitz) — name the assumptions that would *kill* the strategy and test the riskiest first, not the easiest. The 24h-per-phase compression is a sprint cadence.
> **Applied rule:** Each 24h phase must answer one kill-assumption with real (small-capital) data before the next phase adds leverage or size.

---

## 1. The one-paragraph verdict

The **designed** strategy is sound: a delta-neutral, fee-harvesting LP that (Phase 4) adds modest leverage to amplify a market-neutral carry. The **deployed** system diverged from it in three ways that quietly invert the risk/return: it ran **naked** (no hedge until today), it traded a **Tier-3 meme pool** the spec forbids (Goblin, −15%), and its **pool scorer had no IL term** so it chases raw yield into impermanent loss. The Phase-0 EV simulator (which the spec required and was never built — now built) shows the key truth: **the hedge is a variance-control leg, not the alpha.** Alpha comes from selecting pools where **fee APR clears the pair's IL/LVR** and where **HL funding is positive**. Fixes for all three divergences are now wired in.

---

## 2. Designed vs. Deployed (the gap table)

| Dimension | Designed (spec v1.0) | Deployed reality | Verdict |
|---|---|---|---|
| Phase order | 0 (sim) → 1 (stable/stable $500) → 2 (stable/bluechip) → 3 (hedge) → 4 (lev) | Jumped to Tier-2 cbBTC + traded Tier-3 Goblin; no Phase 0 sim; no stable/stable | **Skipped the safe phases** |
| Hedge | Phase 3, delta-neutral short on HL | `hedgeSize: 0` — naked until today | **Fixed today** (executor built + wired) |
| Leverage | Phase 4, 1.5x, gated on 30d stable | Not built | OK (correctly deferred) |
| Pool selection | Tiered, IL-aware, Tier-3 = $0 in v1 | Scorer = `feeApr×organic×tvl×tier` — **no IL term**; traded Tier-3 | **Fixed today** (risk-adjusted carry + mirage filter + Tier-3 ban on auto-pick) |
| Capital | $500 → $5k → $15k | ~$45 LP + ~$23 HL margin | Micro (validation scale) |
| Signals | social 25 / onchain 20 / Allora 25 / Elfa 15 / Polymarket 15 | Allora/Elfa/Polymarket all returning `null` | **Degraded — running on onchain score + neutral social only** |
| Venue | Base LP only | Base/Aerodrome (this project). Solana/Byreal trading = **separate Mantle hackathon project**, not LP Miner | Scope clarified — Byreal excluded from LP Miner risk accounting |

---

## 3. The EV finding (from `scripts/lp-sim.js`, run on the live position)

Decomposing fees + AERO + funding − IL/LVR − gas across BTC price scenarios:

- **The hedge halves variance.** Std of outcomes $8.24 → $3.87; the BTC −50% tail goes from **−45% → −18%**. This is real downside control.
- **The hedge does NOT create EV.** A delta-neutral LP is a **short-gamma carry**: you earn fees+funding and *pay* the LP's convexity cost (IL/LVR). It is +EV only when **fee income > IL/LVR realized over the horizon** — i.e., while BTC stays within ~±10%.
- **EV is scale-invariant in %.** $45 and $1,000 give identical percentages; "$45 is too small" is a gas-drag point (~0.4% / 30d), not the core issue.
- **The lever that wins is fee-APR-vs-volatility**, plus a positive funding regime. This is exactly why the spec's Phase 1 was *stable/stable* (near-zero IL), and exactly what the deployed scorer got wrong.

**Implication for "maximum upside / lowest downside / high risk-return":** the highest-Sharpe configuration is **stable/bluechip CL LP, hedged, in a positive-funding regime, harvested frequently, then (only once proven) levered 1.5x.** Naked high-vol LP and meme-pool momentum trading are the opposite of this.

---

## 4. What I changed today (wired in)

1. **`scripts/hedge-executor.js`** — delta-neutral BTC/ETH short executor. Sizes to the *live* volatile-token amount (CL math, not the center approximation), reduce-only on all closes, funding kill-switch (−54.75% ann × 3 periods). Signing validated on testnet.
2. **`scripts/lp-opener.js`** — **hedge wired into the open lifecycle.** After any Base volatile-leg position opens, it reconciles the hedge automatically (self-gated on `HEDGE_LIVE_OK` + HL margin); if it can't execute it raises a "running NAKED" Telegram alert. *No volatile LP opens naked again.*
3. **`scripts/pool-scanner.js`** — scorer now ranks **risk-adjusted net carry** (`(fee+reward)×organic − ilDrag(tier)`), so a high-fee volatile pool can rank *below* a modest stable one. Added the **emission-mirage filter** (fee must be ≥10% of total APY — the rule that would have blocked Goblin). **`bestOverall` constrained to Tier 1-2** (Tier 3 never auto-recommended).
4. **`scripts/lp-sim.js`** — the missing Phase-0 EV simulator. `npm run sim`.
5. **`package.json`** — `hedge:check/funding/exec`, `hedge:deposit`, `sim`, `lp:open-hedged`, `lp:maintain`.

The hedge is a **declarative reconciliation loop**: `hedge-executor` brings *all* open Base positions to their target short on every run, so a cron makes the whole book self-hedging.

---

## 5. Kill-assumptions (Sprint framing) — compressed to 24h/phase

Each phase must answer ONE kill-assumption with live data before the next adds risk.

| Phase (24h) | Kill-assumption to falsify | Pass signal |
|---|---|---|
| **3 — hedge (today)** | "The HL short tracks LP delta within tolerance and funding stays favorable" | 24h: drift stayed <5% between rehedges; funding net positive; no kill-switch |
| **4 — leverage (Thu)** | "The unlevered hedged carry is reliably +EV" — *do not lever a carry that isn't proven positive* | 24h Phase-3 PnL ≥ 0 after fees−funding−gas; Morpho HF math matches UI |
| **(ongoing)** | "Fee APR clears IL/LVR for the chosen pool" | realized fees ≥ realized IL over the window (sim's core test, now measurable live) |
| **(already FALSIFIED)** | "Byreal momentum pool-picking has edge" | Goblin −15%. **Kill or ring-fence this layer.** |

---

## 6. Recommendations (decisions for Gabriel)

1. **Open the live hedge now** (Phase 3 start) — the order is staged: short 0.00028 BTC, ~$21 notional, $22.92 margin, funding +0.6% in our favor. Awaiting your "go."
2. **Solana/Byreal momentum layer — OUT OF SCOPE (separate project).** Per Gabriel (2026-05-27): the Byreal momentum trading is the **Mantle Turing Test hackathon** project — a different initiative and a different bankroll, not part of the LP Miner. Left untouched. This review and all hedging/scoring changes apply to the **Base/Aerodrome LP Miner only**. The two should not be conflated in risk accounting.
3. **For Phase 4, lever only the hedged Tier-2 carry, 1.5x max** — and only if the 24h Phase-3 carry prints ≥0. Never lever naked or Tier-3.
4. **Restore the signal stack** (Allora/Elfa/Polymarket all `null`) — they're the hackathon judge plays *and* the regime filter that should gate sizing. Separate work item.
5. **Re-validate the cbBTC pool's 30-day fee APR** before scaling — the spec quarantined the 272% number as a likely narrow-range spike. The sim assumed a conservative 35% realized; confirm before adding capital.
6. **Scale capital only after the hedged carry is proven +EV in %** — at $45 the structure is right but the absolute return is noise.

---

*Companion artifacts: `scripts/lp-sim.js` (EV engine), `scripts/hedge-executor.js` (Phase 3), execution-spec v1.0 (design source of truth). This review updates the deployed system toward the designed thesis; it does not replace the spec.*
