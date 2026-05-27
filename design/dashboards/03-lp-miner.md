# 03 — LP Miner Dashboard

**Project:** Sasha Coin — Liquidity Miner control panel (Base + Solana LP, Hyperliquid hedge, Mantle ERC-8004 attestation)
**Live data sources:** `state/lp-positions.json`, `state/pool-history.json`, `state/pool-blacklist.json`, `content/lp-candidates.json`, `content/lp-rebalance-signal.json`, `state/capital-pool.json`, Hyperliquid API, Morpho
**Audience:** Gabriel (daily operator), future investors (occasional), Sasha (reads via API)
**Hero question this dashboard answers:** *"What is my LP capital doing right now, what's at risk, and what does Sasha want to do about it?"*
**No external deadline.** This is the real product, not a hackathon artifact. Build it right, not fast.

---

## 1. Executive summary

This is the only one of the three that is a **working tool**, not a pitch. It is the cockpit Gabriel opens every morning to answer one question fast: *is anything on fire, and is anything making money?* It is also the surface where Sasha's rebalance recommendations surface for approval (per CLAUDE.md, all on-chain execution requires Gabriel confirmation).

The hero is the **portfolio truth strip**: total capital, aggregate yield (fees earned), net PnL (including IL and hedge), and a count of positions needing attention. Everything below it is drill-down: positions table, pool scanner candidates, rebalance action queue, hedge book, risk monitors.

Two interaction modes:

1. **Glance mode** (Gabriel, 5 seconds): truth strip + alert count. "All green or something's wrong?"
2. **Operate mode** (Gabriel, when something needs doing): drill into a position, review a rebalance signal, approve or reject an action.

Aesthetic: **the hedge fund operator's screen.** Multi-pane, dense, professional, hierarchical. This dashboard *can* be busy because its user is an expert who visits daily. Unlike the hackathon dashboards (which optimize for a stranger's first 60 seconds), this one optimizes for an expert's 100th visit. Density is a feature.

---

## 2. Audience & stakeholder map

| Audience | Frequency | Time | Primary goal | First-5-seconds need |
|---|---|---|---|---|
| **Gabriel (operator)** | Daily, 1–3× | 5s glance / 5min operate | Know status, approve actions | Truth strip + alert count |
| **Future investor** | Monthly | 5–10min | Evaluate strategy performance | Cumulative PnL chart + Sharpe-like risk framing |
| **Sasha (API consumer)** | Continuous | n/a | Read positions + signals for posts | JSON endpoint |
| **Auditor / skeptic** | Rare | 15min | Verify every position is real | Per-position on-chain links |

Gabriel is the primary user, and his two modes (glance vs operate) drive the whole design. The investor view is a secondary "Performance" route that reframes the same data as a track record.

---

## 3. Jobs-to-be-done

Ranked:

1. **JTBD-01: Glance-check portfolio health.** *Gabriel opens it, needs to know in 5s if anything needs action.* Success = he can close the tab in 5s when all is well.
2. **JTBD-02: Review and approve rebalance actions.** *When Sasha recommends a CLOSE_REOPEN / CLAIM_FEES / DELEVERAGE / KILL, Gabriel needs to see why, the projected outcome, and approve/reject.* Success = a one-click approve with full context visible.
3. **JTBD-03: Monitor a single position deeply.** *When a position is near its range edge or its hedge has drifted, Gabriel needs the full picture: price vs range, fee accrual, hedge delta, Morpho HF.* Success = he understands the position's state without leaving the screen.
4. **JTBD-04: Review pool scanner candidates.** *When deciding where to deploy new capital, Gabriel needs the ranked candidate pools with quality scores and the blacklist.* Success = he can compare candidates and trigger a new position.
5. **JTBD-05: Watch the hedge book.** *Gabriel needs to see Hyperliquid hedge positions, their funding, and the kill-switch proximity (< −54.75% annualized).* Success = funding kill risk is glanceable.
6. **JTBD-06: Track cumulative performance.** *Investor (or Gabriel reflecting) needs the track record: cumulative fees, net PnL after IL and hedge, by position and aggregate.* Success = a credible performance story.

JTBD-01 and -02 are the daily core. -03 through -05 are the operate-mode depth. -06 is the investor/reflection layer.

