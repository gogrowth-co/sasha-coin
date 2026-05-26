---
name: base-defi-stack
description: Expert reference for Base L2 DeFi infrastructure — chain config, Uniswap v3 on Base, Aerodrome Slipstream CLMM, Morpho Blue leverage, key token addresses, tick math, and fee collection. Use whenever building or debugging Base LP positions in the liquidity miner.
---

# Base DeFi Stack — Expert Reference
*Last verified: 2026-05-25 | Chain: Base (chainId 8453)*

---

## 1. Base Chain Config

```
Chain ID:       8453
RPC Endpoints:
  Alchemy:   https://base-mainnet.g.alchemy.com/v2/{KEY}  (env: ALCHEMY_BASE_RPC)
  QuickNode: https://{slug}.base-mainnet.quiknode.pro/{KEY}/
  Infura:    https://base-mainnet.infura.io/v3/{KEY}
  Public:    https://mainnet.base.org  (rate-limited, not for production)

Explorer:   https://basescan.org
Native gas: ETH (same as mainnet, but very cheap)
Block time: ~2s
```

### ethers.js Provider Setup
```js
import { ethers } from 'ethers'

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_BASE_RPC)
const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider)

// EIP-1559 gas (Base supports it)
const feeData = await provider.getFeeData()
const tx = await contract.method({
  maxFeePerGas: feeData.maxFeePerGas,
  maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
})
```

---

## 2. Key Token Addresses (Base Mainnet)

```
WETH:   0x4200000000000000000000000000000000000006  (18 decimals)
USDC:   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  (6 decimals)
cbBTC:  0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf  (8 decimals — NOT 18!)
USDT:   0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2  (6 decimals)
AERO:   0x940181a94A35A4569E4529A3CDfB74e38FD98631  (18 decimals)
DAI:    0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb  (18 decimals)
```

> **cbBTC gotcha:** 8 decimals, not 18. Always check `token.decimals()` before computing amounts.
> **WETH:** ETH is NOT ERC-20. Uniswap uses WETH. Use `IWETH.deposit{value: amount}()` to wrap.

---

## 3. Uniswap v3 on Base

### Contract Addresses
```
Factory:                    0x33128a8fC17869897dcE68Ed026d694621f6FDfD
NonfungiblePositionManager: 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f6
SwapRouter02:               0x2626664c2603336E57B271c5C0b26F421741e481
QuoterV2:                   0x3d4e44Eb1374240CE5F1B136041212F30e7E0d11
```

### Fee Tiers & Tick Spacing
```
0.01% fee  -> tickSpacing: 1    — stablecoin pairs (USDC/USDT)
0.05% fee  -> tickSpacing: 10   — WETH/USDC main pool
0.30% fee  -> tickSpacing: 60   — altcoin/bluechip
1.00% fee  -> tickSpacing: 200  — exotic pairs
```

### Tick Math
```js
// tick to price (token1/token0)
function tickToPrice(tick) {
  return Math.pow(1.0001, tick)
}

// price to tick
function priceToTick(price) {
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

// Snap to nearest usable tick
function nearestUsableTick(tick, tickSpacing) {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing
  return rounded
}

// sqrtPriceX96 -> price
function sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1) {
  const Q96 = 2n ** 96n
  const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2
  return price * (10 ** decimals0) / (10 ** decimals1)
}

// price -> sqrtPriceX96
function priceToSqrtPriceX96(price, decimals0, decimals1) {
  const adjusted = price * (10 ** decimals1) / (10 ** decimals0)
  return BigInt(Math.floor(Math.sqrt(adjusted) * 2**96))
}
```

### NftPositionManager ABI (minimal)
```js
const NFT_POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) returns (uint256 amount0, uint256 amount1)',
  'function burn(uint256 tokenId)',
]
```

### Opening a Position
```js
const nftManager = new ethers.Contract(NFT_POS_MANAGER, NFT_POSITION_MANAGER_ABI, wallet)

// Approve tokens first
const token0 = new ethers.Contract(TOKEN0_ADDR, ERC20_ABI, wallet)
await token0.approve(NFT_POS_MANAGER, ethers.MaxUint256)

const tx = await nftManager.mint({
  token0: TOKEN0_ADDR,
  token1: TOKEN1_ADDR,         // must be sorted: token0 < token1 (address comparison)
  fee: 500,                    // 0.05% pool
  tickLower: lowerTick,
  tickUpper: upperTick,
  amount0Desired: amount0,
  amount1Desired: amount1,
  amount0Min: amount0 * 995n / 1000n,  // 0.5% slippage
  amount1Min: amount1 * 995n / 1000n,
  recipient: wallet.address,
  deadline: Math.floor(Date.now() / 1000) + 300,  // 5 min
})
const receipt = await tx.wait()
// Parse tokenId from IncreaseLiquidity event
```

> **Token ordering:** Uniswap v3 requires token0.address < token1.address (lexicographic). Always sort before passing to mint.

