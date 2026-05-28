#!/usr/bin/env node
/**
 * auto-trade.js — Autonomous cron entry point for Sasha's trade loop.
 *
 * Flow:
 *   1. Refresh mantle-signal.json (runs mantle-signal.js)
 *   2. Read recommendation
 *   3. HOLD    → Telegram "📊 signal checked, holding" → exit 0
 *   4. OPEN_LP_POSITION → rate-limit check (23h window) → run byreal-trade.js
 *   5. Exit 0 always (cron-safe, no retry loops)
 *
 * Triggered by VPS cron: /etc/cron.d/sasha-trade
 *   0 12,17,21 * * * root cd <workspace> && source .env && node scripts/auto-trade.js >> /var/log/sasha-trade.log 2>&1
 *
 * Kill switch: rm /etc/cron.d/sasha-trade
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE  = path.resolve(__dirname, '..')
const SIGNAL_PATH = path.join(WORKSPACE, 'content', 'mantle-signal.json')
const TRADE_LOG   = path.join(WORKSPACE, 'state', 'mantle-trade-log.json')

const RATE_LIMIT_HOURS = 23   // max one successful LP open per window
const MAX_SIGNAL_AGE_H = 4    // refuse to act on signals older than this

// ---------------------------------------------------------------------------
// Telegram helper (same env vars as byreal-trade.js)
// ---------------------------------------------------------------------------
async function sendTelegram(text) {
    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.TERMUX_BRIDGE_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID   || process.env.COMMANDER_CHAT_ID
    if (!token || !chatId) return
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        })
    } catch {}
}

// ---------------------------------------------------------------------------
// Rate-limit check
// ---------------------------------------------------------------------------
function wasRecentlyTraded() {
    if (!fs.existsSync(TRADE_LOG)) return false
    try {
        const raw = JSON.parse(fs.readFileSync(TRADE_LOG, 'utf8'))
        const trades = Array.isArray(raw) ? raw : raw.trades || []
        const successfulTrades = trades.filter(t => t.status === 'success' || t.status === 'executed')
        if (!successfulTrades.length) return false
        const last = successfulTrades.sort((a, b) =>
            new Date(b.executedAt) - new Date(a.executedAt)
        )[0]
        const ageHours = (Date.now() - new Date(last.executedAt).getTime()) / 3_600_000
        return ageHours < RATE_LIMIT_HOURS
    } catch {
        return false
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const now = new Date().toISOString()
    console.log(`\n[auto-trade] ${now} — starting autonomous trade check`)

    // Step 1: Refresh signal
    console.log('[auto-trade] Refreshing signal...')
    const sigResult = spawnSync('node', ['scripts/mantle-signal.js'], {
        encoding: 'utf8',
        cwd: WORKSPACE,
        timeout: 60_000,
        env: { ...process.env },
    })
    if (sigResult.status !== 0) {
        const err = sigResult.stderr?.trim() || sigResult.stdout?.trim() || '(no output)'
        console.error(`[auto-trade] Signal refresh failed: ${err}`)
        await sendTelegram(`⚠️ [AUTO-TRADE] Signal refresh failed\n${err.slice(0, 200)}`)
        process.exit(0)  // cron-safe exit
    }
    console.log(sigResult.stdout?.trim())

    // Step 2: Read recommendation
    if (!fs.existsSync(SIGNAL_PATH)) {
        console.error('[auto-trade] Signal file missing after refresh — aborting')
        await sendTelegram('⚠️ [AUTO-TRADE] Signal file missing after refresh')
        process.exit(0)
    }

    let signal
    try {
        signal = JSON.parse(fs.readFileSync(SIGNAL_PATH, 'utf8'))
    } catch (e) {
        console.error(`[auto-trade] Failed to parse signal file: ${e.message}`)
        process.exit(0)
    }

    const recommendation = signal?.recommendation?.action || signal?.recommendation || 'HOLD'
    const score = signal?.weightedScore ?? signal?.score ?? 0
    const generatedAt = signal?.generatedAt || signal?.timestamp || now
    const ageHours = (Date.now() - new Date(generatedAt).getTime()) / 3_600_000

    console.log(`[auto-trade] Recommendation: ${recommendation} (score: ${score}, age: ${ageHours.toFixed(1)}h)`)

    // Step 3: HOLD path
    if (recommendation !== 'OPEN_LP_POSITION') {
        console.log('[auto-trade] Signal is HOLD — no trade')
        await sendTelegram(`📊 <b>[AUTO-TRADE]</b> Signal checked — holding\nScore: ${score.toFixed(3)} | Rec: ${recommendation}`)
        process.exit(0)
    }

    // Signal age guard
    if (ageHours > MAX_SIGNAL_AGE_H) {
        console.warn(`[auto-trade] Signal too old (${ageHours.toFixed(1)}h) — skipping`)
        await sendTelegram(`⚠️ [AUTO-TRADE] Stale signal (${ageHours.toFixed(1)}h old) — skipping trade`)
        process.exit(0)
    }

    // Step 4: Rate-limit check
    if (wasRecentlyTraded()) {
        console.log(`[auto-trade] Already traded within ${RATE_LIMIT_HOURS}h — skipping`)
        await sendTelegram(`⏳ <b>[AUTO-TRADE]</b> Signal is bullish but rate-limit active (${RATE_LIMIT_HOURS}h window)\nScore: ${score.toFixed(3)}`)
        process.exit(0)
    }

    // Step 5: Execute trade
    console.log('[auto-trade] OPEN_LP_POSITION — executing byreal-trade.js...')
    await sendTelegram(`🔄 <b>[AUTO-TRADE]</b> Signal bullish (${score.toFixed(3)}) — starting trade loop`)

    const tradeResult = spawnSync('node', ['scripts/byreal-trade.js'], {
        encoding: 'utf8',
        cwd: WORKSPACE,
        timeout: 300_000,   // 5 min max (60s wait + trade + attestation)
        env: { ...process.env },
        stdio: 'inherit',   // pipe stdout/stderr directly to log
    })

    if (tradeResult.status !== 0) {
        const err = (tradeResult.stderr || '').trim().split('\n').slice(-3).join('\n')
        console.error(`[auto-trade] Trade loop exited with status ${tradeResult.status}`)
        await sendTelegram(`❌ <b>[AUTO-TRADE]</b> Trade loop failed (exit ${tradeResult.status})\n${err.slice(0, 200)}`)
    } else {
        console.log('[auto-trade] Trade loop completed successfully')
    }

    // Always exit 0 — cron should not retry on failure
    process.exit(0)
}

main().catch(async (err) => {
    console.error('[auto-trade] Uncaught error:', err.message)
    await sendTelegram(`💥 [AUTO-TRADE] Uncaught error: ${err.message}`)
    process.exit(0)
})
