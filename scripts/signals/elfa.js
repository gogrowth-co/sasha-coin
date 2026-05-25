#!/usr/bin/env node
/**
 * elfa.js — Elfa AI smart mentions signal
 *
 * Elfa AI is both a hackathon judge AND provides the exact signal layer
 * Sasha's social intelligence needs: smart-account mention tracking that
 * leads price moves. The "/smart-mentions/{ticker}" endpoint weights
 * mentions by the historical alpha of the accounts posting them.
 *
 * This replaces naive sentiment analysis with quantified smart-money
 * social activity. Smart mention surges 24h-over-24h = leading signal.
 *
 * Signal weight in fusion: 15%
 *
 * Usage:
 *   node scripts/signals/elfa.js              # prints signal for SOL, MNT, USDC
 *   node scripts/signals/elfa.js --ticker SOL  # single ticker
 *
 * Env: ELFA_API_KEY (get from https://elfa.ai — free tier available)
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '../..')

const TICKERS = ['SOL', 'MNT', 'USDC']
const CACHE_TTL_MS = 10 * 60 * 1000  // 10 minutes
const CACHE_PATH   = path.join(WORKSPACE, 'state', 'cache-elfa.json')

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
// API calls
// ---------------------------------------------------------------------------

function elfaFetch(endpoint, apiKey) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(`https://api.elfa.ai${endpoint}`)
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'x-elfa-api-key': apiKey,
                'Accept': 'application/json',
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
                    reject(new Error(`Elfa auth error ${res.statusCode} — check ELFA_API_KEY`))
                } else if (res.statusCode === 404) {
                    resolve(null)  // Ticker not found — not a hard error
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
// Parse smart mentions response
// ---------------------------------------------------------------------------

function parseMentions(ticker, raw) {
    if (!raw) return null

    // Elfa response shape (may vary — handle multiple structures):
    // { mentions: [...], mindshare: 0.xx, sentiment: 'bullish', ... }
    // OR: { data: { smartMentions: N, mindshare: N, ... } }
    const data = raw.data || raw

    const smartMentions = data.smartMentions ?? data.smart_mentions ??
                          (Array.isArray(data.mentions) ? data.mentions.length : null) ?? 0

    const mindshare = data.mindshare ?? data.mind_share ?? null

    // Sentiment: direct field or derived from score
    const rawSentiment = data.sentiment ?? data.sentiment_direction ?? null
    const sentimentScore = data.sentiment_score ?? data.score ?? null

    let sentimentDirection = 'neutral'
    if (rawSentiment) {
        const s = String(rawSentiment).toLowerCase()
        sentimentDirection = s.includes('bull') ? 'bullish' : s.includes('bear') ? 'bearish' : 'neutral'
    } else if (typeof sentimentScore === 'number') {
        sentimentDirection = sentimentScore > 0.1 ? 'bullish' : sentimentScore < -0.1 ? 'bearish' : 'neutral'
    }

    // Change metrics (24h delta) — key signal
    const mentionsDelta = data.mentionsDelta ?? data.mentions_delta_24h ??
                          data.change_24h ?? null

    const surging = mentionsDelta !== null && mentionsDelta > 0.2  // >20% increase = surging

    return {
        ticker,
        smartMentions,
        mindshare,
        sentimentDirection,
        mentionsDelta24h: mentionsDelta,
        surging,
    }
}

// ---------------------------------------------------------------------------
// Derive aggregate signal
// ---------------------------------------------------------------------------

function deriveSignal(tickerData) {
    const sol = tickerData.SOL
    const mnt = tickerData.MNT

    if (!sol && !mnt) {
        return {
            sentimentDirection: 'neutral',
            confidence: 0.3,
            smartMentionCount: 0,
            surgingTickers: [],
            riskOffSignal: false,
            source: 'elfa',
            note: 'No data for tracked tickers',
        }
    }

    const solBullish = sol?.sentimentDirection === 'bullish'
    const solBearish = sol?.sentimentDirection === 'bearish'
    const mntBullish = mnt?.sentimentDirection === 'bullish'
    const surgingTickers = Object.entries(tickerData)
        .filter(([, d]) => d?.surging)
        .map(([t]) => t)

    const totalMentions = Object.values(tickerData)
        .reduce((sum, d) => sum + (d?.smartMentions || 0), 0)

    // Risk-off: SOL bearish with surging bearish mentions = danger signal
    const riskOffSignal = solBearish && (sol?.mentionsDelta24h || 0) > 0.15

    // Overall direction
    let sentimentDirection = 'neutral'
    let confidence = 0.4

    if (solBullish || mntBullish || surgingTickers.length >= 2) {
        sentimentDirection = 'bullish'
        confidence = 0.55 + (surgingTickers.length * 0.1)
    } else if (solBearish && mnt?.sentimentDirection === 'bearish') {
        sentimentDirection = 'bearish'
        confidence = 0.60
    } else if (solBearish || mntBullish) {
        sentimentDirection = 'neutral'
        confidence = 0.35
    }

    confidence = Math.min(0.9, confidence)

    return {
        sentimentDirection,
        confidence,
        smartMentionCount: totalMentions,
        surgingTickers,
        riskOffSignal,
        tickerBreakdown: tickerData,
        source: 'elfa',
        fetchedAt: new Date().toISOString(),
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const NEUTRAL_SIGNAL = {
    sentimentDirection: 'neutral',
    confidence: 0.3,
    smartMentionCount: 0,
    surgingTickers: [],
    riskOffSignal: false,
    source: 'elfa',
    note: 'API unavailable — neutral fallback',
}

export async function getElfaSignal(tickers = TICKERS) {
    const cached = readCache()
    if (cached) {
        console.log(`[elfa] Using cached signal (${Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 60000)}m old)`)
        return cached
    }

    const apiKey = process.env.ELFA_API_KEY
    if (!apiKey) {
        console.warn('[elfa] ELFA_API_KEY not set — returning neutral signal')
        console.warn('[elfa] Get your free key at: https://elfa.ai')
        return NEUTRAL_SIGNAL
    }

    try {
        console.log(`[elfa] Fetching smart mentions for: ${tickers.join(', ')}...`)

        const results = await Promise.allSettled(
            tickers.map(ticker =>
                elfaFetch(`/smart-mentions/${ticker}?window=24h`, apiKey)
                    .then(raw => ({ ticker, raw }))
            )
        )

        const tickerData = {}
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.raw) {
                const { ticker, raw } = result.value
                tickerData[ticker] = parseMentions(ticker, raw)
                if (tickerData[ticker]) {
                    console.log(`[elfa] ${ticker}: ${tickerData[ticker].smartMentions} smart mentions, sentiment: ${tickerData[ticker].sentimentDirection}, surging: ${tickerData[ticker].surging}`)
                }
            } else if (result.status === 'rejected') {
                console.warn(`[elfa] Fetch failed: ${result.reason?.message}`)
            }
        }

        if (!Object.keys(tickerData).length) {
            return { ...NEUTRAL_SIGNAL, note: 'No ticker data returned' }
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
    const tickers = tickerIdx !== -1 ? [args[tickerIdx + 1]] : TICKERS

    const signal = await getElfaSignal(tickers)
    console.log('\n--- Elfa Signal ---')
    console.log(JSON.stringify(signal, null, 2))
}
