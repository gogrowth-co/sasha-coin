---
name: hyperliquid-perps
description: Expert reference for Hyperliquid perpetuals — REST API endpoints, request/response formats, funding rate mechanics, delta-neutral LP hedging patterns, order management, and margin. Use whenever building or debugging Hyperliquid integrations for the hedge executor.
---

# Hyperliquid Perps — Expert Reference
*Last verified: 2026-05-25 | Network: Hyperliquid L1 (not EVM)*

---

## 1. Architecture Overview

Hyperliquid is its own L1 blockchain (not EVM). Key properties:
- **Single margin currency:** USDC only — all P&L, margin, and withdrawals in USDC
- **No gas fees:** Order placement is free (maker rebates available)
- **Settlement:** Every funding payment and trade settles in USDC
- **Bridge:** Deposit USDC from Arbitrum or Base via official bridge at app.hyperliquid.xyz/trade

---

## 2. REST API Reference

### Base URLs
```
Mainnet:  https://api.hyperliquid.xyz
Testnet:  https://api.hyperliquid-testnet.xyz
```

### Info Endpoint — Read-Only (POST /info)
All info queries are POST with JSON body.

```js
// Current prices and funding rates for all assets
const res = await fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'metaAndAssetCtxs' })
})
const [meta, assetCtxs] = await res.json()
// meta.universe[i] = { name, szDecimals, maxLeverage, ... }
// assetCtxs[i] = { funding, openInterest, prevDayPx, dayNtlVlm, premium, oraclePx, markPx, midPx, impactPxs }
// Find ETH: meta.universe.findIndex(a => a.name === 'ETH')

// Account state (open positions, margin, etc.)
body: JSON.stringify({ type: 'clearinghouseState', user: '0x...' })
// Returns: { assetPositions, crossMarginSummary, ... }

// Open orders
body: JSON.stringify({ type: 'openOrders', user: '0x...' })

// Funding rate history (paginated — 500 records per call)
body: JSON.stringify({ type: 'fundingHistory', coin: 'ETH', startTime: 1704067200000 })
// Returns: [{ coin, fundingRate, premium, time }, ...]
// Paginate: set startTime = last record's time + 1
```

### Exchange Endpoint — Signed Actions (POST /exchange)
All write actions require EIP-712 signing.

```js
// Place a market order (SHORT for hedge)
const action = {
  type: 'order',
  orders: [{
    a: assetIndex,      // from meta.universe
    b: false,           // b=true for buy/long, b=false for sell/short
    p: '0',             // price — '0' for market orders
    s: '1.5',           // size in asset units (e.g., 1.5 ETH)
    r: false,           // reduce_only — false for opening, true for closing
    t: { limit: { tif: 'Ioc' } },  // IoC = fill immediately or cancel (market-like)
  }],
  grouping: 'na',
}

// Reduce-only order (close/reduce hedge)
const reduceAction = {
  type: 'order',
  orders: [{
    a: assetIndex,
    b: true,     // buy to close a short
    p: '0',
    s: '0.5',    // amount to reduce
    r: true,     // reduce_only = true — CRITICAL: prevents accidental position flip
    t: { limit: { tif: 'Ioc' } },
  }],
  grouping: 'na',
}
```

### Signing (EIP-712)
```js
import { ethers } from 'ethers'

const wallet = new ethers.Wallet(process.env.HL_PRIVATE_KEY)
// chainId 1337 for Hyperliquid signing (NOT Arbitrum's 42161)
// Use official Python SDK or community JS SDK for full signing implementation
// Python: https://github.com/hyperliquid-dex/hyperliquid-python-sdk
// JS:     https://github.com/neonlabsorg/hyperliquid-ts-sdk
```

---

## 3. Funding Rate Mechanics

### Formula
```
funding_rate (8h) = avg_premium_index + clamp(interest_rate - avg_premium_index, -0.0005, 0.0005)

where:
  interest_rate = 0.0001 (fixed 0.01% per 8h = ~4.4% annualized)
  premium_index = (impact_bid_price - oracle_price) [long premium]
               or (oracle_price - impact_ask_price) [short premium]
  impact price = price to fill a $5,000 USDC market order

Payment per hour = position_size x oracle_price x (funding_rate / 8)
Cap: +/-4% per hour maximum
```

### Payment Direction
- **funding_rate > 0** -> longs pay shorts -> **our short RECEIVES funding**
- **funding_rate < 0** -> shorts pay longs -> **our short PAYS funding**

