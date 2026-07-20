#!/usr/bin/env node
/**
 * lp-noswap-backtest.js — path-based A/B backtest for the no-swap rebalancing decision (DEC-009).
 *
 * The Phase-0 lp-sim.js answers "is the hedged position +EV at a terminal price?".
 * This answers the DIFFERENT question the council/pre-mortem raised:
 *   "Does NO-SWAP single-sided rebalancing beat the current go-flat-on-kill baseline,
 *    net of fees+funding−IL−hedge drift−gas, across a RANGING vs a TRENDING path?"
 *
 * It walks an hourly price path and simulates four strategies on the live WETH/USDC
 * position (range $1590.87–$1943.07, entry $1770.62, static 0.0106 ETH short, liq $2082):
 *   HODL          — hold the entry composition, no LP, no hedge (the "better off holding?" floor)
 *   BASELINE      — static-range LP + static short; hold through OOR (alert only), KILL on
 *                   ETH<$1511 / hedge mark>=$2019.5 (DEC-008 policy). The current strategy.
 *   NOSWAP_STATIC — on OOR, redeploy single-sided adjacent (no swap) but KEEP the static short.
 *                   Models the naive version → exposes silent de-hedging (pre-mortem failure #1).
 *   NOSWAP_REHEDGE— same redeploy, but resize the short to the new LP delta each time.
 *                   Models the Steelman's "reconciled" version → exposes churn + funding/margin cost.
 *
 * Key metrics: net result $/%, fees, funding, gas/perp cost, realized+unrealized hedge PnL,
 * #redeploys, #rehedges, #kills, MAX |net delta| excursion (the de-hedging tail), in-range %.
 *
 * Usage:
 *   node scripts/lp-noswap-backtest.js                      # all synthetic paths + real ETH path
 *   node scripts/lp-noswap-backtest.js --fee-apr 80         # sensitivity on fee APR
 *   node scripts/lp-noswap-backtest.js --capital 5000 --horizon 90 --no-real
 *   node scripts/lp-noswap-backtest.js --json out.json      # also dump machine-readable results
 *
 * Not a forecast. A structural A/B across regimes. Zero capital, zero on-chain. (DEC-009 follow-up a.)
 */
import fs from 'fs'

const args = process.argv.slice(2)
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? parseFloat(args[i + 1]) : d }
const has = (f) => args.includes(f)
const str = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d }

// ─── Position params (live WETH/USDC, state/lp-positions.json) ──────────────────────
const A0       = num('--lower', 1590.87)   // original range lower (USDC/WETH)
const B0       = num('--upper', 1943.07)   // original range upper
const P0       = num('--entry', 1770.62)   // entry / start price
const CAPITAL  = num('--capital', 40.28)   // USD deployed in LP
const HEDGE0   = num('--hedge', 0.0106)    // static ETH short size
const LIQ_PX   = num('--liq', 2082)        // hedge liquidation price
const FEE_APR  = num('--fee-apr', 60) / 100      // realized in-range fee APR (sensitivity knob)
const FUND_APR = num('--funding-apr', 1) / 100   // funding RECEIVED on the short (live +0.6–1.3%)
const HORIZON_D= num('--horizon', 90)            // days
const STEP_H   = num('--step', 1)                // hours per step
const GAS_ACT  = num('--gas', 0.05)              // Base gas per redeploy (withdraw+mint), USD
const PERP_FEE = num('--perp-fee', 0.0005)       // taker fee+slippage per perp resize, frac of notional
const KILL_LO  = num('--kill-lo', 1511)          // DEC-008 distance kill (5% beyond lower band)
const HEDGE_KILL = LIQ_PX * 0.97                 // hedge within 3% of liq → KILL ($2019.5)
const WIDTH_R  = num('--width', B0 / A0)         // redeploy single-sided width ratio (default = orig range ratio)
const DO_REAL  = !has('--no-real')
const SEED     = num('--seed', 42)
const JSON_OUT = str('--json', null)

const YEAR_H = 365 * 24
const dtYr = STEP_H / YEAR_H
const STEPS = Math.floor(HORIZON_D * 24 / STEP_H)

