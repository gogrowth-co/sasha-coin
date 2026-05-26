#!/usr/bin/env node
/**
 * polymarket.js — Polymarket prediction market signal
 *
 * Real-money prediction markets provide skin-in-the-game crowd intelligence
 * that is uncorrelated with Twitter sentiment and impossible to fake.
 * Probabilities reflect genuine beliefs with capital at risk.
 *
 * API: gamma-api.polymarket.com/events (NOT /markets — that endpoint
 * doesn't filter by tag reliably; events nests markets within each event)
 *
 * Strategy:
 *   1. Fetch active crypto events, filter for Solana/SOL keywords
 *   2. Price-target markets (SOL above $X): low Yes% = bearish, high = bullish
 *   3. ATH timing markets: high probability = bullish
 *   4. Risk-off: any exploit/hack/outage market with >15% probability
 *
 * Signal weight in fusion: 15%
 *
 * No API key needed — Polymarket Gamma API is public.
 *
 * Usage:
 *   node scripts/signals/polymarket.js
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '../..')

const CACHE_TTL_MS = 15 * 60 * 1000  // 15 minutes (prediction markets move slowly)
const CACHE_PATH   = path.join(WORKSPACE, 'state', 'cache-polymarket.json')

// Must match "solana" or "$sol" as whole-word (not "sol" alone — too many false positives)
const SOL_STRICT   = ['solana', '$sol']
const RISK_KEYWORDS = ['hack', 'exploit', 'outage', 'halt', 'crash', 'failure', 'attack', 'drain', 'insolvency']

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
    } catch (e) { console.warn(`[polymarket] Cache write failed: ${e.message}`) }
}

// ---------------------------------------------------------------------------
// HTTP fetch
// ---------------------------------------------------------------------------

function fetchJSON(path, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'gamma-api.polymarket.com',
            path,
            method: 'GET',
            headers: {
                'Accept':     'application/json',
                'User-Agent': 'SashaSignalAgent/1.0 (autonomous trading agent; github.com/gogrowth-co/sasha-coin)',
            },
        }
        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', c => { data += c })
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)) }
                    catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 100)}`)) }
                } else {
                    reject(new Error(`Polymarket API ${res.statusCode}: ${data.slice(0, 150)}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Polymarket request timeout')) })
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Fetch events and extract all nested markets
// ---------------------------------------------------------------------------

async function fetchSolanaMarkets() {
    // Primary: events endpoint with crypto tag — parse nested markets
    const raw = await fetchJSON('/events?active=true&closed=false&limit=100&tag_slug=crypto')
    const events = Array.isArray(raw) ? raw : (raw?.data ?? raw?.events ?? [])

    // Filter events mentioning solana or $sol
    const solEvents = events.filter(ev => {
        const text = `${ev.title || ''} ${ev.description || ''}`.toLowerCase()
        return SOL_STRICT.some(kw => text.includes(kw))
    })

    // Flatten all markets from matching events
    const markets = []
    for (const ev of solEvents) {
        for (const m of (ev.markets || [])) {
            markets.push({ ...m, _eventTitle: ev.title })
        }
    }

    return markets
}

// ---------------------------------------------------------------------------
// Extract Yes probability from a binary market
// ---------------------------------------------------------------------------

function extractYesProb(market) {
    try {
        const prices   = JSON.parse(market.outcomePrices || '[]')
        const outcomes = JSON.parse(market.outcomes      || '[]')
        if (!prices.length) return null

        const yesIdx = outcomes.findIndex(o => String(o).toLowerCase() === 'yes')
        if (yesIdx !== -1) {
            const v = parseFloat(prices[yesIdx])
            return isNaN(v) ? null : v
        }
        // Binary market with no Yes/No labels — first outcome is "Up" or positive
        const v = parseFloat(prices[0])
        return isNaN(v) ? null : v
    } catch { return null }
}

// ---------------------------------------------------------------------------
// Classify market type from question text
// ---------------------------------------------------------------------------

function classifyMarket(market) {
    const q = (market.question || '').toLowerCase()
    if (q.includes('above') || q.includes('reach') || q.includes('hit') || q.includes('ath')) return 'bullish_target'
    if (q.includes('below') || q.includes('drop') || q.includes('crash') || q.includes('fall')) return 'bearish_target'
    if (RISK_KEYWORDS.some(kw => q.includes(kw))) return 'risk_event'
    if (q.includes('up or down') || q.includes('up/down')) return 'direction'
    return 'other'
}

// ---------------------------------------------------------------------------
// Derive aggregate signal from SOL markets
// ---------------------------------------------------------------------------

function analyzeMarkets(markets) {
    // Filter to markets with actual price data
    const live = markets.filter(m => {
        const p = extractYesProb(m)
        return p !== null && p > 0 && p < 1
    })

    if (!live.length) {
        return { found: markets.length, live: 0, directionalBias: 'neutral', confidence: 0.30, riskOffSignal: false, topMarkets: [] }
    }

    const bullishMarkets  = live.filter(m => classifyMarket(m) === 'bullish_target')
    const riskMarkets     = live.filter(m => classifyMarket(m) === 'risk_event')
    const directionMarkets = live.filter(m => classifyMarket(m) === 'direction')

    // Average implied probability for bullish targets (e.g. "SOL above $X")
    const bullishProbs = bullishMarkets.map(extractYesProb).filter(p => p !== null)
    const avgBullish   = bullishProbs.length > 0
        ? bullishProbs.reduce((a, b) => a + b, 0) / bullishProbs.length
        : null

    // Worst-case risk event probability
    const riskProbs   = riskMarkets.map(extractYesProb).filter(p => p !== null)
    const maxRiskProb = riskProbs.length > 0 ? Math.max(...riskProbs) : null

    // Direction markets (Up or Down)
    const dirProbs = directionMarkets.map(extractYesProb).filter(p => p !== null)
    const avgDir   = dirProbs.length > 0
        ? dirProbs.reduce((a, b) => a + b, 0) / dirProbs.length
        : null

    // Risk-off trigger
    const riskOffSignal = maxRiskProb !== null && maxRiskProb > 0.15

    // Directional bias
    // Use avgBullish as primary (price target markets are most informative)
    // avgDir as secondary (direct up/down markets)
    const impliedBullishProb = avgBullish ?? avgDir

    let directionalBias = 'neutral'
    let confidence = 0.35
    if (!riskOffSignal && impliedBullishProb !== null) {
        if (impliedBullishProb > 0.50) {
            directionalBias = 'bullish'
            confidence = 0.50 + Math.min(0.25, (impliedBullishProb - 0.50) * 2)
        } else if (impliedBullishProb < 0.25) {
            directionalBias = 'bearish'
            confidence = 0.40 + Math.min(0.20, (0.25 - impliedBullishProb) * 2)
        } else {
            // 0.25–0.50 = neutral/weak bearish
            directionalBias = 'neutral'
            confidence = 0.35
        }
    }
    if (riskOffSignal) {
        directionalBias = 'bearish'
        confidence = Math.min(0.90, 0.55 + (maxRiskProb - 0.15) * 2)
    }

    const topMarkets = [...live]
        .sort((a, b) => (parseFloat(b.volume || 0)) - (parseFloat(a.volume || 0)))
        .slice(0, 4)
        .map(m => ({
            question:    m.question,
            type:        classifyMarket(m),
            yesProb:     extractYesProb(m),
            eventTitle:  m._eventTitle,
        }))

    return {
        found:             markets.length,
        live:              live.length,
        directionalBias,
        confidence,
        riskOffSignal,
        impliedBullishProb,
        riskEventProb:     maxRiskProb,
        topMarkets,
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const NEUTRAL_SIGNAL = {
    directionalBias:   'neutral',
    confidence:        0.30,
    riskOffSignal:     false,
    solMarketsFound:   0,
    impliedBullishProb: null,
    riskEventProb:     null,
    topMarkets:        [],
    source:            'polymarket',
    note:              'API unavailable — neutral fallback',
}

export async function getPolymarketSignal() {
    const cached = readCache()
    if (cached) {
        const ageMin = Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 60000)
        console.log(`[polymarket] Using cached signal (${ageMin}m old)`)
        return cached
    }

    try {
        console.log('[polymarket] Fetching Solana markets from Polymarket events...')
        const markets = await fetchSolanaMarkets()

        if (!markets.length) {
            console.log('[polymarket] No Solana markets found in active crypto events')
            const signal = { ...NEUTRAL_SIGNAL, note: 'No active SOL markets on Polymarket', fetchedAt: new Date().toISOString() }
            writeCache(signal)
            return signal
        }

        const analysis = analyzeMarkets(markets)

        const signal = {
            directionalBias:   analysis.directionalBias,
            confidence:        analysis.confidence,
            riskOffSignal:     analysis.riskOffSignal,
            solMarketsFound:   analysis.found,
            liveMarketsCount:  analysis.live,
            impliedBullishProb: analysis.impliedBullishProb,
            riskEventProb:     analysis.riskEventProb,
            topMarkets:        analysis.topMarkets,
            source:            'polymarket',
            fetchedAt:         new Date().toISOString(),
        }

        console.log(`[polymarket] ${analysis.found} SOL markets (${analysis.live} live), bias: ${analysis.directionalBias} (${analysis.confidence.toFixed(2)}), risk-off: ${analysis.riskOffSignal}`)
        if (analysis.topMarkets.length) {
            for (const m of analysis.topMarkets) {
                console.log(`[polymarket]   "${m.question?.slice(0, 70)}" → Yes: ${m.yesProb !== null ? (m.yesProb * 100).toFixed(1) + '%' : 'N/A'}`)
            }
        }

        writeCache(signal)
        return signal

    } catch (e) {
        console.warn(`[polymarket] Signal fetch failed: ${e.message} — returning neutral`)
        return { ...NEUTRAL_SIGNAL, note: e.message }
    }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const signal = await getPolymarketSignal()
    console.log('\n--- Polymarket Signal ---')
    console.log(JSON.stringify(signal, null, 2))
}
