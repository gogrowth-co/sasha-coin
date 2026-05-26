---
name: defi-lp-math
description: Expert reference for concentrated liquidity (CL) position mathematics - sqrtPriceX96 encoding, tick math, 3-case amount formulas, IL computation, delta-neutral hedge sizing, and pool scoring. Use whenever computing LP position values, hedge sizes, or pool APRs across Uniswap v3, Aerodrome, Orca Whirlpools, and Raydium CLMM.
---

# DeFi LP Math -- Expert Reference
*Last verified: 2026-05-25 | Applies to: Uniswap v3, Aerodrome Slipstream, Orca Whirlpools, Raydium CLMM*

---

## 1. Core Invariant

All CLMM protocols (Uniswap v3, Orca, Aerodrome, Raydium CLMM) share the same mathematical foundation:

```
x * y = k  (constant product, extended to a price range)
```

Within a tick range [tickLower, tickUpper], liquidity L is constant. The invariant becomes:

```
(x + L / sqrtPriceUpper) * (y + L * sqrtPriceLower) = L^2
```

Where:
- x = amount of token0 (e.g., ETH)
- y = amount of token1 (e.g., USDC)
- L = liquidity (a synthetic unit, NOT a dollar amount)
- sqrtPrice = sqrt of the current price (token1/token0), encoded as Q64.96 fixed-point

---

## 2. sqrtPriceX96 Encoding

Solidity uses Q64.96 fixed-point: the sqrt price is multiplied by 2^96.

```
sqrtPriceX96 = sqrt(price) * 2^96
```

Where `price = token1_amount / token0_amount` (in raw/atomic units).

### Decoding sqrtPriceX96 -> human price

```js
// EVM (BigInt)
function sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1) {
  const Q96 = 2n ** 96n
  // raw price = (sqrtPriceX96 / 2^96)^2
  const rawPrice = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96)
  // adjust for decimals: token1/token0 in human units
  return rawPrice * (10 ** decimals0) / (10 ** decimals1)
}

// Example: WETH/USDC pool on Base
// sqrtPriceX96 = 1580000000000000000000000000000n (approx $3500 ETH)
// decimals0 = 18 (WETH), decimals1 = 6 (USDC)
// price ~ 3500 USDC per WETH
```

### Encoding price -> sqrtPriceX96

```js
function priceToSqrtPriceX96(price, decimals0, decimals1) {
  // price is human price: token1 per token0 (e.g., 3500 USDC per ETH)
  const adjusted = price * (10 ** decimals1) / (10 ** decimals0)
  return BigInt(Math.floor(Math.sqrt(adjusted) * 2**96))
}
```

### Solana (BN integers, 9/6 decimals)

```js
// Solana uses the same Q64.96 but with BN (Big Number library)
import BN from 'bn.js'
const Q96 = new BN(2).pow(new BN(96))

// sqrtPrice on Solana is often stored as BN directly
// Convert to number for math:
const sqrtPriceFloat = sqrtPriceBN.toNumber() / Q96.toNumber()
const price = sqrtPriceFloat * sqrtPriceFloat
// Adjust for decimals: SOL=9, USDC=6 -> multiply by 10^(9-6) = 1000
const humanPrice = price * 1000  // SOL/USDC in human units
```

---

## 3. Tick Math

Ticks are integers that represent price levels. Each tick corresponds to a 0.01% (1 basis point) price change.

```
price(tick) = 1.0001^tick
```

### Tick -> Price

```js
function tickToPrice(tick) {
  return Math.pow(1.0001, tick)
}

// Token1/Token0 in RAW units (before decimal adjustment)
// For human price: multiply by 10^(decimals0) / 10^(decimals1)
```

### Price -> Tick

```js
function priceToTick(price) {
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

// For human price -> raw price first:
function humanPriceToTick(humanPrice, decimals0, decimals1) {
  const rawPrice = humanPrice * (10 ** decimals1) / (10 ** decimals0)
  return Math.floor(Math.log(rawPrice) / Math.log(1.0001))
}
```

### Snapping to Tick Spacing

Positions must open/close on multiples of tickSpacing:

```js
function nearestUsableTick(tick, tickSpacing) {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing
  // Ensure within [-887272, 887272] (Uniswap v3 bounds)
  return Math.max(-887272, Math.min(887272, rounded))
}
```

### Tick Spacing by Protocol/Fee Tier

