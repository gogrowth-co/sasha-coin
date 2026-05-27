#!/usr/bin/env node
/**
 * hedge-executor.js — Phase 3 delta-neutral hedge leg for Sasha's LP book.
 *
 * Shorts the volatile leg of an LP position on Hyperliquid so the position
 * earns fees while staying market-neutral. Sizes the short to the LIVE
 * on-chain volatile-token amount of the LP (computed from slot0 + positions),
 * NOT the simplified center-of-range formula (which has basis error).
 *
 * For USDC/cbBTC the volatile leg is token1 = cbBTC -> short BTC-PERP.
 * For WETH/USDC the volatile leg is WETH -> short ETH-PERP.
 *
 * Modes:
 *   node scripts/hedge-executor.js --check                 # read LP + HL, print target vs current. No orders. (mainnet read-only)
 *   node scripts/hedge-executor.js --check --testnet       # same, against testnet HL account
 *   node scripts/hedge-executor.js --testnet --open --size 0.0003   # place a test SHORT on testnet
 *   node scripts/hedge-executor.js --testnet --close       # close the testnet hedge (reduce-only)
 *   node scripts/hedge-executor.js --funding-check         # evaluate the funding kill switch only
 *   node scripts/hedge-executor.js --execute               # LIVE: open/adjust the hedge to target on mainnet  [GATED]
 *   node scripts/hedge-executor.js --execute --close       # LIVE: close the hedge on mainnet                   [GATED]
 *
 * Safety:
 *   - Reductions/closes ALWAYS use reduce_only=true (never flips the position).
 *   - --execute requires HEDGE_LIVE_OK=1 in env AND the live order is printed for review when run interactively.
 *   - Funding kill switch: if annualized funding < -54.75% for 3 consecutive 8h periods, close the hedge.
 *
 * Env (gitignored .env locally; VPS .env in prod):
 *   HL_PRIVATE_KEY, HL_WALLET_ADDRESS   — dedicated Hyperliquid hedge wallet
 *   ALCHEMY_BASE_RPC (optional)         — Base RPC for live LP read (falls back to public)
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (optional) — alerts
 *
 * Sasha Coin — Liquidity Miner Phase 3
 */
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  ExchangeClient, InfoClient, HttpTransport,
  MAINNET_API_URL, TESTNET_API_URL,
} from '@nktkas/hyperliquid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve(__dirname, '..')
const POSITIONS_PATH = path.join(WORKSPACE, 'state', 'lp-positions.json')

// ─── env ──────────────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.join(WORKSPACE, '.env')
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
}
loadEnv()

// ─── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const TESTNET   = has('--testnet')
const EXECUTE   = has('--execute')
const DO_CLOSE  = has('--close')
const DO_OPEN   = has('--open')
const FUNDING_CHECK = has('--funding-check')
const MANUAL_SIZE = val('--size') ? parseFloat(val('--size')) : null

// ─── config ─────────────────────────────────────────────────────────────────────
const DRIFT_THRESHOLD   = 0.05      // 5% delta drift -> adjust
const FUNDING_KILL_ANN  = -54.75    // annualized %; 3 consecutive periods -> close
const TARGET_LEVERAGE   = 2         // conservative for Phase 3 (margin ~= 50% of notional)
const BASE_RPCS = [
  process.env.ALCHEMY_BASE_RPC,
  'https://base-rpc.publicnode.com',
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
].filter(Boolean)

// LP pool -> hedge mapping. Only live pools registered.
const POOL_REGISTRY = {
  // USDC/cbBTC Aerodrome Slipstream
  '0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb': {
    token0: { symbol: 'USDC', decimals: 6 },
    token1: { symbol: 'cbBTC', decimals: 8 },
    volatile: 'token1',
    hlPerp: 'BTC',
  },
  // WETH/USDC (Phase 2 target, registered for forward-compat)
  '0xd0b53d9277642d899df5c87a3966a349a798f224': {
    token0: { symbol: 'WETH', decimals: 18 },
    token1: { symbol: 'USDC', decimals: 6 },
    volatile: 'token0',
    hlPerp: 'ETH',
  },
}

// Aerodrome Slipstream slot0 returns 6 fields (no feeProtocol uint8, unlike Uniswap v3)
const POOL_ABI  = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,bool)']
const NFT_ABI   = ['function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256,uint256,uint128,uint128)']
const NFT_MGR   = '0x827922686190790b37229fd06084350E74485b72' // Aerodrome Slipstream NftPositionManager (Base)

function log(...a) { console.log(...a) }

// ─── Base RPC with failover ─────────────────────────────────────────────────────
async function baseProvider() {
  for (const url of BASE_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url)
      await p.getBlockNumber()
      return p
    } catch { /* next */ }
  }
  throw new Error('all Base RPCs failed')
}

