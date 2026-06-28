# Anti-Patterns — the dashboard "wall of no"

The 20 universal rules in `design-principles` apply to everything. These 24 are **additive and dashboard-specific** — the failure modes that make a dashboard look amateur even when the type scale and color math are technically correct. (Bans 21–24 were added 2026-06-06 from the dashboard-design video distillation — see `_ops/dashboard-video-distillation-2026-06-06.md`.)

Each is a hard ban with the reason and the fix.

---

## Layout & hierarchy

**1. The equal-card grid.**
12 identically-sized metric cards in a 4×3 grid. No hero, no story, no entry point.
→ *Fix:* tier the metrics (see `information-hierarchy.md`). Heroes get 2× the real estate.

**2. The three-equal-column row as default.**
The 2018 SaaS starter layout. Three cards, equal width, centered. Reads as a template, not a product.
→ *Fix:* asymmetric layout. A hero spanning 8 columns + a sidebar widget spanning 4 beats three equal thirds.

**3. The buried lede.**
The most important number sits in row 4 because that's where the data model put it.
→ *Fix:* reorder for the human. Schema order ≠ visual order.

**4. Hero inflation.**
Eight "hero" metrics, so none is the answer.
→ *Fix:* cap heroes at 5. Force the cut.

---

## Charts

**5. Donut chart with >4 segments.**
Humans can't compare arc angles. A 7-slice donut is decorative, not informative.
→ *Fix:* stacked horizontal bar, sorted.

**6. Pie chart for time series.**
A pie is a single moment. Time is a sequence. Category error.
→ *Fix:* line or area chart.

**7. Non-zero baseline on a bar chart.**
Truncating the y-axis exaggerates differences. It's a visual lie and it erodes trust the moment someone notices.
→ *Fix:* bars always start at zero. If small changes matter, use a delta indicator or a line chart.

**8. Empty chart shown as a chart.**
A chart with no data renders as an empty box with axes. Looks broken.
→ *Fix:* contextual empty state (see `edge-state-matrix.md`).

**9. Legend below a ≤3-series chart.**
Forces a glance away from the data to decode colors.
→ *Fix:* inline labels at the end of each series.

**10. Two similar hues for a 2-series compare.**
"Light blue and slightly darker blue" — indistinguishable at a glance, worse for colorblind users.
→ *Fix:* two distinct hues, or semantic positive/neutral.

**11. Animated count-up on every load.**
The number ticks up from 0 every time the page loads. Decorative, slows comprehension, gets old instantly.
→ *Fix:* animate once on first paint, never again. Snap on updates.

**12. 3D charts.**
Always wrong. 3D perspective distorts the data it's meant to show.
→ *Fix:* 2D. Always.

---

## Numbers & copy

**13. Raw numbers without units.**
`1234` instead of `$1,234`. `0.123` instead of `12.3%`.
→ *Fix:* format every number with its unit. Decide the formatting standard once, apply everywhere.

**14. Emoji in metric labels.**
"📈 Revenue", "🔥 Hot leads". Reads as a hobby project, not an instrument.
→ *Fix:* labels are words. Icons, if any, are from the icon system and sit consistently.

**15. "Something went wrong."**
The most useless error message in software.
→ *Fix:* specific cause + retry + status link. (See `edge-state-matrix.md`.)

**16. "Welcome 👋" empty states.**
Greeting instead of coaching. Wastes the highest-leverage onboarding moment.
→ *Fix:* "No X yet. Do Y in under 60 seconds. [CTA]"

**17. "Click here" / "Submit" / "OK" buttons.**
Generic verbs tell the user nothing about consequence.
→ *Fix:* verb + noun. "Create report", "Export CSV", "Delete workspace".

**18. `—` everywhere for missing data.**
An em-dash sea tells the user nothing about *why* data is missing.
→ *Fix:* state the cause. "API down 14:32", "Awaiting first sync", or the legitimate "0".

---

## Surface & motion

**19. Glassmorphism / frosted blur as default.**
Frosted-glass cards over a gradient. Trendy in 2021, generic now, and it hurts contrast.
→ *Fix:* solid surfaces, hairline borders or subtle shadows. Earn the blur only for a genuine overlay (modal backdrop).

**20. Spinner where a skeleton works.**
"Loading…" with a spinner. Says "we don't know what's coming."
→ *Fix:* skeleton screens shaped like the content.

---

## Color budget, glow & dense tables

**21. Traffic-light overload (the color-budget violation).**
A green or red dot on every row and every metric, all the time. When everything is colored, color stops meaning "look here." Resting color density should track *problem* density.
→ *Fix:* default everything to neutral tone. Warm/alert color appears ONLY on items needing action. 16 healthy agents = "16 active" in neutral, not 16 green dots. (See `information-hierarchy.md` → color budget.)

**22. Glow / neon text-shadow on metrics.**
`text-shadow: 0 0 20px` halos on numbers, glowing status dots. Reads as a gamer HUD, not an instrument, and it lowers legibility.
→ *Fix:* depth from surface tone + hairline borders. Zero glow. (Companion to #19 glassmorphism and #12 3D.)

**23. Dense table with no search.**
A 50- or 150-row table dumped raw. The user scrolls a wall hunting for one row.
→ *Fix:* >15 rows → search; >30 → filters + sortable columns; >100 → virtualize. (See `interaction-grammar.md`.)

**24. Metric label without a timespan.**
"Clicks: 352" — over what window? Today? All time? Ambiguous metrics get misread.
→ *Fix:* every windowed metric states its period: "Clicks · 7d". (See `number-treatment.md`.)

---

## Bonus structural bans

- **Infinite scroll feed as a primary widget** — chronological feeds invite anxiety. Curate, don't stream.
- **Icon-only primary navigation** without labels — discoverability tax. Label the nav, optionally collapse to icons on narrow viewports with tooltips.
- **Live-updating number with no change indicator** — the user can't tell if it's live or frozen. Flash the change, show a "Live" dot.
- **Comfortable density shipped to a daily power user** — they perceive air as wasted scrolling. Match density to frequency.
- **Mobile-first layout for a desktop product** — design `bp-xl` first, degrade to an honest mobile drop-in.

---

## How to use this in audit mode

When auditing an existing dashboard, walk this list top to bottom against the live page. Each present anti-pattern is a punch-list item. Tag severity:
- **Trust-eroding** (7, 13, 15, 18, 24) — fix first; these make users distrust the data.
- **Comprehension-blocking** (1, 3, 5, 6, 9, 10, 20, 21, 23) — fix second; these make the dashboard slow to read.
- **Polish** (2, 4, 11, 14, 16, 17, 19, 22) — fix third; these make it look amateur but still function.
