/**
 * presets.mjs — candidate strategy configs for the backtest.
 *
 * Everything scales linearly with --capital EXCEPT gas (flat $/rebalance), a real
 * drag at small size. Default capital 94 = current live NAV (see the balance review).
 *
 * kicker.mode:
 *   'lowLev'         capFrac of NAV as margin, fixed low leverage (sane)
 *   'liqAtLowerBand' fixed capUsd, leverage set so liq == LP lower band (Gabriel's idea)
 */

export const PRESETS = {
  // ── Gabriel's literal sketch: big static short + kicker liq'd at the lower band ──
  'gabriel-raw': {
    label: "Gabriel raw: static full-delta short @10x, $6 kicker liq=lower-band, kicker always on",
    lpFrac: 0.68,
    lp: { widthPct: 0.10, skew: 0, volWiden: false, feeAprInRange: 0.45 },
    hedge: { mode: 'static', lev: 10, stopPct: null, fundingAnnRate: 0.04 },
    kicker: { enabled: true, mode: 'liqAtLowerBand', capFrac: null, capUsd: 6, onlyTrendUp: false, cooldownDays: 3, maxLev: 12, fundingAnnRate: -0.04 },
    rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── same idea, sane leverage: dynamic 3x hedge, kicker only in uptrends ─────────
  'gabriel-fixed': {
    label: "Gabriel fixed: dynamic 3x hedge + stop, vol-widened skewed range, $6 kicker liq=band (uptrend only)",
    lpFrac: 0.68,
    lp: { widthPct: 0.12, skew: 0.35, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'dynamic', lev: 3, stopPct: 0.20, fundingAnnRate: 0.04 },
    kicker: { enabled: true, mode: 'liqAtLowerBand', capFrac: null, capUsd: 6, onlyTrendUp: true, cooldownDays: 5, maxLev: 8, fundingAnnRate: -0.04 },
    volSpikeFlatten: true, rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── recommended: trend-flexed hedge (lean long in up, net short in down) ────────
  'trend-flex': {
    label: "Trend-flex: hedge ratio 0.5/1.0/1.25 by trend, skewed range, low-lev kicker in uptrends",
    lpFrac: 0.68,
    lp: { widthPct: 0.12, skew: 0.40, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'trendFlex', lev: 3, stopPct: 0.18, hUp: 0.5, hNeutral: 1.0, hDown: 1.25, fundingAnnRate: 0.04 },
    kicker: { enabled: true, mode: 'lowLev', capFrac: 0.06, lev: 2.5, onlyTrendUp: true, cooldownDays: 5, fundingAnnRate: -0.04 },
    volSpikeFlatten: true, rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── trend-flex with a conviction gate: only act on trends with real strength ────
  'trend-flex-hc': {
    label: "Trend-flex high-conviction: directional legs only when trendStrength >= 0.5",
    lpFrac: 0.68,
    minTrendStrength: 0.5,
    lp: { widthPct: 0.12, skew: 0.40, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'trendFlex', lev: 3, stopPct: 0.18, hUp: 0.5, hNeutral: 1.0, hDown: 1.25, fundingAnnRate: 0.04 },
    kicker: { enabled: true, mode: 'lowLev', capFrac: 0.06, lev: 2.5, onlyTrendUp: true, cooldownDays: 5, fundingAnnRate: -0.04 },
    volSpikeFlatten: true, rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── "cash is a position": exit the LP entirely in a confirmed downtrend ─────────
  'stable-default': {
    label: "Stable-default: trend-flex + fully exit LP to USD in confirmed downtrends",
    lpFrac: 0.68,
    lp: { widthPct: 0.12, skew: 0.35, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'trendFlex', lev: 3, stopPct: 0.18, hUp: 0.5, hNeutral: 1.0, hDown: 1.0, fundingAnnRate: 0.04 },
    kicker: { enabled: true, mode: 'lowLev', capFrac: 0.06, lev: 2.5, onlyTrendUp: true, cooldownDays: 5, fundingAnnRate: -0.04 },
    exitToStableOnDown: true, volSpikeFlatten: true, rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── regime-gated: only run the LP in calm/rangey tape, sit in USD otherwise ────
  'regime-gated': {
    label: "Regime-gated: LP+trend-flex only when calm & rangey; USD lending in vol/strong-trend",
    lpFrac: 0.68,
    lpOnlyWhenCalm: true, lpMaxTrendStrength: 0.7,
    lp: { widthPct: 0.14, skew: 0.30, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'trendFlex', lev: 3, stopPct: 0.18, hUp: 0.6, hNeutral: 1.0, hDown: 1.15, fundingAnnRate: 0.04 },
    kicker: { enabled: true, mode: 'lowLev', capFrac: 0.05, lev: 2.5, onlyTrendUp: true, cooldownDays: 6, fundingAnnRate: -0.04 },
    volSpikeFlatten: true, stableYieldAnnRate: 0.06, rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── baseline: pure delta-neutral, no directional view ──────────────────────────
  'neutral-only': {
    label: "Neutral-only: LP + continuous dynamic full hedge, no kicker, no skew",
    lpFrac: 0.68,
    lp: { widthPct: 0.12, skew: 0, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'dynamic', lev: 3, stopPct: 0.25, fundingAnnRate: 0.04 },
    kicker: { enabled: false },
    volSpikeFlatten: true, rebalanceDays: 14, rebalanceOnRangeExit: true,
  },

  // ── the pain floor: LP only, unhedged ─────────────────────────────────────────
  'lp-naked': {
    label: "LP-naked: LP only, no hedge, no kicker (shows unhedged drawdown)",
    lpFrac: 0.90,
    lp: { widthPct: 0.14, skew: 0, volWiden: true, feeAprInRange: 0.45 },
    hedge: { mode: 'none' },
    kicker: { enabled: false },
    rebalanceDays: 14, rebalanceOnRangeExit: true,
  },
}
