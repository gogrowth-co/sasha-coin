# Chart Selection — decision tree, anatomy, color rules

The single biggest source of dashboard slop is the wrong chart type. This reference is the rulebook.

---

## The decision tree

Start at the top. The first matching branch wins.

```
Is the user looking at a single number's trend?
  → Big number + sparkline + delta (NOT a full chart)

Is the user comparing values across categories?
  → Bar chart
    - Horizontal bar if labels are long (>15 chars) or there are >7 categories
    - Vertical bar otherwise
    - Always zero-baseline
    - Sort by value descending unless the order has inherent meaning (time, alphabet)

Is the user tracking change over time?
  → Line chart (3+ series) or Area chart (1–2 series, when volume is the story)
    - Line if rate of change matters
    - Area if cumulative magnitude matters
    - Stacked area only when total + composition both matter
    - Never use a stacked line — it's unreadable

Is the user looking at part-to-whole at a single moment?
  → Stacked bar (single bar with segments) — preferred
  → OR a donut, ONLY IF: 2–4 segments AND the proportions are visually distinct
  → NEVER a pie chart for >4 segments
  → NEVER a pie chart at all if you can use a stacked bar instead

Is the user looking at distribution?
  → Histogram (continuous data) or box plot (with outliers / quartiles)

Is the user looking at correlation between two variables?
  → Scatter plot
  → Add a trend line only if statistically meaningful (R² > 0.5)

Is the user looking at density across two dimensions?
  → Heatmap (calendar heatmap for time × category is excellent for activity data)

Is the user looking at hierarchical part-to-whole?
  → Treemap (if rectangular density is fine)
  → Sunburst only if hierarchy depth is the story

Is the user looking at flow or transition between states?
  → Sankey diagram
  → NOT a chord diagram unless the audience already knows how to read it
```

### Chart types to use with extreme caution

- **Radar / spider chart** — almost always wrong. Forces visual area perception that humans are bad at. Use a bar chart with sorted values instead.
- **Bubble chart** — only when 3 dimensions truly need showing. Otherwise scatter.
- **Gauge / speedometer** — fine for a single bounded metric (0–100 utilization). Never for unbounded values.
- **3D anything** — banned. Always. No exceptions.

---

## Chart anatomy — the universal spec

Every chart in the system follows these rules. If you find yourself bending one, document why.

### Title and subtitle

- **Title:** above the chart, left-aligned, `text-heading-sm`, sentence case ("Revenue by region" not "Revenue By Region" or "REVENUE BY REGION")
- **Subtitle / context:** below title, `text-body-sm`, `color-text-secondary`. Use this to specify the period ("Last 30 days") or the comparison baseline ("vs. previous period").
- If the chart is inside a card whose header already conveys context, skip the chart's own title to avoid double labels.

### Axes

- **Y-axis on bar charts: always start at zero.** Non-zero baselines on bars are visual lies. If you need to show small changes, use a different chart or a delta indicator.
- **Y-axis on line charts:** may use a non-zero baseline IF the change is the story. Flag this explicitly with a "Δ" indicator or a subtitle note.
- **X-axis for time series:** label sparsely. 7-day chart: every day. 30-day: every Monday or every 5th day. 1-year: monthly. Never label every tick on a dense series.
- **Y-axis labels:** abbreviated for thousands (`1.2K`, `1.2M`, `1.2B`). Currency symbol on the first label only, not every tick.

### Gridlines

- **Hairline weight only** (`border-hairline`, `color-border-subtle`).
- **Horizontal gridlines** for value-axis readability — always on.
- **Vertical gridlines** only on time-series with discrete intervals. Never on continuous scatter.

### Legend

- **Below the chart, left-aligned** by default.
- **Above** only if the chart is short and wide and the legend would compete with the data for vertical space.
- **Inline labels** (next to each series end) when there are ≤3 series — always superior to a separate legend. Save the user a glance.
- **Skip the legend entirely** when there's only one series — the title says what it is.

### Tooltip

- **On hover only**, not on click.
- **Shows exact values for that x-position across all series** — not just the hovered series.
- **Crosshair line** drops from cursor to x-axis (and to y-axis if it helps).
- **Snaps to data points** on time series — never free-floats.
- **Use tabular figures** in the tooltip number formatting so digits align.
- **Position:** above and right of cursor by default; flip when near edges.

### Empty state

- **Not a generic "No data" rectangle.** Each chart type has its own empty illustration plus contextual copy:
  - Time series: "No activity in this period. Try expanding the date range."
  - Categorical: "No categories match these filters. Clear filters."
  - Distribution: "Need at least 5 data points to draw a meaningful distribution."

### Loading state

- **Skeleton shaped like the chart.** Bar chart → grey bars at varying heights. Line chart → a horizontal grey line. Never a generic rectangle.
- **Never a spinner.** A spinner says "we don't know how long this will take." A skeleton says "we know what's coming."

### First-render animation

