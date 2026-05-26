#!/usr/bin/env node
/**
 * byreal-trade.js — Sasha's Mantle Turing Test Hackathon trade execution script
 *
 * Orchestrates the full tweet-before-trade loop:
 *   1. Read content/mantle-signal.json
 *   2. Post pre-trade thesis to X (tweet.js)
 *   3. Wait 60 seconds (accountability window)
 *   4. Execute trade via byreal-cli
 *   5. Write ERC-8004 reputation entry on Mantle (best-effort)
 *   6. Append to state/mantle-trade-log.json
 *   7. Post follow-up tweet with TX link
 *   8. Report to Telegram
 *
 * CRITICAL DESIGN CONSTRAINT:
 *   The pre-trade tweet MUST be posted before any on-chain execution.
 *   If the tweet fails, the skill ABORTS — no trade without public reasoning.
 *
 * Usage:
 *   node scripts/byreal-trade.js               # full execute
 *   node scripts/byreal-trade.js --dry-run     # show plan, no tweets/trades
 *   node scripts/byreal-trade.js --skip-tweet  # execute trade without tweeting (testing only)
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_TWEET = args.includes('--skip-tweet') // for testing only
const PRE_TWEET_ID_ARG = (() => { const i = args.indexOf('--pre-tweet-id'); return i !== -1 ? args[i + 1] : null })()
const SIGNAL_MAX_AGE_HOURS = 4

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SIGNAL_PATH   = path.join(WORKSPACE, 'content', 'mantle-signal.json')
const TRADE_LOG     = path.join(WORKSPACE, 'state', 'mantle-trade-log.json')
const TWEET_SCRIPT  = path.join(WORKSPACE, 'scripts', 'tweet.js')

// ---------------------------------------------------------------------------
// Load + validate signal
// ---------------------------------------------------------------------------

function loadSignal() {
    if (!fs.existsSync(SIGNAL_PATH)) {
        throw new Error(`Signal file not found: ${SIGNAL_PATH}. Run mantle-signal.js first.`)
    }

    const signal = JSON.parse(fs.readFileSync(SIGNAL_PATH, 'utf8'))
    const ageHours = (Date.now() - new Date(signal.generatedAt).getTime()) / (1000 * 60 * 60)

    if (ageHours > SIGNAL_MAX_AGE_HOURS) {
        throw new Error(`Signal is ${ageHours.toFixed(1)}h old (max ${SIGNAL_MAX_AGE_HOURS}h). Regenerate with mantle-signal.js.`)
    }

    if (signal.recommendation.action === 'HOLD') {
        console.log('[trade] Signal says HOLD. No trade needed.')
        sendTelegram('🤚 [BYREAL_TRADE] Signal says HOLD. No trade executed.\n\nRationale: ' + signal.recommendation.rationale)
        process.exit(0)
    }

    return signal
}

// ---------------------------------------------------------------------------
// Wallet balance (via byreal-cli)
// ---------------------------------------------------------------------------

function getWalletBalance() {
    try {
        const raw = execSync('byreal-cli wallet balance -o json 2>/dev/null', {
            timeout: 20000,
            encoding: 'utf8',
        })
        const data = JSON.parse(raw)
        return data
    } catch (e) {
        console.warn(`[trade] Could not fetch wallet balance: ${e.message}`)
        return null
    }
}

// ---------------------------------------------------------------------------
// Tweet helpers
// ---------------------------------------------------------------------------

function postTweet(text) {
    if (DRY_RUN || SKIP_TWEET) {
        console.log(`[trade][dry-run] Would post tweet:\n  "${text}"`)
        return { tweet_id: 'dry-run-id', tweet_text: text }
    }

    const result = spawnSync('node', [TWEET_SCRIPT, '--text', text], {
        encoding: 'utf8',
        timeout: 30000,
        cwd: WORKSPACE,
    })

    if (result.status !== 0) {
        throw new Error(`tweet.js failed (exit ${result.status}): ${result.stderr?.trim() || 'no stderr'}`)
    }

    // Parse tweet_id from stdout — tweet.js outputs "Tweet posted: <id>" or JSON
    const stdout = result.stdout?.trim() || ''
    const idMatch = stdout.match(/(?:tweet[_ ]?id|id)[:\s]+["']?(\d+)/i) ||
                    stdout.match(/status\.id[:\s]+["']?(\d+)/i) ||
                    stdout.match(/(\d{15,})/);  // fallback: first long numeric string
    const tweet_id = idMatch ? idMatch[1] : null

    console.log(`[trade] Tweet posted: ${tweet_id || '(id unknown)'}\n  "${text}"`)
    return { tweet_id, tweet_text: text }
}

// ---------------------------------------------------------------------------
// Draft tweet content (in Sasha's voice)
// ---------------------------------------------------------------------------

function draftPreTradeTweet(signal) {
    const r = signal.recommendation
    const { onchainSnippet, socialSnippet } = r

    // Voice rules: max 240 chars, first-person, no hashtags, no em dashes
    // Show: what she's doing, why (thesis), one key metric
    const action = {
        'OPEN_LP_POSITION': `Opening an LP position in ${r.poolName || 'a Byreal pool'}`,
        'SWAP_TO_SOL':      'Moving 20% USDC into SOL',
        'MOVE_TO_STABLE':   'Rotating 50% into USDC',
        'HOLD':             'Holding for now',
    }[r.action] || `Executing ${r.action}`

    // Build core tweet — split rationale on ". " (not "." to avoid breaking decimals)
    const rationaleFirst = r.rationale.split(/\.\s+/)[0] || r.rationale
    const core = `${action}. ${onchainSnippet}. ${rationaleFirst}.`

    // Trim to 240 chars
    return core.length > 240 ? core.slice(0, 237) + '...' : core
}

function draftPostTradeTweet(txSignature) {
    const explorerUrl = `https://solscan.io/tx/${txSignature}`
    return `Done. TX on Solana: ${explorerUrl}`
}

// ---------------------------------------------------------------------------
// Execute trade via byreal-cli
// ---------------------------------------------------------------------------

function executeTrade(signal) {
    const r = signal.recommendation

    if (r.action === 'OPEN_LP_POSITION') {
        return executeLPPosition(r)
    }
    if (r.action === 'SWAP_TO_SOL' || r.action === 'MOVE_TO_STABLE') {
        return executeSwap(r)
    }

    throw new Error(`Unknown action: ${r.action}`)
}

function executeSwap(r) {
    // Resolve Solana mint addresses from token symbols
    const MINTS = {
        'SOL':  'So11111111111111111111111111111111111111112',
        'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    }

    const inputMint = MINTS[r.fromToken]
    const outputMint = MINTS[r.toToken]

    if (!inputMint || !outputMint) {
        throw new Error(`Unknown token for swap: ${r.fromToken} -> ${r.toToken}`)
    }

    // Use a small fixed amount for demo (0.1 = ~$15-25 depending on SOL price)
    const DEMO_AMOUNT = '0.1'

    const cmdArgs = [
        'swap', 'execute',
        '--input-mint', inputMint,
        '--output-mint', outputMint,
        '--amount', DEMO_AMOUNT,
        '-o', 'json',
    ]

    // In dry-run mode, skip actual CLI call — byreal-cli requires wallet even for --dry-run
    if (DRY_RUN) {
        const preview = [...cmdArgs, '--dry-run']
        console.log(`[trade][dry-run] Would run: byreal-cli ${preview.join(' ')}`)
        return {
            type: 'swap',
            fromToken: r.fromToken,
            toToken: r.toToken,
            amount: DEMO_AMOUNT,
            txSignature: null,
            outputAmount: null,
            raw: { dryRun: true },
        }
    }

    cmdArgs.push('--confirm')
    console.log(`[trade] Running: byreal-cli ${cmdArgs.join(' ')}`)

    const result = spawnSync('byreal-cli', cmdArgs, {
        encoding: 'utf8',
        timeout: 60000,
        cwd: WORKSPACE,
    })

    if (result.status !== 0) {
        const errMsg = result.stderr?.trim() || result.stdout?.trim() || '(no output)'
        throw new Error(`byreal-cli swap failed (exit ${result.status}): ${errMsg}`)
    }

    const output = JSON.parse(result.stdout || '{}')
    return {
        type: 'swap',
        fromToken: r.fromToken,
        toToken: r.toToken,
        amount: DEMO_AMOUNT,
        txSignature: output.signature || output.txSignature || output.tx || null,
        outputAmount: output.outputAmount || output.amount_out || null,
        raw: output,
    }
}

function getPoolCurrentPrice(poolAddress) {
    // Fetch pool info to get current price for LP price range calculation
    try {
        const result = spawnSync('byreal-cli', ['pools', 'info', poolAddress, '-o', 'json'], {
            encoding: 'utf8',
            timeout: 20000,
        })
        if (result.status !== 0 || !result.stdout) return null
        const info = JSON.parse(result.stdout)
        // byreal-cli pools info returns current_price or price field
        return info.current_price || info.price || info.data?.current_price || null
    } catch {
        return null
    }
}

function executeLPPosition(r) {
    if (!r.poolAddress) {
        throw new Error('No pool address in recommendation for LP position')
    }

    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    const DEMO_AMOUNT_USD = 10 // $10 USD for demo

    // Fetch current pool price to set ±25% range (CLMM requires explicit bounds)
    // If we can't fetch the price, fall back to a wide range (0.001 to 10000)
    let priceLower, priceUpper
    const currentPrice = getPoolCurrentPrice(r.poolAddress)
    if (currentPrice && currentPrice > 0) {
        priceLower = (currentPrice * 0.75).toFixed(6)  // -25%
        priceUpper = (currentPrice * 1.33).toFixed(6)  // +33%
        console.log(`[trade] Pool current price: ${currentPrice} → range [${priceLower}, ${priceUpper}]`)
    } else {
        // Wide-range fallback (full range, similar to Uniswap v2 behavior)
        priceLower = '0.000001'
        priceUpper = '1000000'
        console.log(`[trade] Could not fetch pool price — using wide range [${priceLower}, ${priceUpper}]`)
    }

    const cmdArgs = [
        'positions', 'open',
        '--pool', r.poolAddress,
        '--price-lower', priceLower,
        '--price-upper', priceUpper,
        '--base', USDC_MINT,
        '--amount', DEMO_AMOUNT_USD.toString(),
        '--auto-swap',
        '-o', 'json',
    ]

    // In dry-run mode, skip actual CLI call — byreal-cli requires wallet even for --dry-run
    if (DRY_RUN) {
        const preview = [...cmdArgs, '--dry-run']
        console.log(`[trade][dry-run] Would run: byreal-cli ${preview.join(' ')}`)
        return {
            type: 'lp_open',
            pool: r.poolAddress,
            poolName: r.poolName,
            amountUSD: DEMO_AMOUNT_USD,
            priceLower: parseFloat(priceLower),
            priceUpper: parseFloat(priceUpper),
            txSignature: null,
            nftMint: null,
            raw: { dryRun: true },
        }
    }

    cmdArgs.push('--confirm')
    console.log(`[trade] Running: byreal-cli ${cmdArgs.join(' ')}`)

    const result = spawnSync('byreal-cli', cmdArgs, {
        encoding: 'utf8',
        timeout: 60000,
        cwd: WORKSPACE,
    })

    if (result.status !== 0) {
        const errMsg = result.stderr?.trim() || result.stdout?.trim() || '(no output)'
        throw new Error(`byreal-cli positions open failed (exit ${result.status}): ${errMsg}`)
    }

    // byreal-cli may prefix output with status lines like [CONFIRM] — extract the JSON object
    const rawOut = result.stdout || '{}'
    const jsonStart = rawOut.indexOf('{')
    const jsonStr = jsonStart !== -1 ? rawOut.slice(jsonStart) : rawOut
    const output = JSON.parse(jsonStr)
    return {
        type: 'lp_open',
        pool: r.poolAddress,
        poolName: r.poolName,
        amountUSD: DEMO_AMOUNT_USD,
        priceLower: parseFloat(priceLower),
        priceUpper: parseFloat(priceUpper),
        txSignature: output.signature || output.txSignature || output.tx || null,
        nftMint: output.nftMint || output.position_nft || null,
        raw: output,
    }
}

// ---------------------------------------------------------------------------
// ERC-8004 reputation write on Mantle (best-effort)
// ---------------------------------------------------------------------------

async function writeERC8004Reputation(tradeResult, signal) {
    // Write a timestamped trade attestation on Mantle via erc8004-write.js.
    // Links the Solana trade tx to Sasha's ERC-8004 identity on Mantle.
    //
    // This is a best-effort step — trade execution success does not depend on it.
    // Requires: MANTLE_AGENT_PK + state/erc8004-identity.json (set by erc8004-register.js)

    if (!process.env.MANTLE_AGENT_PK) {
        console.warn('[trade][erc8004] MANTLE_AGENT_PK not set — skipping Mantle attestation')
        return null
    }

    const recommendation = signal.recommendation
    const pool = recommendation.poolName || recommendation.poolAddress || ''
    const apr = signal.poolData?.topPool?.apr24h || null
    const txSig = tradeResult?.txSignature || ''

    if (DRY_RUN) {
        console.log('[trade][dry-run] Would write ERC-8004 attestation:')
        console.log(`  action: ${recommendation.action}, pool: ${pool}, apr: ${apr}, tx: ${txSig}`)
        return { status: 'dry-run' }
    }

    // Delegate to erc8004-write.js with typed CLI flags
    const erc8004Script = path.join(WORKSPACE, 'scripts', 'erc8004-write.js')
    if (!fs.existsSync(erc8004Script)) {
        console.warn('[trade][erc8004] erc8004-write.js not found — skipping')
        return null
    }

    try {
        const scriptArgs = [
            erc8004Script,
            '--action', recommendation.action,
            ...(pool ? ['--pool', pool] : []),
            ...(apr != null ? ['--apr', String(apr.toFixed ? apr.toFixed(2) : apr)] : []),
            ...(txSig ? ['--tx', txSig] : []),
        ]
        const result = spawnSync('node', scriptArgs, {
            encoding: 'utf8',
            timeout: 30000,
            cwd: WORKSPACE,
            env: process.env,
        })
        // erc8004-write.js always exits 0 — parse stdout for the result JSON
        const stdout = (result.stdout || '').trim()
        const lastLine = stdout.split('\n').pop() || '{}'
        let out = {}
        try { out = JSON.parse(lastLine) } catch { /* stdout may be empty */ }
        if (out.txHash) {
            console.log(`[trade][erc8004] ✅ Mantle attestation: ${out.txHash}`)
        } else {
            console.log('[trade][erc8004] Attestation sent (no tx hash returned)')
        }
        return out
    } catch (e) {
        console.warn(`[trade][erc8004] Write failed (non-blocking): ${e.message}`)
        return null
    }
}

