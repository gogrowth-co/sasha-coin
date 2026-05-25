# Liquidity Miner — Hardened Execution Spec
**Sasha Coin / Base / OpenClaw VPS**
Version: 1.0 | Date: 2026-05-25 | Status: INTERNAL — Not for public distribution

> **Authority rule.** This document governs what gets built. The companion research memo (`liquidity-miner-research-2026-05-25.md`) is the evidence base. Where they conflict, this spec wins. No capital moves until every "Verified Input Required" field in Section 2 is filled with live on-chain data.

---

## Section 1 — Decision

### What we are building

An autonomous liquidity mining agent running inside OpenClaw on the Hostinger VPS. It manages three coordinated layers:

1. **LP Executor** — deposits into Base DEX pools across three risk tiers, manages CL ranges, harvests and converts rewards
2. **Hedge Executor** — opens and adjusts perpetual short positions on Hyperliquid to neutralize the volatile-token delta of the LP
3. **Leverage Controller** — borrows stablecoins against bluechip collateral on Morpho Blue to increase LP exposure, with automated deleverage on health factor breach

### Launch order (non-negotiable)

| Phase | What ships | Gate to enter |
|---|---|---|
| **Phase 0** | Read-only data collector + price simulator. No capital. | Immediate |
| **Phase 1** | Stable/stable LP, micro-capital, manual monitoring | Phase 0 simulation passes all scenarios |
| **Phase 2** | Stable/bluechip LP (WETH/USDC) without leverage or hedge | Phase 1 live 7 days, no alerts triggered |
| **Phase 3** | Add Hyperliquid hedge leg to Phase 2 position | Phase 2 live 14 days, Hyperliquid testnet verified |
| **Phase 4** | Add Morpho leverage loop | Phase 3 live 30 days, stable PnL, health factor math verified |

**No phase may be skipped. No phase gate may be overridden without explicit written approval.**

### Why this order

Phase 1 first: stable/stable pools have near-zero IL. If something breaks, capital loss is minimal. Phase 3 before 4: never add leverage to an unhedged position. Phase 4 last: leverage amplifies all prior errors; earn the right to use it.

---

## Section 2 — Verified Inputs Required

**Nothing gets deployed until every row in this table is filled from an official, on-chain-confirmed source.**

### 2.1 Base LP Contracts

| Field | Pool | Status | Value |
|---|---|---|---|
| Pool contract address | Aerodrome Slipstream USDC/USDT | ❌ UNVERIFIED | Verify at aerodrome.finance |
| Pool contract address | Aerodrome Slipstream USDC/cbBTC (primary) | ❌ UNVERIFIED | Verify at aerodrome.finance |
| Pool contract address | Aerodrome Slipstream WETH/USDC | ❌ UNVERIFIED | Verify at aerodrome.finance |
| Pool contract address | Uniswap v3 WETH/USDC (0.05% fee tier) | ❌ UNVERIFIED | Verify at app.uniswap.org or basescan.org |
| Tick spacing | Aerodrome Slipstream USDC/USDT | ❌ UNVERIFIED | Call `tickSpacing()` on contract |
| Tick spacing | Aerodrome Slipstream USDC/cbBTC | ❌ UNVERIFIED | Call `tickSpacing()` on contract |
| Fee tier | Uniswap v3 WETH/USDC | ❌ UNVERIFIED | Call `fee()` on contract (expect 500 = 0.05%) |
| Gauge address | Aerodrome Slipstream USDC/USDT | ❌ UNVERIFIED | Verify at aerodrome.finance/liquidity |
| Gauge address | Aerodrome Slipstream WETH/USDC | ❌ UNVERIFIED | Verify at aerodrome.finance/liquidity |
| AERO token address | Base | ❌ UNVERIFIED | Cross-check Aerodrome docs + basescan.org |
| cbBTC token address | Base | ❌ UNVERIFIED | Cross-check Coinbase docs + basescan.org |
| NonfungiblePositionManager | Aerodrome Slipstream | ❌ UNVERIFIED | Aerodrome GitHub or basescan |
| NonfungiblePositionManager | Uniswap v3 on Base | ❌ UNVERIFIED | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f6` — **confirm against basescan before use** |

**Quarantined pool — do not trade until verified:**
- Aerodrome Slipstream USDC/cbBTC at 227% APY is flagged as a likely narrow-range outlier. Confirm actual 30-day fee APR (not point-in-time APY), range width, and TVL stability before including in any phase.

### 2.2 Hyperliquid

| Field | Status | Value |
|---|---|---|
| ETH-USD perp market exists on Hyperliquid | ❌ UNVERIFIED | Query `POST https://api.hyperliquid.xyz/info` body `{"type":"metaAndAssetCtxs"}`, confirm ETH is listed |
| Current ETH funding rate | ❌ UNVERIFIED | Same query above, read `fundingRate` field from assetCtx |
| Testnet order placement (market order) verified | ❌ UNVERIFIED | Use `https://api.hyperliquid-testnet.xyz`, place min-size order, confirm fill |
| Testnet reduce-only order verified | ❌ UNVERIFIED | Place reduce-only order, confirm it behaves correctly |
| Testnet cancel order verified | ❌ UNVERIFIED | Cancel open order, confirm removal |
| cbBTC-USD perp exists (for Tier 3 hedge) | ❌ UNVERIFIED | Same metaAndAssetCtxs query |
| Minimum order size for ETH-USD | ❌ UNVERIFIED | Read from metaAndAssetCtxs `szDecimals` |
| Bridge USDC from Base to Hyperliquid tested | ❌ UNVERIFIED | Use official Hyperliquid bridge on testnet |

