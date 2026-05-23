#!/usr/bin/env node
/**
 * mantle-signal.js — Signal fusion pipeline for Sasha's Mantle trade skill
 *
 * Fuses two signal sources into a structured trading recommendation:
 *   Source A: Sasha's recent X posts (social/narrative bias)
 *   Source B: Byreal pool data (on-chain APR, TVL, volume)
 *
 * Usage:
 *   node scripts/mantle-signal.js                          # generate + write to content/mantle-signal.json
 *   node scripts/mantle-signal.js --dry-run                # print JSON to stdout, no file write
 *   node scripts/mantle-signal.js --source social-only     # skip Byreal data fetch
 *   node scripts/mantle-signal.js --source onchain-only    # skip social bias extraction
 *
 * Requires: OPENAI_API_KEY or OPENROUTER_API_KEY (for LLM bias extraction)
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
const DRY_RUN = args.includes('--dry-run')
const SOURCE = (() => {
    const idx = args.indexOf('--source')
    return idx !== -1 ? args[idx + 1] : 'both'
})()
const OUTPUT_PATH = (() => {
    const idx = args.indexOf('--output')
    return idx !== -1 ? args[idx + 1] : path.join(WORKSPACE, 'content', 'mantle-signal.json')
})()

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
    // Exclude replies, take last N originals
    return log
        .filter(e => e.source !== 'reply')
        .slice(-count)
        .map(e => e.tweet_text || e.text || '')
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
        console.warn('[signal] No LLM API key found — using rule-based bias extraction')
        return ruleBasedBias(posts)
    }

    const isOpenRouter = !!process.env.OPENROUTER_API_KEY
    const apiBase = isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
    const model = isOpenRouter ? 'google/gemini-2.5-flash' : 'gpt-4o-mini'

    const systemPrompt = `You are analyzing an AI agent's recent social media posts to extract her current market bias.
Return ONLY a JSON object with no markdown. Schema:
{
  "riskAppetite": "risk-on" | "risk-off" | "neutral",
  "defiSentiment": "bullish" | "bearish" | "neutral",
  "tokens": { "SOL": "bullish|bearish|neutral", "USDC": "bullish|bearish|neutral", "mETH": "bullish|bearish|neutral", "MNT": "bullish|bearish|neutral" },
  "reasoning": "1-2 sentences explaining the bias",
  "confidence": 0.0-1.0
}`

    const userPrompt = `Analyze these recent posts from an AI DeFi agent named Sasha Coin and extract her market bias:\n\n${posts.map((p, i) => `${i + 1}. "${p}"`).join('\n')}`

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
        // Handle both array and { pools: [] } shapes
        // byreal-cli returns { success, meta, data: { pools: [] } }
        const pools = Array.isArray(data) ? data : (data.data?.pools || data.pools || data.data || [])

        if (!pools.length) return null

        // Top pool by APR
        const top = pools[0]
        // SOL/USDC pool if available
        const solUsdc = pools.find(p =>
            (p.token_a?.symbol === 'SOL' || p.tokenA?.symbol === 'SOL') &&
            (p.token_b?.symbol === 'USDC' || p.tokenB?.symbol === 'USDC')
        ) || pools.find(p => {
            const name = (p.pair || p.name || p.pool_name || '').toUpperCase()
            return name.includes('SOL') && name.includes('USDC')
        })

        const poolNorm = (p) => ({
            name: p.pair || p.name || p.pool_name || 'Unknown',
            address: p.id || p.address || p.pool_address,
            apr24h: p.total_apr || p.apr || p.apr24h || p.apr_24h || p.feeApr || 0,
            tvl: p.tvl_usd || p.tvl || 0,
            volume24h: p.volume_24h_usd || p.volume24h || p.volume_24h || 0,
            tokenA: p.token_a?.symbol || p.tokenA?.symbol || '?',
            tokenB: p.token_b?.symbol || p.tokenB?.symbol || '?',
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
// Signal fusion — deterministic, auditable
// ---------------------------------------------------------------------------

function fuseSignals(socialBias, poolData) {
    // Default: HOLD
    if (!poolData) {
        return {
            action: 'HOLD',
            fromToken: null,
            toToken: null,
            amountPct: 0,
            poolAddress: null,
            rationale: 'Could not fetch Byreal pool data. Holding.',
            socialSnippet: socialBias.reasoning,
            onchainSnippet: 'Pool data unavailable',
        }
    }

    const { topPool, solUsdcPool } = poolData
    const isRiskOn = socialBias.riskAppetite === 'risk-on' || socialBias.defiSentiment === 'bullish'
    const isRiskOff = socialBias.riskAppetite === 'risk-off' || socialBias.defiSentiment === 'bearish'
    const highAPR = topPool.apr24h > 50 // >50% APR = opportunity signal
    const goodLiquidity = topPool.tvl > 100_000 // >$100k TVL = sufficient liquidity
    const solBullish = socialBias.tokens?.SOL === 'bullish'

    // Decision rules (in priority order)
    if (isRiskOff) {
        return {
            action: 'MOVE_TO_STABLE',
            fromToken: 'SOL',
            toToken: 'USDC',
            amountPct: 50,
            poolAddress: solUsdcPool?.address || null,
            rationale: `Risk-off signal from X posts. Moving 50% to USDC for stability. ${socialBias.reasoning}`,
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: `SOL/USDC pool APR: ${solUsdcPool?.apr24h?.toFixed(1) || 'N/A'}%`,
        }
    }

    if (isRiskOn && highAPR && goodLiquidity) {
        return {
            action: 'OPEN_LP_POSITION',
            fromToken: 'USDC',
            toToken: 'SOL',
            poolAddress: topPool.address,
            poolName: topPool.name,
            amountPct: 30,
            rationale: `Risk-on sentiment + high APR opportunity (${topPool.apr24h.toFixed(1)}%) in ${topPool.name}. ${socialBias.reasoning}`,
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: `${topPool.name} APR: ${topPool.apr24h.toFixed(1)}%, TVL: $${(topPool.tvl / 1000).toFixed(0)}k`,
        }
    }

    if (solBullish && solUsdcPool && solUsdcPool.apr24h > 20) {
        return {
            action: 'SWAP_TO_SOL',
            fromToken: 'USDC',
            toToken: 'SOL',
            amountPct: 20,
            poolAddress: solUsdcPool.address,
            rationale: `Bullish SOL signal from X posts. Rotating 20% USDC → SOL. APR for LP: ${solUsdcPool.apr24h.toFixed(1)}%.`,
            socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
            onchainSnippet: `SOL/USDC APR: ${solUsdcPool.apr24h.toFixed(1)}%, TVL: $${((solUsdcPool.tvl || 0) / 1000).toFixed(0)}k`,
        }
    }

    // Default: HOLD
    return {
        action: 'HOLD',
        fromToken: null,
        toToken: null,
        amountPct: 0,
        poolAddress: null,
        rationale: `Neutral signal. No strong conviction. Top APR pool: ${topPool.name} at ${topPool.apr24h.toFixed(1)}%.`,
        socialSnippet: socialBias.sourcePosts?.[socialBias.sourcePosts.length - 1] || '',
        onchainSnippet: `Top pool ${topPool.name}: APR ${topPool.apr24h.toFixed(1)}%, TVL $${(topPool.tvl / 1000).toFixed(0)}k`,
    }
}

// ---------------------------------------------------------------------------
// LLM helper
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
                    'X-Title': 'Sasha Coin — Mantle Hackathon',
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
                    // Strip markdown code fences if present
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
    console.log('[signal] Generating Mantle trade signal...')

    let socialBias = { riskAppetite: 'neutral', defiSentiment: 'neutral', tokens: {}, reasoning: 'Skipped.', confidence: 0.5, sourcePosts: [] }
    let poolData = null

    if (SOURCE !== 'onchain-only') {
        console.log('[signal] Reading recent X posts...')
        const posts = readRecentPosts(5)
        console.log(`[signal] Found ${posts.length} recent posts`)
        socialBias = await deriveSocialBias(posts)
        console.log(`[signal] Social bias: ${socialBias.riskAppetite} / ${socialBias.defiSentiment} (confidence: ${socialBias.confidence})`)
    }

    if (SOURCE !== 'social-only') {
        console.log('[signal] Fetching Byreal pool data...')
        poolData = fetchByrealPoolData()
        if (poolData) {
            console.log(`[signal] Top pool: ${poolData.topPool.name} — APR ${poolData.topPool.apr24h?.toFixed(1)}%`)
        } else {
            console.warn('[signal] Byreal pool data unavailable')
        }
    }

    const recommendation = fuseSignals(socialBias, poolData)
    console.log(`[signal] Recommendation: ${recommendation.action}`)

    const signal = {
        generatedAt: new Date().toISOString(),
        socialBias,
        poolData,
        recommendation,
    }

    if (DRY_RUN) {
        console.log('\n--- Signal JSON ---')
        console.log(JSON.stringify(signal, null, 2))
        return
    }

    // Ensure content/ directory exists
    const contentDir = path.dirname(OUTPUT_PATH)
    if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true })

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(signal, null, 2))
    console.log(`[signal] Written to: ${OUTPUT_PATH}`)
}

main().catch(err => {
    console.error('[signal] Fatal error:', err.message)
    process.exit(1)
})