// ─── seeded RNG (mulberry32) + standard normal (Box–Muller) ─────────────────────────
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(rng){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

// ─── CL math: holdings of a position [a,b] with liquidity L at price P ──────────────
function lpAt(P, L, a, b){
  const sp=Math.sqrt(P), sa=Math.sqrt(a), sb=Math.sqrt(b)
  let weth, usdc
  if (sp<=sa){ weth=L*(sb-sa)/(sa*sb); usdc=0 }
  else if (sp>=sb){ weth=0; usdc=L*(sb-sa) }
  else { weth=L*(sb-sp)/(sp*sb); usdc=L*(sp-sa) }
  return { weth, usdc, value: weth*P+usdc }
}
const Lfor = (cap, P, a, b) => cap / lpAt(P, 1, a, b).value          // L so value(P)=cap (two-sided)
// single-sided L from one asset at a boundary:
const LfromWeth = (W, a, b) => { const sa=Math.sqrt(a), sb=Math.sqrt(b); return W*sa*sb/(sb-sa) }  // price at lower bound
const LfromUsdc = (U, a, b) => { const sa=Math.sqrt(a), sb=Math.sqrt(b); return U/(sb-sa) }          // price at upper bound

// ─── price paths (returns an array of length STEPS+1, starting at P0) ────────────────
function pathOU(seed, theta, sigma){ // mean-reverting around P0 (ranging)
  const rng=mulberry32(seed); const p=[P0]; let x=Math.log(P0); const mu=Math.log(P0)
  for(let i=0;i<STEPS;i++){ x += theta*(mu-x)*STEP_H + sigma*Math.sqrt(STEP_H)*gauss(rng); p.push(Math.exp(x)) }
  return p
}
function pathTrend(seed, totalRet, sigma){ // drift to P0*(1+totalRet) with noise
  const rng=mulberry32(seed); const p=[P0]; let x=Math.log(P0)
  const drift=Math.log(1+totalRet)/STEPS
  for(let i=0;i<STEPS;i++){ x += drift + sigma*Math.sqrt(STEP_H)*gauss(rng); p.push(Math.exp(x)) }
  return p
}
async function pathReal(){ // real ETH 90d hourly returns rescaled onto P0 (preserve returns, not levels)
  try{
    const days = Math.max(1, Math.min(90, HORIZON_D))
    const url=`https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${days}&interval=hourly`
    const r=await fetch(url,{headers:{'accept':'application/json'}})
    if(!r.ok) throw new Error('HTTP '+r.status)
    const j=await r.json(); const px=(j.prices||[]).map(x=>x[1]).filter(Boolean)
    if(px.length<24) throw new Error('too few points ('+px.length+')')
    const p=[P0]; for(let i=1;i<px.length;i++){ p.push(p[i-1]*(px[i]/px[i-1])) }
    return { name:`REAL ETH ${days}d (rescaled→$${P0})`, p }
  }catch(e){ return { name:null, err:String(e.message||e) } }
}

// ─── simulator ──────────────────────────────────────────────────────────────────────
// strategy ∈ 'HODL' | 'BASELINE' | 'NOSWAP_STATIC' | 'NOSWAP_REHEDGE'
function simulate(path, strategy){
  const L0 = Lfor(CAPITAL, P0, A0, B0)
  const e0 = lpAt(P0, L0, A0, B0)
  const entryWeth=e0.weth, entryUsdc=e0.usdc

  // LP state
  let a=A0, b=B0, L=L0, lpOpen=true
  // idle holdings after a kill (held, marked to market, no more fees/hedge)
  let idleWeth=0, idleUsdc=0
  // hedge state
  let shortSize=(strategy==='HODL')?0:HEDGE0, shortEntry=P0, hedgeOpen=(strategy!=='HODL')
  let realizedHedge=0
  // accumulators
  let fees=0, funding=0, gas=0, perpCost=0
  let redeploys=0, rehedges=0, kills=0, inRangeSteps=0, maxNetDeltaUsd=0

  // ── HODL: hold the entry composition, no LP, no fees, no hedge ──
  if(strategy==='HODL'){
    const Pf=path[path.length-1]
    const net=(entryWeth*Pf+entryUsdc)-CAPITAL
    return { strategy, net, netPct:net/CAPITAL, fees:0, funding:0, gas:0, perpCost:0, hedgePnl:0,
             redeploys:0, rehedges:0, kills:0, inRangePct:0, maxNetDeltaUsd:0,
             lpVal:0, idleVal:entryWeth*Pf+entryUsdc, terminal:entryWeth*Pf+entryUsdc, hodlNet:net, finalPx:Pf }
  }

  const closeHedge=(P)=>{ if(hedgeOpen){ realizedHedge += shortSize*(shortEntry-P); shortSize=0; hedgeOpen=false } }
  const resizeHedge=(P,target)=>{ // realize PnL on delta, set to target at price P
    if(target<0)target=0
    // realize on full book then re-enter at P (simple avg-reset; fee on |traded notional|)
    realizedHedge += shortSize*(shortEntry-P)
    const traded=Math.abs(target-shortSize)
    perpCost += traded*P*PERP_FEE
    shortSize=target; shortEntry=P; hedgeOpen=target>0; rehedges++
  }

  for(let i=1;i<path.length;i++){
    const P=path[i]
    // ── income while LP open ──
    if(lpOpen){
      const inRange = P>a && P<b
      if(inRange){ const v=lpAt(P,L,a,b).value; fees += FEE_APR*v*dtYr; inRangeSteps++ }
    }
    if(hedgeOpen){ funding += FUND_APR*(shortSize*P)*dtYr }

    // ── net-delta excursion (de-hedging risk) ──
    if(strategy!=='HODL'){
      const lpW = lpOpen ? lpAt(P,L,a,b).weth : 0
      const netDeltaUsd = Math.abs((lpW + idleWeth) - shortSize) * P
      if(netDeltaUsd>maxNetDeltaUsd) maxNetDeltaUsd=netDeltaUsd
    }

    if(strategy==='HODL') continue

    // ── KILL check (same floor for all active strategies) ──
    const hedgeMark=P
    if(lpOpen && (P<=KILL_LO || hedgeMark>=HEDGE_KILL)){
      const h=lpAt(P,L,a,b); idleWeth+=h.weth; idleUsdc+=h.usdc; lpOpen=false
      closeHedge(P); kills++
      continue
    }

    if(strategy==='BASELINE') continue  // hold through OOR (alert only), no redeploy

    // ── NO-SWAP redeploy on OOR ──
    if(lpOpen && (P<=a || P>=b)){
      const h=lpAt(P,L,a,b)            // single-asset holdings at OOR
      gas+=GAS_ACT; redeploys++
      if(P<=a){ // down-move → 100% WETH → mint sell-side range [P, P*r]
        const na=P, nb=P*WIDTH_R; L=LfromWeth(h.weth, na, nb); a=na; b=nb
      } else {  // up-move → 100% USDC → mint buy-side range [P/r, P]
        const na=P/WIDTH_R, nb=P; L=LfromUsdc(h.usdc, na, nb); a=na; b=nb
      }
      if(strategy==='NOSWAP_REHEDGE'){ const w=lpAt(P,L,a,b).weth; resizeHedge(P, w) }
      // NOSWAP_STATIC: keep static short (do nothing) → de-hedging shows up in maxNetDelta
    }
  }

  // ── terminal mark ──
  const Pf=path[path.length-1]
  const lpVal = lpOpen ? lpAt(Pf,L,a,b).value : 0
  const idleVal = idleWeth*Pf + idleUsdc
  const unrealHedge = hedgeOpen ? shortSize*(shortEntry-Pf) : 0
  const hedgePnl = realizedHedge + unrealHedge
  const terminal = lpVal + idleVal + fees + funding - gas - perpCost + hedgePnl
  const net = terminal - CAPITAL
  const hodlVal = entryWeth*Pf + entryUsdc

  return {
    strategy, net, netPct: net/CAPITAL,
    fees, funding, gas, perpCost, hedgePnl,
    redeploys, rehedges, kills,
    inRangePct: inRangeSteps/STEPS,
    maxNetDeltaUsd,
    lpVal, idleVal, terminal, hodlNet: hodlVal-CAPITAL, finalPx: Pf
  }
}

// ─── run ────────────────────────────────────────────────────────────────────────────
const STR=['HODL','BASELINE','NOSWAP_STATIC','NOSWAP_REHEDGE']
const f=(n,d=2)=>(n>=0?'+':'')+n.toFixed(d)
const pc=(n)=>(n>=0?'+':'')+(n*100).toFixed(1)+'%'

const paths=[
  { name:'RANGING (mean-revert, stays mostly in band)', p:pathOU(SEED, 0.02, 0.010) },
  { name:'TREND DOWN −30% (sustained, low-vol grind)',  p:pathTrend(SEED+1, -0.30, 0.0015) },
  { name:'TREND UP +30% (sustained, low-vol grind)',    p:pathTrend(SEED+2, +0.30, 0.0015) },
  { name:'CHOP (high-vol, repeatedly crosses bands)',   p:pathOU(SEED+3, 0.01, 0.022) },
]
if(DO_REAL){ const r=await pathReal(); if(r.name) paths.push({name:r.name,p:r.p}); else console.log(`(real ETH path skipped: ${r.err})`) }

console.log(`\n${'═'.repeat(96)}`)
console.log(`NO-SWAP REBALANCING BACKTEST — WETH/USDC  range $${A0}–$${B0}  entry $${P0}  capital $${CAPITAL}`)
console.log(`static short ${HEDGE0} ETH (liq $${LIQ_PX})  |  fee APR ${(FEE_APR*100).toFixed(0)}%  funding ${(FUND_APR*100).toFixed(1)}%  |  ${HORIZON_D}d @ ${STEP_H}h  |  KILL: ETH<$${KILL_LO} or mark>=$${HEDGE_KILL.toFixed(0)}`)
console.log(`${'═'.repeat(96)}`)

const all={}
for(const path of paths){
  const span=[Math.min(...path.p),Math.max(...path.p)]
  console.log(`\n■ ${path.name}`)
  console.log(`  price span $${span[0].toFixed(0)}–$${span[1].toFixed(0)}, end $${path.p[path.p.length-1].toFixed(0)}`)
  console.log(`  strategy        | net $ (%)        | fees  | fund  | gas+perp | hedgePnl | redep | rehedge | kills | inRange | MAX|netΔ|`)
  console.log(`  ----------------|------------------|-------|-------|----------|----------|-------|---------|-------|---------|----------`)
  all[path.name]={}
  for(const s of STR){
    const r=simulate(path.p, s); all[path.name][s]=r
    console.log(
      `  ${s.padEnd(15)} | $${f(r.net).padStart(7)} (${pc(r.netPct).padStart(7)}) | ${r.fees.toFixed(2).padStart(5)} | ${r.funding.toFixed(2).padStart(5)} | ${(r.gas+r.perpCost).toFixed(2).padStart(8)} | ${f(r.hedgePnl).padStart(8)} | ${String(r.redeploys).padStart(5)} | ${String(r.rehedges).padStart(7)} | ${String(r.kills).padStart(5)} | ${(r.inRangePct*100).toFixed(0).padStart(6)}% | $${r.maxNetDeltaUsd.toFixed(2).padStart(7)}`
    )
  }
  const base=all[path.name]['BASELINE'].net
  const ns=all[path.name]['NOSWAP_REHEDGE'].net
  const nss=all[path.name]['NOSWAP_STATIC'].net
  console.log(`  → no-swap(rehedge) vs baseline: ${f(ns-base)} | no-swap(static) vs baseline: ${f(nss-base)} | HODL net: ${f(all[path.name]['HODL'].net)}`)
}

// ── verdict ──
console.log(`\n${'═'.repeat(96)}\nVERDICT (no-swap minus baseline, $; >0 means no-swap wins that path)\n${'═'.repeat(96)}`)
let nsRehWins=0, nsStatWins=0, n=0, worstDeHedge=0
console.log(`  path                                          | rehedge−base | static−base | static MAX|netΔ|`)
for(const path of paths){
  const a=all[path.name]; const b=a['BASELINE'].net
  const dR=a['NOSWAP_REHEDGE'].net-b, dS=a['NOSWAP_STATIC'].net-b
  if(dR>0)nsRehWins++; if(dS>0)nsStatWins++; n++
  worstDeHedge=Math.max(worstDeHedge, a['NOSWAP_STATIC'].maxNetDeltaUsd)
  console.log(`  ${path.name.slice(0,44).padEnd(44)} | ${f(dR).padStart(12)} | ${f(dS).padStart(11)} | $${a['NOSWAP_STATIC'].maxNetDeltaUsd.toFixed(2)}`)
}
console.log(`\n  no-swap(rehedge) beat baseline on ${nsRehWins}/${n} paths; no-swap(static) on ${nsStatWins}/${n}.`)
console.log(`  worst static-hedge net-delta excursion (de-hedging tail): $${worstDeHedge.toFixed(2)} on a $${CAPITAL} position (${(worstDeHedge/CAPITAL*100).toFixed(0)}% of capital naked).`)
console.log(`  Note: net result is dominated by IL+hedge interaction, NOT the swap cost no-swap saves. Scale fee APR (--fee-apr) to test sensitivity.\n`)

if(JSON_OUT){ fs.writeFileSync(JSON_OUT, JSON.stringify({params:{A0,B0,P0,CAPITAL,HEDGE0,FEE_APR,FUND_APR,HORIZON_D,STEP_H,WIDTH_R},results:all},null,2)); console.log(`wrote ${JSON_OUT}\n`) }