### 2.3 Morpho Blue on Base

| Field | Status | Value |
|---|---|---|
| Morpho Blue contract address on Base | ❌ UNVERIFIED | https://docs.morpho.org — do not use any other source |
| WETH/USDC market ID | ❌ UNVERIFIED | Query Morpho API or subgraph for marketId where loanToken=USDC, collateralToken=WETH |
| LLTV for WETH/USDC market | ❌ UNVERIFIED | Read `market.lltv` from contract — typical 86%, confirm live |
| Current WETH/USDC borrow APY | ❌ UNVERIFIED | Query Morpho API — do not use DefiLlama estimate for execution sizing |
| Oracle address for WETH/USDC market | ❌ UNVERIFIED | Read `market.oracle`, confirm it is Chainlink WETH/USD on Base |
| cbBTC/USDC market ID | ❌ UNVERIFIED | Same process as WETH/USDC |

---

## Section 3 — Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   OpenClaw VPS Agent                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Data         │  │ Risk Engine  │  │ Accounting   │  │
│  │ Collector    │  │              │  │ Ledger       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────▼───────┐  ┌──────▼───────┐          │          │
│  │ LP           │  │ Hedge        │          │          │
│  │ Executor     │  │ Executor     │          │          │
│  └──────┬───────┘  └──────┬───────┘          │          │
│         │                 │                  │          │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
   ┌──────▼──────┐   ┌──────▼──────┐           │
   │  Base L2    │   │ Hyperliquid │           │
   │  (LP pools) │   │  (perps)    │           │
   └─────────────┘   └─────────────┘           │
                                               │
                                    ┌──────────▼──────────┐
                                    │  Morpho Blue / Base  │
                                    │  (leverage, Phase 4) │
                                    └─────────────────────┘
