#!/usr/bin/env node
/**
 * lp-reconcile.js — Live on-chain trust layer for the LP Miner dashboard.
 *
 * The 45-USDC incident: a state file said a Base position was open while no
 * capital stood behind it. The hard rule from the requirements doc is that the
 * dashboard must NEVER trust a state file's claim about money. This script reads
 * the chain directly and stamps each position with a verdict:
 *
 *   funded: true   — on-chain liquidity > 0 behind the recorded NFT
 *   funded: false  — status says open/active but the chain shows nothing  -> UNFUNDED
 *   funded: null   — could not read (all RPCs failed)                      -> "unverified"
 *
 * It overlays the verdict onto web/lp-miner/data/dashboard.json (produced by
 * build-dashboard-data.js, the state layer). Run order on the VPS cron:
 *   build-dashboard-data.js  (state layer)  ->  lp-reconcile.js  (live overlay)
 *
 * Multi-RPC failover is mandatory (mainnet.base.org died mid-session). Each chain
 * has an ordered endpoint list; we try until one answers.
 *
 * Usage:
 *   node scripts/lp-reconcile.js                       # patch web/lp-miner/data/dashboard.json
 *   node scripts/lp-reconcile.js --src web/_devdata     # read positions from a snapshot
 *   node scripts/lp-reconcile.js --dry-run             # print verdicts, do not write
 *
 * Read-only RPC. Never throws, always exits 0.
 *
 * Sasha Coin — LP Miner dashboard data layer
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SRC = (() => { const i = args.indexOf('--src'); return i !== -1 ? path.resolve(args[i + 1]) : WORKSPACE })()
const DASH = path.join(WORKSPACE, 'web', 'lp-miner', 'data', 'dashboard.json')

const RPCS = {
    base:   (process.env.BASE_RPC_URLS || 'https://mainnet.base.org,https://base.llamarpc.com,https://base-rpc.publicnode.com,https://1rpc.io/base').split(','),
    mantle: (process.env.MANTLE_RPC_URLS || 'https://rpc.mantle.xyz,https://mantle-rpc.publicnode.com').split(','),
}
const CHAIN_IDS = { base: 8453, mantle: 5000 }

// Aerodrome Slipstream / Uniswap-v3-style NFT position manager on Base
const AERO_NPM = '0x827922686190790b37229fd06084350E74485b72'
const NPM_ABI = ['function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 f0,uint256 f1,uint128 o0,uint128 o1)']

// LP miner's Base wallet (same EOA used on Base; idle balance = undeployed LP capital).
const LP_BASE_WALLET = process.env.LP_BASE_WALLET || '0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9'
// Hyperliquid hedge wallet (public address; clearinghouseState is a read-only query, no key).
const HL_WALLET = process.env.HL_WALLET_ADDRESS || '0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04'
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASE_CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)']

function log(m) { console.log(`[lp-reconcile] ${m}`) }
function warn(m) { console.warn(`[lp-reconcile] ⚠  ${m}`) }

function loadJson(p) {
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
    catch (e) { warn(`read ${path.basename(p)}: ${e.message}`); return null }
}

// Try each RPC in order until one answers. Returns provider or null.
async function pickProvider(chain) {
    for (const rpc of RPCS[chain] || []) {
        try {
            const pr = new ethers.JsonRpcProvider(rpc.trim(), { chainId: CHAIN_IDS[chain], name: chain })
            await pr.getBlockNumber()   // liveness probe
            log(`${chain} RPC: ${rpc.trim()}`)
            return pr
        } catch (e) { warn(`${chain} RPC down: ${rpc.trim()} (${e.message.slice(0, 40)})`) }
    }
    return null
}

// Fetch USD prices (ETH, BTC) from DefiLlama; USDC = 1.
function fetchPrices() {
    return new Promise(resolve => {
        const ids = 'coingecko:ethereum,coingecko:bitcoin'
        const req = https.get(`https://coins.llama.fi/prices/current/${ids}`, res => {
            let d = ''; res.on('data', c => d += c)
            res.on('end', () => { try { const j = JSON.parse(d); resolve({ eth: j.coins?.['coingecko:ethereum']?.price || 0, btc: j.coins?.['coingecko:bitcoin']?.price || 0 }) } catch { resolve({ eth: 0, btc: 0 }) } })
        })
        req.on('error', () => resolve({ eth: 0, btc: 0 }))
        req.setTimeout(8000, () => { req.destroy(); resolve({ eth: 0, btc: 0 }) })
    })
}

// Idle (undeployed) LP capital sitting in the Base wallet.
async function reconcileBaseWallet(provider) {
    try {
        const prices = await fetchPrices()
        const eth = parseFloat(ethers.formatEther(await provider.getBalance(LP_BASE_WALLET)))
        const usdc = new ethers.Contract(BASE_USDC, ERC20_ABI, provider)
        const cbbtc = new ethers.Contract(BASE_CBBTC, ERC20_ABI, provider)
        const usdcBal = parseFloat(ethers.formatUnits(await usdc.balanceOf(LP_BASE_WALLET), 6))
        const cbbtcBal = parseFloat(ethers.formatUnits(await cbbtc.balanceOf(LP_BASE_WALLET), 8))
        const idleUsd = usdcBal * 1 + cbbtcBal * prices.btc + eth * prices.eth
        return { address: LP_BASE_WALLET, chain: 'base', usdc: usdcBal, cbbtc: cbbtcBal, eth, idleUsd: Math.round(idleUsd * 100) / 100 }
    } catch (e) { warn(`wallet read failed: ${e.message.slice(0, 50)}`); return null }
}

async function reconcileBasePosition(provider, position) {
    if (!position.nftTokenId) return { funded: null, reason: 'no NFT id recorded' }
    try {
        const c = new ethers.Contract(AERO_NPM, NPM_ABI, provider)
        const pos = await c.positions(BigInt(position.nftTokenId))
        const liquidity = pos.liquidity
        const funded = liquidity > 0n
        return {
            funded,
            liveLiquidity: liquidity.toString(),
            tickLower: Number(pos.tickLower),
            tickUpper: Number(pos.tickUpper),
            reason: funded ? 'on-chain liquidity > 0' : 'NFT exists but liquidity is 0',
        }
    } catch (e) {
        return { funded: null, reason: `read failed: ${e.message.slice(0, 50)}` }
    }
}

// Live Hyperliquid hedge position(s) — read-only clearinghouseState (no key needed).
async function reconcileHedge() {
    try {
        const { InfoClient, HttpTransport } = await import('@nktkas/hyperliquid')
        const info = new InfoClient({ transport: new HttpTransport({ isTestnet: false, timeout: 30000 }) })
        const [meta, ctxs] = await info.metaAndAssetCtxs()
        const st = await info.clearinghouseState({ user: HL_WALLET })
        const accountValueUsd = Math.round(parseFloat(st.crossMarginSummary?.accountValue || '0') * 100) / 100
        const legs = (st.assetPositions || [])
            .filter(a => a.position && parseFloat(a.position.szi) !== 0)
            .map(a => {
                const p = a.position
                const idx = meta.universe.findIndex(u => u.name === p.coin)
                const funding8h = idx >= 0 ? parseFloat(ctxs[idx].funding) : 0
                return {
                    perp: p.coin,
                    side: parseFloat(p.szi) < 0 ? 'short' : 'long',
                    size: Math.abs(parseFloat(p.szi)),
                    entryPx: Math.round(parseFloat(p.entryPx) * 100) / 100,
                    markPx: idx >= 0 ? Math.round(parseFloat(ctxs[idx].markPx) * 100) / 100 : null,
                    notionalUsd: Math.round(Math.abs(parseFloat(p.positionValue)) * 100) / 100,
                    uPnlUsd: Math.round(parseFloat(p.unrealizedPnl) * 100) / 100,
                    liquidationPx: p.liquidationPx ? Math.round(parseFloat(p.liquidationPx)) : null,
                    marginUsedUsd: Math.round(parseFloat(p.marginUsed || '0') * 100) / 100,
                    fundingAnnPct: Math.round(funding8h * 3 * 365 * 100 * 10) / 10,
                }
            })
        return { accountValueUsd, legs, venue: 'Hyperliquid', wallet: HL_WALLET, checkedAt: new Date().toISOString() }
    } catch (e) { warn(`HL hedge read failed (non-blocking): ${e.message}`); return null }
}

async function main() {
    log(`mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

    // Positions come from the source state (truth), the dashboard JSON gets the overlay.
    const posStore = loadJson(path.join(SRC, 'state', 'lp-positions.json'))
    const positions = posStore?.positions || []
    if (!positions.length) { log('no positions to reconcile'); process.exit(0) }

    const dash = loadJson(DASH)
    if (!dash) { warn(`${DASH} not found — run build-dashboard-data.js first`); process.exit(0) }

    const byChain = {}
    for (const p of positions) (byChain[p.chain] ||= []).push(p)

    let baseProvider = null
    const verdicts = {}
    for (const chain of Object.keys(byChain)) {
        if (chain !== 'base') { log(`skipping ${chain} reconciliation (Phase 1 = Base only)`); continue }
        const provider = await pickProvider(chain)
        if (!provider) { warn(`all ${chain} RPCs down — positions on ${chain} stay unverified`); continue }
        baseProvider = provider
        for (const p of byChain[chain]) {
            const v = await reconcileBasePosition(provider, p)
            const isOpen = p.status === 'open' || p.status === 'active'
            verdicts[p.id] = {
                funded: v.funded,
                liveLiquidity: v.liveLiquidity ?? null,
                divergence: (isOpen && v.funded === false) ? 'UNFUNDED' : (v.funded === null ? 'UNVERIFIED' : null),
                inRange: p.inRange ?? null,
                reason: v.reason,
                checkedAt: new Date().toISOString(),
            }
            const flag = verdicts[p.id].divergence || (v.funded ? 'FUNDED' : '?')
            log(`${p.id}: ${flag} (${v.reason})`)
        }
    }

    // Overlay verdicts onto the dashboard JSON
    if (dash.positions?.items) {
        dash.positions.items = dash.positions.items.map(item => {
            const v = verdicts[item.id]
            if (!v) return item
            return { ...item, funded: v.funded, liveLiquidity: v.liveLiquidity, divergence: v.divergence, inRange: v.inRange, reconciledAt: v.checkedAt }
        })
        dash.positions.reconciledAt = new Date().toISOString()
        dash.positions.unfundedCount = Object.values(verdicts).filter(v => v.divergence === 'UNFUNDED').length
    }

    // Idle LP wallet balance (undeployed capital) → completes the book value
    const wallet = baseProvider ? await reconcileBaseWallet(baseProvider) : null
    if (wallet) {
        dash.lpWallet = wallet
        const deployed = dash.book?.deployedUsd || 0
        dash.book = dash.book || {}
        dash.book.idleUsd = wallet.idleUsd
        dash.book.totalUsd = Math.round((deployed + wallet.idleUsd) * 100) / 100
        log(`LP wallet ${LP_BASE_WALLET.slice(0,8)}: idle $${wallet.idleUsd} → book total $${dash.book.totalUsd}`)
    }

    // Live Hyperliquid hedge position detail → first-class hedge panel
    const hedgeLive = await reconcileHedge()
    if (hedgeLive) {
        dash.hedge = dash.hedge || {}
        dash.hedge.active = hedgeLive.legs.length > 0
        dash.hedge.venue = 'Hyperliquid'
        dash.hedge.accountValueUsd = hedgeLive.accountValueUsd
        dash.hedge.wallet = hedgeLive.wallet
        dash.hedge.position = hedgeLive.legs[0] || null
        dash.hedge.legs = hedgeLive.legs
        dash.hedge.reconciledAt = hedgeLive.checkedAt
        const lg = hedgeLive.legs[0]
        log(`HL hedge: ${hedgeLive.legs.length} leg(s)${lg ? ` — ${lg.side} ${lg.size} ${lg.perp} @ $${lg.entryPx}, uPnL $${lg.uPnlUsd}, liq $${lg.liquidationPx}` : ''}, acct $${hedgeLive.accountValueUsd}`)
    }

    if (DRY_RUN) {
        log('verdicts:'); console.log(JSON.stringify(verdicts, null, 2))
    } else {
        fs.writeFileSync(DASH, JSON.stringify(dash, null, 2))
        log(`patched ${path.relative(WORKSPACE, DASH)}`)
        // Portfolio overview runs LAST in the chain — all three dashboards are now fresh.
        writePortfolio(dash)
    }
    process.exit(0)
}

// ─── Portfolio overview (cross-experiment value + trend) ──────────────────────
// Runs as the final step of the chain so it reads the just-generated dashboards.
// Appends a value point to portfolio-history and writes web/data/portfolio.json.
function writePortfolio(lpDash) {
    try {
        const WEB = path.join(WORKSPACE, 'web')
        const mantle = loadJson(path.join(WEB, 'mantle', 'data', 'dashboard.json'))
        const okx    = loadJson(path.join(WEB, 'okx', 'data', 'dashboard.json'))
        const lp     = lpDash || loadJson(path.join(WEB, 'lp-miner', 'data', 'dashboard.json'))

        const r2 = n => n == null ? null : Math.round(n * 100) / 100
        const lpValue = lp?.book?.totalUsd ?? lp?.book?.deployedUsd ?? null
        const mantleValue = mantle?.capital?.totalUsd ?? null
        const okxWallet = okx?.agent?.holdingsUsd ?? null      // idle in agent wallet
        const okxPool   = okx?.pool?.tvlUsd ?? null            // deployed as liquidity in Sasha's own pool
        const okxValue = (okxWallet != null || okxPool != null) ? ((okxWallet || 0) + (okxPool || 0)) : null
        const totalUsd = r2([lpValue, mantleValue, okxValue].reduce((s, v) => s + (Number(v) || 0), 0))

        // append history
        const HIST = path.join(WORKSPACE, 'state', 'portfolio-history.json')
        let hist = loadJson(HIST); if (!Array.isArray(hist)) hist = []
        const now = new Date().toISOString()
        const last = hist[hist.length - 1]
        // dedupe: skip if <4 min since last point (cron may double-fire)
        if (!last || (Date.now() - new Date(last.at).getTime()) > 240000) {
            hist.push({ at: now, lpUsd: r2(lpValue), mantleUsd: r2(mantleValue), okxUsd: r2(okxValue), totalUsd })
            hist = hist.slice(-720)   // ~ keep a long tail
            fs.writeFileSync(HIST, JSON.stringify(hist, null, 2))
        }
        const series = key => hist.map(h => ({ at: h.at, v: h[key] })).filter(p => p.v != null).slice(-120)

        const experiments = [
            {
                key: 'lp', name: 'LP Miner', thesis: 'Multi-chain liquidity book with on-chain kill-switches', kind: 'money',
                valueUsd: r2(lpValue), deployedUsd: r2(lp?.book?.deployedUsd), idleUsd: r2(lp?.book?.idleUsd),
                feesUsd: r2((lp?.positions?.items || []).reduce((s, p) => s + (Number(p.pendingFeesUsd) || 0), 0)),
                positions: lp?.positions?.openCount ?? 0, unfunded: lp?.positions?.unfundedCount ?? 0,
                status: (lp?.positions?.openCount ? 'live' : 'idle'), deepLink: './lp-miner/', history: series('lpUsd'),
                audience: 'You are the judge here', earns: 'LP fees',
            },
            {
                key: 'mantle', name: 'Mantle Trader', thesis: 'Autonomous signal trader, every decision attested on-chain', kind: 'money',
                valueUsd: r2(mantleValue), yieldEth: mantle?.treasury?.lifetimeYieldEth ?? null,
                lastAction: mantle?.status?.lastAction || null, heartbeat: mantle?.status?.heartbeat || null,
                identity: mantle?.agent?.identity?.agentId || null,
                status: mantle?.status?.heartbeat === 'live' ? 'live' : (mantle?.status?.heartbeat || 'idle'),
                deepLink: './mantle/', history: series('mantleUsd'),
                audience: 'Judges: is this a real autonomous on-chain agent?', earns: 'mETH yield + trades',
            },
            {
                key: 'okx', name: 'Dynamic Fee Hook', thesis: 'AI agent pricing its own Uniswap v4 pool’s risk on-chain', kind: 'money',
                valueUsd: r2(okxValue), poolUsd: r2(okxPool), walletUsd: r2(okxWallet),
                feePct: okx?.oracle?.currentFeePct ?? null, riskLevel: okx?.oracle?.riskLevel || null,
                pushes: (okx?.recentPushes || []).length, oracleStale: okx?.oracle?.isStale ?? null,
                status: okx?.oracle?.currentFee != null ? 'live' : 'idle', deepLink: './okx/', history: series('okxUsd'),
                audience: 'Judges: first AI agent setting dynamic v4 fees', earns: 'dynamic LP fees on its own pool',
            },
        ]

        const portfolio = {
            asOf: now,
            agent: { name: 'Sasha', xHandle: 'SashaCoin95', xUrl: 'https://x.com/SashaCoin95' },
            totalUsd,
            pointCount: hist.length,
            experiments,
        }
        const OUT = path.join(WEB, 'data', 'portfolio.json')
        fs.mkdirSync(path.dirname(OUT), { recursive: true })
        fs.writeFileSync(OUT, JSON.stringify(portfolio, null, 2))
        log(`portfolio: total $${totalUsd} (lp $${r2(lpValue)} · mantle $${r2(mantleValue)} · okx $${r2(okxValue)}) · ${hist.length} history pts`)
    } catch (e) { warn(`portfolio write failed: ${e.message}`) }
}

main().catch(e => { warn(`fatal (non-blocking): ${e.message}`); process.exit(0) })
