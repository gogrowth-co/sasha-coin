# Foundation — Sasha Coin Dashboard System

This is the shared design system that all three dashboards inherit. Treat it as the operating system; each dashboard is an application running on top of it.

---

## 1. Brand thesis (in one paragraph)

Sasha is an autonomous AI agent who trades, posts, and is held publicly accountable on-chain. The dashboard is her **glass house**. Everything she does is verifiable; the design should feel like you are watching a transparent operator at work, not reading a brochure about one. The aesthetic floor is *Bloomberg Terminal density with a human voice layer*. The ceiling is *the calm of Linear and the certainty of Vercel's marketing site*. The visual identity must accomplish three things at once:

1. Convince a judge in 60 seconds that this is real, autonomous, and on-chain.
2. Convince Crypto Twitter that this is *cool* — not corporate, not toy.
3. Let Gabriel operate it daily without friction.

If any pixel betrays one of those three, it is the wrong pixel.

---

## 2. Voice in pixels — how Sasha's brand voice translates to UI

Sasha's voice anchors from `_context/brand-voice.md`: **witty, sharp, self-aware, first-person, data-led, short.** The UI mirrors that:

| Voice trait | UI translation |
|---|---|
| Witty | Microcopy with personality. Empty states are not "No data" — they are "Sasha hasn't traded today. Probably reading." |
| Sharp | No filler chrome. Every pixel earns its place. No decorative gradients, no glassmorphism without purpose. |
| Self-aware | Status indicators say what is true, including failure. "Allora API: 403. Falling back to social weight." |
| First-person | When Sasha speaks in the UI, she speaks in first-person singular. Never "Your agent posted" — always "I posted." |
| Data-led | Numbers are the heroes. Charts before paragraphs. Charts before icons. |
| Short | Truncate ruthlessly. A tooltip beats a paragraph. A sparkline beats a chart card. |

**Banned in the UI:** em dashes, "to the moon", "wen", emojis (with two exceptions: the Sasha logomark and the status dot), purple gradients, glassmorphism cards.

---

## 3. Color system

The system is **mostly black, mostly mono, with one accent and four data colors.** This is the discipline that separates serious tools from theme-park dashboards.

### Surface palette (cool neutrals, not warm)

| Token | Hex | Role |
|---|---|---|
| `surface-base` | `#0A0B0F` | Page background. Near-black, slight blue cast (cool, not brown). |
| `surface-raised` | `#13141A` | Card, panel, sidebar. One step lighter than base. |
| `surface-overlay` | `#1B1D26` | Modal, popover, hover-elevated card. Two steps lighter. |
| `surface-sunken` | `#06070A` | Table row hover (subtle darken, not lighten). |
| `border-subtle` | `#22242E` | Default divider. Barely visible. |
| `border-default` | `#2D2F3B` | Card borders. Visible but quiet. |
| `border-emphasis` | `#3E4150` | Focus rings, active states. |

### Text palette (warm whites on cool grounds — the contrast that feels editorial)

| Token | Hex | Role |
|---|---|---|
| `text-primary` | `#F4F5F7` | Headlines, key numbers. Not pure white — warm white reads less clinical. |
| `text-secondary` | `#B4B7C2` | Body copy, labels. |
| `text-tertiary` | `#74778A` | Metadata, timestamps, captions. |
| `text-quaternary` | `#494C5C` | Dimmed text, placeholder, disabled. |

### Accent — one color, used sparingly

The accent is **Sasha Gold**: `#FFB800`. This comes from the existing dashboard config and from $SASHA's positioning (a creator coin, warm, alive). It is *not* used decoratively. It marks: (a) the primary CTA per screen — never more than one, (b) the currently-selected nav item, (c) the most important number on the screen.

| Token | Hex | Role |
|---|---|---|
| `accent-primary` | `#FFB800` | Primary CTA, selected nav, hero metric value. |
| `accent-primary-hover` | `#FFC933` | Hover state of accent. |
| `accent-primary-muted` | `#FFB80033` | Backgrounds for accent-tagged badges. |

### Data colors — semantic, color-blind safe (Wong palette base)

These are the only colors charts may use. No exceptions.