```

### 3.2 Component Specs

#### Data Collector (Phase 0, always running)

Queries on a configurable interval (default: 5 minutes). No write operations. Outputs to a local state file for the Risk Engine.

Reads:
- Base RPC: LP position state via `NonfungiblePositionManager.positions(tokenId)`
- Base RPC: current pool tick via `IUniswapV3Pool.slot0()`
- DefiLlama Yields API: current APY/TVL for monitored pools (discovery, not execution)
- DefiLlama Coins API: token prices for PnL marking
- Hyperliquid REST API (`metaAndAssetCtxs`): ETH/BTC funding rates
- Morpho API (Phase 4): market state, borrow rates, oracle prices

Does NOT read: `healthFactor(address)` — this is a helper function abstraction, not how Morpho works. See Section 3.5.

#### LP Executor

Handles position lifecycle: open, rebalance range, close, harvest rewards.

**Wallet:** Sasha's Base EOA (`0xba3BB32`). This is the execution wallet for all Base transactions.

**Range policy:**
- Tier 1 (stable/stable): full-range or very wide range (stable pairs have near-zero IL at any range)
- Tier 2 (stable/bluechip): initial range ±30% from current price (wider = fewer rebalances, less gas, lower peak APY)
- Tier 3 (altcoin/bluechip): initial range ±20% from current price (narrower = higher fee capture, more rebalance events)

**Reward harvest policy:** Harvest AERO rewards when accrued value exceeds $10 (gas break-even). On harvest: swap 100% of AERO to USDC via Aerodrome router. Never hold AERO as an investment position unless a separate thesis is active. Record harvest amount and AERO price in Accounting Ledger.

**Rebalance trigger:** When current pool tick exits the LP position's tick range. Rebalance = burn current position, swap to target ratio, mint new position centered at current price. Log gas cost to Accounting Ledger.

#### Hedge Executor (Phase 3+)

Manages the Hyperliquid short position that neutralizes the volatile-token delta of the LP.

**Wallet:** A separate Hyperliquid API wallet (not the Base EOA). Fund with USDC bridged from Sasha's Base EOA via the official Hyperliquid bridge.

**Delta computation — see Section 3.4 for exact math.**

**Adjustment trigger:** When computed delta deviates by more than 0.05 from target delta, send an order to Hyperliquid to bring the short position back to target.

**Funding rate kill switch:** If Hyperliquid funding rate for the hedged asset is below -0.05%/8h for three consecutive 8-hour periods (annualized: worse than -54.75%), close the hedge leg. Naked LP is preferable to paying more in funding than is earned in fees.

#### Risk Engine

Runs after every Data Collector cycle. Evaluates all kill switch conditions (Section 5). If any breach: logs to alert file, sends Telegram notification to Gabriel, pauses all executor actions. No autonomous capital movement after a kill switch fires — requires manual reset.

#### Accounting Ledger

Append-only log in `/docker/openclaw-h3mk/data/.openclaw/state/liquidity-miner-ledger.jsonl`. One entry per event.

Each entry records:
- `timestamp`
- `event_type`: one of `lp_open`, `lp_rebalance`, `lp_close`, `reward_harvest`, `hedge_open`, `hedge_adjust`, `hedge_close`, `leverage_open`, `leverage_adjust`, `leverage_close`, `kill_switch`
- `position_id`
- `fees_earned_usd` (for LP events, cumulative since last record)
- `reward_token_amount` (AERO harvested)
- `reward_token_price_usd` (at time of harvest)
- `il_estimate_usd` (see Section 3.6)
- `funding_paid_usd` (for hedge events)
- `gas_usd`
- `slippage_usd`
- `net_pnl_usd` (fees + rewards - IL - funding - gas - slippage)
- `hedge_basis_usd` (short entry price vs current price, for basis tracking)

### 3.3 Wallet and Key Policy

| Wallet | Purpose | Cap | Key storage |
|---|---|---|---|
| Base EOA (`0xba3BB32`) | All Base LP transactions, reward harvests | $50k total exposure in Phase 1-2; raise only after Phase 4 proven | VPS `.env`, never git |
| Hyperliquid API wallet | Hedge perp positions only | $10k margin cap in Phase 3; raise only after 30 days stable | VPS `.env`, separate from Base key |
| Read-only RPC key | Data Collector queries | N/A — no signing | VPS `.env` |

**Emergency revoke path:** Aerodrome and Uniswap v3 positions are NFTs held by the EOA. There is no approval to revoke. To exit: call `burn()` on the position manager. Add this as a kill switch action (Section 5.4).

**Approval hygiene:** When deploying LP via a manager contract (e.g., Gamma vault), only approve the exact contract, not a router. Re-check approvals before each new protocol integration.

### 3.4 CL Position Delta Math (Uniswap v3 / Aerodrome Slipstream)

Source: Uniswap v3 core contract `SqrtPriceMath.sol`. These are exact formulas used in production.

All square root prices are in Q96 fixed-point (multiply by 2^96 before integer arithmetic).

Let:
- `sqrtP` = `slot0.sqrtPriceX96` (current pool price)
- `sqrtA` = `sqrt(P_lower) * 2^96` (lower tick)
- `sqrtB` = `sqrt(P_upper) * 2^96` (upper tick)
- `L` = liquidity (from `positions(tokenId).liquidity`)

**Token amounts from position state:**

```
Case 1: sqrtP <= sqrtA  (price below range — position is 100% token0)
  amount0 = L * (sqrtB - sqrtA) / (sqrtA * sqrtB / 2^96)
  amount1 = 0

Case 2: sqrtA < sqrtP < sqrtB  (price in range)
  amount0 = L * (sqrtB - sqrtP) / (sqrtP * sqrtB / 2^96)
  amount1 = L * (sqrtP - sqrtA) / 2^96

