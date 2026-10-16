/**
 * strategy.mjs — the policy, split into three pure targeters the engine calls in order:
 *   targetLP(ctx,cfg)                  -> { a, b, capUsd } | null   (null = exit to USD)
 *   targetHedge(ctx, lpNow, cfg)       -> { shortNotionalUsd } | null
 *   targetKicker(ctx, lpNow, cfg)      -> { capUsd, lev } | null
 *
 * Hedge + kicker are sized off the ACTUAL live LP (lpNow = {a,b,L}) so the book
 * never drifts away from the intended net delta because of an estimate.
 *
 * Config schema — see presets.mjs for worked examples. Key knobs:
 *   lpFrac, lp.{widthPct,skew,volWiden,feeAprInRange}
 *   hedge.{mode: none|static|dynamic|trendFlex, lev, stopPct, hUp,hNeutral,hDown, fundingAnnRate}
 *   kicker.{enabled, mode: 'lowLev'|'liqAtLowerBand', capFrac, lev, onlyTrendUp, cooldownDays, fundingAnnRate}
 *   exitToStableOnDown, volSpikeFlatten, stableYieldAnnRate, rebalanceDays
 */
import { lpAt, Lfor, lpDeltaUsd, makeRange } from './clmath.mjs'
import { levForLiq } from './perp.mjs'

const VOL_WIDEN = { calm: 1.0, normal: 1.3, elevated: 1.8, spiking: 2.5 }

export function defaults(cfg) {
  return {
    lpFrac: 0.8,
    exitToStableOnDown: false,
    volSpikeFlatten: true,
    stableYieldAnnRate: 0.05,
    rebalanceDays: 3,
    rebalanceOnRangeExit: true,
    minTrendStrength: 0,   // conviction gate: below this, treat trend as 'neutral'
    ...cfg,
    lp: { widthPct: 0.12, skew: 0, volWiden: true, feeAprInRange: 0.45, feeVolBeta: 0, swapBps: 5, gas: 0.05, ...(cfg.lp || {}) },
    hedge: { mode: 'trendFlex', lev: 3, mmr: 0.006, stopPct: 0.18, hUp: 0.5, hNeutral: 1.0, hDown: 1.25, fundingAnnRate: 0.04, ...(cfg.hedge || {}) },
    kicker: { enabled: false, mode: 'lowLev', capFrac: 0.06, lev: 2.5, onlyTrendUp: true, cooldownDays: 5, fundingAnnRate: -0.04, maxLev: 8, ...(cfg.kicker || {}) },
  }
}

const trendSignOf = (t) => (t === 'up' ? +1 : t === 'down' ? -1 : 0)

/** apply the conviction gate: weak trends read as neutral. */
const gatedTrend = (cls, cfg) =>
  cls.trendStrength >= (cfg.minTrendStrength || 0) ? cls.trend : 'neutral'

/** reference half-width the quoted fee APR corresponds to. */
export const REF_HALF_WIDTH = 0.12

/**
 * Concentration factor: fee rate for a given capital scales ~1/(√b − √a).
 * effApr = feeAprInRange * (refSpan / curSpan), capped (a razor-thin range gets
 * arbitraged, it does not earn unbounded fees).
 */
export function concentrationFactor(P, a, b) {
  const refA = P * (1 - REF_HALF_WIDTH), refB = P * (1 + REF_HALF_WIDTH)
  const refSpan = Math.sqrt(refB) - Math.sqrt(refA)
  const curSpan = Math.sqrt(b) - Math.sqrt(a)
  return Math.max(0.05, Math.min(3, refSpan / curSpan))
}

export function targetLP({ P, nav, cls }, cfg) {
  const trend = gatedTrend(cls, cfg)
  if (cfg.exitToStableOnDown && trend === 'down') return null
  // regime gate: a concentrated LP bleeds IL in high-vol / strong-trend regimes.
  // sit in USD (lending) unless the tape is calm-ish and rangey.
  if (cfg.lpOnlyWhenCalm) {
    if (cls.vol === 'elevated' || cls.vol === 'spiking') return null
    if (cls.trendStrength >= (cfg.lpMaxTrendStrength ?? 0.7)) return null
  }
  const widthMul = cfg.lp.volWiden ? VOL_WIDEN[cls.vol] : 1
  const widthPct = Math.min(0.85, cfg.lp.widthPct * widthMul)   // keep lower band > 0
  const skew = cls.vol === 'spiking' ? 0 : cfg.lp.skew * cls.trendStrength
  const { a, b } = makeRange(P, widthPct, skew, trendSignOf(trend))
  return { a, b, capUsd: nav * cfg.lpFrac }
}

/** real USD delta of the live LP (0 if none). */
function lpDelta(P, lpNow) {
  return lpNow ? lpDeltaUsd(P, lpNow.L, lpNow.a, lpNow.b) : 0
}

export function targetHedge({ P, nav, cls }, lpNow, cfg) {
  const m = cfg.hedge.mode
  if (m === 'none') return null
  const dNow = lpDelta(P, lpNow)
  const spiking = cls.vol === 'spiking'

  if (m === 'static' || m === 'dynamic') {
    return dNow > 1 ? { shortNotionalUsd: dNow } : null
  }
  // trendFlex: hedge ratio vs the live LP delta; hDown>1 => net short in downtrends
  const trend = gatedTrend(cls, cfg)
  let h = cfg.hedge.hNeutral
  if (trend === 'up') h = cfg.hedge.hUp
  else if (trend === 'down') h = cfg.hedge.hDown
  if (cfg.volSpikeFlatten && spiking) h = Math.max(1, cfg.hedge.hNeutral)
  const short = h * (dNow || nav * cfg.lpFrac * 0.5)
  return short > 1 ? { shortNotionalUsd: short } : null
}

export function targetKicker({ P, nav, cls, daysSinceKickerLiq }, lpNow, cfg) {
  if (!cfg.kicker.enabled) return null
  if (cls.vol === 'spiking') return null
  if (cfg.kicker.onlyTrendUp && gatedTrend(cls, cfg) !== 'up') return null
  if (daysSinceKickerLiq != null && daysSinceKickerLiq < cfg.kicker.cooldownDays) return null

  const capUsd = cfg.kicker.capFrac ? nav * cfg.kicker.capFrac : cfg.kicker.capUsd
  let lev = cfg.kicker.lev
  if (cfg.kicker.mode === 'liqAtLowerBand' && lpNow) {
    lev = levForLiq(+1, P, lpNow.a, cfg.hedge.mmr)
  }
  lev = Math.max(1.5, Math.min(cfg.kicker.maxLev || 8, lev))
  return { capUsd, lev }
}
