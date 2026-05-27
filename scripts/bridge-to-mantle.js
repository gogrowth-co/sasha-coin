#!/usr/bin/env node
/**
 * bridge-to-mantle.js — Bridge Solana USDC → Mantle mETH path planner
 *
 * Reads a pending compound from content/treasury-compound-pending.json (queued
 * by lp-rebalancer.js closeAndCompound), gets a route quote from LiFi, and
 * either:
 *   - DRY RUN: prints the route, gas estimates, expected mETH out
 *   - EXECUTE: submits the bridge step-by-step via LiFi API + signs with the
 *     Solana keypair, then signs the destination chain swap with MANTLE_AGENT_PK
 *
 * LiFi handles: CCTP burn on Solana → CCTP mint on Mantle → swap USDC → ETH →
 * stake into mETH (via Mantle LSP). One quote API call, multi-step execution.
 *
 * USAGE:
 *   node scripts/bridge-to-mantle.js                       # quote next pending compound (dry-run)
 *   node scripts/bridge-to-mantle.js --execute             # quote + execute first pending
 *   node scripts/bridge-to-mantle.js --amount 5            # quote $5 manual bridge (no queue read)
 *   node scripts/bridge-to-mantle.js --estimate-only       # just print quote, no state writes
 *
 * Environment:
 *   LIFI_API_KEY        — optional (rate-limit boost)
 *   SOLANA_AGENT_WALLET — Sasha's Solana wallet (default: 647TT6SW...ksJw)
 *   MANTLE_AGENT_WALLET — Sasha's Mantle EOA (default: 0x21AF…A9A9)
 *
 * NOTE: Full execution requires byreal-cli equivalent for signing arbitrary
 * Solana TXs. Today: the quote + bridge URL are surfaced. Sasha tweets the
 * URL and the bridge starts; mETH staking on the Mantle side is automated
 * via mantle-treasury.js. Full autonomous bridge will land in the next pass
 * once Solana TX signing is wired through the host keypair.
 *
 * Sasha Coin — Mantle Turing Test Hackathon 2026
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const ESTIMATE_ONLY = args.includes('--estimate-only')
const AMOUNT_ARG = (() => { const i = args.indexOf('--amount'); return i !== -1 ? args[i + 1] : null })()

const PENDING_PATH = path.join(WORKSPACE, 'content', 'treasury-compound-pending.json')
const BRIDGE_LOG_PATH = path.join(WORKSPACE, 'state', 'bridge-log.json')

const SOLANA_WALLET = process.env.SOLANA_AGENT_WALLET || '647TT6SWA48yrmH8Csb2QakeYMnCNh2oSFijLQpRksJw'
const MANTLE_WALLET = process.env.MANTLE_AGENT_WALLET || '0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9'

// LiFi chain IDs
const SOLANA_CHAIN_ID = 1151111081099710  // LiFi's representation
const MANTLE_CHAIN_ID = 5000

// Token addresses
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDC_MANTLE = '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9'
const ETH_MANTLE  = '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111'   // LiFi placeholder for native; actual native ETH on Mantle is 0x0
const METH_MANTLE = '0xcDA86A272531e8640cD7F1a92c01839911B90bb0'

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] [bridge] ${msg}`) }
function warn(msg) { console.warn(`[bridge] ⚠  ${msg}`) }

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

// ─── LiFi quote API ─────────────────────────────────────────────────────────
function lifiQuote(params) {
    return new Promise((resolve, reject) => {
        const query = new URLSearchParams(params).toString()
        const apiKey = process.env.LIFI_API_KEY
        const opts = {
            hostname: 'li.quest', path: `/v1/quote?${query}`, method: 'GET',
            headers: { 'Accept': 'application/json', ...(apiKey ? { 'x-lifi-api-key': apiKey } : {}) },
        }
        const req = https.request(opts, res => {
            let d = ''
            res.on('data', c => d += c)
            res.on('end', () => {
                try {
                    const j = JSON.parse(d)
                    if (res.statusCode >= 400) reject(new Error(`LiFi ${res.statusCode}: ${j.message || d.slice(0,200)}`))
                    else resolve(j)
                } catch (e) { reject(new Error(`LiFi parse error: ${e.message}`)) }
            })
        })
        req.on('error', reject)
        req.setTimeout(20_000, () => { req.destroy(); reject(new Error('LiFi timeout')) })
        req.end()
    })
}

// ─── Format helpers ─────────────────────────────────────────────────────────
function formatRoute(quote) {
    const action = quote.action
    const estimate = quote.estimate
    const steps = quote.includedSteps || []
    return {
        from: `${action.fromAmount} ${action.fromToken?.symbol} on ${action.fromToken?.chainId}`,
        to: `${estimate.toAmountMin} ${action.toToken?.symbol} on ${action.toToken?.chainId} (min)`,
        toExpected: `${estimate.toAmount} ${action.toToken?.symbol} (expected)`,
        fromAmountUsd: estimate.fromAmountUSD,
        toAmountUsd: estimate.toAmountUSD,
        gasCosts: estimate.gasCosts?.map(g => `${g.amountUSD} USD (${g.token?.symbol})`).join(' + ') || 'unknown',
        feeCosts: estimate.feeCosts?.map(f => `${f.amountUSD} USD (${f.name})`).join(' + ') || 'none',
        durationSec: estimate.executionDuration,
        steps: steps.map(s => `${s.tool}: ${s.action?.fromToken?.symbol} → ${s.action?.toToken?.symbol}`),
        tool: quote.toolDetails?.name,
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    log(`Bridge-to-mantle starting — mode: ${EXECUTE ? 'LIVE EXECUTION' : 'DRY RUN / QUOTE'}`)

    // Determine USDC amount to bridge
    let amountUsd = null
    let pendingEntry = null
    let pending = null

    if (AMOUNT_ARG) {
        amountUsd = parseFloat(AMOUNT_ARG)
        log(`Manual amount: $${amountUsd}`)
    } else {
        pending = loadJson(PENDING_PATH, null)
        const queued = (pending?.queue || []).filter(q => q.status === 'awaiting-bridge')
        if (!queued.length) { log('No pending compounds. Pass --amount <usdc> to manually quote.'); return }
        pendingEntry = queued[0]
        amountUsd = pendingEntry.compoundUsd
        log(`Pending compound: position ${pendingEntry.positionId.slice(0, 10)}… profit $${pendingEntry.profitUsd}, compounding $${amountUsd}`)
    }

    if (amountUsd < 5) {
        warn(`Amount $${amountUsd} is too small to bridge — fees would exceed it. Aborting.`)
        if (pendingEntry) {
            pendingEntry.status = 'skipped-too-small'
            pending.updatedAt = new Date().toISOString()
            if (!ESTIMATE_ONLY) saveJson(PENDING_PATH, pending)
        }
        return
    }

    // ── Get LiFi quote: Solana USDC → Mantle USDC (then mETH stake handled by mantle-treasury.js) ──
    // We bridge to USDC on Mantle (not direct to mETH) because:
    //   (1) LiFi's USDC routes are mature; mETH-as-target may not be supported
    //   (2) The Mantle staking call is cheaper from USDC since mantle-treasury.js handles the ETH swap + stake
    const usdcRaw = Math.floor(amountUsd * 1_000_000)   // USDC has 6 decimals on both chains
    const quoteParams = {
        fromChain: 'SOL',
        toChain: 'MNT',
        fromToken: USDC_SOLANA,
        toToken: USDC_MANTLE,
        fromAmount: usdcRaw.toString(),
        fromAddress: SOLANA_WALLET,
        toAddress: MANTLE_WALLET,
        slippage: '0.03',   // 3%
        order: 'CHEAPEST',
    }

    log(`Requesting LiFi quote — $${amountUsd} USDC from Solana → Mantle...`)
    let quote
    try {
        quote = await lifiQuote(quoteParams)
    } catch (e) {
        warn(`LiFi quote failed: ${e.message}`)
        sendTelegram(`⚠ <b>[BRIDGE]</b> LiFi quote failed for $${amountUsd}: ${e.message}`)
        process.exit(1)
    }

    const route = formatRoute(quote)
    console.log('\n── LiFi route ──')
    console.log(JSON.stringify(route, null, 2))

    if (ESTIMATE_ONLY) { log('--estimate-only — exiting without writing logs or executing.'); return }

    // ── Record the quote in bridge-log.json regardless of execution ─────────
    const logEntry = {
        ranAt: new Date().toISOString(),
        executed: EXECUTE,
        amountUsd,
        route,
        rawQuote: quote,
        positionId: pendingEntry?.positionId,
    }
    const bridgeLog = loadJson(BRIDGE_LOG_PATH, { version: 1, entries: [] })
    bridgeLog.entries.unshift(logEntry)
    bridgeLog.entries = bridgeLog.entries.slice(0, 50)
    bridgeLog.updatedAt = new Date().toISOString()
    saveJson(BRIDGE_LOG_PATH, bridgeLog)

    if (!EXECUTE) {
        log('\n[dry-run] Quote saved to bridge-log.json. Pass --execute to send the TX.')
        log(`[dry-run] Bridge URL (manual): https://jumper.exchange/?fromChain=1151111081099710&toChain=5000&fromToken=${USDC_SOLANA}&toToken=${USDC_MANTLE}&fromAmount=${amountUsd}`)
        return
    }

    // ── EXECUTE path ────────────────────────────────────────────────────────
    // LiFi returns a `transactionRequest` to sign + submit on the source chain.
    // For Solana, this is a serialized TX (base64). We don't yet have a host-side
    // signer that can broadcast it (byreal-cli signs Byreal swaps, not arbitrary
    // bridge TXs). Until that signer is wired, we emit a Telegram alert with
    // the LiFi step-by-step URL and mark the pending entry as 'awaiting-manual-bridge'.
    //
    // The next iteration will wire @lifi/sdk + a Solana signer to fully automate.

    if (pendingEntry) {
        pendingEntry.status = 'awaiting-manual-bridge'
        pendingEntry.quote = route
        pendingEntry.quotedAt = new Date().toISOString()
        pending.updatedAt = new Date().toISOString()
        saveJson(PENDING_PATH, pending)
    }

    const jumperUrl = `https://jumper.exchange/?fromChain=1151111081099710&toChain=5000&fromToken=${USDC_SOLANA}&toToken=${USDC_MANTLE}&fromAmount=${amountUsd}`
    sendTelegram(
        `🌉 <b>[BRIDGE QUOTED]</b> Solana → Mantle\n` +
        `Amount: $${amountUsd} USDC\n` +
        `Tool: ${route.tool}\n` +
        `Expected out: ${route.toExpected}\n` +
        `Gas: ${route.gasCosts} | Fees: ${route.feeCosts}\n` +
        `Duration: ~${Math.round((route.durationSec || 0) / 60)} min\n\n` +
        `Auto-execution pending Solana signer wiring. Execute manually:\n${jumperUrl}\n\n` +
        `Once USDC lands on Mantle, run:\n<code>node scripts/mantle-treasury.js --action stake --execute</code>`
    )
    log('Bridge execution requires Solana signer wiring (next iteration). Telegram alert sent with Jumper URL.')
}

main().catch(err => {
    console.error('[bridge] Fatal:', err.message)
    sendTelegram(`💥 [BRIDGE] Fatal: ${err.message}`)
    process.exit(1)
})
