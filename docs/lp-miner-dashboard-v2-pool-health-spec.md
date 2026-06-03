# LP Miner Dashboard — v2 Pool-Health Panel (QUEUED)

**Created:** 2026-06-02 (from the Revert Finance audit, folded alongside the v1+ rebuild)
**Status:** QUEUED — needs a historical data feed. Do NOT block on v1/v1+.
**Depends on:** the v1+ contract already shipped (`scripts/build-dashboard-data.js` + `scripts/lp-reconcile.js` → `web/lp-miner/data/dashboard.json`, rendered by `web/lp-miner/index.html`).

---

## Why this is the highest-value future add

Revert's own lesson, verified against a real position: an OP/WETH LP earned **$0.14 in fees over 827 days** because pool volume fell **91%** and no dashboard surfaced the decay. A staked LP can quietly stop being worth providing to. v1/v1+ shows how *this* position is doing; v2 shows whether the *pool underneath it* is still worth being in. It is the early-warning layer.

This is a pool-quality signal, not a position-P&L signal — keep it visually distinct from the per-position performance block.

---

## What to build

A **pool-health panel per pool** (one per distinct `poolAddress` across open positions — N-LP scalable, dedupe by address):

| Metric | Source field | Notes |
|---|---|---|
| 24h volume | pool API | |
| 7d volume | pool API | |
| TVL | pool API | |
| **Fees per TVL** (fee yield) | `24h fees / TVL`, annualized | the real "is this pool paying" number; compare to emission APR |
| 30 / 60 / 90d trend | rolling history (persisted) | volume + TVL sparkline/delta. Down-trend = decay warning |
| Decay flag | derived | if volume ↓ >X% over 30d → surface a "pool decaying" warning chip |

## Data source

- **GeckoTerminal** (`/networks/{network}/pools/{address}`) or **DefiLlama** pool/yields API, keyed by `poolAddress` (already in the contract per position).
- Base/Aerodrome pool today: `0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb`.
- **Persist a rolling history** so 30/60/90d trends are computable. Pattern to mirror: `lp-reconcile.js writePortfolio()` already appends to `state/portfolio-history.json` and slices a tail. Add `state/pool-health-history.json` (per pool address: `[{at, volume24h, volume7d, tvl, feesUsd24h}]`, sliced to ~120 points). A new dev script (`scripts/pool-health.js`) runs on the same VPS cron, after reconcile, writes `dash.poolHealth` keyed by pool address.

## Contract additions (proposed)

```
positions.items[].poolAddress        // already present — the join key
poolHealth: {                        // top-level, keyed by pool address (dedup across positions)
  "0x3e66…a9fb": {
    pair, venue, chain,
    volume24hUsd, volume7dUsd, tvlUsd,
    feesPerTvlAnnPct,                // 24h fees / TVL, annualized
    trend: { d30: {volPct, tvlPct}, d60: {...}, d90: {...} },
    decayFlag: boolean, decayReason: string|null,
    history: [{at, volume24hUsd, tvlUsd}],   // sparkline tail
    asOf, source
  }
}
```

## Front-end

Route through the **designer agent + dashboard-design skill** (Operator's Console, aqua/family base, per the v1 decision). Add a "Pool health" sub-block to each position card (or a dedicated panel grouping pools when N>1), visually distinct from per-position performance. Volume/TVL trend as a small sparkline (chart-selection: zero-baseline). Decay warning as a chip, consistent with the existing kill-switch/unfunded warning treatment. Edge states: first-history-point ("building trend, needs N days"), API down ("pool data unavailable, source down at HH:MM").

## Guardrails (unchanged from v1)

- Per-position / per-pool, N-LP scalable.
- Read-only monitor. No control buttons of any kind (no deposit/withdraw/move-range/compound/auto-exit, no borrow, no simulator) — explicitly excluded by Gabriel.
- No invented data. If the pool API is down or history is too short, say so; never fabricate a trend.
