# Full Pre-Build Brief Template (18 sections)

The agency-grade definition document. This is what you'd receive after 4–8 weeks of discovery — before the first frame is designed. Every section makes a later visual decision defensible. Copy this into `_ops/dashboard-brief-[slug]-YYYY-MM-DD.md` and fill the placeholders.

For an internal single-user tool (most of Gabriel's dashboards), sections 2.2, 3, 4.1 cost columns, and 18 can be abbreviated. Sections 1, 4.2, 5, 6, 8, 10, and 16 are never optional.

---

# PHASE 1 — DISCOVERY

## 1. Project context & success definition

### 1.1 The product in one sentence
> **[PRODUCT NAME]** is a [category] that helps [primary user] accomplish [primary job] so they can [outcome they actually care about].

### 1.2 Why this dashboard exists (pick ONE primary, ONE secondary)
- **Decision compression** — turn 30 minutes of investigation into a 30-second glance
- **Confidence broadcast** — prove to the user/stakeholders that things are working
- **Anomaly surfacing** — make the abnormal impossible to miss
- **Workflow anchoring** — be the home screen people open every morning
- **Sales asset** — be the screenshot in the demo that closes the deal

> **Primary purpose:** [one]
> **Secondary purpose:** [one]

Every design decision gets graded against these two.

### 1.3 Success metrics
| Metric | Baseline | Target (90d) | How measured |
|---|---|---|---|
| Daily active sessions per user | | | |
| Time to first meaningful action | | <15s | |
| % sessions ending in action (not just look) | | >40% | |
| Dashboard NPS | | >40 | |

### 1.4 Strategic constraints
- **Technical:** [framework — e.g. React + Tailwind + Supabase realtime, or vanilla HTML served by task-server.js]
- **Performance:** [e.g. <1.5s LCP on hero view, <100ms interaction response]
- **Accessibility:** WCAG 2.2 AA minimum
- **Brand:** [`_context/brand-style.md` or greenfield]
- **Visual ambition:** [conservative / balanced / maximalist]

---

## 2. User research synthesis

### 2.1 Primary persona
> **Name / role / context of use / frequency / tech sophistication.**
> **A day in their life with this dashboard** (realistic, hour by hour).
> **Driving quotes** — the interview lines that should shape design.

### 2.2 Secondary personas
- **The exec drop-in** — grok status in 10 seconds, weekly
- **The analyst** — drill, export, segment, slice
- **The new hire** — the dashboard should teach them the business

### 2.3 What the dashboard must NOT be
Negative requirements. (Not a config panel. Not a feed. Not a replacement for the analytics tool — this is the executive layer.)

---

## 3. Competitive teardown
Per competitor: aesthetic POV (one sentence) / what they nail / what they fumble / what we steal / what we deliberately do opposite.

Default teardown targets for any analytics dashboard: Linear, Vercel, Stripe Dashboard, Dune Analytics, Posthog, Datadog, Bloomberg Terminal.

**The synthesis chart:** a 2×2 — X = information density (sparse→dense), Y = visual ambition (utilitarian→expressive). Plot competitors. Mark where YOUR product sits. The white space is the wedge.

---

## 4. Data audit

### 4.1 Data source inventory
| Source | Refresh | Latency | Reliability | Cost/query | Notes |
|---|---|---|---|---|---|

### 4.2 Metric hierarchy (the section most dashboards skip)
See `information-hierarchy.md`. Fill the tiering worksheet: Hero (≤5) / Supporting (≤12) / Drill-down (rest), each with "why it earns its tier."

### 4.3 Data gaps
- What data does the user expect that we don't have?
- What data is too unreliable to show confidently?
- What's empty for new users? (Drives empty-state design.)

### 4.4 Number formatting standard (decide once, apply everywhere)
- Currency: `$1,234.56` / `$1.2K` / `$1.2M` — thresholds?
- Percentages: trailing decimals when?
- Negatives: `-$1,234` / `($1,234)` / red?
- Time: relative (`2h ago`) / absolute (`14:32`) / both?
- Nulls: `—` / `N/A` / cause-stated?

---

# PHASE 2 — DEFINITION

## 5. Jobs-to-be-done map
Per job: "When I [situation], I want to [motivation], so I can [outcome]." + trigger / current workflow / desired workflow / success signal / frequency / pain-if-it-fails / design implication.

**Prioritization matrix:** X = frequency, Y = pain × impact. Top-right jobs get the front page. Bottom-left get a deep link or get cut.

---

## 6. Information architecture

### 6.1 Sitemap
Full tree of screens and sub-states.

### 6.2 Navigation model (pick one with rationale)
- **A: Persistent left sidebar** — 5+ sections, frequent switching. Costs ~240px.
- **B: Top nav only** — 3–5 sections, more vertical space for data.
- **C: Sidebar + command palette (⌘K)** — power users, keyboard-first. **Default recommendation for any pro-grade dashboard in 2026.**
- **D: Adaptive** — sidebar collapses to icons on narrow viewports.

> **Chosen:** [decision + 2-sentence justification]

### 6.3 Naming conventions
| Concept | We call it | Not | Why |
|---|---|---|---|
Terminology drives behavior. "Repository" vs "Project" defined GitHub. "Workspace" vs "Team" defined Linear.

---

## 7. User flows
Flowcharts (not wireframes) for the 5–12 most critical paths: first-time onboarding / daily check-in / anomaly investigation / report creation & share / empty-state recovery / error recovery / mobile drop-in / account switching / destructive settings change / export & external share.

Each documents: entry points / happy path / branches / exit points / edge cases per node.

---

## 8. Edge state matrix
See `edge-state-matrix.md` — 13 states per screen, all designed before "done."

---

## 9. Content strategy & microcopy

### 9.1 Voice & tone
- **Voice (consistent):** [e.g. confident, terse, expert-to-expert]
- **Tone by context:** success / error / empty / destructive-confirm

### 9.2 Microcopy patterns table
Empty state / destructive confirm / loading >2s / error / button labels — good vs anti-example. (See `edge-state-matrix.md`.)

### 9.3 Glossary
Every term with a specific product meaning, defined once.

---

# PHASE 3 — DESIGN SYSTEM FOUNDATIONS

## 10. Aesthetic direction
See `aesthetic-directions.md`. Present 3, pick 1, write the "what we're NOT" list.

## 11. Design tokens specification
Semantic names only — components never reference raw values. (design-principles is the floor; these are the project tokens.)

- **Color:** surface (base/raised/overlay/sunken), text (emphasis→disabled→inverse), border (default/emphasis/subtle), interactive (primary/hover/active/secondary/destructive), data-semantic (positive/negative/neutral/warning/info), data-categorical (series-1..8, colorblind-safe). Define light + dark hex + contrast ratio per token.
- **Typography:** modular scale (1.25 ratio): display-xl→caption + mono-md/sm. Family/weight/letter-spacing each.
- **Spacing:** 4px base (space-0..10) + semantic (gutter/section/card-padding/page-padding).
- **Radii / shadows / borders:** sharp→full radii; hairline/thin/thick borders; elevation-0..4 (or "depth via tone, no shadows" in Direction A); blur-sm/md/lg.
- **Motion:** duration (instant→cinematic) + easing (ease-out-quart/expo, ease-in-out-quart, ease-spring). See `chart-selection.md` for chart-specific timing.
- **Z-index:** base→max scale.
- **Breakpoints:** sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536 / 3xl 1920.

## 12. Component inventory (build in tier order)
- **Tier 1 Foundation:** Button (5 variants), Input, Select/Combobox, Checkbox/Radio/Switch, Label/Helper/Error, Link, Icon system (one library), Typography components, layout primitives, Skeleton.
- **Tier 2 Surface:** Card, Panel, Divider, Badge/Pill/Tag, Avatar, Status indicator, Tooltip, Popover, Tabs.
- **Tier 3 Data display:** Data table (sort/filter/paginate/row-actions/bulk-select), Empty state, Stat/Metric card, KPI block, Activity feed item, Timeline, Tree view.
- **Tier 4 Charts:** Line, Area, Bar, Sparkline, Donut (only if must), Heatmap, big-number-with-context, shared chart primitives.
- **Tier 5 Overlay & feedback:** Modal, Drawer, Toast, Banner, Confirmation dialog, Command palette (⌘K), Onboarding tooltip.
- **Tier 6 Navigation:** Sidebar, Top bar, Breadcrumb, Pagination, Stepper, Filter bar, Date range picker.

Per component, document: anatomy / variants / states (default/hover/active/focus/disabled/loading/error/success) / sizes / props / composition rules / accessibility / responsive / do-don't / code example.

## 13. Data visualization specification
See `chart-selection.md` — the full decision tree, anatomy standards, color rules, and chart hierarchy.

## 14. Density & responsive strategy
See `density-and-responsive.md`.

## 15. Accessibility commitment
WCAG 2.2 AA across all surfaces. Contrast matrix for every color pair. Keyboard nav map (tab order, skip links, Escape behavior, arrow-key composite nav, ⌘K). Screen reader copy (icon names, chart text alternatives, status text not just color, live regions). Honor `prefers-reduced-motion`.

## 16. Page-by-page design intent
Per top-level page, before designing: route / jobs served / primary user state / the 5-second test / the 30-second test / above-the-fold elements with purpose / below-the-fold / what this page deliberately omits / edge states for this specific page.

---

# PHASE 3 — HANDOFF

## 17. Engineering handoff package
Repo structure (components/tokens/hooks/lib/pages/styles). Storybook per component. Token export (CSS vars + TS + Tailwind config). Definition of Done per component and per page (see checklists below).

**DoD per component:** designed (all variants) / implemented / Storybook story / a11y audit passed / responsive verified / reduced-motion verified / dark mode verified / visual regression test / documented / reviewed.

**DoD per page:** all edge states built / all jobs testable / load order optimized / empty copy approved / perf budget met (LCP/CLS/INP) / a11y passed / responsive verified / analytics instrumented / reviewed in a real session.

## 18. Launch & iteration plan
Pre-launch checklist. Post-launch instrumentation (first-click heatmap, bounce points, chart hover rates, most-hit empty states, ⌘K adoption). 30/60/90 review (reorder heroes / audit unused components / re-run user interviews).

---

# APPENDICES

## A. Designer pre-flight (before opening Figma)
Can recite the primary purpose / knows the hero metrics and why each earns its tier / internalized the aesthetic direction and the "not" list / tokens loaded as styles / designing the whole state matrix not just happy path / drew the user flow / wrote the page brief.

## B. Engineer pre-build (before the IDE)
Only tokens referenced (no raw hex, no magic numbers) / component exists in inventory / reviewed a11y for this component type / knows which page brief it first appears in / Storybook scaffolded first.

## C. Critique rubric (1–5 each)
Purpose fit / aesthetic coherence / edge-state completeness / token discipline / information hierarchy / restraint (bonus for cuts) / memorability. Anything below 4 goes back.

## D. The wall of "no"
A live list of things explicitly decided against. Updated every decision. (See `anti-patterns.md` for the default starting bans.)

## E. Recommended reading
*Refactoring UI* (Wathan & Schoger) · *Information Dashboard Design* (Stephen Few) · *The Visual Display of Quantitative Information* (Tufte) · Linear's design blog · Vercel's design system docs.
