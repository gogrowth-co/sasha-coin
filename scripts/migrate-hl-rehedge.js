#!/usr/bin/env node
/**
 * migrate-hl-rehedge.js — ONE-OFF: swap the hedge leg from BTC to ETH on Hyperliquid.
 *
 * Two gated actions (each its own --execute gate; live order requires HEDGE_LIVE_OK=1):
 *   --close-btc                      : market BUY current BTC short, reduce_only=true (close it)
 *   --open-eth --size S --leverage L : set ETH leverage isolated L, then market SELL S ETH (open short)
 *
 * Default DRY RUN — prints live state + the exact order, no signing. Reuses hedge-executor order logic.
 * Signs with HL_PRIVATE_KEY (wallet 0xFAef…). Reads HL_WALLET_ADDRESS for state.
 *
 * Sasha Coin — LP migration. One-off, delete after migration.
 */
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { ExchangeClient, InfoClient, HttpTransport } from '@nktkas/hyperliquid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// Event-driven dashboard refresh after a successful capital move (non-fatal).
function refreshDashboard() {
  try { execSync(`bash ${path.join(__dirname, 'refresh-dashboard.sh')}`, { stdio: 'inherit', timeout: 200000 }) }
  catch (e) { console.error('[refresh-dashboard non-fatal]', e.message) }
}
;(() => {
  const cands = ['/data/.openclaw/.env', path.resolve(WORKSPACE, '..', '.env'), path.resolve(WORKSPACE, '.env')]
  for (const p of cands) { if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i); if (!m) continue; const [, k, rv] = m; if (process.env[k]) continue; let v = rv.trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[k] = v } break }
})()

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const CLOSE_BTC = args.includes('--close-btc')
const OPEN_ETH = args.includes('--open-eth')
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const SIZE = val('--size') ? parseFloat(val('--size')) : null
const LEV = val('--leverage') ? parseFloat(val('--leverage')) : 5

const log = (...a) => console.log(...a)
function hlClients() {
  const transport = new HttpTransport({ isTestnet: false })
  const info = new InfoClient({ transport })
  let exchange = null
  if (process.env.HL_PRIVATE_KEY) exchange = new ExchangeClient({ transport, wallet: new ethers.Wallet(process.env.HL_PRIVATE_KEY) })
  return { info, exchange }
}
async function perpMeta(info, coin) {
  const [meta, ctxs] = await info.metaAndAssetCtxs()
  const idx = meta.universe.findIndex(a => a.name === coin)
  if (idx < 0) throw new Error(`${coin} not listed`)
  return { idx, szDecimals: meta.universe[idx].szDecimals, maxLeverage: meta.universe[idx].maxLeverage, markPx: parseFloat(ctxs[idx].markPx), funding8h: parseFloat(ctxs[idx].funding) }
}
async function currentShort(info, address, coin) {
  const st = await info.clearinghouseState({ user: address })
  const p = (st.assetPositions || []).find(x => x.position?.coin === coin)
  return p ? Math.abs(parseFloat(p.position.szi)) : 0
}
async function positionDetail(info, address, coin) {
  const st = await info.clearinghouseState({ user: address })
  const p = (st.assetPositions || []).find(x => x.position?.coin === coin)
  const acct = parseFloat(st.crossMarginSummary?.accountValue || 0)
  return { p: p?.position || null, acct }
}
function fmtSize(sz, d) { return sz.toFixed(d) }
function fmtPrice(px, szDecimals) { const maxDec = 6 - szDecimals; let p = Number(px.toPrecision(5)); const f = 10 ** Math.max(0, maxDec); p = Math.round(p * f) / f; return maxDec <= 0 ? String(Math.round(p)) : String(p) }
async function placeOrder(exchange, m, side, size) {
  const isBuy = side === 'closeShort'; const slip = isBuy ? 1.01 : 0.99
  const order = { a: m.idx, b: isBuy, p: fmtPrice(m.markPx * slip, m.szDecimals), s: fmtSize(size, m.szDecimals), r: isBuy, t: { limit: { tif: 'Ioc' } } }
  log('  -> order:', JSON.stringify(order))
  return exchange.order({ orders: [order], grouping: 'na' })
}

