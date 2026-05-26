#!/usr/bin/env node
/**
 * lp-opener.js — Autonomous LP position opener
 *
 * Opens new LP positions on Base (Aerodrome Slipstream / Uniswap v3) using
 * AGENT_PRIVATE_KEY. Reads pending positions from state/lp-positions.json.
 *
 * Flow:
 *   1. Find entries with status: "pending_open" in state/lp-positions.json
 *   2. Fetch current token price via DefiLlama
 *   3. Check agent EOA balances — halt with Telegram alert if insufficient
 *   4. Compute tick boundaries from lowerPrice / upperPrice
 *   5. Compute amount0/amount1 from capitalUsd + current price
 *   6. Approve NftPositionManager for both tokens
 *   7. Call NftPositionManager.mint()
 *   8. If Aerodrome pool: stake NFT in gauge for AERO rewards
 *   9. Update state/lp-positions.json → status: "open", nftTokenId: <id>
 *  10. Write ERC-8004 attestation
 *  11. Telegram report
 *
 * Usage:
 *   node scripts/lp-opener.js                   # dry-run (default)
 *   node scripts/lp-opener.js --execute         # live execution
 *   node scripts/lp-opener.js --position <id>   # open specific pending position
 *
 * Required env vars:
 *   ALCHEMY_BASE_RPC   — Base mainnet RPC endpoint
 *   AGENT_PRIVATE_KEY  — EOA private key (0xhex or raw hex)
 *   TELEGRAM_BOT_TOKEN — for alerts
 *   TELEGRAM_CHAT_ID   — for alerts
 *
 * Sasha Coin — Liquidity Miner v1
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ─── Load .env if present (handles invocation outside the agent runtime) ──────
// OpenClaw's agent loads env at boot, but direct script invocation (cron payload,
// SSH, or docker exec) doesn't inherit it. Read /data/.openclaw/.env if it exists.
;(() => {
    const candidates = [
        '/data/.openclaw/.env',
        path.resolve(WORKSPACE, '..', '.env'),
        path.resolve(WORKSPACE, '.env'),
    ]
    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue
        const content = fs.readFileSync(envPath, 'utf8')
        for (const line of content.split('\n')) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
            if (!m) continue
            const [, key, rawVal] = m
            if (process.env[key]) continue  // don't override existing
            let val = rawVal.trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1)
            }
            process.env[key] = val
        }
        break
    }
})()

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const EXECUTE      = args.includes('--execute')
const POSITION_ARG = (() => { const i = args.indexOf('--position'); return i !== -1 ? args[i+1] : null })()

// ─── Paths ───────────────────────────────────────────────────────────────────

const POSITIONS_PATH = path.join(WORKSPACE, 'state', 'lp-positions.json')

// ─── Base Chain Addresses ─────────────────────────────────────────────────────

const ADDR = {
    WETH:  '0x4200000000000000000000000000000000000006',
    USDC:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    // Uniswap v3
    UNISWAP_NFT_MGR:    '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f6',
    UNISWAP_SWAP_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481',
    // Aerodrome Slipstream
    AERO_NFT_MGR:    '0x827922686190790b37229fd06084350E74485b72',
    AERO_VOTER:      '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5',
    AERO_CL_ROUTER:  '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5',
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
]

// Uniswap v3 SwapRouter02 — exactInput (multi-hop) via path bytes
const UNI_SWAP_ROUTER_ABI = [
    'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
]

// Uniswap v3 NftPositionManager: 3rd param is `uint24 fee`
const UNI_NFT_MGR_ABI = [
    'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'function approve(address to, uint256 tokenId)',
]

// Aerodrome Slipstream NftPositionManager: 3rd param is `int24 tickSpacing`,
// PLUS an extra `uint160 sqrtPriceX96` at the end (for initial pool price if uninitialized — pass 0 if pool exists)
const AERO_NFT_MGR_ABI = [
    'function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline, uint160 sqrtPriceX96)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'function approve(address to, uint256 tokenId)',
]

const VOTER_ABI = [
    'function gauges(address pool) view returns (address)',
]

const GAUGE_ABI = [
    'function deposit(uint256 tokenId) external',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] [opener] ${msg}`) }
function warn(msg) { console.warn(`[opener] ⚠  ${msg}`) }

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'sasha-lp-opener/1.0' } }, res => {
            let d = ''
            res.on('data', c => d += c)
            res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
        }).on('error', reject)
    })
}

function sendTelegram(msg) {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return
    const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }
    const req = https.request(options, () => {}); req.on('error', () => {}); req.write(body); req.end()
}

function loadJson(p) {
    try { if (!fs.existsSync(p)) return null; return JSON.parse(fs.readFileSync(p, 'utf8')) }
    catch(e) { return null }
}

function saveJson(p, data) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function writeAttestation(action, pool, txHash) {
    try {
        const attestScript = path.join(WORKSPACE, 'scripts', 'erc8004-write.js')
        if (!fs.existsSync(attestScript)) return
        const cmd = `node ${attestScript} --action ${action}${pool ? ` --pool ${pool}` : ''}${txHash ? ` --tx ${txHash}` : ''}${EXECUTE ? '' : ' --dry-run'}`
        execSync(cmd, { timeout: 30_000, encoding: 'utf8' })
        log(`ERC-8004 attestation: ${action}`)
    } catch(e) { warn(`ERC-8004 failed (non-fatal): ${e.message}`) }
}

// ─── Tick Math ────────────────────────────────────────────────────────────────

/**
 * Convert a BTC/USD price to a Uniswap v3 tick for the USDC/cbBTC pool.
 *
 * Pool: token0=USDC (6 dec), token1=cbBTC (8 dec)
 * Raw price = (cbBTC_raw / USDC_raw) = (1/btcUsdPrice) * 1e8 / 1e6 = 100 / btcUsdPrice
 * tick = floor(log(rawPrice) / log(1.0001))
 */
