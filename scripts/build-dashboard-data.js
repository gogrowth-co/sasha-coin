#!/usr/bin/env node
/**
 * build-dashboard-data.js — Public-safe data export for the three dashboards.
 *
 * THE SECURITY CONTRACT. The dashboards are public. This script is the ONLY
 * thing that decides what becomes public. It is built as an ALLOWLIST: output
 * is constructed field by field from named inputs. Nothing is published unless
 * it is explicitly copied here. A new secret added to a state file can never
 * leak through this script, because the script does not spread/clone objects —
 * it picks fields by name.
 *
 * Reads internal state from --src (default: workspace root).
 * Writes public JSON to --out (default: <workspace>/web).
 *
 *   web/mantle/data/dashboard.json
 *   web/okx/data/dashboard.json
 *   web/lp-miner/data/dashboard.json
 *
 * Usage:
 *   node scripts/build-dashboard-data.js                       # prod: read workspace, write web/
 *   node scripts/build-dashboard-data.js --src web/_devdata     # dev: read pulled snapshot
 *   node scripts/build-dashboard-data.js --dry-run              # print, do not write
 *
 * Runs on the VPS (where state is truthful) on a short cron, then the web/ dir
 * syncs to Cloudflare Pages / R2. Cron-safe: never throws, always exits 0.
 *
 * Sasha Coin — dashboard data layer
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SRC = (() => { const i = args.indexOf('--src'); return i !== -1 ? path.resolve(args[i + 1]) : WORKSPACE })()
const OUT = (() => { const i = args.indexOf('--out'); return i !== -1 ? path.resolve(args[i + 1]) : path.join(WORKSPACE, 'web') })()

const MANTLE_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const MANTLE_EXPLORER = 'https://explorer.mantle.xyz'
const X_HANDLE = 'SashaCoin95'
const HEARTBEAT_STALE_H = 8       // signal older than this -> stale
const HEARTBEAT_DOWN_H  = 24      // older than this -> down

// ─── tiny helpers ──────────────────────────────────────────────────────────

function log(m) { console.log(`[build-data] ${m}`) }
function warn(m) { console.warn(`[build-data] ⚠  ${m}`) }

function read(rel) {
    const p = path.join(SRC, rel)
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
    catch (e) { warn(`could not read ${rel}: ${e.message}`); return null }
}

function num(v) { return (v == null || Number.isNaN(Number(v))) ? null : Number(v) }
function round(v, d = 2) { const n = num(v); return n == null ? null : Math.round(n * 10 ** d) / 10 ** d }

function write(rel, obj) {
    const p = path.join(OUT, rel)
    if (DRY_RUN) { log(`[dry-run] ${rel} (${JSON.stringify(obj).length} bytes)`); return }
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(obj, null, 2))
    log(`wrote ${rel}`)
}

function hoursSince(iso) {
    if (!iso) return Infinity
    return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function heartbeat(iso) {
    const h = hoursSince(iso)
    if (h > HEARTBEAT_DOWN_H) return 'down'
    if (h > HEARTBEAT_STALE_H) return 'stale'
    return 'live'
}

function riskLevel(signal) {
    const s = signal?.socialBias?.riskAppetite
    if (s === 'risk-on' || s === 'neutral' || s === 'risk-off') return s
    const a = signal?.recommendation?.action
    if (a === 'MOVE_TO_STABLE') return 'risk-off'
    if (a === 'OPEN_LP_POSITION' || a === 'SWAP_TO_SOL') return 'risk-on'
    return 'neutral'
}

// ─── MANTLE ──────────────────────────────────────────────────────────────────

function buildMantle() {
    const signal   = read('content/mantle-signal.json')
    const capital  = read('state/capital-pool.json')
    const identity = read('state/erc8004-identity.json')
    const treasury = read('state/treasury-yield-log.json')
    const tradeLog = read('state/mantle-trade-log.json')

    // --- agent identity (real, from erc8004-identity.json) ---
    const id = identity || {}
    const agent = {
        name: 'Sasha',
        xHandle: X_HANDLE,
        xUrl: `https://x.com/${X_HANDLE}`,
        identity: id['mantle-agentId'] ? {
            agentId:            id['mantle-agentId'],
            registry:           MANTLE_REGISTRY,
            registrationTx:     id['mantle-txHash'] || null,
            registrationTxUrl:  id['mantle-txHash'] ? `${MANTLE_EXPLORER}/tx/${id['mantle-txHash']}` : null,
            registeredAt:       id['mantle-registeredAt'] || null,
            tokenUrl:           id['mantle-explorerUrl'] || null,
        } : null,
    }

    // --- signal (full 5-source breakdown so a single-source artifact can't masquerade) ---
    const rec = signal?.recommendation || {}
    const bd  = rec?.signalBreakdown || {}
    const weights = bd.weights || signal?.signalWeights || null
    // Feed health keys off the ACTUAL fetched signals (top-level *Signal fields),
    // never the breakdown placeholders — so a 403/offline feed correctly shows false.
    const feedHealth = {
        social:     true,                                  // social always computed (may be skipped/neutral)
        onchain:    Boolean(signal?.poolData?.topPool),
        allora:     signal?.alloraSignal != null,
        elfa:       signal?.elfaSignal != null,
        polymarket: signal?.polymarketSignal != null,
    }
    // A signal where the prediction feeds are all offline is onchain-only — say so.
    const liveFeeds = ['allora', 'elfa', 'polymarket'].filter(k => signal?.[`${k}Signal`] != null)
    const onchainOnly = liveFeeds.length === 0

    const top = signal?.poolData?.topPool || null
    const excluded = signal?.poolData?.excludedTop || null
    const score = round(rec?.signalBreakdown?.weightedScore ?? signal?.weightedScore ?? extractScoreFromRationale(rec?.rationale), 3)

    const plainEnglish = buildDecisionSentence(signal, rec, score, onchainOnly)

    const signalOut = {
        generatedAt: signal?.generatedAt || null,
        action:      rec?.action || 'HOLD',
        riskLevel:   riskLevel(signal),
        weightedScore: score,
        confidence:  round(signal?.socialBias?.confidence, 2),
        target:      rec?.poolName ? { pool: rec.poolName, fromToken: rec.fromToken, toToken: rec.toToken, sizingPct: rec.amountPct ?? null } : null,
        weights,
        feedHealth,
        onchainOnly,
        sources: {
            social:     bd?.social ? { sentiment: bd.social.sentiment, riskAppetite: bd.social.riskAppetite, confidence: round(bd.social.confidence, 2) } : null,
            onchain:    top ? { topPool: top.name, apr24h: round(top.apr, 2) ?? round(top.apr24h, 2), tvl: round(top.tvl, 0), tier: top.tier ?? null, breakEvenD: round(top.breakEvenD, 1) } : null,
            allora:     bd?.allora ? { direction: bd.allora.direction, confidence: round(bd.allora.confidence, 2) } : null,
            elfa:       bd?.elfa ? { sentiment: bd.elfa.sentiment, riskOff: bd.elfa.riskOff } : null,
            polymarket: bd?.polymarket ? { bias: bd.polymarket.bias, riskOff: bd.polymarket.riskOff } : null,
        },
        excludedTop: excluded ? { name: excluded.name, apr24h: round(excluded.apr24h, 1), tvl: round(excluded.tvl, 0), reason: excluded.reason } : null,
        qualityFilter: bd?.onchain?.qualityFilter || signal?.poolData?.qualityFilter || null,
        rationale: rec?.rationale || null,
        plainEnglish,
    }

    // --- capital (addresses + balances are public-safe per spec) ---
    const capitalOut = capital ? {
        updatedAt: capital.updatedAt || null,
        totalUsd:  round(capital.totalUsd, 2),
        poolUsd:   round(capital.poolUsd, 2),
        gasReserveUsd: round(capital.gasReserveUsd, 2),
        chains: [
            capital.solana ? {
                chain: 'solana', wallet: capital.solana.wallet, totalUsd: round(capital.solana.totalUsd, 2),
                tokens: (capital.solana.tokens || []).map(t => ({ symbol: t.symbol, balance: round(t.balance, 6), usdValue: round(t.usdValue, 2) })),
            } : null,
            capital.mantle ? {
                chain: 'mantle', wallet: capital.mantle.wallet, totalUsd: round(capital.mantle.totalUsd, 2),
                mntBalance: round(capital.mantle.mntBalance, 4), methBalance: round(capital.mantle.methBalance, 6),
            } : null,
        ].filter(Boolean),
    } : null

    // --- treasury (mETH yield) ---
    const tEntries = treasury?.entries || []
    const latest = tEntries.length ? tEntries[0] : null
    const first  = tEntries.length ? tEntries[tEntries.length - 1] : null
    const treasuryOut = latest ? {
        methBalance:  round(latest.methBalance, 6),
        exchangeRate: round(latest.exchangeRate, 4),
        ethEquivalent: round(latest.ethEquivalent, 6),
        reportedAt:   latest.reportedAt || null,
        lifetimeYieldEth: round(sumYield(tEntries), 6),
    } : null

    // --- attestations (REAL Mantle TXs only; no fabrication) ---
    const attestations = []
    if (id['mantle-txHash']) attestations.push({ action: 'REGISTER #' + (id['mantle-agentId'] || ''), txHash: id['mantle-txHash'], at: id['mantle-registeredAt'] || null, explorerUrl: `${MANTLE_EXPLORER}/tx/${id['mantle-txHash']}` })
    if (id['mantle-lastAttestationTx'] && id['mantle-lastAttestationTx'] !== id['mantle-txHash']) {
        attestations.push({ action: id['mantle-lastAction'] || 'ATTEST', txHash: id['mantle-lastAttestationTx'], at: id['mantle-lastAttestationAt'] || null, explorerUrl: `${MANTLE_EXPLORER}/tx/${id['mantle-lastAttestationTx']}` })
    }
    attestations.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))

    // --- trades (recent, sanitized, real links only) ---
    const trades = (Array.isArray(tradeLog) ? tradeLog : []).slice(-8).reverse().map(t => ({
        at:         t.executedAt || null,
        action:     t.action || null,
        status:     t.status || null,
        poolName:   t.poolName || null,
        riskLevel:  t.riskLevel || null,
        tweetUrl:   t.tweetUrl || resolveTweetUrl(t.preTweetId),
        txSignature: t.txSignature || null,
        solscanUrl: t.solscanUrl || (t.txSignature ? `https://solscan.io/tx/${t.txSignature}` : null),
        erc8004Tx:  t.erc8004Tx || null,
        erc8004Url: t.erc8004Tx ? `${MANTLE_EXPLORER}/tx/${t.erc8004Tx}` : null,
        error:      t.status === 'error' ? String(t.error || '').slice(0, 120) : null,
        rationale:  t.rationale ? String(t.rationale).slice(0, 200) : null,
    }))

    const lastAction = trades.find(t => t.status === 'success') || trades[0] || null

    return {
        asOf: new Date().toISOString(),
        generatedBy: 'build-dashboard-data.js',
        agent,
        status: {
            lastSignalAt: signal?.generatedAt || null,
            lastActionAt: lastAction?.at || null,
            lastAction:   lastAction?.action || null,
            heartbeat:    heartbeat(signal?.generatedAt),
        },
        signal: signalOut,
        capital: capitalOut,
        treasury: treasuryOut,
        attestations,
        trades,
    }
}

function resolveTweetUrl(tweetId) {
    if (!tweetId || tweetId === 'dry-run-id' || String(tweetId).startsWith('buffer:')) return null
    return `https://x.com/${X_HANDLE}/status/${tweetId}`
}

function extractScoreFromRationale(rationale) {
    if (!rationale) return null
    const m = String(rationale).match(/score:\s*([0-9]+(?:\.[0-9]+)?)/i)
    return m ? Number(m[1]) : null
}

function sumYield(entries) {
    let total = 0
    for (const e of entries) {
        const y = Number(e?.sinceLastReport?.ethYield)
        if (!Number.isNaN(y)) total += y
    }
    return total
}

function buildDecisionSentence(signal, rec, score, onchainOnly) {
    if (!signal) return null
    const when = (signal.generatedAt || '').replace('T', ' ').slice(0, 16) + ' UTC'
    const action = rec?.action || 'HOLD'
    const verb = action === 'HOLD' ? 'held' : `recommended ${action}${rec?.poolName ? ` (${rec.poolName})` : ''}`
    const scoreStr = score != null ? ` Weighted score ${score}.` : ''
    const feeds = onchainOnly
        ? ' Prediction feeds (Allora, Elfa, Polymarket) were offline, so this used on-chain data only.'
        : ''
    return `${when} — ${verb}.${scoreStr}${feeds}`
}

// ─── OKX ───────────────────────────────────────────────────────────────────

function buildOkx() {
    const poolState = read('state/xlayer-pool-state.json')
    const deploy    = read('state/xlayer-deployment.json')
    const pushes    = read('state/xlayer-oracle-pushes.json')

    if (!poolState && !deploy) { warn('no X Layer data — skipping OKX'); return null }
    const EXPL = 'https://www.oklink.com/x-layer'

    // poolState (from xlayer-pool-state.js) is already public-safe; re-pick by field anyway.
    const oracle = poolState?.oracle || {}
    const agent  = poolState?.agent || {}

    const recentPushes = (Array.isArray(pushes) ? pushes : []).slice(-10).reverse().map(p => ({
        at: p.pushedAt || null, fee: p.fee ?? null, feePct: p.fee != null ? Math.round((p.fee / 10000) * 1e4) / 1e4 : null,
        riskLevel: p.riskLevel || null, txHash: p.txHash || null,
        txUrl: p.txHash ? `${EXPL}/tx/${p.txHash}` : null,
    }))

    return {
        asOf: new Date().toISOString(),
        generatedBy: 'build-dashboard-data.js',
        chainId: 196,
        status: deploy?.status || poolState?.status || 'unknown',
        oracle: {
            address:       oracle.address || deploy?.oracleAddress || null,
            currentFee:    oracle.currentFee ?? null,
            currentFeePct: oracle.currentFeePct ?? null,
            riskLevel:     oracle.riskLevel ?? null,
            updatedAt:     oracle.updatedAt ?? null,
            ageMinutes:    oracle.ageMinutes ?? null,
            isStale:       oracle.isStale ?? null,
            updateCount:   oracle.updateCount ?? null,
            explorerUrl:   (oracle.address || deploy?.oracleAddress) ? `${EXPL}/address/${oracle.address || deploy.oracleAddress}` : null,
        },
        hook: {
            address: deploy?.hookAddress || null,
            explorerUrl: deploy?.hookAddress ? `${EXPL}/address/${deploy.hookAddress}` : null,
        },
        pool: {
            poolId: deploy?.poolId || null,
            pair: 'USDC.e / WOKB',
            tickSpacing: deploy?.poolKey?.tickSpacing ?? null,
            liquidityRange: deploy?.liquidityRange || null,
            initTxUrl: deploy?.explorer?.pool || null,
            // live v4 pool state read via extsload (xlayer-pool-state.js)
            spotPrice: poolState?.pool?.spotPrice ?? null,
            spotLabel: poolState?.pool?.spotLabel ?? null,
            tvlUsd: poolState?.pool?.tvlUsd ?? null,
            seedLiquidity: poolState?.pool?.seedLiquidity ?? null,
            tick: poolState?.pool?.tick ?? null,
        },
        agent: {
            address: agent.address || deploy?.agentAddress || null,
            okbBalance: agent.okbBalance ?? null,
            wokbBalance: agent.wokbBalance ?? null,
            usdceBalance: agent.usdceBalance ?? null,
            holdingsUsd: agent.holdingsUsd ?? null,
            lowBalanceWarning: agent.lowBalanceWarning ?? null,
            explorerUrl: (agent.address || deploy?.agentAddress) ? `${EXPL}/address/${agent.address || deploy.agentAddress}` : null,
        },
        feeMapping: { 'risk-off': 10000, 'neutral': 3000, 'risk-on': 500 },
        recentPushes,
    }
}

// ─── LP MINER ────────────────────────────────────────────────────────────────
// SCOPE: this dashboard shows ONLY the liquidity-miner book — its own positions,
// its own deployed capital, its own lifecycle. It deliberately does NOT pull the
// Mantle hackathon agent's signal-trading capital pool, mETH treasury, or Solana
// trade log — those belong to a different system (the Mantle dashboard). The LP
// miner is a separate strategy with its own capital, even where it reuses the
// 0x21AF EOA on Base. The VPS reconcile overlay adds live funded/idle reads.

const CHAIN_EXPLORER = {
    base:   'https://basescan.org',
    solana: 'https://solscan.io',
    mantle: MANTLE_EXPLORER,
    xlayer: 'https://www.oklink.com/x-layer',
}
const txUrlFor = (chain, hash) => hash ? `${CHAIN_EXPLORER[chain] || ''}/tx/${hash}` : null

function buildLpMiner() {
    const positionsFile = read('state/lp-positions.json')
    const rebalance = read('content/lp-rebalance-signal.json')
    const blacklist = read('state/pool-blacklist.json')
    const xlayer    = read('state/xlayer-deployment.json')

    const open = positionsFile?.positions || []
    const closed = positionsFile?.closedPositions || []

    const positions = open.map(p => ({
        id: p.id, symbol: p.symbol, chain: p.chain, project: p.project || null,
        status: p.status,
        deployedUsd: round(p.capitalUsd, 2),     // capital basis deployed into this position
        nftTokenId: p.nftTokenId || null,
        feeTier: p.feeTier || null,
        lowerPrice: p.lowerPrice ?? null, upperPrice: p.upperPrice ?? null,
        pendingFeesUsd: round(p.pendingFeesUsd, 4),
        hedgeSize: p.hedgeSize ?? 0,
        hedgePerp: p.hedgePerp ?? null,
        hedgeNotionalUsd: p.hedgeNotionalUsd ?? null,
        hedgeFundingAnnPct: p.hedgeFundingAnnPct ?? null,
        hedgeUpdatedAt: p.hedgeUpdatedAt ?? null,
        deltaNeutral: (p.hedgeSize ?? 0) > 0,
        morphoHf: p.morpho?.healthFactor ?? null,
        ilPct: p.ilPct ?? null, netPnlPct: p.pnlPct ?? null,
        openedAt: p.openedAt || null,
        openTxUrl: txUrlFor(p.chain, p.openTxHash),
        stakeTxUrl: txUrlFor(p.chain, p.stakeTxHash),
        // live reconciliation — filled by lp-reconcile.js
        funded: null, liveLiquidity: null, inRange: p.inRange ?? null, divergence: null,
    }))

    // Book = capital deployed into LP positions (basis). Idle wallet added by reconcile.
    const deployedUsd = round(open.reduce((s, p) => s + (Number(p.capitalUsd) || 0), 0), 2)

    // Capital exposure grouped by chain (LP only)
    const byChain = {}
    for (const p of open) {
        byChain[p.chain] = (byChain[p.chain] || 0) + (Number(p.capitalUsd) || 0)
    }
    const chains = Object.keys(byChain).map(c => ({ chain: c, deployedUsd: round(byChain[c], 2) }))

    const killSwitch = {
        oorTimeoutMinutes: 240, hedgeDriftPct: 5, hfDeleverage: 1.20, hfEmergency: 1.05,
        fundingKillAnnualizedPct: -54.75,
        armed: (rebalance?.rebalanceActions || []).map(a => ({
            positionId: a.positionId, symbol: a.symbol, type: a.type, reason: a.reason, killSwitch: Boolean(a.killSwitch),
        })),
    }

    // Activity = LP lifecycle only, derived from the positions themselves
    const activity = []
    for (const p of open) {
        if (p.openTxHash)  activity.push({ at: p.openedAt, action: 'OPEN_LP', symbol: p.symbol, chain: p.chain, status: 'success', txUrl: txUrlFor(p.chain, p.openTxHash) })
        if (p.stakeTxHash) activity.push({ at: p.stakedAt || p.openedAt, action: 'STAKE_GAUGE', symbol: p.symbol, chain: p.chain, status: 'success', txUrl: txUrlFor(p.chain, p.stakeTxHash) })
        if (p.lastClaimAt) activity.push({ at: p.lastClaimAt, action: 'HARVEST_FEES', symbol: p.symbol, chain: p.chain, status: 'success', txUrl: null })
    }
    for (const p of closed) {
        activity.push({ at: p.closedAt || p.openedAt, action: 'CLOSE_LP', symbol: p.symbol, chain: p.chain, status: 'success', pnlPct: p.pnlPct ?? null, txUrl: txUrlFor(p.chain, p.closeTxHash) })
    }
    activity.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))

    const venues = [
        { name: 'Base / Aerodrome', chain: 'base', status: open.some(p => p.chain === 'base') ? 'live' : 'idle', explorer: CHAIN_EXPLORER.base },
        { name: 'Solana / Byreal', chain: 'solana', status: open.some(p => p.chain === 'solana') ? 'live' : 'idle', explorer: CHAIN_EXPLORER.solana },
        { name: 'X Layer / Uniswap v4', chain: 'xlayer', status: xlayer?.status === 'LIVE' ? 'live' : 'idle', explorer: CHAIN_EXPLORER.xlayer, poolId: xlayer?.poolId || null },
    ]

    const bl = Array.isArray(blacklist?.pools) ? blacklist.pools : Array.isArray(blacklist) ? blacklist : []

    // Hedge summary (Phase 3) — delta-neutral legs on Hyperliquid
    const hedgedLegs = open.filter(p => (p.hedgeSize ?? 0) > 0)
    const hedge = {
        active: hedgedLegs.length > 0,
        venue: 'Hyperliquid',
        driftThresholdPct: 5,
        fundingKillAnnualizedPct: -54.75,
        legs: hedgedLegs.map(p => ({
            symbol: p.symbol, perp: p.hedgePerp || null, size: p.hedgeSize,
            notionalUsd: p.hedgeNotionalUsd ?? null, fundingAnnPct: p.hedgeFundingAnnPct ?? null,
            updatedAt: p.hedgeUpdatedAt || null,
        })),
    }

    return {
        asOf: new Date().toISOString(),
        generatedBy: 'build-dashboard-data.js',
        scope: 'liquidity-miner-only',
        agent: { name: 'Sasha LP', xHandle: X_HANDLE, xUrl: `https://x.com/${X_HANDLE}` },
        book: {
            deployedUsd,            // capital in LP positions (basis)
            idleUsd: null,          // LP wallet idle balance — filled by lp-reconcile.js
            totalUsd: null,         // deployed + idle — filled by lp-reconcile.js
            note: 'deployedUsd = capital basis in open LP positions; idle/total filled by live wallet read',
        },
        capital: { chains },        // per-chain deployed; idle merged by reconcile
        positions: { openCount: open.length, closedCount: closed.length, items: positions },
        hedge,
        killSwitch,
        venues,
        blacklist: bl.slice(0, 10).map(b => ({ name: b.name || b.symbol || b.pool, reason: b.reason, at: b.blacklistedAt || b.at })),
        activity: activity.slice(0, 15),
    }
}

// ─── secret guard (belt-and-suspenders over the allowlist) ───────────────────

const SECRET_RE = /(private[_-]?key|"pk"|_pk"|mnemonic|seed[_-]?phrase|secret|0x[a-fA-F0-9]{64}(?![a-fA-F0-9]))/i
function assertNoSecrets(label, obj) {
    // TX hashes are 0x+64 hex and are SAFE; we only flag 64-hex that looks like a key field.
    const json = JSON.stringify(obj)
    // Flag obvious secret KEYS, not tx hashes (which live under txHash/txSignature/erc8004Tx keys).
    const keyHit = /"(privateKey|pk|mnemonic|secret|apiKey|seedPhrase)"\s*:/i.test(json)
    if (keyHit) { warn(`SECRET LEAK GUARD tripped in ${label} — aborting that file`); return false }
    return true
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
    log(`src=${SRC}`)
    log(`out=${OUT}${DRY_RUN ? ' (DRY RUN)' : ''}`)

    const mantle = buildMantle()
    if (mantle && assertNoSecrets('mantle', mantle)) write('mantle/data/dashboard.json', mantle)

    const okx = buildOkx()
    if (okx && assertNoSecrets('okx', okx)) write('okx/data/dashboard.json', okx)

    const lp = buildLpMiner()
    if (lp && assertNoSecrets('lp-miner', lp)) write('lp-miner/data/dashboard.json', lp)

    log('Done.')
    process.exit(0)
}

try { main() } catch (e) { warn(`non-fatal: ${e.message}`); process.exit(0) }