- **600ms ease-out** by default.
- **Bar charts:** grow from baseline upward.
- **Time series:** draw left-to-right.
- **Stacked anything:** layers fade in bottom-to-top, 80ms stagger.

### Data update animation

- **None.** When a data point changes, snap to the new value with a brief flash of the changed point (300ms accent color pulse).
- **Animating data updates obscures change.** The whole point of a dashboard is to perceive change. Don't hide it behind a tween.

---

## Color rules

The hardest part. Most dashboards die here.

### Single-series chart

Use `color-action-primary` for the line / bar / area. Don't get creative. Don't use a gradient. One color, one series.

### Two-series comparison

- Primary color (`color-action-primary`) + a clearly contrasting accent.
- **Never two similar hues** ("light blue and slightly darker blue"). Use distinct hues.
- If "good vs. bad" is the implicit meaning (planned vs. actual, target vs. actual), use `color-data-positive` and `color-data-neutral`.

### Categorical (3–8 series)

- Use the `color-data-series-1` through `-8` palette **in order**, not at random.
- The palette must be tested for color-blind safety (Deuteranopia + Protanopia + Tritanopia — Sim Daltonism or similar).
- **Never 9+ categories in a single chart.** Aggregate "Other" or split into facets.

### Sequential (heatmap, choropleth)

- Single-hue ramp from light to dark.
- Use OKLCH lightness ramps, not HSL — humans perceive OKLCH lightness more linearly.

### Diverging (good vs. bad on a continuous scale)

- Two-hue ramp meeting at a neutral midpoint.
- Default: `color-data-negative` (red-orange) → neutral (warm grey) → `color-data-positive` (teal-green).
- **Never red-green diverging** without color-blind testing. Red and green are the worst colorblind pair.

### Semantic color (when up/down has clear directional meaning)

- Positive values may use `color-data-positive`, negative `color-data-negative` — but **only when up/down has clear directional meaning**.
  - Stock price change: yes.
  - Revenue change: yes.
  - **Number of users: no.** More users isn't "positive" in a chart sense — it's just bigger.
  - **Page load time: inverted** — lower is better. Use directional color carefully.

### Highlight color

- Use exactly **one** color for "this is the thing you should look at right now."
- Everything else is grey, default, or palette.
- The eye has to land somewhere on first glance. Decide where.

---

## Chart hierarchy (size and position)

| Chart role | Size | Position | Detail level |
|---|---|---|---|
| **Hero chart** | Full-width or 2/3 width × ~400px tall | Top of page, above the fold | Full axes, legend, tooltip, annotations |
| **Card chart** | Inside a stat card, ~80px tall | Grid of cards in main content | Minimal: shape only, maybe one data point on hover |
| **Sparkline** | Inline with a number, ~24px tall | Anywhere a single metric appears | No axes, no legend, color only |
| **Embedded chart** | Inside tables, modals, drawers | Contextual | Reduced detail, no titles (context provides them) |
| **Full-page report chart** | Up to viewport width × 600px | Dedicated reports page | Everything — including data table toggle for accessibility |

A page should have **one** hero chart, not three. If you can't pick one, the page doesn't have a primary question yet.

---

## The "big number" pattern (the most-used dashboard component)

When you have a single metric to feature, the canonical structure is:

```
┌─────────────────────────────────┐
│ Label (label, secondary text)   │
│                                 │
│ $1,234,567        ↑ 12.3%       │ ← Hero number + delta
│                                 │
│ vs. previous 30 days            │ ← Comparison context
│                                 │
│ ╱╲      ╱╲                      │
│   ╲╱  ╱   ╲╱╲                   │ ← Sparkline (last 30 days)
│      ╱                          │
└─────────────────────────────────┘
```

Rules:
- **Hero number:** largest type on the card. Tabular figures. Currency or unit symbol same size as number, not smaller.
- **Delta:** colored only if directional meaning is clear. Always include sign (+/−) and "vs. baseline" copy.
- **Sparkline:** no axes, no values, just shape. Adds emotional resonance without competing for attention.
- **Don't crowd:** no more than 4 elements per big-number card. Label + number + delta + sparkline. That's it.

---

## When to add a data table toggle

Accessibility requirement: every chart should have an alternate tabular view, reachable via a single toggle near the chart.

This is also useful for power users who want exact values. Don't bury it — put it in the chart's overflow menu (the `...` icon) labeled "View as table."

---

## Animation taxonomy — when chart motion is allowed

| Moment | Allowed? | Spec |
|---|---|---|
| First paint | Yes | 600ms ease-out, directional per chart type |
| Filter change | Yes | 300ms crossfade between old and new data |
| Data point update | No | Snap + 300ms color flash on changed point only |
| Hover | Yes | 120ms ease-out on tooltip + crosshair |
| Drill-down click | Yes | 240ms slide + fade |
| Resize | Yes (debounced) | 180ms ease-out after debounce |
| Realtime data stream | No animation | Snap. Add a "Live" indicator instead. |

Reduced-motion users get no first-paint animation and instant filter changes. The chart still looks correct, just still.
