#!/usr/bin/env node
/**
 * lp-scout.js — CANONICAL stable/bluechip LP finder for the Sasha LP miner.
 *
 * This is THE script to run whenever we need to find a new stable/bluechip pool to
 * enter. It is built on the ACCURATE data stack (NOT DefiLlama, which mis-derives fee
 * APR on concentrated liquidity by 20-46x — see research/lp-data-sources-methodology-2026-06-02.md).
 *
 * THE STACK (every number is cross-checked or read from ground truth):
 *   - Discovery + TVL + volume : GeckoTerminal  (cross-checked vs DexScreener; proven to agree 0.1%)
 *   - Fee rate (ground truth)  : on-chain fee()  (Aerodrome Slipstream fees are DYNAMIC; labels lie)
 *   - Fee APR                  : computed on 30-DAY-avg daily volume (7d/24h shown for the volatility ramp)
 *   - Realized-volume validate : Dune dex.trades (a 3rd independent indexer; --validate)
 *
 * SCOPE (locked): Base, stable/bluechip ONLY (the hedgeable delta-neutral plays). The volatile
 * leg must have a clean Hyperliquid perp (BTC/ETH) so the position can be hedged. Stable/stable
 * (no hedge needed, low yield) and alt/bluechip (banned, IL-heavy) are intentionally excluded.
 *
 * READ-ONLY. No writes to chain, no capital movement. Writes a dated report to reports/.
 *
 * USAGE:
 *   node scripts/lp-scout.js                 # scan, default filters (TVL>=$1M, fee APR(30d)>=15%)
 *   node scripts/lp-scout.js --validate      # + Dune realized-volume cross-check on the top finalists
 *   node scripts/lp-scout.js --min-tvl 2000000 --min-apr 25
 *   node scripts/lp-scout.js --pages 8 --top 5
 *   node scripts/lp-scout.js --no-report     # skip writing the reports/ files
 *
 * Sasha Coin — Liquidity Miner / pool selection (DEC-002: pool selection is the lever).
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? parseFloat(args[i + 1]) : d }
const has = (f) => args.includes(f)

// ── tunables (defaults are the validated 2026-06-04 settings) ───────────────────────
const MIN_TVL = num('--min-tvl', 1_000_000)
const MIN_APR = num('--min-apr', 15)        // filter on the 30d fee APR
const PAGES   = num('--pages', 6)           // GeckoTerminal discovery depth (20 pools/page)
const TOP_N   = num('--top', 3)             // how many finalists to Dune-validate
const DO_VALIDATE = has('--validate')
const WRITE_REPORT = !has('--no-report')

const GT = 'https://api.geckoterminal.com/api/v2'
const RPC = 'https://base-rpc.publicnode.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const GT_GAP = 2600 // stay under GeckoTerminal's ~30 calls/min free limit

const STABLES = new Set(['USDC','USDT','DAI','USDBC','USDE','SUSDE','GHO','CRVUSD','USDS','FRAX','USDA','USD+','USDPLUS','DOLA','LUSD','USDM','MAI','USDX','OUSD','EUSD'])
// bluechip volatile legs with a clean Hyperliquid perp to hedge with
const HEDGE = {
  CBBTC:'BTC', WBTC:'BTC', TBTC:'BTC', LBTC:'BTC', BTCB:'BTC', SOLVBTC:'BTC',
  WETH:'ETH', ETH:'ETH', WSTETH:'ETH', CBETH:'ETH', WEETH:'ETH', RETH:'ETH', EZETH:'ETH', RSETH:'ETH', OETH:'ETH', SUPEROETHB:'ETH', WSUPEROETHB:'ETH',
}
const LST = new Set(['WSTETH','CBETH','WEETH','RETH','EZETH','RSETH','OETH','SUPEROETHB','WSUPEROETHB','SUSDE'])

// known pools to always re-validate (current position + prior candidates)
const SEED = [
  '0x4e962bb3889bf030368f56810a9c96b83cb3e778', // cbBTC/USDC Aero ts100
  '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59', // WETH/USDC  Aero ts100
  '0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb', // Sasha's current USDC/cbBTC ts2000 (control)
]

async function gt(p) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${GT}${p}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (r.status === 429) { await sleep(20000); continue }
    if (!r.ok) throw new Error(`GT ${r.status} ${p}`)
    return r.json()
  }
  throw new Error(`GT rate-limited ${p}`)
}
async function rpcCall(to, data) {
  try {
    const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) })
    const j = await r.json()
    if (j.error || !j.result || j.result === '0x') return null
    return parseInt(j.result, 16)
  } catch { return null }
}
async function dexscreener(addr) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${addr}`, { headers: { 'User-Agent': UA } })
    const p = ((await r.json()).pairs || [])[0]
    return p ? { tvl: p.liquidity?.usd ?? null, vol24: p.volume?.h24 ?? null } : null
  } catch { return null }
}
function classify(name) {
  // "cbBTC / USDC 0.05%" -> ["CBBTC","USDC"] (drop the lying fee label)
  const parts = name.split('/').map(s => s.trim().split(/\s+/)[0].toUpperCase()).filter(Boolean)
  if (parts.length !== 2) return null
  const [a, b] = parts
  if (STABLES.has(a) && HEDGE[b]) return { stable: a, vol: b, perp: HEDGE[b], lst: LST.has(b) }
  if (STABLES.has(b) && HEDGE[a]) return { stable: b, vol: a, perp: HEDGE[a], lst: LST.has(a) }
  return null
}

// Dune realized 30d volume (3rd independent indexer). Requires the authenticated dune CLI.
function duneRealizedVolume(addrs) {
  const inList = addrs.map(a => a.toLowerCase()).join(', ')
  const sql = `SELECT project_contract_address AS pool, count(*) AS trades_30d, round(sum(amount_usd)/30) AS vol_per_day FROM dex.trades WHERE blockchain = 'base' AND block_date >= current_date - interval '30' day AND project_contract_address IN (${inList}) GROUP BY 1`
  try {
    const out = execSync(`dune query run-sql --sql ${JSON.stringify(sql)} -o json`, { encoding: 'utf8', timeout: 180000, stdio: ['ignore','pipe','pipe'] })
    const rows = JSON.parse(out)?.result?.rows || []
    const m = {}
    for (const r of rows) m[r.pool.toLowerCase()] = r.vol_per_day
    return m
  } catch (e) {
    console.log(`  [validate] Dune unavailable: ${e.message.split('\n')[0]}`)
    return null
  }
}

async function main() {
  console.log(`lp-scout — Base stable/bluechip · TVL>=$${(MIN_TVL/1e6).toFixed(1)}M · fee APR(30d)>=${MIN_APR}%`)
  console.log('Discovering pools by 24h volume (GeckoTerminal)...')
  const pools = new Map()
  for (let page = 1; page <= PAGES; page++) {
    try {
      const d = await gt(`/networks/base/pools?page=${page}&sort=h24_volume_usd_desc`)
      for (const p of d.data || []) {
        const a = p.attributes, addr = (a.address || '').toLowerCase()
        if (addr) pools.set(addr, { name: a.name, addr, dex: p.relationships?.dex?.data?.id || '?', tvl: parseFloat(a.reserve_in_usd)||0, vol24: parseFloat(a.volume_usd?.h24)||0 })
      }
    } catch (e) { console.log('  page', page, e.message) }
    await sleep(GT_GAP)
  }
  for (const addr of SEED) {
    if (pools.has(addr)) continue
    try { const d = await gt(`/networks/base/pools/${addr}`); const a = d.data.attributes
      pools.set(addr, { name: a.name, addr, dex: d.data.relationships?.dex?.data?.id || '?', tvl: parseFloat(a.reserve_in_usd)||0, vol24: parseFloat(a.volume_usd?.h24)||0 })
    } catch (e) { console.log('  seed', addr.slice(0,10), e.message) }
    await sleep(GT_GAP)
  }
  console.log(`Discovered ${pools.size} pools.`)

  let cands = [...pools.values()].map(p => ({ ...p, c: classify(p.name) })).filter(p => p.c && p.tvl >= MIN_TVL)
    .map(p => ({ ...p, ...p.c })).sort((a,b) => b.vol24 - a.vol24).slice(0, 30)
  console.log(`Stable/bluechip + TVL>=$${(MIN_TVL/1e6).toFixed(1)}M to deep-check: ${cands.length}\n`)

  const rows = []
  for (const c of cands) {
    const feeRaw = await rpcCall(c.addr, '0xddca3f43')   // fee()
    const ts     = await rpcCall(c.addr, '0xd0c93a7c')   // tickSpacing()
    const feeRate = feeRaw != null ? feeRaw / 1e6 : null
    let vol7avg = null, vol30avg = null, days30 = 0
    try {
      const o = await gt(`/networks/base/pools/${c.addr}/ohlcv/day?limit=31`)
      const daily = (o.data?.attributes?.ohlcv_list || []).map(x => x[5]).filter(v => v != null)
      const seven = daily.slice(1, 8), thirty = daily.slice(1, 31); days30 = thirty.length
      if (seven.length)  vol7avg  = seven.reduce((s,v)=>s+v,0)/seven.length
      if (thirty.length) vol30avg = thirty.reduce((s,v)=>s+v,0)/thirty.length
    } catch {}
    await sleep(GT_GAP)
    const ds = await dexscreener(c.addr)
    const apr = (vol, f) => (vol && f) ? (vol * f / c.tvl * 365 * 100) : null
    rows.push({ ...c, feeRate, ts, vol7avg, vol30avg, days30, feeApr30: apr(vol30avg, feeRate), feeApr7: apr(vol7avg, feeRate), feeApr24: apr(c.vol24, feeRate), ds })
  }

  const eff = (r) => r.feeApr30 != null ? r.feeApr30 : r.feeApr7
  const pass = rows.filter(r => eff(r) != null && eff(r) >= MIN_APR).sort((a,b)=>eff(b)-eff(a))
  const near = rows.filter(r => eff(r) != null && eff(r) <  MIN_APR).sort((a,b)=>eff(b)-eff(a))

  // optional: Dune realized-volume validation on the top finalists (+ control seeds)
  let dune = null
  if (DO_VALIDATE) {
    console.log('Validating realized 30d volume on top finalists via Dune...')
    const toValidate = [...new Set([...pass.slice(0, TOP_N).map(r=>r.addr), ...SEED])]
    dune = duneRealizedVolume(toValidate)
  }

  const fmtM = (n) => n==null?'?': n>=1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${Math.round(n/1e3)}k`
  const line = (r) => {
    const agree = (r.ds?.tvl && r.tvl) ? `${(Math.abs(r.ds.tvl-r.tvl)/r.tvl*100).toFixed(0)}%` : '?'
    const a30 = r.feeApr30!=null ? r.feeApr30.toFixed(0)+'%'+(r.days30<30?'*':'') : (r.feeApr7!=null?r.feeApr7.toFixed(0)+'%~':'?')
    let dchk = ''
    if (dune) { const dv = dune[r.addr]; dchk = dv ? ' Dune '+(Math.abs(dv-r.vol30avg)/r.vol30avg*100).toFixed(0)+'%' : ' Dune -' }
    return [r.name.padEnd(17), r.dex.replace('aerodrome-','aero-').replace('uniswap-','uni-').slice(0,15).padEnd(15),
      (r.ts!=null?'ts'+r.ts:'?').padEnd(6), (r.feeRate!=null?(r.feeRate*100).toFixed(3)+'%':'?').padEnd(8),
      a30.padStart(7), (r.feeApr7!=null?r.feeApr7.toFixed(0)+'%':'?').padStart(6), (r.feeApr24!=null?r.feeApr24.toFixed(0)+'%':'?').padStart(6),
      fmtM(r.tvl).padStart(7), fmtM(r.vol30avg).padStart(8), ('GT/DS '+agree+dchk).padEnd(20), r.perp+(r.lst?'~':'')].join(' ')
  }
  const header = ['PAIR'.padEnd(17),'DEX'.padEnd(15),'TICK'.padEnd(6),'FEE'.padEnd(8),'APR30'.padStart(7),'APR7'.padStart(6),'APR24'.padStart(6),'TVL'.padStart(7),'VOL/d30'.padStart(8),'XCHECK'.padEnd(20),'HEDGE'].join(' ')

  console.log('\n===== PASS =====')
  console.log(header); console.log('-'.repeat(header.length)); pass.forEach(r => console.log(line(r)))
  console.log(`\n(${pass.length} pass)\n--- near miss ---`); near.slice(0,8).forEach(r => console.log(line(r)))
  console.log('\nAPR30 = durable (30d-avg-volume) fee APR, the trust number. APR7/APR24 = volatility ramp.')
  console.log('* = <30d data (7d used).  ~ = LST/ETH-correlated leg (imperfect hedge).  XCHECK: GT-vs-DexScreener TVL gap, Dune-vs-GT volume gap.')
  console.log('NOTE: numbers are GROSS fee APR. Net = minus IL/LVR, minus out-of-range time, plus/minus the hedge. Slipstream fees are dynamic; APR is a band, not a point.')

  if (WRITE_REPORT) {
    const date = new Date().toISOString().slice(0, 10)
    const dir = path.join(WORKSPACE, 'reports'); fs.mkdirSync(dir, { recursive: true })
    const payload = { generatedAt: new Date().toISOString(), scope: 'base-stable-bluechip', filters: { minTvlUsd: MIN_TVL, minFeeApr30: MIN_APR }, validated: !!dune, pass, near, dune }
    fs.writeFileSync(path.join(dir, `lp-scan-${date}.json`), JSON.stringify(payload, null, 2))
    const md = [`# LP Scout — Base stable/bluechip (${date})`, ``,
      `Filters: TVL >= $${(MIN_TVL/1e6).toFixed(1)}M, fee APR(30d) >= ${MIN_APR}%. Stack: GeckoTerminal + DexScreener + on-chain fee() + 30d-avg volume${dune?' + Dune realized-volume validation':''}.`, ``,
      `| Pair | DEX | Tick | on-chain fee | APR30 | APR7 | APR24 | TVL | Vol/d30 | Hedge |`,
      `|---|---|---|---|---|---|---|---|---|---|`,
      ...pass.map(r => `| ${r.name} | ${r.dex} | ts${r.ts} | ${r.feeRate!=null?(r.feeRate*100).toFixed(3)+'%':'?'} | ${r.feeApr30?.toFixed(0)}% | ${r.feeApr7?.toFixed(0)}% | ${r.feeApr24?.toFixed(0)}% | ${fmtM(r.tvl)} | ${fmtM(r.vol30avg)} | ${r.perp}${r.lst?'~':''} |`),
      ``, `_Gross fee APR. Net = minus IL/LVR, minus out-of-range time, +/- hedge. Slipstream fees dynamic; treat APR as a band._`].join('\n')
    fs.writeFileSync(path.join(dir, `lp-scan-${date}.md`), md)
    console.log(`\nReport written: reports/lp-scan-${date}.{json,md}`)
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