### Historical ETH Funding on Hyperliquid (2024-2026)
- Average: +0.0036% per 8h = **+13.4% annualized** (shorts receive on average)
- Negative periods: ~5% of time
- Maximum negative observed: ~-0.004%/8h = -54.75% annualized (rare, brief)
- Kill switch threshold: if annualized rate < -54.75% for 3 consecutive hours -> close hedge

### Reading Live Funding Rate
```js
const res = await fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
})
const [meta, ctxs] = await res.json()
const ethIdx = meta.universe.findIndex(a => a.name === 'ETH')
const fundingRate8h = parseFloat(ctxs[ethIdx].funding)  // e.g., 0.0000454 = 0.00454%/8h
const annualized = fundingRate8h * 3 * 365 * 100  // %/year
```

---

## 4. Delta-Neutral Hedge Implementation

### Sizing the Short
```js
// Compute amount0 (ETH in LP) using CL math, then short exactly that on Hyperliquid
function computeHedgeSize(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  const Q96 = 2n ** 96n
  const sqrtP = sqrtPriceX96
  const sqrtA = sqrtRatioAX96
  const sqrtB = sqrtRatioBX96
  const L = liquidity

  if (sqrtP <= sqrtA) {
    // Below range: all token0
    return Number(L * (sqrtB - sqrtA) * Q96 / (sqrtA * sqrtB)) / 1e18
  } else if (sqrtP >= sqrtB) {
    return 0  // Above range: all token1 (USDC), delta = 0
  } else {
    // In range
    return Number(L * (sqrtB - sqrtP) * Q96 / (sqrtP * sqrtB)) / 1e18
  }
}

// Round to Hyperliquid minimum size (szDecimals from meta)
// ETH szDecimals = 4 -> minimum 0.0001 ETH
```

### Adjustment Logic
```js
const DRIFT_THRESHOLD = 0.05  // 5%

function needsHedgeAdjustment(currentAmount0, currentShortSize) {
  if (currentShortSize === 0 && currentAmount0 > 0) return true
  const drift = Math.abs(currentAmount0 - currentShortSize) / currentShortSize
  return drift > DRIFT_THRESHOLD
}

// delta > 0: increase short (b=false, r=false)
// delta < 0: reduce short (b=true, r=true — ALWAYS reduce_only when reducing!)
```

### Margin Management
```js
// Rule: keep hedge margin = 20% of LP notional (5x effective leverage)
// Check from clearinghouseState
const state = await fetchInfo({ type: 'clearinghouseState', user: address })
const marginRatio = state.crossMarginSummary.accountValue / state.crossMarginSummary.totalNtlPos
// If marginRatio < 0.15: add more USDC margin
// If marginRatio > 0.35: can reduce margin (optional)
```

---

## 5. Account Setup

```
Hedge wallet: separate from Base EOA (0xba3BB32)
Fund via:     Official HL bridge at app.hyperliquid.xyz
Initial margin: 20% of Phase 3 LP notional (~$1,000 for $5,000 LP)
```

---

## 6. Kill Switches

```js
const KILL_SWITCH_ANN = -54.75  // -54.75% annualized

// Check 3 consecutive 8h periods
let consecutiveNeg = 0
for (const record of last3FundingRecords) {
  if (parseFloat(record.fundingRate) * 3 * 365 * 100 < KILL_SWITCH_ANN) {
    consecutiveNeg++
  } else {
    consecutiveNeg = 0
  }
}
if (consecutiveNeg >= 3) closeHedge()
```

---

## 7. Gotchas

1. **chainId 1337 for signing** — not 42161 (Arbitrum). Signing with wrong chainId = rejected action.
2. **reduce_only is critical** — never adjust a short without r=true when reducing.
3. **szDecimals** — ETH has 4 decimal places on HL. Always round to szDecimals before placing.
4. **Funding is hourly, rate is 8h** — payment per hour = rate/8 x size x price.
5. **Market order = IoC limit at 0** — use IoC (Immediate-or-Cancel) with price=0.
6. **Testnet first** — always test on api.hyperliquid-testnet.xyz before mainnet.

## 8. Update Sources
| Source | URL |
|---|---|
| Hyperliquid docs | https://hyperliquid.gitbook.io/hyperliquid-docs/changelog |
| Python SDK | https://github.com/hyperliquid-dex/hyperliquid-python-sdk |
| Discord | https://discord.gg/hyperliquid |
