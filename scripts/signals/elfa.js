#!/usr/bin/env node
/**
 * elfa.js — Elfa AI smart mentions signal (V2 API)
 *
 * Uses /v2/aggregations/trending-tokens to get mention counts and 24h change
 * for SOL and MNT. Filters the trending list for our tracked tokens.
 *
 * V2 response shape:
 *   { success, data: { data: [{ token, current_count, previous_count, change_percent }] } }
 *
 * A "surging" token has change_percent > 20% (mentions growing fast).
 * Risk-off: SOL trending bearish + surging negative sentiment.
 *
 * NOTE: V1 endpoint /smart-mentions/{ticker} never existed.
 *       V1 /trending-tokens → V2 /v2/aggregations/trending-tokens
 *
 * Signal weight in fusion: 15%
 *
 * Usage:
 *   node scripts/signals/elfa.js
 *   node scripts/signals/elfa.js --ticker SOL
 *
 * Env: ELFA_API_KEY (get from https://dev.elfa.ai — free tier available)
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '../..')

const TRACKED_TOKENS = ['SOL', 'MNT', 'USDC']
const CACHE_TTL_MS   = 10 * 60 * 1000  // 10 minutes
const CACHE_PATH     = path.join(WORKSPACE, 'state', 'cache-elfa.json')

// Surging threshold: token mentions up >20% vs prior window = surging
const SURGE_THRESHOLD = 20   // change_percent

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function readCache() {
    try {
        if (!fs.existsSync(CACHE_PATH)) return null
        const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
        if (Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) return cached
        return null
    } catch { return null }
}

function writeCache(data) {
    try {
        const stateDir = path.dirname(CACHE_PATH)
        if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
        fs.writeFileSync(CACHE_PATH, JSON.stringify({ ...data, cachedAt: new Date().toISOString() }, null, 2))
    } catch (e) { console.warn(`[elfa] Cache write failed: ${e.message}`) }
}

// ---------------------------------------------------------------------------
// API call — V2 trending-tokens
// ---------------------------------------------------------------------------

function elfaFetch(endpoint, apiKey) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(`https://api.elfa.ai${endpoint}`)
        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method:   'GET',
            headers:  {
                'x-elfa-api-key': apiKey,
                'Accept':         'application/json',
            },
        }
        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', c => { data += c })
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)) }
                    catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 100)}`)) }
                } else if (res.statusCode === 401 || res.statusCode === 403) {
                    reject(new Error(`Elfa auth error ${res.statusCode} — check ELFA_API_KEY at dev.elfa.ai`))
                } else {
                    reject(new Error(`Elfa API ${res.statusCode}: ${data.slice(0, 150)}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Elfa request timeout')) })
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Parse trending-tokens response
// ---------------------------------------------------------------------------
//
// Response: { success, data: { pageSize, page, total, data: [ { token, current_count, previous_count, change_percent } ] } }
//
// We filter by our TRACKED_TOKENS and build a per-ticker summary.

function parseTrendingTokens(raw, tokens) {
    const items = raw?.data?.data ?? raw?.data ?? []
    if (!Array.isArray(items)) return {}

    const result = {}

    for (const item of items) {
        const ticker = (item.token ?? item.symbol ?? '').toUpperCase()
        if (!tokens.includes(ticker)) continue

        const currentCount  = item.current_count  ?? item.currentCount  ?? 0
        const previousCount = item.previous_count ?? item.previousCount ?? 0
        const changePct     = item.change_percent ?? item.changePercent  ?? 0

        const surging    = changePct > SURGE_THRESHOLD
        const collapsing = changePct < -SURGE_THRESHOLD  // sharp mention drop = possible risk-off

        // Derive sentiment from change direction — rising mentions = bullish pressure
        let sentimentDirection = 'neutral'
        if (changePct > 30)  sentimentDirection = 'bullish'   // strongly surging
        else if (changePct > 10)  sentimentDirection = 'bullish'
        else if (changePct < -30) sentimentDirection = 'bearish'
        else if (changePct < -10) sentimentDirection = 'bearish'

        result[ticker] = {
            ticker,
            smartMentions:    currentCount,
            previousMentions: previousCount,
            changePct:        changePct,
            sentimentDirection,
            surging,
            collapsing,
        }

        console.log(`[elfa] ${ticker}: ${currentCount} mentions (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%) → ${sentimentDirection}${surging ? ' 🔥' : ''}${collapsing ? ' ❄️' : ''}`)
    }

    return result
}

// ---------------------------------------------------------------------------
// Derive aggregate signal
// ---------------------------------------------------------------------------

function deriveSignal(tickerData) {
    const sol  = tickerData.SOL
    const mnt  = tickerData.MNT

    if (!sol && !mnt) {
        return {
            sentimentDirection: 'neutral',
            confidence:         0.3,
            smartMentionCount:  0,
            surgingTickers:     [],
            riskOffSignal:      false,
            source:             'elfa',
            note:               'Tracked tokens not in trending list — low activity window',
        }
    }

    const surgingTickers = Object.entries(tickerData)
        .filter(([, d]) => d?.surging)
        .map(([t]) => t)

    const collapsingTickers = Object.entries(tickerData)
        .filter(([, d]) => d?.collapsing)
        .map(([t]) => t)

    const totalMentions = Object.values(tickerData)
        .reduce((sum, d) => sum + (d?.smartMentions || 0), 0)

    // Risk-off: SOL mentions collapsing or SOL bearish + collapsing
    const riskOffSignal = (sol?.collapsing && sol?.sentimentDirection === 'bearish')
                       || (sol?.changePct < -40)  // extreme drop

    let sentimentDirection = 'neutral'
    let confidence = 0.40

    const solBullish = sol?.sentimentDirection === 'bullish'
    const solBearish = sol?.sentimentDirection === 'bearish'
    const mntBullish = mnt?.sentimentDirection === 'bullish'

    if (solBullish && mntBullish) {
        sentimentDirection = 'bullish'
        confidence = 0.65
    } else if (solBullish || surgingTickers.includes('SOL')) {
        sentimentDirection = 'bullish'
        confidence = 0.50
    } else if (solBearish && mnt?.sentimentDirection === 'bearish') {
        sentimentDirection = 'bearish'
        confidence = 0.60
    } else if (solBearish) {
        sentimentDirection = 'bearish'
        confidence = 0.45
    } else if (mntBullish) {
        sentimentDirection = 'bullish'
        confidence = 0.40
    }

    if (surgingTickers.length >= 2) confidence = Math.min(0.9, confidence + 0.10)
    if (riskOffSignal)               confidence = Math.min(0.9, confidence + 0.10)

    return {
        sentimentDirection,
        confidence,
        smartMentionCount:  totalMentions,
        surgingTickers,
        collapsingTickers,
        riskOffSignal,
        tickerBreakdown:    tickerData,
        source:             'elfa',
        fetchedAt:          new Date().toISOString(),
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const NEUTRAL_SIGNAL = {
    sentimentDirection: 'neutral',
    confidence:         0.3,
    smartMentionCount:  0,
    surgingTickers:     [],
    riskOffSignal:      false,
    source:             'elfa',
    note:               'API unavailable — neutral fallback',
}

export async function getElfaSignal(tokens = TRACKED_TOKENS) {
    const cached = readCache()
    if (cached) {
        const ageMin = Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 60000)
        console.log(`[elfa] Using cached signal (${ageMin}m old)`)
        return cached
    }

    const apiKey = process.env.ELFA_API_KEY
    if (!apiKey) {
        console.warn('[elfa] ELFA_API_KEY not set — returning neutral signal')
        console.warn('[elfa] Get your free key at: https://dev.elfa.ai')
        return NEUTRAL_SIGNAL
    }

    try {
        console.log(`[elfa] Fetching trending tokens (24h window, filtering for: ${tokens.join(', ')})...`)

        // Fetch trending tokens — max pageSize is 100 (API enforces this)
        // 100 covers the top trending tokens in a 24h window
        const raw = await elfaFetch(
            `/v2/aggregations/trending-tokens?timeWindow=24h&page=1&pageSize=100&minMentions=1`,
            apiKey
        )

        if (!raw?.success) {
            const msg = raw?.error ?? raw?.message ?? 'Unknown Elfa error'
            console.warn(`[elfa] API returned success=false: ${msg}`)
            return { ...NEUTRAL_SIGNAL, note: msg }
        }

        const tickerData = parseTrendingTokens(raw, tokens)

        // If our tokens didn't appear in the trending list, they're low-activity
        const found = Object.keys(tickerData)
        const missing = tokens.filter(t => !found.includes(t))
        if (missing.length > 0) {
            console.log(`[elfa] Tokens not in trending list (low activity): ${missing.join(', ')}`)
        }

        const signal = deriveSignal(tickerData)
        console.log(`[elfa] Aggregate: ${signal.sentimentDirection} (confidence: ${signal.confidence}), risk-off: ${signal.riskOffSignal}`)

        writeCache(signal)
        return signal

    } catch (e) {
        console.warn(`[elfa] Signal fetch failed: ${e.message} — returning neutral`)
        return { ...NEUTRAL_SIGNAL, note: e.message }
    }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2)
    const tickerIdx = args.indexOf('--ticker')
    const tokens = tickerIdx !== -1 ? [args[tickerIdx + 1].toUpperCase()] : TRACKED_TOKENS

    const signal = await getElfaSignal(tokens)
    console.log('\n--- Elfa Signal ---')
    console.log(JSON.stringify(signal, null, 2))
}