function btcPriceToTick(btcUsdPrice) {
    const rawPrice = 100 / btcUsdPrice
    return Math.floor(Math.log(rawPrice) / Math.log(1.0001))
}

/**
 * Generic price → tick for ETH/USD (WETH/USDC pool)
 * Pool: token0=WETH (18 dec) or USDC (6 dec), token1=...
 * For WETH(18)/USDC(6): rawPrice = (USDC_raw/WETH_raw) = ethUsdPrice * 1e6/1e18 = ethUsdPrice * 1e-12
 */
function ethPriceToTick(ethUsdPrice) {
    const rawPrice = ethUsdPrice * 1e-12
    return Math.floor(Math.log(rawPrice) / Math.log(1.0001))
}

function nearestUsableTick(tick, tickSpacing) {
    const rounded = Math.round(tick / tickSpacing) * tickSpacing
    // Ensure tickLower < tickUpper after rounding
    return rounded
}

function sqrtPriceX96FromTick(tick) {
    // sqrtPrice = 1.0001^(tick/2)
    // sqrtPriceX96 = sqrtPrice * 2^96
    const Q96 = 2n ** 96n
    const sqrtPrice = Math.pow(1.0001, tick / 2)
    return BigInt(Math.floor(sqrtPrice * Number(Q96)))
}

/**
 * Compute amount0/amount1 for a given liquidity L and price range.
 * Returns [amount0BigInt, amount1BigInt] in raw token units.
 *
 * In-range formulas (Uniswap v3):
 *   amount0 = L * (1/sqrtP - 1/sqrtPb)  [token0 = USDC, decreases as price rises]
 *   amount1 = L * (sqrtP - sqrtPa)       [token1 = cbBTC, increases as price rises]
 */
