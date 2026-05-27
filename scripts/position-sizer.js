#!/usr/bin/env node
/**
 * position-sizer.js — Conviction-based position sizing for Sasha
 *
 * Replaces the hardcoded $5 DEMO_AMOUNT_USD in byreal-trade.js with a sized
 * position derived from:
 *   1. live capital pool snapshot (state/capital-pool.json, refreshed by treasury-monitor.js)
 *   2. signal weighted score (conviction)
 *   3. pool tier (T1=1.0, T2=0.85, T3=0.60 penalty)
 *
 * Sizing rule:
 *   MAX_POSITION_USD = pool_usd * MAX_POSITION_PCT  (default 30%)
 *
 *   conviction_factor by weighted score:
 *     score >= 0.40 → 1.00
 *     score >= 0.25 → 0.75
 *     score >= 0.19 → 0.50  (current OPEN threshold)
 *     score <  0.19 → 0     (reject — caller should HOLD)
 *
 *   position_usd = MAX_POSITION_USD × conviction_factor × tier_penalty
 *
 * Floors: never size below MIN_POSITION_USD ($2 default — anything smaller is
 * dust that won't survive swap fees). If math gives a position below the floor
 * but above 0, round up to the floor IF pool can support it; else reject.
 *
 * Caller can invoke this module two ways:
 *   - CLI:   node scripts/position-sizer.js --dry-run [--pool-usd 20] [--score 0.30] [--tier 2]
 *   - Import: import { sizePosition } from './scripts/position-sizer.js'
 *
 * Sasha Coin — Mantle Turing Test Hackathon 2026
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const CAPITAL_POOL_PATH = path.join(WORKSPACE, 'state', 'capital-pool.json')

// ─── Defaults (env-configurable) ─────────────────────────────────────────────
export const SIZER_DEFAULTS = {
    maxPositionPct:    parseFloat(process.env.MAX_POSITION_PCT     || '0.30'),
    minPositionUsd:    parseFloat(process.env.MIN_POSITION_USD     || '2.00'),
    gasReserveUsd:     parseFloat(process.env.GAS_RESERVE_USD      || '5.00'),
    scoreFullSize:     parseFloat(process.env.SCORE_FULL_SIZE      || '0.40'),
    scoreThreeQuarter: parseFloat(process.env.SCORE_THREE_QUARTER  || '0.25'),
    scoreHalf:         parseFloat(process.env.SCORE_HALF           || '0.19'),
}

const TIER_PENALTY = [1.0, 0.85, 0.60]

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the USD size of a position from a signal and a capital pool.
 * @param {object} opts
 * @param {number} opts.poolUsd       — live capital pool in USD (post gas reserve)
 * @param {number} opts.weightedScore — fused signal score in [-1, 1]
 * @param {number} opts.tier          — 1, 2, or 3
 * @param {object} [opts.cfg]         — override defaults (see SIZER_DEFAULTS)
 * @returns {{ sizeUsd:number, convictionFactor:number, tierPenalty:number,
 *             reasoning:string, reject:boolean }}
 */
export function sizePosition({ poolUsd, weightedScore, tier, cfg = {} }) {
    const c = { ...SIZER_DEFAULTS, ...cfg }
    const tierP = TIER_PENALTY[(tier ?? 3) - 1] ?? 0.60

    let convictionFactor
    if (weightedScore >= c.scoreFullSize)        convictionFactor = 1.00
    else if (weightedScore >= c.scoreThreeQuarter) convictionFactor = 0.75
    else if (weightedScore >= c.scoreHalf)         convictionFactor = 0.50
    else convictionFactor = 0

    const maxPositionUsd = Math.max(0, poolUsd) * c.maxPositionPct
    let sizeUsd = maxPositionUsd * convictionFactor * tierP

    if (convictionFactor === 0) {
        return {
            sizeUsd: 0, convictionFactor: 0, tierPenalty: tierP, reject: true,
            reasoning: `Weighted score ${weightedScore.toFixed(3)} below half-size threshold ${c.scoreHalf}. Reject.`,
        }
    }

    if (sizeUsd > 0 && sizeUsd < c.minPositionUsd) {
        if (maxPositionUsd >= c.minPositionUsd) {
            sizeUsd = c.minPositionUsd
        } else {
            return {
                sizeUsd: 0, convictionFactor, tierPenalty: tierP, reject: true,
                reasoning: `Pool too small: max position ${maxPositionUsd.toFixed(2)} < floor ${c.minPositionUsd}. Reject.`,
            }
        }
    }

    sizeUsd = Math.round(sizeUsd * 100) / 100   // round to cents

    return {
        sizeUsd, convictionFactor, tierPenalty: tierP, reject: false,
        reasoning: `Pool $${poolUsd.toFixed(2)} × ${(c.maxPositionPct * 100).toFixed(0)}% cap = $${maxPositionUsd.toFixed(2)} max | conviction ${convictionFactor.toFixed(2)} × tier penalty ${tierP.toFixed(2)} = $${sizeUsd.toFixed(2)}`,
    }
}

