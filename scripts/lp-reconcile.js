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
const NPM_ABI = [
    'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 f0,uint256 f1,uint128 o0,uint128 o1)',
    // collect — read uncollected fees via staticCall(from=owner): the NPM pokes the pool internally and returns current owed. Pure eth_call.
    'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) returns (uint256 amount0,uint256 amount1)',
    // ownerOf — derive staked/unstaked from chain truth (gauge owns NFT ⇒ staked) rather than the state flag.
    'function ownerOf(uint256 tokenId) view returns (address)',
]
const MAX_UINT128 = (1n << 128n) - 1n
// CL pool slot0 (sqrtPriceX96 + current tick) — Uniswap v3 / Aerodrome Slipstream identical
const POOL_ABI = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,bool unlocked)']
// Aerodrome Slipstream CLGauge — pending emissions for a staked NFT (AERO, 18 dec)
const GAUGE_ABI = ['function earned(address account,uint256 tokenId) view returns (uint256)']

// LP miner's Base wallet (same EOA used on Base; idle balance = undeployed LP capital).
const LP_BASE_WALLET = process.env.LP_BASE_WALLET || '0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9'
// Hyperliquid hedge wallet (public address; clearinghouseState is a read-only query, no key).
const HL_WALLET = process.env.HL_WALLET_ADDRESS || '0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04'
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASE_CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)']

// Token registry for marking LP composition to market. Keyed by lowercased address.
// priceKey indexes into the prices object from fetchPrices(). N-LP ready: add a row
// per token and pool valuation works for any pair without touching the math.
const TOKENS = {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC',  decimals: 6,  priceKey: 'usdc' },
    '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': { symbol: 'cbBTC', decimals: 8,  priceKey: 'btc'  },
    '0x4200000000000000000000000000000000000006': { symbol: 'WETH',  decimals: 18, priceKey: 'eth'  },
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI',   decimals: 18, priceKey: 'usdc' },
}

function log(m) { console.log(`[lp-reconcile] ${m}`) }
function warn(m) { console.warn(`[lp-reconcile] ⚠  ${m}`) }
const round2 = n => n == null ? null : Math.round(n * 100) / 100
const round4 = n => n == null ? null : Math.round(n * 10000) / 10000
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// ─── CL math (from the defi-lp-math skill, BigInt 3-case amounts) ────────────
const Q96 = 2n ** 96n

// getSqrtRatioAtTick → sqrtPriceX96 for a tick. Float→BigInt is precise enough for
// valuing a position to the cent; the dominant term uses the exact live sqrtPriceX96.
function sqrtRatioAtTick(tick) {
    return BigInt(Math.round(Math.pow(1.0001, tick / 2) * 2 ** 96))
}

// Token amounts (RAW units) for liquidity L at the live price within [tickLower,tickUpper].
function clAmounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidity) {
    let sqrtA = sqrtRatioAX96, sqrtB = sqrtRatioBX96
    if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
    let amount0 = 0n, amount1 = 0n
    if (sqrtPriceX96 <= sqrtA) {
        amount0 = liquidity * Q96 * (sqrtB - sqrtA) / (sqrtA * sqrtB)
    } else if (sqrtPriceX96 >= sqrtB) {
        amount1 = liquidity * (sqrtB - sqrtA) / Q96
    } else {
        amount0 = liquidity * Q96 * (sqrtB - sqrtPriceX96) / (sqrtPriceX96 * sqrtB)
        amount1 = liquidity * (sqrtPriceX96 - sqrtA) / Q96
    }
    return { amount0, amount1 }
}

// sqrtPriceX96 → human price (token1 per token0), decimal-adjusted.
function sqrtPriceToHuman(sqrtPriceX96, dec0, dec1) {
    const sp = Number(sqrtPriceX96) / Number(Q96)
    const rawPrice = sp * sp                       // token1raw / token0raw
    return rawPrice * (10 ** dec0) / (10 ** dec1)  // token1 per token0, human
}

// human price (token1 per token0) → sqrtPriceX96. Inverse of sqrtPriceToHuman.
// Used to reconstruct the entry composition for the HODL benchmark.
function humanPriceToSqrtX96(humanPrice, dec0, dec1) {
    const adjusted = humanPrice * (10 ** dec1) / (10 ** dec0)   // token1raw/token0raw
    return BigInt(Math.floor(Math.sqrt(adjusted) * 2 ** 96))
}

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

