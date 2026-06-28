---
name: dashboard-design
description: Opinionated workflow for designing and rebuilding dashboards. Sits between design-principles (the floor) and frontend-design (the production layer). Owns the dashboard-specific disciplines: information hierarchy, metric tiering, chart selection, number & label treatment, interaction grammar, edge-state matrix, density modes, aesthetic direction, and anti-slop floor. Four modes — brief, audit, prescribe, decide. Use whenever the deliverable is a dashboard, status page, analytics surface, internal tool, or admin console. Triggers — "build a dashboard", "redesign the dashboard", "the dashboard looks bad", "fix the task board UI", "design an analytics page", "audit this dashboard", "what chart should I use", "how should I structure this overview page".
---

# Dashboard Design — the discipline between the floor and the build

Dashboards die from one of three failures:

1. **No hierarchy** — every number is the same size, so none is the answer.
2. **Wrong defaults** — generic SaaS template aesthetic (purple gradient, 3-column card grid, donut charts) instead of an aesthetic earned by the product.
3. **Missing edge states** — the dashboard is beautiful on the happy path and broken everywhere else.

This skill codifies the decisions and taste that prevent those failures. It does not replace `design-principles` (still the floor) or `frontend-design` (still the production capability). It is the **dashboard-shaped opinion layer** that calls both.

---

## When to invoke this skill

Always invoke when the deliverable is one of:

- Operational dashboard (task board, ops console, fleet view)
- Analytics surface (any "look at the numbers" page)
- Status page (system health, agent health, campaign health)
- Admin console / internal tool with data tables and metrics
- Multi-widget overview screen with mixed data types

Do **not** invoke when the deliverable is:
- A single-page marketing site (use `landing-taste` + `frontend-design`)
- A standalone chart or social graphic (use `social-graphics` or `data-visualization`)
- A purely text-driven page (use `mangabeira-blog-writer` or content skills)

If you're not sure — invoke. The cost of skipping is generic SaaS slop.

---

## Always loads as floor

Before producing anything, this skill loads in this order:

1. **`design-principles`** — the 20 codified rules. Non-negotiable. Caps type sizes, enforces 60-30-10, sets contrast minimums.
2. **`_context/brand-style.md`** — brand DNA tokens (colors, fonts, density preference). Project-specific.
3. **This skill's references/** — dashboard-specific decisions on top of the floor.

Production happens via `frontend-design` (HTML/React) or `canvas-design` (concept frames). Visual QA happens via `playwright-visual-qa`.

---

## The 4 modes

### Mode 1 — `brief` (pre-build)

**Use when:** a new dashboard is being scoped or an existing dashboard is being rebuilt from scratch.

**Output:** `_ops/dashboard-brief-[slug]-YYYY-MM-DD.md` — the full 18-section pre-build brief (see `references/full-brief-template.md`). Adapt placeholders to the specific product. Mandatory sections to fill before any design happens:

1. **Primary + secondary purpose** (decision compression / confidence broadcast / anomaly surfacing / workflow anchoring / sales asset — pick one primary and one secondary)
2. **Hero metrics — max 5** (the numbers that, if red, the user must act today)
3. **Aesthetic direction** — pick one of 3 (see `references/aesthetic-directions.md`)
4. **Information architecture** — sitemap + nav model (sidebar / top / sidebar+⌘K)
5. **Edge state matrix** for every screen (see `references/edge-state-matrix.md`)
6. **The "wall of no"** — what this dashboard deliberately is not

A brief is "done" when a competent designer could open Figma and start without asking a question.

### Mode 2 — `audit` (score existing)

**Use when:** a dashboard already exists and Gabriel says "this looks bad / could be better / needs an update."

**Output:** `_ops/dashboard-audit-[slug]-YYYY-MM-DD.md` with the rubric below.

Score the existing dashboard against this 10-dimension rubric (1–5 each, 50 total):

