# Phase 4 Prep — Morpho Leverage (verified inputs)
**Date:** 2026-05-27 · Read-only verification so tomorrow is execution-only. **No capital moves until the Phase-3 24h gate passes.**

> **Framework in play:** Sprint — the riskiest assumption to falsify first is *"the unlevered hedged carry beats the borrow cost."* If it doesn't, Phase 4 destroys money. Test that with the live Phase-3 24h data before borrowing anything.

---

## 1. Verified Morpho Blue markets on Base (chain 8453)

Morpho Blue contract (Base): `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`

| For | marketId | LLTV | Borrow APY (live) | Oracle | Liquidity |
|---|---|---|---|---|---|
| **cbBTC/USDC** (live position) | `0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836` | **86%** | **4.85%** | `0x663BECd10daE6C4A3Dcd89F1d76c1174199639B9` | $1.38B supplied |
| WETH/USDC (spec reference) | `0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda` | 86% | 4.83% | `0xFEa2D58cEfCb9fcb597723c6bAE66fFE4193aFE4` | $77.5M supplied |

IRM (both): `0x46415998764C29aB2a25CbeA6254146D50D22687`. Collateral cbBTC `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`, loan USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

**For the live position, use the cbBTC/USDC market** (`0x9103…1836`) — deposit cbBTC, borrow USDC.

---

## 2. The go/no-go gate (this is the whole decision)

**Phase 4 is only accretive if the net hedged LP carry APR > the Morpho borrow APR (4.85%).**

- Leverage amplifies the *net* carry on the borrowed slice. Borrowing USDC at 4.85% to earn a hedged carry of X% nets `(X − 4.85)%` on the levered portion.
- From `lp-sim.js`: net hedged carry ≈ fees + AERO + funding − LVR − gas. If that is < 4.85%, **1.5x leverage makes the position worse, not better.**
- **Decision rule for tomorrow:** read the realized Phase-3 24h carry (fees banked − funding − gas, annualized). If it clears ~5% comfortably → proceed 1.5x. If marginal/negative → **do not lever**; fix the carry first (wider range, higher-fee pool, or hold).

---

## 3. Health-factor math (verified against spec §3.5)

```
health_factor = (collateral_value * LLTV) / borrowed_amount
```
- Target LTV **50%** → HF ≈ **1.72** at 86% LLTV ✓ (matches spec)
- Soft alert < 1.35 · hard deleverage < 1.20 · emergency repay-all < 1.05 (already in position-monitor KILL config)
- Liquidation at HF < 1.0; LIF ≈ 1.048 at 86% LLTV.
- **Do NOT call `healthFactor(address)`** — compute from `Morpho.position(marketId,addr)` + `Morpho.market(marketId)` + `IOracle(oracle).price()` (spec §3.5 steps).

---

## 4. Execution sequence (build tomorrow, gated)

1. Deposit cbBTC collateral into Morpho market `0x9103…1836`.
2. Borrow USDC at **50% LTV** (HF 1.72).
3. Combine borrowed USDC + matched cbBTC → add to the Aerodrome LP (increases LP size to ~1.5x).
4. **Hedge auto-scales:** the bigger LP holds more cbBTC → `hedge-executor` (already on the 30-min cron) increases the BTC short to the new delta on its next run. No separate wiring needed. ✓
5. Monitor HF every 5 min alongside delta (position-monitor already has the HF kill switches).

**Cap:** 1.5x max, never loop twice (spec §4 Phase 4). No Tier-3 leverage ever.

---

## 5. Open items before execution (do these first tomorrow)

- [ ] **Confirm the oracle is Chainlink-based** (`0x663BECd1…`) — spec forbids non-Chainlink oracles on Morpho. Read the oracle's feed config.
- [ ] **Build the leverage controller** — no Morpho execution script exists yet (`scripts/lp-leverage.js`: supply collateral, borrow, deleverage on HF breach). position-monitor has the HF *kill switches* but nothing *executes* the borrow/deleverage.
- [ ] **Cross-check HF math against Morpho UI** on a live/staticCall position (spec Phase-4 gate).
- [ ] **Reality check at $45:** Morpho min sizes + gas make a 1.5x loop on a $45 position mostly a *demonstration*. Real leverage EV needs scale. Decide if tomorrow is a proof-of-mechanism (tiny) or deferred until capital scales.

---

*Verified inputs pulled live from blue-api.morpho.org on 2026-05-27. Companion: execution-spec §2.3, §3.5, §4 Phase 4; strategy review 2026-05-27.*