// ─── CL math: live volatile-token amount in the LP ────────────────────────────────
// amount1_raw = L * (sqrtP - sqrtA)   ; amount0_raw = L * (sqrtB - sqrtP) / (sqrtP*sqrtB)
// sqrt values in raw-price units (token1_raw/token0_raw). Float precision is fine — we
// round to the perp's szDecimals anyway.
function liveAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity) {
  const Q96 = 2 ** 96
  const sqrtP = Number(sqrtPriceX96) / Q96
  const sqrtA = Math.sqrt(1.0001 ** tickLower)
  const sqrtB = Math.sqrt(1.0001 ** tickUpper)
  const L = Number(liquidity)
  let amount0Raw, amount1Raw
  if (sqrtP <= sqrtA) { amount0Raw = L * (sqrtB - sqrtA) / (sqrtA * sqrtB); amount1Raw = 0 }
  else if (sqrtP >= sqrtB) { amount0Raw = 0; amount1Raw = L * (sqrtB - sqrtA) }
  else { amount0Raw = L * (sqrtB - sqrtP) / (sqrtP * sqrtB); amount1Raw = L * (sqrtP - sqrtA) }
  return { amount0Raw, amount1Raw, sqrtP, sqrtA, sqrtB }
}

// Returns { volTokens, volSymbol, hlPerp, priceUsd } for a live LP position, or null.
async function computeLpDelta(position) {
  const reg = POOL_REGISTRY[(position.poolAddress || '').toLowerCase()]
  if (!reg) { log(`  no pool registry entry for ${position.poolAddress}`); return null }
  const provider = await baseProvider()
  const pool = new ethers.Contract(position.poolAddress, POOL_ABI, provider)
  const nft  = new ethers.Contract(NFT_MGR, NFT_ABI, provider)
  const [slot0, pos] = await Promise.all([pool.slot0(), nft.positions(position.nftTokenId)])
  const sqrtPriceX96 = slot0[0]
  const tickLower = Number(pos[5]), tickUpper = Number(pos[6]), liquidity = pos[7]
  const { amount0Raw, amount1Raw } = liveAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity)
  const volRaw = reg.volatile === 'token1' ? amount1Raw : amount0Raw
  const volDec = reg.volatile === 'token1' ? reg.token1.decimals : reg.token0.decimals
  const volSymbol = reg.volatile === 'token1' ? reg.token1.symbol : reg.token0.symbol
  const volTokens = volRaw / 10 ** volDec
  return { volTokens, volSymbol, hlPerp: reg.hlPerp, tickLower, tickUpper, liquidity: liquidity.toString() }
}

// ─── Hyperliquid helpers ──────────────────────────────────────────────────────────
function hlClients() {
  const transport = new HttpTransport({ isTestnet: TESTNET })
  const info = new InfoClient({ transport })
  let exchange = null
  if (process.env.HL_PRIVATE_KEY) {
    const wallet = new ethers.Wallet(process.env.HL_PRIVATE_KEY)
    exchange = new ExchangeClient({ transport, wallet })
  }
  return { info, exchange }
}

async function perpMeta(info, coin) {
  const [meta, ctxs] = await info.metaAndAssetCtxs()
  const idx = meta.universe.findIndex((a) => a.name === coin)
  if (idx < 0) throw new Error(`${coin} perp not listed`)
  return { idx, szDecimals: meta.universe[idx].szDecimals, ctx: ctxs[idx], markPx: parseFloat(ctxs[idx].markPx), funding8h: parseFloat(ctxs[idx].funding) }
}

async function currentShort(info, address, coin) {
  if (!address) return 0
  const st = await info.clearinghouseState({ user: address })
  const p = (st.assetPositions || []).find((x) => x.position?.coin === coin)
  if (!p) return 0
  return Math.abs(parseFloat(p.position.szi)) // szi negative = short; return magnitude
}

// HL formatting: size rounded to szDecimals; price to 5 sig figs and <= (6 - szDecimals) decimals.
function fmtSize(sz, szDecimals) { return sz.toFixed(szDecimals) }
function fmtPrice(px, szDecimals) {
  const maxDec = 6 - szDecimals
  // 5 significant figures
  let p = Number(px.toPrecision(5))
  const factor = 10 ** Math.max(0, maxDec)
  p = Math.round(p * factor) / factor
  return maxDec <= 0 ? String(Math.round(p)) : String(p)
}