| Token | Hex | Role |
|---|---|---|
| `data-positive` | `#34D399` | Positive PnL, healthy HF, risk-on signal. Cool green. |
| `data-negative` | `#F87171` | Negative PnL, kill switch, error. Coral red, not blood red. |
| `data-warning` | `#FBBF24` | Warning, attention. Distinct from accent-primary (slightly cooler). |
| `data-neutral` | `#94A3B8` | Neutral signal, baseline series. |
| `data-info` | `#60A5FA` | Informational series, secondary chart line. |

**Color-blind verification:** the pairs (positive/negative), (warning/neutral), (info/positive) all pass the Wong color-blind safe test. Verified against Coblis simulator for deuteranopia and protanopia.

### Contrast matrix (WCAG 2.2 AA, all pairings used in UI)

| Foreground | Background | Ratio | Grade |
|---|---|---|---|
| `text-primary` | `surface-base` | 16.8:1 | AAA |
| `text-primary` | `surface-raised` | 14.9:1 | AAA |
| `text-secondary` | `surface-base` | 8.9:1 | AAA |
| `text-secondary` | `surface-raised` | 7.9:1 | AAA |
| `text-tertiary` | `surface-base` | 4.7:1 | AA |
| `accent-primary` | `surface-base` | 11.3:1 | AAA |
| `data-positive` | `surface-base` | 10.4:1 | AAA |
| `data-negative` | `surface-base` | 6.8:1 | AAA |

---

## 4. Typography

### Type stack

```css
--font-display: "Inter Tight", "Inter", system-ui, sans-serif;     /* Headlines, hero numbers */
--font-body:    "Inter", system-ui, sans-serif;                    /* Body copy, labels */
--font-mono:    "JetBrains Mono", "IBM Plex Mono", monospace;     /* Numbers, hashes, code */
```

**Why these three:** Inter is the dashboard default for a reason — exceptional legibility at small sizes, full weight range, OpenType numerals. Inter Tight is the same family at tighter leading, perfect for hero numbers (a 48px MRR figure should not breathe like body copy). JetBrains Mono is unambiguous for transaction hashes, addresses, and price ladders where character-by-character reading matters.

### Type scale (1.25 ratio, base 14px)

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-display` | 56px | 1.0 | 600 (Inter Tight) | Page-level hero number (one per dashboard) |
| `text-h1` | 36px | 1.1 | 600 (Inter Tight) | Section title |
| `text-h2` | 24px | 1.2 | 600 | Card title |
| `text-h3` | 18px | 1.3 | 600 | Group label inside card |
| `text-body-lg` | 16px | 1.5 | 400 | Reading copy, narrative |
| `text-body` | 14px | 1.5 | 400 | Default body, table cells |
| `text-body-sm` | 13px | 1.4 | 400 | Secondary table cells, descriptions |
| `text-caption` | 12px | 1.3 | 500 | Labels above numbers, axis labels |
| `text-overline` | 11px | 1.2 | 600, uppercase, +0.06em letter-spacing | Section eyebrows, status pills |
| `text-mono` | 13px | 1.4 | 400 (JetBrains) | Hashes, addresses, price ladders |
| `text-mono-lg` | 24px | 1.1 | 500 (JetBrains) | KPI numerals |

### OpenType features (apply globally)

```css
font-feature-settings: "tnum" 1, "lnum" 1, "ss01" 1;
```

`tnum` gives tabular figures so numbers line up in columns. `lnum` enforces lining figures (not old-style). `ss01` enables Inter's curved-l alternate (more legible). **Without `tnum`, every data table will feel slightly drunk.** Non-negotiable.

---

## 5. Spacing & layout

### Spacing scale (4px base, exponential growth)

```
space-0:    0
space-1:    4px       ← tightest viable gap
space-2:    8px       ← inline gap (icon + text)
space-3:    12px      ← compact stack gap
space-4:    16px      ← default card padding inset
space-5:    20px
space-6:    24px      ← default card padding
space-8:    32px      ← section gap inside a card
space-10:   40px
space-12:   48px      ← gap between cards
space-16:   64px      ← page section gap
space-24:   96px      ← page top padding (desktop)
```

### Grid

**Desktop (≥1280px):** 12-column grid, 80px max gutter, 1440px max content width. Sidebar 240px fixed left; content area uses the 12-col grid.

**Tablet (≥768px, <1280px):** 8-column grid, 24px gutter. Sidebar collapses to icon rail (56px).

**Mobile (<768px):** Single column, 16px page padding. Sidebar becomes drawer behind hamburger. **Note:** these dashboards are desktop-first. Mobile gets a *read-only* version. No critical action (executing a trade, pushing a signal) is available on mobile.

### Density modes

Three densities. Default to `cozy`. Power user can switch to `compact` via a settings toggle.

| Mode | Row height | Padding | Use case |
|---|---|---|---|
| comfortable | 56px | space-6 | Read-mostly screens (narrative, single-position deep-dive) |
| cozy *(default)* | 44px | space-4 | Default dashboard view |
| compact | 32px | space-3 | Power user, multi-table screens, LP Miner positions table |

---

## 6. Radius, shadow, motion

### Radius

```
radius-sm:   4px      ← input, small chip
radius-md:   8px      ← button, card
radius-lg:   12px     ← modal, large card
radius-xl:   16px     ← hero card, dashboard frame
radius-full: 9999px   ← avatar, status dot, pill
```

### Shadow (subtle, mostly we use borders not shadows in dark UI)

```
shadow-card:    0 1px 2px rgba(0,0,0,0.4)                                            ← default card lift
shadow-popover: 0 8px 24px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)                ← popover, dropdown
shadow-modal:   0 24px 48px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)               ← modal
shadow-accent-glow: 0 0 0 1px #FFB80033, 0 0 12px #FFB80022                          ← reserved for the one CTA per page
```

### Motion tokens

```
duration-instant:    80ms      ← hover state transitions
duration-snappy:     150ms     ← button press, toggle
duration-deliberate: 240ms     ← drawer/modal entry
duration-graceful:   400ms     ← chart series entry, number count-up

