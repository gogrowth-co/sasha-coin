---
name: solana-clmm
description: Expert reference for Solana CLMM liquidity positions via Orca Whirlpools and Raydium CL. Covers program IDs, position management, fee harvesting, rebalancing, Byreal CLI integration, and current top pools. Use whenever working with Solana LP positions in the liquidity miner.
---

# Solana CLMM — Expert Reference
*Last verified: 2026-05-25 | Network: Solana Mainnet-Beta*

---

## 1. Solana Fundamentals for LP Agents

### RPC Endpoints
```
Public (rate-limited):
  https://api.mainnet-beta.solana.com

Paid (recommended):
  Helius:    https://mainnet.helius-rpc.com/?api-key={KEY}
  QuickNode: https://{slug}.solana-mainnet.quiknode.pro/{KEY}/
  Alchemy:   https://solana-mainnet.g.alchemy.com/v2/{KEY}
```

### Key Differences from EVM
| EVM | Solana |
|---|---|
| State in contract | State in separate **accounts** owned by program |
| LP position = NFT (ERC-721) | LP position = **Program Derived Address (PDA)** account |
| `eth_call` for reads | `getAccountInfo` + deserialize with Borsh |
| Gas fees in ETH | Fees in SOL (~0.000005 SOL per transaction) |
| tx confirmation: 1-2 blocks | Confirmed: ~0.4s, Finalized: ~13s |

### Commitment Levels
```js
// For reading: use 'confirmed' (fast)
// For critical state before trading: use 'finalized'
const conn = new Connection(RPC_URL, 'confirmed')
```

### Key Token Addresses (Mainnet)
```
SOL (native):     So11111111111111111111111111111111111111112 (wrapped: WSOL)
USDC:             EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDT:             Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
WBTC:             3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh
ETH (Wormhole):   7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs
```

---

## 2. Orca Whirlpools — Primary CLMM

### Program IDs
```
Whirlpools Program: whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc
Config Account:     2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ
```

### Fee Tiers & Tick Spacing
```
0.01% (1 bps)   -> tickSpacing: 1   — USDC/USDT
0.05% (5 bps)   -> tickSpacing: 8   — SOL/USDC (primary)
0.30% (30 bps)  -> tickSpacing: 64  — volatile pairs
1.00% (100 bps) -> tickSpacing: 128 — exotic pairs
2.00% (200 bps) -> tickSpacing: 128 — very exotic
```

### SDK Installation & Key Functions
```bash
npm install @orca-so/whirlpools-sdk @solana/web3.js @solana/spl-token
```

```js
import { WhirlpoolContext, buildWhirlpoolClient, PDAUtil, PoolUtil } from '@orca-so/whirlpools-sdk'
import { AnchorProvider } from '@coral-xyz/anchor'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'

const connection = new Connection(RPC_URL, 'confirmed')
const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions())
const ctx = WhirlpoolContext.withProvider(provider, WHIRLPOOL_PROGRAM_ID)
const client = buildWhirlpoolClient(ctx)

// Get a pool
const poolAddress = PDAUtil.getWhirlpool(PROGRAM_ID, CONFIG_ADDRESS, tokenMintA, tokenMintB, tickSpacing).publicKey
const pool = await client.getPool(poolAddress)

// Get pool data (current tick, sqrtPrice, liquidity)
const poolData = pool.getData()
// poolData.sqrtPrice, poolData.tickCurrentIndex, poolData.liquidity
```

### Opening a Position
```js
import { increaseLiquidityQuoteByInputTokenWithParams, PriceMath } from '@orca-so/whirlpools-sdk'
import Decimal from 'decimal.js'

// Define tick range from price range
const lowerTick = PriceMath.priceToInitializableTickIndex(new Decimal(lowerPrice), tokenADecimals, tokenBDecimals, tickSpacing)
const upperTick = PriceMath.priceToInitializableTickIndex(new Decimal(upperPrice), tokenADecimals, tokenBDecimals, tickSpacing)

// Get quote
const quote = increaseLiquidityQuoteByInputTokenWithParams({
  tokenMintA: pool.getTokenAInfo().mint,
  tokenMintB: pool.getTokenBInfo().mint,
  sqrtPrice:  poolData.sqrtPrice,
  tickLowerIndex: lowerTick,
  tickUpperIndex: upperTick,
  inputTokenMint: USDC_MINT,
  inputTokenAmount: new BN(500 * 1e6),  // $500 USDC
  slippageTolerance: Percentage.fromFraction(1, 100),  // 1%
})

// Open position
const { positionMint, tx } = await pool.openPosition(lowerTick, upperTick, quote)
await tx.buildAndExecute()
const positionAddress = PDAUtil.getPosition(PROGRAM_ID, positionMint).publicKey
```

### Collecting Fees
```js
const position = await client.getPosition(positionAddress)
const collectQuote = await collectFeesQuote({
  whirlpool: poolData,
  position: position.getData(),
  tickLower: await ctx.fetcher.getTick(tickLowerAddress),
  tickUpper: await ctx.fetcher.getTick(tickUpperAddress),
})
// collectQuote.feeOwedA, collectQuote.feeOwedB

const collectTx = await position.collectFees()
await collectTx.buildAndExecute()
```

