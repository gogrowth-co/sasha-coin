# No-Swap Rebalancing — Decision Memo for Sasha's LP Miner

**Date:** 2026-06-07
**Question:** Should Sasha's autonomous, self-custodied LP miner adopt "no-swap single-sided rebalancing" (the Snuggle.fi / Maxfi technique) for her WETH/USDC Uniswap v3 position on Base?
**Instruments run:** deep research (multi-source, primary-sourced) → 5-advisor council → Klein pre-mortem.
**Verdict (one line):** **NO-GO on the external vault (B), unconditional. NO-GO on building the technique into the live position as a treasury move (A).** The only GO's are two cheap, reversible moves: a shadow backtest (receipts + EV settle) and a Sasha content teardown.

> **Framework in play:** Sprint (Knapp) — test the riskiest assumption with the cheapest reversible prototype before committing capital; sprint the riskiest assumption, not the easiest feature.
> **Applied rule:** Do not touch the live position or any vault until a zero-capital shadow backtest answers the one assumption that can kill the idea (does no-swap + a static short beat go-flat-on-kill, net of everything, across a ranging AND a trending path).
>
> **Second framework:** Pre-mortem (Gary Klein) — *not in the library; applied from general knowledge, flagged as a gap.* Assume the adoption failed; work backward to the causes; watch the leading indicators.

---

## 0. The decisive context the question almost buried

This position is, **as of two days ago (DEC-008, 2026-06-05), deliberately a NO-REBALANCE position.** DEC-008 *removed* auto-recenter (`CLOSE_REOPEN`) from the OOR path with the explicit rationale: *"auto-recenter crystallizes IL on moves that mean-revert; this position is intentionally no-rebalance."* The hedge is **static** (DEC-007: pool `0xb2cc…` is intentionally NOT in the hedge-executor registry; the cron is a no-op on the ETH short; KILL is manual). The autonomy posture is **observe-only first** (the monitor alerts, Gabriel confirms any KILL; the auto-close+re-enter loop is deliberately deferred).

No-swap rebalancing is a *rebalancing* technique. Adopting it does not optimize the current strategy — **it reverses the strategy the stack just chose.** The research's strongest empirical finding ("rebalance ~85% LESS often; greedy rebalancing = −8.4% ROI vs +1.6% lazy") is *already implemented* here in its most extreme form: zero rebalances, kill-only. There is no rebalancing cost left to optimize away.

---

## 1. Research synthesis (primary-sourced)

> **Verification caveat (reported honestly):** the deep-research harness's 3-vote adversarial layer **did not complete** — every vote agent hit a session rate limit and returned no vote, which the harness mislabeled as "refuted / inconclusive." That label is a false artifact. The claims below are drawn from primary sources I read directly, and I independently re-derived the load-bearing delta math with `defi-lp-math`. Confidence is high on the core mechanics/hedge findings; the secondary claims are primary-sourced but were not put through the redundant 3-vote pass.

**Mechanics — confirmed.** A single-sided CL range is a limit order: a range entirely above current price holds the volatile asset and converts to quote as price rises through it; a range below holds quote and converts to volatile as price falls. So on an up-move you end **100% USDC**, on a down-move **100% WETH** (Uniswap range-orders docs; LFJ single-side docs; rareskills). **Critical nuance:** v3 range orders can **UN-FILL** — if price crosses the range then reverses before you withdraw, the conversion reverses. The realized asset split (and therefore position delta) **is not final until withdrawal** (Uniswap range-orders docs).

**Not novel.** Maverick Protocol's Mode Right/Left already does gas-free directional no-swap redeploy natively, and Maverick's own docs warn directional modes carry *"high risk of impermanent loss if price moves the opposite direction."* Single-sided / limit-order LPing is a documented Uniswap v3 and LFJ Liquidity Book primitive. Snuggle/Maxfi packages an existing mechanic (vault + delay param + fee model), it did not invent one.