```
Uniswap v3 / Aerodrome (Base):
  0.01% fee -> tickSpacing: 1
  0.05% fee -> tickSpacing: 10
  0.30% fee -> tickSpacing: 60
  1.00% fee -> tickSpacing: 200

Orca Whirlpools (Solana):
  0.01% fee -> tickSpacing: 1
  0.05% fee -> tickSpacing: 8
  0.30% fee -> tickSpacing: 64
  1.00% fee -> tickSpacing: 128
```

---

## 4. Amount Formulas (3-Case)

Given liquidity L, current sqrtPrice, and a range [sqrtPriceLower, sqrtPriceUpper]:

### JavaScript Reference Implementation

```js
/**
 * Compute token amounts for a CL position.
 * All inputs are BigInt sqrtPriceX96 values (Q64.96 fixed-point).
 * Returns amounts in RAW token units (divide by 10^decimals for human).
 *
 * @param {BigInt} sqrtPriceX96  - current pool price
 * @param {BigInt} sqrtRatioAX96 - lower bound sqrtPrice (smaller = lower price)
 * @param {BigInt} sqrtRatioBX96 - upper bound sqrtPrice
 * @param {BigInt} liquidity     - position liquidity
 */
function cl_amounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  const Q96 = 2n ** 96n
  let sqrtA = sqrtRatioAX96
  let sqrtB = sqrtRatioBX96
  // Ensure sqrtA <= sqrtB
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]

  let amount0, amount1

  if (sqrtPriceX96 <= sqrtA) {
    // --- Case 1: price BELOW range --- entirely token0 ---
    // amount0 = L * (sqrtB - sqrtA) / (sqrtA * sqrtB) * Q96^2
    amount0 = liquidity * Q96 * (sqrtB - sqrtA) / (sqrtA * sqrtB)
    amount1 = 0n

  } else if (sqrtPriceX96 >= sqrtB) {
    // --- Case 2: price ABOVE range --- entirely token1 ---
    amount0 = 0n
    // amount1 = L * (sqrtB - sqrtA) / Q96
    amount1 = liquidity * (sqrtB - sqrtA) / Q96

  } else {
    // --- Case 3: price IN range --- mixed ---
    // amount0 = L * (sqrtB - sqrtP) / (sqrtP * sqrtB) * Q96^2
    amount0 = liquidity * Q96 * (sqrtB - sqrtPriceX96) / (sqrtPriceX96 * sqrtB)
    // amount1 = L * (sqrtP - sqrtA) / Q96
    amount1 = liquidity * (sqrtPriceX96 - sqrtA) / Q96
  }

  return { amount0, amount1 }
}
```

### Human-readable interpretation

- **Case 1 (below range):** Position is 100% token0 (e.g., pure ETH). The LP is offering to buy token0 with token1 at the range boundary.
- **Case 2 (above range):** Position is 100% token1 (e.g., pure USDC). The LP sold all ETH as price moved up through the range.
- **Case 3 (in range):** Mixed. amount0 is your ETH exposure (what you need to hedge). amount1 is your USDC exposure (stable, no hedge needed).

---

## 5. Liquidity from Amounts

When opening a position, you specify a desired token amount and the protocol computes liquidity L.

```js
/**
 * Compute liquidity L from a desired amount0 input.
 * Use when you want to deposit exactly X of token0.
 */
function liquidityFromAmount0(sqrtPriceX96, sqrtRatioBX96, amount0Desired) {
  const Q96 = 2n ** 96n
  // L = amount0 * sqrtP * sqrtB / ((sqrtB - sqrtP) * Q96)
  return amount0Desired * sqrtPriceX96 * sqrtRatioBX96 / ((sqrtRatioBX96 - sqrtPriceX96) * Q96)
}

/**
 * Compute liquidity L from a desired amount1 input.
 * Use when you want to deposit exactly Y of token1.
 */
function liquidityFromAmount1(sqrtRatioAX96, sqrtPriceX96, amount1Desired) {
  const Q96 = 2n ** 96n
  // L = amount1 * Q96 / (sqrtP - sqrtA)
  return amount1Desired * Q96 / (sqrtPriceX96 - sqrtRatioAX96)
}

/**
 * For a position in range, the binding constraint is whichever token runs out first.
 * Take the minimum liquidity from both calculations.
 */
function liquidityFromAmounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1) {
  const l0 = liquidityFromAmount0(sqrtPriceX96, sqrtRatioBX96, amount0)
  const l1 = liquidityFromAmount1(sqrtRatioAX96, sqrtPriceX96, amount1)
  return l0 < l1 ? l0 : l1
}
```