---

## 4. Competitive teardown

Six references for *portfolio operation + risk monitoring + approval workflows*:

| Reference | What works | What to steal | What to avoid |
|---|---|---|---|
| **debank.com portfolio** | The canonical multi-chain portfolio view. | The chain-grouped position list + the net-worth header. | Ad clutter. |
| **app.aave.com / app.morpho.org** | Health factor visualization. The HF gauge is the genre standard. | The HF bar with liquidation threshold marked. | Over-explanation. |
| **Hyperliquid app** | Funding rate display + position PnL in real time. | The funding countdown + funding rate color coding. | Information overload for non-experts (fine for us — Gabriel is expert). |
| **app.uniswap.org positions** | Price-vs-range bar for a concentrated position. | The in-range / out-of-range bar with current price marker. | Limited to one protocol. |
| **Linear (the app)** | Approval/triage workflow, command palette, keyboard-first. | Cmd palette + the triage inbox pattern for the rebalance queue. | n/a — borrow heavily. |
| **Stripe Dashboard** | Dense financial data made calm. The balance + activity split. | The "one big number + supporting detail" hierarchy. | n/a. |

**Key insight from the teardown:** the rebalance approval queue should feel like **Linear's triage inbox** — a list of decisions, each with enough context to act, keyboard-navigable, fast. This is the single most important interaction pattern to nail.

---

## 5. Data audit

### What exists

| Source | File | Refresh | Reliability | Use for |
|---|---|---|---|---|
| LP positions | `state/lp-positions.json` | On open/close/monitor | High | Positions table, position detail |
| Pool history | `state/pool-history.json` | On scan | High (100+ snapshots) | Pool candidate scoring, historical APR |
| Pool blacklist | `state/pool-blacklist.json` | On stop-loss trigger | High | Blacklist view, scanner filter |
| LP candidates | `content/lp-candidates.json` | On `pool-scanner.js` run | High | Scanner candidate list |
| Rebalance signal | `content/lp-rebalance-signal.json` | On `position-monitor.js` run | High | Rebalance action queue |
| Capital pool | `state/capital-pool.json` | After trades | High | Capital allocation strip |
| Hyperliquid | REST API | On demand | Medium (API) | Hedge book, funding rates |
| Morpho | Contract via RPC | On demand | Medium | Health factor per leveraged position |

### Schema highlights (from position-monitor.js + lp-positions.json)

A position has: `id`, `status` (pending_open / active / closed), `symbol`, `chain`, `pool_address`, `fee_tier`, `price_range` {lower, upper}, `capital_usd`, `pending_fees`, `last_claim`, `hedge` {size, venue, entry}, `funding_history[]`, `morpho` {hf, borrowed, collateral}.

Kill-switch conditions monitored: out-of-range (OOR) timeout, hedge delta drift, Morpho HF breach, funding kill (< −54.75% annualized).

### What's missing

| Gap | Mitigation |
|---|---|
| No cumulative PnL series persisted | Add `state/pnl-history.json`, append daily snapshot per position. Needed for JTBD-06. |
| No fee accrual rate (only point-in-time pending fees) | Compute rate from successive snapshots, or store fee-per-day. |
| IL not explicitly computed/stored | Compute via `defi-lp-math` positionDelta + entry price; store on each monitor run. |
| Only 1 position currently (pending) | Design must handle 1-position and 20-position states equally well. |

### Refresh strategy

- **Live (30s):** position current price vs range, pending fees, hedge funding, Morpho HF, capital pool.
- **On-scan:** pool candidates, rebalance signal (these update when scripts run, not continuously).
- **Daily snapshot:** PnL history, capital history.
- **Push:** rebalance signal change → toast + badge on the queue. Kill-switch trigger → prominent alert + (existing) Telegram.

---

## 6. Information architecture

Unlike the hackathon dashboards, this is a **multi-route app** with persistent sidebar nav. Gabriel returns daily and needs deep sections.