// Fetch USD prices (ETH, BTC, AERO) from DefiLlama; USDC = 1.
function fetchPrices() {
    return new Promise(resolve => {
        const ids = 'coingecko:ethereum,coingecko:bitcoin,coingecko:aerodrome-finance'
        const fallback = { eth: 0, btc: 0, aero: 0, usdc: 1 }
        const req = https.get(`https://coins.llama.fi/prices/current/${ids}`, res => {
            let d = ''; res.on('data', c => d += c)
            res.on('end', () => {
                try {
                    const j = JSON.parse(d), c = j.coins || {}
                    resolve({
                        eth:  c['coingecko:ethereum']?.price || 0,
                        btc:  c['coingecko:bitcoin']?.price || 0,
                        aero: c['coingecko:aerodrome-finance']?.price || 0,
                        usdc: 1,
                    })
                } catch { resolve(fallback) }
            })
        })
        req.on('error', () => resolve(fallback))
        req.setTimeout(8000, () => { req.destroy(); resolve(fallback) })
    })
}

// Idle (undeployed) LP capital sitting in the Base wallet.
async function reconcileBaseWallet(provider) {
    const rpcs = (process.env.BASE_RPC_URLS || 'https://mainnet.base.org,https://base.llamarpc.com,https://base-rpc.publicnode.com').split(',')
    for (let attempt = 0; attempt < rpcs.length; attempt++) {
        try {
            const p = attempt === 0 ? provider : new ethers.JsonRpcProvider(rpcs[attempt])
            const prices = await fetchPrices()
            const eth = parseFloat(ethers.formatEther(await p.getBalance(LP_BASE_WALLET)))
            const usdc = new ethers.Contract(BASE_USDC, ERC20_ABI, p)
            const cbbtc = new ethers.Contract(BASE_CBBTC, ERC20_ABI, p)
            const usdcBal = parseFloat(ethers.formatUnits(await usdc.balanceOf(LP_BASE_WALLET), 6))
            const cbbtcBal = parseFloat(ethers.formatUnits(await cbbtc.balanceOf(LP_BASE_WALLET), 8))
            const idleUsd = usdcBal * 1 + cbbtcBal * prices.btc + eth * prices.eth
            return { address: LP_BASE_WALLET, chain: 'base', usdc: usdcBal, cbbtc: cbbtcBal, eth, idleUsd: Math.round(idleUsd * 100) / 100 }
        } catch (e) {
            if (attempt < rpcs.length - 1) { await new Promise(r => setTimeout(r, 400)) }
            else { warn(`wallet read failed after ${rpcs.length} attempts: ${e.message.slice(0, 50)}`); return null }
        }
    }
}

