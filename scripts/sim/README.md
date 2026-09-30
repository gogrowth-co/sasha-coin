# LP + hedge + trend-kicker simulator

Path-based backtest of the "surf the trend, hedge the downside, farm fees in the middle"
strategy family Gabriel sketched. Real daily OHLC history, zero capital, zero on-chain.

## Run it

```bash
# one-time: pull price history (ETH + SOL, 5y daily candles from Binance)
node scripts/sim/fetch-prices.mjs

# compare every preset on one asset
node scripts/sim/backtest.mjs --asset ETH --compare

# one preset, full detail + per-year + monthly strip + equity chart
node scripts/sim/backtest.mjs --asset ETH --preset trend-flex

# a specific window (the Aug-2025 spike, a bear stretch, ...)
node scripts/sim/backtest.mjs --asset ETH --preset trend-flex --from 2025-06-01 --to 2025-12-31

# knobs without editing presets
node scripts/sim/backtest.mjs --asset ETH --preset neutral-only \
  --fee-apr 60 --funding 8 --width 20 --rebal-days 21 --conviction 0.5

# machine-readable + skip the HTML chart
node scripts/sim/backtest.mjs --asset SOL --compare --json --no-html
```

Outputs land in `reports/sim/` (equity-curve HTML + result JSON).
`DBG=1` prefixes a P&L decomposition (fees / funding / LP mtm / hedge mtm / kicker mtm)
and sizing diagnostics to stderr.

## Presets (`presets.mjs`)

| preset | what it is |
|---|---|
| `gabriel-raw` | the literal sketch: static full-delta short @10x + $6 kicker liq'd at the LP lower band, kicker always on |
| `gabriel-fixed` | same idea, sane leverage: dynamic 3x hedge + stop, vol-widened skewed range, kicker uptrend-only |
| `trend-flex` | hedge ratio flexes 0.5 / 1.0 / 1.25 by trend (lean long in up, net short in down), skewed range, low-lev kicker |
| `trend-flex-hc` | `trend-flex` + conviction gate: only act on trends with `trendStrength >= 0.5` |
| `stable-default` | `trend-flex` but fully exit the LP to USD in a confirmed downtrend ("cash is a position") |
| `regime-gated` | run the LP only when the tape is calm & rangey; sit in USD lending during vol / strong trend |
| `neutral-only` | pure delta-neutral LP + continuous dynamic full hedge, no directional view (baseline) |
| `lp-naked` | LP only, no hedge (the unhedged-drawdown floor) |

## What the model captures

- **CL / LP:** exact Uniswap-v3 position value along the path, in-range fee accrual, **fee
  APR scaled by concentration** (a ±40% range earns ~1/3 the APR of a ±12% range for the
  same capital), no-swap single-sided re-ranging on a decisive range exit, vol-widened +
  trend-skewed ranges.
- **Hedge short:** isolated margin, real liquidation price, **intrabar liquidation on the
  candle high** (the Aug-19 failure mode), optional exchange-native stop bracket, funding,
  static / dynamic / trend-flexed sizing. Reserves enough dry powder to scale the short to
  the LP's *maximum* delta (full conversion).
- **Upside kicker:** leveraged long, leverage set so liquidation == LP lower band (Gabriel's
  idea) or a fixed low leverage, uptrend-gated, re-arm cooldown after a liquidation.
- **Trend / vol classification:** EMA(20/60) cross + slope, realised-vol percentile, 1-day
  return spike override. **No lookahead** — day `i` uses only data through day `i`.
- **Idle USD** earns a stable lending yield.
- **Costs:** swap bps on rebalancing trades, flat gas per action (a real drag at $94), perp
  taker fee on hedge resizes.
- **Accounting is conservation-checked every rebalance** (`consErr ≈ 0`).

## Known limitations / where it may be pessimistic

- **Daily granularity.** Intraday fee capture and precise liquidation fills are approximated
  from the candle. Fine for strategy comparison, not for execution tuning.
- **LVR is probably 20–40% overstated.** Chunky discrete re-ranging is worse than the
  continuous rebalancing textbook LVR assumes; a smarter range manager would do better.
- **`feeAprInRange` is the single biggest assumption** (default 45% at ±12%). Sweep it.
- **Funding is a flat annual rate**, not the real time-varying series (which turns against a
  short in bear markets).
- **The trend classifier is deliberately simple.** A better signal is the main lever on the
  trend-overlay presets.
- Single LP, single asset, no compounding into new pools.

## The headline finding (ETH + SOL, 2021-11 → 2026-09)

Nothing in this family beat buy-and-hold on total return over this window. The delta-neutral
versions *underperformed* holding the asset: the short-gamma bleed of a concentrated LP plus
the cost of rehedging it exceeded the fee income in a high-realised-vol asset. The only
configs that helped — `regime-gated` and `stable-default`, which sit in USD during vol and
strong trends — cut max drawdown from ~78% to ~48% and beat HODL by ~12 points, but still
lost ~33% over the window. `gabriel-raw` (high-leverage kicker, always on) was catastrophic:
30+ liquidations.

Structural takeaway: **you cannot be short-vol (the LP) and long-vol (trend-surfing) with the
same dollars.** LP fees are real but small (~7–12%/yr realised) and do not cover the LVR of a
concentrated position in ETH/SOL-grade volatility. "Never lose" is not on the menu; the
honest choice is *drawdown reduction at a cost*, and the cost is ~5%/yr of bleed.
