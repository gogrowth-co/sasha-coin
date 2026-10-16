/**
 * indicators.mjs — trend + volatility classification off a daily close series.
 *
 * classify(closes, i, cfg) returns { trend, trendStrength, vol, rv, rvPct } for day i,
 * using ONLY data up to and including i (no lookahead).
 */

export function sma(arr, i, n) {
  if (i + 1 < n) return null
  let s = 0
  for (let k = i - n + 1; k <= i; k++) s += arr[k]
  return s / n
}

export function ema(closes, i, n) {
  // seed with SMA at the first full window, then recurse (bounded lookback for speed)
  if (i + 1 < n) return null
  const k = 2 / (n + 1)
  let e = null
  const start = Math.max(0, i - n * 5) // enough warmup
  for (let t = start; t <= i; t++) {
    if (t + 1 < n) continue
    if (e === null) e = sma(closes, t, n)
    else e = closes[t] * k + e * (1 - k)
  }
  return e
}

/** annualised realised vol from the last n daily log returns ending at i. */
export function realisedVol(closes, i, n) {
  if (i < n) return null
  const r = []
  for (let k = i - n + 1; k <= i; k++) r.push(Math.log(closes[k] / closes[k - 1]))
  const m = r.reduce((a, b) => a + b, 0) / r.length
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)
  return Math.sqrt(v) * Math.sqrt(365)
}

/** percentile rank (0..1) of x within the trailing window of `series` ending at i. */
export function pctRank(series, i, x, win) {
  const lo = Math.max(0, i - win + 1)
  let below = 0, count = 0
  for (let k = lo; k <= i; k++) {
    if (series[k] == null) continue
    count++
    if (series[k] <= x) below++
  }
  return count ? below / count : 0.5
}

export const DEFAULTS = {
  emaFast: 20,
  emaSlow: 60,
  trendBandPct: 0.015,   // fast must clear slow by this to call a direction
  slopeDays: 10,         // fast-EMA slope confirmation window
  rvWindow: 20,          // realised-vol lookback (days)
  rvRankWindow: 365,     // percentile window for the vol regime
  spikeAbsRet: 0.09,     // any 1-day |return| >= this => 'spiking' immediately
}

/**
 * Precompute EMA + realised-vol arrays once (cheap, avoids O(n^2) in the engine).
 */
export function precompute(closes, cfg = {}) {
  const c = { ...DEFAULTS, ...cfg }
  const n = closes.length
  const fast = new Array(n).fill(null)
  const slow = new Array(n).fill(null)
  const rv = new Array(n).fill(null)
  const kF = 2 / (c.emaFast + 1), kS = 2 / (c.emaSlow + 1)
  for (let i = 0; i < n; i++) {
    if (i + 1 >= c.emaFast) fast[i] = fast[i - 1] == null ? sma(closes, i, c.emaFast) : closes[i] * kF + fast[i - 1] * (1 - kF)
    if (i + 1 >= c.emaSlow) slow[i] = slow[i - 1] == null ? sma(closes, i, c.emaSlow) : closes[i] * kS + slow[i - 1] * (1 - kS)
    if (i >= c.rvWindow) rv[i] = realisedVol(closes, i, c.rvWindow)
  }
  return { fast, slow, rv, cfg: c }
}

/**
 * classify day i. trend ∈ {'up','down','neutral'}, vol ∈ {'calm','normal','elevated','spiking'}.
 * trendStrength ∈ [0,1] scales with how far fast is from slow (capped at 4x the band).
 */
export function classify(closes, i, pre) {
  const { fast, slow, rv, cfg } = pre
  let trend = 'neutral', trendStrength = 0
  if (fast[i] != null && slow[i] != null) {
    const gap = (fast[i] - slow[i]) / slow[i]
    const slopeOk = i >= cfg.slopeDays && fast[i - cfg.slopeDays] != null
    const slope = slopeOk ? (fast[i] - fast[i - cfg.slopeDays]) / fast[i - cfg.slopeDays] : 0
    if (gap > cfg.trendBandPct && slope > 0) trend = 'up'
    else if (gap < -cfg.trendBandPct && slope < 0) trend = 'down'
    trendStrength = Math.min(1, Math.abs(gap) / (cfg.trendBandPct * 4))
  }

  let vol = 'normal', rvNow = rv[i], rvPct = 0.5
  const ret1 = i > 0 ? Math.abs(Math.log(closes[i] / closes[i - 1])) : 0
  if (ret1 >= cfg.spikeAbsRet) { vol = 'spiking'; rvPct = 1 }
  else if (rvNow != null) {
    rvPct = pctRank(rv, i, rvNow, cfg.rvRankWindow)
    vol = rvPct < 0.40 ? 'calm' : rvPct < 0.75 ? 'normal' : rvPct < 0.92 ? 'elevated' : 'spiking'
  }
  return { trend, trendStrength, vol, rv: rvNow, rvPct, ret1 }
}

// ── self-test ────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let ok = true
  const chk = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); ok = ok && c }

  // synthetic: 120 flat days then a steady ramp up
  const closes = []
  for (let i = 0; i < 120; i++) closes.push(100)
  for (let i = 0; i < 120; i++) closes.push(100 * (1 + 0.004) ** i)
  const pre = precompute(closes)
  const flat = classify(closes, 110, pre)
  const ramp = classify(closes, 230, pre)
  chk('flat => neutral trend', flat.trend === 'neutral')
  chk('ramp => up trend', ramp.trend === 'up')
  chk('ramp trendStrength > 0.3', ramp.trendStrength > 0.3)

  // vol spike: inject a -12% day
  const c2 = closes.slice()
  c2[200] = c2[199] * 0.88
  const pre2 = precompute(c2)
  chk('big down day => spiking', classify(c2, 200, pre2).vol === 'spiking')

  // downtrend
  const down = []
  for (let i = 0; i < 80; i++) down.push(100)
  for (let i = 0; i < 120; i++) down.push(100 * (1 - 0.004) ** i)
  const pre3 = precompute(down)
  chk('ramp down => down trend', classify(down, 190, pre3).trend === 'down')

  console.log(ok ? '\nALL PASS' : '\nFAILURES')
  process.exit(ok ? 0 : 1)
}
