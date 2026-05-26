#!/usr/bin/env node
/**
 * init-xlayer-pool.js — Wrap OKB, swap for USDC, initialize v4 pool with Sasha hook
 *
 * Steps:
 *   1. Wrap 0.022 OKB → WOKB
 *   2. Approve WOKB for Uniswap v3 SwapRouter
 *   3. Swap 0.020 WOKB → USDC via v3 (existing liquidity)
 *   4. Read sqrtPriceX96 from v3 pool (same pair, same price)
 *   5. Initialize Uniswap v4 pool with DYNAMIC_FEE_FLAG + SashaDynamicFeeHook
 *
 * Uses 0.06 OKB on hand. Keeps ~0.015 OKB as gas reserve.
 *
 * Sasha Coin — OKX Build X Hackathon 2026
 */

import { ethers } from 'ethers'
import fs          from 'fs'
import path        from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// ─── Chain + token config ─────────────────────────────────────────────────────

const XLAYER = {
    rpc:     process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    chainId: 196,
    name:    'X Layer',
    explorer:'https://www.oklink.com/x-layer',
}

// token0 < token1 by address
const USDC  = '0x74b7F16337b8972027F6196A17a631aC6dE26d22'  // token0 (smaller address)
const WOKB  = '0xe538905cf8410324e03A5A23C1c177a474D59b2b'  // token1

// Uniswap v3 on X Layer
const V3_ROUTER  = '0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca'
const V3_POOL    = '0x1bE3a8c2ecDba107d73A6C5f129dcf2aE0bfCD7D'  // USDC/WOKB 0.3%

// Uniswap v4 on X Layer
const POOL_MANAGER   = '0x360e68faccca8ca495c1b759fd9eee466db9fb32'
const DYNAMIC_FEE    = 0x800000  // pool fee flag for dynamic-fee pools
const TICK_SPACING   = 60

// ─── ABIs (minimal) ───────────────────────────────────────────────────────────

const WOKB_ABI = [
    'function deposit() external payable',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address) external view returns (uint256)',
]

const V3_ROUTER_ABI = [
    `function exactInputSingle(tuple(
        address tokenIn, address tokenOut, uint24 fee,
        address recipient, uint256 amountIn,
        uint256 amountOutMinimum, uint160 sqrtPriceLimitX96
    ) params) external payable returns (uint256 amountOut)`,
]

const V3_POOL_ABI = [
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)',
]