async function main() {
  if (!CLOSE_BTC && !OPEN_ETH) { log('Pass --close-btc or --open-eth --size S --leverage L (add --execute). Default dry-run.'); process.exit(0) }
  const { info, exchange } = hlClients()
  const address = process.env.HL_WALLET_ADDRESS
  log(`migrate-hl-rehedge ${EXECUTE ? '(EXECUTE)' : '(DRY RUN)'} | wallet ${address}`)
  if (EXECUTE && process.env.HEDGE_LIVE_OK !== '1') { log('⛔ live order requires HEDGE_LIVE_OK=1'); process.exit(1) }

  if (CLOSE_BTC) {
    const m = await perpMeta(info, 'BTC')
    const sz = await currentShort(info, address, 'BTC')
    const { p, acct } = await positionDetail(info, address, 'BTC')
    log(`\n[close-btc] current BTC short ${sz} | entry $${p?.entryPx} | uPnL $${p ? parseFloat(p.unrealizedPnl).toFixed(2) : 'n/a'} | mark $${m.markPx} | acct $${acct.toFixed(2)}`)
    if (sz <= 0) { log('  no BTC short to close.'); return }
    log(`  WILL: market BUY ${sz} BTC reduce_only=true`)
    if (!EXECUTE) { log('  DRY RUN — no order.'); return }
    const res = await placeOrder(exchange, m, 'closeShort', sz)
    log('  result:', JSON.stringify(res))
    const after = await currentShort(info, address, 'BTC')
    log(`  VERIFY BTC short now ${after} ${after === 0 ? '✅ closed' : '⚠ still open'}`)
    return
  }
  if (OPEN_ETH) {
    if (!SIZE || SIZE <= 0) { log('⛔ --size required'); process.exit(1) }
    const m = await perpMeta(info, 'ETH')
    const size = Number(SIZE.toFixed(m.szDecimals))
    const existing = await currentShort(info, address, 'ETH')
    const mmr = 0.5 / m.maxLeverage
    const liq = m.markPx * (1 + 1 / LEV) / (1 + mmr)
    const ann = m.funding8h * 3 * 365 * 100
    log(`\n[open-eth] mark $${m.markPx} | funding ann ${ann.toFixed(2)}% ${ann > 0 ? '(RECEIVE)' : '(PAY)'} | existing ETH short ${existing}`)
    log(`  WILL: updateLeverage(ETH, isolated, ${LEV}x) ; market SELL ${size} ETH`)
    log(`  notional $${(size * m.markPx).toFixed(2)} | margin ~$${(size * m.markPx / LEV).toFixed(2)} | est liq $${liq.toFixed(0)} (+${((liq / m.markPx - 1) * 100).toFixed(1)}%)`)
    if (!EXECUTE) { log('  DRY RUN — no order.'); return }
    await exchange.updateLeverage({ asset: m.idx, isCross: false, leverage: LEV }).catch(e => log(`  warn updateLeverage: ${e.message}`))
    const res = await placeOrder(exchange, m, 'short', size)
    log('  result:', JSON.stringify(res))
    const { p } = await positionDetail(info, address, 'ETH')
    if (p) log(`  VERIFY ETH short ${Math.abs(parseFloat(p.szi))} | entry $${p.entryPx} | liq $${p.liquidationPx} | margin $${parseFloat(p.marginUsed).toFixed(2)} | lev ${p.leverage?.value}x ${p.leverage?.type}`)
    return
  }
}
main().then(() => { if (EXECUTE) refreshDashboard() }).catch(e => { console.error('FATAL:', e.message); process.exit(1) })
