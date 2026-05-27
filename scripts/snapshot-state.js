#!/usr/bin/env node
/**
 * snapshot-state.js — Append-only history snapshots for the dashboards.
 *
 * The live state files (content/mantle-signal.json, state/capital-pool.json) are
 * overwritten on every run, so they hold only the latest value. The dashboards
 * need TREND data: the Mantle signal-history chart and the capital sparklines.
 * This script appends a compact snapshot of each to a history file every time it
 * runs, capped to a rolling window.
 *
 * Writes:
 *   state/mantle-signal-history.json   — one entry per distinct signal generation
 *   state/capital-pool-history.json    — one entry per run
 *
 * Usage:
 *   node scripts/snapshot-state.js            # append snapshots
 *   node scripts/snapshot-state.js --dry-run  # print, do not write
 *
 * Cron-safe: never throws, always exits 0. Suggested cadence: every 6h, right
 * after mantle-signal.js refreshes (HEARTBEAT.md).
 *
 * Sasha Coin — dashboard data layer
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const DRY_RUN = process.argv.slice(2).includes('--dry-run')

const SIGNAL_PATH         = path.join(WORKSPACE, 'content', 'mantle-signal.json')
const CAPITAL_PATH        = path.join(WORKSPACE, 'state', 'capital-pool.json')
const SIGNAL_HISTORY_PATH = path.join(WORKSPACE, 'state', 'mantle-signal-history.json')
const CAPITAL_HISTORY_PATH = path.join(WORKSPACE, 'state', 'capital-pool-history.json')

const MAX_ENTRIES = 360   // ~90 days at a 6h cadence

function log(msg) { console.log(`[snapshot] ${msg}`) }

function loadJson(p) {
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
    catch (e) { log(`could not read ${path.basename(p)}: ${e.message}`); return null }
}

function loadArray(p) {
    const data = loadJson(p)
    return Array.isArray(data) ? data : []
}

function saveArray(p, arr) {
    if (DRY_RUN) { log(`[dry-run] would write ${arr.length} entries to ${path.basename(p)}`); return }
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(arr, null, 2))
    log(`wrote ${arr.length} entries to ${path.basename(p)}`)
}

// risk level mirror of byreal-trade.js / push-signal-to-xlayer.js
function extractRiskLevel(signal) {
    const social = signal?.socialBias?.riskAppetite
    if (social === 'risk-on' || social === 'neutral' || social === 'risk-off') return social
    const action = signal?.recommendation?.action
    if (action === 'MOVE_TO_STABLE') return 'risk-off'
    if (action === 'OPEN_LP_POSITION' || action === 'SWAP_TO_SOL') return 'risk-on'
    return 'neutral'
}

function snapshotSignal() {
    const signal = loadJson(SIGNAL_PATH)
    if (!signal) { log('no signal file — skipping signal snapshot'); return }

    const generatedAt = signal.generatedAt || new Date().toISOString()
    const history = loadArray(SIGNAL_HISTORY_PATH)

    // Dedupe: a cron run with no fresh signal should not create a duplicate point.
    if (history.length && history[history.length - 1].generatedAt === generatedAt) {
        log(`signal unchanged (${generatedAt}) — no new point`)
        return
    }

    const top = signal?.poolData?.topPool || {}
    const entry = {
        generatedAt,
        riskLevel:      extractRiskLevel(signal),
        confidence:     signal?.socialBias?.confidence ?? null,
        recommendation: signal?.recommendation?.action ?? 'HOLD',
        weightedScore:  signal?.weightedScore ?? signal?.score ?? null,
        weights:        signal?.signalWeights ?? null,
        sources: {
            allora:     signal?.alloraSignal     != null,
            elfa:       signal?.elfaSignal        != null,
            polymarket: signal?.polymarketSignal  != null,
        },
        topPool: top.name ? {
            name:         top.name,
            apr24h:       top.apr24h ?? null,
            tvl:          top.tvl ?? null,
            qualityScore: top.qualityScore ?? null,
        } : null,
    }

    history.push(entry)
    saveArray(SIGNAL_HISTORY_PATH, history.slice(-MAX_ENTRIES))
}

function snapshotCapital() {
    const cap = loadJson(CAPITAL_PATH)
    if (!cap) { log('no capital file — skipping capital snapshot'); return }

    const history = loadArray(CAPITAL_HISTORY_PATH)
    const entry = {
        at:        new Date().toISOString(),
        totalUsd:  cap.totalUsd ?? null,
        poolUsd:   cap.poolUsd ?? null,
        solanaUsd: cap?.solana?.totalUsd ?? null,
        mantleUsd: cap?.mantle?.totalUsd ?? null,
    }

    history.push(entry)
    saveArray(CAPITAL_HISTORY_PATH, history.slice(-MAX_ENTRIES))
}

function main() {
    log(`Starting snapshot — mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
    snapshotSignal()
    snapshotCapital()
    log('Done.')
    process.exit(0)
}

try { main() } catch (e) {
    console.warn(`[snapshot] non-fatal: ${e.message}`)
    process.exit(0)
}