### Fee Collection
```js
const tx = await nftManager.collect({
  tokenId: positionTokenId,
  recipient: wallet.address,
  amount0Max: ethers.MaxUint128,  // collect all pending fees
  amount1Max: ethers.MaxUint128,
})
```

---

## 4. Aerodrome Slipstream (CLMM)

### Contract Addresses
```
Router:                     0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
NonfungiblePositionManager: 0x827922686190790b37229fd06084350E74485b72
Voter:                      0x16613524e02ad97eDfeF371bC883F2F5d6C480A5
CLFactory:                  0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A
```

### Aerodrome vs Uniswap v3
- Identical CL math (same tick, sqrtPrice, liquidity model)
- Additional AERO gauge rewards on top of trading fees
- Positions are still ERC-721 NFTs with same `tokenId` handle
- NonfungiblePositionManager interface is identical to Uniswap v3

### Gauge Integration (AERO Rewards)
```js
const VOTER_ABI = [
  'function gauges(address pool) view returns (address)',
  'function isGauge(address gauge) view returns (bool)',
]
const GAUGE_ABI = [
  'function deposit(uint256 tokenId) external',
  'function withdraw(uint256 tokenId) external',
  'function getReward(uint256 tokenId) external',
  'function earned(address token, uint256 tokenId) view returns (uint256)',
  'function rewardToken() view returns (address)',
]

const voter = new ethers.Contract(VOTER_ADDR, VOTER_ABI, provider)
const gaugeAddress = await voter.gauges(poolAddress)  // get gauge for pool

const gauge = new ethers.Contract(gaugeAddress, GAUGE_ABI, wallet)

// Deposit NFT position into gauge to start earning AERO
await nftManager.approve(gaugeAddress, tokenId)
await gauge.deposit(tokenId)

// Claim AERO rewards (keep position open)
await gauge.getReward(tokenId)

// Check pending rewards
const pendingAero = await gauge.earned(AERO_TOKEN, tokenId)

// Withdraw from gauge (must do before closing position)
await gauge.withdraw(tokenId)
```

---

## 5. Morpho Blue (Leverage)

### Contract Address
```
Morpho Blue Core: 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
```

### Health Factor Formula
```js
// HF = (collateral * LLTV) / borrowed  [in same currency, e.g. USD]
// No single getHealthFactor() function — must compute from raw state

const MORPHO_ABI = [
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
  'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)',
  'function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
]
const ORACLE_ABI = [
  'function price() view returns (uint256)',  // price of collateral in loan token (scaled 1e36)
]

const morpho = new ethers.Contract(MORPHO_ADDR, MORPHO_ABI, provider)

async function getHealthFactor(marketId, userAddress) {
  const [pos, mkt, params] = await Promise.all([
    morpho.position(marketId, userAddress),
    morpho.market(marketId),
    morpho.idToMarketParams(marketId),
  ])

  // Convert borrow shares to assets
  const borrowed = (pos.borrowShares * mkt.totalBorrowAssets) / mkt.totalBorrowShares

  if (borrowed === 0n) return Infinity  // no debt

  // Get oracle price (collateral in terms of loan token, scaled 1e36)
  const oracle = new ethers.Contract(params.oracle, ORACLE_ABI, provider)
  const oraclePrice = await oracle.price()
  const collateralInLoan = (pos.collateral * oraclePrice) / BigInt(1e36)

  // LLTV is stored as 1e18 = 100%
  const hf = Number(collateralInLoan * params.lltv / 1n**18n) / Number(borrowed)
  return hf
}

// Kill switch thresholds:
// HF < 1.20: deleverage (reduce borrow)
// HF < 1.05: emergency close position
```

---

## 6. Gotchas

1. **cbBTC is 8 decimals** — treat like WBTC, not WETH. Every cbBTC amount calculation needs `/ 1e8` not `/ 1e18`.
2. **Token ordering in Uniswap v3** — always pass token0/token1 in sorted order (lower address first).
3. **WETH vs ETH** — Uniswap only accepts ERC-20. Use `IWETH(WETH).deposit{value: amount}()` to wrap ETH first.
4. **Aerodrome gauge approval** — must `nftManager.approve(gaugeAddress, tokenId)` before `gauge.deposit()`.
5. **Morpho HF computation** — no single call, must combine `position()`, `market()`, and `oracle.price()`.
6. **Compute gas on Base** — very cheap (~$0.001 per tx). Set `gasLimit` explicitly for complex txs.
7. **cbBTC pool ordering** — cbBTC address (`0xcbB7...`) < USDC address (`0x8335...`) so cbBTC is token0, USDC is token1 in Uniswap pools. Verify with `factory.getPool()`.

---

## 7. Update Sources

| Source | URL |
|---|---|
| Base chain docs | https://docs.base.org |
| Uniswap v3 Base deployments | https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments |
| Aerodrome docs | https://docs.aerodrome.finance |
| Aerodrome contracts | https://github.com/aerodrome-finance/contracts/releases |
| Morpho Blue | https://docs.morpho.org |
| Basescan | https://basescan.org |