/** Load the live capital pool snapshot. Returns null if file missing or stale. */
export function loadCapitalPool() {
    if (!fs.existsSync(CAPITAL_POOL_PATH)) return null
    try {
        const raw = JSON.parse(fs.readFileSync(CAPITAL_POOL_PATH, 'utf8'))
        const ageMin = (Date.now() - new Date(raw.updatedAt).getTime()) / 60_000
        return { ...raw, ageMinutes: ageMin }
    } catch { return null }
}

/** Convenience: size a position from a signal JSON shape + live pool. */
export function sizeFromSignal(signal, poolUsd, cfgOverride = {}) {
    const score = signal?.recommendation?.signalBreakdown?.weights
        ? extractWeightedScore(signal) : 0
    const tier  = signal?.recommendation?.signalBreakdown?.onchain?.topPool?.tier
        ?? signal?.poolData?.topPool?.tier
        ?? 3
    return sizePosition({ poolUsd, weightedScore: score, tier, cfg: cfgOverride })
}

function extractWeightedScore(signal) {
    // Parse the score out of the rationale text — easier than recomputing.
    // The rationale always contains: "Weighted score: 0.300."
    const r = signal?.recommendation?.rationale || ''
    const m = r.match(/[Ww]eighted score:\s*(-?\d+\.\d+)/)
    return m ? parseFloat(m[1]) : 0
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const isMain = (() => {
    try {
        const argvPath = path.resolve(process.argv[1] || '')
        const metaPath = fileURLToPath(import.meta.url)
        return path.resolve(metaPath) === argvPath
    } catch { return false }
})()

if (isMain) {
    const args = process.argv.slice(2)
    const flag = (name, fallback) => {
        const i = args.indexOf(`--${name}`)
        return i !== -1 ? args[i + 1] : fallback
    }
    const dryRun = args.includes('--dry-run') || args.includes('--print')

    const signalArg = flag('signal')
    if (signalArg) {
        const signalPath = path.resolve(WORKSPACE, signalArg.replace(/^\.\//, ''))
        if (!fs.existsSync(signalPath)) { console.error(`Signal not found: ${signalPath}`); process.exit(1) }
        const signal = JSON.parse(fs.readFileSync(signalPath, 'utf8'))
        const pool   = loadCapitalPool()
        const poolUsd = pool ? pool.poolUsd : parseFloat(flag('pool-usd', '20'))
        const result = sizeFromSignal(signal, poolUsd)
        console.log(JSON.stringify({ poolUsd, ...result }, null, 2))
        process.exit(result.reject ? 1 : 0)
    }

    const poolUsd = parseFloat(flag('pool-usd', '20'))
    const score   = parseFloat(flag('score', '0.30'))
    const tier    = parseInt(flag('tier', '2'))
    const result  = sizePosition({ poolUsd, weightedScore: score, tier })

    console.log(`\n[position-sizer] inputs: poolUsd=$${poolUsd} score=${score} tier=${tier}`)
    console.log('[position-sizer] result:')
    console.log(JSON.stringify(result, null, 2))
    if (dryRun) console.log('\n(--dry-run / --print: no writes)')
    process.exit(result.reject ? 1 : 0)
}