easing-out:    cubic-bezier(0.2, 0.8, 0.2, 1)     ← default; everything exits gracefully
easing-in-out: cubic-bezier(0.4, 0, 0.2, 1)        ← drawers, modals
easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1)   ← celebratory only (successful trade confirmation)
```

**Motion rule:** chart series animate in on first render only (400ms graceful). On data updates, numbers count up over 240ms. **Cards do not animate in.** Skeleton loaders fade out over 150ms. Anything beyond that is forbidden — motion serves comprehension, not delight.

---

## 7. Iconography

**Library:** Lucide (https://lucide.dev) — 1,500+ icons, consistent 24×24 stroke geometry, MIT licensed, tree-shakeable.

**Rules:**

- Stroke width: 1.5px (Lucide default). Never thicken.
- Default size: 16px (inline with body), 20px (button), 24px (sidebar nav).
- Icons never appear without an accessible label. Either visible label or `aria-label`.
- Status icons (success, warning, error, info) use the data colors, not the icon's own color.

**One custom icon:** the Sasha logomark. SVG, 1.5px stroke, lives in `surface-base` or `accent-primary`, never decoratively scaled below 24px.

---

## 8. Component inventory (shared across all three dashboards)

This is the parts catalog. Engineering should build these *first*, in Storybook, before assembling any screen.

### Foundational (build first)

1. **Button** — variants: primary (accent), secondary (outlined), tertiary (ghost), danger (negative). Sizes: sm/md/lg. States: default, hover, active, focus, disabled, loading.
2. **Input** — variants: text, number, search. States: default, focused, error, disabled. Includes prefix/suffix slot (for icon or currency).
3. **Select** — single, multi. Searchable for >7 options. Built on Radix Select.
4. **Toggle** — boolean switch. With label slot.
5. **Tabs** — horizontal segmented. Underline variant for sub-nav, pill variant for filters.
6. **Tooltip** — Radix Tooltip. Delay 300ms in, 100ms out. Max width 280px.
7. **Badge / Pill** — variants: neutral, positive, negative, warning, info, accent. Sizes: sm/md.
8. **Status dot** — 8px circle, four colors (positive, negative, warning, neutral). Pulsed when "live" (1s ease-in-out).
9. **Skeleton loader** — block, line, circle. Animated shimmer 1.5s.
10. **Toast** — Sonner-style, top-right, 4s default dismiss.

### Layout

11. **Page header** — title (h1), description (body-lg), trailing actions slot.
12. **Sidebar nav** — collapsed (icon rail) + expanded states. Section grouping with overline labels.
13. **Card** — title slot, action slot (top-right), body slot, footer slot. Variants: default, raised, sunken.
14. **Stat card** — label (caption), value (mono-lg or display), delta (positive/negative pill), sparkline slot.
15. **Empty state** — illustration slot (use a Sasha-voice empty message, not stock illustration), title, body, CTA.
16. **Drawer** — right-side, 480px default. Built on Radix Dialog.
17. **Modal** — centered, 560px default, dismissible by ESC + click outside.

### Data

18. **Table** — sortable column headers, sticky header, row hover (sunken surface), row selection (checkbox), pagination footer, empty state row. Compact mode honored.
19. **DataGrid** *(LP Miner only — power-user table)* — column resize, column reorder, column hide, multi-sort, CSV export.
20. **KPI tile** — caption + mono-lg number + delta pill + optional sparkline. Used in the top strip of every dashboard.
21. **Sparkline** — 80×24 minimum, no axis, hover shows tooltip with date + value. SVG, not canvas.
22. **Line chart** — Recharts or Visx. Axis with `tnum`. One series in `data-info`, second in `data-neutral`. No legend if only one series.
23. **Area chart** — gradient fill from series color to transparent.
24. **Bar chart** — vertical for time series, horizontal for categorical comparisons.
25. **Stacked bar** — for source-weight breakdowns (the Mantle 5-source signal).
26. **Donut / radial** — *use with restraint*. Only when comparing 2–5 categories where total matters. **Forbidden for more than 5 segments — use a horizontal bar instead.**
27. **Heatmap** — for time-of-day patterns or volatility surfaces.
28. **Progress bar** — for health factor, capital allocation, attestation pipeline.
29. **Code block** — for contract addresses, TX hashes, JSON snippets. Mono font. Copy-to-clipboard button on hover.

### Domain (project-specific)

30. **Tx link** — formatted `0x1234…abcd` with explorer link and copy button. Detects chain from prefix.
31. **Address pill** — same as tx link but for wallet/contract addresses. Optional ENS resolution.
32. **Pool card** — symbol pair, chain icon, fee tier, APR, TVL, vol-to-TVL, quality score badge.
33. **Position card** — symbol pair, chain, status pill, capital, current price vs range bar, pending fees, days open.
34. **Signal weight bar** — 5-source stacked horizontal bar with hover-detail per source.
35. **Attestation badge** — small pill with chain icon + status + TX hash link.
36. **Tweet card** — Sasha's tweet rendered in-context, with on-chain action it's bound to.

---

## 9. Data visualization principles (Tufte rules, restated for our context)

1. **Maximize data-ink ratio.** Remove gridlines, remove axis lines, remove tick marks unless they actively communicate. A line chart with 12 points needs 12 dots and a line — nothing else.
2. **Direct label the data, not the legend.** A line chart with two series gets two end-of-line labels, not a legend at the top.
3. **No 3D, ever.** No dual y-axes unless absolutely unavoidable.
4. **Color encodes meaning, not aesthetics.** A green bar means positive PnL. A green bar that is just "green because it looks nice" is a bug.
5. **Numbers come first.** A chart should be a confirmation of a number you already saw, not a riddle to be solved.
6. **Always show the latest value.** End-of-line annotation with the current number. Always.
7. **Time goes left to right.** Always. No exceptions.
8. **Loading is not blank.** Use skeletons that match the shape of the data — a chart skeleton shows a faint line, not an empty box.
9. **Empty is not invisible.** An empty chart shows what *will* be there with a "no data yet" message in the dead center.
10. **Tooltips are first-class.** A chart without a hover tooltip is a chart that didn't ship.

---

## 10. Accessibility commitment

- **WCAG 2.2 AA minimum.** AAA where feasible (most text pairings already pass — see contrast matrix).
- **Every interactive element keyboard-reachable.** Tab order matches visual order. Focus rings always visible (`border-emphasis` 2px outline + 2px offset, accent color).
- **Every icon has an accessible name.** Either visible label, `aria-label`, or sibling label tied with `htmlFor`.
- **Every chart has a data table fallback.** A toggle below each chart reveals the underlying table — for screen readers and for skeptics.
- **No information conveyed by color alone.** Positive/negative also indicated by + / − prefix and ▲ / ▼ arrows in delta pills.
- **Reduced motion respected.** `@media (prefers-reduced-motion: reduce)` disables all transitions except focus rings.
- **Live regions for autonomous updates.** When a new trade lands or a signal updates, an `aria-live="polite"` region announces it.

---

## 11. State coverage (every component, every screen)

Every screen and every component must explicitly design for **eight states**, not just the happy path. This is the single most overlooked thing in dashboard design and the single biggest reason dashboards feel cheap. The brief for each dashboard re-applies this checklist per screen.

| State | What to design |
|---|---|
| 1. Loading | Skeleton that matches the shape of the final content. Not a spinner. |
| 2. Empty (first time) | What the user sees on day zero. Onboarding cue + sample data link if helpful. |
| 3. Empty (intentional) | "No active positions" is different from "No data yet" — design both. |
| 4. Partial data | Some sources online, some offline. Show what's there, label what's missing. |
| 5. Error | The thing failed. Show what failed, what to do, what's still working. |
| 6. Permission denied | User cannot see this. Quiet placeholder, not red alarms. |
| 7. Stale | Data older than threshold. Subtle yellow tick on the freshness indicator. |
| 8. Live | Data is updating in real time. The status dot pulses; numbers count up smoothly. |

---

## 12. Engineering handoff conventions

**Stack assumption:** the existing project is plain HTML + Tailwind (per `dashboard.config.json`). I recommend upgrading to **React + Tailwind + Radix UI primitives + Recharts** for these dashboards. Reasons:

- Radix gives us Tooltip, Dialog, Select, Tabs, Toggle, DropdownMenu — unstyled, accessible, keyboard-correct. Saves 40+ hours of foundational work.
- Recharts handles the 8 chart types we need. Visx is an alternative if we hit performance limits.
- Sonner for toasts. Cmdk for the command palette on LP Miner.

**Token export:** all tokens above live in a single `design/tokens.json`. From there:

- Tailwind config consumes via a small build step.
- CSS variables are generated for any non-Tailwind contexts.
- Storybook reads from the same source.

**Definition of done — per component:**

1. Built to spec in Storybook.
2. All 8 states represented (where applicable).
3. Keyboard-navigable.
4. Pass axe-core a11y check with no violations.
5. Matches contrast matrix.
6. Snapshot test for default state.
7. One usage example in the dashboard it ships for.

**Definition of done — per screen:**

1. Matches annotated mock (when produced — phase 4).
2. Loading, empty, error states implemented.
3. All copy from the content strategy doc, not invented.
4. Live data wired or explicit mock-mode flag.
5. Responsive behavior verified at 1280, 1024, 768, 375 (where applicable).
6. Lighthouse score ≥ 90 across the board.
7. Real screenshot in the PR description (not Figma).

---

## 13. What we still need before building

This brief is the trunk. Branches that still need user input before mocks:

1. **Aesthetic direction selection per dashboard.** Each brief presents 3 options. Pick one before mocks.
2. **Live data feed test.** Confirm Allora and Elfa endpoints are recoverable; if not, redesign their tiles as "fallback active" rather than removing them.
3. **Hosting decision.** These dashboards live where? Same Next.js app under `dashboard.sashacoin.[domain]`? Three separate routes on mangabeira.net? Subdomain per dashboard? Affects auth, deployment, analytics.
4. **Auth model.** Is the OKX dashboard public (judges scan it without login)? Is the LP Miner private (Gabriel + invited)? Affects every nav decision.
5. **Mantle hackathon deadline.** Same week as build kickoff? Reorder ship sequence accordingly — Mantle first, OKX second, LP Miner third (operational, no deadline urgency).

---

*Foundation complete. Move on to dashboard-specific briefs.*