Case 3: sqrtP >= sqrtB  (price above range — position is 100% token1)
  amount0 = 0
  amount1 = L * (sqrtB - sqrtA) / 2^96
```

**Delta (volatile-token exposure) for the hedge:**

```
delta_tokens = amount0   ← exact ETH (or volatile token) units held by the LP position right now
delta_usd    = amount0 * P_current
hedge_size   = delta_tokens   ← short exactly this many units on Hyperliquid
```

**Why not the simplified "0.5 * LP value / price" formula:**

The simplified formula is only correct at the exact center of the range. It overstates delta when price is near the upper bound (position is mostly stablecoin) and understates delta when price is near the lower bound (position is mostly volatile token). Using it for hedge sizing introduces basis error that grows as price moves. Always compute `amount0` from live `slot0` + `positions()` state.

**Rebalance trigger:**

```
delta_drift = |current_amount0 - hedge_short_size| / hedge_short_size
if delta_drift > 0.05: trigger hedge adjustment
```

### 3.5 Morpho Health Factor Math (Phase 4 only)

Source: https://docs.morpho.org/learn/concepts/liquidation/

```
collateral_value = collateral_amount * oracle_price / oracle_price_scale
  where oracle_price_scale = 10^36

health_factor = (collateral_value * LLTV) / borrowed_amount
```

Liquidation is triggered when `health_factor < 1.0` (i.e., when `LTV > LLTV`).

**Do NOT call a `healthFactor(address)` function** — Morpho Blue does not expose a single health factor function at the top-level contract. To compute health factor programmatically:

1. Call `Morpho.position(marketId, address)` → returns `collateralShares`, `borrowShares`, `supplyShares`
2. Call `Morpho.market(marketId)` → returns `totalBorrowAssets`, `totalBorrowShares`, `totalSupplyAssets`, `totalSupplyShares`, `lastUpdate`, `fee`
3. Compute `borrowed_amount = borrowShares * totalBorrowAssets / totalBorrowShares` (shares to assets)
4. Get `oracle_price` from `IOracle(market.oracle).price()`
5. Apply formula above

**LIF (Liquidation Incentive Factor):**
```
LIF = min(1.15, 1 / (0.3 * LLTV + 0.7))
```
For LLTV = 0.86 (86%): LIF ≈ 1.048 (4.8% liquidation bonus to liquidator). Protocol takes zero fee.

**Sasha's hard limits:**
- Target LTV: 50% (health factor ≈ 1.72 at 86% LLTV)
- Soft alert threshold: health factor < 1.35
- Hard deleverage trigger: health factor < 1.20
- Emergency exit (auto-repay all debt): health factor < 1.05

### 3.6 IL Estimation

For accounting purposes only (not a hedge trigger).

For a standard AMM (v1) LP with entry price `P0` and current price `P1`:
```
IL% = 2 * sqrt(P1/P0) / (1 + P1/P0) - 1
```

For a CL position the IL is bounded to the range and requires computing `amount0` and `amount1` at both `P0` and `P1` using Section 3.4 formulas, then comparing portfolio value to a hold strategy.

Log as `il_estimate_usd` in the Accounting Ledger at each rebalance event. This is an estimate only — realized IL is fully captured in the difference between deposit value and withdrawal value.

### 3.7 Hyperliquid Funding Math

Source: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding

```
funding_rate = avg_premium_index + clamp(0.0001 - premium_index, -0.0005, 0.0005)
  where premium_index = (impact_bid_px - oracle_px) or (oracle_px - impact_ask_px)

payment per hour = position_size * oracle_price * (funding_rate / 8)
  (rate is for 8 hours, paid every hour at 1/8th)

