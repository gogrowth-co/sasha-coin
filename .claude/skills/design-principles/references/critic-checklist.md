# Design Critic Checklist — 20 Pass/Fail Rules

The designer agent's Phase 3 Critic runs this checklist against every produced visual artifact. Each rule is **Pass** or **Fail**. Any FAIL sends the artifact back to the production skill with a specific, numeric fix instruction. Up to 2 revision attempts; after 2 fails, deliver to the user with this report attached.

For format-specific relaxations (social 1080×1080 safe-zone, OG 1200×630 word budget, etc.), apply `format-overrides.md` first — those replace the default thresholds below.

---

## How to report a Fail

Always include all four fields:

| Field | Example |
|---|---|
| **Rule** | Rule 7 — Limited type sizes |
| **Threshold** | ≤4 distinct sizes per canvas |
| **Measured** | 6 sizes detected: 12, 14, 16, 20, 28, 48 |
| **Fix** | Drop the 14 and 20; reuse 16 and 28 for those roles |

Vague verdicts ("hierarchy looks off") are not allowed. If the rule resists numeric measurement on this format, log it under "Subjective notes" — do not call it a Fail.

---

## The 20 checks

### Cognitive load (Rules 1–3)

- [ ] **Rule 1 — One idea.** ≤1 headline (≤10 words) + ≤1 supporting block. Two arguments → split.
- [ ] **Rule 2 — Glanceable ≤3s.** Word count ≤25 (presenter/hero) or ≤75 (document/data-dense). One focal point identifiable.
- [ ] **Rule 3 — ≤7±2 chunks.** Count distinct visual chunks after grouping. Target 3–5; hard cap 7.

### Whitespace & safe-zone (Rules 4–5)

- [ ] **Rule 4 — Whitespace ratio.** ≥40% empty pixels (info canvas), ≥60% (hero/title), ≥70% (quote).
- [ ] **Rule 5 — Edge safe-zone.** No text/logo/focal element inside 5% of any canvas edge (96 px on 1920×1080; 54 px on 1080×1080; 60 px on 1200×630).

### Type system (Rules 6–10)

- [ ] **Rule 6 — Modular scale.** All type sizes derive from one ratio (1.25 / 1.333 / 1.414 / 1.5 / 1.618). No ad-hoc sizes like 17, 23, 31.
- [ ] **Rule 7 — ≤4 sizes per canvas / ≤6 per deck-or-page.** Measure the distinct sizes in render.
- [ ] **Rule 8 — Minimum readable size.** Body ≥24 px (1920×1080 ref) / ≥16 px (web). Headline ≥48 px / ≥32 px (web). Caption ≥18 px / ≥14 px (web).
- [ ] **Rule 9 — Line-height.** Body 1.4–1.6; subhead 1.25–1.4; display 1.05–1.2.
- [ ] **Rule 10 — Line length.** Body ≤60 ch; display ≤30 ch.

### Color & contrast (Rules 11–14)

- [ ] **Rule 11 — WCAG contrast.** Body ≥4.5:1 (target 7:1 on slides); large ≥3:1. **Sample at 9 points across each text bounding box** when text overlays imagery.
- [ ] **Rule 12 — 60-30-10 split.** Accent occupies 5–15% of pixel area. >15% reduce; <2% no focal accent — fix.
- [ ] **Rule 13 — Single accent per canvas.** One accent color in one element. Multiple accents = no accent.
- [ ] **Rule 14 — No hue-only meaning.** Color-coded distinctions also carry a non-color cue: shape, label, icon, weight, or position.

### Spatial system (Rules 15–17)

- [ ] **Rule 15 — 8-pt grid.** Every margin/padding/gap ∈ {4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128}. Reject 13, 27, 31.
- [ ] **Rule 16 — One grid alignment.** 12-column with 24–32 px gutters and 96 px outer (or web-equivalent: 1400px max-width container, 32 px side padding). Every element snaps; no element off-grid.
- [ ] **Rule 17 — Proximity.** Related items ≤16 px apart; unrelated ≥48 px apart. Group gap ≥2× within-group gap.

### Data & flow (Rules 18–19)

- [ ] **Rule 18 — Data-ink ≥80%.** Chart pixels: no 3D, no drop shadows on bars/lines, no gradient fills unless encoding value, ≤4 horizontal gridlines at ≤50% opacity, direct labels over legends.
- [ ] **Rule 19 — F/Z pattern.** Headline + key visual in top-left band (first 200 px vertical, or first 30% of canvas height). Image-led canvases follow Z (top-left → top-right → diagonal → bottom-right CTA).

### Mode discipline (Rule 20)

- [ ] **Rule 20 — Mode lock.** Artifact declares one mode (presenter ≤25 words, document ≤75 words, hero ≤10 words, data-dense ≤75 words structured) and stays in it. No mixing within a deck/page.

---

## Williams's CRAP — quick gut check (cross-cutting)

Before walking the 20 above, run the cheapest 4-check pass:

- [ ] **Contrast.** Two elements either identical or very different (size ≥1.5×, weight ≥200 apart, color ≥3:1).
- [ ] **Repetition.** Tokens reused; no canvas invents a new style.
- [ ] **Alignment.** Every element aligns to something — preferably the same column on every canvas in the set.
- [ ] **Proximity.** Related close, unrelated far.

If any of these 4 fails, the 20-rule check will fail too. Fix the CRAP issue first.

---

## Anti-AI-Slop Floor (cross-cutting)

These violations short-circuit the Critic — automatic Fail regardless of the other 20:

- Centered-everything symmetric layouts (unless the artifact is a section-divider title)
- Purple/blue gradients as the default background
- Uniform rounded corners on every element
- Stock-feeling decorative illustrations with no purpose
- Over-smoothed plastic surfaces
- Generic sans with no character
- Drop shadows on text
- Neon glow on text
- Six-bullet hero canvas
- Em dashes anywhere on the artifact (workspace rule)

---

## When to override

If the artifact format genuinely cannot meet a threshold (e.g., a 1:1 social square cannot achieve a 1920×1080's 96 px safe-zone), apply the override from `format-overrides.md` and note the override in the Critic report. **Do not silently bend a rule.** Either an override exists, or the rule fails.
