#!/usr/bin/env node
/**
 * position-monitor.js — LP position health monitor
 *
 * Checks all open LP positions and evaluates kill-switch conditions:
 *   - OOR (three-tier, no auto-recenter):
 *       soft  — OOR >= 720 min continuous -> OOR_ALERT (informational, killSwitch:false, NO auto-close)
 *       hard  — price >= 5% beyond the breached band -> KILL (trend; fires regardless of timer)
 *       hard  — hedge mark within 3% of liquidation -> KILL (margin protection; regardless of timer)
 *   - Hedge drift: Hyperliquid short differs from amount0 by >5%
 *   - HF breach: Morpho health factor < 1.20 (deleverage) or < 1.05 (emergency)
 *   - Funding kill: Hyperliquid funding rate < -54.75% annualized for 3+ consecutive periods
 *
 * On any breach: writes content/lp-rebalance-signal.json, sends Telegram alert.
 * MONITOR ONLY — it never closes/rebalances. Execution of any KILL stays gated on
 * Gabriel's confirmation via lp-rebalancer.js. OOR_ALERT is notify-only (no on-chain action).
 *
 * Usage:
 *   node scripts/position-monitor.js               # check all positions
 *   node scripts/position-monitor.js --position <id>  # check one position
 *   node scripts/position-monitor.js --dry-run     # check but don't write signal
 *
 * Called by openclaw.json cron every 30 minutes.
 *
 * Sasha Coin — Liquidity Miner v1
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN      = args.includes('--dry-run')
const POSITION_ARG = (() => { const i = args.indexOf('--position'); return i !== -1 ? args[i+1] : null })()

// ─── Paths ───────────────────────────────────────────────────────────────────

const POSITIONS_PATH = path.join(WORKSPACE, 'state', 'lp-positions.json')
const REPORT_PATH    = path.join(WORKSPACE, 'state', 'lp-monitor-report.json')
const SIGNAL_PATH    = path.join(WORKSPACE, 'content', 'lp-rebalance-signal.json')

// ─── Kill switch thresholds ───────────────────────────────────────────────────

const KILL = {
    oorTimeoutMinutes:    720,   // OOR for 12h -> informational OOR_ALERT (no auto-recenter; hold & evaluate)
    oorSustainedEscalateMinutes: 1440,  // OOR for 24h -> escalate to a confirm-gated KILL (matches the manual policy in lp-positions.json _comment)
    oorDistanceKillPct:   5,     // price >= 5% beyond the breached band -> KILL (a deep excursion = trend, fires regardless of timer)
    hedgeLiqProximityPct: 3,     // hedge mark within 3% of its liquidation price -> KILL (protect margin), regardless of timer
    hedgeDriftPct:     0.05,     // 5% drift from target hedge size
    hfDeleverage:      1.20,     // Morpho HF -> reduce borrow
    hfEmergency:       1.05,     // Morpho HF -> close entire position
    fundingKillAnn:    -54.75,   // Hyperliquid annualized funding -> close hedge
    minClaimFeesUsd:   10,       // collect fees if pending > $10
    stopLossPct:       parseFloat(process.env.LP_STOPLOSS_PCT || '-15'),   // close position if PnL <= this %
    stopLossEmergency: parseFloat(process.env.LP_STOPLOSS_EMERGENCY_PCT || '-25'),  // emergency close
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
    console.log(`[${new Date().toISOString().slice(11,19)}] [monitor] ${msg}`)
}

function loadJson(p) {
    try {
        if (!fs.existsSync(p)) return null
        return JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch (e) { return null }
}

function saveJson(p, data) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function sendTelegram(msg) {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return
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

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'sasha-position-monitor/1.0' } }, res => {
            let data = ''
            res.on('data', c => data += c)
            res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
        }).on('error', reject)
    })
}

// ─── Solana: fetch position status via byreal-cli ─────────────────────────────

function getSolanaPosition(positionId) {
    try {
        const raw = execSync(
            `byreal-cli position status --id ${positionId} -o json`,
            { timeout: 20_000, encoding: 'utf8' }
        )
        return JSON.parse(raw)
    } catch (e) {
        log(`  byreal-cli failed for ${positionId}: ${e.message}`)
        return null
    }
}

// ─── Base: estimate position state via DefiLlama price + stored position data ─

async function getBasePositionState(position) {
    try {
        // Get current token price from DefiLlama Coins API.
        // Uses position.coinId if set — default 'coingecko:ethereum' covers WETH/USDC.
        // For cbBTC/USDC positions use 'coingecko:bitcoin'.
        const coinId = position.coinId || 'coingecko:ethereum'
        const data = await fetchJson(`https://coins.llama.fi/prices/current/${coinId}`)
        const currentPrice = data?.coins?.[coinId]?.price || 0

        const lower = position.lowerPrice || 0
        const upper = position.upperPrice || 0
        const inRange = currentPrice >= lower && currentPrice <= upper

        // Approximate OOR duration from lastInRangeAt
        const lastInRange = position.lastInRangeAt ? new Date(position.lastInRangeAt) : null
        const oorMinutes = (!inRange && lastInRange)
            ? (Date.now() - lastInRange.getTime()) / 60_000
            : 0

        // Estimate pending fees by time-elapsed since open or last claim.
        // For passive positions (NFT staked in gauge), tokensOwed stays 0 on-chain
        // until a write op. So we estimate via APR × time × time-in-range.
        // Real fees are reconciled when lp-harvest.js runs.
        let pendingFeesUsd = position.pendingFeesUsd || 0
        if (position.status === 'open' && position.capitalUsd > 0) {
            const refTime = position.lastClaimAt
                ? new Date(position.lastClaimAt).getTime()
                : position.openedAt ? new Date(position.openedAt).getTime() : null
            if (refTime) {
                const elapsedDays = (Date.now() - refTime) / 86_400_000
                const apr = position.estimatedApr ?? 1.675   // 167.5% — default to scan rate
                const inRangeAdj = inRange ? 1.0 : 0.0       // simple OOR penalty
                const est = position.capitalUsd * apr * elapsedDays / 365 * inRangeAdj
                pendingFeesUsd = est
            }
        }

        return {
            inRange,
            currentPrice,
            lowerPrice:   lower,
            upperPrice:   upper,
            oorMinutes,
            pendingFeesUsd,
        }
    } catch (e) {
        log(`  Base price fetch failed: ${e.message}`)
        return null
    }
}

// ─── Hyperliquid: get funding rate + mark price for a perp (default ETH) ──────

async function getHlFundingRate(coin = 'ETH') {
    try {
        const body = JSON.stringify({ type: 'metaAndAssetCtxs' })
        const data = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.hyperliquid.xyz',
                path: '/info',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            }
            const req = https.request(options, res => {
                let d = ''
                res.on('data', c => d += c)
                res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
            })
            req.on('error', reject)
            req.write(body)
            req.end()
        })
        const [meta, ctxs] = data
        const idx = meta.universe.findIndex(a => a.name === coin)
        if (idx === -1) { log(`  HL: perp ${coin} not found`); return null }
        const rate8h = parseFloat(ctxs[idx].funding)
        const markPx = parseFloat(ctxs[idx].markPx)   // live mark used for liq-proximity guard
        const annualized = rate8h * 3 * 365 * 100
        return { rate8h, annualized, markPx, coin, idx }
    } catch (e) {
        log(`  HL funding fetch failed: ${e.message}`)
        return null
    }
}

// ─── Evaluate a single position ───────────────────────────────────────────────

async function evaluatePosition(position) {
    log(`Checking position ${position.id} (${position.symbol}) on ${position.chain}`)

    const actions = []
    let state = null

    // Get live state
    if (position.chain === 'solana') {
        const s = getSolanaPosition(position.id)
        if (s) {
            state = {
                inRange:       s.inRange,
                currentPrice:  s.currentPrice,
                lowerPrice:    s.lowerPrice,
                upperPrice:    s.upperPrice,
                pendingFeesUsd: s.pendingFeesUsd || 0,
                valueUsd:      s.valueUsd || 0,
            }
        }
    } else if (position.chain === 'base') {
        state = await getBasePositionState(position)
    }

    if (!state) {
        log(`  Could not get state for ${position.id} — skipping`)
        return { position, state: null, actions: [] }
    }

    log(`  Price: ${state.currentPrice?.toFixed(2)} | Range: [${state.lowerPrice?.toFixed(2)} – ${state.upperPrice?.toFixed(2)}] | In range: ${state.inRange}`)

    // Stop-loss (PnL based)
    // Solana: state.valueUsd is supplied by byreal-cli position status.
    // Base: not yet wired — getBasePositionState does not compute LP value.
    if (state.valueUsd !== undefined && state.valueUsd !== null && position.capitalUsd > 0) {
        const pnlUsd = state.valueUsd - position.capitalUsd
        const pnlPct = (pnlUsd / position.capitalUsd) * 100
        state.pnlUsd = pnlUsd
        state.pnlPct = pnlPct

        const slEmergency = position.stopLossEmergencyPct ?? KILL.stopLossEmergency
        const slPct       = position.stopLossPct ?? KILL.stopLossPct
        log(`  PnL: $${pnlUsd.toFixed(2)} (${pnlPct.toFixed(1)}%) | stop-loss: ${slPct}% | emergency: ${slEmergency}%`)

        // confirmGated 2026-07-05 pending backtest (H-3): these auto-executed from cron with
        // no human gate and no historical validation of the thresholds. Held for Gabriel via
        // --confirm-kill until a price-history replay confirms the thresholds behave sanely.
        if (pnlPct <= slEmergency) {
            actions.push({ type: 'CLOSE_POSITION', reason: `STOP-LOSS EMERGENCY: PnL ${pnlPct.toFixed(1)}% ≤ ${slEmergency}%`, pnlPct, pnlUsd, killSwitch: true, confirmGated: true })
        } else if (pnlPct <= slPct) {
            actions.push({ type: 'CLOSE_POSITION', reason: `Stop-loss: PnL ${pnlPct.toFixed(1)}% ≤ ${slPct}%`, pnlPct, pnlUsd, killSwitch: true, confirmGated: true })
        }
    }

    // OOR tracking — three-tier, no auto-recenter (per docs/lp-oor-policy-update-spec.md).
    // The timer no longer recenters; it alerts. Only a real trend (distance) or a hedge-liq
    // threat triggers a (still-gated) close. CLOSE_REOPEN is removed from this auto-path —
    // it remains available only for a deliberate, manually-invoked recenter via lp-rebalancer.
    if (!state.inRange) {
        if (!position.firstOorAt) {
            position.firstOorAt = new Date().toISOString()
        }
        const oorMinutes = (Date.now() - new Date(position.firstOorAt).getTime()) / 60_000
        state.oorMinutes = oorMinutes
        const oorSide = state.currentPrice < state.lowerPrice ? 'low' : 'high'
        const beyondPct = oorSide === 'low'
            ? (state.lowerPrice - state.currentPrice) / state.lowerPrice * 100
            : (state.currentPrice - state.upperPrice) / state.upperPrice * 100
        const distKill    = position.oorDistanceKillPct ?? KILL.oorDistanceKillPct
        const timeout     = position.oorTimeoutMinutes  ?? KILL.oorTimeoutMinutes
        const escalateMin = position.oorSustainedEscalateMinutes ?? KILL.oorSustainedEscalateMinutes
        state.oorBeyondPct = beyondPct
        log(`  OOR ${oorMinutes.toFixed(0)} min, ${beyondPct.toFixed(1)}% beyond ${oorSide} band (timer: ${timeout} min, escalate: ${escalateMin} min, distance-kill: ${distKill}%)`)
        if (beyondPct >= distKill) {
            // Hard — trend: deep excursion past the band. Fires regardless of the timer.
            // confirmGated: the rebalancer must NOT auto-execute this from cron — Gabriel confirms (see lp-rebalancer --confirm-kill).
            actions.push({ type: 'KILL', reason: `OOR-${oorSide} ${beyondPct.toFixed(1)}% beyond band (trend)`, killSwitch: true, confirmGated: true })
        } else if (oorMinutes >= escalateMin) {
            // Escalated — sustained OOR past 24h (the manual policy documented in lp-positions.json's
            // _comment, previously enforced only by Gabriel remembering to check). Every prior cycle
            // already alerted at the 12h OOR_ALERT tier; this promotes to a confirm-gated KILL so the
            // repeat-Telegram-while-breached mechanism (position-monitor + lp-rebalancer, both already
            // re-alert every cycle a confirmGated action is held) actually escalates the urgency.
            actions.push({ type: 'KILL', reason: `OOR sustained ${(oorMinutes / 60).toFixed(1)}h > ${escalateMin / 60}h — evaluate close`, killSwitch: true, confirmGated: true })
        } else if (oorMinutes >= timeout) {
            // Soft — sustained OOR: informational only. Default = hold and wait for reversion.
            actions.push({ type: 'OOR_ALERT', reason: `OOR ${oorMinutes.toFixed(0)}min, ${beyondPct.toFixed(1)}% beyond (${oorSide}) — evaluate hold vs close`, killSwitch: false })
        }
    } else {
        position.firstOorAt = null  // reset OOR timer — a wick that reverts cancels the timer
    }

    // Fee claim — per-position threshold overrides global
    const claimThreshold = position.minClaimFeesUsd ?? KILL.minClaimFeesUsd
    if ((state.pendingFeesUsd || 0) >= claimThreshold) {
        log(`  Pending fees: $${state.pendingFeesUsd?.toFixed(2)} (threshold: $${claimThreshold})`)
        actions.push({ type: 'CLAIM_FEES', reason: `Fees $${state.pendingFeesUsd?.toFixed(2)}`, killSwitch: false })
    }

    // Hedge drift (Hyperliquid)
    if (position.hedgeSize && position.currentAmount0 !== undefined) {
        const drift = Math.abs(position.currentAmount0 - position.hedgeSize) / (position.hedgeSize || 1)
        log(`  Hedge drift: ${(drift * 100).toFixed(1)}% (threshold: ${KILL.hedgeDriftPct * 100}%)`)
        if (drift > KILL.hedgeDriftPct) {
            actions.push({ type: 'ADJUST_HEDGE', reason: `Drift ${(drift*100).toFixed(1)}%`, drift, killSwitch: false })
        }
    }

    // Morpho health factor
    if (position.morpho) {
        const hf = position.morpho.healthFactor || 0
        log(`  Morpho HF: ${hf.toFixed(3)}`)
        if (hf < KILL.hfEmergency) {
            // confirmGated 2026-07-05 pending backtest (H-3) — see stop-loss comment above.
            actions.push({ type: 'DELEVERAGE', reason: `HF EMERGENCY ${hf.toFixed(3)}`, currentHf: hf, killSwitch: true, confirmGated: true })
        } else if (hf < KILL.hfDeleverage) {
            actions.push({ type: 'DELEVERAGE', reason: `HF low ${hf.toFixed(3)}`, currentHf: hf, killSwitch: false })
        }
    }

    // Funding rate kill switch + hedge-liq proximity guard (positions with a hedge)
    if (position.hedgeSize && position.hedgeSize > 0) {
        const funding = await getHlFundingRate(position.hedgePerp || 'ETH')
        if (funding) {
            log(`  HL funding: ${funding.rate8h.toFixed(6)} (${funding.annualized.toFixed(1)}% ann)`)
            position.fundingHistory = position.fundingHistory || []
            position.fundingHistory.push({ rate: funding.rate8h, time: Date.now() })
            position.fundingHistory = position.fundingHistory.slice(-6)  // keep last 6 (48h)

            const last3 = position.fundingHistory.slice(-3)
            const consecutiveKill = last3.length === 3 && last3.every(r => r.rate * 3 * 365 * 100 < KILL.fundingKillAnn)
            if (consecutiveKill) {
                // confirmGated 2026-07-05 pending backtest (H-3) — see stop-loss comment above.
                actions.push({ type: 'CLOSE_HEDGE', reason: `Funding kill: ${funding.annualized.toFixed(1)}% ann`, killSwitch: true, confirmGated: true })
            }

            // Hard — hedge protection: mark within X% of liquidation -> KILL (regardless of OOR timer).
            const liqPx = position.hedgeLiquidationPx || position.hedgeLiq || 0
            const markPx = funding.markPx
            if (liqPx > 0 && markPx > 0) {
                const liqProxPct = position.hedgeLiqProximityPct ?? KILL.hedgeLiqProximityPct
                const proximityPct = Math.abs(markPx - liqPx) / liqPx * 100
                state.hedgeMarkPx = markPx
                state.hedgeLiqDistancePct = proximityPct   // computed distance (distinct from the config threshold)
                log(`  Hedge mark ${markPx.toFixed(2)} vs liq ${liqPx} — ${proximityPct.toFixed(1)}% away (threshold: ${liqProxPct}%)`)
                if (proximityPct <= liqProxPct) {
                    // confirmGated: rebalancer must NOT auto-execute from cron — Gabriel confirms.
                    actions.push({ type: 'KILL', reason: `Hedge mark ${markPx.toFixed(0)} within ${proximityPct.toFixed(1)}% of liq ${liqPx}`, killSwitch: true, confirmGated: true })
                }
            }
        }
    }

    return { position, state, actions }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    log(`Starting position monitor — mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

    const store = loadJson(POSITIONS_PATH)
    if (!store || !store.positions || !store.positions.length) {
        log('No open positions in state/lp-positions.json — nothing to check')
        log('To onboard your first position, add an entry to state/lp-positions.json:')
        log(JSON.stringify({
            id: 'your-position-id',
            symbol: 'SOL/USDC',
            chain: 'solana',
            poolAddress: '...',
            lowerPrice: 120,
            upperPrice: 160,
            capitalUsd: 500,
            openedAt: new Date().toISOString(),
            hedgeSize: 0,
            morpho: null,
        }, null, 2))
        process.exit(0)
    }

    let positions = store.positions
    if (POSITION_ARG) positions = positions.filter(p => p.id === POSITION_ARG)

    const results = []
    const rebalanceActions = []

    for (const position of positions) {
        const result = await evaluatePosition(position)
        results.push(result)
        if (result.actions.length > 0) {
            rebalanceActions.push(...result.actions.map(a => ({
                positionId: position.id,
                chain: position.chain,
                symbol: position.symbol,
                ...a,
            })))
        }
    }

    // Write monitor report
    const report = {
        generatedAt: new Date().toISOString(),
        positionCount: positions.length,
        positions: results.map(r => ({ id: r.position.id, symbol: r.position.symbol, chain: r.position.chain, ...r.state })),
        rebalanceActions,
    }

    if (!DRY_RUN) {
        saveJson(REPORT_PATH, report)
        log(`Monitor report written to state/lp-monitor-report.json`)

        // Update positions file with OOR tracking changes
        store.positions = results.map(r => ({ ...r.position, ...(r.state || {}) }))
        store.lastCheckedAt = new Date().toISOString()
        saveJson(POSITIONS_PATH, store)
    }

    // Write rebalance signal if any actions needed
    if (rebalanceActions.length > 0) {
        log(`${rebalanceActions.length} rebalance action(s) needed`)
        rebalanceActions.forEach(a => log(`  [${a.chain}] ${a.positionId}: ${a.type} (${a.reason})`))

        if (!DRY_RUN) {
            const signal = {
                generatedAt: new Date().toISOString(),
                rebalanceActions,
                positions: report.positions,
            }
            saveJson(SIGNAL_PATH, signal)
            log(`Rebalance signal written to content/lp-rebalance-signal.json`)
            log(`Run: node scripts/lp-rebalancer.js --execute`)

            // Alert
            const killSwitchActions = rebalanceActions.filter(a => a.killSwitch)
            const alertLevel = killSwitchActions.length > 0 ? '🚨' : '⚠️'
            sendTelegram(
                `${alertLevel} <b>[POSITION_MONITOR]</b> ${rebalanceActions.length} action(s)\n` +
                rebalanceActions.map(a => `${a.killSwitch ? '🚨' : '•'} [${a.chain}] ${a.symbol}: ${a.type} — ${a.reason}`).join('\n') +
                `\n\nRun: <code>node scripts/lp-rebalancer.js --execute</code>`
            )
        }
    } else {
        log('All positions healthy — no actions needed')
    }

    log(`Done. Checked ${positions.length} position(s).`)
}

main().catch(err => {
    console.error('[monitor] Fatal:', err.message)
    sendTelegram(`💥 [POSITION_MONITOR] Fatal error: ${err.message}`)
    process.exit(1)
})