---

## 6. Fee Accumulation (Q128 Math)

Fees are tracked per unit of liquidity using Q128 accumulators (multiplied by 2^128).

```js
/**
 * Compute uncollected fees for a position.
 * feeGrowthGlobal, feeGrowthInside are Q128 fixed-point values.
 * tokensOwed are already in raw token units.
 */
function computePendingFees(position, pool, tickLower, tickUpper) {
  const Q128 = 2n ** 128n

  // feeGrowthInside = feeGrowthGlobal - feeGrowthBelow(lower) - feeGrowthAbove(upper)
  // (This is simplified - actual impl needs tickCrossing logic for out-of-range positions)
  const feeGrowth0Inside = pool.feeGrowthGlobal0X128
    - tickLower.feeGrowthOutside0X128
    - tickUpper.feeGrowthOutside0X128

  const feeGrowth1Inside = pool.feeGrowthGlobal1X128
    - tickLower.feeGrowthOutside1X128
    - tickUpper.feeGrowthOutside1X128

  // Fees since last collection
  const feeDelta0 = feeGrowth0Inside - position.feeGrowthInside0LastX128
  const feeDelta1 = feeGrowth1Inside - position.feeGrowthInside1LastX128

  // Multiply by liquidity, divide by Q128, add already-owed tokens
  const fees0 = position.liquidity * feeDelta0 / Q128 + position.tokensOwed0
  const fees1 = position.liquidity * feeDelta1 / Q128 + position.tokensOwed1

  return { fees0, fees1 }
}
```

### Practical shortcut (Orca / Byreal)

For Solana positions, never compute fees manually. Use:
```bash
byreal-cli position status --id <POSITION_ID> -o json
# data.pendingFeesUsd is the total USD value of uncollected fees
```

For Base (Uniswap v3), use `multicall` with `collect()` using `staticcall`:
```js
// Simulate collect to get pending fees without spending gas
const fees = await nftManager.callStatic.collect({
  tokenId,
  recipient: wallet.address,
  amount0Max: ethers.MaxUint128,
  amount1Max: ethers.MaxUint128,
})
// fees.amount0, fees.amount1 are pending (in raw units)
```

---

## 7. Impermanent Loss for CL Positions

IL in a CL position depends on whether the price stays within range. The formula differs from standard AMM IL.

```js
/**
 * Compute impermanent loss for a CL position.
 * price_ratio = current_price / entry_price
 * range_factor = sqrt(upper_price / lower_price)
 *
 * Returns IL as a decimal (negative = loss)
 * e.g., -0.05 means 5% IL relative to holding
 */
function il_cl(priceRatio, lowerPrice, upperPrice) {
  const sqrtRatio = Math.sqrt(priceRatio)
  const sqrtLower = Math.sqrt(lowerPrice)
  const sqrtUpper = Math.sqrt(upperPrice)
  const sqrtEntry = 1.0  // normalized: entry price = 1

  if (priceRatio <= lowerPrice) {
    // Below range: all token0 -- compare to 50/50 hold at entry
    const holdValue = 0.5 + 0.5 * priceRatio  // 50% token0 + 50% token1 at entry prices
    const lpValue = priceRatio  // all token0, worth priceRatio
    return (lpValue - holdValue) / holdValue
  }

  if (priceRatio >= upperPrice) {
    // Above range: all token1
    const holdValue = 0.5 + 0.5 * priceRatio
    const lpValue = 1.0  // all converted to token1
    return (lpValue - holdValue) / holdValue
  }

  // In range: CL formula
  // LP value / Hold value = 2*sqrt(P/P0) / (1 + P/P0) [standard AMM form]
  // For CL with range [L, U]:
  const lpValue = 2 * Math.sqrt(sqrtRatio / sqrtEntry) *
    (sqrtUpper - sqrtRatio) / (sqrtUpper - sqrtLower) +
    (sqrtRatio - sqrtLower) / (sqrtUpper - sqrtLower)

  const holdValue = 0.5 + 0.5 * priceRatio

  return (lpValue - holdValue) / holdValue
}
```

### Rule of thumb for narrow ranges

For a tight +-10% range around current price, IL caps at about -3% before fees compensate. For +-5%, IL caps at about -1.5%. High fee APR pools (>40%) offset IL quickly.

