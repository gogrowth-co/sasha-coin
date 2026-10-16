#!/usr/bin/env node
/**
 * backtest.mjs — path-based backtest of the LP + hedge + trend-kicker strategy
 * on real daily OHLC history (Binance). Zero capital, zero on-chain.
 *
 * What it models
 *   • concentrated-liquidity LP: exact CL value along the path, in-range fee accrual,
 *     rebalance cost (swap bps + flat gas), vol-widened + trend-skewed ranges
 *   • hedge short: isolated margin, real liq price, intrabar liquidation (candle high),
 *     optional exchange-native stop bracket, funding, static / dynamic / trend-flexed sizing
 *   • upside kicker: leveraged long, liq matched to the LP lower band, uptrend-gated,
 *     re-arm cooldown after a liquidation
 *   • idle USD earning a stable yield
 *   • trend / vol classification with NO lookahead (EMA cross + slope, realised-vol percentile)
 *
 * Usage
 *   node scripts/sim/backtest.mjs --asset ETH --preset trend-flex
 *   node scripts/sim/backtest.mjs --asset ETH --compare --capital 94
 *   node scripts/sim/backtest.mjs --asset ETH --preset trend-flex --from 2025-06-01 --to 2025-12-31
 *   node scripts/sim/backtest.mjs --asset SOL --compare --fee-apr 60 --json
 *
 * Not a forecast. A structural A/B across the real regimes of the last few years.
 * Change --fee-apr / --funding / the preset and the verdict changes — that is the point.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { lpAt, Lfor, LfromTok, LfromUsd } from './lib/clmath.mjs'
import * as P from './lib/perp.mjs'
import { precompute, classify } from './lib/indicators.mjs'
import { targetLP, targetHedge, targetKicker, defaults, concentrationFactor } from './lib/strategy.mjs'
import { PRESETS } from './presets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)
const has = f => args.includes(f)
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d }
const num = (f, d) => { const v = val(f, null); return v == null ? d : parseFloat(v) }

const ASSET = val('--asset', 'ETH').toUpperCase()
const CAPITAL = num('--capital', 94)
const FROM = val('--from', null)
const TO = val('--to', null)
const FEE_APR_OVERRIDE = num('--fee-apr', null)
const FUNDING_OVERRIDE = num('--funding', null)
const WIDTH_OVERRIDE = num('--width', null)
const REBAL_OVERRIDE = num('--rebal-days', null)
const CONVICTION_OVERRIDE = num('--conviction', null)
const WRITE_JSON = has('--json')
const WRITE_HTML = !has('--no-html')
const DAY = 864e5, DT = 1 / 365

// ── data ─────────────────────────────────────────────────────────────────────────
const dataFile = path.join(ROOT, 'reports/sim/data', `${ASSET}-1d.json`)
if (!fs.existsSync(dataFile)) { console.error(`no data for ${ASSET}. run: node scripts/sim/fetch-prices.mjs`); process.exit(1) }
let candles = JSON.parse(fs.readFileSync(dataFile, 'utf8')).candles
if (FROM) candles = candles.filter(c => c.t >= Date.parse(FROM))
if (TO) candles = candles.filter(c => c.t <= Date.parse(TO))
const closes = candles.map(c => c.c)
const pre = precompute(closes)
const WARMUP = 65

// ── engine ───────────────────────────────────────────────────────────────────────
function run(rawCfg) {
  const cfg = defaults({ ...rawCfg, capitalUsd: CAPITAL })
  if (FEE_APR_OVERRIDE != null) cfg.lp.feeAprInRange = FEE_APR_OVERRIDE / 100
  if (FUNDING_OVERRIDE != null) { cfg.hedge.fundingAnnRate = FUNDING_OVERRIDE / 100 }
  if (WIDTH_OVERRIDE != null) cfg.lp.widthPct = WIDTH_OVERRIDE / 100
  if (REBAL_OVERRIDE != null) cfg.rebalanceDays = REBAL_OVERRIDE
  if (CONVICTION_OVERRIDE != null) cfg.minTrendStrength = CONVICTION_OVERRIDE

  let idle = CAPITAL
  let lp = null                     // { a,b,L }
  let hedge = null                  // perp leg (short)
  let kicker = null                 // perp leg (long)
  let kickerLiqDay = null

  const acc = { fees: 0, funding: 0, stableYield: 0, gas: 0, perpFee: 0, swapCost: 0, lpPnl: 0, hedgePnl: 0, kickPnl: 0 }
  const book = (p) => idle + (lp ? lpAt(p, lp.L, lp.a, lp.b).value : 0) + (hedge ? P.equity(hedge, p) : 0) + (kicker ? P.equity(kicker, p) : 0)
  let consErr = 0, consWorst = null
  let lpBasis = 0, hedgeBasis = 0, kickBasis = 0   // cash put into each open leg
  let lastReRangeDay = -999
  const ev = { rebalances: 0, lpReopens: 0, hedgeResizes: 0, hedgeLiq: 0, hedgeStop: 0, kickerLiq: 0, kickerOpens: 0, lpExitStable: 0 }
  const equity = []
  let lastTrend = null, lastSpiking = false, peak = -Infinity, maxDD = 0

  const SWAP_BPS = cfg.lp.swapBps, GAS = cfg.lp.gas, PERP_FEE = 0.0005

  const markNav = (P_) =>
    idle +
    (lp ? lpAt(P_, lp.L, lp.a, lp.b).value : 0) +
    (hedge ? P.equity(hedge, P_) : 0) +
    (kicker ? P.equity(kicker, P_) : 0)

  const closeHedge = (px) => { if (hedge) { idle += Math.max(0, P.equity(hedge, px)); hedge = null } }
  const closeKicker = (px) => { if (kicker) { idle += Math.max(0, P.equity(kicker, px)); kicker = null } }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], px = c.c
    if (i < WARMUP) { equity.push({ t: c.t, px, nav: CAPITAL, inRange: false, netDeltaPct: 0, trend: 'warmup', vol: 'warmup' }); peak = CAPITAL; continue }

    const cls = classify(closes, i, pre)

    // ── 1. accrue income (on start-of-day balances) ──────────────────────────────
    acc.stableYield += cfg.stableYieldAnnRate * idle * DT; idle += cfg.stableYieldAnnRate * idle * DT
    if (lp) {
      // fraction of the day the price plausibly sat inside the band (candle range vs band)
      const lo = Math.max(c.l, lp.a), hi = Math.min(c.h, lp.b)
      const inFrac = c.h > c.l ? Math.max(0, Math.min(1, (hi - lo) / (c.h - c.l))) : (px > lp.a && px < lp.b ? 1 : 0)
      if (inFrac > 0) {
        const volMul = ({ calm: 0.8, normal: 1, elevated: 1.35, spiking: 1.6 })[cls.vol] ** (cfg.lp.feeVolBeta || 0)
        const conc = concentrationFactor(px, lp.a, lp.b)      // wider range => proportionally fewer fees
        const fee = cfg.lp.feeAprInRange * conc * volMul * lpAt(px, lp.L, lp.a, lp.b).value * DT * inFrac
        acc.fees += fee; idle += fee
      }
    }
    if (hedge) { const f = P.funding(hedge, px, cfg.hedge.fundingAnnRate, DT); acc.funding += f; idle += f }
    if (kicker) { const f = P.funding(kicker, px, cfg.kicker.fundingAnnRate, DT); acc.funding += f; idle += f }

    // ── 2. intrabar liquidation / stop on the perp legs ─────────────────────────
    if (hedge) {
      const stopPx = cfg.hedge.stopPct ? hedge.entry * (1 + cfg.hedge.stopPct) : null
      const st = P.checkStop(hedge, c, stopPx)
      const lq = P.checkLiq(hedge, c)
      if (st.hit && (!lq.hit || stopPx < lq.at)) { acc.hedgePnl += (hedge.margin + st.pnl) - hedgeBasis; idle += Math.max(0, hedge.margin + st.pnl); hedge = null; hedgeBasis = 0; ev.hedgeStop++ }
      else if (lq.hit) { acc.hedgePnl += -hedgeBasis; hedge = null; hedgeBasis = 0; ev.hedgeLiq++ }   // full margin lost
    }
    if (kicker) {
      const lq = P.checkLiq(kicker, c)
      if (lq.hit) { acc.kickPnl += -kickBasis; kicker = null; kickBasis = 0; ev.kickerLiq++; kickerLiqDay = i }
    }

    // ── 3. rebalance triggers ───────────────────────────────────────────────────
    const schedHit = (i - WARMUP) % cfg.rebalanceDays === 0
    const rangeExit = cfg.rebalanceOnRangeExit && lp && (c.l <= lp.a || c.h >= lp.b)
    const trendFlip = lastTrend != null && cls.trend !== lastTrend
    const spikeEdge = cls.vol === 'spiking' && !lastSpiking
    const doRebal = schedHit || rangeExit || trendFlip || spikeEdge

    if (doRebal) {
      ev.rebalances++
      const bookBefore = book(px), swapBefore = acc.swapCost + acc.perpFee
      const daysSinceKickerLiq = kickerLiqDay == null ? null : i - kickerLiqDay
      const ctx = { P: px, nav: markNav(px), cls, daysSinceKickerLiq }

      const tLP = targetLP(ctx, cfg)

      // reserve hedge + kicker margin BEFORE sizing the LP, so the risk legs never starve.
      // the hedge must be able to scale to the LP's MAX delta (= full LP value, when the
      // range converts 100% to one side), so reserve against tLP.capUsd, not half of it.
      const synthLp = tLP ? { a: tLP.a, b: tLP.b, L: Lfor(tLP.capUsd, px, tLP.a, tLP.b) } : null
      const tH0 = targetHedge(ctx, synthLp, cfg)
      const tK0 = targetKicker(ctx, synthLp, cfg)
      const hMaxRatio = cfg.hedge.mode === 'trendFlex' ? Math.max(cfg.hedge.hNeutral, cfg.hedge.hDown) : 1
      const reserve = (tH0 ? (tLP ? tLP.capUsd * hMaxRatio : tH0.shortNotionalUsd) / cfg.hedge.lev : 0) + (tK0 ? tK0.capUsd : 0) + 1

      // ---- LP: value lives inside `lp` (marked via lpAt); capital moves via `idle` ----
      if (!tLP && lp) {                                       // exit LP -> USD
        const h = lpAt(px, lp.L, lp.a, lp.b)
        const cost = h.tok * px * SWAP_BPS / 1e4 + GAS
        idle += Math.max(0, h.value - cost); acc.swapCost += cost
        acc.lpPnl += h.value - lpBasis; lpBasis = 0; lp = null; ev.lpExitStable++
      } else if (tLP) {
        const cur = lp ? lpAt(px, lp.L, lp.a, lp.b) : { value: 0, tok: 0 }
        const wantCap = Math.min(tLP.capUsd, cur.value + Math.max(0, idle - reserve))
        const widthChg = lp ? Math.abs((tLP.b / tLP.a) / (lp.b / lp.a) - 1) : 1
        const sizeOff = Math.abs(cur.value - wantCap) / Math.max(wantCap, 1)
        // decisive range exit = price is well outside the band, not just grazing it
        const belowExit = lp && c.c < lp.a * 0.96
        const aboveExit = lp && c.c > lp.b * 1.04
        const decisiveExit = (belowExit || aboveExit) && (i - lastReRangeDay) >= 3
        if (!lp) {
          const deploy = Math.max(1, Math.min(wantCap, idle * 0.98) - GAS)
          idle -= deploy + GAS; acc.swapCost += GAS
          lp = { a: tLP.a, b: tLP.b, L: Lfor(deploy, px, tLP.a, tLP.b) }
          lpBasis = deploy; ev.lpReopens++
        } else if (decisiveExit || widthChg > 0.5) {
          // NO-SWAP re-range: keep the single-sided holding, mint an adjacent range.
          // (matches how v3 ranges are actually shifted — no "sell the bottom".)
          lastReRangeDay = i
          acc.lpPnl += cur.value - lpBasis                    // crystallise result so far
          const width = tLP.b / tLP.a
          let na, nb, L
          if (belowExit || cur.usd === 0) { na = px; nb = px * width; L = LfromTok(cur.tok, na, nb) }
          else { na = px / width; nb = px; L = LfromUsd(cur.usd + cur.tok * px, na, nb) }
          const cost = GAS
          idle -= cost; acc.swapCost += cost
          lp = { a: na, b: nb, L }
          lpBasis = lpAt(px, L, na, nb).value; ev.lpReopens++
        } else if (lp && sizeOff > 0.30) {
          // same range, just scale capital in/out — no IL crystallisation
          const delta = wantCap - cur.value
          const cost = Math.abs(delta) * SWAP_BPS / 1e4 + GAS
          if (delta > 0 ? idle >= delta + cost : true) {
            idle -= delta + cost; acc.swapCost += cost
            lp = { a: lp.a, b: lp.b, L: Lfor(Math.max(1, cur.value + delta - cost), px, lp.a, lp.b) }
            lpBasis += delta
          }
        }
      }

      // ---- hedge: sized off the ACTUAL live LP delta ----
      const tH = targetHedge(ctx, lp, cfg)
      const targetShort = tH ? tH.shortNotionalUsd : 0
      const openHedge = (notional) => {
        const m = notional / cfg.hedge.lev
        if (idle >= m) { idle -= m; hedge = P.openLeg(-1, notional, px, cfg.hedge.lev, cfg.hedge.mmr); hedgeBasis = m; return true }
        return false
      }
      if ((!tH || targetShort < 1) && hedge) { acc.hedgePnl += P.equity(hedge, px) - hedgeBasis; closeHedge(px); hedgeBasis = 0 }
      else if (tH && targetShort >= 1 && !hedge) openHedge(targetShort)
      else if (tH && hedge && cfg.hedge.mode !== 'static') {
        if (Math.abs(targetShort - hedge.notional0) / Math.max(hedge.notional0, 1) > 0.12) {
          const fee = Math.abs(targetShort - hedge.notional0) * PERP_FEE
          acc.hedgePnl += P.equity(hedge, px) - hedgeBasis
          idle += Math.max(0, P.equity(hedge, px)) - fee; acc.perpFee += fee
          hedge = null; openHedge(targetShort); ev.hedgeResizes++
        }
      }

      // ---- kicker ----
      const tK = targetKicker(ctx, lp, cfg)
      if (!tK && kicker) { acc.kickPnl += P.equity(kicker, px) - kickBasis; closeKicker(px); kickBasis = 0 }
      else if (tK && !kicker) {
        const m = Math.min(tK.capUsd, idle * 0.5)
        if (m > 0.5) { idle -= m; kicker = P.openLeg(+1, m * tK.lev, px, tK.lev, cfg.hedge.mmr); kickBasis = m; ev.kickerOpens++ }
      }

      lastTrend = cls.trend; lastSpiking = cls.vol === 'spiking'

      // conservation: book value after rebalance = before − costs incurred this step
      const costStep = (acc.swapCost + acc.perpFee) - swapBefore
      const err = book(px) - (bookBefore - costStep)
      if (Math.abs(err) > Math.abs(consErr)) { consErr = err; consWorst = new Date(c.t).toISOString().slice(0, 10) }
    }

    // ── 4. gas booked at rebalance already; mark NAV ────────────────────────────
    const nav = markNav(px)
    const lpTok = lp ? lpAt(px, lp.L, lp.a, lp.b).tok : 0
    const kTok = kicker ? kicker.size : 0
    const hTok = hedge ? hedge.size : 0
    const netDeltaUsd = (lpTok + kTok - hTok) * px
    peak = Math.max(peak, nav); maxDD = Math.max(maxDD, (peak - nav) / peak)
    acc._lpValSum = (acc._lpValSum || 0) + (lp ? lpAt(px, lp.L, lp.a, lp.b).value : 0)
    acc._lpDeltaSum = (acc._lpDeltaSum || 0) + (lp ? Math.abs(lpTok * px) : 0)
    acc._hedgeNotSum = (acc._hedgeNotSum || 0) + (hedge ? hedge.size * px : 0)
    acc._lpDays = (acc._lpDays || 0) + (lp ? 1 : 0)
    acc._days = (acc._days || 0) + 1
    equity.push({
      t: c.t, px, nav, inRange: !!(lp && px > lp.a && px < lp.b),
      netDeltaPct: netDeltaUsd / nav, trend: cls.trend, vol: cls.vol,
    })
  }

  // realise open legs at the final price for the P&L decomposition
  const pf = candles[candles.length - 1].c
  const lpPnl = acc.lpPnl + (lp ? lpAt(pf, lp.L, lp.a, lp.b).value - lpBasis : 0)
  const hedgePnl = acc.hedgePnl + (hedge ? P.equity(hedge, pf) - hedgeBasis : 0)
  const kickPnl = acc.kickPnl + (kicker ? P.equity(kicker, pf) - kickBasis : 0)
  acc.lpPnlFinal = lpPnl; acc.hedgePnlFinal = hedgePnl; acc.kickPnlFinal = kickPnl

  if (process.env.DBG) {
    const avgLp = acc._lpValSum / Math.max(acc._lpDays, 1)
    const chk = acc.fees + acc.funding + acc.stableYield - acc.swapCost - acc.perpFee + lpPnl + hedgePnl + kickPnl
    console.error(`DBG ${rawCfg.__name}: lpDays ${acc._lpDays}/${acc._days} avgLpVal $${avgLp.toFixed(1)} realAPR ${(acc.fees / avgLp / (acc._lpDays / 365) * 100).toFixed(0)}%`)
    console.error(`    P&L  fees +$${acc.fees.toFixed(1)}  funding +$${acc.funding.toFixed(1)}  yield +$${acc.stableYield.toFixed(1)}  costs -$${(acc.swapCost + acc.perpFee).toFixed(1)}  |  LP mtm $${lpPnl.toFixed(1)}  hedge $${hedgePnl.toFixed(1)}  kicker $${kickPnl.toFixed(1)}  ||  sum $${chk.toFixed(1)}  actualΔNAV $${(book(pf) - CAPITAL).toFixed(1)}`)
    console.error(`    sizing avg |LP delta| $${(acc._lpDeltaSum / acc._days).toFixed(1)}  avg hedge notional $${(acc._hedgeNotSum / acc._days).toFixed(1)}  hedge resizes ${ev.hedgeResizes} stops ${ev.hedgeStop} liqs ${ev.hedgeLiq}`)
  }
  return summarize(rawCfg, cfg, equity, acc, ev, maxDD)
}

// ── metrics ──────────────────────────────────────────────────────────────────────
function summarize(rawCfg, cfg, equity, acc, ev, maxDD) {
  const live = equity.slice(WARMUP)
  const n0 = live[0].nav, nF = live[live.length - 1].nav
  const days = (live[live.length - 1].t - live[0].t) / DAY
  const yrs = days / 365
  const totalRet = nF / n0 - 1
  const cagr = Math.pow(nF / n0, 1 / yrs) - 1

  const rets = []
  for (let i = 1; i < live.length; i++) rets.push(live[i].nav / live[i - 1].nav - 1)
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1))
  const dn = rets.filter(r => r < 0)
  const sdDn = Math.sqrt(dn.reduce((a, b) => a + b * b, 0) / Math.max(dn.length, 1))
  const sharpe = (mean / sd) * Math.sqrt(365)
  const sortino = (mean / sdDn) * Math.sqrt(365)

  // monthly
  const mo = {}
  for (const p of live) { const k = new Date(p.t).toISOString().slice(0, 7); (mo[k] ||= []).push(p.nav) }
  const monthly = Object.entries(mo).map(([k, v]) => [k, v[v.length - 1] / v[0] - 1])
  const mPos = monthly.filter(([, r]) => r > 0).length
  const worstM = monthly.reduce((a, b) => b[1] < a[1] ? b : a)
  const bestM = monthly.reduce((a, b) => b[1] > a[1] ? b : a)
  const worstDay = Math.min(...rets)

  const inRangePct = live.filter(p => p.inRange).length / live.length
  const maxNetDelta = Math.max(...live.map(p => Math.abs(p.netDeltaPct)))
  const avgNetDelta = live.reduce((a, p) => a + Math.abs(p.netDeltaPct), 0) / live.length

  return {
    name: rawCfg.__name, label: rawCfg.label,
    totalRet, cagr, maxDD, annVol: sd * Math.sqrt(365), sharpe, sortino,
    monthsPositivePct: mPos / monthly.length, worstMonth: worstM, bestMonth: bestM, worstDay,
    inRangePct, maxNetDelta, avgNetDelta,
    fees: acc.fees, funding: acc.funding, stableYield: acc.stableYield,
    costs: acc.gas + acc.perpFee + acc.swapCost,
    events: ev, equity, n0, nF, yrs,
  }
}

// ── HODL / USD reference ─────────────────────────────────────────────────────────
function reference() {
  const c0 = candles[WARMUP], cF = candles[candles.length - 1]
  const units = CAPITAL / c0.c
  let peak = -Infinity, dd = 0
  const eq = candles.slice(WARMUP).map(c => { const nav = units * c.c; peak = Math.max(peak, nav); dd = Math.max(dd, (peak - nav) / peak); return { t: c.t, nav } })
  const rets = []; for (let i = 1; i < eq.length; i++) rets.push(eq[i].nav / eq[i - 1].nav - 1)
  const m = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1))
  const yrs = (cF.t - c0.t) / DAY / 365
  return { hodl: { totalRet: cF.c / c0.c - 1, cagr: Math.pow(cF.c / c0.c, 1 / yrs) - 1, maxDD: dd, sharpe: m / sd * Math.sqrt(365), equity: eq } }
}

// ── output ───────────────────────────────────────────────────────────────────────
const pctf = (x, d = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%'
const usd = (x) => (x >= 0 ? '+$' : '-$') + Math.abs(x).toFixed(2)

function printOne(r, ref) {
  console.log(`\n${'═'.repeat(78)}`)
  console.log(`${r.name}  —  ${r.label}`)
  console.log(`${'─'.repeat(78)}`)
  console.log(`window        ${new Date(candles[WARMUP].t).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].t).toISOString().slice(0, 10)}  (${r.yrs.toFixed(2)}y)   ${ASSET} ${pctf(ref.hodl.totalRet)} over window`)
  console.log(`NAV           $${r.n0.toFixed(2)} → $${r.nF.toFixed(2)}   total ${pctf(r.totalRet)}   CAGR ${pctf(r.cagr)}`)
  console.log(`risk          maxDD ${pctf(r.maxDD)}   annVol ${pctf(r.annVol)}   Sharpe ${r.sharpe.toFixed(2)}   Sortino ${r.sortino.toFixed(2)}`)
  console.log(`months        ${(r.monthsPositivePct * 100).toFixed(0)}% positive   worst ${r.worstMonth[0]} ${pctf(r.worstMonth[1])}   best ${r.bestMonth[0]} ${pctf(r.bestMonth[1])}   worst day ${pctf(r.worstDay)}`)
  console.log(`LP            in-range ${(r.inRangePct * 100).toFixed(0)}%   fees ${usd(r.fees)}   funding ${usd(r.funding)}   stableYield ${usd(r.stableYield)}   costs ${usd(-r.costs)}`)
  console.log(`delta         avg |net| ${pctf(r.avgNetDelta)} of NAV   max |net| ${pctf(r.maxNetDelta)}`)
  console.log(`events        rebalances ${r.events.rebalances}   LP reopens ${r.events.lpReopens}   hedge resizes ${r.events.hedgeResizes}   hedge LIQ ${r.events.hedgeLiq}   hedge stop ${r.events.hedgeStop}   kicker LIQ ${r.events.kickerLiq}   kicker opens ${r.events.kickerOpens}   LP→stable ${r.events.lpExitStable}`)
  console.log(`vs HODL       strategy CAGR ${pctf(r.cagr)}  vs  HODL CAGR ${pctf(ref.hodl.cagr)}   |   maxDD ${pctf(r.maxDD)} vs ${pctf(ref.hodl.maxDD)}`)
}

function printCompare(rows, ref) {
  console.log(`\n${'═'.repeat(112)}`)
  console.log(`COMPARE — ${ASSET}  $${CAPITAL}  ${new Date(candles[WARMUP].t).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].t).toISOString().slice(0, 10)}   (HODL ${ASSET}: total ${pctf(ref.hodl.totalRet)}, maxDD ${pctf(ref.hodl.maxDD)})`)
  console.log(`${'═'.repeat(112)}`)
  console.log(`preset          | total   | CAGR   | maxDD  | annVol | Sharpe | mo+   | worstMo | fees   | fund   | costs  | hLIQ | kLIQ | inRng | max|Δ|`)
  console.log(`${'-'.repeat(112)}`)
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(15)} | ${pctf(r.totalRet).padStart(7)} | ${pctf(r.cagr).padStart(6)} | ${pctf(r.maxDD).padStart(6)} | ${pctf(r.annVol).padStart(6)} | ${r.sharpe.toFixed(2).padStart(6)} | ${(r.monthsPositivePct * 100).toFixed(0).padStart(3)}% | ${pctf(r.worstMonth[1]).padStart(7)} | ${r.fees.toFixed(1).padStart(6)} | ${r.funding.toFixed(1).padStart(6)} | ${r.costs.toFixed(1).padStart(6)} | ${String(r.events.hedgeLiq).padStart(4)} | ${String(r.events.kickerLiq).padStart(4)} | ${(r.inRangePct * 100).toFixed(0).padStart(4)}% | ${pctf(r.maxNetDelta).padStart(6)}`
    )
  }
  console.log(`${'-'.repeat(112)}`)
  console.log(`HODL ${ASSET.padEnd(10)} | ${pctf(ref.hodl.totalRet).padStart(7)} | ${pctf(ref.hodl.cagr).padStart(6)} | ${pctf(ref.hodl.maxDD).padStart(6)} |    -   | ${ref.hodl.sharpe.toFixed(2).padStart(6)} |   -  |    -    |    -   |    -   |    -   |    - |    - |   -   |    -`)
}

function writeHtml(rows, ref, runId) {
  const series = [
    { name: `HODL ${ASSET}`, color: '#888', data: ref.hodl.equity.map(p => [p.t, p.nav]) },
    ...rows.map((r, i) => ({ name: r.name, color: ['#2ecc71', '#3498db', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c'][i % 6], data: r.equity.slice(WARMUP).map(p => [p.t, p.nav]) })),
  ]
  const html = `<!doctype html><meta charset=utf8><title>LP sim ${ASSET} ${runId}</title>
<style>body{font:13px system-ui;background:#0d1117;color:#c9d1d9;margin:0;padding:24px}h1{font-size:16px}canvas{background:#161b22;border:1px solid #30363d;border-radius:8px}.leg{display:inline-block;margin:4px 12px 4px 0}</style>
<h1>LP + hedge + trend-kicker — ${ASSET}, $${CAPITAL}, ${new Date(candles[WARMUP].t).toISOString().slice(0,10)} → ${new Date(candles.at(-1).t).toISOString().slice(0,10)}</h1>
<div id=legend></div><canvas id=c width=1400 height=560></canvas>
<script>
const S=${JSON.stringify(series)};
const cv=document.getElementById('c'),x=cv.getContext('2d'),W=cv.width,H=cv.height,PAD=54;
const all=S.flatMap(s=>s.data);const t0=Math.min(...all.map(d=>d[0])),t1=Math.max(...all.map(d=>d[0]));
const v0=0,v1=Math.max(...all.map(d=>d[1]))*1.08;
const X=t=>PAD+(t-t0)/(t1-t0)*(W-PAD*1.5), Y=v=>H-PAD-(v-v0)/(v1-v0)*(H-PAD*1.6);
x.strokeStyle='#30363d';x.fillStyle='#8b949e';x.font='11px system-ui';
for(let k=0;k<=5;k++){const v=v0+(v1-v0)*k/5;x.beginPath();x.moveTo(PAD,Y(v));x.lineTo(W-PAD/2,Y(v));x.stroke();x.fillText('$'+v.toFixed(0),6,Y(v)+3);}
for(let k=0;k<=6;k++){const t=t0+(t1-t0)*k/6;x.fillText(new Date(t).toISOString().slice(0,7),X(t)-18,H-PAD+16);}
for(const s of S){x.strokeStyle=s.color;x.lineWidth=s.name.startsWith('HODL')?1:1.8;x.beginPath();s.data.forEach((d,i)=>{const px=X(d[0]),py=Y(d[1]);i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();}
document.getElementById('legend').innerHTML=S.map(s=>'<span class=leg><b style="color:'+s.color+'">■</b> '+s.name+'</span>').join('');
</script>`
  const out = path.join(ROOT, 'reports/sim', `equity-${ASSET}-${runId}.html`)
  fs.writeFileSync(out, html)
  return out
}

// ── main ─────────────────────────────────────────────────────────────────────────
const ref = reference()
const runId = `${(FROM || 'all')}_${(TO || 'now')}`.replace(/[^0-9a-z_]/gi, '')
let rows = []

if (has('--compare')) {
  for (const [name, cfg] of Object.entries(PRESETS)) rows.push(run({ ...cfg, __name: name }))
  printCompare(rows, ref)
} else {
  const name = val('--preset', 'trend-flex')
  if (!PRESETS[name]) { console.error(`unknown preset ${name}. options: ${Object.keys(PRESETS).join(', ')}`); process.exit(1) }
  const r = run({ ...PRESETS[name], __name: name })
  rows = [r]
  printOne(r, ref)

  // per-year: strategy vs HODL
  const yr = {}, yrH = {}
  for (const p of r.equity.slice(WARMUP)) { const k = new Date(p.t).getUTCFullYear(); (yr[k] ||= []).push(p.nav) }
  for (const p of ref.hodl.equity) { const k = new Date(p.t).getUTCFullYear(); (yrH[k] ||= []).push(p.nav) }
  console.log(`\nyear   | strategy | HODL ${ASSET}  | regime`)
  for (const k of Object.keys(yr)) {
    const s = yr[k].at(-1) / yr[k][0] - 1, h = yrH[k] ? yrH[k].at(-1) / yrH[k][0] - 1 : 0
    const reg = h > 0.4 ? 'strong bull' : h > 0.1 ? 'bull' : h < -0.4 ? 'strong bear' : h < -0.1 ? 'bear' : 'chop'
    console.log(`  ${k} | ${pctf(s).padStart(7)} | ${pctf(h).padStart(8)} | ${reg}`)
  }

  // monthly strip
  console.log(`\nmonthly returns:`)
  const mo = {}
  for (const p of r.equity.slice(WARMUP)) { const k = new Date(p.t).toISOString().slice(0, 7); (mo[k] ||= []).push(p.nav) }
  const line = Object.entries(mo).map(([k, v]) => `${k.slice(2)} ${pctf(v.at(-1) / v[0] - 1, 0).padStart(5)}`)
  for (let i = 0; i < line.length; i += 6) console.log('  ' + line.slice(i, i + 6).join('   '))
}

if (WRITE_HTML) console.log(`\nchart  → ${path.relative(process.cwd(), writeHtml(rows, ref, runId))}`)
if (WRITE_JSON) {
  const out = path.join(ROOT, 'reports/sim', `result-${ASSET}-${runId}.json`)
  fs.writeFileSync(out, JSON.stringify({ asset: ASSET, capital: CAPITAL, from: FROM, to: TO, hodl: { totalRet: ref.hodl.totalRet, cagr: ref.hodl.cagr, maxDD: ref.hodl.maxDD }, results: rows.map(r => ({ ...r, equity: undefined })) }, null, 2))
  console.log(`json   → ${path.relative(process.cwd(), out)}`)
}
console.log()