function computeAmountsFromLiquidity(L, sqrtP, sqrtPa, sqrtPb) {
    // All sqrtPrice values are raw floats (not Q96)
    const amount0 = L * (1 / sqrtP - 1 / sqrtPb)
    const amount1 = L * (sqrtP - sqrtPa)
    return [Math.max(0, amount0), Math.max(0, amount1)]
}

/**
 * Compute liquidity L and token amounts for a target USD capital.
 * Works for USDC/cbBTC and WETH/USDC Base pools.
 *
 * @param {object} position — from lp-positions.json
 * @param {number} currentPrice — current asset price in USD
 * @returns {{ L, amount0Desired, amount1Desired, sqrtPa, sqrtPb, sqrtP }}
 */
function computePositionAmounts(position, currentPrice) {
    const { lowerPrice, upperPrice, capitalUsd } = position

    let tickLower, tickUpper
    const symbol = (position.symbol || '').toUpperCase()

    if (symbol.includes('CBBTC') || (position.coinId || '').includes('bitcoin')) {
        // USDC/cbBTC pool: invert prices to ticks
        // Higher BTC price = lower raw price = lower tick
        const tickAtUpper = btcPriceToTick(upperPrice)  // lower tick (higher BTC price)
        const tickAtLower = btcPriceToTick(lowerPrice)  // higher tick (lower BTC price)
        const tickSpacing = 2000
        tickLower = nearestUsableTick(tickAtUpper, tickSpacing)
        tickUpper = nearestUsableTick(tickAtLower, tickSpacing)
        // Ensure ordering
        if (tickLower >= tickUpper) tickLower -= tickSpacing
    } else {
        // WETH/USDC pool (Uniswap v3, 0.05% = tickSpacing 10)
        // Higher ETH price = higher raw price = higher tick
        const tickSpacing = 10
        tickLower = nearestUsableTick(ethPriceToTick(lowerPrice), tickSpacing)
        tickUpper = nearestUsableTick(ethPriceToTick(upperPrice), tickSpacing)
        if (tickLower >= tickUpper) tickUpper += tickSpacing
    }

    const sqrtPa = Math.pow(1.0001, tickLower / 2)
    const sqrtPb = Math.pow(1.0001, tickUpper / 2)

    // Current sqrtPrice from raw price
    let sqrtP
    if (symbol.includes('CBBTC') || (position.coinId || '').includes('bitcoin')) {
        sqrtP = Math.sqrt(100 / currentPrice)  // sqrt(cbBTC_raw / USDC_raw)
    } else {
        sqrtP = Math.sqrt(currentPrice * 1e-12) // sqrt(USDC_raw / WETH_raw) for WETH/USDC
    }

    // Clamp sqrtP to range for amount computation
    const sqrtPClamped = Math.min(Math.max(sqrtP, sqrtPa), sqrtPb)

    // Solve for L given target capital
    // amount0_usd = amount0_raw / 10^dec0
    // amount1_usd = amount1_raw / 10^dec1 * currentPrice
    let dec0, dec1
    if (symbol.includes('CBBTC') || (position.coinId || '').includes('bitcoin')) {
        dec0 = 6   // USDC
        dec1 = 8   // cbBTC
    } else {
        dec0 = 18  // WETH
        dec1 = 6   // USDC
    }

    // For L=1, compute USD values
    const [a0_unit, a1_unit] = computeAmountsFromLiquidity(1, sqrtPClamped, sqrtPa, sqrtPb)

    let usdPerUnit0, usdPerUnit1
    if (symbol.includes('CBBTC') || (position.coinId || '').includes('bitcoin')) {
        usdPerUnit0 = a0_unit / Math.pow(10, dec0)       // USDC → USD (1:1)
        usdPerUnit1 = a1_unit / Math.pow(10, dec1) * currentPrice  // cbBTC → USD
    } else {
        usdPerUnit0 = a0_unit / Math.pow(10, dec0) * currentPrice  // WETH → USD
        usdPerUnit1 = a1_unit / Math.pow(10, dec1)       // USDC → USD (1:1)
    }

    const usdPerLiquidityUnit = usdPerUnit0 + usdPerUnit1
    if (usdPerLiquidityUnit <= 0) throw new Error('Cannot compute liquidity: USD per unit is 0')

    const L = capitalUsd / usdPerLiquidityUnit
    const [amount0Float, amount1Float] = computeAmountsFromLiquidity(L, sqrtPClamped, sqrtPa, sqrtPb)

    const amount0Desired = BigInt(Math.floor(amount0Float))
    const amount1Desired = BigInt(Math.floor(amount1Float))

    log(`  Tick range: [${tickLower}, ${tickUpper}]`)
    log(`  sqrtPa=${sqrtPa.toFixed(6)} sqrtP=${sqrtP.toFixed(6)} sqrtPb=${sqrtPb.toFixed(6)}`)
    log(`  L=${L.toFixed(2)} | amount0=${amount0Float.toFixed(2)} raw (${(amount0Float/Math.pow(10,dec0)).toFixed(4)} ${symbol.includes('CBBTC') ? 'USDC' : 'WETH'})`)
    log(`  amount1=${amount1Float.toFixed(2)} raw (${(amount1Float/Math.pow(10,dec1)).toFixed(8)} ${symbol.includes('CBBTC') ? 'cbBTC' : 'USDC'})`)

    return { tickLower, tickUpper, amount0Desired, amount1Desired, sqrtPa, sqrtPb, sqrtP }
}

