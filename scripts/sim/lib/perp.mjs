/**
 * perp.mjs — isolated-margin perpetual leg (Hyperliquid-style).
 *
 * A leg = { side, notional0, entry, lev, margin, mmr } where
 *   side     = -1 short | +1 long
 *   notional0 = USD notional at entry (|size| * entry)
 *   margin   = notional0 / lev  (isolated, posted once)
 *   mmr      = maintenance-margin rate (fraction of notional). HL ETH ~0.5%..2%.
 *
 * All helpers are pure. The engine owns realize/resize bookkeeping.
 */

export function openLeg(side, notionalUsd, entry, lev, mmr = 0.006) {
  return { side, notional0: notionalUsd, entry, lev, margin: notionalUsd / lev, mmr, size: notionalUsd / entry }
}

/** Unrealised PnL at price P. */
export function uPnl(leg, P) {
  return leg.side * leg.size * (P - leg.entry)
}

/** Account equity of the isolated leg at P (margin + uPnL). */
export function equity(leg, P) {
  return leg.margin + uPnl(leg, P)
}

/** Liquidation price. Short: above entry. Long: below entry. */
export function liqPrice(leg) {
  // liquidation when equity <= notional0 * mmr  =>  margin + side*size*(Pliq-entry) = notional0*mmr
  const move = (leg.margin - leg.notional0 * leg.mmr) / leg.size
  return leg.side === -1 ? leg.entry + move : leg.entry - move
}

/** Distance to liquidation as a fraction of entry (always positive). */
export function liqDistFrac(leg) {
  return Math.abs(liqPrice(leg) / leg.entry - 1)
}

/**
 * Leverage that puts liquidation exactly at target price `pLiq` for a leg entered
 * at `entry`. Inverse of liqPrice(). Useful for "match the kicker's liq to the LP lower band".
 */
export function levForLiq(side, entry, pLiq, mmr = 0.006) {
  // |pLiq/entry - 1| = 1/lev - mmr   =>   lev = 1 / (dist + mmr)
  const dist = Math.abs(pLiq / entry - 1)
  return 1 / (dist + mmr)
}

/**
 * Did the leg get liquidated during a candle? Shorts die on the HIGH, longs on the LOW.
 * Returns { hit:boolean, pnl } where pnl on a hit is -margin (full loss).
 */
export function checkLiq(leg, candle) {
  const lp = liqPrice(leg)
  const hit = leg.side === -1 ? candle.h >= lp : candle.l <= lp
  return { hit, at: lp, pnl: hit ? -leg.margin : 0 }
}

/**
 * Exchange-native stop bracket. If `stopPx` is crossed intrabar, the leg closes
 * at stopPx for a *controlled* loss (not full margin). Shorts stop on the HIGH,
 * longs on the LOW. Returns { hit, pnl } (pnl realised at stopPx).
 */
export function checkStop(leg, candle, stopPx) {
  if (!stopPx) return { hit: false, pnl: 0 }
  const hit = leg.side === -1 ? candle.h >= stopPx : candle.l <= stopPx
  return { hit, at: stopPx, pnl: hit ? leg.side * leg.size * (stopPx - leg.entry) : 0 }
}

/** Funding accrued over dt years on the current notional. Positive `annRate` => shorts receive. */
export function funding(leg, P, annRate, dtYears) {
  const notionalNow = leg.size * P
  return -leg.side * annRate * notionalNow * dtYears // short (side -1) with annRate>0 => +income
}

// ── self-test ────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const approx = (x, y, t = 1e-3) => Math.abs(x - y) < t
  let ok = true
  const chk = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); ok = ok && c }

  // 10x short at 2500, mmr 0 => liq ~ +10%
  const s = openLeg(-1, 1000, 2500, 10, 0)
  chk('10x short liq ~ +10%', approx(liqPrice(s), 2750, 1))
  chk('short uPnL negative when price up', uPnl(s, 2600) < 0)
  chk('short liq dist ~0.10', approx(liqDistFrac(s), 0.10, 1e-3))

  // 25x long at 2500 => liq ~ -4%
  const l = openLeg(+1, 1000, 2500, 25, 0)
  chk('25x long liq ~ -4%', approx(liqPrice(l), 2400, 1))

  // levForLiq inverse check: want long liq at 2250 from 2500 => dist .10 => ~10x
  chk('levForLiq long@2250 ~10x', approx(levForLiq(+1, 2500, 2250, 0), 10, 1e-6))
  const l2 = openLeg(+1, 600, 2500, levForLiq(+1, 2500, 2250, 0), 0)
  chk('constructed long liq == 2250', approx(liqPrice(l2), 2250, 1))

  // candle liquidation: short dies on a wick high even if close is calm
  chk('short liquidated by wick', checkLiq(s, { o: 2500, h: 2760, l: 2490, c: 2505 }).hit)
  chk('short survives calm day', !checkLiq(s, { o: 2500, h: 2700, l: 2450, c: 2480 }).hit)

  // stop bracket: controlled loss, smaller than full margin
  const st = checkStop(s, { o: 2500, h: 2760, l: 2490, c: 2505 }, 2680)
  chk('stop hit', st.hit)
  chk('stop loss < full margin', Math.abs(st.pnl) < s.margin)

  // funding: short receives when annRate > 0
  chk('short earns funding', funding(s, 2500, 0.05, 1 / 365) > 0)

  console.log(ok ? '\nALL PASS' : '\nFAILURES')
  process.exit(ok ? 0 : 1)
}
