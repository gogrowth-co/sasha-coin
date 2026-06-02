#!/usr/bin/env node
/**
 * mantle-signal.js — Five-source signal fusion pipeline
 *
 * Fuses five signal sources into a structured trading recommendation.
 * Signal weights (from winning-thesis.md §6):
 *
 *   Source A: Sasha's X posts (social/narrative bias)   — 25%
 *   Source B: Byreal pool data (on-chain APR, TVL)       — 20%
 *   Source C: Allora inference (reputation-weighted AI)  — 25%
 *   Source D: Elfa AI smart mentions (social alpha)      — 15%
 *   Source E: Polymarket implied odds (prediction mkts)  — 15%
 *
 * Usage:
 *   node scripts/mantle-signal.js                         # generate + write to content/mantle-signal.json
 *   node scripts/mantle-signal.js --dry-run               # print JSON, no file write
 *   node scripts/mantle-signal.js --source social-only    # skip external signals
 *   node scripts/mantle-signal.js --source onchain-only   # byreal pools only
 *   node scripts/mantle-signal.js --source allora-only    # Allora signal test
 *   node scripts/mantle-signal.js --source elfa-only      # Elfa signal test
 *   node scripts/mantle-signal.js --source polymarket-only # Polymarket test
 *
 * Requires: OPENROUTER_API_KEY (social LLM), ALLORA_API_KEY, ELFA_API_KEY
 * Polymarket: no auth required.
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const DRY_RUN    = args.includes('--dry-run')
const SOURCE     = (() => { const i = args.indexOf('--source'); return i !== -1 ? args[i+1] : 'all' })()
const OUTPUT_PATH = (() => { const i = args.indexOf('--output'); return i !== -1 ? args[i+1] : path.join(WORKSPACE, 'content', 'mantle-signal.json') })()

// ---------------------------------------------------------------------------
// Signal weights (must sum to 1.0)
// ---------------------------------------------------------------------------
const WEIGHTS = {
    social:      0.25,
    onchain:     0.20,
    allora:      0.25,
    elfa:        0.15,
    polymarket:  0.15,
}

// ---------------------------------------------------------------------------
// Source A: Social signal (Sasha's recent X posts)
// ---------------------------------------------------------------------------

function readRecentPosts(count = 5) {
    const logPath = path.join(WORKSPACE, 'state', 'posted-log.json')
    if (!fs.existsSync(logPath)) {
        console.warn('[signal] posted-log.json not found — using empty social signal')
        return []
    }
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'))
    // Take ALL recent posts — replies, originals, and handle-based posts.
    // Schema note: field is "tweet_text" for most entries; older entries use
    // "text", "replyText", or "content". Date field is "posted_at".
    return log
        .slice(-count)
        .map(e => e.tweet_text || e.replyText || e.text || e.content || '')
        .filter(Boolean)
}

async function deriveSocialBias(posts) {
    if (!posts.length) {
        return {
            riskAppetite: 'neutral',
            defiSentiment: 'neutral',
            tokens: { SOL: 'neutral', USDC: 'neutral', mETH: 'neutral', MNT: 'neutral' },
            reasoning: 'No recent posts available — defaulting to neutral bias.',
            confidence: 0.3,
            sourcePosts: [],
        }
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
        console.warn('[signal] No LLM API key — using rule-based bias extraction')
        return ruleBasedBias(posts)
    }

    const isOpenRouter = !!process.env.OPENROUTER_API_KEY
    const apiBase = isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
    const model   = isOpenRouter ? 'google/gemini-2.5-flash' : 'gpt-4o-mini'

    const systemPrompt = `You are analyzing an AI agent's recent social media posts to extract her current market bias.
Return ONLY a JSON object with no markdown. Schema:
{
  "riskAppetite": "risk-on" | "risk-off" | "neutral",
  "defiSentiment": "bullish" | "bearish" | "neutral",
  "tokens": { "SOL": "bullish|bearish|neutral", "USDC": "bullish|bearish|neutral", "mETH": "bullish|bearish|neutral", "MNT": "bullish|bearish|neutral" },
  "reasoning": "1-2 sentences explaining the bias",
  "confidence": 0.0-1.0
}`

    const userPrompt = `Analyze these recent posts from AI DeFi agent Sasha Coin and extract her market bias:\n\n${posts.map((p, i) => `${i + 1}. "${p}"`).join('\n')}`

    try {
        const response = await llmCall(apiBase, apiKey, model, systemPrompt, userPrompt, isOpenRouter)
        const parsed = JSON.parse(response)
        return { ...parsed, sourcePosts: posts }
    } catch (e) {
        console.warn(`[signal] LLM bias extraction failed: ${e.message} — falling back to rule-based`)
        return ruleBasedBias(posts)
    }
}

function ruleBasedBias(posts) {
    const text = posts.join(' ').toLowerCase()
    const bullishWords = ['opportunity', 'yield', 'growth', 'staking', 'liquidity', 'bullish', 'up', 'gain', 'apy', 'reward']
    const bearishWords = ['risk', 'caution', 'volatile', 'down', 'loss', 'careful', 'hack', 'exploit', 'scam', 'rug']

    let score = 0
    bullishWords.forEach(w => { if (text.includes(w)) score++ })
    bearishWords.forEach(w => { if (text.includes(w)) score-- })

    const sentiment = score > 1 ? 'bullish' : score < -1 ? 'bearish' : 'neutral'
    return {
        riskAppetite: score > 0 ? 'risk-on' : score < 0 ? 'risk-off' : 'neutral',
        defiSentiment: sentiment,
        tokens: { SOL: sentiment, USDC: 'neutral', mETH: sentiment, MNT: 'neutral' },
        reasoning: `Rule-based extraction from ${posts.length} posts (score: ${score}).`,
        confidence: 0.4,
        sourcePosts: posts,
    }
}

// ---------------------------------------------------------------------------
// Source B: Byreal pool data (on-chain via byreal-cli)
//
// Mirrors the LP miner's 3-tier risk classification (scripts/pool-scanner.js):
//   Tier 1 (low):    stable/stable                  (e.g. USDC/USDT)
//   Tier 2 (medium): stable/bluechip, blue/blue     (e.g. SOL/USDC, mSOL/SOL)
//   Tier 3 (high):   bluechip/altcoin, alt/alt      (e.g. SOL/JUP, JTO/USDC)
//
// Memes are NOT a separate tier — they are filtered out by TVL + volume floors.
//
// Hackathon-grade risk dimensions stacked on top of the tier system:
//   1. Tier classification + TVL floor (kills micro-cap memes)
//   2. Emission dependency penalty (pools where >50% APY is rewards score worse)
//   3. Pool blacklist (state/pool-blacklist.json — auto-fed by losing closes)
//   4. 3-day rolling vol/tvl (state/pool-history.json — catches volume spikes)
//   5. Break-even days vs. max IL (rejects pools where IL won't be repaid <14d)
//
// All checks surface in signalBreakdown.onchain so the pre-trade tweet can cite
// the rejection reason. Every gate is configurable via env.
//
// Quality floors (configurable via env):
//   BYREAL_MIN_TVL_USD       default 50_000  — pool TVL floor
//   BYREAL_MIN_FEE_APR       default 2       — fee-APR floor (organic yield)
//   BYREAL_MIN_VOL_TVL       default 0.05    — daily volume / TVL (5% turnover)
//   BYREAL_MIN_VOL_TVL_3D    default 0.05    — 3-day average volume / TVL
//   BYREAL_MAX_EM_DEP        default 0.50    — max emission dependency (0-1)
//   BYREAL_MAX_BREAKEVEN_D   default 30      — max days for fees to offset expected IL
// ---------------------------------------------------------------------------

const BYREAL_STABLES   = new Set(['USDC', 'USDT', 'DAI', 'USDS', 'PYUSD', 'FDUSD', 'USDB', 'USDE'])
const BYREAL_BLUECHIPS = new Set(['SOL', 'WSOL', 'MSOL', 'JITOSOL', 'BSOL', 'WBTC', 'CBBTC', 'ETH', 'WETH'])

// Expected impermanent loss over a typical 30-day hold (NOT worst case).
// These are calibrated to historical realized IL for ±25% range CL positions
// during normal market conditions. Worst-case IL is 3-4× these values but
// rarely materializes because positions rebalance on out-of-range alerts.
//   Tier 1 stables:  ~0.5% expected IL (depeg drift, ~1% in stress)
//   Tier 2 stable/blue: ~2% expected IL (normal SOL/USDC swings)
//   Tier 3 blue/alt:   ~5% expected IL (alt volatility)
const TIER_MAX_IL_PCT = { 1: 0.5, 2: 2.0, 3: 5.0 }

const POOL_BLACKLIST_PATH = path.join(WORKSPACE, 'state', 'pool-blacklist.json')
const POOL_HISTORY_PATH   = path.join(WORKSPACE, 'state', 'pool-history.json')

function classifyByrealPool(tokenA, tokenB) {
    const a = (tokenA || '').toUpperCase()
    const b = (tokenB || '').toUpperCase()
    const isStable   = t => BYREAL_STABLES.has(t)
    const isBluechip = t => BYREAL_BLUECHIPS.has(t)

    if (isStable(a) && isStable(b))                                  return 1
    if ((isStable(a) && isBluechip(b)) || (isBluechip(a) && isStable(b))) return 2
    if (isBluechip(a) && isBluechip(b))                              return 2
    // Anything else (bluechip/altcoin, altcoin/altcoin, or with unknowns)
    return 3
}

function emissionDependency(pool) {
    // pool.feeApr = real swap-fee yield. pool.apr24h = total APR (fees + rewards).
    // emDep = rewards portion of total APR. If feeApr is missing, assume worst case.
    const total = pool.apr24h || 0
    if (total <= 0) return 1
    const fee = pool.feeApr ?? 0  // if feeApr missing, treat as non-organic (worst case, per intent above)
    const rewards = Math.max(0, total - fee)
    return Math.min(1, rewards / total)
}

function breakEvenDays(pool, tier, assumedPositionUsd = 20) {
    // dailyFee = APR/365 × position
    // maxLossUsd = position × TIER_MAX_IL_PCT/100
    // breakEvenDays = maxLossUsd / dailyFee
    const apr = pool.apr24h || 0
    const dailyFeeUsd = (apr / 365 / 100) * assumedPositionUsd
    if (dailyFeeUsd <= 0) return Infinity
    const maxILPct = TIER_MAX_IL_PCT[tier] || 15
    const maxLossUsd = assumedPositionUsd * (maxILPct / 100)
    return maxLossUsd / dailyFeeUsd
}

function scoreByrealPool(pool, tier) {
    const tvlWeight   = Math.min(1, Math.log10(Math.max(pool.tvl, 1) / 10_000) / 2)
    const tierPenalty = [1.0, 0.85, 0.60][tier - 1] || 0   // matches scripts/pool-scanner.js
    const emDep       = emissionDependency(pool)
    const emFactor    = 1 - emDep * 0.5                     // 0.5 penalty when fully emissions-driven
    return pool.apr24h * tierPenalty * Math.max(0, tvlWeight) * emFactor
}

function loadBlacklist() {
    try {
        if (!fs.existsSync(POOL_BLACKLIST_PATH)) return { entries: [] }
        const raw = JSON.parse(fs.readFileSync(POOL_BLACKLIST_PATH, 'utf8'))
        // Auto-expire entries older than 30 days
        const cutoff = Date.now() - 30 * 24 * 3600 * 1000
        const live = (raw.entries || []).filter(e => new Date(e.bannedAt).getTime() > cutoff)
        return { ...raw, entries: live }
    } catch (e) { return { entries: [] } }
}

function loadPoolHistory() {
    try {
        if (!fs.existsSync(POOL_HISTORY_PATH)) return { pools: {} }
        return JSON.parse(fs.readFileSync(POOL_HISTORY_PATH, 'utf8'))
    } catch (e) { return { pools: {} } }
}

function updatePoolHistory(enrichedPools) {
    try {
        const history = loadPoolHistory()
        const now = new Date().toISOString()
        const cutoffMs = Date.now() - 7 * 24 * 3600 * 1000   // keep 7 days of snapshots
        for (const p of enrichedPools) {
            if (!p.address) continue
            const entry = history.pools[p.address] || { name: p.name, snapshots: [] }
            entry.snapshots = (entry.snapshots || []).filter(s => new Date(s.at).getTime() > cutoffMs)
            entry.snapshots.push({ at: now, tvl: p.tvl, volume24h: p.volume24h, apr24h: p.apr24h })
            history.pools[p.address] = entry
        }
        history.updatedAt = now
        fs.mkdirSync(path.dirname(POOL_HISTORY_PATH), { recursive: true })
        fs.writeFileSync(POOL_HISTORY_PATH, JSON.stringify(history, null, 2))
    } catch (e) { console.warn(`[signal] pool history update failed: ${e.message}`) }
}

function rollingVolToTvl(history, poolAddress, days = 3) {
    const entry = history.pools[poolAddress]
    if (!entry || !entry.snapshots?.length) return null
    const cutoffMs = Date.now() - days * 24 * 3600 * 1000
    const recent = entry.snapshots.filter(s => new Date(s.at).getTime() > cutoffMs)
    if (!recent.length) return null
    const totalVol = recent.reduce((sum, s) => sum + (s.volume24h || 0), 0)
    const totalTvl = recent.reduce((sum, s) => sum + (s.tvl || 0), 0)
    return totalTvl > 0 ? totalVol / totalTvl : null
}

function fetchByrealPoolData() {
    try {
        const raw = execSync('byreal-cli pools list --sort-field apr24h --page-size 50 -o json 2>/dev/null', {
            timeout: 60000,   // bumped from 30s: byreal pools list (page-size 50) can exceed 30s under RPC load
            encoding: 'utf8',
        })
        const data = JSON.parse(raw)
        const poolsRaw = Array.isArray(data) ? data : (data.data?.pools || data.pools || data.data || [])
        if (!poolsRaw.length) return null

        const minTvl       = parseFloat(process.env.BYREAL_MIN_TVL_USD || '50000')
        const minFeeApr    = parseFloat(process.env.BYREAL_MIN_FEE_APR || '2')
        const minVolToTvl  = parseFloat(process.env.BYREAL_MIN_VOL_TVL || '0.05')
        const minVolToTvl3d = parseFloat(process.env.BYREAL_MIN_VOL_TVL_3D || '0.05')
        const maxEmDep     = parseFloat(process.env.BYREAL_MAX_EM_DEP || '0.50')
        const maxBreakEvenD = parseFloat(process.env.BYREAL_MAX_BREAKEVEN_D || '30')

        const blacklist = loadBlacklist()
        const blockedAddrs = new Set(blacklist.entries.map(e => e.poolAddress))

        const poolNorm = (p) => ({
            name:     p.pair || p.name || p.pool_name || 'Unknown',
            address:  p.id || p.address || p.pool_address,
            apr24h:   p.total_apr || p.apr || p.apr24h || p.apr_24h || 0,
            feeApr:   (() => {
                // byreal-cli omits feeApr; derive organic fee yield from its breakout fields.
                if (p.fee_apr != null) return p.fee_apr
                if (p.feeApr  != null) return p.feeApr
                if (p.total_apr != null && p.reward_apr != null) return p.total_apr - p.reward_apr
                if (p.fee_24h_usd != null && p.tvl_usd > 0)       return (p.fee_24h_usd * 365 / p.tvl_usd) * 100
                return null
            })(),    // organic fee yield only (total_apr - reward_apr; emissions excluded)
            tvl:      p.tvl_usd || p.tvl || 0,
            volume24h: p.volume_24h_usd || p.volume24h || p.volume_24h || 0,
            tokenA:   p.token_a?.symbol || p.tokenA?.symbol || '?',
            tokenB:   p.token_b?.symbol || p.tokenB?.symbol || '?',
        })

        const history = loadPoolHistory()

        const enriched = poolsRaw.map(p => {
            const n = poolNorm(p)
            const tier = classifyByrealPool(n.tokenA, n.tokenB)
            const volToTvl = n.tvl > 0 ? n.volume24h / n.tvl : 0
            const volToTvl3d = rollingVolToTvl(history, n.address, 3)
            const emDep = emissionDependency(n)
            const breakEvenD = breakEvenDays(n, tier)
            const qualityScore = scoreByrealPool(n, tier)
            return { ...n, tier, volToTvl, volToTvl3d, emDep, breakEvenD, qualityScore }
        })

        // Refresh history with current snapshot (do this after enriching so we can read pre-update history)
        updatePoolHistory(enriched)

        const cfg = { minTvl, minFeeApr, minVolToTvl, minVolToTvl3d, maxEmDep, maxBreakEvenD }

        const eligible = enriched.filter(p => !rejectReason(p, cfg, blockedAddrs))

        eligible.sort((a, b) => b.qualityScore - a.qualityScore)
        const topPool = eligible[0] || null

        // SOL/USDC explicit pick (used for risk-off rotation regardless of eligibility)
        const solUsdc = enriched.find(p =>
            (p.tokenA.toUpperCase() === 'SOL' && p.tokenB.toUpperCase() === 'USDC') ||
            (p.tokenA.toUpperCase() === 'USDC' && p.tokenB.toUpperCase() === 'SOL')
        ) || enriched.find(p => {
            const name = (p.name || '').toUpperCase()
            return name.includes('SOL') && name.includes('USDC')
        })

        // Track what was excluded — return the highest-APR rejected pool so the
        // rationale tweet can explain "we passed on X because Y".
        const rawTop = [...enriched].sort((a, b) => b.apr24h - a.apr24h)[0]
        const excludedTop = (rawTop && (!topPool || rawTop.address !== topPool.address))
            ? {
                name: rawTop.name, apr24h: rawTop.apr24h, tvl: rawTop.tvl, tier: rawTop.tier,
                volToTvl: rawTop.volToTvl, emDep: rawTop.emDep, breakEvenD: rawTop.breakEvenD,
                reason: rejectReason(rawTop, cfg, blockedAddrs),
            }
            : null

        return {
            topPool,
            solUsdcPool: solUsdc || null,
            excludedTop,
            qualityFilter: { ...cfg, eligibleCount: eligible.length, tierCounts: tierCounts(eligible), blacklistSize: blacklist.entries.length },
            totalPools: poolsRaw.length,
            fetchedAt: new Date().toISOString(),
        }
    } catch (e) {
        console.warn(`[signal] Byreal pool fetch failed: ${e.message}`)
        return null
    }
}

function tierCounts(pools) {
    return { t1: pools.filter(p => p.tier === 1).length, t2: pools.filter(p => p.tier === 2).length, t3: pools.filter(p => p.tier === 3).length }
}

function rejectReason(p, cfg, blockedAddrs) {
    if (blockedAddrs && blockedAddrs.has(p.address)) return 'blacklisted (recent loss or known bad pool)'
    if (p.tvl < cfg.minTvl) return `TVL $${p.tvl.toFixed(0)} < $${cfg.minTvl}`
    if (p.feeApr == null) return `feeApr unknown (non-organic, fail-safe skip)`
    if (p.feeApr < cfg.minFeeApr) return `feeApr ${p.feeApr.toFixed(2)}% < ${cfg.minFeeApr}% (organic floor)`
    if (p.volToTvl < cfg.minVolToTvl) return `vol/tvl ${p.volToTvl.toFixed(3)} < ${cfg.minVolToTvl}`
    // 3-day rolling vol — only enforce if we have history (won't reject first-ever sighting)
    if (p.volToTvl3d !== null && p.volToTvl3d !== undefined && p.volToTvl3d < cfg.minVolToTvl3d) {
        return `3-day vol/tvl ${p.volToTvl3d.toFixed(3)} < ${cfg.minVolToTvl3d}`
    }
    if (p.emDep > cfg.maxEmDep) return `emissions-dependent: ${(p.emDep * 100).toFixed(0)}% of APR is rewards > ${cfg.maxEmDep * 100}%`
    if (p.breakEvenD > cfg.maxBreakEvenD) return `IL break-even ${p.breakEvenD.toFixed(1)}d > ${cfg.maxBreakEvenD}d (fees too low for risk)`
    return null
}

// ---------------------------------------------------------------------------
// Source C: Allora Network inference (imported)
// ---------------------------------------------------------------------------

async function getAlloraSignalSafe() {
    try {
        const { getAlloraSignal } = await import('./signals/allora.js')
        return await getAlloraSignal()
    } catch (e) {
        console.warn(`[signal] Allora import/call failed: ${e.message}`)
        return { direction: 'neutral', confidence: 0.3, source: 'allora', note: e.message }
    }
}

// ---------------------------------------------------------------------------
// Source D: Elfa AI smart mentions (imported)
// ---------------------------------------------------------------------------

async function getElfaSignalSafe() {
    try {
        const { getElfaSignal } = await import('./signals/elfa.js')
        return await getElfaSignal()
    } catch (e) {
        console.warn(`[signal] Elfa import/call failed: ${e.message}`)
        return { sentimentDirection: 'neutral', confidence: 0.3, riskOffSignal: false, source: 'elfa', note: e.message }
    }
}

// ---------------------------------------------------------------------------
// Source E: Polymarket prediction markets (imported)
// ---------------------------------------------------------------------------

async function getPolymarketSignalSafe() {
    try {
        const { getPolymarketSignal } = await import('./signals/polymarket.js')
        return await getPolymarketSignal()
    } catch (e) {
        console.warn(`[signal] Polymarket import/call failed: ${e.message}`)
        return { directionalBias: 'neutral', confidence: 0.35, riskOffSignal: false, source: 'polymarket', note: e.message }
    }
}

// ---------------------------------------------------------------------------
// Signal fusion — five-source, weighted, deterministic, auditable
//
// Weights: social 25%, onchain 20%, allora 25%, elfa 15%, polymarket 15%
// ---------------------------------------------------------------------------

function fuseSignals(socialBias, poolData, alloraSignal, elfaSignal, polymarketSignal) {
    const allora   = alloraSignal   || { direction: 'neutral', confidence: 0.3 }
    const elfa     = elfaSignal     || { sentimentDirection: 'neutral', confidence: 0.3, riskOffSignal: false }
    const poly     = polymarketSignal || { directionalBias: 'neutral', confidence: 0.35, riskOffSignal: false }

    // ---- Hard risk-off override ----
    // If any risk signal fires, go defensive immediately regardless of other signals.
    const hardRiskOff = elfa.riskOffSignal || poly.riskOffSignal
    if (hardRiskOff) {
        const source = elfa.riskOffSignal ? 'Elfa risk-event detected' : 'Polymarket risk-event detected'
        return {
            action: 'MOVE_TO_STABLE',
            fromToken: 'SOL',
            toToken: 'USDC',
            amountPct: 50,
            poolAddress: poolData?.solUsdcPool?.address || null,
            rationale: `RISK-OFF OVERRIDE: ${source}. Rotating 50% to USDC immediately.`,
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: poolData ? `SOL/USDC APR: ${poolData.solUsdcPool?.apr24h?.toFixed(1) || 'N/A'}%` : 'No pool data',
            signalBreakdown: buildBreakdown(socialBias, poolData, allora, elfa, poly, 'RISK_OFF_OVERRIDE'),
        }
    }

    // ---- Weighted sentiment score ----
    // Each signal contributes a value in [-1, +1] × weight × confidence
    const dirToScore = (d) => d === 'bullish' || d === 'long' ? 1 : d === 'bearish' || d === 'short' ? -1 : 0

    const socialScore     = dirToScore(socialBias.defiSentiment) * WEIGHTS.social     * (socialBias.confidence || 0.5)
    const alloraScore     = dirToScore(allora.direction)         * WEIGHTS.allora     * (allora.confidence || 0.3)
    const elfaScore       = dirToScore(elfa.sentimentDirection)  * WEIGHTS.elfa       * (elfa.confidence || 0.3)
    const polyScore       = dirToScore(poly.directionalBias)     * WEIGHTS.polymarket * (poly.confidence || 0.35)

    // Onchain: APR > threshold = bullish signal with 30% weight
    // TVL threshold lowered to 1_000 for hackathon demo (small pool, small trade size)
    const onchainSentiment = poolData?.topPool?.apr24h > 50 && poolData?.topPool?.tvl > 1_000 ? 1 : 0
    const onchainScore     = onchainSentiment * WEIGHTS.onchain

    const totalScore = socialScore + alloraScore + elfaScore + polyScore + onchainScore
    const maxPossible = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) // 1.0 when all signals agree with high conf
    const normalizedScore = totalScore / maxPossible  // -1 to +1

    // Allora agreement check: if Allora disagrees by >30% with social bias, reduce conviction
    const alloraDisagrees = allora.direction !== 'neutral' &&
                            dirToScore(allora.direction) !== dirToScore(socialBias.defiSentiment) &&
                            (allora.confidence || 0) > 0.5

    const effectiveScore = alloraDisagrees ? normalizedScore * 0.6 : normalizedScore

    console.log(`[signal] Scores — social:${socialScore.toFixed(3)} allora:${alloraScore.toFixed(3)} elfa:${elfaScore.toFixed(3)} poly:${polyScore.toFixed(3)} onchain:${onchainScore.toFixed(3)} → weighted:${effectiveScore.toFixed(3)}${alloraDisagrees ? ' (Allora disagreement — reduced 40%)' : ''}`)

    const breakdown = buildBreakdown(socialBias, poolData, allora, elfa, poly, null)

    // ---- Decision rules ----
    if (effectiveScore < -0.15) {
        // Bearish consensus
        return {
            action: 'MOVE_TO_STABLE',
            fromToken: 'SOL',
            toToken: 'USDC',
            amountPct: 50,
            poolAddress: poolData?.solUsdcPool?.address || null,
            rationale: buildRationale('MOVE_TO_STABLE', effectiveScore, socialBias, allora, elfa, poly, alloraDisagrees),
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: poolData ? `SOL/USDC APR: ${poolData.solUsdcPool?.apr24h?.toFixed(1) || 'N/A'}%` : 'No pool data',
            signalBreakdown: breakdown,
        }
    }

    if (effectiveScore >= 0.19 && poolData?.topPool?.apr24h > 50 && poolData?.topPool?.tvl > 1_000) {
        // Bullish consensus + high-APR opportunity on-chain
        return {
            action: 'OPEN_LP_POSITION',
            fromToken: 'USDC',
            toToken: 'SOL',
            poolAddress: poolData.topPool.address,
            poolName: poolData.topPool.name,
            amountPct: 30,
            rationale: buildRationale('OPEN_LP_POSITION', effectiveScore, socialBias, allora, elfa, poly, alloraDisagrees, poolData.topPool),
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: `${poolData.topPool.name} APR: ${poolData.topPool.apr24h.toFixed(1)}%, TVL: $${(poolData.topPool.tvl / 1000).toFixed(0)}k`,
            signalBreakdown: breakdown,
        }
    }

    if (effectiveScore > 0.1 && socialBias.tokens?.SOL === 'bullish' && poolData?.solUsdcPool?.apr24h > 20) {
        // Moderate bullish — swap into SOL
        return {
            action: 'SWAP_TO_SOL',
            fromToken: 'USDC',
            toToken: 'SOL',
            amountPct: 20,
            poolAddress: poolData.solUsdcPool.address,
            rationale: buildRationale('SWAP_TO_SOL', effectiveScore, socialBias, allora, elfa, poly, alloraDisagrees),
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: `SOL/USDC APR: ${poolData.solUsdcPool.apr24h.toFixed(1)}%, TVL: $${((poolData.solUsdcPool.tvl || 0) / 1000).toFixed(0)}k`,
            signalBreakdown: breakdown,
        }
    }

    // Default: HOLD
    const topName = poolData?.topPool?.name || 'unknown'
    const topAPR  = poolData?.topPool?.apr24h?.toFixed(1) || 'N/A'
    return {
        action: 'HOLD',
        fromToken: null,
        toToken: null,
        amountPct: 0,
        poolAddress: null,
        rationale: buildRationale('HOLD', effectiveScore, socialBias, allora, elfa, poly, alloraDisagrees),
        socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
        onchainSnippet: poolData ? `Top pool ${topName}: APR ${topAPR}%, TVL $${((poolData.topPool?.tvl || 0) / 1000).toFixed(0)}k` : 'No pool data',
        signalBreakdown: breakdown,
    }
}

function buildBreakdown(socialBias, poolData, allora, elfa, poly, overrideReason) {
    return {
        weights: WEIGHTS,
        social:     { sentiment: socialBias.defiSentiment, riskAppetite: socialBias.riskAppetite, confidence: socialBias.confidence },
        onchain:    poolData ? {
            topPool: poolData.topPool ? {
                name: poolData.topPool.name,
                tier: poolData.topPool.tier,
                apr: poolData.topPool.apr24h,
                tvl: poolData.topPool.tvl,
                emDep: poolData.topPool.emDep,
                breakEvenD: poolData.topPool.breakEvenD,
                volToTvl3d: poolData.topPool.volToTvl3d,
            } : null,
            qualityFilter: poolData.qualityFilter,
            excludedTop: poolData.excludedTop,
        } : null,
        allora:     { direction: allora.direction, confidence: allora.confidence, agreement: allora.agreement },
        elfa:       { sentiment: elfa.sentimentDirection, riskOff: elfa.riskOffSignal, surging: elfa.surgingTickers },
        polymarket: { bias: poly.directionalBias, riskOff: poly.riskOffSignal, impliedBullish: poly.impliedBullishProb },
        overrideReason,
    }
}

function buildRationale(action, score, social, allora, elfa, poly, alloraDisagrees, topPool) {
    const parts = [
        `Weighted score: ${score.toFixed(3)}.`,
        `Social: ${social.defiSentiment} (${(social.confidence || 0).toFixed(2)}).`,
        `Allora: ${allora.direction} (${(allora.confidence || 0).toFixed(2)})${alloraDisagrees ? ' [disagrees — conviction reduced 40%]' : ''}.`,
        `Elfa: ${elfa.sentimentDirection || 'N/A'}, risk-off: ${elfa.riskOffSignal ? 'YES' : 'no'}.`,
        `Polymarket: ${poly.directionalBias}, implied bullish: ${poly.impliedBullishProb?.toFixed(2) ?? 'N/A'}.`,
    ]
    if (action === 'OPEN_LP_POSITION' && topPool) {
        parts.push(`Target: ${topPool.name} at ${topPool.apr24h?.toFixed(1)}% APR.`)
    }
    return parts.join(' ')
}

// ---------------------------------------------------------------------------
// LLM helper (shared by social bias extraction)
// ---------------------------------------------------------------------------

function llmCall(apiBase, apiKey, model, systemPrompt, userPrompt, isOpenRouter) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model,
            max_tokens: 512,
            temperature: 0.2,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        })

        const url = new URL(`${apiBase}/chat/completions`)
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(body),
                ...(isOpenRouter ? {
                    'HTTP-Referer': 'https://sashacoin.ai',
                    'X-Title': 'Sasha Coin - Mantle Hackathon',
                } : {}),
            },
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => { data += chunk })
            res.on('end', () => {
                try {
                    const json = JSON.parse(data)
                    const content = json.choices?.[0]?.message?.content
                    if (!content) throw new Error('Empty response from LLM')
                    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
                    resolve(cleaned)
                } catch (e) {
                    reject(new Error(`LLM parse error: ${e.message}\nRaw: ${data.slice(0, 200)}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(20000, () => { req.destroy(); reject(new Error('LLM request timeout')) })
        req.write(body)
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('[signal] === Five-Source Signal Fusion ===')
    console.log(`[signal] Source mode: ${SOURCE}`)
    console.log(`[signal] Weights: social=${WEIGHTS.social} onchain=${WEIGHTS.onchain} allora=${WEIGHTS.allora} elfa=${WEIGHTS.elfa} poly=${WEIGHTS.polymarket}`)

    // Neutral defaults for each source
    let socialBias = { riskAppetite: 'neutral', defiSentiment: 'neutral', tokens: {}, reasoning: 'Skipped.', confidence: 0.5, sourcePosts: [] }
    let poolData   = null
    let alloraSignal    = null
    let elfaSignal      = null
    let polymarketSignal = null

    const isAll = SOURCE === 'all' || SOURCE === 'both'
    const runSocial     = isAll || SOURCE === 'social-only'
    const runOnchain    = isAll || SOURCE === 'onchain-only'
    const runAllora     = isAll || SOURCE === 'allora-only'
    const runElfa       = isAll || SOURCE === 'elfa-only'
    const runPolymarket = isAll || SOURCE === 'polymarket-only'

    // Run independent signals in parallel where possible
    const tasks = []

    if (runSocial) tasks.push(
        (async () => {
            console.log('[signal] [A] Reading recent X posts...')
            const posts = readRecentPosts(5)
            console.log(`[signal] [A] Found ${posts.length} recent posts`)
            socialBias = await deriveSocialBias(posts)
            console.log(`[signal] [A] Social: ${socialBias.riskAppetite}/${socialBias.defiSentiment} (conf ${socialBias.confidence?.toFixed(2)})`)
        })()
    )

    if (runOnchain) tasks.push(
        (async () => {
            console.log('[signal] [B] Fetching Byreal pool data...')
            poolData = fetchByrealPoolData()
            if (poolData?.topPool) {
                console.log(`[signal] [B] Top pool: ${poolData.topPool.name} — APR ${poolData.topPool.apr24h?.toFixed(1)}% (tier ${poolData.topPool.tier}, breakEven ${poolData.topPool.breakEvenD?.toFixed(1)}d)`)
            } else if (poolData) {
                console.log(`[signal] [B] No pool passed the quality filter. Excluded top: ${poolData.excludedTop?.name || 'none'} — ${poolData.excludedTop?.reason || 'no candidates'}`)
            }
            else console.warn('[signal] [B] Byreal pool data unavailable')
        })()
    )

    if (runAllora) tasks.push(
        (async () => {
            console.log('[signal] [C] Fetching Allora inference...')
            alloraSignal = await getAlloraSignalSafe()
            console.log(`[signal] [C] Allora: ${alloraSignal.direction} (conf ${(alloraSignal.confidence || 0).toFixed(2)})`)
        })()
    )

    if (runElfa) tasks.push(
        (async () => {
            console.log('[signal] [D] Fetching Elfa smart mentions...')
            elfaSignal = await getElfaSignalSafe()
            console.log(`[signal] [D] Elfa: ${elfaSignal.sentimentDirection} (conf ${(elfaSignal.confidence || 0).toFixed(2)}, risk-off: ${elfaSignal.riskOffSignal})`)
        })()
    )

    if (runPolymarket) tasks.push(
        (async () => {
            console.log('[signal] [E] Fetching Polymarket markets...')
            polymarketSignal = await getPolymarketSignalSafe()
            console.log(`[signal] [E] Polymarket: ${polymarketSignal.directionalBias} (${polymarketSignal.solMarketsFound || 0} SOL markets, risk-off: ${polymarketSignal.riskOffSignal})`)
        })()
    )

    await Promise.all(tasks)

    const recommendation = fuseSignals(socialBias, poolData, alloraSignal, elfaSignal, polymarketSignal)
    console.log(`[signal] Recommendation: ${recommendation.action}`)

    const signal = {
        generatedAt: new Date().toISOString(),
        signalWeights: WEIGHTS,
        socialBias,
        poolData,
        alloraSignal,
        elfaSignal,
        polymarketSignal,
        recommendation,
    }

    if (DRY_RUN) {
        console.log('\n--- Signal JSON ---')
        console.log(JSON.stringify(signal, null, 2))
        return
    }

    const contentDir = path.dirname(OUTPUT_PATH)
    if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true })
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(signal, null, 2))
    console.log(`[signal] Written to: ${OUTPUT_PATH}`)
}

main().catch(err => {
    console.error('[signal] Fatal error:', err.message)
    process.exit(1)
})