```
[Sidebar nav]
  ◆ Sasha LP
  ─────────────
  ▸ Overview          (default route — the cockpit)
  ▸ Positions         (table + per-position detail)
  ▸ Rebalance queue   (Linear-style triage inbox)  [badge: pending count]
  ▸ Pool scanner      (candidates + blacklist)
  ▸ Hedge book        (Hyperliquid positions + funding)
  ▸ Performance       (cumulative PnL, track record — investor view)
  ─────────────
  ▸ Settings          (density, thresholds, alerts)

[Top bar]
  Breadcrumb · ● All systems / ⚠ N alerts · capital total · last sync · refresh · ⌘K

[Overview route — the cockpit]
  Truth strip (4 KPIs) → Alert panel (if any) → Positions summary table →
  Rebalance queue preview (top 3) → Capital allocation donut → Recent activity

[Positions route]
  Filterable/sortable positions table (DataGrid) → click row → position detail drawer

[Rebalance queue route]
  Triage inbox: each signal as a card with context + approve/reject. Keyboard nav.

[Pool scanner route]
  Ranked candidates table (quality score) + blacklist table + "scan now" trigger

[Hedge book route]
  Hyperliquid positions, funding rates, kill-switch proximity gauges

[Performance route]
  Cumulative net PnL chart, per-position breakdown, fees vs IL vs hedge waterfall
```

**Command palette (⌘K):** jump to any position by symbol, trigger a scan, approve top queue item, switch density. Linear-style. This is what makes it feel like a pro tool.

---

## 7. User flows

### Flow A — Daily glance (JTBD-01)

```
Open (lands on Overview)
  → Truth strip: Total $X · Yield $Y · Net PnL +Z% · ⚠ 0 alerts (3s)
  → If 0 alerts: close tab. Done in 5s.
  → If N alerts: alert panel is top of page, can't miss it.
```

### Flow B — Approve a rebalance (JTBD-02) — the critical flow

```
See badge on "Rebalance queue: 2"
  → Click (or ⌘K → "queue")
  → Triage inbox: card 1 of 2
     "CLOSE_REOPEN · USDC/cbBTC · out of range 4h12m
      Reason: price exited upper bound. Fees accrued: $1.20.
      Projected: reopen at new range [a, b], est. capital preserved $44.10.
      [Approve & execute]  [Reject]  [Snooze 1h]"
  → Review context (price chart, current range, projected range all inline)
  → Click Approve
  → Confirm modal: "This executes an on-chain tx. Gas est: $0.40. Confirm?"
  → Confirm → execution → toast "Executing. TX submitted 0x…"
  → Card advances to 2 of 2
```

This flow is the heart of the product. It must be fast, fully contextualized, and safe (the confirm modal enforces the CLAUDE.md rule that on-chain execution needs explicit confirmation).

### Flow C — Investigate a position (JTBD-03)

```
Positions route → click row
  → Drawer slides in from right (480px)
  → Price-vs-range bar with current price marker (in range? how close to edge?)
  → Fee accrual sparkline
  → Hedge panel: size, venue, current delta drift
  → Morpho panel: HF gauge with liquidation threshold
  → On-chain links: pool, position NFT, hedge, attestation
  → "Force rebalance" / "Close position" actions (→ confirm modal)
```

### Flow D — Deploy new capital (JTBD-04)

```
Pool scanner route
  → Ranked candidates table (quality score desc)
  → Compare top 3: APR, TVL, vol-to-TVL, breakeven days, score
  → Click a candidate → "Open position" → sizing modal (position-sizer.js logic)
  → Set capital amount → preview range → confirm → execution
```

### Flow E — Check hedge risk (JTBD-05)

```
Hedge book route
  → Each hedge: size, entry, current funding rate, annualized funding
  → Kill-switch gauge: how close to −54.75% annualized?
  → If any approaching: it's flagged red, surfaced on Overview alert panel too
```

---

## 8. Content strategy & microcopy

### Voice rules

This is an operator tool, so voice is **terse and functional**, with Sasha's personality reserved for the rebalance reasoning (where she explains *why* she recommends an action — that's where first-person belongs). Investor-facing Performance route is slightly more polished.

### Microcopy bank

