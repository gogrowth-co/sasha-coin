#!/usr/bin/env node
/**
 * reconcile-hedge-state.js — clear phantom hedges from state/lp-positions.json.
 *
 * The 2026-08-19 incident: Hyperliquid liquidated the 0.0106 ETH short at 15:27 UTC,
 * but lp-positions.json kept claiming hedgeSize 0.0106 open. position-monitor.js reads
 * hedgeSize / hedgeLiquidationPx from state and only fetches the *mark* live, so it spent
 * 4 hours emitting "hedge within 0.5% of liq" KILL alerts about a position that no longer
 * existed. hedge-executor's orphan sweep catches the mirror case (short on the exchange with
 * no backing LP) and cannot catch this one.
 *
 * This script is the missing direction: exchange is ground truth, state must follow.
 * For every open position carrying a hedge, if clearinghouseState shows no live position in
 * that coin, the hedge fields are cleared and the closure is recorded (with the liquidation
 * fill from userFills when one is found, so the reason is evidence-backed, not assumed).
 *
 * Read-only against Hyperliquid (public address, clearinghouseState + userFills need no key).
 *
 * Usage:
 *   node scripts/reconcile-hedge-state.js              # DRY RUN — print the diff, write nothing
 *   node scripts/reconcile-hedge-state.js --execute    # apply to state/lp-positions.json
 *
 * Sasha Coin — LP Miner state integrity
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')
const POSITIONS_PATH = path.join(WORKSPACE, 'state', 'lp-positions.json')
const HL_API = 'https://api.hyperliquid.xyz/info'

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const log = (...a) => console.log('[reconcile-hedge]', ...a)

async function hlPost(body) {
    const r = await fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`HL ${body.type} HTTP ${r.status}`)
    return r.json()
}

// Live open perp positions, keyed by coin -> signed size (negative = short).
async function livePositions(user) {
    const st = await hlPost({ type: 'clearinghouseState', user })
    const map = new Map()
    for (const ap of st.assetPositions || []) {
        const p = ap.position
        const szi = Number(p.szi)
        if (szi !== 0) map.set(p.coin, szi)
    }
    return { map, accountValue: Number(st.marginSummary?.accountValue ?? 0) }
}

// Most recent closing fill for a coin — used to explain *why* the hedge is gone.
async function lastCloseFill(user, coin) {
    const fills = await hlPost({ type: 'userFills', user })
    return (fills || []).find(f => f.coin === coin && /Close/.test(f.dir || '')) || null
}

async function main() {
    if (!fs.existsSync(POSITIONS_PATH)) { console.error(`No ${POSITIONS_PATH}`); process.exit(1) }
    const store = JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8'))
    const open = (store.positions || []).filter(p => p.status === 'open' && p.hedgeSize)

    log(`${EXECUTE ? '(EXECUTE)' : '(DRY RUN)'} — ${open.length} open position(s) carrying a hedge`)
    if (!open.length) { log('Nothing to reconcile.'); return }

    // Group by hedge wallet so we hit the API once per wallet, not once per position.
    const wallets = [...new Set(open.map(p => p.hedgeWallet).filter(Boolean))]
    const byWallet = new Map()
    for (const w of wallets) {
        const live = await livePositions(w)
        byWallet.set(w.toLowerCase(), live)
        const desc = live.map.size ? [...live.map].map(([c, s]) => `${c} ${s}`).join(', ') : 'none'
        log(`wallet ${w}: accountValue $${live.accountValue.toFixed(2)} | live positions: ${desc}`)
    }

    let changed = 0
    for (const pos of open) {
        const live = byWallet.get((pos.hedgeWallet || '').toLowerCase())
        if (!live) { log(`  ${pos.id}: no hedgeWallet on record — skipping (cannot verify)`); continue }

        const coin = pos.hedgePerp
        const liveSz = live.map.get(coin)
        if (liveSz !== undefined) {
            log(`  ${pos.id}: ${coin} hedge CONFIRMED live (szi ${liveSz}) — state left untouched`)
            continue
        }

        // State claims a hedge the exchange does not have.
        const fill = await lastCloseFill(pos.hedgeWallet, coin)
        const liquidated = !!fill?.liquidation
        const when = fill ? new Date(fill.time).toISOString() : null
        const pnl = fill ? Number(fill.closedPnl) : null

        log(`  ${pos.id}: ⚠ PHANTOM — state claims ${pos.hedgeSize} ${coin} ${pos.hedgeSide}, exchange has none`)
        if (fill) {
            log(`     closing fill ${when} @ $${fill.px} | closedPnl $${pnl} | ${liquidated ? `LIQUIDATED (mark $${fill.liquidation.markPx}, ${fill.liquidation.method})` : 'closed normally'}`)
        } else {
            log('     no closing fill found in recent history — clearing on clearinghouseState alone')
        }

        if (EXECUTE) {
            pos.hedgeClosedAt = when || new Date().toISOString()
            pos.hedgeCloseReason = liquidated ? 'liquidated' : (fill ? 'closed_offsystem' : 'absent_from_exchange')
            pos.hedgeClosedPnlUsd = pnl
            pos.hedgeClosedPx = fill ? Number(fill.px) : null
            pos.hedgeSizeAtClose = pos.hedgeSize
            // Clear every field position-monitor.js reads to evaluate hedge health,
            // so it stops scoring a hedge that no longer exists.
            pos.hedgeSize = 0
            pos.hedgeSide = null
            pos.hedgeNotionalUsd = 0
            pos.hedgeMarginUsd = 0
            pos.hedgeLiquidationPx = null
            pos.hedgeLiqDistancePct = null
            pos.hedgeMarkPx = null
            pos.hedgeUpdatedAt = new Date().toISOString()
        }
        changed++
    }

    if (!changed) { log('All hedges match the exchange. No changes.'); return }
    if (!EXECUTE) { log(`DRY RUN — ${changed} phantom hedge(s) would be cleared. Re-run with --execute.`); return }

    const backup = `${POSITIONS_PATH}.bak-hedge-reconcile-${new Date().toISOString().replace(/[:.]/g, '')}`
    fs.copyFileSync(POSITIONS_PATH, backup)
    store.hedgeReconciledAt = new Date().toISOString()
    fs.writeFileSync(POSITIONS_PATH, JSON.stringify(store, null, 2))
    log(`Backup written: ${path.basename(backup)}`)
    log(`✅ Cleared ${changed} phantom hedge(s) in state/lp-positions.json`)
}

main().catch(e => { console.error('[reconcile-hedge] FATAL:', e.message); process.exit(1) })