---

## 8. Position Delta (ETH Exposure)

The "delta" of an LP position is how much its value changes per $1 change in token0 (ETH) price. This is what you short on Hyperliquid.

```
Delta = dV/dP = amount0 (the ETH currently in the position)
```

Delta equals amount0 currently held -- the exact ETH exposure.

```js
/**
 * Compute delta (ETH exposure to hedge) for a CL position.
 * Returns amount in ETH (human units, not raw).
 */
function positionDelta(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidity, decimals0) {
  const { amount0 } = cl_amounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidity)
  return Number(amount0) / (10 ** decimals0)
}

// Example: ETH/USDC position
// liquidity = 5000000000n
// sqrtPriceX96 ~ $3500 ETH
// tickLower = -68000, tickUpper = -66000 (approx $3200 - $3800 range)
// -> delta ~ 0.71 ETH -> short 0.71 ETH on Hyperliquid
```

---

## 9. Hedge Adjustment Logic

```js
const DRIFT_THRESHOLD = 0.05  // 5% drift triggers rebalance

/**
 * Check if hedge needs adjustment.
 * currentAmount0: ETH currently in LP position (from cl_amounts)
 * currentShortSize: ETH short currently open on Hyperliquid
 */
function needsHedgeAdjustment(currentAmount0, currentShortSize) {
  if (currentShortSize === 0 && currentAmount0 > 0) return { adjust: true, delta: currentAmount0 }
  if (currentShortSize === 0) return { adjust: false, delta: 0 }

  const drift = Math.abs(currentAmount0 - currentShortSize) / currentShortSize
  const delta = currentAmount0 - currentShortSize  // positive = increase short, negative = reduce

  return {
    adjust: drift > DRIFT_THRESHOLD,
    drift,
    delta,
    action: delta > 0 ? 'INCREASE_SHORT' : 'REDUCE_SHORT',
  }
}

// IMPORTANT: When reducing short on Hyperliquid, ALWAYS use reduce_only: true
// See hyperliquid-perps skill for the reduce_only order schema
```

---

## 10. Rebalancing Strategies

### Strategy A: Static Range (simplest)

Open once. Close when OOR > 4h or APR drops below threshold.

```
Pros:  Zero rebalancing cost, no impermanent loss from frequent rebalancing
Cons:  OOR time accumulates, fees stop accruing when OOR
Best for: Stable pairs, high-fee pools, low-volatility periods
```

### Strategy B: Center-on-Price (reactive)

When OOR, close position and reopen centered on current price.

```
Pros:  Always in range, maximum fee capture
Cons:  Gas costs + slippage on each rebalance, crystallizes IL
Best for: Volatile pairs where fees > rebalancing cost
Trigger: OOR > 4h (current setting in position-monitor.js)
```

### Strategy C: Gamma Neutral (advanced, Phase 3)

Continuously maintain delta neutral AND gamma neutral by dynamically sizing the range.

```
Gamma = d(delta)/dP = change in delta per unit price change
For CL: gamma is concentrated within the range, zero outside
Strategy: Widen range as volatility increases to reduce gamma exposure
```

Not implemented in Phase 1. See SC-liquidity_miner_PLAN.md for Phase 3 roadmap.

---

## 11. Pool Scoring Formula

The pool-scanner.js uses this scoring formula to rank candidates:

```js
/**
 * Score a pool for LP deployment.
 * Higher = better. Ranges roughly 0-1.
 */
function scorePool(pool) {
  const fee_apr   = pool.apyBase / 100           // e.g., 0.35 for 35%
  const reward_apr = (pool.apyReward || 0) / 100 // e.g., 0.15 for 15%
  const tvl       = pool.tvlUsd || 1

  // Organic factor: penalize pools where rewards dominate
  // A pool should earn from fees, not just incentives
  const total_apr = fee_apr + reward_apr
  const organic_factor = total_apr > 0 ? fee_apr / total_apr : 0

  // TVL weight: prefer mid-size pools (not too thin, not too deep)
  // $50k - $5M TVL is the sweet spot for our capital size ($5k-$50k)
  const tvl_weight = tvl < 50_000 ? 0.3       // too thin - we move the price
    : tvl < 500_000  ? 1.0                      // ideal range
    : tvl < 5_000_000 ? 0.8                     // slightly deep - lower APR impact
    : 0.5                                        // too deep - our fees get diluted

  // Tier penalty for stable pools (lower risk but also lower returns)
  const tier_penalty = pool.tier === 'stable/stable' ? 0.7 : 1.0

  return fee_apr * organic_factor * tvl_weight * tier_penalty
}
```