// Full live reconcile of a Base CL position: funded check + mark-to-market value,
// token composition, range geometry, pending gauge emissions, and the HODL benchmark.
// openPrice = the non-stable asset's price at entry (the real Hyperliquid fill), used
// to reconstruct the entry composition for the "vs HODL" benchmark. Read-only.
async function reconcileBasePosition(provider, position, prices, openPrice) {
    if (!position.nftTokenId) return { funded: null, reason: 'no NFT id recorded' }
    try {
        const npm = new ethers.Contract(AERO_NPM, NPM_ABI, provider)
        const pos = await npm.positions(BigInt(position.nftTokenId))
        const liquidity = pos.liquidity
        const funded = liquidity > 0n
        const tickLower = Number(pos.tickLower), tickUpper = Number(pos.tickUpper)
        const t0 = TOKENS[String(pos.token0).toLowerCase()]
        const t1 = TOKENS[String(pos.token1).toLowerCase()]

        // On-chain staked derivation: the gauge holds the NFT when staked, the LP wallet when not.
        // Falls back to the state flag if the read fails. This makes the staked label chain-truth.
        let stakedOnChain = null, onChainOwner = null
        try {
            onChainOwner = await npm.ownerOf(BigInt(position.nftTokenId))
            stakedOnChain = onChainOwner.toLowerCase() !== LP_BASE_WALLET.toLowerCase()
        } catch (e) { warn(`ownerOf read failed for ${position.id}: ${e.message.slice(0, 40)}`) }
        const isStaked = stakedOnChain ?? Boolean(position.staked)

        const out = {
            funded, liveLiquidity: liquidity.toString(), tickLower, tickUpper,
            onChainOwner, stakedOnChain,
            currentTick: null, currentPrice: null, inRange: null,
            composition: null, lpValueUsd: null,
            hedgedAssetAmount: null,            // non-stable token amount in the LP (for net delta)
            hedgedAssetSymbol: null,
            hodlUsd: null, ilVsHodlUsd: null,   // HODL benchmark (true IL)
            entryComposition: null,
            emissionsToken: null, emissionsAmount: null, emissionsUsd: null,
            reason: funded ? 'on-chain liquidity > 0' : 'NFT exists but liquidity is 0',
        }

        // ── Mark to market: read the live pool price, split L into token amounts ──
        if (funded && position.poolAddress && t0 && t1) {
            try {
                const pool = new ethers.Contract(position.poolAddress, POOL_ABI, provider)
                const s0 = await pool.slot0()
                const sqrtP = s0.sqrtPriceX96
                const currentTick = Number(s0.tick)
                const sqrtA = sqrtRatioAtTick(tickLower), sqrtB = sqrtRatioAtTick(tickUpper)
                const { amount0, amount1 } = clAmounts(sqrtP, sqrtA, sqrtB, liquidity)
                const amt0 = Number(amount0) / 10 ** t0.decimals
                const amt1 = Number(amount1) / 10 ** t1.decimals
                const p0 = prices[t0.priceKey] ?? 0, p1 = prices[t1.priceKey] ?? 0
                const usd0 = amt0 * p0, usd1 = amt1 * p1
                const humanPrice = sqrtPriceToHuman(sqrtP, t0.decimals, t1.decimals)
                const stable0 = t0.priceKey === 'usdc', stable1 = t1.priceKey === 'usdc'
                out.currentTick = currentTick
                out.inRange = currentTick >= tickLower && currentTick < tickUpper
                // currentPrice: the non-stable leg's price in USD (what a human reads, e.g. BTC).
                out.currentPrice = stable0 ? p1 : stable1 ? p0 : (1 / humanPrice)
                out.composition = {
                    token0: { symbol: t0.symbol, amount: round4(amt0) ?? round2(amt0), usd: round2(usd0) },
                    token1: { symbol: t1.symbol, amount: Number(amt1.toFixed(8)), usd: round2(usd1) },
                }
                out.lpValueUsd = round2(usd0 + usd1)
                // non-stable exposure (for the unit net-delta vs the hedge short)
                if (stable0 && !stable1) { out.hedgedAssetAmount = Number(amt1.toFixed(8)); out.hedgedAssetSymbol = t1.symbol }
                else if (stable1 && !stable0) { out.hedgedAssetAmount = Number(amt0.toFixed(8)); out.hedgedAssetSymbol = t0.symbol }

                // ── HODL benchmark: reconstruct entry composition at the entry price ──
                if (openPrice && (stable0 || stable1)) {
                    // humanPrice is token1-per-token0; map the non-stable USD price to it
                    const humanOpen = stable0 ? (1 / openPrice) : openPrice
                    const sqrtOpen = humanPriceToSqrtX96(humanOpen, t0.decimals, t1.decimals)
                    const e = clAmounts(sqrtOpen, sqrtA, sqrtB, liquidity)
                    const e0 = Number(e.amount0) / 10 ** t0.decimals
                    const e1 = Number(e.amount1) / 10 ** t1.decimals
                    const hodl = e0 * p0 + e1 * p1   // entry tokens valued at CURRENT prices
                    out.entryComposition = {
                        token0: { symbol: t0.symbol, amount: round4(e0) ?? round2(e0) },
                        token1: { symbol: t1.symbol, amount: Number(e1.toFixed(8)) },
                        atPrice: round2(openPrice),
                    }
                    out.hodlUsd = round2(hodl)
                    out.ilVsHodlUsd = round2((usd0 + usd1) - hodl)   // LP value − HODL = true IL (≤ 0)
                }
            } catch (e) { warn(`slot0/mtm read failed for ${position.id}: ${e.message.slice(0, 50)}`) }
        }

        // ── Emissions: pending AERO from the Slipstream gauge (staked positions) ──
        if (funded && position.gaugeAddress) {
            try {
                const gauge = new ethers.Contract(position.gaugeAddress, GAUGE_ABI, provider)
                const earned = await gauge.earned(LP_BASE_WALLET, BigInt(position.nftTokenId))
                const aero = Number(earned) / 1e18
                out.emissionsToken = 'AERO'
                out.emissionsAmount = round4(aero)
                out.emissionsUsd = round2(aero * (prices.aero || 0))
            } catch (e) { warn(`gauge.earned read failed for ${position.id}: ${e.message.slice(0, 50)}`) }
        }

        // ── Uncollected swap fees (unstaked / fee-collect positions) ──
        // collect.staticCall(from=owner): the NPM burns 0 to poke the pool, updates tokensOwed to current
        // fee growth, and returns the collectable amount. Pure eth_call — no tx, no gas, no signature.
        // Skip when staked: the NFT is owned by the gauge (auth would fail) and organic fees accrue to voters.
        if (funded && t0 && t1 && !isStaked) {
            try {
                const res = await npm.collect.staticCall(
                    { tokenId: BigInt(position.nftTokenId), recipient: LP_BASE_WALLET, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 },
                    { from: LP_BASE_WALLET }
                )
                const f0 = Number(res[0]) / 10 ** t0.decimals
                const f1 = Number(res[1]) / 10 ** t1.decimals
                const fp0 = prices[t0.priceKey] ?? 0, fp1 = prices[t1.priceKey] ?? 0
                out.swapFeesPendingUsd = round2(f0 * fp0 + f1 * fp1)
                out.swapFeesPending = {
                    token0: { symbol: t0.symbol, amount: round4(f0) ?? Number(f0.toFixed(8)), usd: round2(f0 * fp0) },
                    token1: { symbol: t1.symbol, amount: Number(f1.toFixed(8)), usd: round2(f1 * fp1) },
                }
            } catch (e) { warn(`collect.staticCall (fees) failed for ${position.id}: ${e.message.slice(0, 50)}`) }
        }

        return out
    } catch (e) {
        return { funded: null, reason: `read failed: ${e.message.slice(0, 50)}` }
    }
}