// ---------------------------------------------------------------------------
// Trade log
// ---------------------------------------------------------------------------

function appendTradeLog(entry) {
    const stateDir = path.join(WORKSPACE, 'state')
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })

    const existing = fs.existsSync(TRADE_LOG)
        ? JSON.parse(fs.readFileSync(TRADE_LOG, 'utf8'))
        : []

    existing.push(entry)
    fs.writeFileSync(TRADE_LOG, JSON.stringify(existing, null, 2))
    console.log(`[trade] Trade log updated: ${TRADE_LOG}`)
}

// ---------------------------------------------------------------------------
// Telegram report
// ---------------------------------------------------------------------------

function sendTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TERMUX_BRIDGE_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.COMMANDER_CHAT_ID

    if (!token || !chatId) {
        console.warn('[trade] Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing)')
        return
    }

    if (DRY_RUN) {
        console.log(`[trade][dry-run] Would send Telegram:\n${message}`)
        return
    }

    const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
        let d = ''
        res.on('data', c => { d += c })
        res.on('end', () => {
            if (res.statusCode !== 200) console.warn(`[trade] Telegram error ${res.statusCode}: ${d}`)
        })
    })
    req.on('error', e => console.warn(`[trade] Telegram send error: ${e.message}`))
    req.write(body)
    req.end()
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

