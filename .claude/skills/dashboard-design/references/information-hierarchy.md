# Information Hierarchy — metric tiering

Most dashboards fail here. Every number gets equal real estate, so the eye has nowhere to land, and the user closes the tab. This reference is the discipline that prevents it.

---

## The core rule

> **Not every number deserves equal real estate.**

A dashboard is a sentence, not a phone book. The hero metrics are the subject and verb. Everything else is a subordinate clause.

---

## The three tiers

### Hero metrics — max 3 to 5

These are the numbers that, **if they're red, the user must act today.**

- Largest type on the page (`text-display-md` or larger, tabular figures).
- Prime visual position — top of the page, above the fold, left-to-right reading order.
- Always paired with a delta (vs. previous period) and ideally a sparkline.
- If you have 12 candidates for hero, you have a prioritization problem, not a hero row. Force the cut.

**Test for hero tier:** "If this number doubled overnight, would the user need to know within the hour?" If no, it's not a hero.

### Supporting metrics — max 8 to 12

Context for the heroes. They answer "why did the hero move?"

- Medium real estate — stat cards in a grid, `text-heading-md` numbers.
- No delta required, but welcome.
- Grouped by relationship to heroes (a hero about revenue gets supporting metrics about conversion, AOV, traffic).

### Drill-down metrics — everything else

- Lives **behind a click.** Not on the default view.
- Reached via a "details" link, a drill-down on a hero, or a dedicated reports page.
- This is where the long tail of "nice to have" numbers goes to live without cluttering the front page.

---

## The tiering worksheet

Fill this before designing. One row per metric the dashboard could show.

| Tier | Metric | Why it earns its tier | Source | Cadence |
|---|---|---|---|---|
| Hero | | "If red, act today" | | |
| Hero | | | | |
| Supporting | | "Explains a hero" | | |
| Supporting | | | | |
| Drill-down | | "Useful on investigation" | | |

If a metric can't articulate "why it earns its tier" in one sentence, it doesn't earn a tier. Cut it.

---

## Visual weight mapping

Real estate and type size must track the tier. The eye should rank the page automatically.

```
┌──────────────────────────────────────────────────────────┐
│  HERO 1            HERO 2            HERO 3                │  ← display-md, prime row
│  $1.2M  ↑12%       847  ↓3%          94.2%  ↑0.4%          │
│  ╱╲╱╲              ╲╱╲               ╱╱╱                   │
├──────────────────────────────────────────────────────────┤
│  [Hero chart — the one chart that answers the main Q]     │  ← 400px tall
│                                                            │
├──────────────────────────────────────────────────────────┤
│ Support  Support  Support  Support                         │  ← heading-md, grid
│ 1,234    56.7%    $89      12                              │
│ Support  Support  Support  Support                         │
├──────────────────────────────────────────────────────────┤
│  Data table (drill-down lives here, click row for detail) │  ← body-md
└──────────────────────────────────────────────────────────┘
```

The 5-second test: a stranger glances for 5 seconds, looks away. What do they remember? It should be the hero row. If they remember the data table, the hierarchy is inverted.

---

## Spatial hierarchy + the color budget

Two encodings carry hierarchy before the user reads a single label.

**Position.** The eye enters top-left and scans in a Z. The single most action-driving metric goes **top-left and largest** — not whatever the data model returned first. Size encodes "how likely is this to need me today," not "how big is the number." A vanity all-time total never earns the top-left slot; the thing most likely to be on fire does.

**Color budget.** Color is a scarce resource, not decoration. The amount of color on screen should track the amount of *trouble* on screen:
- A fully healthy dashboard is near-monochrome — neutral tone + one interactive accent.
- Warning/alert color appears **only** on items that need action.
- Resist "traffic-light overload" (a green or red dot on every row): when everything is colored, color stops meaning "look here." Show `16 active` in neutral, not 16 green dots; reserve the one warm signal for the item that's actually aging.

This is why the **all-healthy calm state is a first-class design**, not the absence of red. Done right, a single real anomaly becomes the only colored thing on an otherwise quiet screen — the entire job of an anomaly-surfacing console. (Video-sourced, 2026-06-06.)

---

## "What changed since yesterday" — the killer feature

The most-quoted interview insight across dashboard research:

> "I don't need more data. I need to know what changed since yesterday and whether I should care."

Bake this in:
- Every hero metric shows a delta against a clear baseline (yesterday / last 7 days / last period).
- Surface the **single biggest change** prominently — a "What changed" callout at the top if one metric moved dramatically.
- Use color + sign + magnitude. `↑ 12.3%` in `color-data-positive` reads in a quarter-second.
- Don't make the user compute the delta. Compute it for them.

---

## Anti-patterns specific to hierarchy

1. **The equal-card grid.** 12 identical metric cards in a 4×3 grid. No hero, no story, no entry point. The default failure mode.
2. **The hero inflation.** Everything is a hero, so nothing is. Cap at 5.
3. **The buried lede.** The most important number is in row 4 because that's where the data model put it. Reorder for the human, not the schema.
4. **The orphan metric.** A number with no comparison, no context, no baseline. "Revenue: $1.2M" tells the user nothing. "$1.2M, ↑12% vs. last month" tells a story.
5. **The vanity hero.** A big impressive number (total signups all-time) that the user can't act on. Heroes must be actionable, not just large.

---

## How tier maps to the data audit

When auditing data sources (§4 of the full brief), tag each source with the tier it feeds:
- Hero-feeding sources must be **realtime or near-realtime** and **highly reliable.** A hero metric on a daily-batch unreliable source is a trust risk.
- Drill-down sources can be slower and cheaper to query — they're behind a click, so a 2s load is acceptable.

This protects the front page from showing a confident hero number that's actually stale or wrong.