// Place a market-like IoC order. side 'short' = sell(b=false); 'closeShort' = buy(b=true, reduce_only).
async function placeOrder(exchange, { idx, szDecimals, markPx }, side, size) {
  const isBuy = side === 'closeShort'
  const slip = isBuy ? 1.01 : 0.99 // cross the book by 1%
  const order = {
    a: idx,
    b: isBuy,
    p: fmtPrice(markPx * slip, szDecimals),
    s: fmtSize(size, szDecimals),
    r: isBuy,                    // reduce_only when closing a short
    t: { limit: { tif: 'Ioc' } },
  }
  log(`  -> order: ${JSON.stringify(order)}`)
  const res = await exchange.order({ orders: [order], grouping: 'na' })
  return res
}

// ─── funding kill switch ────────────────────────────────────────────────────────
async function fundingKill(info, coin) {
  const now = Date.now()
  const hist = await info.fundingHistory({ coin, startTime: now - 30 * 3600 * 1000 })
  const last3 = hist.slice(-3)
  const anns = last3.map((r) => parseFloat(r.fundingRate) * 3 * 365 * 100)
  const allKill = last3.length === 3 && anns.every((a) => a < FUNDING_KILL_ANN)
  return { allKill, anns, last3 }
}

// ─── state ─────────────────────────────────────────────────────────────────────
function readPositions() { return JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8')) }
function writePositions(d) { fs.writeFileSync(POSITIONS_PATH, JSON.stringify(d, null, 2) + '\n') }

async function telegram(msg) {
  const t = process.env.TELEGRAM_BOT_TOKEN, c = process.env.TELEGRAM_CHAT_ID
  if (!t || !c) return
  try {
    await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: c, text: msg, parse_mode: 'HTML' }),
    })
  } catch { /* non-fatal */ }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const net = TESTNET ? 'TESTNET' : 'MAINNET'
  log(`hedge-executor [${net}] ${EXECUTE ? '(EXECUTE)' : '(dry/check)'}`)
  const { info, exchange } = hlClients()
  const address = process.env.HL_WALLET_ADDRESS

  // ── Manual testnet open/close (no LP needed) ─────────────────────────────────
  if (TESTNET && (DO_OPEN || DO_CLOSE)) {
    const coin = (val('--coin') || 'BTC').toUpperCase()
    const m = await perpMeta(info, coin)
    if (DO_OPEN) {
      const size = MANUAL_SIZE ?? Number((10 / m.markPx).toFixed(m.szDecimals)) // ~$10 default
      log(`  TESTNET OPEN short ${size} ${coin} @ ~$${m.markPx}`)
      const res = await placeOrder(exchange, m, 'short', size)
      log('  result:', JSON.stringify(res))
    } else {
      const sz = await currentShort(info, address, coin)
      if (sz <= 0) { log('  no open short to close'); return }
      log(`  TESTNET CLOSE short ${sz} ${coin}`)
      const res = await placeOrder(exchange, m, 'closeShort', sz)
      log('  result:', JSON.stringify(res))
    }
    return
  }

  // ── funding-only check ───────────────────────────────────────────────────────
  if (FUNDING_CHECK) {
    for (const coin of ['BTC', 'ETH']) {
      const k = await fundingKill(info, coin)
      log(`  ${coin} last-3 ann funding: ${k.anns.map((a) => a.toFixed(1) + '%').join(', ')} -> kill=${k.allKill}`)
    }
    return
  }

  // ── reconcile hedge to LP delta ──────────────────────────────────────────────
  const data = readPositions()
  const open = data.positions.filter((p) => p.status === 'open' && p.chain === 'base')
  if (!open.length) {
    // No LP to hedge. If a short is still open, it is ORPHANED (naked directional risk) — close it.
    log('  no open Base LP positions')
    for (const coin of ['BTC', 'ETH']) {
      const sz = await currentShort(info, address, coin)
      if (sz > 0) {
        log(`  ⚠️ orphaned ${sz} ${coin} short with no LP — closing`)
        if (EXECUTE && process.env.HEDGE_LIVE_OK === '1') {
          const m = await perpMeta(info, coin)
          await placeOrder(exchange, m, 'closeShort', sz)
          await telegram(`🧹 Closed orphaned ${sz} ${coin} short (no LP position left to hedge).`)
        } else { log('  (dry/ungated — would close orphaned short)') }
      }
    }
    return
  }

  let stateDirty = false
  for (const pos of open) {
    log(`\nPosition ${pos.id} (${pos.symbol})`)
    const delta = await computeLpDelta(pos)
    if (!delta) continue
    const m = await perpMeta(info, delta.hlPerp)
    const target = Number(delta.volTokens.toFixed(m.szDecimals))
    const cur = await currentShort(info, address, delta.hlPerp)
    const notional = target * m.markPx
    const annFunding = m.funding8h * 3 * 365 * 100
    log(`  LP holds ${delta.volTokens.toFixed(8)} ${delta.volSymbol}  ->  target short ${target} ${delta.hlPerp} ($${notional.toFixed(2)})`)
    log(`  current short: ${cur} ${delta.hlPerp} | mark $${m.markPx} | funding ${annFunding.toFixed(1)}% ann (${annFunding >= 0 ? 'we receive' : 'we pay'})`)

    // Persist OBSERVED hedge state every run (even no-action) so the monitor + dashboard
    // always reflect reality. The order path below may overwrite hedgeSize with target.
    pos.hedgeSize = cur
    pos.hedgePerp = delta.hlPerp
    pos.hedgeMark = m.markPx
    pos.hedgeNotionalUsd = Math.round(cur * m.markPx * 100) / 100
    pos.hedgeFundingAnnPct = Math.round(annFunding * 10) / 10
    pos.hedgeUpdatedAt = new Date().toISOString()
    stateDirty = true

    // kill switch
    const k = await fundingKill(info, delta.hlPerp)
    if (k.allKill && cur > 0) {
      log(`  ⚠️ FUNDING KILL armed (${k.anns.map((a) => a.toFixed(1)).join(',')}% ann) -> close hedge`)
      if (EXECUTE && process.env.HEDGE_LIVE_OK === '1') {
        await placeOrder(exchange, m, 'closeShort', cur)
        pos.hedgeSize = 0; pos.hedgeClosedAt = new Date().toISOString(); pos.hedgeClosedReason = 'funding_kill'
        writePositions(data)
        await telegram(`🛑 <b>HEDGE KILL</b> ${pos.symbol}: funding < ${FUNDING_KILL_ANN}% ann for 3 periods. Closed ${cur} ${delta.hlPerp} short.`)
      }
      continue
    }

    const diff = target - cur
    const drift = cur > 0 ? Math.abs(diff) / cur : (target > 0 ? 1 : 0)
    if (DO_CLOSE) {
      log(`  ACTION: close ${cur} ${delta.hlPerp} short`)
      if (EXECUTE && process.env.HEDGE_LIVE_OK === '1' && cur > 0) {
        await placeOrder(exchange, m, 'closeShort', cur)
        pos.hedgeSize = 0; pos.hedgeClosedAt = new Date().toISOString()
        writePositions(data)
        await telegram(`✅ Hedge closed ${pos.symbol}: bought back ${cur} ${delta.hlPerp}.`)
      }
      continue
    }

    if (drift <= DRIFT_THRESHOLD && cur > 0) { log(`  in tolerance (drift ${(drift * 100).toFixed(1)}%), no action`); continue }

    const side = diff > 0 ? 'short' : 'closeShort'
    const size = Number(Math.abs(diff).toFixed(m.szDecimals))
    if (size <= 0) { log('  diff below min size, no action'); continue }
    log(`  ACTION: ${side === 'short' ? 'increase' : 'reduce'} short by ${size} ${delta.hlPerp} (drift ${(drift * 100).toFixed(1)}%)`)

    if (!EXECUTE) { log('  (dry run — pass --execute + HEDGE_LIVE_OK=1 to place)'); continue }
    if (process.env.HEDGE_LIVE_OK !== '1') { log('  ⛔ refusing live order: HEDGE_LIVE_OK != 1'); continue }

    try {
      await exchange.updateLeverage({ asset: m.idx, isCross: true, leverage: TARGET_LEVERAGE }).catch(() => {})
      const res = await placeOrder(exchange, m, side, size)
      log('  result:', JSON.stringify(res))
      pos.hedgeSize = target
      pos.hedgePerp = delta.hlPerp
      pos.hedgeEntryMark = m.markPx
      pos.hedgeUpdatedAt = new Date().toISOString()
      pos.fundingHistory = pos.fundingHistory || []
      pos.fundingHistory.push({ at: new Date().toISOString(), annPct: annFunding })
      writePositions(data)
      await telegram(`🛡️ <b>HEDGE</b> ${pos.symbol}: ${side === 'short' ? 'opened/increased' : 'reduced'} ${size} ${delta.hlPerp} short. Target ${target} ($${notional.toFixed(2)}). Funding ${annFunding.toFixed(1)}% ann.`)
    } catch (e) {
      log('  ❌ order failed:', e.message)
      await telegram(`❌ Hedge order failed ${pos.symbol}: ${e.message}`)
    }
  }

  // Persist observed hedge state so the monitor + dashboard always reflect reality.
  if (stateDirty) { data.updatedAt = new Date().toISOString(); writePositions(data); log('hedge state synced to lp-positions.json') }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