cap: 4% per hour maximum
```

When funding_rate > 0: longs pay shorts. Our short receives funding.
When funding_rate < 0: shorts pay longs. Our short pays funding.

**Kill switch:** if `funding_rate / 8` (hourly rate) < -0.00625% (= -54.75% annualized) for 3 consecutive hours, close hedge.

---

## Section 4 — Execution Phases

### Phase 0 — Read-Only Simulator (start immediately)

**Goal:** Prove the data pipeline works before any capital moves.

**Deliverables:**
- [ ] Data Collector reads Base RPC successfully: can call `slot0()` and `positions()` on Aerodrome Slipstream and Uniswap v3 pools
- [ ] Data Collector reads DefiLlama Yields API and returns current APY for target pools
- [ ] Data Collector reads Hyperliquid `metaAndAssetCtxs` and returns ETH funding rate
- [ ] Simulator runs five price scenarios: ETH -50%, ETH -25%, ETH +25%, ETH +100%, LP out of range
  - For each: outputs expected `amount0`, `amount1`, `delta`, required hedge size, estimated IL, estimated fee income vs IL
- [ ] All five scenarios show positive net PnL at current fee APY with hedge active
- [ ] All five scenarios show acceptable loss at current fee APY without hedge (acceptable = fee income > IL)

**Exit gate:** All deliverables checked. No capital moves until this is complete.

---

### Phase 1 — Stable/Stable Micro Position

**Capital:** $500 USDC maximum. This is fire-and-forget learning capital.

**Target pool:** Aerodrome Slipstream USDC/USDT on Base.

**No hedge required** — stable/stable pairs have near-zero delta. No leverage.

**Pre-flight checklist before first deposit:**
- [ ] Pool contract address verified from aerodrome.finance UI + basescan.org
- [ ] Gauge address verified and AERO rewards are active (gauge weight > 0)
- [ ] Tick spacing confirmed from contract call
- [ ] Test transaction: approve USDC/USDT for NonfungiblePositionManager, then simulate `mint()` with `staticCall` — check output makes sense
- [ ] Alerting is live: Telegram notification fires on kill switch trigger

**Monitoring:**
- Daily: read position state, check if in range, log to Accounting Ledger
- Weekly: harvest rewards (if > $10 value), swap AERO to USDC, log
- Weekly: compare actual fee income to DefiLlama APY estimate

**Duration before Phase 2 gate:** 7 days minimum

**Phase 2 gate check:**
- [ ] No kill switches triggered in 7 days
- [ ] Actual fee income within 50% of DefiLlama estimate (validates data pipeline)
- [ ] Accounting Ledger has 7 clean daily entries
- [ ] Gas costs documented and within acceptable range

---

### Phase 2 — Stable/Bluechip LP Without Hedge

**Capital:** $2,000–$5,000. Up to Gabriel.

**Target pools (in priority order — use live verified APY, not this doc):**
1. Aerodrome Slipstream WETH/USDC — primary (high fee + AERO rewards)
2. Uniswap v3 WETH/USDC 0.05% — secondary (deepest liquidity, fee-only, lower IL from wider pools)
3. Aerodrome Slipstream USDC/cbBTC — conditional on 227% APY being verified as stable (see quarantine note)

**No hedge. No leverage.**

**Range setting:** ±30% from current price at time of deposit. This means:
- If ETH = $3,000: lower tick at $2,100, upper tick at $3,900
- Rebalance if price moves outside this range

**Pre-flight checklist:**
- [ ] All Verified Inputs from Section 2.1 filled for target pool
- [ ] Phase 1 gate passed
- [ ] Manual simulation of position size, expected tokens in, expected fee income at current APY

**Duration before Phase 3 gate:** 14 days minimum

**Phase 3 gate check:**
- [ ] No kill switches triggered in 14 days
- [ ] Net PnL positive after gas and IL estimate
- [ ] Hyperliquid testnet verification complete (Section 2.2 checklist done)
- [ ] Delta computation cross-validated: compute `amount0` from Section 3.4 formula, compare to Uniswap SDK output — must match within 0.1%

---

### Phase 3 — Add Hyperliquid Hedge

**No new capital required.** Hedge is funded from existing USDC reserves (bridge to Hyperliquid).

**Hedge margin:** 20% of LP notional value. Example: $5,000 LP → $1,000 USDC margin on Hyperliquid. At typical ETH volatility, this provides sufficient margin buffer for the hedge size without requiring high leverage on the perp.

**Activation sequence:**
1. Compute current `amount0` (ETH in LP) using Section 3.4 formulas
2. Bridge required USDC margin to Hyperliquid via official bridge
3. Open short position: `hedge_size = amount0`, market order (or limit with 0.1% slippage tolerance)
4. Log to Accounting Ledger: `hedge_open`, entry price, size, margin
5. Start automated delta monitoring loop (every 5 minutes via VPS cron)

**Rebalance logic:**
```
every 5 minutes:
  read slot0, read positions(tokenId)
  compute amount0 using Section 3.4
  read current Hyperliquid short size
  drift = |amount0 - short_size| / short_size
  if drift > 0.05:
    adjustment = amount0 - short_size  (positive = increase short, negative = decrease short)
    place reduce-only order if adjustment < 0
    place market order if adjustment > 0
    log to Accounting Ledger
  check funding rate kill switch