// ─── Auto-swap: USDC → cbBTC ──────────────────────────────────────────────────

/**
 * If the wallet holds enough USDC but insufficient cbBTC,
 * swap the required USDC amount into cbBTC via Aerodrome CL router.
 *
 * Called automatically before minting when symbol includes cbBTC.
 * Allows Gabriel to fund with USDC only — Sasha handles the split.
 */
async function swapUsdcToCbBtc(amountUsdcRaw, wallet, provider, dryRun) {
    log(`  Auto-swap: ${(Number(amountUsdcRaw) / 1e6).toFixed(2)} USDC → cbBTC`)

    if (dryRun) {
        log('  DRY RUN — would swap via Uniswap v3 multi-hop USDC→WETH→cbBTC')
        return true
    }

    const usdc = new ethers.Contract(ADDR.USDC, ERC20_ABI, wallet)
    const router = new ethers.Contract(ADDR.UNISWAP_SWAP_ROUTER, UNI_SWAP_ROUTER_ABI, wallet)

    // Check existing allowance; only approve if insufficient (saves gas + avoids state race)
    const existingAllowance = await usdc.allowance(wallet.address, ADDR.UNISWAP_SWAP_ROUTER)
    if (existingAllowance < amountUsdcRaw) {
        log(`  Approving USDC for Uniswap SwapRouter02 (MaxUint256)...`)
        const approveTx = await usdc.approve(ADDR.UNISWAP_SWAP_ROUTER, ethers.MaxUint256)
        await approveTx.wait(2)  // wait 2 confirmations for state propagation
        // Verify
        const newAllowance = await usdc.allowance(wallet.address, ADDR.UNISWAP_SWAP_ROUTER)
        log(`  Confirmed allowance: ${newAllowance.toString()}`)
        if (newAllowance < amountUsdcRaw) throw new Error('Approval did not propagate')
    } else {
        log(`  USDC already approved for router (${existingAllowance.toString()})`)
    }

    // Build multi-hop path: USDC →(0.05%)→ WETH →(0.30%)→ cbBTC
    // Encoding: tokenIn (20) + fee (3) + tokenMid (20) + fee (3) + tokenOut (20)
    // 0.05% = 500 (0x0001f4), 0.30% = 3000 (0x000bb8)
    const path = ethers.concat([
        ADDR.USDC,
        '0x0001f4',                                  // 500 = 0.05% WETH/USDC pool
        ADDR.WETH,
        '0x000bb8',                                  // 3000 = 0.30% WETH/cbBTC pool
        ADDR.cbBTC,
    ])

    const tx = await router.exactInput({
        path,
        recipient:        wallet.address,
        amountIn:         amountUsdcRaw,
        amountOutMinimum: 0n,   // 0 = accept any output; fine for small test position
    })
    const receipt = await tx.wait()
    log(`  Swap tx: ${receipt.hash}`)
    return true
}

