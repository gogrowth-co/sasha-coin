# Density & Responsive Strategy

Two decisions most dashboards get wrong by default: they inherit Tailwind's comfortable spacing for power users who want density, and they design mobile-first for a product that lives on desktop.

---

## Density modes

Match density to **how often the user opens the dashboard.** A once-a-week exec wants air. A power user staring at it all day wants more on screen.

| Mode | Use case | Spacing multiplier | Font scale | Default for |
|---|---|---|---|---|
| **Comfortable** | First-time, demo, infrequent use | 1.0× | Default | Marketing screenshots, exec drop-in views |
| **Cozy** | Daily user, wants more on screen | 0.75× | −1 step | The default for a daily-use operational dashboard |
| **Compact** | Power user, multi-monitor, terminal-style | 0.5× | −2 steps + tabular figures | Ops consoles, trading-style views, fleet dashboards |

### Should you offer a density toggle?

- **Single-user internal tool:** No toggle. Pick the right density for that user and commit. (Gabriel's task boards → Cozy or Compact, not Comfortable.)
- **Multi-user product:** Offer a toggle, default to Cozy, persist the preference.
- **Demo / sales asset:** Comfortable, because density reads as "cluttered" to a stranger seeing it for the first time.

The most common mistake: shipping Comfortable to a daily power user because that's the framework default. Daily users perceive air as wasted scrolling.

---

## Responsive strategy — desktop-first, not mobile-first

> **Dashboards are a desktop-primary product. Design for `bp-xl` (1280px) first, then degrade gracefully.**

This is the opposite of marketing-site practice. A dashboard squeezed into a phone is a worse experience than a focused mobile "drop-in" summary. Don't pretend the full grid works at 375px.

| Breakpoint | Width | Strategy |
|---|---|---|
| `bp-3xl` | 1920+ | Wide desktop. Apply a max-width to content — the dashboard isn't wallpaper. Center it or add a useful third column, don't just stretch. |
| `bp-xl` | 1280 | **Default canvas. Design here first.** |
| `bp-lg` | 1024 | Sidebar collapses to icon-only. Multi-column metric grids may drop one column. |
| `bp-md` | 768 | Sidebar becomes a hamburger drawer. Data tables become stacked cards. Charts go full-width single-column. |
| `bp-sm` | 640 | Single column everything. "Drop-in" mode: hide power features, expose only the daily-check-in summary (hero metrics + the one chart that matters). |
| `<bp-sm` | <640 | Honest scope reduction. Not every feature works on a phone, and that's fine. |

### The mobile "drop-in" mode

The exec checking status from their phone during a meeting doesn't need the data table, the filters, or the drill-downs. They need: the 3 hero metrics, their deltas, and a one-line "anything on fire?" status.

Design this as a **deliberate reduced view**, not a broken full view. It's a feature, not a fallback.

### Desktop-only features

Some things genuinely don't work on small screens: dense data tables with many columns, side-by-side comparisons, multi-panel layouts. For these:
- Detect the viewport.
- Show a clean message: "This view is best on a larger screen. Here's your summary instead." + the drop-in summary.
- **Never** show a broken, horizontally-scrolling, pinch-to-zoom mess. That's worse than an honest scope reduction.

---

## Grid system

- Base everything on an **8px grid** (per design-principles). All spacing snaps to 8/16/24/32/48/64/96/128.
- Use a **12-column layout grid** at `bp-xl` for flexible widget arrangement (a hero spans 8, a sidebar widget spans 4, etc.).
- Metric cards: 3 or 4 across at `bp-xl`, 2 across at `bp-md`, 1 at `bp-sm`. Never 5+ across — they get too narrow to read the numbers.

---

## Spacing semantics for dashboards

Beyond the raw scale, define dashboard-specific semantic spacing:

```
space-widget-gap      # Between sibling widgets/cards (space-4 = 16px at Comfortable, 12px at Cozy)
space-section-gap     # Between major page sections (space-7 = 48px)
space-card-padding    # Inside a metric card (space-5 = 24px Comfortable, 16px Cozy, 12px Compact)
space-page-padding    # Page outer padding (space-6 desktop = 32px, space-4 mobile = 16px)
space-table-row       # Data table row height (48px Comfortable, 40px Cozy, 32px Compact)
```

Table row height is the single biggest density lever — a Compact 32px row fits 50% more rows on screen than a Comfortable 48px row, which is exactly what a power user scanning a long task list wants.

---

## Tabular figures — mandatory for data

Any column of numbers must use **tabular (monospaced) figures** so digits align vertically and the eye can compare magnitudes at a glance.

- Set `font-variant-numeric: tabular-nums` on all numeric data.
- Use a font that has good tabular figures (Inter, Söhne, JetBrains Mono all do).
- This matters most in Compact mode where numbers are dense — misaligned proportional figures turn a clean column into visual noise.
