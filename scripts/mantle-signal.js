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
// ---------------------------------------------------------------------------

function fetchByrealPoolData() {
    try {
        const raw = execSync('byreal-cli pools list --sort-field apr24h --page-size 20 -o json 2>/dev/null', {
            timeout: 30000,
            encoding: 'utf8',
        })
        const data = JSON.parse(raw)
        const pools = Array.isArray(data) ? data : (data.data?.pools || data.pools || data.data || [])
        if (!pools.length) return null

        const top = pools[0]
        const solUsdc = pools.find(p =>
            (p.token_a?.symbol === 'SOL' || p.tokenA?.symbol === 'SOL') &&
            (p.token_b?.symbol === 'USDC' || p.tokenB?.symbol === 'USDC')
        ) || pools.find(p => {
            const name = (p.pair || p.name || p.pool_name || '').toUpperCase()
            return name.includes('SOL') && name.includes('USDC')
        })

        const poolNorm = (p) => ({
            name:     p.pair || p.name || p.pool_name || 'Unknown',
            address:  p.id || p.address || p.pool_address,
            apr24h:   p.total_apr || p.apr || p.apr24h || p.apr_24h || p.feeApr || 0,
            tvl:      p.tvl_usd || p.tvl || 0,
            volume24h: p.volume_24h_usd || p.volume24h || p.volume_24h || 0,
            tokenA:   p.token_a?.symbol || p.tokenA?.symbol || '?',
            tokenB:   p.token_b?.symbol || p.tokenB?.symbol || '?',
        })

        return {
            topPool: poolNorm(top),
            solUsdcPool: solUsdc ? poolNorm(solUsdc) : null,
            totalPools: pools.length,
            fetchedAt: new Date().toISOString(),
        }
    } catch (e) {
        console.warn(`[signal] Byreal pool fetch failed: ${e.message}`)
        return null
    }
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
    const onchainSentiment = poolData?.topPool?.apr24h > 50 && poolData?.topPool?.tvl > 100_000 ? 1 : 0
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

    if (effectiveScore > 0.2 && poolData?.topPool?.apr24h > 50 && poolData?.topPool?.tvl > 100_000) {
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
        onchain:    poolData ? { topPoolAPR: poolData.topPool?.apr24h, tvl: poolData.topPool?.tvl } : null,
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
            if (poolData) console.log(`[signal] [B] Top pool: ${poolData.topPool.name} — APR ${poolData.topPool.apr24h?.toFixed(1)}%`)
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