const POOL_MANAGER_ABI = [
    `function initialize(
        tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key,
        uint160 sqrtPriceX96
    ) external returns (int24 tick)`,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[pool-init] ${msg}`) }
function warn(msg) { console.warn(`[pool-init] ⚠  ${msg}`) }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const hookAddress = process.env.XLAYER_HOOK_ADDRESS
    if (!hookAddress) throw new Error('XLAYER_HOOK_ADDRESS not set')

    const pk = process.env.XLAYER_AGENT_PK
    if (!pk)  throw new Error('XLAYER_AGENT_PK not set')

    const provider = new ethers.JsonRpcProvider(XLAYER.rpc, { chainId: XLAYER.chainId, name: XLAYER.name })
    const signer   = new ethers.Wallet(pk, provider)
    const agent    = await signer.getAddress()

    const balRaw = await provider.getBalance(agent)
    const bal    = parseFloat(ethers.formatEther(balRaw))
    log(`Agent:   ${agent}`)
    log(`Balance: ${bal.toFixed(6)} OKB`)

    if (bal < 0.02) throw new Error(`Not enough OKB (${bal}). Need at least 0.02.`)

    // ── Step 1: Wrap 0.022 OKB → WOKB ─────────────────────────────────────────
    const wrapAmount = ethers.parseEther('0.022')
    log(`\n[1/4] Wrapping ${ethers.formatEther(wrapAmount)} OKB → WOKB...`)
    if (!DRY_RUN) {
        const wokb = new ethers.Contract(WOKB, WOKB_ABI, signer)
        const wrapTx = await wokb.deposit({ value: wrapAmount, gasLimit: 60000n })
        log(`TX: ${wrapTx.hash}`)
        await wrapTx.wait(1)
        const wokbBal = await wokb.balanceOf(agent)
        log(`✅ WOKB balance: ${ethers.formatEther(wokbBal)}`)
    } else {
        log('(dry-run) Would wrap 0.022 OKB')
    }

    // ── Step 2: Approve WOKB for v3 router ────────────────────────────────────
    const swapAmount = ethers.parseEther('0.020')
    log(`\n[2/4] Approving WOKB for v3 SwapRouter...`)
    if (!DRY_RUN) {
        const wokb = new ethers.Contract(WOKB, WOKB_ABI, signer)
        const approveTx = await wokb.approve(V3_ROUTER, swapAmount, { gasLimit: 60000n })
        log(`TX: ${approveTx.hash}`)
        await approveTx.wait(1)
        log('✅ Approved')
    } else {
        log('(dry-run) Would approve WOKB')
    }

    // ── Step 3: Swap 0.020 WOKB → USDC via v3 ─────────────────────────────────
    log(`\n[3/4] Swapping ${ethers.formatEther(swapAmount)} WOKB → USDC via v3...`)
    let usdcReceived = 0n
    if (!DRY_RUN) {
        const router = new ethers.Contract(V3_ROUTER, V3_ROUTER_ABI, signer)
        const swapTx = await router.exactInputSingle({
            tokenIn:             WOKB,
            tokenOut:            USDC,
            fee:                 3000,
            recipient:           agent,
            amountIn:            swapAmount,
            amountOutMinimum:    0n,       // no slippage protection — small demo amount
            sqrtPriceLimitX96:   0n,
        }, { gasLimit: 300000n })
        log(`TX: ${swapTx.hash}`)
        const receipt = await swapTx.wait(1)

        // Read USDC balance after swap
        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
        const usdcContract = new ethers.Contract(USDC, usdcAbi, provider)
        usdcReceived = await usdcContract.balanceOf(agent)
        log(`✅ USDC received: ${ethers.formatUnits(usdcReceived, 6)} USDC`)
        log(`   Explorer: ${XLAYER.explorer}/tx/${swapTx.hash}`)
    } else {
        log('(dry-run) Would swap 0.020 WOKB → USDC')
    }

    // ── Step 4: Read sqrtPriceX96 from v3 pool ────────────────────────────────
    log(`\n[4/4] Initializing v4 pool with SashaDynamicFeeHook...`)
    const v3Pool = new ethers.Contract(V3_POOL, V3_POOL_ABI, provider)
    const slot0  = await v3Pool.slot0()
    const sqrtPriceX96 = slot0[0]
    log(`sqrtPriceX96 from v3: ${sqrtPriceX96.toString()}`)

    const poolKey = {
        currency0:   USDC,
        currency1:   WOKB,
        fee:         DYNAMIC_FEE,    // 0x800000 — enables dynamic fees via hook
        tickSpacing: TICK_SPACING,
        hooks:       hookAddress,
    }

    log(`Pool key:`)
    log(`  currency0 (USDC):  ${poolKey.currency0}`)
    log(`  currency1 (WOKB):  ${poolKey.currency1}`)
    log(`  fee (dynamic):     0x${DYNAMIC_FEE.toString(16)}`)
    log(`  tickSpacing:       ${poolKey.tickSpacing}`)
    log(`  hook:              ${poolKey.hooks}`)

    if (!DRY_RUN) {
        const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, signer)
        const initTx = await poolManager.initialize(poolKey, sqrtPriceX96, { gasLimit: 500000n })
        log(`TX: ${initTx.hash}`)
        const initReceipt = await initTx.wait(1)
        log(`✅ Pool initialized! Status: ${initReceipt.status}`)
        log(`   Explorer: ${XLAYER.explorer}/tx/${initTx.hash}`)

        // Compute pool ID for reference
        const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint24', 'int24', 'address'],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        ))
        log(`\n   Pool ID: ${poolId}`)

        // Save to state
        const statePath = path.join(WORKSPACE, 'state', 'xlayer-deployment.json')
        let state = {}
        try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')) } catch {}
        state.poolId       = poolId
        state.poolKey      = { ...poolKey, fee: '0x' + DYNAMIC_FEE.toString(16) }
        state.initTx       = initTx.hash
        state.sqrtPriceX96 = sqrtPriceX96.toString()
        state.initializedAt = new Date().toISOString()
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
        log(`   State saved to state/xlayer-deployment.json`)

        // Print summary
        console.log('\n' + '='.repeat(60))
        console.log('POOL LIVE — add to .env:')
        console.log(`XLAYER_POOL_ID=${poolId}`)
        console.log('='.repeat(60))
        console.log('\nNext: node scripts/push-signal-to-xlayer.js')
        console.log('This pushes Sasha\'s current signal to the oracle.')
        console.log('Every swap in this pool will now use her fee.\n')
    } else {
        log('(dry-run) Would initialize pool with above key + sqrtPriceX96')
    }
}

main().catch(err => {
    console.error('[pool-init] Fatal:', err.message)
    process.exit(1)
})
