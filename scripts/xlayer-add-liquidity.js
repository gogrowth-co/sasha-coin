#!/usr/bin/env node
/**
 * xlayer-add-liquidity.js — Deposit REAL liquidity into Sasha's v4 pool (X Layer).
 *
 * Fixes the under-sizing bug: the original add passed a hardcoded L=100000 (dust),
 * which deposited ~nothing and refunded the rest to the wallet. This script sizes L
 * from the actual token amounts available, so the funds land in the pool.
 *
 * Flow:
 *   1. Read agent wallet USDC.e + WOKB balances + live pool sqrtPrice.
 *   2. Size L = min(L from USDC, L from WOKB) for the deployment range (float, rounded
 *      DOWN with a safety factor — the helper refunds any excess, so under-sizing is safe).
 *   3. Approve LiquidityHelper to pull both tokens (max budgets = full balances).
 *   4. callStatic addLiquidity to SIMULATE (catch reverts before spending gas).
 *   5. With --execute: send the real tx, wait for receipt, print pool liquidity before/after.
 *
 * Usage:
 *   node scripts/xlayer-add-liquidity.js            # DRY RUN: size + simulate, no tx
 *   node scripts/xlayer-add-liquidity.js --execute  # real deposit
 *
 * Requires XLAYER_AGENT_PK (the pool owner / LiquidityHelper owner = 0xe451…).
 * Reads addresses from state/xlayer-deployment.json.
 *
 * Sasha Coin — OKX Build X Hackathon
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')
const EXECUTE = process.argv.slice(2).includes('--execute')

const XLAYER_RPC = process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech'
const SAFETY = 0.97   // size L to 97% of the binding side; helper refunds the rest anyway

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
]
const HELPER_ABI = ['function addLiquidity((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 maxAmount0,uint256 maxAmount1) external']
const PM_ABI = ['function extsload(bytes32) view returns (bytes32)']

function log(m) { console.log(`[add-liq] ${m}`) }

function loadDeployment() {
    const p = path.join(WORKSPACE, 'state', 'xlayer-deployment.json')
    return JSON.parse(fs.readFileSync(p, 'utf8'))
}

async function readPoolSqrtP(pm, poolId) {
    const base = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [poolId, 6n]))
    const slot0 = BigInt(await pm.extsload(base))
    const liq = BigInt(await pm.extsload('0x' + (BigInt(base) + 3n).toString(16).padStart(64, '0'))) & ((1n << 128n) - 1n)
    const sqrtPriceX96 = slot0 & ((1n << 160n) - 1n)
    return { sqrtPriceX96, liquidity: liq }
}

async function main() {
    log(`mode: ${EXECUTE ? 'EXECUTE (real tx)' : 'DRY RUN'}`)
    const pk = process.env.XLAYER_AGENT_PK
    if (!pk) { log('XLAYER_AGENT_PK not set — abort'); process.exit(1) }

    const d = loadDeployment()
    const provider = new ethers.JsonRpcProvider(XLAYER_RPC, { chainId: 196, name: 'xlayer' })
    const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider)
    log(`signer: ${wallet.address}`)

    const USDCE = d.tokens.USDC_E, WOKB = d.tokens.WOKB
    const helper = d.liquidityHelper
    const key = [d.poolKey.currency0, d.poolKey.currency1, BigInt(d.poolKey.fee), Number(d.poolKey.tickSpacing), d.poolKey.hooks]
    const tickLower = d.liquidityRange.tickLower, tickUpper = d.liquidityRange.tickUpper

    const usdc = new ethers.Contract(USDCE, ERC20_ABI, wallet)
    const wokb = new ethers.Contract(WOKB, ERC20_ABI, wallet)
    const pm = new ethers.Contract(d.poolManager, PM_ABI, provider)

    // balances (raw)
    const bal0 = await usdc.balanceOf(wallet.address)   // USDC.e (token0, 6dec)
    const bal1 = await wokb.balanceOf(wallet.address)    // WOKB  (token1, 18dec)
    const okb = await provider.getBalance(wallet.address)
    log(`balances: ${ethers.formatUnits(bal0,6)} USDC.e · ${ethers.formatUnits(bal1,18)} WOKB · ${ethers.formatEther(okb)} OKB (gas)`)

    // live price + range sqrt (float space; safe because helper refunds excess)
    const { sqrtPriceX96, liquidity: poolLiqBefore } = await readPoolSqrtP(pm, d.poolId)
    const sqrtP = Number(sqrtPriceX96) / 2 ** 96
    const sqrtA = Math.pow(1.0001, tickLower / 2)
    const sqrtB = Math.pow(1.0001, tickUpper / 2)
    if (!(sqrtP > sqrtA && sqrtP < sqrtB)) { log(`price out of range [${sqrtA.toFixed(0)},${sqrtB.toFixed(0)}] sqrtP=${sqrtP.toFixed(0)} — abort`); process.exit(1) }

    // L from each side (plain sqrt space): L0 = amt0*(sqrtP*sqrtB)/(sqrtB-sqrtP); L1 = amt1/(sqrtP-sqrtA)
    const amt0 = Number(bal0), amt1 = Number(bal1)
    const L0 = amt0 * (sqrtP * sqrtB) / (sqrtB - sqrtP)
    const L1 = amt1 / (sqrtP - sqrtA)
    const L = BigInt(Math.floor(Math.min(L0, L1) * SAFETY))
    // expected amounts consumed at this L
    const use0 = L * BigInt(Math.floor((sqrtB - sqrtP) / (sqrtP * sqrtB) * 1e18)) / (10n ** 18n)
    const use1 = L * BigInt(Math.floor((sqrtP - sqrtA) * 1e0))
    log(`pool liquidity before: ${poolLiqBefore}`)
    log(`sizing L = ${L}  (L0=${L0.toExponential(3)} from USDC, L1=${L1.toExponential(3)} from WOKB, binding: ${L0<L1?'USDC':'WOKB'})`)
    log(`est. deposit ≈ ${(Number(use0)/1e6).toFixed(4)} USDC.e + ${(Number(use1)/1e18).toFixed(6)} WOKB`)

    if (L <= 0n) { log('computed L <= 0 — nothing to deposit, abort'); process.exit(1) }

    const helperC = new ethers.Contract(helper, HELPER_ABI, wallet)

    // approvals (idempotent): approve full balances as max budgets
    if (!EXECUTE) {
        log('[dry-run] would approve helper for full balances, then addLiquidity; simulating via callStatic...')
    } else {
        const a0 = await usdc.allowance(wallet.address, helper)
        if (a0 < bal0) { log('approving USDC.e...'); await (await usdc.approve(helper, bal0, { gasLimit: 80000n })).wait() }
        const a1 = await wokb.allowance(wallet.address, helper)
        if (a1 < bal1) { log('approving WOKB...'); await (await wokb.approve(helper, bal1, { gasLimit: 80000n })).wait() }
    }

    // simulate
    try {
        await helperC.addLiquidity.staticCall(key, tickLower, tickUpper, L, bal0, bal1, { gasLimit: 2_000_000n })
        log('✓ simulation passed (addLiquidity would not revert)')
    } catch (e) {
        log(`✗ simulation FAILED: ${e.shortMessage || e.message}`)
        if (!EXECUTE) { log('(approvals not yet sent in dry-run — a transfer/allowance revert here is expected; real run approves first)') }
        else { process.exit(1) }
    }

    if (!EXECUTE) { log('DRY RUN complete — re-run with --execute to deposit.'); process.exit(0) }

    log('sending addLiquidity...')
    const tx = await helperC.addLiquidity(key, tickLower, tickUpper, L, bal0, bal1, { gasLimit: 2_000_000n })
    log(`tx: ${tx.hash}`)
    const rcpt = await tx.wait()
    log(`mined in block ${rcpt.blockNumber}, status ${rcpt.status}`)

    const { liquidity: poolLiqAfter } = await readPoolSqrtP(pm, d.poolId)
    log(`pool liquidity: ${poolLiqBefore} → ${poolLiqAfter}  (${poolLiqAfter > poolLiqBefore ? 'INCREASED ✓' : 'unchanged'})`)
    log(`explorer: https://www.oklink.com/x-layer/tx/${tx.hash}`)
    process.exit(0)
}

main().catch(e => { console.error('[add-liq] fatal:', e.message); process.exit(1) })