**Regime-dependent.** Rebalancing is "short realized volatility." No-swap helps mainly in mean-reverting/ranging markets and only on the *out-of-range* IL component; in a sustained trend it does **not** save you (Snuggle's own docs concede this) — you sit 100% in the depreciating asset earning zero fees. Empirical base rate is brutal: across 17 major v3 pools, aggregate IL ($260M) **exceeded** fees ($199M); ~49.5% of LPs were net-negative vs HODL (arXiv 2111.09192). Optimal policy rebalances far less, not more (arXiv 2602.19419: greedy 344-rebalance strategy = −8.4% ROI vs +1.6% for the lazy regime-aware agent; ~85% fewer rebalances optimal).

**Claim check.** "40-50% less IL", "70-80% of exploit vectors removed", "most capital-efficient" are **NOT** in Snuggle's first-party docs — unsubstantiated founder marketing. The docs' only quantified example is a single +5% scenario (~3.5% loss + fees vs ~5% locked-in). The real security benefit is **narrow**: no swap → no swap-step MEV/sandwich/slippage (true, but that's one vector, not 70-80% of all of them; vault custody, oracle, access-control, contract risk all remain). The 15%-performance-fee-on-earnings-only model is real and confirmed.

**Hedge impact (my own `defi-lp-math` numeric check).** At ETH ≈ $2000: no-swap redeploy makes LP delta swing between **~100% long** (post-down, all WETH) and **~0** (post-up, all USDC), vs a stable **~48%** for swap-to-recenter. A static/periodic perp hedge cannot track that, and the un-fill nuance makes the hedge target **path-dependent and non-final**. At the all-WETH extreme you'd have to short the **full** notional → ~2x the funding/margin of today's half-notional short.

Sources: arxiv.org/abs/2111.09192, arxiv.org/html/2602.19419, arxiv.org/html/2410.09983, developers.uniswap.org range-orders, docs.mav.xyz modes, docs.lfj.gg single-side, snuggle.fi/docs, panoptic.xyz delta-neutral-lp-hedge, rareskills.io uniswap-v3-concentrated-liquidity.

---

## 2. Council Report

**Decision reviewed:** Adopt no-swap single-sided rebalancing for Sasha's hedged WETH/USDC position — (A) self-built technique, or (B) external vault?

### Blind peer review
- **Strongest reasoning:** the Contrarian — the un-fill → *indeterminate hedge target* point is non-obvious, decisive, and evidence-grounded: a hands-off operator cannot size a static hedge against a quantity that is undefined until they act.
- **Biggest blind spot:** the Steelman — its "hedge resized once at redeploy, computable on the spot" hand-waves both the un-fill (delta isn't final until withdrawal) and the operational reality (the hedge is static/manual, pool not in the registry, nobody resizes inside the kill window).
- **What ALL FIVE missed:** the real current baseline is **neither** swap-to-recenter **nor** no-swap — it's **go-flat-on-kill / no rebalancing at all** (DEC-008 removed recentering two days ago). So (A) is not "rebalance more cheaply," it is "start rebalancing again, directionally, after we just decided not to." And nobody quantified **how often the position even goes out of range** (it's a wide ~$1591–$1943 static range) — if that's ~0–2 events/quarter, the entire EV debate is rounding error and the only real output is content.

### Advisor verdicts
| Advisor | Core finding |
|---|---|
| Steelman | Build (A) self-custodied as a smarter close/reopen + resize the hedge once per redeploy; skip the vault; it's also on-brand content. *(Strongest case FOR — but rests on the blind spot above.)* |
| Contrarian | No-swap turns a bounded-delta hedge into an unbounded, path-dependent one; the un-fill makes the correct hedge size indeterminate; upside is single-dollar at this size. Reject B unconditionally; reject A unless a dynamic auto-hedger exists first. |
| First Principles | Real problem = more fee yield on a small neutral hands-off position without work/custody/directional risk. Rebalancing technique isn't the binding constraint (fee-tier/width/funding are). No-swap can't coexist with {static hedge + hands-off}; pick two, and the stack already picked the other two. Real value = content. |
| Outsider | Effort-to-capital ratio is absurd; this is a content/credibility decision in a capital costume. Adopting muddies a clean, auditable "I'm delta-neutral, I harvest fees" thesis and ties the brand to unverifiable vendor numbers. |
| Executor | Cheapest reversible test first: a zero-capital shadow backtest of [no-swap LP delta swing + static short] vs static-hold-on-kill across ranging AND trending paths; gate any code on the result; fix the malformed The Graph key or use the GeckoTerminal fallback. Reject B. |

### Where the council agrees
Reject **(B)** the vault unconditionally (custody reversal + unverified claims + 15% fee + surrenders the hedge — even the Steelman rejects B). The dollar stakes at this size are trivial; the technique fights delta-neutrality; the headline claims are marketing. The genuine value here is **content**, not treasury.

### The sharpest tension
Is there a *narrow, safe* version of (A) worth building behind a backtest gate (Steelman + Executor), or is the technique **categorically** wrong for a delta-neutral, hands-off, no-rebalance farm (Contrarian + First Principles + Outsider)? Tie-breaker: the shadow backtest's net result across regimes **and** the out-of-range event frequency. Given DEC-008 just chose no-rebalance, the burden of proof is on (A) to beat go-flat-on-kill — which the empirical base rate says it usually won't.

### Chairman's recommendation
**(B): NO-GO, unconditional.** **(A): NO-GO as a change to the live position.** It reverses DEC-007/DEC-008, re-introduces directional exposure into a position whose safety *is* its delta-neutrality, and demands a dynamic auto-hedger the stack deliberately doesn't have — all for sub-dollar EV on four-figure capital. **GO (cheap, reversible):** (1) a zero-capital shadow backtest to settle EV and produce receipts; (2) a Sasha content teardown — publicly reasoning about *why a hedged, hands-off farm should NOT chase no-swap rebalancing* — which is the rare move that is both the right financial call and the right brand call. The technique is correct for an *unhedged, actively-managed, mean-reversion* LP — which is not this position.

### One concrete next step (next 48h)
Build the path-based shadow backtest (extend `scripts/lp-sim.js` into a time-series replay) modeling **no-swap-redeploy + static 0.0106 ETH short** vs the current **static-hold/go-flat-on-kill** baseline, on one ranging and one trending WETH/USDC path; score on net result (fees + funding − IL − hedge drift − gas). Zero capital, no Gabriel gate. Prereq: fix the malformed The Graph key (151 chars; real = first 32 hex) or accept the GeckoTerminal OHLCV fallback.

---

## 3. Pre-mortem (Klein) — "It's December 2026 and adopting no-swap rebalancing was a disaster. What happened?"

| # | Failure path | Likelihood × severity | Leading indicator to watch | Cheapest prevention |
|---|---|---|---|---|
| 1 | **Silent de-hedging in a trend.** ETH enters a sustained downtrend; no-swap keeps the position ~100% WETH (falling asset) earning ~0 fees; the static short sized for ~48% now covers half of a ~100% long → **net long into a crash.** The hedge that was "the whole point" quietly stopped being neutral. | High × High | net delta drifting outside the kill band; \|LP delta − short size\| widening | Do NOT auto-redeploy single-sided; keep DEC-008's distance-KILL → go flat, don't re-enter |
| 2 | **Un-fill whipsaw.** Price oscillates across the redeployed range; realized split flips each cross; the static short is wrong on both legs; funding + repeated re-hedge cost bleed a four-figure position. | Medium × Medium | re-hedge frequency spike; collected-fee/cost ratio < 1 | Hard debounce; or simply don't run it |
| 3 | **Autonomy circuit-breaker breach.** An auto-redeploy loop interacts with the `:03/:33 --execute` cron → a redeploy/kill fires without confirmation, or kill+re-enter churns >~3×/48h (trips the autonomy circuit breaker). Contradicts DEC-008's observe-only posture. | Medium × High | kill+re-enter count per 48h; un-gated execute in logs | Keep the per-KILL confirm-gate; never wire auto-redeploy |
| 4 | **Public credibility hit.** Sasha posts adopting the technique and repeats "40-50% less IL" / "most capital-efficient"; the numbers (unsubstantiated) get called out by a DeFi-native CT reply; brand takes the hit. | Medium × High (brand) | n/a (discrete event) | Never repeat vendor claims; if posting, post the skeptical teardown with receipts |
| 5 | **Vault (B) catastrophe.** Snuggle/Maxfi contract exploited or rugged; treasury gone; self-custody premise publicly violated. | Low × Catastrophic | n/a reliable | Never deposit — reject B |
| 6 | **Wasted build / opportunity cost.** A sprint spent wiring `NO_SWAP_REDEPLOY` into `lp-rebalancer.js` (whose Base path is already a stub per DEC-007); it rarely triggers on a wide static range; ~$0 EV; new maintenance surface. | High × Low | out-of-range event count ≈ 0 over a quarter | Backtest + measure event frequency BEFORE building |

**Pre-mortem's core lesson:** the failure that actually hurts is #1 — a rebalancing technique silently re-introducing directional exposure into a position whose safety depends on staying neutral *and* on not rebalancing. The cheapest insurance is to keep the position exactly as DEC-007/DEC-008 set it, run the backtest for proof, and harvest the value as content.

---

## 3a. Backtest results (`scripts/lp-noswap-backtest.js`, run 2026-06-07)

Path-based hourly A/B over 90 days on the live position ($1590.87–$1943.07, entry $1770.62, $40.28, static 0.0106 ETH short, DEC-008 kill floor active). Four strategies — HODL, BASELINE (go-flat-on-kill = current), NOSWAP_STATIC (redeploy, keep static short), NOSWAP_REHEDGE (redeploy + resize short each time) — across RANGING / TREND-DOWN / TREND-UP / CHOP synthetic paths + a REAL ETH 90d return series rescaled onto the range.

**No-swap minus baseline (USD; >0 = no-swap wins that path):**

| Fee APR | RANGING | TREND DOWN | TREND UP | CHOP | REAL ETH | no-swap(rehedge) wins |
|---|---|---|---|---|---|---|
| 30% | −4.62 | −1.07 | −0.90 | +0.51 | +0.74 | 2/5 |
| 60% | −4.61 | −0.89 | −0.64 | +0.51 | +0.74 | (2–3)/5 |
| 150% | −4.56 | −0.36 | +0.15 | +0.51 | +0.74 | 3/5 |
| 300% | −4.49 | +0.51 | +1.47 | +0.52 | +0.74 | 4/5 |

`NOSWAP_STATIC` (keep the static short) **lost to baseline on every path at every fee APR** except one (TREND-UP at 300%). Dead.

**What the backtest establishes (confirms DEC-009, adds nuance):**
1. **It only pays at implausibly high, unverified fee APR.** No-swap(rehedge) needs ~150%+ sustained fee APR to beat baseline in trends, and even at 300% it **still loses −$4.5 in the RANGING path** (rehedge churn realizes hedge losses + perp fees over ~13 cycles). The position's realized APR is *unverified* — DEC-008 saw only $0.26 in ~1 day, and CLAUDE.md rule warns not to trust the 200%+ projection. Betting on no-swap = betting on the exact number the team flagged as unproven.
2. **The magnitude is rounding error.** Best-case edge is +$0.5 to +$1.5 on a $40 position — below noise, gas, and the value of the added maintenance surface.
3. **Cost is dominated by redeploy gas + perp fees, NOT the swap cost no-swap saves.** No-swap fires 13–45 redeploys/quarter on these paths, each costing more than the swap-step MEV/slippage it avoids. The headline benefit is net-negative here.
4. **The de-hedging tail is real but capped by the existing kill.** Max net-delta excursion hit **$21–$36 (54–89% of capital naked)** — but it appears in BASELINE too (it's a static-hedge property), and the DEC-008 kill floor (ETH<$1511 / mark≥$2020) fires before it runs away. So pre-mortem failure #1 is bounded *as long as no-swap is NOT allowed to re-enter past the kill.*
5. **HODL beats every hedged LP strategy in the strong up-trend** (+$9.34 vs −$0.88 baseline) — the known, accepted cost of being market-neutral; not a no-swap issue.

**Limitations (honest):** this is a directional A/B, not a P&L oracle. Fee accrual is modeled as `fee_APR × in-range value × dt` (no per-tick liquidity-share or volume granularity); the perp hedge uses avg-reset accounting; one seed per synthetic path; the real path rescales ETH returns onto a fictional $1770 base. The *signal* (no-swap is EV-neutral-to-negative here, cost-dominated by churn, edge only at unverified high APR) is robust to these; precise dollar values are not. Raw JSON: `/tmp/noswap-backtest.json`. Re-run any regime/APR with `node scripts/lp-noswap-backtest.js --fee-apr N`.

---

## 4. If Gabriel still wants to pursue the technique anyway

The technique is legitimately good **for the position it's designed for**: an *unhedged, actively-managed, mean-reverting* LP where you'd otherwise swap-to-recenter. If Sasha ever runs such a sleeve (separate from the hedged farm), no-swap redeploy is a reasonable execution choice — self-built, never the vault. The gate is unchanged: shadow backtest first, dry-run-by-default, Gabriel confirms any on-chain action, and it stays out of the delta-neutral position.