// One-time gas cost (open + stake), read from receipts. Best-effort, defaults to 0.
async function reconcileGasUsd(provider, position, ethPrice) {
    const hashes = [position.openTxHash, position.stakeTxHash].filter(Boolean)
    if (!hashes.length || !ethPrice) return 0
    let weiTotal = 0n
    for (const h of hashes) {
        try {
            const r = await provider.getTransactionReceipt(h)
            if (r && r.gasUsed != null && r.gasPrice != null) weiTotal += r.gasUsed * r.gasPrice
        } catch { /* skip unreadable receipt */ }
    }
    const eth = Number(ethers.formatEther(weiTotal))
    return Math.round(eth * ethPrice * 10000) / 10000
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
                // cumFunding.sinceOpen = funding PAID since the position opened.
                // We are short; positive funding rate ⇒ longs pay us ⇒ paid is negative
                // ⇒ fundingUsd received = −sinceOpen. Real carry, not an annualized guess.
                const fundingPaid = parseFloat(p.cumFunding?.sinceOpen ?? '0')
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
                    fundingUsd: Math.round(-fundingPaid * 100) / 100,
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

    const prices = await fetchPrices()
    log(`prices: BTC $${prices.btc} · ETH $${prices.eth} · AERO $${prices.aero}`)

    // Live Hyperliquid hedge FIRST — its entry fill is the open price the LP's HODL
    // benchmark reconstructs against, and the leg drives per-position attribution.
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
        log(`HL hedge: ${hedgeLive.legs.length} leg(s)${lg ? ` — ${lg.side} ${lg.size} ${lg.perp} @ $${lg.entryPx}, uPnL $${lg.uPnlUsd}, fund $${lg.fundingUsd}, liq $${lg.liquidationPx}` : ''}, acct $${hedgeLive.accountValueUsd}`)
    }
    // Map perp → leg and total hedge size per perp (a leg shared by several LPs is
    // apportioned by each LP's share of the hedge — N-LP correct).
    const legByPerp = {}
    for (const lg of (hedgeLive?.legs || [])) legByPerp[lg.perp] = lg
    const hedgeSizeByPerp = {}
    for (const p of positions) if ((p.hedgeSize ?? 0) > 0 && p.hedgePerp) hedgeSizeByPerp[p.hedgePerp] = (hedgeSizeByPerp[p.hedgePerp] || 0) + p.hedgeSize

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
            const openPrice = (p.hedgePerp && legByPerp[p.hedgePerp]) ? legByPerp[p.hedgePerp].entryPx : null
            const v = await reconcileBasePosition(provider, p, prices, openPrice)
            const gasUsd = v.funded ? await reconcileGasUsd(provider, p, prices.eth) : 0
            const isOpen = p.status === 'open' || p.status === 'active'
            verdicts[p.id] = {
                funded: v.funded,
                liveLiquidity: v.liveLiquidity ?? null,
                divergence: (isOpen && v.funded === false) ? 'UNFUNDED' : (v.funded === null ? 'UNVERIFIED' : null),
                tickLower: v.tickLower ?? null, tickUpper: v.tickUpper ?? null,
                currentTick: v.currentTick ?? null, currentPrice: v.currentPrice ?? null,
                inRange: v.inRange ?? (p.inRange ?? null),
                lpValueUsd: v.lpValueUsd ?? null, composition: v.composition ?? null,
                hedgedAssetAmount: v.hedgedAssetAmount ?? null, hedgedAssetSymbol: v.hedgedAssetSymbol ?? null,
                hodlUsd: v.hodlUsd ?? null, ilVsHodlUsd: v.ilVsHodlUsd ?? null, entryComposition: v.entryComposition ?? null,
                emissionsToken: v.emissionsToken ?? null, emissionsAmount: v.emissionsAmount ?? null,
                emissionsUsd: v.emissionsUsd ?? null,
                swapFeesPendingUsd: v.swapFeesPendingUsd ?? null, swapFeesPending: v.swapFeesPending ?? null,
                stakedOnChain: v.stakedOnChain ?? null, onChainOwner: v.onChainOwner ?? null,
                gasUsd,
                reason: v.reason,
                checkedAt: new Date().toISOString(),
            }
            const flag = verdicts[p.id].divergence || (v.funded ? 'FUNDED' : '?')
            log(`${p.id}: ${flag} — LP $${v.lpValueUsd ?? '?'}, HODL $${v.hodlUsd ?? '?'}, emis $${v.emissionsUsd ?? '?'} (${v.reason})`)
        }
    }

    // ── Overlay live truth + per-position P&L decomposition onto each card ──
    if (dash.positions?.items) {
        dash.positions.items = dash.positions.items.map(item => {
            const v = verdicts[item.id]
            if (!v) return item
            const it = { ...item }
            it.funded = v.funded; it.liveLiquidity = v.liveLiquidity; it.divergence = v.divergence
            it.lpValueUsd = v.lpValueUsd; it.composition = v.composition
            it.emissionsToken = v.emissionsToken; it.emissionsAmount = v.emissionsAmount; it.emissionsUsd = v.emissionsUsd
            if (v.stakedOnChain != null) it.staked = v.stakedOnChain   // chain truth (gauge vs LP wallet) wins over the state flag
            it.onChainOwner = v.onChainOwner ?? null
            it.swapFeesUsd = it.staked ? 0 : (v.swapFeesPendingUsd ?? null)   // staked ⇒ organic fees go to voters; unstaked ⇒ real on-chain uncollected fees
            it.swapFeesPending = it.staked ? null : (v.swapFeesPending ?? null)
            it.gasUsd = v.gasUsd
            it.reconciledAt = v.checkedAt

            // range geometry — marker placed by PRICE (what a human reads), inRange by tick
            const lo = it.range?.lowerPrice, hi = it.range?.upperPrice, cur = v.currentPrice
            const rng = { ...(it.range || {}), currentPrice: cur, currentTick: v.currentTick, tickLower: v.tickLower, tickUpper: v.tickUpper, inRange: v.inRange }
            if (lo != null && hi != null && cur != null && hi > lo) {
                rng.pctOfRange = Math.round(clamp((cur - lo) / (hi - lo), 0, 1) * 1000) / 10
                rng.distanceToLowerPct = Math.round((cur / lo - 1) * 1000) / 10
                rng.distanceToUpperPct = Math.round((hi / cur - 1) * 1000) / 10
            }
            it.range = rng

            // hedge leg attribution (by share of total hedge size on this perp)
            const leg = it.hedge?.perp ? legByPerp[it.hedge.perp] : null
            let hedgeUPnlUsd = 0, fundingUsd = 0, marginUsedUsd = 0
            if (leg) {
                const totalSz = hedgeSizeByPerp[it.hedge.perp] || leg.size || 1
                const share = totalSz > 0 ? clamp((it.hedge.size || 0) / totalSz, 0, 1) : 1
                hedgeUPnlUsd = round2((leg.uPnlUsd || 0) * share)
                fundingUsd = round2((leg.fundingUsd || 0) * share)
                marginUsedUsd = round2((leg.marginUsedUsd || 0) * share)
                it.hedge = {
                    ...it.hedge, active: true, side: leg.side,
                    intendedSize: it.hedge.size,                      // what state wanted hedged
                    size: Number((leg.size * share).toFixed(8)),     // the ACTUAL live short (HL truth, not state)
                    notionalUsd: round2((leg.notionalUsd || 0) * share),
                    entryPx: leg.entryPx, markPx: leg.markPx, uPnlUsd: hedgeUPnlUsd,
                    liquidationPx: leg.liquidationPx, marginUsedUsd,
                    fundingAnnPct: leg.fundingAnnPct, fundingUsd,
                }
            } else if (it.hedge?.configured) {
                it.hedge = { ...it.hedge, active: false }
            }

            // ── TRUE net P&L (marked to market), the number the old dashboard hid ──
            if (v.lpValueUsd != null && it.deployedBasisUsd != null) {
                const lpMtmChangeUsd = round2(v.lpValueUsd - it.deployedBasisUsd)
                const emissionsUsd = v.emissionsUsd || 0
                const swapFeesUsd = it.swapFeesUsd || 0   // uncollected swap fees (unstaked yield), real on-chain
                const gasUsd = v.gasUsd || 0
                const divergenceAfterHedgeUsd = round2(lpMtmChangeUsd + hedgeUPnlUsd)
                const netResultUsd = round2(lpMtmChangeUsd + hedgeUPnlUsd + emissionsUsd + swapFeesUsd + fundingUsd - gasUsd)
                const workingCapitalUsd = round2((it.deployedBasisUsd || 0) + marginUsedUsd)
                it.pnl = {
                    lpMtmChangeUsd, hedgeUPnlUsd,
                    divergenceAfterHedgeUsd,           // honest IL-after-hedge
                    emissionsUsd: round2(emissionsUsd), swapFeesUsd: round2(swapFeesUsd), fundingUsd, gasUsd: round2(gasUsd),
                    netResultUsd, workingCapitalUsd,
                    returnPct: workingCapitalUsd > 0 ? Math.round((netResultUsd / workingCapitalUsd) * 10000) / 100 : null,
                }
            } else {
                it.pnl = null   // could not mark to market — front-end shows "awaiting on-chain sync"
            }

            // ── v1+ analytics (Revert-audit additions) ──
            const st = positions.find(sp => sp.id === item.id) || {}
            const ageDays = it.openedAt ? Math.round((Date.now() - new Date(it.openedAt).getTime()) / 86_400_000 * 10) / 10 : null
            it.ageDays = ageDays
            const emisClaimedUsd = round2(st.claimedEmissionsUsd || 0)
            const feesClaimedUsd = round2(st.claimedFeesUsd || 0)

            // (3) yield: pending vs claimed, for fees AND emissions
            it.yield = {
                fees: {
                    pendingUsd: it.swapFeesUsd, claimedUsd: feesClaimedUsd,
                    note: it.staked ? 'organic fees accrue to veAERO voters while staked' : null,
                },
                emissions: {
                    token: v.emissionsToken, pendingAmount: v.emissionsAmount, pendingUsd: v.emissionsUsd,
                    claimedUsd: emisClaimedUsd, lastClaimAt: st.lastClaimAt || null,
                },
            }

            // (5) net delta of the unit: LP non-stable exposure − hedge short (signed)
            if (v.hedgedAssetAmount != null) {
                const shortSize = (it.hedge && it.hedge.active) ? (it.hedge.size || 0) : 0
                const netUnits = Number((v.hedgedAssetAmount - shortSize).toFixed(8))
                it.netDelta = {
                    asset: v.hedgedAssetSymbol, lpLong: v.hedgedAssetAmount, hedgeShort: shortSize,
                    netUnits, netUsd: round2(netUnits * (v.currentPrice || 0)),
                }
            }

            if (it.pnl) {
                // (1) IL first-class: raw LP value vs deposit (the number the flat $45 hid)
                it.ilUsd = it.pnl.lpMtmChangeUsd

                // (4) cost basis: invested / current(MTM) / withdrawn / net diff
                it.costBasis = {
                    investedUsd: it.deployedBasisUsd,
                    currentUsd: it.lpValueUsd,
                    withdrawnUsd: round2(emisClaimedUsd + feesClaimedUsd),
                    netDiffUsd: round2((it.lpValueUsd || 0) + emisClaimedUsd + feesClaimedUsd - (it.deployedBasisUsd || 0)),
                }

                // (6) benchmark: result vs HODL + result net-after-hedge (is the hedge doing its job?)
                it.benchmark = {
                    hodlUsd: v.hodlUsd, lpValueUsd: it.lpValueUsd,
                    ilVsHodlUsd: v.ilVsHodlUsd,                          // LP − HODL = true IL
                    divergenceAfterHedgeUsd: it.pnl.divergenceAfterHedgeUsd,
                    netResultUsd: it.pnl.netResultUsd,
                    entryPrice: it.hedge?.entryPx ?? (v.entryComposition?.atPrice ?? null),
                }

                // (2) APR stack: total / fee / emission / funding, never one blended number.
                // Projection from a short sample; labeled as such, not a realized rate.
                if (ageDays && ageDays > 0) {
                    const ann = x => (x / ageDays) * 365
                    const base = it.lpValueUsd || it.deployedBasisUsd || 0
                    const wc = it.pnl.workingCapitalUsd || base
                    const feeApr = base > 0 ? round2(ann(it.swapFeesUsd || 0) / base * 100) : 0
                    const emissionApr = base > 0 ? round2(ann(v.emissionsUsd || 0) / base * 100) : 0
                    const fundingApr = wc > 0 ? round2(ann(it.pnl.fundingUsd || 0) / wc * 100) : 0
                    it.apr = {
                        totalApr: round2(feeApr + emissionApr + fundingApr),
                        feeApr, emissionApr, fundingApr,
                        basis: `annualized from ${ageDays}d. A projection, not a realized rate.`,
                    }
                }
            }
            return it
        })
        dash.positions.reconciledAt = new Date().toISOString()
        dash.positions.unfundedCount = Object.values(verdicts).filter(v => v.divergence === 'UNFUNDED').length
    }

    // Idle LP wallet balance (undeployed, quarantined — never inside the return)
    const wallet = baseProvider ? await reconcileBaseWallet(baseProvider) : null
    if (wallet) dash.lpWallet = wallet

    // ── Book: working capital vs idle, marked to market. Never blend them. ──
    const items = dash.positions?.items || []
    const marked = items.filter(p => p.lpValueUsd != null)
    const deployedBasisUsd = round2(dash.book?.deployedBasisUsd ?? items.reduce((s, p) => s + (p.deployedBasisUsd || 0), 0))
    const lpValueUsd = marked.length ? round2(marked.reduce((s, p) => s + (p.lpValueUsd || 0), 0)) : null
    const hedgeMarginUsd = round2(items.reduce((s, p) => s + (p.hedge?.marginUsedUsd || 0), 0))
    const hlAcctUsd = round2(dash.hedge?.accountValueUsd || 0)
    const lpWalletUsd = round2(wallet?.idleUsd || 0)
    const hedgeBufferUsd = round2(Math.max(0, hlAcctUsd - hedgeMarginUsd))
    const workingCapitalUsd = round2(deployedBasisUsd + hedgeMarginUsd)
    const idleTotalUsd = round2(hedgeBufferUsd + lpWalletUsd)
    // total footprint, marked to market (LP value + hedge account + idle wallet) — secondary to the net result
    const navUsd = round2((lpValueUsd ?? deployedBasisUsd) + hlAcctUsd + lpWalletUsd)
    dash.book = {
        deployedBasisUsd, lpValueUsd, hedgeMarginUsd, workingCapitalUsd,
        idle: { hedgeBufferUsd, lpWalletUsd, totalUsd: idleTotalUsd },
        navUsd,
        note: 'workingCapitalUsd = LP basis + hedge margin used (the return denominator). idle is quarantined, never in the return. navUsd = marked-to-market footprint, secondary to the net result.',
    }

    // ── THE HERO: marked-to-market net result on working capital ──
    const priced = items.filter(p => p.pnl)
    const sum = key => round2(priced.reduce((s, p) => s + (p.pnl[key] || 0), 0))
    const netResultUsd = priced.length ? sum('netResultUsd') : null
    const returnPct = (netResultUsd != null && workingCapitalUsd > 0) ? Math.round((netResultUsd / workingCapitalUsd) * 10000) / 100 : null
    const earliestOpen = items.map(p => p.openedAt).filter(Boolean).sort()[0] || null
    const periodDays = earliestOpen ? Math.round((Date.now() - new Date(earliestOpen).getTime()) / 86_400_000 * 10) / 10 : null
    const killArmed = dash.killSwitch?.armed?.length || 0
    const deltaNeutral = !!dash.hedge?.active
    let status
    if (killArmed > 0) status = 'action needed'
    else if (deltaNeutral) status = 'delta-neutral · carry accruing'
    else status = 'directional (unhedged)'
    dash.overall = {
        netResultUsd, returnPct, periodDays,
        onWorkingCapitalUsd: workingCapitalUsd,
        divergenceAfterHedgeUsd: priced.length ? sum('divergenceAfterHedgeUsd') : null,
        components: priced.length ? {
            lpMtmChangeUsd: sum('lpMtmChangeUsd'), hedgeUPnlUsd: sum('hedgeUPnlUsd'),
            emissionsUsd: sum('emissionsUsd'), swapFeesUsd: sum('swapFeesUsd'), fundingUsd: sum('fundingUsd'), gasUsd: sum('gasUsd'),
        } : null,
        navUsd,
        fundingAnnPct: dash.hedge?.position?.fundingAnnPct ?? null,
        deltaNeutral, killArmed, status,
        note: 'Hero = LP mark-to-market change + hedge PnL + swap fees + emissions + funding − gas, on working capital. NAV is secondary.',
    }
    log(`overall: NET $${netResultUsd} (${returnPct}% on $${workingCapitalUsd} working, ${periodDays}d) | LP MTM $${lpValueUsd} vs basis $${deployedBasisUsd} | NAV $${navUsd} | ${status}`)

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

        // CROO — read live order data
        const crooOrders = loadJson(path.join(WORKSPACE, 'croo', 'data', 'orders-log.json')) || []
        const crooOk = crooOrders.filter(o => o.ok)
        const crooRevenue = crooOk.reduce((s, o) => s + (Number(o.revenueUsd) || 0), 0)

        // LP value = marked-to-market footprint (LP value + hedge account + idle wallet).
        const lpValue = lp?.book?.navUsd ?? lp?.book?.lpValueUsd ?? lp?.book?.deployedBasisUsd ?? null
        // nav = idle wallet + value deployed in open LP positions (full book).
        // Fall back to idle-only if nav is missing (e.g. positions fetch failed).
        const mantleValue = mantle?.nav ?? mantle?.capital?.totalUsd ?? null
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
                valueUsd: r2(lpValue), deployedUsd: r2(lp?.book?.deployedBasisUsd), idleUsd: r2(lp?.book?.idle?.totalUsd),
                netResultUsd: r2(lp?.overall?.netResultUsd), returnPct: lp?.overall?.returnPct ?? null,
                emissionsUsd: r2((lp?.positions?.items || []).reduce((s, p) => s + (Number(p.emissionsUsd) || 0), 0)),
                positions: lp?.positions?.openCount ?? 0, unfunded: lp?.positions?.unfundedCount ?? 0,
                status: (lp?.positions?.openCount ? 'live' : 'idle'), deepLink: './lp-miner/', history: series('lpUsd'),
                audience: 'You are the judge here', earns: 'AERO emissions + funding',
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
                key: 'okx', name: 'Dynamic Fee Hook', thesis: "AI agent pricing its own Uniswap v4 pool's risk on-chain", kind: 'money',
                valueUsd: r2(okxValue), poolUsd: r2(okxPool), walletUsd: r2(okxWallet),
                feePct: okx?.oracle?.currentFeePct ?? null, riskLevel: okx?.oracle?.riskLevel || null,
                pushes: (okx?.recentPushes || []).length, oracleStale: okx?.oracle?.isStale ?? null,
                status: okx?.oracle?.currentFee != null ? 'live' : 'idle', deepLink: './okx/', history: series('okxUsd'),
                audience: 'Judges: first AI agent setting dynamic v4 fees', earns: 'dynamic LP fees on its own pool',
            },
            {
                key: 'casper', name: 'Casper x402', thesis: 'Every decision attested on Casper — PAY + ATTEST live on casper-test', kind: 'infra',
                valueUsd: null, status: 'live', deepLink: './casper/', history: [],
                audience: 'Judges: AI agent proves decisions on-chain, not just claims them', earns: 'on-chain attestation · x402 payments',
            },
            {
                key: 'croo', name: 'CROO Risk Desk', thesis: 'Sells LP risk packets as a paid service over the CAP protocol — USDC settled on Base', kind: 'infra',
                valueUsd: 0, orders: crooOk.length, revenueUsd: r2(crooRevenue), services: 3,
                status: 'live', deepLink: './croo/', history: [],
                audience: 'DeFi agents that need LP risk signals on Base',
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