```

**Duration before Phase 4 gate:** 30 days minimum

**Phase 4 gate check:**
- [ ] No kill switches triggered in 30 days
- [ ] Hedge basis stable (short entry price vs current ETH price tracked daily — no runaway basis)
- [ ] Funding rate cost documented and below 15% annualized on average
- [ ] Morpho LTV/LLTV math verified against live market parameters (Section 2.3 complete)
- [ ] Morpho health factor computation verified: run the Section 3.5 formula against a real Morpho position or use `staticCall` simulation, compare to Morpho UI health factor display

---

### Phase 4 — Morpho Leverage Loop

**Target:** 1.5x effective LP exposure on Phase 2/3 position.

**Collateral approach:** Direct WETH collateral (not LP NFT — ERC-721 NFTs are not Morpho collateral by default).

**Sequence:**
1. Deposit WETH into Morpho Blue (WETH/USDC market on Base)
2. Borrow USDC at 50% LTV (gives health factor ≈ 1.72 at 86% LLTV)
3. Combine borrowed USDC with matched WETH from reserves
4. Deposit combined capital into LP position
5. Monitor health factor every 5 minutes alongside delta monitoring

**Cap:** 1.5x leverage maximum. Never loop more than once. If a 1.5x loop is working and Gabriel approves extending to 2x, that requires a separate written decision — not an autonomous agent action.

**No Tier 3 leverage ever.** Altcoin/bluechip LP positions may not be leveraged in v1 or v2 of this system.

---

## Section 5 — Risk Limits and Kill Switches

### 5.1 Hard Stop Thresholds

If any threshold is breached, the Risk Engine fires the kill switch immediately. All executor actions pause. Telegram alert sent. Manual reset required.

| Kill Switch | Threshold | Action |
|---|---|---|
| **Daily loss limit** | Net PnL < -$200/day (Phase 1), -$500/day (Phase 2+) | Pause all executors |
| **Max slippage** | Any single transaction slippage > 1% | Cancel pending, log, alert |
| **Funding cost ceiling** | Hyperliquid hourly rate < -0.00625% for 3 consecutive hours | Close hedge, log, alert |
| **Oracle staleness** | Morpho oracle last update > 1 hour ago | Pause leverage controller, alert |
| **Failed hedge adjustment** | Hyperliquid order fails or partial fill after 3 retries | Pause hedge executor, alert |
| **RPC outage** | Base RPC unresponsive for > 15 minutes | Pause all executors |
| **Hyperliquid API outage** | API returns error for > 15 minutes | Pause hedge executor (LP continues) |
| **LP out of range > 4 hours** | Position out of range and no rebalance triggered | Alert (not auto-rebalance — requires gas decision) |
| **Morpho health factor** | < 1.20 | Trigger deleverage: repay 25% of debt |
| **Morpho health factor** | < 1.05 | Emergency: repay all debt |
| **Pool TVL drop** | Target pool TVL drops > 50% in 24h | Alert, pause deposits |
| **AERO gauge weight drop** | > 30% week-over-week | Alert, plan migration |

### 5.2 Position Size Caps

| Parameter | Cap |
|---|---|
| Phase 1 total capital | $500 |
| Phase 2 total capital | $5,000 |
| Phase 3 total capital (LP + hedge margin) | $7,000 |
| Phase 4 total capital (including borrowed) | $15,000 effective exposure |
| Maximum capital in any single pool | $5,000 |
| Maximum capital in any single protocol | $10,000 |
| Tier 3 positions | $0 in v1 |
| Leveraged positions | $0 until Phase 4 gate passed |

### 5.3 Forbidden Actions (hard-coded, no override)

- Deploy capital to any pool not in the verified inputs table (Section 2)
- Approve unlimited token allowances
- Deploy Tier 3 or leveraged positions without explicit phase gates
- Use any oracle other than Chainlink on Morpho Blue
- Hold AERO as a separate investment position (rewards are always swapped to USDC on harvest)
- Rebalance a hedge position if the LP position itself is out of range (hedge size would be wrong)

### 5.4 Emergency Exit Sequence

If Gabriel sends "EMERGENCY EXIT" via Telegram:

1. Close Morpho debt: repay all borrowed USDC, withdraw WETH collateral
2. Close Hyperliquid hedge: market sell to close short
3. Close all LP positions: burn all position NFTs, receive underlying tokens
4. Convert all received tokens to USDC via swap
5. Log final state to Accounting Ledger

Estimated execution time: 5-15 minutes depending on gas and Hyperliquid order fills.

---

## Section 6 — Test Plan

### 6.1 Static Verification (before Phase 0)

For every protocol claim in this document and in the research memo:
- [ ] Has a live on-chain source (contract call) OR
- [ ] Has an official docs source (URL cited) OR
- [ ] Is marked as UNVERIFIED

Anything not meeting one of these criteria must be removed or quarantined before Phase 0 begins.

### 6.2 Simulation (Phase 0)

Run the following price scenarios through the full position math (Section 3.4):

| Scenario | ETH move | Expected behavior |
|---|---|---|
| S1 | -50% | Position mostly ETH, hedge large, IL ~13.4%, fees must exceed IL over time |
| S2 | -25% | Partial ETH increase, moderate IL ~1.5%, hedge adjusts |
| S3 | +25% | Price near upper range, position mostly USDC, delta ≈ 0, hedge shrinks |
| S4 | +100% | Out of range above, position 100% USDC, delta = 0, hedge closes |
| S5 | Out of range below | Position 100% ETH, delta = 1 × LP notional, hedge = full LP value / price |
| S6 | Funding spike | Rate hits -0.05%/8h for 3 periods — kill switch fires, hedge closes |
| S7 | Failed hedge adjust | Hyperliquid rejects order — kill switch pauses hedge executor, LP continues |

Pass criteria: system correctly computes `amount0` in all scenarios, hedge sizes match, kill switches fire when expected.

### 6.3 Fork / Read-Only Tests (before Phase 1)

- [ ] Call `slot0()` on Aerodrome Slipstream USDC/USDT from Base RPC — returns `sqrtPriceX96`, `tick`
- [ ] Compute `amount0` and `amount1` from Section 3.4 formula
- [ ] Cross-validate against Uniswap v3 SDK `Position.amount0` / `Position.amount1` — match within 0.1%
- [ ] Call Hyperliquid `metaAndAssetCtxs` — returns ETH funding rate in expected format
- [ ] Call Morpho `market(marketId)` — returns expected fields for WETH/USDC market

### 6.4 Integration Dry Run (before Phase 1)

Full read-only pipeline end-to-end:
- [ ] Data Collector fetches Base pool state, Hyperliquid funding, Morpho market state
- [ ] Risk Engine reads output and produces a health report
- [ ] Accounting Ledger writes a synthetic dry-run entry
- [ ] Telegram alert fires on a simulated kill switch

### 6.5 Micro-Capital Launch (Phase 1)

- Maximum $500
- All alerting enabled
- Daily PnL report generated automatically
- Manual approval required before Phase 2 (no automatic promotion)
- 7-day minimum hold period

---

## Section 7 — Appendix

### A. Original Research Pool Data (2026-05-25, DefiLlama live pull)

**Tier 1 — Stable/Stable on Base (TVL > $500k)**

| Pool | Protocol | TVL | APY | Fee APR | Reward |
|---|---|---|---|---|---|
| USDC/USDT | Aerodrome Slipstream | $1.06M | 24.6% | 19.4% | 5.3% |
| EURC/USDC | Aerodrome Slipstream | $2.16M | 32.5% | 29.1% | 3.4% |
| EURC/USDC | Aerodrome Slipstream | $2.01M | 84.0% | 0.0% | 84.0% |
| USDC/USDT | Uniswap v4 | $0.73M | 0.9% | 0.9% | 0% |

Note on EURC/USDC: 29.1% fee APR is real (EUR/USD arb flow), but introduces EUR/USD FX exposure. Include only if thesis is explicit.

**Tier 2 — Stable/Bluechip on Base (TVL > $1M)**

| Pool | Protocol | TVL | APY | Fee APR | Reward | Notes |
|---|---|---|---|---|---|---|
| USDC/cbBTC | Aerodrome Slipstream | $4.2M | 223% | 216.3% | 6.7% | QUARANTINED — verify range |
| USDC/cbBTC | Aerodrome Slipstream | $11.7M | 65.8% | 55.1% | 10.7% | Strong fee base |
| WETH/USDC | Aerodrome Slipstream | $14.7M | 70.0% | 37.0% | 32.9% | AERO sellable |
| WETH/USDC | Uniswap v3 | $128.8M | 41.3% | 41.3% | 0% | Deepest, cleanest |
| WETH/USDC | PancakeSwap v3 | $5.7M | 30.4% | 30.4% | 0% | Overlooked, solid |
| ETH/USDC | Uniswap v4 | $5.15M | 29.9% | 29.9% | 0% | Pure fee |
| USDC/cbBTC | Uniswap v3 | $9.66M | 17.4% | 17.4% | 0% | Fee-only BTC |

**Tier 3 — Altcoin/Bluechip on Base (fee APR > 10%, TVL > $300k)**

| Pool | Protocol | TVL | APY | Fee APR | Reward | Notes |
|---|---|---|---|---|---|---|
| VIRTUAL/WETH | Aerodrome Slipstream | $0.7M | 199% | 94.4% | 104.6% | Real AI token volume |
| AERO/cbBTC | Aerodrome Slipstream | $1.0M | 172.6% | 81.5% | 91.2% | BTC + AERO exposure |
| USDC/AERO | Aerodrome Slipstream | $1.3M | 133.9% | 26.9% | 107.0% | Auto-sell AERO |
| WETH/BRETT | Aerodrome Slipstream | $0.9M | 135.7% | 5.2% | 130.5% | 96% emissions — risky |

High APY outliers (do not trade — pure micro-cap emissions):
- USDC/PROS: 24,907% (100% reward, $0.9M TVL)
- USDC/NOCK: 7,553% (100% reward)

**Excluded from Tier 3 consideration in v1:** Any pool where fee APR < 10% of total APY.

### B. Official Documentation Sources

| Protocol | Topic | URL | Accessed |
|---|---|---|---|
| Uniswap v3 | Concentrated liquidity concepts | https://developers.uniswap.org/concepts/protocol/concentrated-liquidity | 2026-05-25 |
| Uniswap v3 | Position data / SqrtPriceMath | https://developers.uniswap.org/sdk/v3/guides/liquidity/position-data | 2026-05-25 |
| Morpho | Liquidation / LTV / LLTV | https://docs.morpho.org/learn/concepts/liquidation/ | 2026-05-25 |
| Hyperliquid | Funding rate formula | https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding | 2026-05-25 |
| Hyperliquid | REST API reference | https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api | 2026-05-25 |
| DefiLlama | Yields API | https://yields.llama.fi/pools | 2026-05-25 |

### C. Data Gaps and Open Questions

The following items are NOT resolved in this spec. They must be resolved before the phase that depends on them.

1. **Aerodrome Slipstream USDC/cbBTC 216% fee APR** — is this a stable signal or a narrow-range point-in-time APY spike? Required: pull 30-day historical APY from DefiLlama chart endpoint before including in Phase 2.

2. **Gamma Finance Base vault list** — JavaScript-rendered app, no scrape possible in research session. Required for Phase 2 decision: does Gamma manage the Aerodrome Slipstream WETH/USDC pool on Base? If yes, depositing into Gamma simplifies range management.

3. **Arrakis v2 on Base** — deployment status unconfirmed. Required only if ERC-4626 LP shares are needed for Morpho collateral in Phase 4.

4. **Live Hyperliquid ETH funding rate** — not pulled in research session. Required before Phase 3 hedge sizing. Pull from `metaAndAssetCtxs` immediately before Phase 3 activation.

5. **Morpho WETH/USDC LLTV on Base** — stated as ~86% from docs examples but must be confirmed from live `market.lltv` before any leverage calculation.

6. **Extra Finance audit status** — Extra Finance offers integrated leveraged LP on Base. Audit history unknown. Do not use until a completed audit by a recognized firm is confirmed.

### D. Narrative and Content Arc (internal only)

Sasha can document her liquidity mining publicly as it progresses. Suggested arc:

- Phase 1 live: "I put $500 into a stable pool and I'm watching the fees accumulate in real time."
- Phase 2 live: "Here's what 41% fee APY actually looks like on a $3k position after 14 days. Gas included."
- Phase 3 live: "I hedged the ETH leg. Here's the delta math I used and what the first week of funding costs looked like."
- Phase 4 live: "1.5x leveraged LP. Here's the health factor I'm monitoring and why I'd deleverage at 1.2."

Each phase is a differentiated content arc. The architecture becomes the content.

---

*Spec version 1.0 — 2026-05-25. Next review: when Phase 1 is live or when any Verified Input field is resolved. All capital decisions require human approval.*