// ─── Balance Check ────────────────────────────────────────────────────────────

async function checkBalances(position, amount0Desired, amount1Desired, wallet, provider) {
    const symbol = (position.symbol || '').toUpperCase()
    let token0Addr, token1Addr

    if (symbol.includes('CBBTC') || (position.coinId || '').includes('bitcoin')) {
        token0Addr = ADDR.USDC
        token1Addr = ADDR.cbBTC
    } else {
        token0Addr = ADDR.WETH
        token1Addr = ADDR.USDC
    }

    const token0 = new ethers.Contract(token0Addr, ERC20_ABI, provider)
    const token1 = new ethers.Contract(token1Addr, ERC20_ABI, provider)
    const [bal0, bal1] = await Promise.all([
        token0.balanceOf(wallet.address),
        token1.balanceOf(wallet.address),
    ])

    const ok = bal0 >= amount0Desired && bal1 >= amount1Desired
    log(`  Balance token0: ${bal0.toString()} (need ${amount0Desired.toString()}) — ${bal0 >= amount0Desired ? '✅' : '❌ INSUFFICIENT'}`)
    log(`  Balance token1: ${bal1.toString()} (need ${amount1Desired.toString()}) — ${bal1 >= amount1Desired ? '✅' : '❌ INSUFFICIENT'}`)

    return { ok, token0Addr, token1Addr, bal0, bal1 }
}

// ─── Open Position ────────────────────────────────────────────────────────────

