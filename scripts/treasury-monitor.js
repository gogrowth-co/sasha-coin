#!/usr/bin/env node
/**
 * treasury-monitor.js — Sasha's capital + deposit detector
 *
 * Two responsibilities, runs every 30 min via host cron:
 *   1. Snapshot the live capital pool (Solana USDC + SOL + bridged USDC) to
 *      state/capital-pool.json. position-sizer.js reads this.
 *   2. Detect new inbound TXs to Sasha's wallets and append them to
 *      state/deposits.json. On a fresh deposit, queue a "thanks for capital" tweet.
 *
 * Wallets tracked:
 *   Solana  — 647TT6SWA48yrmH8Csb2QakeYMnCNh2oSFijLQpRksJw  (Byreal LP wallet)
 *   Mantle  — 0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9    (ERC-8004 agent EOA)
 *
 * The capital pool definition:
 *   pool_usd = total_usd_value - GAS_RESERVE_USD
 *   total_usd_value = USDC + SOL × price(SOL) + (USDT, USDS, etc.)
 *
 * Gas reserve: kept aside for ~50 swap signatures × estimated gas. Default $5.
 *
 * Usage:
 *   node scripts/treasury-monitor.js                    # snapshot + check deposits
 *   node scripts/treasury-monitor.js --dry-run          # print, no writes
 *   node scripts/treasury-monitor.js --no-deposits      # skip deposit check
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
const DRY_RUN     = args.includes('--dry-run')
const NO_DEPOSITS = args.includes('--no-deposits')

// ─── Config ──────────────────────────────────────────────────────────────────
const SOLANA_WALLET = process.env.SOLANA_AGENT_WALLET || '647TT6SWA48yrmH8Csb2QakeYMnCNh2oSFijLQpRksJw'
const MANTLE_WALLET = process.env.MANTLE_AGENT_WALLET || '0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9'
const GAS_RESERVE_USD = parseFloat(process.env.GAS_RESERVE_USD || '5.00')

const CAPITAL_POOL_PATH = path.join(WORKSPACE, 'state', 'capital-pool.json')
const DEPOSITS_PATH     = path.join(WORKSPACE, 'state', 'deposits.json')

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] [treasury] ${msg}`) }
function warn(msg) { console.warn(`[treasury] ⚠  ${msg}`) }

function loadJson(p, fallback) {
    if (!fs.existsSync(p)) return fallback
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback }
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
    const opts = {
        hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }
    const req = https.request(opts, () => {})
    req.on('error', () => {})
    req.write(body); req.end()
}

// ─── Balance fetch: Solana via byreal-cli ────────────────────────────────────
//
// Returns { totalUsd, tokens: [{ symbol, balance, usdValue }] } or null.
//
// byreal-cli wallet balance legitimately takes 11-20s (it queries Solana RPC for
// the wallet plus each open LP position). The old 20s ceiling was right at that
// edge, so under RPC load it threw ETIMEDOUT and the whole Solana book vanished
// from the dashboard. Raised to 120s on 2026-06-04 after an observed ETIMEDOUT on the
// 20:50 run at box load ~2-4 (the heavy wallet+5-positions query, not contention). One
// retry. A failure here must never be treated as "balance is zero": see carry-forward in main().
const SOLANA_FETCH_TIMEOUT_MS = parseInt(process.env.BYREAL_BALANCE_TIMEOUT_MS || '120000', 10)
const SOLANA_FETCH_ATTEMPTS   = 2

function fetchSolanaBalances() {
    const parseUsd = (v) => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') {
            const m = v.match(/\$?([\d,]+\.?\d*)/)
            return m ? parseFloat(m[1].replace(/,/g, '')) : 0
        }
        return 0
    }

    for (let attempt = 1; attempt <= SOLANA_FETCH_ATTEMPTS; attempt++) {
        try {
            const raw = execSync('byreal-cli wallet balance -o json 2>/dev/null', {
                timeout: SOLANA_FETCH_TIMEOUT_MS, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
            })
            const data = JSON.parse(raw)
            // Actual byreal-cli v0.3.6 shape:
            //   data: {
            //     address,
            //     balance: { sol: { amount_sol, amount_usd }, tokens: [{ symbol, amount_ui, amount_usd }] },
            //     totalUsd: "$19.63"
            //   }
            const bal = data.data?.balance
            if (!bal) { warn(`Solana balance fetch attempt ${attempt}: response had no balance object`); continue }

            const tokens = []
            if (bal.sol) {
                tokens.push({ symbol: 'SOL', balance: bal.sol.amount_sol || 0, usdValue: bal.sol.amount_usd || 0, isNative: true })
            }
            for (const t of (bal.tokens || [])) {
                tokens.push({
                    symbol: (t.symbol || '?').toUpperCase(),
                    balance: parseFloat(t.amount_ui || 0),
                    usdValue: parseUsd(t.amount_usd),
                    mint: t.mint,
                    isNative: false,
                })
            }
            const totalUsd = parseUsd(data.data?.totalUsd) || tokens.reduce((s, t) => s + (t.usdValue || 0), 0)
            return { totalUsd, tokens }
        } catch (e) {
            warn(`Solana balance fetch attempt ${attempt}/${SOLANA_FETCH_ATTEMPTS} failed: ${e.message}`)
        }
    }
    return null
}

// ─── Balance fetch: Mantle EOA via RPC ──────────────────────────────────────
//
// On Mantle: native gas token = MNT (~$0.50), staking asset = mETH (~ETH × 1.04).
// Sasha's EOA holds MNT for gas + (eventually) mETH as her treasury asset.
// Returns { mntBalance, methBalance, totalUsd } or null.
//
async function fetchMantleBalances() {
    const rpcUrl = process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz'
    try {
        const nativeWei = await rpcCall(rpcUrl, 'eth_getBalance', [MANTLE_WALLET, 'latest'])
        const mntBalance = parseInt(nativeWei, 16) / 1e18
        const methAddr = '0xcDA86A272531e8640cD7F1a92c01839911B90bb0'
        const callData = '0x70a08231' + MANTLE_WALLET.slice(2).padStart(64, '0')
        const methBalanceWei = await rpcCall(rpcUrl, 'eth_call', [{ to: methAddr, data: callData }, 'latest'])
        const methBalance = parseInt(methBalanceWei, 16) / 1e18

        const mntPrice = parseFloat(process.env.MNT_PRICE_USD || '0.50')
        const ethPrice = parseFloat(process.env.ETH_PRICE_USD || '4500')
        const methExchangeRate = parseFloat(process.env.METH_TO_ETH_RATE || '1.04')
        const totalUsd = (mntBalance * mntPrice) + (methBalance * ethPrice * methExchangeRate)
        return { mntBalance, methBalance, totalUsd, mntPriceAssumed: mntPrice, ethPriceAssumed: ethPrice }
    } catch (e) {
        warn(`Mantle balance fetch failed: ${e.message}`)
        return null
    }
}

function rpcCall(url, method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
        const u = new URL(url)
        const req = https.request({
            hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, res => {
            let d = ''
            res.on('data', c => d += c)
            res.on('end', () => {
                try { const j = JSON.parse(d); j.error ? reject(new Error(j.error.message)) : resolve(j.result) }
                catch (e) { reject(e) }
            })
        })
        req.on('error', reject)
        req.setTimeout(15_000, () => { req.destroy(); reject(new Error('RPC timeout')) })
        req.write(body); req.end()
    })
}

// ─── Deposit detection (Solana side via Helius/Solscan-style RPC) ───────────
//
// Compares current SPL token balances vs last snapshot. Any positive delta on
// USDC/USDT/USDS that isn't explained by a known trade close = deposit.
//
function detectDeposits(currentBalances, lastSnapshot) {
    if (!lastSnapshot || !lastSnapshot.tokens) return []
    const lastByToken = Object.fromEntries((lastSnapshot.tokens || []).map(t => [t.symbol, t]))
    const deposits = []
    const stables = new Set(['USDC', 'USDT', 'USDS', 'DAI'])

    for (const t of currentBalances.tokens) {
        if (!stables.has(t.symbol)) continue
        const prevBal = lastByToken[t.symbol]?.balance || 0
        const delta = t.balance - prevBal
        if (delta > 1) {   // ignore <$1 dust changes
            deposits.push({
                symbol: t.symbol,
                amount: delta,
                usdValue: t.usdValue ? (t.usdValue * delta / t.balance) : delta,
                detectedAt: new Date().toISOString(),
            })
        }
    }
    return deposits
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    log(`Starting treasury snapshot — mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

    const now = new Date().toISOString()
    const previous = loadJson(CAPITAL_POOL_PATH, null)   // loaded up front for carry-forward + deposit detection

    const solanaLive = fetchSolanaBalances()
    const mantle = await fetchMantleBalances()

    // Carry-forward guard: a transient byreal-cli timeout must NEVER blank the
    // Solana book (that is the bug that made the dashboard read $1.46 instead of
    // ~$19). On a failed live read, reuse the last good Solana snapshot and flag
    // it stale rather than writing null. The dashboard surfaces `stale` instead
    // of silently dropping the position.
    let solanaForSnapshot = null
    let solanaStale = false
    if (solanaLive) {
        solanaForSnapshot = {
            wallet: SOLANA_WALLET,
            totalUsd: Math.round(solanaLive.totalUsd * 100) / 100,
            tokens: solanaLive.tokens,
            stale: false,
            lastGoodAt: now,
        }
    } else if (previous?.solana && previous.solana.totalUsd != null) {
        solanaForSnapshot = {
            ...previous.solana,
            stale: true,
            staleSince: previous.solana.staleSince || now,
            lastGoodAt: previous.solana.lastGoodAt || previous.updatedAt || null,
        }
        solanaStale = true
        warn(`Solana balance unavailable — carrying forward last good snapshot ($${previous.solana.totalUsd}) flagged STALE (last good: ${solanaForSnapshot.lastGoodAt})`)
    }

    if (!solanaForSnapshot && !mantle) {
        warn('Both balance fetches failed and no prior Solana snapshot to carry forward — aborting')
        process.exit(1)
    }

    const totalUsd = (solanaForSnapshot?.totalUsd || 0) + (mantle?.totalUsd || 0)
    const poolUsd = Math.max(0, totalUsd - GAS_RESERVE_USD)

    const snapshot = {
        version: 1,
        updatedAt: now,
        gasReserveUsd: GAS_RESERVE_USD,
        totalUsd: Math.round(totalUsd * 100) / 100,
        poolUsd: Math.round(poolUsd * 100) / 100,
        solanaStale,
        solana: solanaForSnapshot ? {
            ...solanaForSnapshot,
            totalUsd: Math.round(solanaForSnapshot.totalUsd * 100) / 100,
        } : null,
        mantle: mantle ? {
            wallet: MANTLE_WALLET,
            mntBalance: Math.round(mantle.mntBalance * 1e6) / 1e6,
            methBalance: Math.round(mantle.methBalance * 1e6) / 1e6,
            totalUsd: Math.round(mantle.totalUsd * 100) / 100,
            mntPriceAssumed: mantle.mntPriceAssumed,
            ethPriceAssumed: mantle.ethPriceAssumed,
        } : null,
    }

    log(`Total USD: $${snapshot.totalUsd} | Pool (post gas reserve): $${snapshot.poolUsd}`)
    if (snapshot.solana) log(`  Solana: $${snapshot.solana.totalUsd} (${(snapshot.solana.tokens||[]).length} tokens)${solanaStale ? ' [STALE — carried forward]' : ''}`)
    if (mantle) log(`  Mantle: $${snapshot.mantle.totalUsd} (MNT ${snapshot.mantle.mntBalance}, mETH ${snapshot.mantle.methBalance})`)

    // ── Deposit detection ───────────────────────────────────────────────────
    // Only run on a FRESH live read — carried-forward data has no new signal.
    let newDeposits = []
    if (!NO_DEPOSITS && solanaLive) {
        const previousSolana = previous?.solana
        newDeposits = detectDeposits(solanaLive, previousSolana)
        if (newDeposits.length) {
            log(`💰 Detected ${newDeposits.length} deposit(s):`)
            for (const d of newDeposits) log(`  +${d.amount.toFixed(2)} ${d.symbol} ($${d.usdValue.toFixed(2)})`)
        }
    }

    if (DRY_RUN) {
        console.log('\n[treasury][dry-run] snapshot:')
        console.log(JSON.stringify(snapshot, null, 2))
        return
    }

    saveJson(CAPITAL_POOL_PATH, snapshot)
    log(`Saved capital pool to ${CAPITAL_POOL_PATH}`)

    if (newDeposits.length) {
        const log_ = loadJson(DEPOSITS_PATH, { version: 1, entries: [] })
        for (const d of newDeposits) {
            log_.entries.push({ ...d, poolUsdAfter: snapshot.poolUsd })
        }
        log_.updatedAt = new Date().toISOString()
        saveJson(DEPOSITS_PATH, log_)

        // Telegram + queue a tweet (tweet integration via Buffer is in post_to_buffer.js;
        // for now we just alert Gabriel via Telegram. The tweet step is wired in Pillar 5.)
        const summary = newDeposits.map(d => `+${d.amount.toFixed(2)} ${d.symbol}`).join(', ')
        sendTelegram(
            `💰 <b>[DEPOSIT]</b> ${summary}\n` +
            `Capital pool now: $${snapshot.poolUsd}\n` +
            `Next signal cycle will use new pool size.`
        )
    }
}

main().catch(err => {
    console.error('[treasury] Fatal:', err.message)
    sendTelegram(`💥 [TREASURY] Fatal: ${err.message}`)
    process.exit(1)
})
