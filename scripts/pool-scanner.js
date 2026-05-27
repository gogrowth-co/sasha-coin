#!/usr/bin/env node
/**
 * pool-scanner.js — Continuous LP pool discovery and ranking
 *
 * Scans DefiLlama yields API for top LP pools across Base and Solana,
 * scores them by tier, and writes ranked candidates to content/lp-candidates.json.
 * Plugs into the signal pipeline as an enhanced Source B (onchain APR data).
 *
 * Three risk tiers:
 *   Tier 1 — Low:    Stable/Stable  (USDC/USDT, USDC/DAI, etc.)
 *   Tier 2 — Medium: Stable/Bluechip (WETH/USDC, cbBTC/USDC, SOL/USDC)
 *   Tier 3 — High:   Altcoin/Bluechip (AERO/WETH, BRETT/ETH, etc.)
 *
 * Scoring formula:
 *   score = fee_apy * (1 - emission_dependency) * tvl_weight / il_risk
 *
 * Usage:
 *   node scripts/pool-scanner.js                   # scan + write candidates
 *   node scripts/pool-scanner.js --dry-run         # print results, no file write
 *   node scripts/pool-scanner.js --chain base      # Base only
 *   node scripts/pool-scanner.js --chain solana    # Solana only
 *   node scripts/pool-scanner.js --tier 2          # Tier 2 only
 *   node scripts/pool-scanner.js --top 5           # top N per tier
 *
 * Sasha Coin — Liquidity Miner v1
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const CHAIN_ARG = (() => { const i = args.indexOf('--chain'); return i !== -1 ? args[i+1] : 'all' })()
const TIER_ARG  = (() => { const i = args.indexOf('--tier');  return i !== -1 ? parseInt(args[i+1]) : 0 })()
const TOP_N     = (() => { const i = args.indexOf('--top');   return i !== -1 ? parseInt(args[i+1]) : 5 })()

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
    minTvlUsd: 500_000,
    minFeeApr: 2,
    maxEmissionDependency: 0.80,
    chains: ['base', 'solana'],
    outputPath: path.join(WORKSPACE, 'content', 'lp-candidates.json'),
    signalPath:  path.join(WORKSPACE, 'content', 'mantle-signal.json'),
    bluechips: new Set(['WETH', 'ETH', 'CBBTC', 'WBTC', 'BTC', 'SOL', 'WSOL', 'WSTETH', 'STETH']),
    stables:   new Set(['USDC', 'USDT', 'DAI', 'FRAX', 'EURC', 'CRVUSD', 'LUSD', 'PYUSD', 'SYRUPUSDC', 'MSUSDC', 'MSUSDT', 'USDB', 'USDE']),
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'sasha-pool-scanner/1.0' } }, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try { resolve(JSON.parse(data)) }
                catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)) }
            })
        })
        req.on('error', reject)
        req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
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
    const req = https.request(options)
    req.on('error', () => {})
    req.write(body)
    req.end()
}

// ─── Pool Classification ──────────────────────────────────────────────────────

function classifyPool(symbol) {
    const tokens = symbol.toUpperCase().replace(/-/g, '/').split('/')
    const isStable   = t => Array.from(CONFIG.stables).some(s => t.includes(s))
    const isBluechip = t => Array.from(CONFIG.bluechips).some(b => t.includes(b))

    const allStable   = tokens.every(t => isStable(t))
    const hasStable   = tokens.some(t => isStable(t))
    const hasBluechip = tokens.some(t => isBluechip(t))
    const allKnown    = tokens.every(t => isStable(t) || isBluechip(t))

    if (allStable)                 return 1
    if (hasStable && hasBluechip)  return 2
    if (hasBluechip && !hasStable) return 3
    if (!allKnown)                 return 3
    return 2
}

function emissionDependency(pool) {
    const total = pool.apy || 0
    if (total <= 0) return 1
    return (pool.apyReward || 0) / total
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scorePool(pool, tier) {
    const feeApr        = pool.apyBase || 0
    const totalApy      = pool.apy || 0
    const rewardApr     = pool.apyReward || Math.max(0, totalApy - feeApr)
    const tvl           = pool.tvlUsd || 0
    const emDep         = emissionDependency(pool)
    const organicFactor = 1 - emDep * 0.5
    const tvlWeight     = Math.min(1, Math.log10(tvl / 100_000) / 3)

    // Risk-adjusted NET CARRY (Phase-0 sim finding): a delta-neutral LP is a short-gamma
    // carry — it earns fees+rewards and PAYS the pair's IL/LVR. Rank by carry that
    // survives convexity cost, not raw fee APR. ilDragApr is an annualized LVR proxy by
    // volatility class; a high-fee Tier-3 pool can now score BELOW a modest Tier-1 once
    // its IL is netted out. That is the point — it stops the scorer chasing yield into IL.
    const ilDragApr   = [0, 12, 35][tier - 1]              // stable/stable ~0, stable/bluechip, alt/bluechip
    const execRisk    = [1.00, 0.92, 0.78][tier - 1]       // depeg / rug / thin-liquidity haircut
    const grossCarry  = (feeApr + rewardApr) * organicFactor
    const netCarryApr = grossCarry - ilDragApr
    const score       = Math.max(0, netCarryApr) * execRisk * tvlWeight

    return {
        score:        Math.round(score * 100) / 100,
        feeApr:       Math.round(feeApr * 10) / 10,
        totalApy:     Math.round(totalApy * 10) / 10,
        netCarryApr:  Math.round(netCarryApr * 10) / 10,
        ilDragApr,
        emissionDep:  Math.round(emDep * 100),
        tvlUsd:       Math.round(tvl),
        organicFactor: Math.round(organicFactor * 100) / 100,
    }
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────

async function scanPools() {
    console.log('[pool-scanner] Fetching DefiLlama yields data...')
    const data = await fetchJson('https://yields.llama.fi/pools')
    const allPools = data.data || []
    console.log(`[pool-scanner] Total pools in dataset: ${allPools.length}`)

    const targetChains = CHAIN_ARG === 'all' ? CONFIG.chains : [CHAIN_ARG]

    const filtered = allPools.filter(p => {
        const chain = (p.chain || '').toLowerCase()
        if (!targetChains.includes(chain)) return false
        if ((p.tvlUsd || 0) < CONFIG.minTvlUsd) return false
        if ((p.apyBase || 0) < CONFIG.minFeeApr) return false
        if ((p.apy || 0) <= 0) return false
        // Emission-mirage filter (execution-spec §7): fee APR must be >= 10% of total APY.
        // Kills pure-emission micro-cap pools whose 4-digit APY is a reward subsidy that
        // collapses (this is what produced the Goblin/USDC -15% loss). No fee base = no edge.
        if ((p.apyBase || 0) / (p.apy || 1) < 0.10) return false
        return true
    })

    console.log(`[pool-scanner] Pools after filters: ${filtered.length}`)

    const scored = filtered.map(p => {
        const tier  = classifyPool(p.symbol || '')
        const score = scorePool(p, tier)
        return { poolId: p.pool, project: p.project, symbol: p.symbol, chain: (p.chain || '').toLowerCase(), tier, ...score }
    })

    const byTier = { 1: [], 2: [], 3: [] }
    scored.forEach(p => {
        if (TIER_ARG && p.tier !== TIER_ARG) return
        byTier[p.tier].push(p)
    })

    const topPools = {}
    for (const tier of [1, 2, 3]) {
        topPools[tier] = byTier[tier].sort((a, b) => b.score - a.score).slice(0, TOP_N)
    }

    return topPools
}

// ─── Output ───────────────────────────────────────────────────────────────────

function formatOutput(topPools) {
    const flat = [...topPools[1], ...topPools[2], ...topPools[3]]
    // bestOverall drives the default recommendation — constrain to Tier 1-2 only.
    // Tier 3 (alt/bluechip) is $0 in v1 per execution-spec §5.2; never auto-recommend it,
    // even when its raw score is high (micro-cap "fee APR" is usually a point-in-time mirage).
    const tradeable = [...topPools[1], ...topPools[2]].sort((a, b) => b.score - a.score)
    return {
        generatedAt: new Date().toISOString(),
        scanConfig: { chains: CHAIN_ARG, minTvlUsd: CONFIG.minTvlUsd, minFeeApr: CONFIG.minFeeApr, topNPerTier: TOP_N },
        summary: {
            tier1Count: topPools[1].length,
            tier2Count: topPools[2].length,
            tier3Count: topPools[3].length,
            bestOverall: tradeable[0] || null,
            note: 'bestOverall is Tier 1-2 only; Tier 3 listed for awareness, not auto-traded (spec §5.2).',
        },
        tier1: topPools[1],
        tier2: topPools[2],
        tier3: topPools[3],
    }
}

function printResults(output) {
    const tierNames = { 1: '🟢 Tier 1 (Stable/Stable)', 2: '🟡 Tier 2 (Stable/Bluechip)', 3: '🔴 Tier 3 (Altcoin/Bluechip)' }
    for (const tier of [1, 2, 3]) {
        const pools = output[`tier${tier}`]
        if (!pools.length) continue
        console.log(`\n${tierNames[tier]}`)
        console.log('─'.repeat(90))
        console.log(`${'Project'.padEnd(25)} ${'Symbol'.padEnd(30)} ${'Chain'.padEnd(8)} ${'Score'.padEnd(8)} ${'FeeAPR'.padEnd(10)} ${'TotalAPY'.padEnd(10)} ${'EmDep%'.padEnd(8)} TVL`)
        pools.forEach(p => {
            console.log(
                p.project.padEnd(25) + p.symbol.padEnd(30) + p.chain.padEnd(8) +
                String(p.score).padEnd(8) + `${p.feeApr}%`.padEnd(10) +
                `${p.totalApy}%`.padEnd(10) + `${p.emissionDep}%`.padEnd(8) +
                `$${(p.tvlUsd/1e6).toFixed(1)}M`
            )
        })
    }
    if (output.summary.bestOverall) {
        const b = output.summary.bestOverall
        console.log(`\n🏆 Best overall: ${b.project} ${b.symbol} on ${b.chain} — Score ${b.score}, FeeAPR ${b.feeApr}%, TVL $${(b.tvlUsd/1e6).toFixed(1)}M`)
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`[pool-scanner] Starting scan — chains: ${CHAIN_ARG}, tier: ${TIER_ARG || 'all'}, top: ${TOP_N}`)

    let topPools
    try {
        topPools = await scanPools()
    } catch (e) {
        console.error(`[pool-scanner] Scan failed: ${e.message}`)
        sendTelegram(`❌ [POOL_SCANNER] Scan failed: ${e.message}`)
        process.exit(1)
    }

    const output = formatOutput(topPools)
    printResults(output)

    if (!DRY_RUN) {
        fs.mkdirSync(path.dirname(CONFIG.outputPath), { recursive: true })
        fs.writeFileSync(CONFIG.outputPath, JSON.stringify(output, null, 2))
        console.log(`\n[pool-scanner] Candidates written to ${CONFIG.outputPath}`)

        if (fs.existsSync(CONFIG.signalPath)) {
            try {
                const signal = JSON.parse(fs.readFileSync(CONFIG.signalPath, 'utf8'))
                signal.lpCandidates = output.summary
                signal.lpCandidatesUpdatedAt = new Date().toISOString()
                fs.writeFileSync(CONFIG.signalPath, JSON.stringify(signal, null, 2))
                console.log('[pool-scanner] Patched mantle-signal.json with LP candidates')
            } catch (e) {
                console.warn(`[pool-scanner] Could not patch signal: ${e.message}`)
            }
        }

        const best = output.summary.bestOverall
        if (best) {
            sendTelegram(
                `📊 <b>[POOL_SCANNER]</b> Scan complete\n` +
                `🏆 Best: ${best.project} ${best.symbol} (${best.chain})\n` +
                `FeeAPR: ${best.feeApr}% | EmDep: ${best.emissionDep}% | TVL: $${(best.tvlUsd/1e6).toFixed(1)}M\n` +
                `T1: ${output.summary.tier1Count} | T2: ${output.summary.tier2Count} | T3: ${output.summary.tier3Count} candidates`
            )
        }
    } else {
        console.log('\n[pool-scanner] --dry-run: no files written')
    }
}

main().catch(err => {
    console.error('[pool-scanner] Fatal:', err.message)
    sendTelegram(`💥 [POOL_SCANNER] Fatal error: ${err.message}`)
    process.exit(1)
})