| # | Dimension | What "5" looks like |
|---|---|---|
| 1 | **Purpose clarity** | One look tells you why this screen exists |
| 2 | **Hero hierarchy** | Top 3–5 metrics are obviously larger / higher-position than the rest |
| 3 | **Aesthetic coherence** | Feels like a deliberate POV, not a Tailwind starter |
| 4 | **Information density fit** | Right amount of stuff per pixel for the user's frequency of use |
| 5 | **Chart selection** | Every chart is the right type for the question it answers |
| 6 | **Edge state coverage** | Empty / loading / error / stale states all designed |
| 7 | **Typography discipline** | ≤4 type sizes, modular scale, tabular figures for data |
| 8 | **Color discipline** | 60-30-10 split, single accent, semantic colors only where direction matters |
| 9 | **Motion taste** | Snappy on interactions; restrained on state changes |
| 10 | **Anti-slop floor** | None of the 20 dashboard anti-patterns present (see `references/anti-patterns.md`) |

**Anything below 4 on a dimension = explicit punch list item.** Final score <40 → recommend rebuild. 40–44 → targeted fixes. 45+ → ship as-is.

For each FAIL, document:
- Specific element on the page (selector or location)
- Rule violated + measured value
- Concrete fix (not "improve hierarchy" — "drop these 3 metrics from the hero row to a secondary section")
- Effort estimate (S / M / L)

### Mode 3 — `prescribe` (punch list)

**Use when:** the audit is done and you need a sequenced fix plan.

**Output:** `_ops/dashboard-prescribe-[slug]-YYYY-MM-DD.md` — an ordered punch list grouped by quick-win / structural / aspirational.

Order rules:
- **Quick wins first** — fixes that take <2 hours and visibly improve the worst dimensions.
- **Then structural** — type system, color tokens, hero hierarchy. These unlock everything else.
- **Then aspirational** — motion, density modes, command palette, the screenshot-worthy moments.

Each line: `[S/M/L] [Q/S/A] Element → Fix → Impact (dimension scores affected)`.

### Mode 4 — `decide` (selection helpers)

**Use when:** a specific design decision needs answering, not a full brief or audit.

Sub-modes:
- `decide chart` — given a question and data shape, return the chart type (see `references/chart-selection.md`)
- `decide layout` — given hero metrics + frequency of use, return density mode + column grid
- `decide nav` — given screen count + user sophistication, return nav model
- `decide direction` — given product POV, return aesthetic direction (A / B / C)

Output is a one-paragraph recommendation with the rule citation, not a brief.

---

## The 7 critical decisions (cheat sheet)

Every dashboard build hinges on these. If any one is wrong, the whole thing limps.

1. **Primary purpose** — decision compression / confidence broadcast / anomaly surfacing / workflow anchoring / sales asset. Pick ONE. Every later decision gets graded against this.
2. **Hero metrics ≤ 5** — the numbers that earn the biggest type and prime position. If you have 12 hero metrics, you have 0 hero metrics.
3. **Aesthetic direction** — Operator's Console / Editorial Quiet / Living Document (see references). Pick one, name what you're NOT.
4. **Information architecture** — sitemap + nav model. Default to sidebar + ⌘K command palette for any pro-grade dashboard.
5. **Chart selection rules** — never a pie >4 segments, never two similar colors for a 2-series compare, always zero-baseline bar charts (see `references/chart-selection.md`).
6. **Edge state matrix** — 13 states per screen, all designed before "done" (see `references/edge-state-matrix.md`).
7. **Density strategy** — comfortable / cozy / compact. Match to user frequency of use. Don't default to "comfortable" because Tailwind does.

---

## Anti-slop floor (the dashboard-specific bans)

The 20 design-principles rules apply universally. **These 24 dashboard-specific bans are additive** — see `references/anti-patterns.md` for the full list with examples. The headline bans:

1. **No purple-gradient-on-white SaaS hero.** Earn the aesthetic instead.
2. **No equal-sized metric card grid.** If everything's the same size, nothing is the answer.
3. **No donut chart with >4 segments.** Use a stacked bar.
4. **No pie chart, ever, for time series.**
5. **No "Loading…" spinner where a skeleton would work.**
6. **No "Something went wrong" error copy.** Specific or nothing.
7. **No emoji in metric labels.** ("📈 Revenue" → ban.)
8. **No icon without a label** in primary navigation.
9. **No raw numbers without units.** $1,234 not 1234. 12.3% not 0.123.
10. **No 0-baseline lies.** Bar charts always start at zero. Y-axis tricks erode trust.
11. **No "Welcome 👋"** empty states. Coach, don't greet.
12. **No infinite scroll feed** as a primary dashboard widget. Anxiety-inducing.
13. **No three-column equal-card row** as the default layout. It's the 2018 SaaS default and it's tired.
14. **No glassmorphism / frosted blur** as default surface treatment. Earn it.
15. **No animated count-up** on every metric load. Once at first paint, never again.
16. **No live-updating number** without a visual indicator that it just changed.
17. **No empty chart shown as a chart.** Replace with a contextual empty state.
18. **No `—` everywhere** when data is unavailable. State the cause: "API down 14:32" or "Awaiting first sync".
19. **No legend below a chart when there are ≤3 series.** Inline labels beat legends.
20. **No "Click here" or "Submit" button labels.** Verb + noun: "Create report", "Export CSV".
21. **No traffic-light overload.** Color tracks problem density; a healthy screen is near-monochrome. Don't paint a green/red dot on every row. (See `information-hierarchy.md` → color budget.)
22. **No glow / neon text-shadow on metrics.** Depth from tone + hairline borders, never a halo. Reads as a gamer HUD, not an instrument.
23. **No dense table without search.** >15 rows → search; >30 → filters + sort; >100 → virtualize. (See `interaction-grammar.md`.)
24. **No metric label without a timespan.** "Clicks · 7d", not "Clicks". (See `number-treatment.md`.)

---

## One rule that bends by context — the console vs. the client surface

The strict anti-slop floor is calibrated for the **operator console / daily-use internal tool**: personality serves legibility, never the reverse. On a **client-facing or report surface**, deliberate rule-breaking for engagement and narrative is allowed (a hero moment, a bolder chart, more air) — *because the job is different.* Decide which kind of dashboard you're building before you decide how much to bend. **The console never bends; the showcase may.** (Geckoboard's "it's for people / keep evolving" principle, scoped — video distillation 2026-06-06.)

---

## How this skill composes with others

```
designer agent (orchestrator)
  ↓
dashboard-design (this skill — the discipline)
  ↓ always loads
  → design-principles (the floor: 20 universal rules)
  → _context/brand-style.md (brand DNA)
  ↓ delegates production to
  → frontend-design (HTML/React UI implementation)
  → canvas-design (concept frames before code)
  ↓ delegates QA to
  → playwright-visual-qa (breakpoint + interaction QA)
```

This skill never writes HTML or generates images directly. It produces decisions (briefs / audits / prescriptions) that downstream skills execute on.

---

## Output routing

| Output | Path |
|---|---|
| Pre-build brief | `_ops/dashboard-brief-[slug]-YYYY-MM-DD.md` |
| Audit | `_ops/dashboard-audit-[slug]-YYYY-MM-DD.md` |
| Prescribe / punch list | `_ops/dashboard-prescribe-[slug]-YYYY-MM-DD.md` |
| One-shot `decide` | inline (no file) |

When the deliverable is a multi-week rebuild, also create a campaign object in `campaigns/campaigns.json` so the work tracks like any other initiative.

---

## Files in this skill

```
SKILL.md                              ← this file
references/
  full-brief-template.md              ← the 18-section pre-build brief template
  chart-selection.md                  ← chart-type decision tree, anatomy, data-ink, color rules
  information-hierarchy.md            ← hero / supporting / drill-down tiering + spatial + color budget
  number-treatment.md                 ← number formatting, no-orphan rule, labels (what + timespan)
  interaction-grammar.md              ← popover/modal/drawer/page/toast + dense-table >15-row rule
  edge-state-matrix.md                ← 13 mandatory states per screen
  density-and-responsive.md           ← density modes, breakpoint strategy, type density
  aesthetic-directions.md             ← the 3 named directions (Operator / Editorial / Living Doc)
  anti-patterns.md                    ← 24 dashboard-specific bans with examples
```

---

## What "great" looks like (the rubric you're aiming for)

A dashboard hits the bar when:

- A first-time visitor knows in 5 seconds what this screen exists to tell them.
- A returning user accomplishes their daily check-in in under 30 seconds.
- An exec dropping in once a week understands status without reading.
- The screenshot of this dashboard could close a deal in a demo.
- Anomalies are impossible to miss; everything-fine is calm.
- The dashboard is equally legible at 1280×800 and 1920×1080.
- Reduced-motion users get the same product, minus the choreography.
- A new hire can be onboarded by the dashboard itself.

If you can't say yes to most of these by the end of a build, the brief was wrong, not the design.
