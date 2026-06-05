# Aesthetic Directions — the 3 named moodboards

The most important decision in the brief. Present three genuinely different directions, name them, defend each, then pick one. The point is not to find "the look" — it's to make every later visual decision defensible by tracing it back to a chosen POV.

**Always present all three before picking** (per the "show first, ask after" rule). Then choose one and write what you're NOT.

---

## Direction A — "The Operator's Console"

For the user who treats this product like an instrument.

- **Reference points:** Bloomberg Terminal, Linear, Datadog, Vercel (dark mode)
- **Aesthetic POV:** Information-dense, monospace-curious, dark-mode-native, keyboard-first
- **Typography:** Display in a distinctive mono or grotesque (Berkeley Mono, Söhne Mono); body in Inter / Söhne; **data in JetBrains Mono or Söhne Mono** with tabular figures
- **Color story:** Near-black backgrounds (`#0A0A0B`), surfaces in graphite tones, a single saturated signal accent (acid green for positive, hot pink/amber for alert). Data uses a restricted 5-color palette.
- **Texture:** Subtle noise on surfaces, hairline borders everywhere, **no shadows** — depth comes from tone, not elevation
- **Motion:** Snappy (120–180ms), no bounce, never decorative
- **Density:** High (Cozy / Compact default)
- **Best when primary purpose is:** anomaly surfacing or workflow anchoring
- **Who it's for:** the power user who lives in the tool all day

**Strongest fit for Gabriel's operational dashboards** (task boards, fleet view, ops consoles) — these are daily-use power-user tools, not exec drop-ins.

---

## Direction B — "The Editorial Quiet"

For the user who wants the product to feel like a luxury good.

- **Reference points:** Vercel Dashboard (light), Stripe, modern fintech, Cron
- **Aesthetic POV:** Refined, generous whitespace, light-mode-first, confidence through restraint
- **Typography:** Display in a refined serif or distinctive sans (Tiempos Headline, GT Sectra, or a confident grotesque); body in Söhne / Inter; data in Söhne Mono
- **Color story:** Bone-white (`#FAFAF7`) and warm greys, a single muted accent (ink blue / forest). Data uses an earth-toned palette.
- **Texture:** Pure surfaces, soft shadows (`0 1px 2px rgba(0,0,0,0.04)`), rounded radii (8–12px)
- **Motion:** Deliberate (200–280ms), gentle easing, choreographed reveals
- **Density:** Medium (Comfortable / Cozy)
- **Best when primary purpose is:** confidence broadcast or sales asset
- **Who it's for:** the exec, the client, the stakeholder seeing it in a demo

**Strongest fit for client-facing dashboards and demo screenshots** — the kind of surface that needs to read as premium to a first-time viewer.

---

## Direction C — "The Living Document"

For the user who reads The Browser and treats data as content worth designing.

- **Reference points:** Are.na, editorial design magazines, MIT Media Lab, Stripe Press
- **Aesthetic POV:** Editorial, opinionated, grid-breaking, asymmetric, treats data as a story
- **Typography:** Display in an extended grotesque or editorial serif (GT America Extended, Söhne Breit); body in Söhne; data in Söhne Mono
- **Color story:** Off-white paper (`#F4F1EA`), ink black, three accent colors used sparingly and unpredictably
- **Texture:** Visible grid, rules, drop caps, marginalia — the page reads like a printed report
- **Motion:** Cinematic on key moments, still everywhere else
- **Density:** Mixed — hero sections sparse, data sections dense
- **Best when primary purpose is:** decision compression with a strong narrative, or a flagship report surface
- **Who it's for:** the user who wants the dashboard to feel authored, not generated

**Strongest fit for report surfaces and flagship analytics pages** — where the dashboard doubles as a piece of thinking, not just a status board. Risky for high-frequency operational use (the personality gets tiring at 50 opens a day).

---

## How to pick

| If the primary purpose is… | Lean toward |
|---|---|
| Anomaly surfacing | A (Operator's Console) |
| Workflow anchoring (home screen) | A or B |
| Confidence broadcast | B (Editorial Quiet) |
| Sales asset / demo | B (Editorial Quiet) |
| Decision compression with narrative | C (Living Document) |

Then write the rationale in three sentences, tying the choice back to the primary purpose from §1.2 of the brief.

---

## What we're NOT (mandatory negative list)

Just as important as the chosen direction. Write the explicit list of what the visual language will not be. The default starting list for any dashboard:

- **Not** purple-gradient-on-white SaaS template
- **Not** glassmorphism / frosted blur as a default surface
- **Not** neumorphism
- **Not** Inter as a display font unless paired with something distinctive (Inter for body is fine; Inter as the personality is generic)
- **Not** emoji in product chrome or metric labels
- **Not** "delightful" microcopy (we are not Mailchimp circa 2014)
- **Not** infinite micro-interactions — choose 3–5 high-impact motion moments and animate only those
- **Not** the three-equal-column card row as the default layout
- **Not** donut charts as the default part-to-whole

Add direction-specific exclusions. (If you chose A, also exclude soft shadows and rounded-everything. If you chose B, also exclude pure-black backgrounds and acid accents.)

---

## Brand DNA integration

These directions are templates. The actual colors, fonts, and logo come from `_context/brand-style.md` (or the project's equivalent). For Gabriel's personal brand:

- **Colors:** Navy `#0A2540`, Aqua `#1FB6FF`, Gold `#FFB800`
- **Fonts:** Montserrat (headlines), Inter (body)

Map the brand DNA onto the chosen direction. Example: "Operator's Console with Gabriel's brand" = near-black background, navy-graphite surfaces, aqua as the single signal accent, gold reserved for the one highlight-this moment, Montserrat in the display slots, Inter body, a mono for data. The direction sets the *system*; the brand sets the *palette and type*.