| Slot | Copy |
|---|---|
| App title | Sasha LP |
| Overview truth strip labels | Total capital · Fees earned · Net PnL · Alerts |
| All-clear status | ● All systems nominal |
| Alert status | ⚠ {n} {position\|positions} need attention |
| Empty positions | No open positions. Run the scanner to find candidates. |
| Position OOR | Out of range · {duration} |
| Position in range | In range · {pct} to edge |
| Rebalance card — CLOSE_REOPEN | Close and reopen · {pool} · {reason} |
| Rebalance card — CLAIM_FEES | Claim fees · {pool} · ${amount} accrued |
| Rebalance card — DELEVERAGE | Deleverage · {pool} · HF {hf} below threshold |
| Rebalance card — KILL | Kill position · {pool} · {reason} |
| Sasha's reasoning prefix | Sasha: |
| Approve action | Approve & execute |
| Confirm modal | This executes an on-chain transaction. Estimated gas: {gas}. Confirm? |
| Execution toast | Executing. TX submitted {tx}. |
| Funding kill warning | Funding at {rate}% annualized. Kill threshold −54.75%. |
| Morpho HF healthy | HF {n} · healthy |
| Morpho HF warning | HF {n} · deleverage soon |
| Scanner empty | No candidates pass the quality filter right now. |
| Blacklist entry | {pool} · blacklisted {date} · {reason} |
| Performance empty | Need 7 days of history to show a track record. |

### Number formatting

Inherits foundation. Additions critical for an operator tool:

| Type | Format | Example |
|---|---|---|
| Health factor | `{n.nn}` | 1.84 |
| Funding rate annualized | `{n.n}%` with sign | −12.4% |
| APR | `{n.n}%` | 123.9% |
| Days open | `{n}d {n}h` | 3d 4h |
| Price range | `[{lower} – {upper}]` | [0.0241 – 0.0263] |
| Vol-to-TVL | `{n.nn}` | 0.42 |
| Quality score | `{n}/100` | 78/100 |
| IL | `−{n.n}%` | −2.1% |

---

## 9. Aesthetic direction — three options

### Direction A — "Operator's Cockpit" *(recommended)*

**Moodboard:** Linear's calm density + Stripe's financial hierarchy + Morpho's HF gauges.

- Multi-pane, sidebar nav, dense tables in compact mode by default.
- One big number per route (truth strip total on Overview).
- Charts monochromatic, gauges for HF and funding.
- Command palette as a first-class citizen.
- Why recommended: it's a daily tool for an expert. This aesthetic respects that — fast, dense, keyboard-first, calm under load. Ages perfectly.

**References:** linear.app, app.morpho.org, dashboard.stripe.com.

### Direction B — "Bloomberg LP Terminal"

**Moodboard:** full Bloomberg. Mono everywhere, amber accents, maximum density, multi-column.

- Every route is a dense grid of data. Minimal whitespace.
- Power-user heaven, intimidating to investors.
- Why secondary: perfect for Gabriel, hostile to the investor view. We'd need to soften the Performance route significantly. Viable if investor view is fully separated.

**References:** bloomberg.com terminal, tradingview.com, hyperliquid.

### Direction C — "Calm Wealth"

**Moodboard:** a private banking app. Lots of whitespace, large type, gentle.

- Investor-first. Beautiful, reassuring, low-density.
- Why tertiary: too low-density for Gabriel's daily operation. He'd find it slow. Good for the Performance route only, wrong for the operating routes.

**Decision:** recommend A. It threads the needle — dense enough for Gabriel, clean enough that the Performance route can present credibly to an investor. B is the fallback if Gabriel wants maximum density and we silo the investor view. C only as the Performance route's skin.

---

## 10. Tokens (LP Miner-specific)

- **Compact density is the default here** (unlike hackathon dashboards which default to cozy). Gabriel is an expert; tables run dense.
- **HF gauge color scale:** green (HF > 1.5), yellow (1.2–1.5), red (< 1.2). These map to data colors.
- **Funding gauge:** green (positive funding, we earn), neutral (0 to −20% annualized), yellow (−20% to −45%), red (approaching −54.75% kill).
- **Chain badges:** Base, Solana, Mantle, Hyperliquid — each with its brand mark, used in position rows.
- **Alert accent:** when alerts exist, the truth strip's "Alerts" tile gets `data-warning` or `data-negative` background depending on severity.

---

## 11. Component inventory (LP Miner-specific)

The richest of the three. In addition to foundation components:

