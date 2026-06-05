---
name: lp-miner-dashboard
description: Design decisions, palette, and Critic pass record for the LP Miner dashboard rebuild (2026-06-03)
metadata:
  type: project
---

Rebuilt `web/lp-miner/index.html` from scratch as a from-scratch Operator's Console dashboard. Single self-contained file (inline CSS + JS, Google Fonts link). Verified in Playwright at 1280px and 375px.

**Direction:** Operator's Console (Direction A). Bloomberg-dark, data-dense, hairline borders, no shadows.

**Palette:**
- Accent: Aqua #00D4FF (replaces amber -- nav dot, links, badge borders, hero badge)
- Structural: Purple #7B2FBE (range bar fill -- 35-50% opacity)
- Positive: #34D399, Negative: #F87171, Warning: #FBBF24
- Surfaces: #0A0B0F / #13141A / #1B1D26 / #06070A
- Borders: #22242E / #2D2F3B / #3E4150

**Fonts:** Montserrat 700 (H1 hero headline only), Inter Tight 600 (pos-pair, section headers), Inter (body), JetBrains Mono (all data values -- tabular figures via font-feature-settings)

**Range bar pattern:**
- `.range-track` at 12px height, border-radius 6px
- `.range-band` fills the full track with purple at 35% opacity (50% when in-range)
- `.range-marker` is 3px wide, positioned at `range.pctOfRange`%, shifts green/red based on inRange
- Distance callouts use close/warn/safe classes at <5%/<10%/>10% thresholds
- Inline labels above and below the track (no legend box)

**Hero honesty rule:** Hero = `overall.netResultUsd` + `returnPct` on `onWorkingCapitalUsd`. NAV rendered smaller as secondary metric. Idle capital shown with dashed border + IDLE badge -- never summed into working capital.

**Edge states covered:** skeleton (first load), stale dot (amber), offline banner + last-good preserved, unfunded chip (red blink), pnl-await (null pnl / RPC down), empty coached state, "No hedge open" state.

**Critic result (2026-06-03, v1):** Clean pass. 20/20 rules + CRAP + anti-slop floor. No revision needed.

**Extension (2026-06-03, v2) — 7 analytics + middot fix:**
- IL pair (raw vs after-hedge) in setup col, `.il-pair` 2-column tile grid
- APR stack (4 lines: total/fee/emission/funding) in perf col, `.apr-block`
- Yield pending vs claimed in perf col, `.yield-block` with two rows (fees + emissions)
- Cost basis 4-cell strip (invested/current/withdrawn/net diff), `.costbasis-strip`
- Net delta signed line (LP long - hedge short = net units + USD), `.delta-line`
- Benchmark 3-cell row (HODL / LP vs HODL / net after hedge), `.benchmark-row`
- Age + gas as a single `age-gas-line` meta strip replacing old `Opened` stat-row
- Middot: `txt.textContent` uses literal `·` char (UTF-8 c2b7), not `&middot;` entity — verified correct, entity would render as text via textContent
- Em dash catch: `yield-block-head` had "—" replaced with ":" during Critic pass
- All 7 blocks null-guarded: show "Awaiting on-chain sync" when field is absent
- Critic v2 result: 20/20 + CRAP + anti-slop floor. Clean pass.

**Extension (2026-06-05, v3) — Standalone Net Delta card:**
- Replaced the crammed `.delta-line` strip (inline inside position card perf col) with a full-width standalone `.net-delta-card` positioned between the book-summary card and the Open Positions eyebrow.
- New components: `.ndc-track-wrap` (8px tall zero-centered bar, `--border-emphasis` bg), `.ndc-fill` (aqua from center rightward when long-heavy, red leftward when short-heavy), `.ndc-center-tick` (1px faint vertical at 50%), `.ndc-marker` (10px diamond rotated 45deg, aqua, no glow), endpoint labels (`.ndc-labels`), annotation line (`.ndc-annotation`).
- Badge logic: `|netUnits/hedgeShort| <= 5%` → `.hero-badge.green` "DELTA-NEUTRAL"; >5% long → `.hero-badge.warn` "LONG SKEW"; short → `.hero-badge.warn` "SHORT SKEW". Uses semantic `--warning` for skew -- not a second accent.
- JS: `renderNetDeltaCard(d)` aggregates `positions.items[].netDelta` by asset. Multi-asset capable (byAsset loop). Falls back to empty string if no open positions with netDelta.
- Data fields used: `p.netDelta.asset`, `p.netDelta.lpLong`, `p.netDelta.hedgeShort`, `p.netDelta.netUnits`, `p.netDelta.netUsd`, `p.hedge.markPx` (for % of notional calculation).
- Critic v3 result: 20/20 + CRAP + anti-slop floor. One Rule 15 fix applied (padding was `20px 28px 18px`, fixed to `20px 28px`). One Rule 8 fix applied (center label bumped from 9px to 10px, color from `--text-quaternary` to `--text-tertiary` for contrast ≥4.16:1 at large uppercase). Clean pass after fixes. Playwright QA: 375px/768px/1440px all pass, no horizontal overflow.
- Key measurement: marker at `57.45%` from left (net long 0.00175 WETH residual = 14.2% of notional = LONG SKEW badge). When hedge exactly matches LP long, marker is at 50% = "DELTA-NEUTRAL".
- Removed: `.delta-line` CSS block + all `netDeltaHtml` JS references from `renderPositionCard`.

**Why:** Gabriel chose "Operator's Console + Aqua accent" for the whole dashboard family. Purple is the Sasha brand structural color, used for the range band.

**How to apply:** Future LP Miner redesigns or N-th position card additions should follow this file's CSS tokens exactly. The `positions-grid` is already a single-column grid -- adding a 2nd card is automatic (just `renderPositionCard(p)` again). The Net Delta card is book-level (one per asset), not per-position.