async function openPosition(position, dryRun) {
    log(`Opening position: ${position.id} (${position.symbol}) on ${position.chain}`)

    // RPC: Alchemy preferred, falls back to public Base endpoint
    const rpc = process.env.ALCHEMY_BASE_RPC || 'https://mainnet.base.org'
    // Key: AGENT_PRIVATE_KEY preferred, falls back to MANTLE_AGENT_PK (same EOA)
    const pk  = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
    if (!pk) {
        warn('No private key found — set AGENT_PRIVATE_KEY or MANTLE_AGENT_PK in .env')
        return { success: false, error: 'Missing private key' }
    }
    log(`  RPC: ${rpc.includes('alchemy') ? 'Alchemy' : 'public Base RPC'}`)

    // Disable batching — public Base RPC chokes on batched eth_call requests
    const provider = new ethers.JsonRpcProvider(rpc, undefined, { batchMaxCount: 1 })
    const wallet   = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider)
    log(`  Agent EOA: ${wallet.address}`)

    // Fetch current price
    const coinId = position.coinId || 'coingecko:ethereum'
    const priceData = await fetchJson(`https://coins.llama.fi/prices/current/${coinId}`)
    const currentPrice = priceData?.coins?.[coinId]?.price || 0
    if (!currentPrice) return { success: false, error: 'Could not fetch current price' }
    log(`  Current price: $${currentPrice.toFixed(2)} (${coinId})`)

    // Compute amounts
    let tickLower, tickUpper, amount0Desired, amount1Desired
    try {
        ({ tickLower, tickUpper, amount0Desired, amount1Desired } = computePositionAmounts(position, currentPrice))
    } catch(e) {
        return { success: false, error: `Amount computation failed: ${e.message}` }
    }

    // Slippage: 1% minimum
    let amount0Min = amount0Desired * 99n / 100n
    let amount1Min = amount1Desired * 99n / 100n

    // Determine which NftManager to use
    const isAerodrome = (position.project || '').includes('aerodrome')
    const nftMgrAddr = isAerodrome ? ADDR.AERO_NFT_MGR : ADDR.UNISWAP_NFT_MGR

    // ── Auto-swap: if wallet has enough USDC but not enough cbBTC, swap the diff ──
    const isCbBtcPool = (position.symbol || '').toUpperCase().includes('CBBTC') ||
                        (position.coinId || '').includes('bitcoin')
    if (isCbBtcPool) {
        const usdc  = new ethers.Contract(ADDR.USDC,  ERC20_ABI, provider)
        const cbbtc = new ethers.Contract(ADDR.cbBTC, ERC20_ABI, provider)
        const [usdcBal, cbbtcBal] = await Promise.all([
            usdc.balanceOf(wallet.address),
            cbbtc.balanceOf(wallet.address),
        ])

        const usdcShortfall  = amount0Desired > usdcBal  ? amount0Desired - usdcBal  : 0n
        const cbbtcShortfall = amount1Desired > cbbtcBal ? amount1Desired - cbbtcBal : 0n

        if (cbbtcShortfall > 0n) {
            // How much USDC would cover the cbBTC shortfall at current price?
            // cbbtcShortfall is in 1e8 raw; price in USD; USDC is 1e6 raw
            const cbbtcNeededUsd = Number(cbbtcShortfall) / 1e8 * currentPrice
            const usdcToSwapRaw  = BigInt(Math.ceil(cbbtcNeededUsd * 1.005 * 1e6)) // +0.5% slippage buffer

            log(`  cbBTC shortfall: ${Number(cbbtcShortfall)/1e8} cbBTC (~$${cbbtcNeededUsd.toFixed(2)})`)
            log(`  Will swap ${Number(usdcToSwapRaw)/1e6} USDC → cbBTC`)

            const totalUsdcNeeded = amount0Desired + usdcToSwapRaw
            if (usdcBal < totalUsdcNeeded) {
                const totalUsdcUsd = Number(totalUsdcNeeded) / 1e6
                const msg = `❌ <b>[LP_OPENER]</b> Need $${totalUsdcUsd.toFixed(2)} USDC total\n` +
                    `(~$${Number(amount0Desired)/1e6} for LP + ~$${Number(usdcToSwapRaw)/1e6} to swap for cbBTC)\n` +
                    `Wallet: <code>${wallet.address}</code>\n` +
                    `Also need 0.001 ETH for gas.`
                sendTelegram(msg)
                return { success: false, error: 'Insufficient USDC for position + swap', walletAddress: wallet.address }
            }

            await swapUsdcToCbBtc(usdcToSwapRaw, wallet, provider, !EXECUTE)
        }
    }

    // Check balances (post-swap)
    const balCheck = await checkBalances(position, amount0Desired, amount1Desired, wallet, provider)

    // Use actual post-swap balances if they're slightly below desired (handles swap-settlement drift).
    // The mint() function deposits up to amount{0,1}Desired and returns unused — so capping
    // desired to actual balance is safe and avoids tiny shortfalls from price tick movement.
    if (balCheck.bal0 < amount0Desired && balCheck.bal0 >= amount0Desired * 95n / 100n) {
        log(`  Capping amount0Desired to actual balance: ${amount0Desired} → ${balCheck.bal0}`)
        amount0Desired = balCheck.bal0
    }
    if (balCheck.bal1 < amount1Desired && balCheck.bal1 >= amount1Desired * 95n / 100n) {
        log(`  Capping amount1Desired to actual balance: ${amount1Desired} → ${balCheck.bal1}`)
        amount1Desired = balCheck.bal1
    }

    // Recompute mins (more permissive after capping)
    amount0Min = amount0Desired * 90n / 100n   // 10% slippage tolerance
    amount1Min = amount1Desired * 90n / 100n

    // Final check (must have at least 90% of computed amounts after capping)
    if (balCheck.bal0 < amount0Desired * 90n / 100n || balCheck.bal1 < amount1Desired * 90n / 100n) {
        const msg = `❌ <b>[LP_OPENER]</b> Insufficient balance after swap for ${position.symbol}\n` +
            `Need token0: ${amount0Desired} | Have: ${balCheck.bal0}\n` +
            `Need token1: ${amount1Desired} | Have: ${balCheck.bal1}\n` +
            `Fund <code>${wallet.address}</code> on Base to proceed.`
        sendTelegram(msg)
        return { success: false, error: 'Insufficient balance', walletAddress: wallet.address }
    }

    if (dryRun) {
        log(`  DRY RUN — would mint: tickLower=${tickLower} tickUpper=${tickUpper}`)
        log(`  amount0Desired=${amount0Desired} amount1Desired=${amount1Desired}`)
        log(`  NftManager: ${nftMgrAddr} (${isAerodrome ? 'Aerodrome' : 'Uniswap v3'})`)
        return { success: true, dry: true, tickLower, tickUpper, amount0Desired: amount0Desired.toString(), amount1Desired: amount1Desired.toString() }
    }

    // Pre-flight Telegram
    sendTelegram(
        `🔄 <b>[LP_OPENER]</b> Opening position...\n` +
        `Pool: ${position.symbol} | ${position.feeTier || 'CL'}\n` +
        `Range: $${position.lowerPrice?.toLocaleString()} – $${position.upperPrice?.toLocaleString()}\n` +
        `Capital: $${position.capitalUsd} | ticks: [${tickLower}, ${tickUpper}]`
    )

    // Approve tokens (skip if already approved)
    const nftMgrAbi = isAerodrome ? AERO_NFT_MGR_ABI : UNI_NFT_MGR_ABI
    const nftMgr = new ethers.Contract(nftMgrAddr, nftMgrAbi, wallet)
    const token0 = new ethers.Contract(balCheck.token0Addr, ERC20_ABI, wallet)
    const token1 = new ethers.Contract(balCheck.token1Addr, ERC20_ABI, wallet)

    const [allow0, allow1] = await Promise.all([
        token0.allowance(wallet.address, nftMgrAddr),
        token1.allowance(wallet.address, nftMgrAddr),
    ])
    if (allow0 < amount0Desired) {
        log('  Approving token0...')
        await (await token0.approve(nftMgrAddr, ethers.MaxUint256)).wait(2)
    } else log('  token0 already approved')
    if (allow1 < amount1Desired) {
        log('  Approving token1...')
        await (await token1.approve(nftMgrAddr, ethers.MaxUint256)).wait(2)
    } else log('  token1 already approved')

    // Mint
    log(`  Minting position (${isAerodrome ? 'Aerodrome Slipstream' : 'Uniswap v3'})...`)
    const deadline = Math.floor(Date.now() / 1000) + 600

    let mintParams
    if (isAerodrome) {
        mintParams = {
            token0:       balCheck.token0Addr,
            token1:       balCheck.token1Addr,
            tickSpacing:  2000,                  // CL2000
            tickLower,
            tickUpper,
            amount0Desired,
            amount1Desired,
            amount0Min,
            amount1Min,
            recipient:    wallet.address,
            deadline,
            sqrtPriceX96: 0n,                    // 0 = pool already initialized
        }
    } else {
        mintParams = {
            token0:    balCheck.token0Addr,
            token1:    balCheck.token1Addr,
            fee:       500,                      // 0.05% for WETH/USDC
            tickLower,
            tickUpper,
            amount0Desired,
            amount1Desired,
            amount0Min,
            amount1Min,
            recipient: wallet.address,
            deadline,
        }
    }
    const mintTx = await nftMgr.mint(mintParams)
    const receipt = await mintTx.wait()
    log(`  Mint tx: ${receipt.hash}`)

    // Parse tokenId from IncreaseLiquidity event (topic[0] = keccak256("IncreaseLiquidity(uint256,uint128,uint256,uint256)"))
    const INCREASE_LIQUIDITY_TOPIC = '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35'
    let tokenId = null
    for (const log_ of receipt.logs) {
        if (log_.topics[0] === INCREASE_LIQUIDITY_TOPIC) {
            tokenId = BigInt(log_.topics[1]).toString()
            break
        }
    }
    log(`  NFT tokenId: ${tokenId || '(not parsed — check receipt)'}`)

    // Aerodrome: stake in gauge for AERO rewards
    if (isAerodrome && tokenId && position.poolAddress) {
        try {
            log('  Staking in Aerodrome gauge...')
            const voter = new ethers.Contract(ADDR.AERO_VOTER, VOTER_ABI, wallet)
            const gaugeAddr = await voter.gauges(position.poolAddress)
            if (gaugeAddr && gaugeAddr !== ethers.ZeroAddress) {
                const gauge = new ethers.Contract(gaugeAddr, GAUGE_ABI, wallet)
                await nftMgr.approve(gaugeAddr, tokenId)
                await (await gauge.deposit(tokenId)).wait()
                log(`  Staked in gauge: ${gaugeAddr}`)
            } else {
                log('  No active gauge for this pool — skipping stake')
            }
        } catch(e) {
            warn(`Gauge stake failed (non-fatal): ${e.message}`)
        }
    }

    // Write ERC-8004 attestation
    writeAttestation('OPEN_LP_POSITION', position.symbol, receipt.hash)

    // Report
    sendTelegram(
        `✅ <b>[LP_OPENER]</b> Position opened!\n` +
        `Pool: ${position.symbol} | ${position.feeTier || 'CL'}\n` +
        `Range: $${position.lowerPrice?.toLocaleString()} – $${position.upperPrice?.toLocaleString()}\n` +
        `NFT tokenId: ${tokenId || 'check tx'} | Capital: $${position.capitalUsd}\n` +
        `Tx: <code>${receipt.hash}</code>`
    )

    return { success: true, tokenId, txHash: receipt.hash }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    log(`Starting LP opener — mode: ${EXECUTE ? 'LIVE EXECUTION' : 'DRY RUN'}`)
    if (!EXECUTE) log('Pass --execute to open real positions')

    const store = loadJson(POSITIONS_PATH)
    if (!store) {
        log('No state/lp-positions.json found — nothing to open')
        process.exit(0)
    }

    let pending = (store.positions || []).filter(p => p.status === 'pending_open')
    if (POSITION_ARG) pending = pending.filter(p => p.id === POSITION_ARG)

    if (!pending.length) {
        log('No pending_open positions found — nothing to open')
        process.exit(0)
    }

    log(`Found ${pending.length} pending position(s) to open`)

    for (const position of pending) {
        if (position.chain !== 'base') {
            warn(`Position ${position.id} is on ${position.chain} — lp-opener only handles Base. Skipping.`)
            continue
        }

        const result = await openPosition(position, !EXECUTE)

        if (result.success && !result.dry) {
            // Update state
            const idx = store.positions.findIndex(p => p.id === position.id)
            if (idx !== -1) {
                store.positions[idx] = {
                    ...store.positions[idx],
                    status:    'open',
                    nftTokenId: result.tokenId,
                    openedAt:  new Date().toISOString(),
                }
            }
            store.updatedAt = new Date().toISOString()
            saveJson(POSITIONS_PATH, store)
            log(`Updated state/lp-positions.json: ${position.id} → open (tokenId: ${result.tokenId})`)
        } else if (!result.success) {
            warn(`Failed to open ${position.id}: ${result.error}`)
        }
    }

    log('LP opener done.')
}

main().catch(err => {
    console.error('[opener] Fatal:', err.message)
    sendTelegram(`💥 [LP_OPENER] Fatal error: ${err.message}`)
    process.exit(1)
})
