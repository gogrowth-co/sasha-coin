#!/usr/bin/env node
/**
 * allora.js — Allora Network decentralized inference signal
 *
 * Queries Allora's reputation-weighted ensemble for SOL/USD predictions.
 *
 * Verified working topics (chain: ethereum-11155111):
 *   Topic 3  — SOL/USD Log Returns 8h  (returns log return ~0.001–0.002)
 *   Topic 17 — SOL/USD Price 24h       (returns USD price prediction ~2100)
 *
 * Response shape (both topics):
 *   { status: true, data: { inference_data: { network_inference_normalized: "0.00163" } } }
 *
 * For topic 3  (log return): positive = bullish, negative = bearish
 * For topic 17 (price):      compare against live SOL spot price → direction
 *
 * Signal weight in fusion: 25%
 *
 * Usage:
 *   node scripts/signals/allora.js
 *   node scripts/signals/allora.js --dry-run
 *
 * Env: ALLORA_API_KEY (https://app.allora.network — free tier)
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

// Verified working chain slug for api.allora.network consumer endpoint
const CHAIN_SLUG = 'ethereum-11155111'

// Topic 3:  SOL/USD Log Returns 8h  — value is a log return (small decimal ≈ 0.001)
// Topic 17: SOL/USD Price 24h       — value is a USD price prediction (≈ 2100)
const ALLORA_TOPICS = {
    sol_8h_logret: { topicId: 3,  label: 'SOL/USD Log Returns 8h',      type: 'log_return' },
    sol_24h_price: { topicId: 17, label: 'SOL/USD Price Prediction 24h', type: 'price'      },
}

const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes
const CACHE_PATH   = path.join(WORKSPACE, 'state', 'cache-allora.json')

// Log return thresholds for direction interpretation
// Allora 8h returns typically range ±0.001–0.005; 0.001 = 0.1% move = meaningful signal
const BULLISH_THRESHOLD   =  0.001   // +0.1% → bullish
const BEARISH_THRESHOLD   = -0.001   // -0.1% → bearish
const HIGH_CONF_THRESHOLD =  0.004   // +0.4% → strong_bullish

// Price topic: direction is bullish if predicted price > current spot * (1 + PRICE_BIAS)
// 0 = exactly at spot triggers neutral; 0.005 = needs 0.5% upside to be bullish
const PRICE_BIAS = 0.003

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
// HTTP helper
// ---------------------------------------------------------------------------

function fetchJSON(urlStr, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(urlStr)
        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method:   'GET',
            headers:  { 'Accept': 'application/json', ...headers },
        }
        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => { data += chunk })
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)) }
                    catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 100)}`)) }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')) })
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Allora fetch
// ---------------------------------------------------------------------------

function alloraFetch(topicId, apiKey) {
    const url = `https://api.allora.network/v2/allora/consumer/${CHAIN_SLUG}?allora_topic_id=${topicId}`
    return fetchJSON(url, { 'x-api-key': apiKey })
}

// CoinGecko public endpoint — no key required (rate-limited but sufficient)
async function getSolSpotPrice() {
    try {
        const raw = await fetchJSON(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
            { 'User-Agent': 'SashaSignalAgent/1.0 (autonomous trading agent; github.com/gogrowth-co/sasha-coin)' }
        )
        const price = raw?.solana?.usd
        if (typeof price === 'number' && price > 0) return price
        return null
    } catch (e) {
        console.warn(`[allora] CoinGecko spot fetch failed: ${e.message}`)
        return null
    }
}

// ---------------------------------------------------------------------------
// Extract normalised inference value from Allora response
// Response: { status: true, data: { inference_data: { network_inference_normalized: "0.00163" } } }
// ---------------------------------------------------------------------------

function extractNormalizedValue(topicId, raw) {
    try {
        if (!raw?.status) {
            console.warn(`[allora] Topic ${topicId}: status=false — ${raw?.apiResponseMessage ?? 'unknown error'}`)
            return null
        }

        const v = raw?.data?.inference_data?.network_inference_normalized
        if (v === undefined || v === null) {
            console.warn(`[allora] Topic ${topicId}: missing network_inference_normalized — keys: ${Object.keys(raw?.data?.inference_data || {}).join(', ')}`)
            return null
        }

        const num = parseFloat(v)
        return isNaN(num) ? null : num
    } catch (e) {
        console.warn(`[allora] Topic ${topicId} parse error: ${e.message}`)
        return null
    }
}

// ---------------------------------------------------------------------------
// Interpret a log return value
// ---------------------------------------------------------------------------

function interpretLogReturn(value) {
    if (value === null) return 'neutral'
    if (value > HIGH_CONF_THRESHOLD)   return 'strong_bullish'
    if (value > BULLISH_THRESHOLD)     return 'bullish'
    if (value < -HIGH_CONF_THRESHOLD)  return 'strong_bearish'
    if (value < BEARISH_THRESHOLD)     return 'bearish'
    return 'neutral'
}

// ---------------------------------------------------------------------------
// Interpret a price prediction relative to spot
// ---------------------------------------------------------------------------

function interpretPricePrediction(predictedPrice, spotPrice) {
    if (predictedPrice === null || spotPrice === null) return 'neutral'
    const impliedReturn = (predictedPrice - spotPrice) / spotPrice
    return interpretLogReturn(impliedReturn)  // reuse same thresholds
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
        console.log(`[allora] Fetching SOL inferences (chain: ${CHAIN_SLUG}, topics 3 & 17)...`)

        const [shortRes, longRes, spotPrice] = await Promise.allSettled([
            alloraFetch(ALLORA_TOPICS.sol_8h_logret.topicId, apiKey),
            alloraFetch(ALLORA_TOPICS.sol_24h_price.topicId, apiKey),
            getSolSpotPrice(),
        ])

        if (shortRes.status === 'rejected') console.warn(`[allora] Topic 3 failed: ${shortRes.reason?.message}`)
        if (longRes.status  === 'rejected') console.warn(`[allora] Topic 17 failed: ${longRes.reason?.message}`)

        // Topic 3 — log return (interpret directly)
        const shortValue = shortRes.status === 'fulfilled'
            ? extractNormalizedValue(3, shortRes.value)
            : null
        const shortBias = interpretLogReturn(shortValue)
        console.log(`[allora] Topic 3  (8h log return):   ${shortValue?.toFixed(6) ?? 'N/A'} → ${shortBias}`)

        // Topic 17 — price prediction (compare against spot)
        const spot = longRes.status === 'rejected' ? null
            : (spotPrice.status === 'fulfilled' ? spotPrice.value : null)
        const longValue = longRes.status === 'fulfilled'
            ? extractNormalizedValue(17, longRes.value)
            : null
        let longBias = 'neutral'
        if (longValue !== null && spot !== null) {
            const impliedReturn = (longValue - spot) / spot
            longBias = interpretLogReturn(impliedReturn)
            console.log(`[allora] Topic 17 (24h price):       predicted $${longValue?.toFixed(2)} vs spot $${spot?.toFixed(2)} (${impliedReturn > 0 ? '+' : ''}${(impliedReturn * 100).toFixed(2)}%) → ${longBias}`)
        } else if (longValue !== null) {
            console.log(`[allora] Topic 17 (24h price):       predicted $${longValue?.toFixed(2)}, spot unavailable → neutral`)
        } else {
            console.log(`[allora] Topic 17 (24h price):       N/A`)
        }

        // Derive direction and confidence from both horizons
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
            direction  = 'long'
            confidence = 0.45
        } else if (shortIsBearish || longIsBearish) {
            direction  = 'short'
            confidence = 0.45
        }

        // Reduce confidence if only one horizon available
        const horizonsAvailable = (shortValue !== null ? 1 : 0) + (longValue !== null && spot !== null ? 1 : 0)
        if (horizonsAvailable === 1) confidence = Math.min(confidence, 0.45)
        if (horizonsAvailable === 0) return { ...NEUTRAL_SIGNAL, note: 'No inference data available' }

        const signal = {
            direction,
            confidence,
            shortHorizonBias:  shortBias,
            longHorizonBias:   longBias,
            shortLogReturn:    shortValue,
            longPricePrediction: longValue,
            solSpotPrice:      spot,
            agreement:         (shortIsBullish && longIsBullish) || (shortIsBearish && longIsBearish),
            horizonsAvailable,
            topicIds:          { short: 3, long: 17 },
            chainSlug:         CHAIN_SLUG,
            source:            'allora',
            fetchedAt:         new Date().toISOString(),
        }

        console.log(`[allora] Signal: ${direction} (confidence: ${confidence}), horizons: ${horizonsAvailable}/2`)
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
