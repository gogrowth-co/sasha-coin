#!/usr/bin/env node
/**
 * xlayer-pool-state.js — Read live X Layer oracle + pool state for the OKX dashboard.
 *
 * The OKX dashboard hero is the CURRENT SWAP FEE the SashaDynamicFeeHook is
 * applying, plus proof the oracle is fresh and the agent wallet is funded.
 * This script reads that on-chain state (view calls only — no transactions) and
 * writes a compact snapshot the dashboard reads.
 *
 * Writes: state/xlayer-pool-state.json
 *
 * Reads addresses from state/xlayer-deployment.json (falls back to env).
 *
 * Usage:
 *   node scripts/xlayer-pool-state.js            # read + write snapshot
 *   node scripts/xlayer-pool-state.js --dry-run  # read + print, do not write
 *
 * Read-only and cron-safe: never sends a tx, never throws, always exits 0.
 * Suggested cadence: every 30 min (alongside the dashboard refresh).
 *
 * Note: Uniswap v4 spot price / pool TVL require a StateView periphery contract
 * (PoolManager exposes state via extsload, not a plain getter). Until a StateView
 * address is wired, tvlUsd / spotPrice are reported null — the dashboard renders
 * "$—" for these per the design brief. The live fee (the hero) does not need it.
 *
 * Sasha Coin — OKX Build X Hackathon 2026 · dashboard data layer
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const DRY_RUN = process.argv.slice(2).includes('--dry-run')

const DEPLOYMENT_PATH = path.join(WORKSPACE, 'state', 'xlayer-deployment.json')
const PUSHES_PATH     = path.join(WORKSPACE, 'state', 'xlayer-oracle-pushes.json')
const OUT_PATH        = path.join(WORKSPACE, 'state', 'xlayer-pool-state.json')

const XLAYER = {
    rpc:      process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    chainId:  parseInt(process.env.XLAYER_CHAIN_ID || '196'),
    name:     'X Layer',
    explorer: 'https://www.oklink.com/x-layer',
}

// Same mapping the hook enforces (push-signal-to-xlayer.js)
const FEE_MAPPING = { 'risk-off': 10000, 'neutral': 3000, 'risk-on': 500 }

const ORACLE_ABI = [
    'function currentFee() external view returns (uint24)',
    'function riskLevel() external view returns (string)',
    'function updatedAt() external view returns (uint256)',
    'function isStale() external view returns (bool)',
    'function updateCount() external view returns (uint256)',
    'function getFeeOrDefault() external view returns (uint24)',
    'function agent() external view returns (address)',
]

const LOW_OKB_WARN = 0.005   // below this the next push may fail

function log(msg)  { console.log(`[xlayer-pool] ${msg}`) }
function warn(msg) { console.warn(`[xlayer-pool] ⚠  ${msg}`) }

function loadJson(p) {
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
    catch (e) { warn(`could not read ${path.basename(p)}: ${e.message}`); return null }
}

// Read live Uniswap v4 pool state via PoolManager.extsload (v4 stores pool state
// in a mapping at POOLS_SLOT=6; slot0 at base, liquidity at base+3). Computes spot
// price (USDC.e per WOKB) and self-priced TVL from the active liquidity + range.
// OKB market price from DefiLlama (the pool's init price is off-market; use this for USD).
function fetchOkbUsd() {
    return new Promise(resolve => {
        const req = https.get('https://coins.llama.fi/prices/current/coingecko:okb', res => {
            let d = ''; res.on('data', c => d += c)
            res.on('end', () => { try { resolve(JSON.parse(d)?.coins?.['coingecko:okb']?.price || null) } catch { resolve(null) } })
        })
        req.on('error', () => resolve(null))
        req.setTimeout(8000, () => { req.destroy(); resolve(null) })
    })
}

const POOL_MANAGER_ABI = ['function extsload(bytes32) view returns (bytes32)']
async function readPoolLiveState(provider, deploy, okbUsd) {
    try {
        const pm = new ethers.Contract(deploy.poolManager, POOL_MANAGER_ABI, provider)
        const base = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [deploy.poolId, 6n]))
        const slot0 = BigInt(await pm.extsload(base))
        const liqSlot = '0x' + (BigInt(base) + 3n).toString(16).padStart(64, '0')
        const liquidity = BigInt(await pm.extsload(liqSlot)) & ((1n << 128n) - 1n)
        const sqrtPriceX96 = slot0 & ((1n << 160n) - 1n)
        let tick = Number((slot0 >> 160n) & ((1n << 24n) - 1n)); if (tick >= (1 << 23)) tick -= (1 << 24)

        // token0 = USDC.e (6), token1 = WOKB (18) — from poolKey ordering
        const sp = Number(sqrtPriceX96) / 2 ** 96
        const pRaw = sp * sp                                   // token1/token0 (raw)
        const usdcPerWokb = 1 / (pRaw * 10 ** (6 - 18))        // 1 WOKB in USDC.e (~$1)

        const lr = deploy.liquidityRange || {}
        const sa = Math.pow(1.0001, (lr.tickLower ?? tick) / 2)
        const sb = Math.pow(1.0001, (lr.tickUpper ?? tick) / 2)
        const L = Number(liquidity)
        let a0r, a1r
        if (sp <= sa) { a0r = L * (sb - sa) / (sa * sb); a1r = 0 }
        else if (sp >= sb) { a0r = 0; a1r = L * (sb - sa) }
        else { a0r = L * (sb - sp) / (sp * sb); a1r = L * (sp - sa) }
        const usdc = a0r / 1e6, wokb = a1r / 1e18
        const wokbPx = okbUsd || usdcPerWokb   // value WOKB at OKB market price, not the pool's init price
        const tvlUsd = usdc * 1 + wokb * wokbPx

        return {
            sqrtPriceX96: sqrtPriceX96.toString(),
            tick,
            liquidity: liquidity.toString(),
            spotPrice: Math.round(usdcPerWokb * 100) / 100,     // USDC.e per WOKB
            spotLabel: '1 WOKB = ' + (Math.round(usdcPerWokb * 100) / 100) + ' USDC.e',
            tvlUsd: Math.round(tvlUsd * 100) / 100,
            seedLiquidity: tvlUsd < 1,                          // flag: demo/seed depth
            source: 'live',
        }
    } catch (e) { warn(`pool state read failed: ${e.message.slice(0, 60)}`); return null }
}

function feeToPct(fee) {
    if (fee == null) return null
    return Math.round((Number(fee) / 10000) * 1e4) / 1e4   // 3000 -> 0.30
}

async function main() {
    log(`Starting — mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

    const deploy = loadJson(DEPLOYMENT_PATH) || {}
    const oracleAddress = process.env.XLAYER_ORACLE_ADDRESS || deploy.oracleAddress
    const hookAddress   = deploy.hookAddress || null
    const agentAddress  = deploy.agentAddress || null

    if (!oracleAddress) {
        warn('No oracle address (state/xlayer-deployment.json or XLAYER_ORACLE_ADDRESS) — cannot read state')
        process.exit(0)
    }

    const provider = new ethers.JsonRpcProvider(XLAYER.rpc, { chainId: XLAYER.chainId, name: XLAYER.name })
    const oracle   = new ethers.Contract(oracleAddress, ORACLE_ABI, provider)

    // --- Oracle live state (the hero) ---
    let oracleState = { address: oracleAddress }
    try {
        const [fee, risk, updatedAt, stale, count] = await Promise.all([
            oracle.currentFee(),
            oracle.riskLevel(),
            oracle.updatedAt(),
            oracle.isStale(),
            oracle.updateCount(),
        ])
        const onchainUpdatedAt = Number(updatedAt) ? new Date(Number(updatedAt) * 1000).toISOString() : null
        oracleState = {
            address:        oracleAddress,
            currentFee:     Number(fee),
            currentFeePct:  feeToPct(fee),
            riskLevel:      risk,
            updatedAt:      onchainUpdatedAt,
            ageMinutes:     onchainUpdatedAt ? Math.round((Date.now() - new Date(onchainUpdatedAt).getTime()) / 60000) : null,
            isStale:        Boolean(stale),
            updateCount:    Number(count),
        }
        log(`Oracle: fee=${oracleState.currentFee} (${oracleState.currentFeePct}%) risk="${oracleState.riskLevel}" stale=${oracleState.isStale} updates=${oracleState.updateCount}`)
    } catch (e) {
        warn(`Could not read oracle state: ${e.message}`)
        oracleState.error = e.message
    }

    // --- OKB market price (for honest USD valuation; pool's init price ≠ market) ---
    const okbUsd = await fetchOkbUsd()
    if (okbUsd) log(`OKB market price: $${okbUsd}`)

    // --- Live pool state (spot price + TVL via v4 extsload) ---
    const poolLive = deploy.poolManager && deploy.poolId ? await readPoolLiveState(provider, deploy, okbUsd) : null
    if (poolLive) log(`Pool: spot ${poolLive.spotLabel} · TVL $${poolLive.tvlUsd}${poolLive.seedLiquidity ? ' (seed)' : ''} · liquidity ${poolLive.liquidity}`)

    // --- Agent wallet balance + full token holdings (the funds available to deploy) ---
    let agent = { address: agentAddress }
    if (agentAddress) {
        try {
            const bal = await provider.getBalance(agentAddress)
            const okb = parseFloat(ethers.formatEther(bal))
            // token holdings (WOKB, USDC.e) — these are the funds available for liquidity
            const erc = ['function balanceOf(address) view returns (uint256)']
            let wokb = null, usdce = null
            try {
                if (deploy?.tokens?.WOKB) wokb = parseFloat(ethers.formatUnits(await new ethers.Contract(deploy.tokens.WOKB, erc, provider).balanceOf(agentAddress), 18))
                if (deploy?.tokens?.USDC_E) usdce = parseFloat(ethers.formatUnits(await new ethers.Contract(deploy.tokens.USDC_E, erc, provider).balanceOf(agentAddress), 6))
            } catch {}
            // USD at OKB MARKET price (DefiLlama), not the pool's off-market init price
            const px = okbUsd || poolLive?.spotPrice || 0
            const holdingsUsd = (usdce || 0) * 1 + (wokb || 0) * px + okb * px
            agent = {
                address:           agentAddress,
                okbBalance:        okb,
                wokbBalance:       wokb,
                usdceBalance:      usdce,
                holdingsUsd:       Math.round(holdingsUsd * 100) / 100,
                lowBalanceWarning: okb < LOW_OKB_WARN,
            }
            log(`Agent wallet: ${agentAddress} — ${okb} OKB · ${wokb} WOKB · ${usdce} USDC.e (~$${agent.holdingsUsd})${agent.lowBalanceWarning ? ' [LOW GAS]' : ''}`)
        } catch (e) {
            warn(`Could not read agent balance: ${e.message}`)
            agent.error = e.message
        }
    }

    // --- Push history (last 10) for the feed + step chart ---
    const pushes = loadJson(PUSHES_PATH)
    const recentPushes = Array.isArray(pushes) ? pushes.slice(-10).reverse() : []

    const snapshot = {
        updatedAt:   new Date().toISOString(),
        chainId:     XLAYER.chainId,
        status:      deploy.status || 'unknown',
        oracle:      oracleState,
        hook:        { address: hookAddress },
        pool: {
            poolId:    deploy.poolId || null,
            token0:    deploy?.poolKey?.currency0 || null,
            token1:    deploy?.poolKey?.currency1 || null,
            pair:      'USDC.e / WOKB',
            tickSpacing: deploy?.poolKey?.tickSpacing ?? null,
            liquidityRange: deploy.liquidityRange || null,
            tick:          poolLive?.tick ?? null,
            liquidity:     poolLive?.liquidity ?? null,
            spotPrice:     poolLive?.spotPrice ?? null,
            spotLabel:     poolLive?.spotLabel ?? null,
            tvlUsd:        poolLive?.tvlUsd ?? null,
            seedLiquidity: poolLive?.seedLiquidity ?? null,
            source:        poolLive?.source ?? null,
        },
        agent,
        feeMapping:    FEE_MAPPING,
        recentPushes,
        explorer: {
            oracle: `${XLAYER.explorer}/address/${oracleAddress}`,
            hook:   hookAddress ? `${XLAYER.explorer}/address/${hookAddress}` : null,
            pool:   deploy?.explorer?.pool || null,
        },
    }

    if (DRY_RUN) {
        log('[dry-run] snapshot:')
        console.log(JSON.stringify(snapshot, null, 2))
    } else {
        fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
        fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2))
        log(`Wrote ${path.basename(OUT_PATH)}`)
    }

    process.exit(0)
}

main().catch(err => {
    console.warn(`[xlayer-pool] Fatal (non-blocking): ${err.message}`)
    process.exit(0)
})
