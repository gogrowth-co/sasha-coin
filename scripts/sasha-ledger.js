#!/usr/bin/env node
/**
 * sasha-ledger.js — what Sasha earns and what she costs. Read-only.
 *
 * Loads no private key, signs nothing, holds no spending power. It reads the
 * chain (public RPC), public APIs and the state files the other crons write,
 * and writes two files:
 *
 *   state/ledger.json       full ledger: every line with its source and status
 *   web/data/ledger.json    public copy for the dashboard tile (no env names)
 *
 * Hard rule (Gabriel, 2026-10-27): a line with no source says "unknown", never
 * an estimate. Line status:
 *   ok       fully sourced
 *   partial  the sourced part only (usd = that part); the rest is unknown
 *   unknown  no source; usd is null
 *   stale    the source failed this run; last good value carried, with the error
 *
 * Valuation: flows (fees collected, gas paid, emissions claimed) at the daily
 * CoinGecko price of their date; accrued, not yet collected pool fees at the
 * current price. Stablecoins (USDC, USDC.e, USD1, Hyperliquid USDC) at par.
 *
 * Slow sources (receipts, Solana fees, historical prices) backfill a capped
 * number of items per run and cache them in state/ledger-cache.json, so the
 * first runs show "partial" and fill in over the next 15-minute runs.
 *
 * Runs in the dashboard cron chain after lp-reconcile.js. Never throws, always
 * exits 0, stops work at a deadline so the deploy step that follows still runs.
 *
 * Usage:
 *   node scripts/sasha-ledger.js             # write both files
 *   node scripts/sasha-ledger.js --dry-run   # print the ledger, write nothing
 *
 * Sasha Coin — cost and earnings ledger (V4 onboarding slice 1)
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')
const STARTED = Date.now()
const DEADLINE = STARTED + Number(process.env.LEDGER_DEADLINE_MS || 150000)
const timeLeft = () => DEADLINE - Date.now()

const STATE = path.join(WORKSPACE, 'state')
const OUT = path.join(STATE, 'ledger.json')
const OUT_PUBLIC = path.join(WORKSPACE, 'web', 'data', 'ledger.json')
const CACHE_FILE = path.join(STATE, 'ledger-cache.json')
const HISTORY_FILE = path.join(STATE, 'ledger-history.json')
const CONFIG_FILE = path.join(__dirname, 'ledger-config.json')

const DAY = 86400000
const WEEK_AGO = STARTED - 7 * DAY

// Per-run caps on slow lookups (public endpoints rate-limit; the cache carries the rest).
const CAP = { receipts: 80, solanaTx: 15, prices: 12, blocks: 80 }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const WALLETS = {
    evm: (process.env.LP_BASE_WALLET || '0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9').toLowerCase(),
    keeper: '0xe451278F3ce3f80d2F18ab292Ad2C3dAfE461d1f'.toLowerCase(),
    hl: process.env.HL_WALLET_ADDRESS || '0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04',
    solana: process.env.SOLANA_AGENT_WALLET || '647TT6SWA48yrmH8Csb2QakeYMnCNh2oSFijLQpRksJw',
}

const RPCS = {
    base:   ['https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://1rpc.io/base'],
    mantle: ['https://rpc.mantle.xyz', 'https://mantle-rpc.publicnode.com'],
    xlayer: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
}
const CHAIN_IDS = { base: 8453, mantle: 5000, xlayer: 196 }
const NATIVE_COIN = { base: 'ethereum', mantle: 'mantle', xlayer: 'okb' }
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'

// Base token addresses -> CoinGecko id (null = stablecoin at par)
const BASE_TOKENS = {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', coin: null },
    '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': { symbol: 'cbBTC', coin: 'coinbase-wrapped-btc' },
    '0x4200000000000000000000000000000000000006': { symbol: 'WETH', coin: 'ethereum' },
    '0x940181a94a35a4569e4529a3cdfb74e38fd98631': { symbol: 'AERO', coin: 'aerodrome-finance' },
}
const AERO_NPM = '0x827922686190790b37229fd06084350E74485b72'.toLowerCase()
const AERO_TOKEN = '0x940181a94A35A4569E4529A3CDfB74e38FD98631'.toLowerCase()

// Which chains a state file's tx hashes can belong to (saves receipt lookups on the wrong chain).
function chainsFor(file) {
    if (file.startsWith('xlayer-')) return ['xlayer']
    if (file.startsWith('mantle-') || file.startsWith('erc8004')) return ['mantle']
    if (file.startsWith('lp-')) return ['base']
    return ['base', 'mantle', 'xlayer']
}

// ---------------------------------------------------------------- helpers

const round2 = n => (n == null || !isFinite(n)) ? null : Math.round(n * 100) / 100
const round6 = n => (n == null || !isFinite(n)) ? null : Math.round(n * 1e6) / 1e6
const dayOf = ms => new Date(ms).toISOString().slice(0, 10)
const log = (...a) => console.log('[ledger]', ...a)

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeJsonAtomic(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, file)
}

function httpJson(url, { method = 'GET', headers = {}, body = null, timeout = 15000 } = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method, headers: { 'accept': 'application/json', 'user-agent': 'sasha-ledger/1.0', ...headers }, timeout }, res => {
            let data = ''
            res.on('data', c => data += c)
            res.on('end', () => {
                if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} from ${new URL(url).host}`))
                try { resolve(JSON.parse(data)) } catch { reject(new Error(`bad JSON from ${new URL(url).host}`)) }
            })
        })
        req.on('timeout', () => req.destroy(new Error(`timeout from ${new URL(url).host}`)))
        req.on('error', reject)
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
        req.end()
    })
}

// Multi-RPC failover, the same idea as lp-reconcile.js: try each endpoint until one answers.
const providers = {}
function provider(chain, i) {
    const key = chain + i
    if (!providers[key]) {
        const req = new ethers.FetchRequest(RPCS[chain][i])
        req.timeout = 15000
        providers[key] = new ethers.JsonRpcProvider(req, CHAIN_IDS[chain], { staticNetwork: true })
    }
    return providers[key]
}
async function rpc(chain, fn) {
    let last
    for (let i = 0; i < RPCS[chain].length; i++) {
        try { return await fn(provider(chain, i)) } catch (e) { last = e }
    }
    throw new Error(`${chain}: all RPCs failed (${String(last?.shortMessage || last?.message || last).slice(0, 120)})`)
}

// ---------------------------------------------------------------- cache, history, prices

const cache = readJson(CACHE_FILE, {})
cache.receipts ||= {}        // `${chain}:${hash}` -> { from, feeWei, block, ts } | { miss: true }
cache.blockTs ||= {}         // `${chain}:${block}` -> unix seconds
cache.prices ||= {}          // `${coin}|${YYYY-MM-DD}` -> usd
cache.lp ||= {}              // `${tokenId}` -> { done, fees: {addr: raw}, events: [...] }
cache.emissions ||= {}       // `${gauge}` -> { done, claims: [{ amount, block }] }
cache.solana ||= {}          // signature -> { fee, ts, payer }
const used = { receipts: 0, solanaTx: 0, prices: 0, blocks: 0 }

const currentPrices = {}
async function loadCurrentPrices(coins) {
    const ids = [...new Set(coins.filter(Boolean))]
    if (!ids.length) return
    try {
        const r = await httpJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
        for (const id of ids) if (r[id]?.usd != null) currentPrices[id] = r[id].usd
    } catch (e) { log('current prices failed:', e.message) }
}

// Daily price of a coin on a date (UTC). null coin = stablecoin at par. Returns null when not known yet.
async function priceOn(coin, ms) {
    if (!coin) return 1
    const day = dayOf(ms)
    if (day === dayOf(STARTED)) return currentPrices[coin] ?? null
    const key = `${coin}|${day}`
    if (cache.prices[key] != null) return cache.prices[key]
    if (used.prices >= CAP.prices || timeLeft() < 20000) return null
    used.prices++
    await sleep(2500)   // free CoinGecko tier: stay under its per-minute limit
    const [y, m, d] = day.split('-')
    try {
        const r = await httpJson(`https://api.coingecko.com/api/v3/coins/${coin}/history?date=${d}-${m}-${y}&localization=false`)
        const usd = r?.market_data?.current_price?.usd
        if (usd != null) cache.prices[key] = usd
        return usd ?? null
    } catch { return null }
}

async function blockTs(chain, block) {
    const key = `${chain}:${block}`
    if (cache.blockTs[key]) return cache.blockTs[key]
    if (used.blocks >= CAP.blocks) return null
    used.blocks++
    const b = await rpc(chain, p => p.getBlock(block))
    if (b) cache.blockTs[key] = b.timestamp
    return b?.timestamp ?? null
}

const prevLedger = readJson(OUT, null)
const history = readJson(HISTORY_FILE, [])

// Cumulative value of a line about 7 days ago, from the ledger's own history.
function valueWeekAgo(id) {
    const older = history.filter(h => new Date(h.at).getTime() <= WEEK_AGO && h.v?.[id] != null)
    return older.length ? older[older.length - 1].v[id] : undefined
}
function historyStart() { return history.length ? history[0].at : null }

// ---------------------------------------------------------------- line model

const lines = []
function line(def) {
    const l = {
        id: def.id, kind: def.kind, group: def.group, label: def.label,
        status: def.status, usd: { all_time: round2(def.allTime ?? null), d7: round2(def.d7 ?? null) },
        source: def.source, detail: def.detail || null,
    }
    if (def.status === 'unknown') l.usd = { all_time: null, d7: null }
    lines.push(l)
    return l
}

// A source that failed this run: carry the last good value, marked stale.
function stale(def, err) {
    const prev = prevLedger?.lines?.find(l => l.id === def.id && l.status !== 'unknown')
    if (prev) {
        return line({ ...def, status: 'stale', allTime: prev.usd.all_time, d7: prev.usd.d7,
            detail: `source failed this run (${err}); value from ${prevLedger.generatedAt}` })
    }
    return line({ ...def, status: 'unknown', detail: `source failed (${err}) and no earlier value` })
}

// A cumulative snapshot line (all-time total read now); its 7-day value comes from history.
function cumulativeD7(id, allTime) {
    const then = valueWeekAgo(id)
    if (then === undefined) return { d7: null, note: `7-day value needs history from 7 days back (ledger history starts ${historyStart() || 'now'})` }
    return { d7: allTime - then, note: null }
}

async function guarded(def, fn) {
    try { await fn() } catch (e) { stale(def, String(e.message || e).slice(0, 160)) }
}

// ---------------------------------------------------------------- earnings

// Receipt of a tx, cached for good (receipts never change). Free RPCs serve old receipts but not
// old logs, so every on-chain flow here is read from the receipts of tx hashes her state records.
async function receipt(chain, hash) {
    const key = `${chain}:${hash}`
    if (cache.receipts[key]) return cache.receipts[key]
    if (used.receipts >= CAP.receipts || timeLeft() < 30000) return null
    used.receipts++
    const raw = await rpc(chain, p => p.send('eth_getTransactionReceipt', [hash]))
    if (!raw) return (cache.receipts[key] = { miss: true })
    const fee = BigInt(raw.gasUsed) * BigInt(raw.effectiveGasPrice || '0x0') + BigInt(raw.l1Fee || '0x0')
    // Keep only the logs the ledger reads (position manager and AERO), not every log of the tx.
    const logs = chain === 'base'
        ? raw.logs.filter(l => [AERO_NPM, AERO_TOKEN].includes(l.address.toLowerCase())).map(l => ({ address: l.address.toLowerCase(), topics: l.topics, data: l.data }))
        : []
    return (cache.receipts[key] = { from: raw.from.toLowerCase(), feeWei: fee.toString(), block: Number(BigInt(raw.blockNumber)), logs })
}

// Aerodrome LP on Base, from the receipts of each position's recorded txs (open, stake, close):
//   fees      = Collect paid to her minus DecreaseLiquidity (Collect pays principal plus fees)
//   emissions = AERO transferred from the position's gauge to her
// While staked, the gauge collects the fees for voters, so only collects paid to her count.
// A fee claim the rebalancer logged without a tx hash is named as not known.
async function lpBase() {
    const feeDef = { id: 'lp_fees_base', kind: 'earning', group: 'lp', label: 'LP fees, Aerodrome on Base',
        source: 'Base chain: receipts of each position\'s recorded txs, Collect paid to her minus DecreaseLiquidity; open positions add pending fees from lp-reconcile' }
    const emiDef = { id: 'lp_emissions_base', kind: 'earning', group: 'lp', label: 'AERO emissions, Aerodrome gauges on Base',
        source: 'Base chain: AERO transfers from the position\'s gauge to her inside the position\'s recorded txs' }
    try {
        const lp = readJson(path.join(STATE, 'lp-positions.json'), { positions: [], closedPositions: [] })
        const all = [...(lp.positions || []), ...(lp.closedPositions || [])].filter(p => p.chain === 'base' && p.nftTokenId)
        const rebal = readJson(path.join(STATE, 'lp-rebalance-log.json'), { entries: [] }).entries || []
        const npm = new ethers.Interface([
            'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
            'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)',
        ])
        const transferTopic = ethers.id('Transfer(address,address,uint256)')
        const poolAbi = ['function token0() view returns (address)', 'function token1() view returns (address)']
        const ercAbi = ['function decimals() view returns (uint8)']
        const fees = { allTime: 0, d7: 0, missing: [] }, emi = { allTime: 0, d7: 0, missing: [] }

        for (const pos of all) {
            const tokenTopic = ethers.toBeHex(BigInt(pos.nftTokenId), 32)
            const meta = cache.lp[pos.nftTokenId] ||= {}
            if (!meta.t0) {
                const [t0, t1] = await rpc('base', async p => {
                    const pool = new ethers.Contract(pos.poolAddress, poolAbi, p)
                    return [(await pool.token0()).toLowerCase(), (await pool.token1()).toLowerCase()]
                })
                meta.t0 = t0; meta.t1 = t1; meta.dec = {}
                for (const t of [t0, t1]) meta.dec[t] = Number(await rpc('base', p => new ethers.Contract(t, ercAbi, p).decimals()))
            }
            const hashes = [...new Set(JSON.stringify(pos).match(/0x[a-fA-F0-9]{64}/g) || [])].map(h => h.toLowerCase())
            const txs = []
            for (const h of hashes) {
                const rc = await receipt('base', h)
                if (!rc) { fees.missing.push(`${pos.id}: receipt ${h.slice(0, 10)} not read yet`); continue }
                if (!rc.miss) txs.push(rc)
            }
            txs.sort((a, b) => a.block - b.block)
            let pend0 = 0n, pend1 = 0n
            for (const rc of txs) {
                const ts = await blockTs('base', rc.block)
                for (const lg of rc.logs) {
                    if (lg.address === AERO_NPM && lg.topics[1] === tokenTopic) {
                        let ev
                        try { ev = npm.parseLog(lg) } catch { continue }
                        if (ev?.name === 'DecreaseLiquidity') { pend0 += ev.args.amount0; pend1 += ev.args.amount1; continue }
                        if (ev?.name !== 'Collect' || ev.args.recipient.toLowerCase() !== WALLETS.evm) continue
                        const f0 = ev.args.amount0 - pend0, f1 = ev.args.amount1 - pend1
                        pend0 = 0n; pend1 = 0n
                        let usd = 0
                        for (const [t, f] of [[meta.t0, f0], [meta.t1, f1]]) {
                            if (f <= 0n) continue
                            const px = BASE_TOKENS[t] && ts ? await priceOn(BASE_TOKENS[t].coin, ts * 1000) : null
                            if (px == null) { usd = null; break }
                            usd += Number(ethers.formatUnits(f, meta.dec[t])) * px
                        }
                        if (usd == null) { fees.missing.push(`${pos.id}: a collect not priced yet`); continue }
                        fees.allTime += usd
                        if (ts * 1000 >= WEEK_AGO) fees.d7 += usd
                    } else if (pos.gaugeAddress && lg.address === AERO_TOKEN && lg.topics[0] === transferTopic
                        && lg.topics[1] === ethers.zeroPadValue(pos.gaugeAddress.toLowerCase(), 32)
                        && lg.topics[2] === ethers.zeroPadValue(WALLETS.evm, 32)) {
                        const px = ts ? await priceOn('aerodrome-finance', ts * 1000) : null
                        if (px == null) { emi.missing.push(`${pos.id}: a claim not priced yet`); continue }
                        const usd = Number(ethers.formatUnits(BigInt(lg.data), 18)) * px
                        emi.allTime += usd
                        if (ts * 1000 >= WEEK_AGO) emi.d7 += usd
                    }
                }
            }
            const unrecordedClaims = rebal.filter(e => e.positionId === pos.id && e.action === 'CLAIM_FEES' && e.executed && !e.txHash)
            for (const c of unrecordedClaims) fees.missing.push(`${pos.id}: fee claim on ${c.loggedAt.slice(0, 10)} has no recorded tx hash`)
            if (pos.gaugeAddress) emi.missing.push(`${pos.id}: claims made while staked outside the recorded txs are not seen`)
            if (!pos.closedAt) {
                const dash = readJson(path.join(WORKSPACE, 'web', 'lp-miner', 'data', 'dashboard.json'), {})
                const live = (Array.isArray(dash.positions) ? dash.positions : []).find(p => String(p.nftTokenId) === String(pos.nftTokenId))
                const pending = live?.yield?.fees?.pendingUsd
                if (pending == null) fees.missing.push(`${pos.id}: pending fees not in the lp-reconcile output`)
                else fees.allTime += pending
            }
        }
        line({ ...feeDef, status: fees.missing.length ? 'partial' : 'ok', allTime: fees.allTime, d7: fees.d7,
            detail: `${all.length} position NFT(s)${fees.missing.length ? '; not counted: ' + fees.missing.join('; ') : ''}` })
        line({ ...emiDef, status: emi.missing.length ? 'partial' : 'ok', allTime: emi.allTime, d7: emi.d7,
            detail: emi.missing.length ? 'not counted: ' + emi.missing.join('; ') : null })
    } catch (e) {
        const err = String(e.message || e).slice(0, 160)
        stale(feeDef, err); stale(emiDef, err)
    }
}

// Fees earned by Sasha's own liquidity in the X Layer v4 pool whose fee her oracle sets.
// X Layer RPCs serve logs 100 blocks at a time, so this reads the position's accrued fees from
// PoolManager storage (extsload, the StateLibrary layout) instead of scanning swaps.
async function oraclePoolFees() {
    const def = { id: 'oracle_pool_fees_xlayer', kind: 'earning', group: 'oracle', label: 'Swap fees, her X Layer v4 hook pool (oracle-set fee)',
        source: 'X Layer chain: PoolManager storage (extsload) for her LiquidityHelper position: liquidity x fee growth inside since the position was opened' }
    await guarded(def, async () => {
        const dep = readJson(path.join(STATE, 'xlayer-deployment.json'), null)
        if (!dep?.poolId) throw new Error('state/xlayer-deployment.json has no poolId')
        const pmAbi = ['function extsload(bytes32 slot) view returns (bytes32)']
        const abi = ethers.AbiCoder.defaultAbiCoder()
        const Q128 = 1n << 128n, M256 = (1n << 256n)
        const stateSlot = BigInt(ethers.keccak256(abi.encode(['bytes32', 'uint256'], [dep.poolId, 6n])))
        const slotHex = n => ethers.toBeHex(n % M256, 32)
        const { tickLower, tickUpper } = dep.liquidityRange
        const posKey = ethers.solidityPackedKeccak256(['address', 'int24', 'int24', 'bytes32'], [dep.liquidityHelper, tickLower, tickUpper, ethers.ZeroHash])
        const posSlot = BigInt(ethers.keccak256(abi.encode(['bytes32', 'uint256'], [posKey, stateSlot + 6n])))
        const tickSlot = t => BigInt(ethers.keccak256(abi.encode(['int24', 'uint256'], [t, stateSlot + 4n])))

        const read = await rpc('xlayer', async p => {
            const pm = new ethers.Contract(dep.poolManager, pmAbi, p)
            const r = async s => BigInt(await pm.extsload(slotHex(s)))
            return {
                slot0: await r(stateSlot), g0: await r(stateSlot + 1n), g1: await r(stateSlot + 2n),
                lo0: await r(tickSlot(tickLower) + 1n), lo1: await r(tickSlot(tickLower) + 2n),
                hi0: await r(tickSlot(tickUpper) + 1n), hi1: await r(tickSlot(tickUpper) + 2n),
                liq: (await r(posSlot)) & (Q128 - 1n), last0: await r(posSlot + 1n), last1: await r(posSlot + 2n),
            }
        })
        let tick = Number((read.slot0 >> 160n) & 0xFFFFFFn)
        if (tick >= 0x800000) tick -= 0x1000000
        const inside = (g, lo, hi) => {
            if (tick < tickLower) return (lo - hi + M256) % M256
            if (tick >= tickUpper) return (hi - lo + M256) % M256
            return ((g - lo - hi) % M256 + 2n * M256) % M256
        }
        const fee0 = read.liq * ((inside(read.g0, read.lo0, read.hi0) - read.last0 + M256) % M256) / Q128
        const fee1 = read.liq * ((inside(read.g1, read.lo1, read.hi1) - read.last1 + M256) % M256) / Q128
        if (read.liq === 0n) throw new Error('position liquidity reads 0 (layout or owner mismatch)')
        const okb = currentPrices.okb
        if (okb == null) throw new Error('no current OKB price')
        // currency0 = USDC.e (6 decimals, par), currency1 = WOKB (18 decimals)
        const allTime = Number(ethers.formatUnits(fee0, 6)) + Number(ethers.formatUnits(fee1, 18)) * okb
        // The add tx's ModifyLiquidity delta, read once: equal to the position's liquidity means one
        // add and no change since, so the accrued fees are every fee since launch.
        if (cache.poolAddDelta == null && dep.liquidityAddTx) {
            const raw = await rpc('xlayer', p => p.send('eth_getTransactionReceipt', [dep.liquidityAddTx]))
            const ml = new ethers.Interface(['event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)'])
            for (const lg of raw?.logs || []) {
                let ev
                try { ev = ml.parseLog(lg) } catch { continue }
                if (ev && ev.args.id === dep.poolId) cache.poolAddDelta = ev.args.liquidityDelta.toString()
            }
        }
        const addedLiquidity = cache.poolAddDelta ?? 'not read'
        const untouched = cache.poolAddDelta != null && BigInt(cache.poolAddDelta) === read.liq
        const { d7, note } = cumulativeD7(def.id, allTime)
        line({ ...def, status: untouched ? 'ok' : 'partial', allTime, d7,
            detail: [`accrued, not collected: ${ethers.formatUnits(fee0, 6)} USDC.e + ${ethers.formatUnits(fee1, 18)} WOKB; WOKB at the current OKB price`,
                untouched ? 'liquidity equals the one add, so this is every fee since launch' : `position liquidity ${read.liq} differs from the add tx's ${addedLiquidity}: fees collected at a later change are not counted`,
                note].filter(Boolean).join('. ') })
    })
}

// ---------------------------------------------------------------- costs

async function openRouter() {
    const def = { id: 'llm_openrouter', kind: 'cost', group: 'llm', label: 'LLM, OpenRouter',
        source: 'OpenRouter /api/v1/key usage for the key in Sasha\'s runtime (her own key, not shared with marketing or Maestro, checked by hash 2026-10-27)' }
    const key = process.env.OPENROUTER_API_KEY
    if (!key) return line({ ...def, status: 'unknown', detail: 'no OpenRouter key in this run\'s environment' })
    await guarded(def, async () => {
        const r = await httpJson('https://openrouter.ai/api/v1/key', { headers: { authorization: `Bearer ${key}` } })
        const usage = r?.data?.usage
        if (usage == null) throw new Error('no usage field in the response')
        const { d7, note } = cumulativeD7(def.id, usage)
        line({ ...def, status: 'ok', allTime: usage, d7: d7 ?? r.data.usage_weekly ?? null,
            detail: d7 == null && r.data.usage_weekly != null ? 'd7 is OpenRouter\'s usage this UTC week until the ledger has 7 days of history' : note })
    })
}

async function apify() {
    const def = { id: 'data_apify', kind: 'cost', group: 'data', label: 'Data, Apify',
        source: 'Apify /v2/users/me and /v2/users/me/usage/monthly for the Apify keys in Sasha\'s runtime (her own accounts)' }
    const keys = [...new Set([process.env.APIFY_TOKEN, process.env.APIFY_API_KEY].filter(Boolean))]
    if (!keys.length) return line({ ...def, status: 'unknown', detail: 'no Apify key in this run\'s environment' })
    await guarded(def, async () => {
        const seen = new Set(), notes = []
        let monthCost = 0, unknown = false
        for (const k of keys) {
            const me = await httpJson('https://api.apify.com/v2/users/me', { headers: { authorization: `Bearer ${k}` } })
            const id = me?.data?.id
            if (!id || seen.has(id)) continue
            seen.add(id)
            const plan = me.data.plan || {}
            const u = await httpJson('https://api.apify.com/v2/users/me/usage/monthly', { headers: { authorization: `Bearer ${k}` } })
            const usage = u?.data?.totalUsageCreditsUsdAfterVolumeDiscount ?? u?.data?.totalUsageCreditsUsdBeforeVolumeDiscount
            if (plan.id === 'FREE') { notes.push(`account ${seen.size}: free plan, $${round2(usage) ?? '?'} of included credit used this cycle, no charge`); continue }
            if (typeof plan.monthlyBasePriceUsd === 'number') {
                const overage = Math.max(0, (usage || 0) - (plan.monthlyUsageCreditsUsd || 0))
                monthCost += plan.monthlyBasePriceUsd + overage
                notes.push(`account ${seen.size}: plan ${plan.id} $${plan.monthlyBasePriceUsd}/month + $${round2(overage)} overage this cycle`)
            } else { unknown = true; notes.push(`account ${seen.size}: plan ${plan.id || '?'} price not in the API response`) }
        }
        if (unknown) return line({ ...def, status: 'unknown', detail: notes.join('; ') })
        // Monthly cost spread per day: the 7-day share; all-time is not served by the usage API.
        line({ ...def, status: monthCost === 0 ? 'ok' : 'partial', allTime: monthCost === 0 ? 0 : null, d7: monthCost * 7 / 30.44,
            detail: notes.join('; ') + (monthCost === 0 ? '' : '. All-time needs past billing cycles; only this cycle is read') })
    })
}

// Gas on EVM chains: receipts of every tx hash Sasha's state files record, sent from her
// wallets. The wallet nonce says how many txs exist; the unpriced rest stays unknown.
async function gasEvm(chain, wallet, label) {
    const def = { id: `gas_${chain}`, kind: 'cost', group: 'gas', label,
        source: `${chain} chain: receipts (gas used x effective price, plus L1 fee when present) of the tx hashes in state/*.json sent by ${wallet}; wallet nonce for the total count` }
    await guarded(def, async () => {
        const nonce = await rpc(chain, p => p.getTransactionCount(wallet))
        const hashes = new Set()
        for (const f of fs.readdirSync(STATE).filter(f => f.endsWith('.json') && !f.startsWith('ledger') && !f.startsWith('._'))) {
            if (!chainsFor(f).includes(chain)) continue
            const text = fs.readFileSync(path.join(STATE, f), 'utf8')
            for (const h of text.match(/0x[a-fA-F0-9]{64}/g) || []) hashes.add(h.toLowerCase())
        }
        let priced = 0, allTime = 0, d7 = 0, toRead = 0, toPrice = 0
        for (const h of hashes) {
            const rc = await receipt(chain, h)
            if (!rc) { toRead++; continue }
            if (rc.miss || rc.from !== wallet) continue
            const ts = await blockTs(chain, rc.block)
            const px = ts ? await priceOn(NATIVE_COIN[chain], ts * 1000) : null
            if (px == null) { toPrice++; continue }
            const usd = Number(ethers.formatEther(BigInt(rc.feeWei))) * px
            priced++; allTime += usd
            if (ts * 1000 >= WEEK_AGO) d7 += usd
        }
        const notPriced = Math.max(0, nonce - priced)
        const why = toRead || toPrice
            ? `${toRead} recorded hash(es) still to read and ${toPrice} to price on the next runs`
            : 'they have no recorded tx hash (an explorer API key would close this)'
        line({ ...def, status: notPriced ? 'partial' : 'ok', allTime, d7,
            detail: `${priced} of ${nonce} txs priced${notPriced ? `; ${notPriced} not priced: ${why}` : ''}` })
    })
}

// Solana network fees paid by her wallet (fee payer only).
async function gasSolana() {
    const def = { id: 'gas_solana', kind: 'cost', group: 'gas', label: 'Network fees, Solana',
        source: 'Solana RPC: getSignaturesForAddress for her wallet, then each transaction\'s fee where she is the fee payer' }
    await guarded(def, async () => {
        const call = (method, params) => httpJson(SOLANA_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: { jsonrpc: '2.0', id: 1, method, params } })
        const sigs = []
        let before
        for (let page = 0; page < 5; page++) {
            const r = await call('getSignaturesForAddress', [WALLETS.solana, { limit: 1000, ...(before ? { before } : {}) }])
            const batch = r?.result || []
            sigs.push(...batch)
            if (batch.length < 1000) break
            before = batch[batch.length - 1].signature
        }
        let allTime = 0, d7 = 0, counted = 0, pending = 0
        for (const s of sigs) {
            let c = cache.solana[s.signature]
            if (!c) {
                if (used.solanaTx >= CAP.solanaTx || timeLeft() < 25000) { pending++; continue }
                used.solanaTx++
                await sleep(400)   // public Solana RPC rate limit
                const r = await call('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }])
                const tx = r?.result
                if (!tx) { pending++; continue }
                c = cache.solana[s.signature] = { fee: tx.meta?.fee ?? 0, ts: tx.blockTime, payer: tx.transaction?.message?.accountKeys?.[0] }
            }
            if (c.payer !== WALLETS.solana) continue
            const px = await priceOn('solana', c.ts * 1000)
            if (px == null) { pending++; continue }
            const usd = c.fee / 1e9 * px
            counted++; allTime += usd
            if (c.ts * 1000 >= WEEK_AGO) d7 += usd
        }
        line({ ...def, status: pending ? 'partial' : 'ok', allTime, d7,
            detail: `${sigs.length} signature(s), ${counted} paid by her and priced${pending ? `; ${pending} still to read or price on the next runs` : ''}` })
    })
}

// Hyperliquid hedge account: trading fees are a cost; funding is an earning when she received
// more than she paid (and shows as a negative earning when she paid more).
async function hyperliquid() {
    const feeDef = { id: 'trading_fees_hyperliquid', kind: 'cost', group: 'trading', label: 'Hedge trading fees, Hyperliquid',
        source: 'Hyperliquid public info API: userFills fees for her hedge account (USDC at par)' }
    const fundDef = { id: 'funding_hyperliquid', kind: 'earning', group: 'trading', label: 'Hedge funding, Hyperliquid (net)',
        source: 'Hyperliquid public info API: userFunding payments for her hedge account (USDC at par)' }
    try {
        const info = body => httpJson('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
        const fills = await info({ type: 'userFills', user: WALLETS.hl })
        const funding = await info({ type: 'userFunding', user: WALLETS.hl, startTime: 0 })
        let feeAll = 0, feeD7 = 0, otherFeeToken = 0, fundAll = 0, fundD7 = 0
        for (const f of fills || []) {
            if (f.feeToken && f.feeToken !== 'USDC') { otherFeeToken++; continue }
            const fee = Number(f.fee) || 0
            feeAll += fee; if (f.time >= WEEK_AGO) feeD7 += fee
        }
        for (const f of funding || []) {
            const got = Number(f.delta?.usdc) || 0
            fundAll += got; if (f.time >= WEEK_AGO) fundD7 += got
        }
        line({ ...feeDef, status: otherFeeToken ? 'partial' : 'ok', allTime: feeAll, d7: feeD7,
            detail: `${(fills || []).length} fill(s)${otherFeeToken ? `; ${otherFeeToken} fee(s) in another token not counted` : ''}` })
        line({ ...fundDef, status: 'ok', allTime: fundAll, d7: fundD7, detail: `${(funding || []).length} funding payment(s)` })
    } catch (e) {
        const err = String(e.message || e).slice(0, 160)
        stale(feeDef, err); stale(fundDef, err)
    }
}

function unknownLines() {
    const u = (id, group, label, detail) => line({ id, kind: 'cost', group, label, status: 'unknown', source: 'none', detail })
    u('llm_openclaw_agent', 'llm', 'LLM, OpenCLAW agent (ChatGPT subscription)', 'her agent runs on an openai-codex ChatGPT subscription shared with other agents; it has no per-agent metering')
    u('llm_gemini', 'llm', 'LLM, Google Gemini', 'the Gemini key in her runtime is the same key marketing and Maestro use, and a key has no usage API; billing lives in Google Cloud')
    u('llm_openai_api', 'llm', 'LLM, OpenAI API', 'her own OpenAI key; the usage API needs an organization admin key')
    u('data_elfa', 'data', 'Data, Elfa', 'the Elfa key is shared with marketing; no usage API. Her signal feeds have been idle since 2026-07-05')
    u('data_allora', 'data', 'Data, Allora', 'no billing API. Feed idle since 2026-07-05')
    u('data_buffer', 'data', 'Publishing, Buffer', 'subscription; plan price not given to the ledger')
}

function serverShare(config) {
    const def = { id: 'server_share', kind: 'cost', group: 'server', label: 'Server share (VPS)',
        source: 'fixed monthly share set by Gabriel in scripts/ledger-config.json' }
    const month = config.server_share_usd_month
    if (typeof month !== 'number') return line({ ...def, status: 'unknown', detail: 'Gabriel has not set the monthly share yet' })
    const perDay = month * 12 / 365
    const days = Math.max(0, (STARTED - new Date(config.ledger_start).getTime()) / DAY)
    line({ ...def, status: 'ok', allTime: perDay * days, d7: perDay * 7,
        detail: `$${month}/month since ${config.ledger_start}` })
}

// ---------------------------------------------------------------- main

function totals(window) {
    const sum = (kind) => lines.filter(l => l.kind === kind && l.usd[window] != null).reduce((s, l) => s + l.usd[window], 0)
    const earned = sum('earning'), cost = sum('cost')
    const incomplete = lines.filter(l => l.status !== 'ok' || l.usd[window] == null)
    return {
        earned_usd: round2(earned), cost_known_usd: round2(cost), gap_usd: round2(earned - cost),
        complete: incomplete.length === 0,
        unknown_cost_lines: incomplete.filter(l => l.kind === 'cost').map(l => l.label),
        unknown_earning_lines: incomplete.filter(l => l.kind === 'earning').map(l => l.label),
    }
}

async function main() {
    const config = { ledger_start: '2026-05-25', server_share_usd_month: null, ...readJson(CONFIG_FILE, {}) }
    await loadCurrentPrices(['okb', 'ethereum', 'mantle', 'solana', 'aerodrome-finance', 'coinbase-wrapped-btc'])

    // Earnings
    await lpBase()
    await oraclePoolFees()
    // Costs
    await openRouter()
    unknownLines()
    await apify()
    await gasEvm('xlayer', WALLETS.keeper, 'Gas, X Layer (oracle keeper)')
    await gasEvm('base', WALLETS.evm, 'Gas, Base')
    await gasEvm('mantle', WALLETS.evm, 'Gas, Mantle')
    await gasSolana()
    await hyperliquid()
    serverShare(config)

    const ledger = {
        version: 1,
        generatedAt: new Date(STARTED).toISOString(),
        generatedBy: 'scripts/sasha-ledger.js',
        since: config.ledger_start,
        rule: 'A line with no source says unknown, never an estimate. The gap counts known costs only; unknown lines are listed.',
        valuation: 'Flows at the CoinGecko daily price of their date; accrued pool fees at the current price; stablecoins at par.',
        totals: { all_time: totals('all_time'), d7: totals('d7') },
        lines,
        run: { ms: Date.now() - STARTED, lookups: used },
    }

    if (DRY_RUN) { console.log(JSON.stringify(ledger, null, 2)); return }

    writeJsonAtomic(OUT, ledger)
    writeJsonAtomic(OUT_PUBLIC, {
        asOf: ledger.generatedAt, since: ledger.since, rule: ledger.rule, valuation: ledger.valuation,
        totals: ledger.totals,
        lines: lines.map(l => ({ label: l.label, kind: l.kind, status: l.status, all_time_usd: l.usd.all_time, d7_usd: l.usd.d7, note: l.detail })),
    })
    writeJsonAtomic(CACHE_FILE, cache)
    // One history point per hour, 45 days kept: the 7-day values of snapshot lines read from it.
    const lastAt = history.length ? new Date(history[history.length - 1].at).getTime() : 0
    if (STARTED - lastAt >= 3600000) {
        const v = {}
        for (const l of lines) if (l.usd.all_time != null && (l.status === 'ok' || l.status === 'partial')) v[l.id] = l.usd.all_time
        history.push({ at: ledger.generatedAt, v })
        writeJsonAtomic(HISTORY_FILE, history.filter(h => new Date(h.at).getTime() >= STARTED - 45 * DAY))
    }
    const t = ledger.totals.all_time
    log(`wrote ${path.relative(WORKSPACE, OUT)}: earned $${t.earned_usd}, known cost $${t.cost_known_usd}, gap $${t.gap_usd}, ${t.unknown_cost_lines.length} cost line(s) not fully known, ${ledger.run.ms} ms`)
}

// Hard stop: a hung request must never hold the dashboard deploy that follows in the cron chain.
setTimeout(() => { log('hard deadline hit, exiting without writing'); process.exit(0) }, DEADLINE - STARTED + 30000).unref()

main().catch(e => log('failed:', e.message)).finally(() => {
    for (const p of Object.values(providers)) p.destroy()
    process.exit(0)
})
