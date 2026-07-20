# Number & Label Treatment

A number on a dashboard is a decision input, not a readout. Format it so the magnitude **and** its meaning land in under a second. This reference is the rulebook for every figure and its label.

> Distilled from the dashboard-design video set (Tufte data-ink fundamentals + Geckoboard principles), 2026-06-06. Source: `_ops/dashboard-video-distillation-2026-06-06.md`.

---

## Round to the material change

Round to the precision where the next digit wouldn't change a decision.

- `$1,384,210` → **`$1.38M`** · `94.237%` → **`94.2%`** · `1,847` → `1,847` (counts stay exact unless huge).
- False precision is a cognitive tax — every extra digit is something the eye parses, then discards.
- Display metrics: **≤3 significant figures.** Exact values live in tooltips, tables, and drill-down — not the hero strip.

## Abbreviate magnitude

- `K / M / B`, one decimal: `$1.2K`, `4.7M`, `$2.3B`.
- Unit/currency symbol the **same size** as the number, never superscript-tiny.
- Currency: 2 decimals under $100 (`$4.07`), none above (`$1,384`). Decide once, apply everywhere.
- Percentages: one decimal (`62.5%`), never raw ratios (`0.625`).

## Tabular figures, always

`font-variant-numeric: tabular-nums` on every number so columns align and magnitudes compare at a glance. (See `density-and-responsive.md`.)

---

## Every number carries context — the no-orphan rule

A bare figure is a failure. Pair each displayed metric with **at least one**:

- **Delta** vs a stated baseline — `↑12% vs last 7d`
- **Target / threshold** — `84 / 50 budget`, `$38K / $50K`
- **Status word** — from the system's fixed vocabulary, not free text
- **Comparison** — this period vs last
- **Sparkline** — shape only, last N

**The thumb test:** cover the number with your thumb. Does the label + context still tell you whether to act? If not, it's an orphan — fix it or cut it.

## Labels: what + timespan, nothing else

- Every metric states **WHAT** it is and **OVER WHAT WINDOW**: `Revenue · last 30d`, `Approvals pending`, `Spend · this week`.
- Concise. No sentence-labels.
- **Timespan is mandatory** on any metric that has one. `Clicks` is ambiguous; `Clicks · 7d` is not.
- No permanent caveat/footnote clutter. A note that's useful the first 3 times is noise the 100th — move it to a tooltip.

## Nulls state the cause (never a bare `—`)

`API down 14:32` · `Awaiting first sync` · `Not checkable (costs credits)` · `No date data`. Never a lone dash. A legitimate zero is `0`, not `—`.

---

## The bare-number test (audit mode)

Walk every number on the page. For each, four checks:
1. Rounded to the material change?
2. Abbreviated (K/M/B)?
3. Carries context (delta / target / status / comparison / sparkline)?
4. Labeled with what + timespan?

Any **no** → punch-list item. This is the fastest single pass for catching vanity-number slop.
