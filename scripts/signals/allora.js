#!/usr/bin/env node
/**
 * allora.js — Allora Network decentralized inference signal
 *
 * Queries Allora's reputation-weighted ensemble for SOL/USD predictions.
 * Topics return LOG RETURNS (not prices) — positive = bullish, negative = bearish.
 *
 * Correct topic IDs (from explorer.allora.network/topics/all-topics):
 *   Topic 3  — SOL/USD Log Returns 8h   (12 active workers, highest SOL stake)
 *   Topic 17 — SOL/USD Log Returns 24h  (7 active workers, longer horizon)
 *
 * Signal weight in fusion: 25%
 *
 * Usage:
 *   node scripts/signals/allora.js              # prints signal JSON
 *   node scripts/signals/allora.js --dry-run    # same, explicit
 *
 * Env: ALLORA_API_KEY (get from https://app.allora.network — free tier)
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '../..')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// SOL/USD topic IDs — verified from explorer.allora.network/topics/all-topics
// These return LOG RETURNS: positive = bullish, negative = bearish, ~0 = neutral
const ALLORA_TOPICS = {
    sol_8h:  { topicId: 3,  label: 'SOL/USD Log Returns 8h',  horizon: '8h'  },
    sol_24h: { topicId: 17, label: 'SOL/USD Log Returns 24h', horizon: '24h' },
}

// Chain identifier for Allora mainnet consumer endpoint
const CHAIN_ID = 1

const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes
const CACHE_PATH   = path.join(WORKSPACE, 'state', 'cache-allora.json')

// Log return thresholds for signal interpretation
// Log returns near 0 = neutral, >0.005 = meaningful bullish, <-0.005 = bearish
const BULLISH_THRESHOLD =  0.003   // +0.3% expected move → bullish
const BEARISH_THRESHOLD = -0.003   // -0.3% expected move → bearish
const HIGH_CONF_THRESHOLD = 0.008  // +0.8% → high confidence directional

// ---------------------------------------------------------------------------
// Cache helpers
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
    } catch (e) {
        console.warn(`[allora] Cache write failed: ${e.message}`)
    }
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

function alloraFetch(topicId, apiKey) {
    return new Promise((resolve, reject) => {
        const url = `https://api.allora.network/v2/allora/consumer/${CHAIN_ID}?allora_topic_id=${topicId}`
        const urlObj = new URL(url)

        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method:   'GET',
            headers:  {
                'x-api-key': apiKey,
                'Accept':    'application/json',
            },
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => { data += chunk })
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)) }
                    catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 100)}`)) }
                } else if (res.statusCode === 401 || res.statusCode === 403) {
                    reject(new Error(`Allora auth error ${res.statusCode} — check ALLORA_API_KEY`))
                } else {
                    reject(new Error(`Allora API ${res.statusCode}: ${data.slice(0, 200)}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Allora request timeout')) })
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Interpret log return value
// ---------------------------------------------------------------------------
//
// Allora returns log returns, not prices. A log return of +0.005 means the
// network expects a ~0.5% price increase over the horizon. We interpret:
//   > +BULLISH_THRESHOLD  → bullish
//   < -BEARISH_THRESHOLD  → bearish
//   between              → neutral
//
// Response shape varies — try multiple known field paths:
//   { data: { InferenceForecastsValue: "0x..." } }  (hex-encoded float)
//   { data: { NetworkInferences: { CombinedValue: "0.00123" } } }
//   { forecast_value: 0.00123 }

function extractLogReturn(topicId, raw) {
    try {
        // Path 1: NetworkInferences CombinedValue (most common for mainnet)
        const combined = raw?.data?.network_inferences?.combined_value
                      ?? raw?.data?.NetworkInferences?.CombinedValue
        if (combined !== undefined && combined !== null) {
            const v = parseFloat(combined)
            if (!isNaN(v)) return v
        }

        // Path 2: InferenceForecastsValue (hex or decimal)
        const inferenceVal = raw?.data?.InferenceForecastsValue
                          ?? raw?.inference_forecast_value
        if (inferenceVal !== undefined && inferenceVal !== null) {
            if (typeof inferenceVal === 'number') return inferenceVal
            const asFloat = parseFloat(inferenceVal)
            if (!isNaN(asFloat)) return asFloat
            // Hex-encoded IEEE 754 float
            if (typeof inferenceVal === 'string' && inferenceVal.startsWith('0x')) {
                const buf = Buffer.from(inferenceVal.slice(2), 'hex')
                if (buf.length >= 4) return buf.readFloatBE(0)
            }
        }

        // Path 3: top-level value field
        const topLevel = raw?.value ?? raw?.prediction ?? raw?.forecast_value
        if (topLevel !== undefined) {
            const v = parseFloat(topLevel)
            if (!isNaN(v)) return v
        }

        console.warn(`[allora] Topic ${topicId}: unrecognised response shape — keys: ${Object.keys(raw?.data || raw || {}).join(', ')}`)
        return null
    } catch (e) {
        console.warn(`[allora] Log return parse error for topic ${topicId}: ${e.message}`)
        return null
    }
}

function interpretLogReturn(value) {
    if (value === null) return 'neutral'
    if (value > HIGH_CONF_THRESHOLD) return 'strong_bullish'
    if (value > BULLISH_THRESHOLD)   return 'bullish'
    if (value < -HIGH_CONF_THRESHOLD) return 'strong_bearish'
    if (value < BEARISH_THRESHOLD)   return 'bearish'
    return 'neutral'
}

// ---------------------------------------------------------------------------
// Main signal derivation
// ---------------------------------------------------------------------------

const NEUTRAL_SIGNAL = {
    direction:        'neutral',
    confidence:       0.3,
    shortHorizonBias: 'neutral',
    longHorizonBias:  'neutral',
    agreement:        false,
    raw:              null,
    source:           'allora',
    note:             'API unavailable — neutral fallback',
}

export async function getAlloraSignal() {
    const cached = readCache()
    if (cached) {
        const ageMin = Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 60000)
        console.log(`[allora] Using cached signal (${ageMin}m old)`)
        return cached
    }

    const apiKey = process.env.ALLORA_API_KEY
    if (!apiKey) {
        console.warn('[allora] ALLORA_API_KEY not set — returning neutral signal')
        console.warn('[allora] Get your free key at: https://app.allora.network')
        return NEUTRAL_SIGNAL
    }

    try {
        console.log('[allora] Fetching SOL/USD log return predictions (topics 3 & 17)...')

        const [short, long] = await Promise.allSettled([
            alloraFetch(ALLORA_TOPICS.sol_8h.topicId,  apiKey),
            alloraFetch(ALLORA_TOPICS.sol_24h.topicId, apiKey),
        ])

        if (short.status === 'rejected') console.warn(`[allora] 8h topic failed:  ${short.reason?.message}`)
        if (long.status  === 'rejected') console.warn(`[allora] 24h topic failed: ${long.reason?.message}`)

        const shortReturn = short.status === 'fulfilled'
            ? extractLogReturn(ALLORA_TOPICS.sol_8h.topicId, short.value)
            : null

        const longReturn = long.status === 'fulfilled'
            ? extractLogReturn(ALLORA_TOPICS.sol_24h.topicId, long.value)
            : null

        const shortBias = interpretLogReturn(shortReturn)
        const longBias  = interpretLogReturn(longReturn)

        console.log(`[allora] 8h  log return: ${shortReturn?.toFixed(5) ?? 'N/A'} → ${shortBias}`)
        console.log(`[allora] 24h log return: ${longReturn?.toFixed(5)  ?? 'N/A'} → ${longBias}`)

        // Derive direction and confidence
        // Both horizons bullish → stronger signal. Disagreement → lower confidence.
        const shortIsBullish = shortBias.includes('bullish')
        const shortIsBearish = shortBias.includes('bearish')
        const longIsBullish  = longBias.includes('bullish')
        const longIsBearish  = longBias.includes('bearish')
        const bothStrong     = shortBias.startsWith('strong') || longBias.startsWith('strong')

        let direction  = 'neutral'
        let confidence = 0.40

        if (shortIsBullish && longIsBullish) {
            direction  = 'long'
            confidence = bothStrong ? 0.75 : 0.65
        } else if (shortIsBearish && longIsBearish) {
            direction  = 'short'
            confidence = bothStrong ? 0.75 : 0.65
        } else if (shortIsBullish || longIsBullish) {
            // Partial agreement — lean bullish but lower confidence
            direction  = 'long'
            confidence = 0.45
        } else if (shortIsBearish || longIsBearish) {
            direction  = 'short'
            confidence = 0.45
        }

        // If only one horizon available, reduce confidence
        if (shortReturn === null || longReturn === null) confidence = Math.min(confidence, 0.45)

        const signal = {
            direction,
            confidence,
            shortHorizonBias:  shortBias,
            longHorizonBias:   longBias,
            shortLogReturn:    shortReturn,
            longLogReturn:     longReturn,
            agreement:         shortIsBullish === longIsBullish && shortIsBearish === longIsBearish,
            topicIds:          { short: ALLORA_TOPICS.sol_8h.topicId, long: ALLORA_TOPICS.sol_24h.topicId },
            source:            'allora',
            fetchedAt:         new Date().toISOString(),
        }

        console.log(`[allora] Signal: ${direction} (confidence: ${confidence})`)
        writeCache(signal)
        return signal

    } catch (e) {
        console.warn(`[allora] Signal fetch failed: ${e.message} — returning neutral`)
        return { ...NEUTRAL_SIGNAL, note: e.message }
    }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const signal = await getAlloraSignal()
    console.log('\n--- Allora Signal ---')
    console.log(JSON.stringify(signal, null, 2))
}
