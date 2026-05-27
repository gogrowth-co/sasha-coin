#!/usr/bin/env node
/**
 * lp-sim.js — Phase 0 EV simulator (the missing deliverable from the execution spec §4 Phase 0).
 *
 * Answers the only question that matters: is the position +EV, and does the hedge
 * turn a directional bet into a low-variance carry? Computes, for a set of terminal
 * price scenarios, the LP value (CL math), impermanent loss, fee + AERO income,
 * Hyperliquid funding income, and the hedge PnL — then nets it HEDGED vs UNHEDGED.
 *
 * Not a forecast. A structural EV decomposition at given parameters. Change the
 * params, change the verdict — that's the point (sensitivity, not prophecy).
 *
 * Usage:
 *   node scripts/lp-sim.js                         # live cbBTC position, default params
 *   node scripts/lp-sim.js --capital 1000          # scale capital
 *   node scripts/lp-sim.js --fee-apr 35 --aero-apr 7 --funding-apr 1 --horizon 30
 *
 * Sasha Coin — Liquidity Miner / Phase 0 (built late, deliberately)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? parseFloat(args[i + 1]) : d }

// ─── Position params (defaults grounded in the live USDC/cbBTC position) ──────────
const A = num('--lower', 65000)         // range lower (USD/BTC)
const B = num('--upper', 88000)         // range upper
const P0 = num('--entry', 74672)        // entry / current mid price
const CAPITAL = num('--capital', 45)    // USD deployed
const FEE_APR = num('--fee-apr', 35) / 100      // realized fee APR (live: ~$0.044/day on $45 ≈ 35%)
const AERO_APR = num('--aero-apr', 7) / 100     // gauge AERO emissions APR (spec: 6.7–10%)
const FUNDING_APR = num('--funding-apr', 1) / 100 // HL funding we RECEIVE on the short (live +0.6–1.3%)
const HORIZON_D = num('--horizon', 30)          // days
const GAS_PER_REBAL = num('--gas', 0.05)        // Base gas per rebalance/harvest (USD)
const EXPECTED_REBALS = num('--rebals', 4)      // rebalances+harvests over horizon

// ─── CL math: token amounts at a price P for a position with the given range ──────
// Returns { btc, usd, value } — the LP's holdings at price P, normalized so value(P0)=CAPITAL.
function lpAt(P, L) {
  const sp = Math.sqrt(P), sa = Math.sqrt(A), sb = Math.sqrt(B)
  let btc, usd
  if (sp <= sa) { btc = L * (sb - sa) / (sa * sb); usd = 0 }
  else if (sp >= sb) { btc = 0; usd = L * (sb - sa) }
  else { btc = L * (sb - sp) / (sp * sb); usd = L * (sp - sa) }
  return { btc, usd, value: btc * P + usd }
}
// Solve L so the position is worth CAPITAL at P0
const L = (() => { const u = lpAt(P0, 1); return CAPITAL / u.value })()
const entry = lpAt(P0, L)            // entry holdings
const hedge0 = entry.btc             // delta-neutral short size at open = BTC in LP at entry

// "Hold" benchmark: keep the entry token split, don't provide liquidity
function holdValue(P) { return entry.btc * P + entry.usd }

const fmt = (n, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d)
const pct = (n) => (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'

// ─── income over horizon (direction-independent) ──────────────────────────────────
const t = HORIZON_D / 365
const feeIncome = FEE_APR * CAPITAL * t
const aeroIncome = AERO_APR * CAPITAL * t
const fundingIncome = FUNDING_APR * (hedge0 * P0) * t   // funding on the short notional
const gasCost = GAS_PER_REBAL * EXPECTED_REBALS

// ─── scenarios ─────────────────────────────────────────────────────────────────
const scenarios = [
  { name: 'BTC -50%', P: P0 * 0.5 },
  { name: 'BTC -25%', P: P0 * 0.75 },
  { name: 'BTC -10%', P: P0 * 0.9 },
  { name: 'flat',     P: P0 },
  { name: 'BTC +10%', P: P0 * 1.1 },
  { name: 'BTC +25%', P: P0 * 1.25 },
  { name: 'BTC +50%', P: P0 * 1.5 },
]

console.log(`\nLP EV SIMULATION — USDC/cbBTC  |  range $${A/1000}k–$${B/1000}k  |  entry $${P0}`)
console.log(`Capital $${CAPITAL}  |  entry split: ${entry.btc.toFixed(8)} BTC ($${(entry.btc*P0).toFixed(2)}) + $${entry.usd.toFixed(2)} USDC`)
console.log(`Delta-neutral hedge at open: short ${hedge0.toFixed(8)} BTC ($${(hedge0*P0).toFixed(2)})`)
console.log(`Horizon ${HORIZON_D}d  |  fee ${(FEE_APR*100).toFixed(0)}% + AERO ${(AERO_APR*100).toFixed(0)}% + funding ${(FUNDING_APR*100).toFixed(1)}% APR`)
console.log(`Income over horizon: fees $${feeIncome.toFixed(3)} + AERO $${aeroIncome.toFixed(3)} + funding $${fundingIncome.toFixed(3)} − gas $${gasCost.toFixed(2)}`)
console.log('\nScenario   | LP value | IL (vs hold) | UNHEDGED net | hedge PnL | HEDGED net (rehedged≈fees+fund−gas)')
console.log('-----------|----------|--------------|--------------|-----------|------------------------------------')

let hedgedMin = Infinity, unhedgedMin = Infinity, hedgedVals = [], unhedgedVals = []
for (const s of scenarios) {
  const lp = lpAt(s.P, L)
  const il = lp.value - holdValue(s.P)                 // impermanent loss (negative)
  const income = feeIncome + aeroIncome - gasCost
  // UNHEDGED: you carry the full LP directional move + IL + fees
  const unhedged = (lp.value - CAPITAL) + feeIncome + aeroIncome - gasCost
  // STATIC hedge marked at P1 (short hedge0 BTC): gains when price falls
  const staticHedgePnl = hedge0 * (P0 - s.P)
  // HEDGED + continuously rehedged: directional PnL of (LP + short) ≈ cancels; residual = LVR ≈ |IL|
  // net ≈ fees + AERO + funding − gas − LVR_residual.  Use |IL| as a conservative LVR proxy.
  const lvrResidual = Math.min(0, il)                  // negative
  const hedgedRehedged = feeIncome + aeroIncome + fundingIncome - gasCost + lvrResidual
  hedgedVals.push(hedgedRehedged); unhedgedVals.push(unhedged)
  hedgedMin = Math.min(hedgedMin, hedgedRehedged); unhedgedMin = Math.min(unhedgedMin, unhedged)
  console.log(
    `${s.name.padEnd(10)} | $${lp.value.toFixed(2).padStart(6)} | ${pct(il/CAPITAL).padStart(7)} ($${fmt(il)}) | $${fmt(unhedged).padStart(7)} (${pct(unhedged/CAPITAL)}) | $${fmt(staticHedgePnl).padStart(6)} | $${fmt(hedgedRehedged)} (${pct(hedgedRehedged/CAPITAL)})`
  )
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) }
console.log('\n── verdict ──────────────────────────────────────────────────────────────')
console.log(`UNHEDGED: mean $${fmt(mean(unhedgedVals))}  std $${std(unhedgedVals).toFixed(2)}  worst $${fmt(unhedgedMin)}  → variance dominated by BTC direction`)
console.log(`HEDGED  : mean $${fmt(mean(hedgedVals))}  std $${std(hedgedVals).toFixed(2)}  worst $${fmt(hedgedMin)}  → carry: fees+AERO+funding−gas−LVR`)
const sharpe = std(hedgedVals) > 0 ? mean(hedgedVals) / std(hedgedVals) : Infinity
console.log(`Hedged return/variance ratio: ${sharpe.toFixed(2)}  |  hedged +EV across ALL scenarios: ${hedgedMin > 0 ? 'YES ✅' : 'NO ❌ (fees do not clear LVR+gas at these params)'}`)
console.log(`Break-even fee APR (hedged, flat-price): ${(((gasCost - aeroIncome - fundingIncome) / (CAPITAL * t)) * 100).toFixed(1)}%  (need fee APR above this to be +EV)\n`)
