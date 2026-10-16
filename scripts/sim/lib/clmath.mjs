/**
 * clmath.mjs — concentrated-liquidity (Uniswap v3 / Aerodrome Slipstream / Orca) position math.
 *
 * token0 = volatile asset (ETH, SOL), priced in token1 = USD stable.
 * A position is a range [a, b] (USD per token0) holding `L` units of liquidity.
 */

/** Holdings + USD value of a position [a,b] with liquidity L at price P. */
export function lpAt(P, L, a, b) {
  const sp = Math.sqrt(P), sa = Math.sqrt(a), sb = Math.sqrt(b)
  let tok, usd
  if (sp <= sa) { tok = L * (sb - sa) / (sa * sb); usd = 0 }
  else if (sp >= sb) { tok = 0; usd = L * (sb - sa) }
  else { tok = L * (sb - sp) / (sp * sb); usd = L * (sp - sa) }
  return { tok, usd, value: tok * P + usd }
}

/** Liquidity L such that a two-sided position [a,b] is worth `cap` USD at price P. */
export function Lfor(cap, P, a, b) {
  const u = lpAt(P, 1, a, b).value
  return cap / u
}

/**
 * Instantaneous USD delta of the position = USD value of the token0 currently held.
 * (dV/dP * P along the liquidity curve equals tok*P.)
 */
export function lpDeltaUsd(P, L, a, b) {
  return lpAt(P, L, a, b).tok * P
}

/**
 * Build a range around a center price.
 *  widthPct  = half-width as a fraction (0.12 => a = c*0.88, b = c*1.12)
 *  skew      = shift the center by skew*widthPct*P in the given direction (-1..+1)
 */
export function makeRange(P, widthPct, skew = 0, skewDir = 0) {
  const c = P * (1 + skew * widthPct * skewDir)
  return { a: c * (1 - widthPct), b: c * (1 + widthPct) }
}

/**
 * Cost of rebalancing from an old position to a fresh two-sided range at price P.
 * Recovered value is redeployed 50/50; the token that must be swapped to reach
 * 50/50 pays `swapBps` of its notional plus a flat `gas`.
 */
export function rebalanceCost(oldHoldings, P, newA, newB, { swapBps = 5, gas = 0.05 } = {}) {
  const recovered = oldHoldings.tok * P + oldHoldings.usd
  const target = lpAt(P, Lfor(recovered, P, newA, newB), newA, newB)
  const tokenUsdNow = oldHoldings.tok * P
  const swapNotional = Math.abs(target.tok * P - tokenUsdNow)
  return { recovered, swapNotional, cost: swapNotional * swapBps / 1e4 + gas, target }
}

/** L from a one-sided token0 holding at the lower boundary of [a,b] (price = a). */
export function LfromTok(tok, a, b) {
  const sa = Math.sqrt(a), sb = Math.sqrt(b)
  return tok * sa * sb / (sb - sa)
}
/** L from a one-sided USD holding at the upper boundary of [a,b] (price = b). */
export function LfromUsd(usd, a, b) {
  return usd / (Math.sqrt(b) - Math.sqrt(a))
}

// ── self-test ────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const approx = (x, y, t = 1e-6) => Math.abs(x - y) < t
  let ok = true
  const chk = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); ok = ok && cond }

  // log-centered range (geo mean = P) => exact 50/50 at entry
  const P = 100, a = P / 1.1, b = P * 1.1
  const L = Lfor(1000, P, a, b)
  chk('value==cap at entry', approx(lpAt(P, L, a, b).value, 1000, 1e-6))
  const e = lpAt(P, L, a, b)
  chk('entry 50/50 at geo center', approx(e.tok * P, e.usd, 1e-6))
  // below range => all token0, above => all USD
  chk('below range all token', lpAt(80, L, a, b).usd === 0 && lpAt(80, L, a, b).tok > 0)
  chk('above range all usd', lpAt(120, L, a, b).tok === 0 && lpAt(120, L, a, b).usd > 0)
  // delta drops as price rises through the range, hits 0 at top
  chk('delta decreasing', lpDeltaUsd(95, L, a, b) > lpDeltaUsd(105, L, a, b))
  chk('delta ~0 above', approx(lpDeltaUsd(115, L, a, b), 0, 1e-9))
  // IL: LP value below a hold of the entry composition after a big move
  const hold = e.tok * 130 + e.usd
  chk('LP < hold after +30%', lpAt(130, L, a, b).value < hold)
  // makeRange skew up puts more room above
  const r = makeRange(100, 0.1, 0.5, +1)
  chk('skew up raises center', (r.a + r.b) / 2 > 100)

  console.log(ok ? '\nALL PASS' : '\nFAILURES')
  process.exit(ok ? 0 : 1)
}