async function main() {
    console.log(`\n=== [BYREAL_TRADE] ${DRY_RUN ? 'DRY RUN' : 'EXECUTING'} ===\n`)

    // Step 1: Load + validate signal
    const signal = loadSignal()
    const { recommendation: r } = signal
    console.log(`[trade] Action: ${r.action}`)
    console.log(`[trade] Rationale: ${r.rationale}`)

    // Step 2: Check wallet
    console.log('[trade] Checking wallet balance...')
    const balance = getWalletBalance()
    if (balance) {
        console.log(`[trade] Wallet: ${JSON.stringify(balance).slice(0, 200)}`)
    }

    // Step 3: Draft and post pre-trade tweet
    const preTweetText = draftPreTradeTweet(signal)
    console.log(`\n[trade] Pre-trade tweet:\n  "${preTweetText}"\n`)

    let preTweet
    if (PRE_TWEET_ID_ARG) {
        // Tweet already posted externally (e.g. via Typefully) — use provided ID
        preTweet = { tweet_id: PRE_TWEET_ID_ARG, text: preTweetText }
        console.log(`[trade] Using pre-posted tweet ID: ${PRE_TWEET_ID_ARG}`)
        console.log(`[trade] https://x.com/SashaCoin95/status/${PRE_TWEET_ID_ARG}`)
    } else {
        try {
            preTweet = postTweet(preTweetText)
        } catch (e) {
            console.error(`[trade] ABORT: Pre-trade tweet failed: ${e.message}`)
            console.error('[trade] No trade without public reasoning. Exiting.')
            sendTelegram(`❌ [BYREAL_TRADE] ABORTED\nPre-trade tweet failed: ${e.message}\nNo trade executed.`)
            process.exit(1)
        }
    }

    // Step 4: Wait 60 seconds (accountability window)
    if (!DRY_RUN) {
        console.log('[trade] Waiting 60s accountability window (tweet timestamp precedes trade)...')
        await new Promise(resolve => setTimeout(resolve, 60_000))
    } else {
        console.log('[trade][dry-run] Skipping 60s wait')
    }

    // Step 5: Execute trade
    console.log('[trade] Executing trade via byreal-cli...')
    let tradeResult
    try {
        tradeResult = executeTrade(signal)
        console.log(`[trade] Trade result: ${JSON.stringify(tradeResult).slice(0, 300)}`)
    } catch (e) {
        console.error(`[trade] Trade execution failed: ${e.message}`)
        sendTelegram(`❌ [BYREAL_TRADE] Trade failed\nAction: ${r.action}\nError: ${e.message}\nPre-tweet: ${preTweet.tweet_id}`)
        appendTradeLog({
            id: `mantle-trade-${Date.now()}`,
            executedAt: new Date().toISOString(),
            action: r.action,
            status: 'error',
            error: e.message,
            preTweetId: preTweet.tweet_id,
            rationale: r.rationale,
        })
        process.exit(1)
    }

    // Step 6a: mETH treasury auto-compound (best-effort, non-blocking)
    // If trade succeeded and MANTLE_AGENT_PK is set, trigger compounding.
    // This makes Mantle economically load-bearing — idle capital earns yield.
    if (!DRY_RUN && process.env.MANTLE_AGENT_PK) {
        console.log('[trade] Triggering mETH treasury compound...')
        const { spawnSync: spawn2 } = await import('child_process')
        const treasuryScript = path.join(WORKSPACE, 'scripts', 'mantle-treasury.js')
        if (fs.existsSync(treasuryScript)) {
            const tResult = spawn2('node', [treasuryScript, '--action', 'compound', '--execute'], {
                encoding: 'utf8',
                timeout: 30000,
                cwd: WORKSPACE,
                env: { ...process.env, TREASURY_NONBLOCKING: '1' },
            })
            if (tResult.status === 0) {
                console.log('[trade][treasury] Compound result:', (tResult.stdout || '').trim().slice(0, 200))
            } else {
                console.warn('[trade][treasury] Compound skipped:', (tResult.stderr || tResult.stdout || '').trim().slice(0, 100))
            }
        }
    } else if (DRY_RUN) {
        console.log('[trade][dry-run] Would trigger: node scripts/mantle-treasury.js --action compound --execute')
    }

    // Step 6b: ERC-8004 reputation write (best-effort, non-blocking)
    const erc8004Result = await writeERC8004Reputation(tradeResult, signal)

    // Step 7: Append to trade log
    const logEntry = {
        id: `mantle-trade-${Date.now()}`,
        executedAt: new Date().toISOString(),
        action: r.action,
        type: tradeResult.type,
        fromToken: tradeResult.fromToken || null,
        toToken: tradeResult.toToken || null,
        fromAmount: tradeResult.amount || null,
        poolAddress: tradeResult.pool || null,
        poolName: tradeResult.poolName || null,
        txSignature: tradeResult.txSignature,
        solscanUrl: tradeResult.txSignature ? `https://solscan.io/tx/${tradeResult.txSignature}` : null,
        preTweetId: preTweet.tweet_id,
        postTweetId: null, // filled below
        rationale: r.rationale,
        socialBias: signal.socialBias?.defiSentiment,
        confidence: signal.socialBias?.confidence,
        erc8004Tx: erc8004Result?.txHash || null,
        status: DRY_RUN ? 'dry-run' : 'executed',
    }

    // Step 8: Post follow-up tweet
    let postTweetResult = null
    if (tradeResult.txSignature) {
        const postTweetText = draftPostTradeTweet(tradeResult.txSignature)
        try {
            postTweetResult = postTweet(postTweetText)
            logEntry.postTweetId = postTweetResult.tweet_id
        } catch (e) {
            console.warn(`[trade] Post-trade tweet failed (non-blocking): ${e.message}`)
        }
    }

    appendTradeLog(logEntry)

    // Step 9: Telegram report
    const solscanUrl = tradeResult.txSignature ? `https://solscan.io/tx/${tradeResult.txSignature}` : 'N/A (dry-run)'
    const telegramMsg = [
        `✅ <b>[BYREAL_TRADE]</b> ${DRY_RUN ? '(dry-run)' : 'executed'}`,
        `Action: ${r.action}`,
        `${r.fromToken || ''} ${r.toToken ? '→ ' + r.toToken : ''}`,
        `TX: ${solscanUrl}`,
        `Pre-tweet: ${preTweet.tweet_id ? `https://x.com/SashaCoin95/status/${preTweet.tweet_id}` : '(dry-run)'}`,
        `Signal: ${signal.socialBias?.defiSentiment} (confidence ${signal.socialBias?.confidence?.toFixed(2)})`,
        `Rationale: ${r.rationale.slice(0, 150)}`,
    ].join('\n')

    sendTelegram(telegramMsg)

    console.log('\n=== TRADE COMPLETE ===')
    console.log(`Action: ${r.action}`)
    console.log(`TX: ${solscanUrl}`)
    console.log(`Pre-tweet: ${preTweet.tweet_id}`)
}

main().catch(err => {
    console.error('[trade] Fatal error:', err.message)
    sendTelegram(`💥 [BYREAL_TRADE] Fatal error: ${err.message}`)
    process.exit(1)
})
