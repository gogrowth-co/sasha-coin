#!/usr/bin/env node
/**
 * weekly-yield-tweet.js — Sasha's Monday mETH yield post
 *
 * Reads state/treasury-yield-log.json, computes the 7-day yield, and queues
 * a tweet via post_to_buffer.js. Designed to run every Monday at 12:00 UTC.
 *
 * Output format (under 280 chars):
 *
 *   this week mETH yield: 0.00012 ETH (~$0.40).
 *
 *   balance: 0.0203 mETH ($86.34)
 *   compounded autonomously, attested on Mantle.
 *
 *   [explorer link to last attestation]
 *
 * Usage:
 *   node scripts/weekly-yield-tweet.js                # dry-run (default)
 *   node scripts/weekly-yield-tweet.js --execute      # post to Buffer queue
 *
 * Sasha Coin — Mantle Turing Test Hackathon 2026
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')

const YIELD_LOG_PATH = path.join(WORKSPACE, 'state', 'treasury-yield-log.json')
const TREASURY_STATE_PATH = path.join(WORKSPACE, 'state', 'mantle-treasury.json')
const POST_BUFFER_SCRIPT = path.join(WORKSPACE, 'post_to_buffer.js')

const ETH_PRICE_USD = parseFloat(process.env.ETH_PRICE_USD || '4500')

function loadJson(p, fallback) {
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback } catch { return fallback }
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] [yield-tweet] ${msg}`) }

function computeWeeklyYield(entries) {
    if (!entries?.length) return null

    const latest = entries[0]
    const sevenDaysAgoMs = Date.now() - 7 * 24 * 3600 * 1000
    // Walk back to find the report closest to 7 days ago (without going under)
    const baseline = entries.find(e => new Date(e.reportedAt).getTime() <= sevenDaysAgoMs) || entries[entries.length - 1]

    if (!baseline || baseline === latest) {
        log('Not enough history (need 7+ days of reports). Using current state only.')
        return {
            methBalance: parseFloat(latest.methBalance),
            ethEquivalent: parseFloat(latest.ethEquivalent),
            weeklyYieldEth: 0,
            weeklyYieldUsd: 0,
            daysSpanned: 0,
            insufficient: true,
        }
    }

    const baselineEth = parseFloat(baseline.ethEquivalent)
    const latestEth   = parseFloat(latest.ethEquivalent)
    const yieldEth    = Math.max(0, latestEth - baselineEth)
    const daysSpanned = (new Date(latest.reportedAt).getTime() - new Date(baseline.reportedAt).getTime()) / 86_400_000

    return {
        methBalance: parseFloat(latest.methBalance),
        ethEquivalent: latestEth,
        weeklyYieldEth: yieldEth,
        weeklyYieldUsd: yieldEth * ETH_PRICE_USD,
        daysSpanned,
        insufficient: false,
        baselineReportedAt: baseline.reportedAt,
        latestReportedAt: latest.reportedAt,
    }
}

function composeTweet(stats) {
    if (stats.insufficient || stats.methBalance === 0) {
        // First-week / no-stake fallback — Sasha narrates the start of the loop
        return [
            "mETH treasury status check.",
            "",
            `balance: ${stats.methBalance.toFixed(4)} mETH`,
            "",
            "no yield yet — loop primes on first compound.",
            "live attestations: https://explorer.mantle.xyz/address/0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9",
        ].join('\n')
    }

    const methUsd = stats.ethEquivalent * ETH_PRICE_USD
    return [
        `weekly mETH yield: ${stats.weeklyYieldEth.toFixed(6)} ETH (~$${stats.weeklyYieldUsd.toFixed(2)})`,
        "",
        `balance: ${stats.methBalance.toFixed(4)} mETH (~$${methUsd.toFixed(2)})`,
        `compounded ${Math.round(stats.daysSpanned)}d, attested on Mantle.`,
        "",
        "skin-in-the-game receipts: https://explorer.mantle.xyz/address/0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9",
    ].join('\n')
}

function postViaBuffer(text) {
    const cmd = `node "${POST_BUFFER_SCRIPT}" --text ${JSON.stringify(text)}`
    log(`posting: ${cmd.slice(0, 120)}…`)
    try {
        const out = execSync(cmd, { encoding: 'utf8', timeout: 30_000 })
        log(`buffer response: ${out.trim().slice(0, 200)}`)
        return { success: true, output: out.trim() }
    } catch (e) {
        return { success: false, error: e.message, output: e.stdout?.toString() }
    }
}

function main() {
    log(`Starting weekly yield tweet — mode: ${EXECUTE ? 'LIVE (Buffer)' : 'DRY RUN'}`)

    const yieldLog = loadJson(YIELD_LOG_PATH, { entries: [] })
    if (!yieldLog.entries?.length) {
        log('No yield reports in state/treasury-yield-log.json. Skipping (run --action report first).')
        return
    }

    const stats = computeWeeklyYield(yieldLog.entries)
    if (!stats) { log('No stats — abort'); return }

    log(`Stats: balance ${stats.methBalance.toFixed(6)} mETH | weekly yield ${stats.weeklyYieldEth.toFixed(8)} ETH ($${stats.weeklyYieldUsd.toFixed(4)})`)

    const tweet = composeTweet(stats)
    console.log('\n── Tweet draft ──')
    console.log(tweet)
    console.log(`── (${tweet.length} chars) ──\n`)

    if (!EXECUTE) {
        log('Dry-run: not posting. Pass --execute to queue to Buffer.')
        return
    }

    if (tweet.length > 280) {
        log(`⚠ tweet ${tweet.length} chars > 280. Truncating.`)
    }

    const result = postViaBuffer(tweet.slice(0, 280))
    if (result.success) log('✅ queued to Buffer')
    else { log(`❌ Buffer post failed: ${result.error}`); process.exit(1) }
}

main()
