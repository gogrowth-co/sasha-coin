#!/usr/bin/env node
/**
 * lp-harvest.js — Claim fees from a gauge-staked Aerodrome Slipstream position
 *
 * Full harvest cycle (5 txs on Base, ~$0.05 total gas):
 *   1. gauge.getReward(tokenId)           → claim AERO emissions
 *   2. gauge.withdraw(tokenId)            → unstake NFT back to agent
 *   3. nftMgr.collect(tokenId, MAX, MAX)  → sweep trading fees (USDC + cbBTC)
 *   4. nftMgr.approve(gauge, tokenId)     → re-approve gauge
 *   5. gauge.deposit(tokenId)             → re-stake to resume AERO + fee accrual
 *
 * Does NOT crystallize IL — liquidity stays untouched.
 *
 * Usage:
 *   node scripts/lp-harvest.js                    # dry-run (default)
 *   node scripts/lp-harvest.js --execute          # live execution
 *   node scripts/lp-harvest.js --position <id>    # one position
 *   node scripts/lp-harvest.js --aero-only        # skip the unstake cycle, claim AERO only
 *
 * On success: updates state/lp-positions.json (lastClaimAt, pendingFeesUsd reset,
 * lastHarvestUsd, lifetimeFeesUsd accumulator).
 *
 * Sasha Coin — Liquidity Miner v1
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ── .env autoload ─────────────────────────────────────────────────────────────
;(() => {
    const candidates = ['/data/.openclaw/.env', path.resolve(WORKSPACE, '..', '.env'), path.resolve(WORKSPACE, '.env')]
    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
            if (!m) continue
            const [, key, rawVal] = m
            if (process.env[key]) continue
            let val = rawVal.trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
            process.env[key] = val
        }
        break
    }
})()

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const EXECUTE      = args.includes('--execute')
const AERO_ONLY    = args.includes('--aero-only')
const POSITION_ARG = (() => { const i = args.indexOf('--position'); return i !== -1 ? args[i+1] : null })()

// ── Addresses ─────────────────────────────────────────────────────────────────
const AERO_NFT_MGR = '0x827922686190790b37229fd06084350E74485b72'
const AERO_TOKEN   = '0x940181a94A35A4569E4529A3CDfB74e38FD98631'   // AERO on Base
const USDC         = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const cbBTC        = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'

const NFT_MGR_ABI = [
    'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)',
    'function approve(address to, uint256 tokenId)',
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
]
const GAUGE_ABI = [
    'function deposit(uint256 tokenId) external',
    'function withdraw(uint256 tokenId) external',
    'function getReward(uint256 tokenId) external',
    'function earned(address account, uint256 tokenId) view returns (uint256)',
]
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)']

const POSITIONS_PATH = path.join(WORKSPACE, 'state', 'lp-positions.json')
const HARVEST_LOG    = path.join(WORKSPACE, 'state', 'lp-harvest-log.json')

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] [harvest] ${msg}`) }
function warn(msg) { console.warn(`[harvest] ⚠  ${msg}`) }

function sendTelegram(msg) {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return
    const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    const req = https.request({
        hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, () => {}); req.on('error', () => {}); req.write(body); req.end()
}

function fetchJson(url) {
    return new Promise((res, rej) => {
        https.get(url, { headers: { 'User-Agent': 'sasha-harvest/1.0' } }, r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch(e) { rej(e) } })
        }).on('error', rej)
    })
}

async function tokenPriceUsd(coinId) {
    const r = await fetchJson(`https://coins.llama.fi/prices/current/${coinId}`)
    return r?.coins?.[coinId]?.price || 0
}

async function harvest(position) {
    log(`Harvesting position ${position.id} (tokenId ${position.nftTokenId})`)

    const rpc = process.env.ALCHEMY_BASE_RPC || 'https://mainnet.base.org'
    const pk  = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
    if (!pk) throw new Error('No private key in env')

    const provider = new ethers.JsonRpcProvider(rpc, undefined, { batchMaxCount: 1 })
    const wallet   = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider)
    log(`  Agent EOA: ${wallet.address}`)

    const nftMgr = new ethers.Contract(AERO_NFT_MGR, NFT_MGR_ABI, wallet)
    const gauge  = new ethers.Contract(position.gaugeAddress, GAUGE_ABI, wallet)
    const usdcC  = new ethers.Contract(USDC,  ERC20_ABI, provider)
    const cbbtcC = new ethers.Contract(cbBTC, ERC20_ABI, provider)
    const aeroC  = new ethers.Contract(AERO_TOKEN, ERC20_ABI, provider)

    // Pre-check: pending AERO via gauge.earned (best signal of accrued rewards)
    let earnedAero = 0n
    try {
        earnedAero = await gauge.earned(wallet.address, position.nftTokenId)
        log(`  Pending AERO: ${ethers.formatUnits(earnedAero, 18)} AERO`)
    } catch (e) {
        warn(`gauge.earned failed (non-fatal): ${e.message}`)
    }

    const aeroPrice  = await tokenPriceUsd('coingecko:aerodrome-finance').catch(() => 0)
    const btcPrice   = await tokenPriceUsd('coingecko:bitcoin').catch(() => 0)
    const aeroUsd    = Number(ethers.formatUnits(earnedAero, 18)) * aeroPrice
    log(`  AERO ≈ $${aeroPrice.toFixed(4)} | Pending AERO USD: $${aeroUsd.toFixed(4)}`)

    if (!EXECUTE) {
        log('  DRY RUN — would execute:')
        log(`    1. gauge.getReward(${position.nftTokenId})     // claim AERO`)
        if (!AERO_ONLY) {
            log(`    2. gauge.withdraw(${position.nftTokenId})      // unstake NFT`)
            log(`    3. nftMgr.collect(${position.nftTokenId}, MAX, MAX)  // sweep fees`)
            log(`    4. nftMgr.approve(gauge, ${position.nftTokenId})     // re-approve`)
            log(`    5. gauge.deposit(${position.nftTokenId})        // re-stake`)
        }
        return { dry: true, pendingAeroUsd: aeroUsd }
    }

    const txs = []
    const balsBefore = {
        usdc:  await usdcC.balanceOf(wallet.address),
        cbbtc: await cbbtcC.balanceOf(wallet.address),
        aero:  await aeroC.balanceOf(wallet.address),
    }

    // 1. Claim AERO (can do while staked)
    log('  1/5 Claiming AERO from gauge...')
    const tx1 = await gauge.getReward(position.nftTokenId)
    const r1  = await tx1.wait(2)
    txs.push({ step: 'getReward', hash: r1.hash })
    log(`    tx: ${r1.hash}`)

    if (!AERO_ONLY) {
        // 2. Unstake
        log('  2/5 Unstaking NFT from gauge...')
        const tx2 = await gauge.withdraw(position.nftTokenId)
        const r2  = await tx2.wait(2)
        txs.push({ step: 'withdraw', hash: r2.hash })
        log(`    tx: ${r2.hash}`)

        // 3. Collect trading fees
        log('  3/5 Collecting trading fees...')
        const MAX_U128 = (1n << 128n) - 1n
        const tx3 = await nftMgr.collect({
            tokenId:    position.nftTokenId,
            recipient:  wallet.address,
            amount0Max: MAX_U128,
            amount1Max: MAX_U128,
        })
        const r3 = await tx3.wait(2)
        txs.push({ step: 'collect', hash: r3.hash })
        log(`    tx: ${r3.hash}`)

        // 4. Re-approve
        log('  4/5 Re-approving NFT for gauge...')
        const tx4 = await nftMgr.approve(position.gaugeAddress, position.nftTokenId)
        const r4  = await tx4.wait(2)
        txs.push({ step: 'approve', hash: r4.hash })

        // 5. Re-stake
        log('  5/5 Re-staking NFT in gauge...')
        const tx5 = await gauge.deposit(position.nftTokenId)
        const r5  = await tx5.wait(2)
        txs.push({ step: 'deposit', hash: r5.hash })
        log(`    tx: ${r5.hash}`)
    }

    // Compute realized harvest USD
    const balsAfter = {
        usdc:  await usdcC.balanceOf(wallet.address),
        cbbtc: await cbbtcC.balanceOf(wallet.address),
        aero:  await aeroC.balanceOf(wallet.address),
    }
    const deltaUsdc  = Number(balsAfter.usdc  - balsBefore.usdc)  / 1e6
    const deltaCbbtc = Number(balsAfter.cbbtc - balsBefore.cbbtc) / 1e8
    const deltaAero  = Number(balsAfter.aero  - balsBefore.aero)  / 1e18

    const usdcUsd  = deltaUsdc
    const cbbtcUsd = deltaCbbtc * btcPrice
    const aeroRealizedUsd = deltaAero * aeroPrice
    const totalUsd = usdcUsd + cbbtcUsd + aeroRealizedUsd

    log(`  Realized: $${usdcUsd.toFixed(4)} USDC + $${cbbtcUsd.toFixed(4)} cbBTC + $${aeroRealizedUsd.toFixed(4)} AERO = $${totalUsd.toFixed(4)}`)

    return { txs, deltaUsdc, deltaCbbtc, deltaAero, usdcUsd, cbbtcUsd, aeroRealizedUsd, totalUsd }
}

function updateStateAfterHarvest(positionId, result) {
    const store = JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8'))
    const pos = store.positions.find(p => p.id === positionId)
    if (!pos) return
    pos.lastClaimAt    = new Date().toISOString()
    pos.pendingFeesUsd = 0
    pos.lastHarvestUsd = result.totalUsd
    pos.lifetimeFeesUsd = (pos.lifetimeFeesUsd || 0) + result.totalUsd
    pos.harvestCount   = (pos.harvestCount || 0) + 1
    store.updatedAt = new Date().toISOString()
    fs.writeFileSync(POSITIONS_PATH, JSON.stringify(store, null, 2))

    // Append to harvest log
    let logStore = { entries: [] }
    if (fs.existsSync(HARVEST_LOG)) logStore = JSON.parse(fs.readFileSync(HARVEST_LOG, 'utf8'))
    logStore.entries.unshift({ positionId, at: new Date().toISOString(), ...result })
    logStore.entries = logStore.entries.slice(0, 200)
    fs.writeFileSync(HARVEST_LOG, JSON.stringify(logStore, null, 2))
}

async function main() {
    log(`Starting harvest — mode: ${EXECUTE ? 'LIVE' : 'DRY RUN'}${AERO_ONLY ? ' (AERO ONLY)' : ''}`)
    const store = JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8'))
    let positions = store.positions.filter(p =>
        p.status === 'open' &&
        p.project === 'aerodrome-slipstream' &&
        p.nftTokenId &&
        p.gaugeAddress
    )
    if (POSITION_ARG) positions = positions.filter(p => p.id === POSITION_ARG)
    if (!positions.length) { log('No harvestable positions'); process.exit(0) }

    for (const position of positions) {
        try {
            const result = await harvest(position)
            if (EXECUTE && !result.dry) {
                updateStateAfterHarvest(position.id, result)
                sendTelegram(
                    `💰 <b>[LP_HARVEST]</b> ${position.symbol}\n` +
                    `USDC: $${result.usdcUsd.toFixed(4)} | cbBTC: $${result.cbbtcUsd.toFixed(4)} | AERO: $${result.aeroRealizedUsd.toFixed(4)}\n` +
                    `Total: <b>$${result.totalUsd.toFixed(4)}</b>\n` +
                    `Txs: ${result.txs.length} | <a href="https://basescan.org/tx/${result.txs[0].hash}">first tx</a>`
                )
            }
        } catch (e) {
            warn(`Harvest failed for ${position.id}: ${e.shortMessage || e.message}`)
            sendTelegram(`❌ <b>[LP_HARVEST]</b> ${position.symbol} failed: ${e.shortMessage || e.message}`)
        }
    }
    log('Done.')
}

main().catch(err => {
    console.error('[harvest] Fatal:', err.message)
    sendTelegram(`💥 [LP_HARVEST] Fatal: ${err.message}`)
    process.exit(1)
})