---

## 12. APR Estimation from Pool Data

```js
/**
 * Estimate forward fee APR from 24h volume and TVL.
 * This is what DefiLlama's apyBase approximates.
 */
function estimateFeeApr(volume24h, tvl, feeTier) {
  if (!tvl || tvl === 0) return 0
  const dailyFees = volume24h * feeTier  // e.g., 0.0005 for 0.05% pool
  const annualFees = dailyFees * 365
  return (annualFees / tvl) * 100  // percent
}

// Note: actual APR depends on concentration efficiency (how much of the TVL
// is in active range). CL positions earn MORE than estimateFeeApr if
// their range is tighter than the pool average (higher capital efficiency).
// Capital efficiency multiplier = pool_width / your_range_width (approx)
```

---

## 13. End-to-End Worked Example

**Scenario:** Open a 0.05% fee ETH/USDC position on Base
- Current ETH price: $3,500
- Range: $3,200 - $3,800 (+/-8.6%)
- Capital: $5,000 USDC

**Step 1: Compute sqrtPriceX96 values**

```js
const Q96 = 2n ** 96n
// Current price (raw): $3500 * (10^6 / 10^18) = 3500 * 1e-12
// sqrtPrice = sqrt(3500e-12) * 2^96
const sqrtCurrent = BigInt(Math.floor(Math.sqrt(3500e-12) * Number(Q96)))
const sqrtLower   = BigInt(Math.floor(Math.sqrt(3200e-12) * Number(Q96)))
const sqrtUpper   = BigInt(Math.floor(Math.sqrt(3800e-12) * Number(Q96)))
```

**Step 2: Compute liquidity from $5,000 USDC**

```js
// Split $5000 roughly 50/50 (in-range position)
// ~$2500 USDC (token1) and ~$2500 worth of ETH (~0.714 ETH at $3500)
const amount0 = BigInt(Math.floor(0.714 * 1e18))   // 0.714 ETH in wei
const amount1 = BigInt(2500 * 1e6)                  // $2500 USDC in units

const L = liquidityFromAmounts(sqrtCurrent, sqrtLower, sqrtUpper, amount0, amount1)
// L ~ 4,200,000,000n (approximate)
```

**Step 3: Compute ETH exposure (delta)**

```js
const { amount0: eth, amount1: usdc } = cl_amounts(sqrtCurrent, sqrtLower, sqrtUpper, L)
const ethExposure = Number(eth) / 1e18  // e.g., 0.714 ETH
```

**Step 4: Size the Hyperliquid short**

```js
// Short exactly ethExposure on Hyperliquid
// ETH szDecimals = 4, so round to 4 decimal places
const hedgeSize = Math.round(ethExposure * 10000) / 10000  // e.g., 0.7140
```

**Step 5: Expected income at 25% fee APR**

```js
const capitalUsd = 5000
const feeApr = 0.25  // 25% APR
const dailyFees = capitalUsd * feeApr / 365  // $3.42/day
const monthlyFees = dailyFees * 30  // $102.7/month
```

---

## 14. Phase Parameters Reference

| Parameter | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| LP chain | Base | Base + Solana | Base + Solana + Mantle |
| Capital per position | $500 - $2,000 | $2,000 - $10,000 | $10,000+ |
| Min fee APR to open | 15% | 12% | 10% |
| OOR timeout | 240 min | 180 min | 120 min |
| Hedge drift threshold | 5% | 3% | 2% |
| Morpho leverage | No | 1.5x - 2x | 2x - 3x |
| Hedge via | Hyperliquid manual | Hyperliquid auto | Hyperliquid auto + dYdX |
| Rebalance strategy | Static range | Center-on-price | Gamma-neutral |

---

## 15. Key References

| Resource | URL |
|---|---|
| Uniswap v3 whitepaper | https://uniswap.org/whitepaper-v3.pdf |
| Uniswap v3 math explainer | https://blog.uniswap.org/uniswap-v3-math-primer |
| Orca SDK | https://github.com/orca-so/whirlpools |
| Tick math contract | https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol |
| Full range math | https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/SqrtPriceMath.sol |
