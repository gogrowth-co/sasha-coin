#!/usr/bin/env node
/**
 * byreal-oor-watch.js — Out-of-range monitor for Byreal Solana LP positions
 *
 * Polls all open Byreal positions via `byreal-cli positions list` and fires a
 * Telegram alert when any position goes out-of-range. Designed to run while the
 * main trade cron (sasha-trade) is hibernated so unmanaged positions don't drift
 * silently.
 *
 * Reads:  live byreal-cli output (on-chain, not a cached file)
 * Writes: state/byreal-oor-watch.json  (last run state, for dashboard visibility)
 *
 * Alert logic:
 *   - First OOR detection: Telegram alert "OOR detected on <pair>"
 *   - Sustained OOR (≥ 60 min): re-alert every 60 min until back in range
 *   - Back in range after OOR: Telegram confirmation "back in range"
 *
 * Usage:
 *   node scripts/byreal-oor-watch.js          # check all positions
 *   node scripts/byreal-oor-watch.js --dry-run # check, print, no writes/alerts
 *
 * Sasha Coin — Trader hibernate watchdog
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const DRY_RUN = process.argv.slice(2).includes('--dry-run')

const STATE_PATH = path.join(WORKSPACE, 'state', 'byreal-oor-watch.json')

// Re-alert every 60 min for sustained OOR
const REALER_INTERVAL_MS = 60 * 60 * 1000

// ─── Telegram ──────────────────────────────────────────────────────────────

function sendTelegram(msg) {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) { log('no Telegram creds — skipping alert'); return }
    if (DRY_RUN) { log(`[dry-run] Telegram: ${msg}`); return }
    const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }
    const req = https.request(options, () => {})
    req.on('error', () => {})
    req.write(body)
    req.end()
}

function log(m) { console.log(`[byreal-oor-watch] ${m}`) }

// ─── State ─────────────────────────────────────────────────────────────────

function loadState() {
    try { return fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : {} }
    catch { return {} }
}

function saveState(s) {
    if (DRY_RUN) return
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
    fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2))
}

// ─── Byreal query ──────────────────────────────────────────────────────────

function fetchPositions() {
    const r = spawnSync('byreal-cli', ['positions', 'list', '-o', 'json'], {
        encoding: 'utf8',
        timeout: 60_000,
    })
    if (r.status !== 0 || !r.stdout) {
        const err = (r.stderr || '').slice(0, 200)
        throw new Error(`byreal-cli failed (exit ${r.status}): ${err}`)
    }
    const j = JSON.parse(r.stdout)
    return (j?.data?.positions) || []
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    log(`starting check (${new Date().toISOString()})${DRY_RUN ? ' [dry-run]' : ''}`)

    let positions
    try {
        positions = fetchPositions()
    } catch (err) {
        log(`byreal-cli error: ${err.message}`)
        sendTelegram(`⚠️ <b>[BYREAL-OOR-WATCH]</b> byreal-cli failed — cannot check positions\n${err.message}`)
        process.exit(0)
    }

    if (!positions.length) {
        log('no positions returned — nothing to watch')
        saveState({ checkedAt: new Date().toISOString(), positions: [], allInRange: true })
        process.exit(0)
    }

    const now = Date.now()
    const state = loadState()
    const prevOor = state.oorPositions || {}  // nftMint -> { firstOorAt, lastAlertAt }

    const summary = []
    const newOor = {}

    for (const p of positions) {
        const key = p.nftMintAddress || p.positionAddress || p.pair
        const inRange = p.status === 0
        const pair = p.pair || `${p.tokenSymbolA}/${p.tokenSymbolB}`
        const liqUsd = Number(p.liquidityUsd || 0).toFixed(2)
        const earned = Number(p.earnedUsd || 0).toFixed(4)
        const pnl    = Number(p.pnlUsd || 0).toFixed(4)

        summary.push({ key, pair, inRange, liquidityUsd: liqUsd, earnedUsd: earned, pnlUsd: pnl })

        if (!inRange) {
            const prev = prevOor[key] || {}
            const firstOorAt = prev.firstOorAt || new Date().toISOString()
            const lastAlertAt = prev.lastAlertAt || null
            const oorMs = now - new Date(firstOorAt).getTime()
            const oorMin = Math.round(oorMs / 60_000)
            const shouldAlert = !lastAlertAt || (now - new Date(lastAlertAt).getTime()) >= REALER_INTERVAL_MS

            if (shouldAlert) {
                const tag = oorMin > 0 ? ` (OOR for ${oorMin} min)` : ' (just went OOR)'
                const msg = `🔴 <b>[BYREAL-OOR-WATCH]</b> ${pair} out of range${tag}\n` +
                    `Liquidity: $${liqUsd} | Earned: $${earned} | PnL: $${pnl}\n` +
                    `<i>Trader hibernated — manual action required. Check positions.js or close via byreal-cli.</i>`
                log(`OOR alert: ${pair}${tag}`)
                sendTelegram(msg)
            } else {
                log(`${pair} still OOR (${oorMin} min), next alert in ${Math.round((REALER_INTERVAL_MS - (now - new Date(lastAlertAt).getTime())) / 60_000)} min`)
            }

            newOor[key] = {
                pair,
                firstOorAt,
                lastAlertAt: shouldAlert ? new Date().toISOString() : lastAlertAt,
                liquidityUsd: liqUsd,
            }
        } else {
            // Back in range — alert if was previously OOR
            if (prevOor[key]) {
                const oorMs = now - new Date(prevOor[key].firstOorAt).getTime()
                const oorMin = Math.round(oorMs / 60_000)
                const msg = `✅ <b>[BYREAL-OOR-WATCH]</b> ${pair} back in range after ${oorMin} min`
                log(`back in range: ${pair} (was OOR ${oorMin} min)`)
                sendTelegram(msg)
            } else {
                log(`${pair} in range ($${liqUsd} liq)`)
            }
        }
    }

    const allInRange = summary.every(p => p.inRange)
    if (allInRange) log('all positions in range')

    saveState({
        checkedAt: new Date().toISOString(),
        allInRange,
        positions: summary,
        oorPositions: newOor,
    })

    log('done')
    process.exit(0)
}

main().catch(err => {
    console.error('[byreal-oor-watch] fatal:', err.message)
    process.exit(0)   // cron-safe: never exit non-zero
})
