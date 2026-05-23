#!/usr/bin/env node
/**
 * polymarket.js — Polymarket prediction market signal
 *
 * Real-money prediction markets provide skin-in-the-game crowd intelligence
 * that is uncorrelated with Twitter sentiment and impossible to fake.
 * Probabilities reflect genuine beliefs with capital at risk.
 *
 * This queries Polymarket's public API for SOL/Solana-related markets,
 * extracts implied directional bias from current probabilities, and flags
 * sharp probability moves as directional signals.
 *
 * Signal weight in fusion: 15%
 *
 * No API key needed — Polymarket's Gamma API is public.
 *
 * Usage:
 *   node scripts/signals/polymarket.js          # prints signal
 *   node scripts/signals/polymarket.js --dry-run
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '../..')

const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes
const CACHE_PATH   = path.join(WORKSPACE, 'state', 'cache-polymarket.json')

// Keywords to match SOL/Solana markets
const SOL_KEYWORDS = ['solana', 'sol', '$sol', 'sol price', 'sol above', 'sol below']
const RISK_KEYWORDS = ['hack', 'exploit', 'outage', 'halt', 'crash', 'failure', 'attack', 'drain']

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
// Fetch from Polymarket Gamma API
// ---------------------------------------------------------------------------

function polymarketFetch(params = {}) {
    return new Promise((resolve, reject) => {
        const queryStr = new URLSearchParams({
            active: 'true',
            closed: 'false',
            limit: '50',
            ...params,
        }).toString()

        const options = {
            hostname: 'gamma-api.polymarket.com',
            path: `/markets?${queryStr}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'sasha-coin-agent/1.0',
            },
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', c => { data += c })
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)) }
                    catch (e) { reject(new Error(`Polymarket JSON parse error: ${data.slice(0, 100)}`)) }
                } else {
                    reject(new Error(`Polymarket API ${res.statusCode}: ${data.slice(0, 150)}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Polymarket request timeout')) })
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Filter and analyze markets
// ---------------------------------------------------------------------------

function isSOLMarket(market) {
    const text = `${market.question || ''} ${market.description || ''} ${(market.tags || []).join(' ')}`.toLowerCase()
    return SOL_KEYWORDS.some(kw => text.includes(kw))
}

function isRiskEvent(market) {
    const text = `${market.question || ''} ${market.description || ''}`.toLowerCase()
    return RISK_KEYWORDS.some(kw => text.includes(kw))
}

function extractProbability(market) {
    // Polymarket outcome probabilities are stored as outcomePrices (stringified array)
    // e.g., outcomePrices: '["0.82", "0.18"]' with outcomes: '["Yes", "No"]'
    try {
        const prices = JSON.parse(market.outcomePrices || '[]')
        const outcomes = JSON.parse(market.outcomes || '[]')

        if (!prices.length || !outcomes.length) return null

        // Find "Yes" probability
        const yesIdx = outcomes.findIndex(o => String(o).toLowerCase() === 'yes')
        if (yesIdx !== -1) return parseFloat(prices[yesIdx])

        // If no Yes/No, return the first outcome probability
        return parseFloat(prices[0])
    } catch { return null }
}

function analyzeMarkets(markets) {
    const solMarkets = markets.filter(isSOLMarket)
    const riskMarkets = markets.filter(m => isSOLMarket(m) && isRiskEvent(m))

    if (!solMarkets.length) {
        return {
            solMarketsFound: 0,
            directionalBias: 'neutral',
            riskOffSignal: false,
            impliedBullishProb: null,
            riskEventProb: null,
            topMarkets: [],
        }
    }

    // Categorize markets as bullish (SOL above X, SOL hits ATH, etc.) or bearish
    const bullishMarkets = solMarkets.filter(m => {
        const q = (m.question || '').toLowerCase()
        return q.includes('above') || q.includes('reach') || q.includes('ath') || q.includes('high')
    })

    const bearishMarkets = solMarkets.filter(m => {
        const q = (m.question || '').toLowerCase()
        return q.includes('below') || q.includes('drop') || q.includes('crash') || q.includes('fall')
    })

    // Average implied probability for bullish markets
    const bullishProbs = bullishMarkets.map(extractProbability).filter(p => p !== null)
    const impliedBullishProb = bullishProbs.length > 0
        ? bullishProbs.reduce((a, b) => a + b, 0) / bullishProbs.length
        : null

    // Risk event probability (any active exploit/hack market)
    const riskProbs = riskMarkets.map(extractProbability).filter(p => p !== null)
    const riskEventProb = riskProbs.length > 0
        ? Math.max(...riskProbs)  // use worst-case risk probability
        : null

    // Detect sharp moves (proxy: high volume + extreme probability)
    const hasSharpMove = solMarkets.some(m =>
        (m.volumeNum || m.volume || 0) > 50000 &&
        (() => {
            const p = extractProbability(m)
            return p !== null && (p > 0.85 || p < 0.15)
        })()
    )

    // Risk-off: any active risk event market with >15% probability
    const riskOffSignal = riskEventProb !== null && riskEventProb > 0.15

    // Directional bias
    let directionalBias = 'neutral'
    if (!riskOffSignal && impliedBullishProb !== null) {
        if (impliedBullishProb > 0.6) directionalBias = 'bullish'
        else if (impliedBullishProb < 0.4) directionalBias = 'bearish'
    }
    if (riskOffSignal) directionalBias = 'bearish'

    // Top markets for context
    const topMarkets = [...solMarkets]
        .sort((a, b) => (b.volumeNum || b.volume || 0) - (a.volumeNum || a.volume || 0))
        .slice(0, 3)
        .map(m => ({
            question: m.question,
            impliedProb: extractProbability(m),
            volume: m.volumeNum || m.volume,
            isRisk: isRiskEvent(m),
        }))

    return {
        solMarketsFound: solMarkets.length,
        directionalBias,
        riskOffSignal,
        hasSharpMove,
        impliedBullishProb,
        riskEventProb,
        topMarkets,
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const NEUTRAL_SIGNAL = {
    directionalBias: 'neutral',
    confidence: 0.35,
    riskOffSignal: false,
    solMarketsFound: 0,
    impliedBullishProb: null,
    riskEventProb: null,
    topMarkets: [],
    source: 'polymarket',
    note: 'API unavailable — neutral fallback',
}

export async function getPolymarketSignal() {
    const cached = readCache()
    if (cached) {
        console.log(`[polymarket] Using cached signal (${Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 60000)}m old)`)
        return cached
    }

    try {
        console.log('[polymarket] Fetching Solana markets from Polymarket...')

        // Fetch active crypto markets — no auth required
        const markets = await polymarketFetch({ tag_slug: 'crypto' })

        const analysis = analyzeMarkets(Array.isArray(markets) ? markets : (markets.data || markets.markets || []))

        // Confidence based on market data quality
        let confidence = 0.4
        if (analysis.solMarketsFound > 5) confidence = 0.55
        if (analysis.solMarketsFound > 10) confidence = 0.65
        if (analysis.riskOffSignal) confidence = Math.min(0.85, confidence + 0.2)  // Risk events are high-confidence

        const signal = {
            directionalBias: analysis.directionalBias,
            confidence,
            riskOffSignal: analysis.riskOffSignal,
            hasSharpMove: analysis.hasSharpMove || false,
            solMarketsFound: analysis.solMarketsFound,
            impliedBullishProb: analysis.impliedBullishProb,
            riskEventProb: analysis.riskEventProb,
            topMarkets: analysis.topMarkets,
            source: 'polymarket',
            fetchedAt: new Date().toISOString(),
        }

        console.log(`[polymarket] ${analysis.solMarketsFound} SOL markets, bias: ${analysis.directionalBias}, risk-off: ${analysis.riskOffSignal}`)

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

if (import.meta.url === `file://${process.argv[1]}`) {
    const signal = await getPolymarketSignal()
    console.log('\n--- Polymarket Signal ---')
    console.log(JSON.stringify(signal, null, 2))
}
