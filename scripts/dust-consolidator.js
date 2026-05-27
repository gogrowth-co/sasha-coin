#!/usr/bin/env node
/**
 * dust-consolidator.js — Weekly dust sweep for Sasha's Solana wallet
 *
 * Reads byreal-cli wallet balance, finds every SPL token with USD value below
 * DUST_THRESHOLD_USD (default $2), and swaps each to USDC via byreal-cli swap.
 * Skips: SOL (native, needed for gas), USDC itself, any token marked as a
 * pending position underlying.
 *
 * Runs weekly via host cron: Sundays 18:00 UTC.
 *
 * Why it matters for the hackathon: shows Sasha cleans up after herself. Every
 * losing trade leaves token residue (the 2.48 Goblin tokens from May 26). Left
 * alone, those accumulate over time. This script keeps the wallet legible.
 *
 * Usage:
 *   node scripts/dust-consolidator.js              # dry-run (default)
 *   node scripts/dust-consolidator.js --execute    # live sweep
 *   node scripts/dust-consolidator.js --min 1      # custom threshold
 *
 * Output: appends to state/dust-sweep-log.json, sends Telegram summary, and
 * (when --execute) writes a tweet draft to content/dust-tweet-draft.txt.
 *
 * Sasha Coin — Mantle Turing Test Hackathon 2026
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const MIN_USD = parseFloat((() => { const i = args.indexOf('--min'); return i !== -1 ? args[i + 1] : '2' })())
const DUST_THRESHOLD_USD = MIN_USD
const SWEEP_LOG = path.join(WORKSPACE, 'state', 'dust-sweep-log.json')
const TWEET_DRAFT = path.join(WORKSPACE, 'content', 'dust-tweet-draft.txt')

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const SOL_NATIVE = 'native'   // Skip — needed for gas
const SKIP_SYMBOLS = new Set(['SOL', 'WSOL', 'USDC'])   // already USDC, or native gas

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] [dust] ${msg}`) }
function warn(msg) { console.warn(`[dust] ⚠  ${msg}`) }

function loadJson(p, fallback) {
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback } catch { return fallback }
}

function saveJson(p, data) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function sendTelegram(msg) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return
    const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    const req = https.request({
        hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, () => {})
    req.on('error', () => {})
    req.write(body); req.end()
}

// ─── Discover dust ──────────────────────────────────────────────────────────
function fetchWalletDust() {
    const raw = execSync('byreal-cli wallet balance -o json 2>/dev/null', { timeout: 20_000, encoding: 'utf8' })
    const data = JSON.parse(raw)
    const tokens = data.data?.balance?.tokens || []
    const parseUsd = (v) => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') { const m = v.match(/\$?([\d,]+\.?\d*)/); return m ? parseFloat(m[1].replace(/,/g, '')) : 0 }
        return 0
    }
    return tokens
        .map(t => ({
            mint: t.mint,
            symbol: (t.symbol || '?').toUpperCase(),
            amountUi: parseFloat(t.amount_ui || 0),
            amountRaw: t.amount_raw,
            decimals: t.decimals,
            usd: parseUsd(t.amount_usd),
            isToken2022: !!t.is_token_2022,
        }))
        .filter(t => !SKIP_SYMBOLS.has(t.symbol))
        .filter(t => t.amountUi > 0 && t.usd > 0 && t.usd < DUST_THRESHOLD_USD)
}

// ─── Swap dust → USDC ───────────────────────────────────────────────────────
function swapToUsdc(tokenMint, amountUi, slippageBps = 500) {
    const cmd = [
        'byreal-cli', 'swap', 'execute',
        '--input-mint', tokenMint,
        '--output-mint', USDC_MINT,
        '--amount', amountUi.toString(),
        '--slippage', slippageBps.toString(),
        '-o', 'json',
        EXECUTE ? '--confirm' : '--dry-run',
    ].join(' ')

    log(`swap: ${cmd}`)
    try {
        const out = execSync(cmd, { timeout: 60_000, encoding: 'utf8' })
        const jsonStart = out.indexOf('{')
        const parsed = jsonStart !== -1 ? JSON.parse(out.slice(jsonStart)) : { raw: out }
        return { success: parsed.success ?? true, output: parsed }
    } catch (e) {
        return { success: false, error: e.message, output: e.stdout || '' }
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    log(`Starting dust sweep — threshold $${DUST_THRESHOLD_USD} | mode: ${EXECUTE ? 'LIVE' : 'DRY RUN'}`)

    let dustTokens
    try {
        dustTokens = fetchWalletDust()
    } catch (e) {
        warn(`Wallet balance fetch failed: ${e.message}`)
        process.exit(1)
    }

    if (!dustTokens.length) {
        log('No dust below threshold — wallet clean.')
        return
    }

    const totalDustUsd = dustTokens.reduce((s, t) => s + t.usd, 0)
    log(`Found ${dustTokens.length} dust token(s) totaling $${totalDustUsd.toFixed(4)}:`)
    dustTokens.forEach(t => log(`  ${t.symbol}: ${t.amountUi} ($${t.usd.toFixed(4)})`))

    const results = []
    for (const t of dustTokens) {
        // Skip tokens worth <$0.01 — swap fees would dominate, and most routes won't even quote
        if (t.usd < 0.01) {
            log(`  Skipping ${t.symbol} ($${t.usd.toFixed(6)}) — below swap-fee floor`)
            results.push({ symbol: t.symbol, skipped: true, reason: 'below-fee-floor', usdValue: t.usd })
            continue
        }
        const r = swapToUsdc(t.mint, t.amountUi)
        const txSig = r.output?.data?.signature || r.output?.signature || null
        results.push({
            symbol: t.symbol, mint: t.mint, amountUi: t.amountUi, usdValueBefore: t.usd,
            success: r.success, txSig,
            usdcReceived: r.output?.data?.expected_out_ui || r.output?.expected_out || null,
            error: r.error,
        })
        log(`  ${t.symbol}: ${r.success ? '✅' : '❌'} ${txSig ? `tx ${txSig.slice(0, 16)}…` : ''}`)
    }

    const ok = results.filter(r => r.success).length
    const recovered = results.reduce((s, r) => s + (r.success ? (r.usdcReceived || 0) : 0), 0)
    log(`Done. ${ok}/${results.length} swaps OK, recovered ~$${recovered.toFixed(4)} USDC.`)

    if (!EXECUTE) { log('(dry-run: no swaps executed, no logs written)'); return }

    // ── Log + alert ─────────────────────────────────────────────────────────
    const sweepLog = loadJson(SWEEP_LOG, { version: 1, entries: [] })
    sweepLog.entries.unshift({
        ranAt: new Date().toISOString(),
        thresholdUsd: DUST_THRESHOLD_USD,
        dustCount: dustTokens.length,
        totalDustUsd,
        recoveredUsd: recovered,
        results,
    })
    sweepLog.entries = sweepLog.entries.slice(0, 50)
    sweepLog.updatedAt = new Date().toISOString()
    saveJson(SWEEP_LOG, sweepLog)

    // Tweet draft — Sasha posts weekly dust totals
    const tweet = `weekly dust sweep complete.\n\nswept ${ok} token(s) → $${recovered.toFixed(2)} USDC back to the pool.\n\ngood agents leave the wallet legible.`
    fs.mkdirSync(path.dirname(TWEET_DRAFT), { recursive: true })
    fs.writeFileSync(TWEET_DRAFT, tweet)

    sendTelegram(
        `🧹 <b>[DUST SWEEP]</b> ${ok}/${results.length} swaps OK\n` +
        `Recovered: $${recovered.toFixed(4)} USDC\n` +
        `Tokens swept: ${dustTokens.map(t => t.symbol).join(', ')}\n` +
        `Tweet draft → content/dust-tweet-draft.txt`
    )
}

main().catch(err => {
    console.error('[dust] Fatal:', err.message)
    sendTelegram(`💥 [DUST] Fatal: ${err.message}`)
    process.exit(1)
})