| # | Component | Purpose |
|---|---|---|
| L-01 | `TruthStrip` | 4 KPI tiles: total capital, fees earned, net PnL, alert count. Hero of Overview. |
| L-02 | `PositionsDataGrid` | Power-user table. Sort, filter, column config, CSV export. Compact density. |
| L-03 | `PositionDetailDrawer` | Right drawer. Full position state: range bar, fee sparkline, hedge, Morpho, links, actions. |
| L-04 | `PriceRangeBar` | Horizontal bar showing [lower – upper] with current price marker. In/out of range coloring. |
| L-05 | `RebalanceTriageCard` | Linear-inbox-style card. Action type, reason (Sasha's voice), projected outcome, approve/reject/snooze. |
| L-06 | `ConfirmExecutionModal` | Enforces the on-chain confirmation rule. Shows action, gas estimate, requires explicit confirm. |
| L-07 | `HealthFactorGauge` | Radial or bar gauge. HF value, liquidation threshold marked, color-scaled. |
| L-08 | `FundingGauge` | Linear gauge showing funding rate vs kill threshold (−54.75%). |
| L-09 | `PoolCandidateRow` | Symbol, chain, fee tier, APR, TVL, vol-to-TVL, breakeven, quality score badge. |
| L-10 | `BlacklistTable` | Blacklisted pools: pool, date, reason. |
| L-11 | `CapitalAllocationDonut` | Capital split by chain (≤5 segments, so donut is allowed per foundation rule). |
| L-12 | `CumulativePnLChart` | Area chart, net PnL over time, with fee/IL/hedge decomposition toggle. |
| L-13 | `PnLWaterfall` | Waterfall: gross fees → minus IL → minus funding → net PnL. |
| L-14 | `HedgePositionCard` | Hyperliquid position: size, entry, mark, funding, delta drift vs LP. |
| L-15 | `AlertPanel` | Surfaced on Overview when alerts exist. Each alert links to the relevant route/position. |
| L-16 | `CommandPalette` | ⌘K. Jump to position, trigger scan, approve top queue item, switch density. |
| L-17 | `SyncStatus` | Top bar. Last sync time per data source, with stale indicators. |

---

## 12. Data visualization spec — LP Miner

### Truth strip (Overview hero)

**Type:** 4 KPI tiles. Total capital (mono-lg), Fees earned (mono-lg, positive green), Net PnL (mono-lg, +/− colored), Alerts (count, colored by severity).
**Each tile:** label (caption) + value + 7-day sparkline + delta vs yesterday.
**The alert tile is special:** if 0, it's calm neutral. If >0, it's warning/negative colored and is the visual loudest element.

### Price-vs-range bar (per position)

**Type:** Horizontal bar. The full bar is the [lower, upper] range. A vertical marker shows current price. If price is inside: marker is green, fill shows position. If outside: marker red at the edge it breached, "out of range" label.
**This is the single most important position viz.** It answers "is this position earning fees right now" at a glance.

### Health factor gauge

**Type:** Radial gauge (or horizontal bar). 0 to 3 scale. Liquidation at 1.0 marked with a red line. Current HF as the needle/fill. Color-scaled.

### Funding gauge

**Type:** Horizontal gauge. Range from + (we earn) to −54.75% (kill). Current funding as marker. Zones colored. A "kill at −54.75%" label fixed at the threshold.

### Cumulative PnL chart (Performance route)

**Type:** Area chart, net PnL over time. Toggle to decompose into gross fees (positive area) minus IL (negative) minus funding (negative) = net line.
**This is the investor's hero chart.** Must be honest — show IL and funding drag, not just gross fees. A dashboard that hides IL is a dishonest dashboard.

### PnL waterfall

**Type:** Waterfall. Start: gross fees earned. Step down: IL. Step down: funding paid. Step down: gas. End: net PnL. Color each step.

### Capital allocation donut

**Type:** Donut, ≤5 segments (Base, Solana, Mantle, idle). Center shows total. Allowed because ≤5 segments per foundation rule.

---

## 13. Screen specs

### Screen 1 — Overview (the cockpit)

```
┌──────────┬─────────────────────────────────────────────────────────────────────┐
│ ◆ SashaLP│ Overview          ⚠ 2 alerts   $20.28   synced 30s ago  ↻   ⌘K     │
│          ├─────────────────────────────────────────────────────────────────────┤
│ ▸Overview│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐            │
│ ▸Positions│ │Total     │ │Fees      │ │Net PnL   │ │⚠ Alerts        │            │
│ ▸Queue ②│ │$20.28    │ │$1.20     │ │+2.1%     │ │2 need action   │            │
│ ▸Scanner │ │▁▂▃▄▅ +0.4│ │▁▂▃▄▅ +.12│ │▂▃▄▃▅ green│ │CLOSE_REOPEN ×1 │            │
│ ▸Hedge   │ └──────────┘ └──────────┘ └──────────┘ │KILL ×1         │            │
│ ▸Perf.   │                                        └────────────────┘            │
│ ─────────│ ⚠ Alerts                                                             │
│ ▸Settings│ ● USDC/cbBTC out of range 4h12m → review in queue ↗                  │
│          │ ● SOL/USD1 funding −48% approaching kill → hedge book ↗              │
│          ├─────────────────────────────────────────────────────────────────────┤
│          │ Positions                                          Capital            │
│          │ Pool        Chain  Status     Cap    Fees   PnL    ┌──────────────┐  │
│          │ USDC/cbBTC  Base   OOR 4h     $45    $1.20  −0.2%  │   ◍ donut    │  │
│          │ SOL/USD1    SOL    in range   $5.00  $0.31  +1.8%  │ Base $45     │  │
│          │                                                    │ SOL  $5      │  │
│          │ Rebalance queue (2)                  see all ↗     │ idle $15.28  │  │
│          │ ▸ CLOSE_REOPEN · USDC/cbBTC · OOR                  └──────────────┘  │
│          │ ▸ KILL · SOL/USD1 · funding kill risk                                │
│          └─────────────────────────────────────────────────────────────────────┘
```

### Screen 2 — Rebalance queue (triage inbox — the critical screen)

```
│ Rebalance queue                                              2 pending   ⌘K     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1 / 2                                                          [j] next  [k] prev│
│ ┌───────────────────────────────────────────────────────────────────────────┐   │
│ │ CLOSE_REOPEN          USDC/cbBTC · Base · Aerodrome CL2000                 │   │
│ │ ─────────────────────────────────────────────────────────────────────────  │   │
│ │ Sasha: Price exited the upper bound 4h12m ago. We've stopped earning      │   │
│ │ fees. I want to close and reopen around the new price [0.0251–0.0271].    │   │
│ │                                                                            │   │
│ │ Current range  [0.0241 ──────●out──── 0.0263]   price 0.0268              │   │
│ │ Proposed range [0.0251 ────────●─────── 0.0271]                          │   │
│ │ Fees accrued $1.20  ·  est. capital preserved $44.10  ·  gas ~$0.40       │   │
│ │                                                                            │   │
│ │   [ Approve & execute ]    [ Reject ]    [ Snooze 1h ]                     │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
```

### Screen 3 — Position detail drawer

```
                                        ┌──────────────────────────────────────┐
                                        │ USDC/cbBTC · Base          ✕         │
                                        │ Aerodrome CL2000 · active            │
                                        │ ──────────────────────────────────── │
                                        │ Range                                │
                                        │ [0.0241 ──────●──── 0.0263]  in range │
                                        │ current 0.0258 · 19% to upper edge    │
                                        │ ──────────────────────────────────── │
                                        │ Capital  $45.00   Fees  $1.20  ▁▂▃▄▅ │
                                        │ Days open 3d 4h   APR (real) 41.2%   │
                                        │ ──────────────────────────────────── │
                                        │ Hedge (Hyperliquid)                  │
                                        │ Short 0.0012 cbBTC · delta drift +4% │
                                        │ Funding −12.4% annualized            │
                                        │ ──────────────────────────────────── │
                                        │ Morpho                               │
                                        │ HF [██████░░░░] 1.84 · healthy       │
                                        │ borrowed $20 · collateral $45        │
                                        │ ──────────────────────────────────── │
                                        │ On-chain                             │
                                        │ Pool ↗ · Position NFT ↗ · Hedge ↗   │
                                        │ Attestation ✓ ↗                      │
                                        │ ──────────────────────────────────── │
                                        │ [ Force rebalance ]  [ Close ]       │
                                        └──────────────────────────────────────┘
```

### State coverage

| State | LP Miner treatment |
|---|---|
| Loading | Truth strip skeleton (4 tiles), table skeleton rows. |
| Empty (no positions) | "No open positions. Run the scanner to find candidates." + CTA to Scanner. |
| Empty (no alerts) | Alert tile calm neutral "All systems nominal." |
| Partial | If Hyperliquid API down, hedge data shows "hedge data unavailable" but LP data stays live. |
| Error | Per-source error in SyncStatus; affected panels show inline error, rest works. |
| Permission denied | Investor on Performance route sees Performance only; operating routes hidden. |
| Stale | SyncStatus shows per-source stale ticks. Position rows >5min stale get a subtle indicator. |
| Live | Truth strip numbers count up; status dot pulses; new rebalance signal triggers a toast + queue badge increment. |

---

## 14. Engineering handoff

### Pre-requisites

1. **PnL history persistence** — `state/pnl-history.json`, daily snapshot per position (gross fees, IL, funding, net). Required for Performance route.
2. **IL computation** — compute on each `position-monitor.js` run via `defi-lp-math` positionDelta, store on the position.
3. **Fee accrual rate** — derive from successive snapshots.
4. **Hyperliquid funding history** — store per hedge so the funding gauge has trend, not just point value.
5. **Action execution endpoint** — the approve button needs a safe server route that calls `lp-rebalancer.js --execute` with the specific action ID, enforcing the confirmation gate. **This is the highest-risk piece — it triggers real on-chain txs. It must require explicit confirm + log every execution.**

### Stack

Same foundation (Next.js + Tailwind + Radix + Recharts). Adds:

- **cmdk** for the command palette.
- **TanStack Table** for the PositionsDataGrid (sort/filter/column config/export).
- **Server actions** (gated, audited) for the execution endpoints.
- **Auth** — this dashboard is private. Gabriel + invited investors. The investor role sees only the Performance route.

### Routes

- `/` → Overview
- `/positions`, `/positions/[id]` (drawer is URL-addressable)
- `/queue`
- `/scanner`
- `/hedge`
- `/performance` (investor-accessible)
- `/settings`
- `/api/execute/[actionId]` (gated, audited, confirm-required)
- `/api/scan` (trigger pool-scanner)

### Build sequence

1. Reuse foundation components (built during hackathon dashboards).
2. Overview route + TruthStrip + AlertPanel + positions summary — the daily glance (JTBD-01).
3. Rebalance queue + ConfirmExecutionModal + execution endpoint — the critical approve flow (JTBD-02). **Build the confirm/audit gate before the approve button is even clickable.**
4. Positions DataGrid + detail drawer (JTBD-03).
5. Pool scanner + blacklist (JTBD-04).
6. Hedge book + gauges (JTBD-05).
7. Performance route (JTBD-06) — last, needs history backfill.
8. Command palette.
9. Auth + investor role gating.
10. Lighthouse + axe.

### Definition of done

- Approve flow tested end to end on a testnet/dry-run before mainnet wiring.
- Every on-chain action requires explicit confirm (enforces CLAUDE.md rule); every execution logged to an audit file.
- Investor role cannot reach operating routes (verify with a logged-out + investor-role test).
- 1-position and 20-position states both render correctly (seed test data).
- Hyperliquid-down and Morpho-down states tested (kill the API, confirm graceful degradation).
- Real screenshots at 1440×900 (compact density) in PR.
- axe-core zero violations.

---

## Appendix — Build order across all three dashboards

Since all three share the foundation, build them in this order to maximize reuse and respect deadlines:

1. **Foundation component library** (Storybook) — built once, used by all three.
2. **Mantle Hackathon** — first deadline pressure, simplest data model, proves the system.
3. **OKX Hackathon** — May 28 deadline, reuses ~80% of Mantle's components.
4. **LP Miner** — no external deadline, most complex, build it properly with the now-mature component library.

The two hackathon dashboards fund the component library that makes the LP Miner cheap to build. That's the strategic sequencing.

---

*End of LP Miner Dashboard brief. End of deliverable.*
