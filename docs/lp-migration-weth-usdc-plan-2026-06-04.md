# LP Migration Plan — cbBTC/USDC → WETH/USDC ts100 (DRAFT, NOT EXECUTED)

**Status:** PLAN for morning review. Nothing executed, no capital moved. Every number below is a live snapshot from 2026-06-04 night and **MUST be recomputed at execution** (prices move overnight). Scripts to regenerate the live inputs are listed at the bottom.

**Goal (PoC success criteria):** net return annualized **> 15%** AND **> HODL-ETH** over the holding window. Delta-neutral, so this is easy in flat/down/choppy ETH (today's regime) and hard only in a strong ETH rally — expected and acceptable for a delta-neutral PoC.

---

## Target position

| Item | Value (live 2026-06-04, recompute at exec) |
|---|---|
| Pool | WETH/USDC Aerodrome Slipstream ts100 `0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59` |
| token0 / token1 | WETH `0x4200…06` / USDC `0x8335…2913` |
| Spot (ETH) | $1,811.61 on-chain (GeckoTerminal $1,809.64; HL mark $1,813.3) |
| Current fee (dynamic) | 0.0426% on-chain |
| Realized fee APR (30d, Dune-validated) | ~206–246% gross. **Pool-average — our capture depends on in-range uptime + concentration. Measure actual collected fees in the first days before trusting.** |
| Range (±10%) | tick **[-202400, -200300]** ≈ **$1,623 – $2,002** (lower −10.4%, upper +10.5%) |
| Token split at this range | **47.7% WETH / 52.3% USDC** by value (computed from CL math at spot) |
| Fee-capture mode | **UNSTAKED (collect fees).** Do NOT stake in gauge — at ~200%+ fee APR, fees >> emissions. |

### Hedge (leveraged, lean — your spec)

| Item | Value |
|---|---|
| Leg | ETH short on Hyperliquid (szDecimals 4), **ISOLATED margin** |
| Size | = WETH in the LP at entry = 47.7% × C_lp / spot |
| Leverage → liquidation (entry ≈ $1,813, mmr 2%) | 4x → $2,222 (+22.5%) · **4.5x → $2,173 (+19.8%)** · 5x → $2,133 (+17.6%) · 5.78x → $2,085 (+15%) |
| **Recommended: 4.5x** | liq **$2,173**, which is **$171 / +8.5% above the upper band ($2,002)** — room for a fast up-move that then retracts, exactly your ask |
| Funding | **+1.37% annualized, short RECEIVES** (live). Favorable. Kill only if < −54.75% ann for 3×8h. |
| Why isolated | isolated 4.5x fixes the liq at +20% regardless of account reserve. The current +88% liq is from cross/over-funding; isolated is the fix. |

**Static hedge, no rebalancing (your call).** Net delta ≈ 0 only at entry; it drifts as price moves (short-gamma both ways). That is the deliberate trade: avoid rebalance IL/gas at this size, accept the tails, bound the upside tail with the +20% liq.

---

## Capital census (live, recompute at exec)

| Bucket | USD | Disposition |
|---|---|---|
| cbBTC/USDC LP (NFT #71397771) | ~$41.6 | withdraw → USDC + cbBTC |
| Idle LP wallet (`0x21AF…A9A9`) | ~$2.8 | use |
| HL account (after closing BTC short) | ~$26.2 | $4.7 → new ETH margin; rest reserve/idle |
| **Total redeployable** | **~$70.6** | minus gas+swap+slippage ≈ **~$69.5** |

**Capital option (decide in morning):**
- **A — Simple/fast (recommended for first migration):** LP = Base funds ≈ **$44**, ETH hedge isolated 4.5x (margin ≈ **$4.7**), leave ~$21 idle on HL as reserve. Working ≈ $49. Hedge behaves identically to B (isolated liq unaffected by reserve).
- **B — Efficient:** bridge ~$18 HL→Base first, LP ≈ $62, margin ≈ $6.6, ~$1 idle. Working ≈ $69. Adds a bridge step (~30–60 min, few $). Do this as a follow-up after the position is proven, not on the first migration.

**Worked numbers for Option A (C_lp ≈ $44):**
- WETH: 47.7% × $44 = **$21.0 ≈ 0.0116 WETH** (at $1,813)
- USDC: 52.3% × $44 = **$23.0**
- Hedge: short **0.0116 ETH** ($21 notional, > $10 HL min), margin $4.7 at 4.5x, liq $2,173.
- Net delta at entry: LP long 0.0116 WETH − short 0.0116 ETH ≈ **0**. ✓

---

## Execution sequence (your 7 steps, reordered to minimize the unhedged window)

Your steps are right. The one refinement: **keep the BTC hedge on until the cbBTC is swapped away, and open the ETH hedge immediately after.** Your order closes the hedge (step 3) before swapping (step 5), leaving ~$44 of volatile exposure unhedged through the swap+mint. The reorder below shrinks that to a few minutes.

1. **Claim + unstake LP.** `gauge.getReward(71397771)` (claim ~0.45 AERO ≈ $0.17) then `gauge.withdraw(71397771)` on CLGauge `0x9B55…809c` → NFT back to `0x21AF…A9A9`. Gas ~$0.01.
2. **Close LP.** On Slipstream NPM `0x827922686190790b37229fd06084350E74485b72` (verify it is the Slipstream NPM at exec): `decreaseLiquidity(all)` then `collect(max,max)` → receive USDC + cbBTC + fees. amountMin at ~1% tol. Gas ~$0.30. *(BTC hedge still on — cbBTC long + BTC short ≈ neutral.)*
3. **Set range (calc, no tx).** Recompute ticks from live `slot0()`: lower/upper = spot×0.9 / spot×1.1 snapped to ts100. Recompute the 47.7/52.3 split + WETH/USDC target amounts for C_lp.
4. **Swap to target ratio.** Via a Base aggregator (Odos/0x/1inch): cbBTC → WETH (to $21.0) and cbBTC → USDC (top USDC to $23.0). Slippage ~0.1–0.3%, set min-out. Gas ~$0.10–0.30/swap. *(Now holding WETH+USDC; BTC short is now naked — transition moment.)*
5. **Re-hedge (do 5a+5b back-to-back, right after the swap):**
   - 5a. **Close BTC short:** HL market BUY 0.00043 BTC, **reduce_only=true** (IoC limit @ 0). Realizes ~+$3.3.
   - 5b. **Open ETH short:** set ETH leverage **4.5x isolated**, then market SELL **0.0116 ETH** (b=false, r=false, IoC @ 0). Margin ~$4.7, liq ~$2,173.
6. **Open the new LP.** Approve WETH+USDC to the NPM; `mint({token0:WETH, token1:USDC, tickSpacing:100, tickLower:-202400, tickUpper:-200300, amount0Desired, amount1Desired, amount*Min, recipient:0x21AF…, deadline})`. **Do NOT stake.** Dust returned. Gas ~$0.30.
7. **Verify.** LP in range, net delta ≈ 0, hedge liq ~$2,173, funding positive. Update `state/lp-positions.json` + the dashboard. Confirm collected-fee accrual over the next days vs the 200%+ projection.

**Unhedged window:** between step 4 (swap) and step 5b (ETH short), a few minutes on ~$44. At PoC size this is ~cents of price risk; just execute 4→5 tightly. Every capital-moving tx (1, 2, 4, 5a, 5b, 6) is a [NEEDS APPROVAL] gate.

---

## "What if the pool is OOR > 12h on a day like today?"

ETH $1,813, down-week, ±10% range ($1,623–$2,002). Going OOR needs a >10% move; ETH can do that in a volatile week but not most days, so most days = in range, earning the high fee APR. If it does go OOR and stays:

- **OOR-LOW (ETH < $1,623):** LP becomes 100% WETH (bought the whole dip), **fees stop**, the static short under-covers → position is **net LONG** and bleeds if ETH keeps falling. The hedge profit only partly offsets. **This is the dangerous OOR on a down day.**
- **OOR-HIGH (ETH > $2,002):** LP becomes 100% USDC (sold WETH into the rally — captured the conversion), fees stop, the short bleeds toward liq $2,173. If it touches $2,173 the short liquidates (lose ~$4.7 margin) but the LP sits safe in USDC.

**Policy (matches your no-constant-rebalance stance — wide tolerance + hard stop, not micro-rebalancing):**
- In range → do nothing, collect fees ~weekly.
- OOR but within ~5% of a band, < 24h → **WATCH/alert only.** Expect mean-reversion; recentering would crystallize IL (~2.3% at the edge) + cost gas. The 12h mark = alert + evaluate, not act.
- **HARD KILL** (close LP + close hedge, sit in stables, reassess) if any: OOR > 24h, OR price > 5% beyond a band (< $1,540 or > $2,100), OR hedge within 3% of liq ($2,173). This caps the directional bleed without constant churn.

---

## Soundness check + risks

1. **Math verified:** token split 47.7/52.3 (CL formula at live spot); hedge size = entry WETH (delta-neutral at entry); 4.5x → liq $2,173 = +8.5% above band (live HL mmr 2%); IL at band edge ≈ −2.3% vs HODL; funding +1.37% short-receives. ✓
2. **Biggest uncertainty = realized fee capture.** 200%+ is pool-average gross; our concentrated ±10% capture depends on in-range uptime and how concentrated the pool already is. **Validate with actual collected fees in the first 2–3 days** (Revert / `collect` static-call) before trusting the APR. If realized << projected, reassess range width.
3. **Short-gamma tails (inherent, you accepted):** upside bounded by liq (max hedge loss ~$4.7); downside (ETH craters, LP all-WETH net-long) bounded only by the KILL policy. The down-week regime makes the OOR-low tail the one to watch.
4. **Beats HODL-ETH** in flat/down/choppy (today). Underperforms HODL only in a strong rally — expected for delta-neutral.
5. **±10% on volatile ETH with no rebalance will go OOR sometimes.** The bet: in-range fee density (200%+) >> the OOR gaps. If OOR is frequent, widen to ±15% (less fees, less churn) — revisit after observing.
6. **Funding flips:** ETH funding is +1.37% now; if it turns deeply negative we pay to short. Funding kill at −54.75% ann (existing).
7. **Transition risk:** the few-minute unhedged window in step 4→5; the cbBTC→WETH swap slippage (~0.3–0.5% total).

---

## Pre-flight at execution (recompute everything — prices will have moved)

Run these, then refresh every number above:
- `node /tmp/poolread.mjs` — live WETH/USDC pool slot0, tick, fee, ±10% range ticks.
- `node /tmp/hl.mjs` — live ETH mark, funding, leverage→liq table, current hedge state.
- `node scripts/lp-scout.js --validate` — confirm WETH/USDC ts100 fee APR still holds (and is still #1).
- Re-read current LP value/composition (dashboard.json / lp-reconcile) for the exact exit amounts.
- Confirm gas is sane on Base before the tx batch.

**Open decisions for morning:** (a) Capital Option A (simple, ~$44 LP) vs B (bridge for ~$62 LP); (b) leverage 4.5x (liq +20%, more room) vs 5x (liq +18%, leaner) — both inside your "+15–20%" target.