### Closing a Position
```js
// Decrease all liquidity, collect fees, close
const decreaseTx = await position.decreaseLiquidity({
  liquidityAmount: position.getData().liquidity,
  tokenMinA: new BN(0),
  tokenMinB: new BN(0),
})
const closeTx = await position.closePosition([slippageTolerance])
// Or use bundled: pool.closePosition(positionAddress, slippageTolerance)
```

---

## 3. Byreal CLI — Orca Integration

Byreal abstracts the Orca SDK into simple CLI commands. **Always run `byreal-cli skill` first** for current command reference.

```bash
# Check installed version
byreal-cli --version

# Self-documentation
byreal-cli skill          # full docs
byreal-cli catalog list   # all capabilities

# Wallet
byreal-cli wallet address
byreal-cli wallet balance -o json

# Pool discovery
byreal-cli pool list --chain solana --sort apr --limit 20
byreal-cli pool info --address <POOL_ADDRESS> -o json

# Position management
byreal-cli position list -o json                           # all open positions
byreal-cli position status --id <POSITION_ID> -o json      # single position
byreal-cli position open --pool <ADDR> --amount 500 --range-lower 130 --range-upper 170 --dry-run
byreal-cli position close --id <POSITION_ID> --dry-run
byreal-cli position claim --id <POSITION_ID> --dry-run     # harvest fees
```

### Integration with position-monitor.js
```js
// position-monitor.js calls byreal-cli for Solana positions:
const raw = execSync(`byreal-cli position status --id ${positionId} -o json`, { timeout: 20000, encoding: 'utf8' })
const data = JSON.parse(raw)
// data.inRange, data.currentPrice, data.lowerPrice, data.upperPrice
// data.pendingFeesUsd, data.tokenAAmount, data.tokenBAmount, data.valueUsd
```

### byreal-trade.js Signal Schema
The `mantle-signal.json` `recommendation.action` drives byreal-trade.js:
```json
{
  "action": "OPEN_LP_POSITION",
  "pool": "<pool_address_or_symbol>",
  "amount": 500,
  "rangeLower": 130,
  "rangeUpper": 170,
  "rationale": "Signal fusion result..."
}
```
Actions: `OPEN_LP_POSITION`, `CLOSE_LP_POSITION`, `CLAIM_FEES`, `SWAP`, `HOLD`

---

## 4. Raydium CLMM (Secondary)

### Program IDs
```
CLMM Program: CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK
AMM v4:       675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
```

### Key Differences from Orca
- Raydium CLMM uses `tick_array` accounts (similar concept to Orca)
- SDK: `@raydium-io/raydium-sdk-v2`
- Better for: high-volume meme coin pairs (often on Raydium first)
- Byreal supports Raydium — check `byreal-cli catalog list` for current support

---

## 5. Top Solana Pools (Live Data Sources)

### APIs for Pool Discovery
```
Orca API:      https://api.orca.so/v2/solana/whirlpool          # pool list + APR
Raydium API:   https://api.raydium.io/v2/ammV3/ammPools          # CLMM pools
DefiLlama:     https://yields.llama.fi/pools (chain=Solana)      # cross-protocol
Birdeye:       https://public-api.birdeye.so/defi/pools          # requires API key
```

### pool-scanner.js for Solana
```bash
node scripts/pool-scanner.js --chain solana --top 5 --dry-run
```

### Typical APR Ranges (Solana, May 2026)
- SOL/USDC (Orca, 0.05%): 15-35% fee APR
- SOL/USDT (Orca): 10-25% fee APR
- WBTC/SOL: 20-50% fee APR (higher volatility = more fees)
- meme/SOL pairs: 50-500%+ but high IL risk

---

## 6. Position Math on Solana CLMM

Same underlying math as Uniswap v3 — see `defi-lp-math` skill for formulas. Key difference: Solana uses **BN (big number integers)** with decimals tracked separately, not `BigInt` like EVM.

```js
// Solana: amounts in atomic units
// SOL: 9 decimals  -> 1 SOL = 1,000,000,000 lamports
// USDC: 6 decimals -> 1 USDC = 1,000,000 units

const usdcAmount = new BN(500 * 1e6)   // $500
const solAmount  = new BN(3.33 * 1e9)  // 3.33 SOL
```

---

## 7. Gotchas
1. **WSOL vs SOL:** Orca requires wrapped SOL. Use `createWrappedNativeAccount` before LP operations.
2. **Tick initialization:** If a tick hasn't been initialized yet, it must be initialized in the same tx as position open — Byreal handles this.
3. **Compute units:** Complex LP txs may need increased compute budget: `ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })`
4. **byreal-cli -o json:** Always use for machine parsing.
5. **Position PDA:** Positions are derived from the position mint NFT address. Store `positionMint` — that's your handle.
6. **Auto-update:** Run `byreal-cli update check` before every session.

## 8. Update Sources
| Source | URL |
|---|---|
| Orca SDK releases | https://github.com/orca-so/whirlpools/releases |
| Orca developer docs | https://orca-so.gitbook.io/orca-developer-portal/ |
| Raydium SDK | https://github.com/raydium-io/raydium-sdk-V2/releases |
| Byreal | https://github.com/byreal-git/byreal-agent-skills |
| Solana changelog | https://docs.solana.com/release-notes |
