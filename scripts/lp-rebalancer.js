#!/usr/bin/env node
/**
 * lp-rebalancer.js — LP position rebalance executor
 *
 * Called when position-monitor.js writes content/lp-rebalance-signal.json.
 *
 * Three rebalance actions:
 *   CLOSE_REOPEN  — OOR timeout: close, claim fees, reopen at current price +/- half-width
 *   CLAIM_FEES    — fees above threshold: claim without closing
 *   DELEVERAGE    — HF falling: repay portion of Morpho loan
 *
 * Kill-switch: executes CLOSE_POSITION only, no reopen. Fires Telegram alert.
 *
 * Usage:
 *   node scripts/lp-rebalancer.js                    # dry-run (default)
 *   node scripts/lp-rebalancer.js --execute          # live execution
 *   node scripts/lp-rebalancer.js --position <id>    # one position only
 *   node scripts/lp-rebalancer.js --chain solana
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

const args = process.argv.slice(2)
const EXECUTE      = args.includes('--execute')
const POSITION_ARG = (() => { const i = args.indexOf('--position'); return i !== -1 ? args[i+1] : null })()
const CHAIN_ARG    = (() => { const i = args.indexOf('--chain');    return i !== -1 ? args[i+1] : null })()

const SIGNAL_PATH    = path.join(WORKSPACE, 'content', 'lp-rebalance-signal.json')
const POSITIONS_PATH = path.join(WORKSPACE, 'state',   'lp-positions.json')
const REBALANCE_LOG  = path.join(WORKSPACE, 'state',   'lp-rebalance-log.json')

const CONFIG = {
    defaultRangeHalfWidthPct: 0.12,  // +/-12% around current price on reopen
    minClaimUsd: 5,
    targetHf: 1.50,
    attest: true,
    maxSignalAgeMinutes: 30,
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] [rebalancer] ${msg}`) }
function warn(msg) { console.warn(`[rebalancer] ⚠  ${msg}`) }

function sendTelegram(msg) {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return
    const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    const options = {
        hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }
    const req = https.request(options, () => {}); req.on('error', () => {}); req.write(body); req.end()
}

function loadJson(p) {
    try { if (!fs.existsSync(p)) return null; return JSON.parse(fs.readFileSync(p, 'utf8')) }
    catch(e) { return null }
}

function saveJson(p, data) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function appendLog(entry) {
    const store = loadJson(REBALANCE_LOG) || { entries: [] }
    store.entries.unshift({ ...entry, loggedAt: new Date().toISOString() })
    store.entries = store.entries.slice(0, 200)
    saveJson(REBALANCE_LOG, store)
}

function byrealExec(cmd, dryRun) {
    const fullCmd = dryRun ? `${cmd} --dry-run` : `${cmd} --confirm`
    log(`byreal: ${fullCmd}`)
    try {
        const out = execSync(fullCmd, { timeout: 60_000, encoding: 'utf8' })
        return { success: true, output: out.trim() }
    } catch (e) {
        return { success: false, error: e.message, output: e.stdout || '' }
    }
}

function byrealGetPosition(id) {
    try {
        return JSON.parse(execSync(`byreal-cli position status --id ${id} -o json`, { timeout: 20_000, encoding: 'utf8' }))
    } catch(e) { warn(`byreal status failed: ${e.message}`); return null }
}

function writeAttestation(action, pool, txSig) {
    if (!CONFIG.attest) return
    try {
        const cmd = `node scripts/erc8004-write.js --action ${action}${pool ? ` --pool ${pool}` : ''}${txSig ? ` --tx ${txSig}` : ''}${EXECUTE ? '' : ' --dry-run'}`
        execSync(cmd, { timeout: 30_000, encoding: 'utf8' })
        log(`ERC-8004 attestation: ${action}`)
    } catch(e) { warn(`ERC-8004 failed (non-fatal): ${e.message}`) }
}

// --- Action handlers ---

async function claimFees(position, dryRun) {
    log(`CLAIM_FEES — ${position.id} (${position.symbol}) pending $${position.pendingFeesUsd?.toFixed(2)}`)
    if (position.chain === 'solana') {
        const result = byrealExec(`byreal-cli position claim --id ${position.id}`, dryRun)
        if (!result.success && !dryRun) return { success: false, error: result.error }
        const txMatch = result.output.match(/signature[:\s]+([A-Za-z0-9]{80,})/i)
        const txSig = txMatch ? txMatch[1] : null
        if (txSig) writeAttestation('CLAIM_FEES', position.symbol, txSig)
        return { success: true, action: 'CLAIM_FEES', txSig }
    }
    log(`[claim] Base position — ethers.js collect (see base-defi-stack skill)`)
    if (!dryRun) warn('Base fee collection requires AGENT_PRIVATE_KEY')
    return { success: dryRun, action: 'CLAIM_FEES', chain: 'base', dry: dryRun }
}

async function closeAndReopen(position, dryRun) {
    log(`CLOSE_REOPEN — ${position.id} (${position.symbol})`)
    if (position.chain === 'solana') {
        const status = byrealGetPosition(position.id)
        const currentPrice = status?.currentPrice || position.currentPrice
        if (!currentPrice) return { success: false, error: 'No current price' }

        const hw = CONFIG.defaultRangeHalfWidthPct
        const newLower = currentPrice * (1 - hw)
        const newUpper = currentPrice * (1 + hw)
        log(`  New range: ${newLower.toFixed(4)} – ${newUpper.toFixed(4)}`)

        const closeResult = byrealExec(`byreal-cli position close --id ${position.id}`, dryRun)
        if (!closeResult.success && !dryRun) return { success: false, error: closeResult.error }

        const openResult = byrealExec(
            `byreal-cli position open --pool ${position.poolAddress} --amount ${position.capitalUsd} ` +
            `--range-lower ${newLower.toFixed(4)} --range-upper ${newUpper.toFixed(4)}`, dryRun
        )
        if (!openResult.success && !dryRun) return { success: false, error: openResult.error, phase: 'reopen' }

        const newIdMatch = openResult.output.match(/position[_\s]+id[:\s]+([A-Za-z0-9_-]+)/i)
        const newPositionId = newIdMatch ? newIdMatch[1] : null
        log(`  Reopened -> new position ${newPositionId || '(dry-run)'}`)
        writeAttestation('CLOSE_REOPEN', position.symbol, null)
        return { success: true, action: 'CLOSE_REOPEN', oldPositionId: position.id, newPositionId, newLower, newUpper, currentPrice }
    }
    log(`[reopen] Base position — ethers.js NftPosManager (see base-defi-stack skill)`)
    if (!dryRun) warn('Base close/reopen requires AGENT_PRIVATE_KEY')
    return { success: dryRun, action: 'CLOSE_REOPEN', chain: 'base', dry: dryRun }
}

async function killPosition(position, reason, dryRun) {
    log(`🚨 KILL SWITCH — ${position.id} reason: ${reason}`)
    let result = { success: true, dry: dryRun }
    if (position.chain === 'solana') {
        result = byrealExec(`byreal-cli position close --id ${position.id}`, dryRun)
    } else {
        if (!dryRun) warn('Base kill requires AGENT_PRIVATE_KEY')
    }
    writeAttestation('CLOSE_LP_POSITION', position.symbol, null)
    sendTelegram(
        `🚨 <b>[KILL SWITCH]</b> Position ${position.id} CLOSED\n` +
        `Pair: ${position.symbol} | Chain: ${position.chain}\nReason: ${reason}\n` +
        `${EXECUTE ? '✅ EXECUTED' : '🔍 DRY RUN'}`
    )
    return { ...result, action: 'KILL', reason }
}

async function deleverage(position, currentHf, dryRun) {
    log(`DELEVERAGE — ${position.id} HF=${currentHf.toFixed(3)} target=${CONFIG.targetHf}`)
    const borrowed   = position.morpho?.borrowedUsd || 0
    const collateral = position.morpho?.collateralUsd || 0
    const lltv       = position.morpho?.lltv || 0.86
    const repayUsd   = Math.max(0, borrowed - (collateral * lltv) / CONFIG.targetHf)
    log(`  Repay: $${repayUsd.toFixed(2)} USDC to reach HF ${CONFIG.targetHf}`)
    if (dryRun) return { success: true, action: 'DELEVERAGE', repayUsd, dry: true }
    warn('Morpho repay requires AGENT_PRIVATE_KEY + ALCHEMY_BASE_RPC — Phase 3')
    return { success: false, action: 'DELEVERAGE', error: 'Not yet wired — Phase 3', repayUsd }
}

function updatePositionsState(actionResults) {
    const store = loadJson(POSITIONS_PATH)
    if (!store) return
    for (const result of actionResults) {
        if (!result.success) continue
        if (result.action === 'KILL' || result.action === 'CLOSE_REOPEN') {
            const idx = store.positions.findIndex(p => p.id === (result.oldPositionId || result.positionId))
            if (idx !== -1) {
                const closed = store.positions.splice(idx, 1)[0]
                store.closedPositions = store.closedPositions || []
                store.closedPositions.push({ ...closed, closedAt: new Date().toISOString(), closeReason: result.action })
            }
            if (result.action === 'CLOSE_REOPEN' && result.newPositionId) {
                store.positions.push({ id: result.newPositionId, openedAt: new Date().toISOString(), lowerPrice: result.newLower, upperPrice: result.newUpper })
            }
        }
        if (result.action === 'CLAIM_FEES') {
            const pos = store.positions.find(p => p.id === result.positionId)
            if (pos) { pos.lastClaimAt = new Date().toISOString(); pos.pendingFeesUsd = 0 }
        }
    }
    store.lastRebalancedAt = new Date().toISOString()
    saveJson(POSITIONS_PATH, store)
    log('Updated state/lp-positions.json')
}

// --- Main ---

async function main() {
    log(`Starting rebalancer — mode: ${EXECUTE ? 'LIVE EXECUTION' : 'DRY RUN'}`)
    if (!EXECUTE) log('Pass --execute to run live trades')

    const signal = loadJson(SIGNAL_PATH)
    if (!signal) { log('No rebalance signal — nothing to do'); process.exit(0) }

    const signalAge = (Date.now() - new Date(signal.generatedAt).getTime()) / 60_000
    if (signalAge > CONFIG.maxSignalAgeMinutes) {
        warn(`Signal is ${signalAge.toFixed(0)}m old (max ${CONFIG.maxSignalAgeMinutes}m) — regenerate`)
        process.exit(1)
    }
    log(`Signal loaded: ${signal.rebalanceActions?.length || 0} actions, ${signalAge.toFixed(0)}m ago`)

    let actions = signal.rebalanceActions || []
    if (POSITION_ARG) actions = actions.filter(a => a.positionId === POSITION_ARG)
    if (CHAIN_ARG)    actions = actions.filter(a => a.chain === CHAIN_ARG)
    if (!actions.length) { log('No matching actions — done'); process.exit(0) }

    const results = []
    const store = loadJson(POSITIONS_PATH)

    for (const action of actions) {
        const position = store?.positions?.find(p => p.id === action.positionId)
        if (!position) { warn(`Position ${action.positionId} not found — skipping`); continue }
        const monitorData = signal.positions?.find(p => p.id === action.positionId)
        if (monitorData) Object.assign(position, monitorData)

        let result
        try {
            if (action.killSwitch)           result = await killPosition(position, action.reason, !EXECUTE)
            else if (action.type === 'CLOSE_REOPEN') result = await closeAndReopen(position, !EXECUTE)
            else if (action.type === 'CLAIM_FEES')   result = await claimFees(position, !EXECUTE)
            else if (action.type === 'DELEVERAGE')   result = await deleverage(position, action.currentHf || 1.0, !EXECUTE)
            else { warn(`Unknown action: ${action.type}`); continue }
        } catch(e) {
            warn(`Action ${action.type} for ${action.positionId} threw: ${e.message}`)
            result = { success: false, error: e.message }
        }
        results.push({ positionId: action.positionId, ...result })
        appendLog({ positionId: action.positionId, symbol: position.symbol, chain: position.chain, ...result, executed: EXECUTE })
    }

    if (EXECUTE && results.some(r => r.success)) {
        updatePositionsState(results)
        fs.unlinkSync(SIGNAL_PATH)
        log('Cleared lp-rebalance-signal.json')
    }

    const ok = results.filter(r => r.success).length
    const err = results.filter(r => !r.success).length
    log(`Summary: ${ok} succeeded, ${err} failed out of ${results.length} actions`)

    if (EXECUTE && results.length > 0) {
        sendTelegram(
            `🔄 <b>[LP_REBALANCER]</b> ${ok}/${results.length} actions\n` +
            results.map(r => `${r.success ? '✅' : '❌'} ${r.positionId} → ${r.action || 'error'}`).join('\n')
        )
    }

    if (err > 0 && ok === 0) process.exit(1)
}

main().catch(err => {
    console.error('[rebalancer] Fatal:', err.message)
    sendTelegram(`💥 [LP_REBALANCER] Fatal error: ${err.message}`)
    process.exit(1)
})
