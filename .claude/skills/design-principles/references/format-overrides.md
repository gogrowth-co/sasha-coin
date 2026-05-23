# Format Overrides

The 20 principles in `design-principles.md` use a 1920×1080 reference. Real artifacts come in many shapes. This file lists the per-format relaxations the Critic must apply *before* declaring a Fail.

If a format isn't listed here, use the default (1920×1080-derived) thresholds. If you discover a format that genuinely needs an override, add it here — do not silently bend the rule in a one-off Critic run.

---

## Format reference table

| Format | Canvas | Safe-zone | Body min | Headline min | Word budget | Default mode |
|---|---|---|---|---|---|---|
| Slide (16:9) | 1920×1080 | 96 px | 24 px | 48 px | ≤25 (presenter) / ≤75 (document) | presenter |
| Slide (4:3) | 1440×1080 | 72 px | 24 px | 48 px | ≤25 / ≤75 | presenter |
| Social square | 1080×1080 | 54 px | 28 px | 56 px | ≤20 | hero |
| Social portrait (LinkedIn 4:5) | 1080×1350 | 54 px | 28 px | 56 px | ≤25 | hero |
| Social landscape (LinkedIn 1.91:1) | 1200×627 | 60 px wide / 32 px tall | 24 px | 48 px | ≤20 | hero |
| Carousel slide 1 (cover) | 1080×1350 | 54 px | 28 px | 64 px | ≤15 | hero |
| Carousel slide 2+ (content) | 1080×1350 | 54 px | 24 px | 40 px | ≤50 | data-dense |
| OG / social share | 1200×630 | 60 px wide / 32 px tall | 24 px | 48 px | ≤15 | hero |
| Thumbnail (YouTube / X video) | 1280×720 | 64 px | n/a | 56 px | ≤6 | hero |
| Ad creative (LinkedIn TLA) | 1200×627 | 60 px / 32 px | 24 px | 48 px | ≤20 | hero |
| Ad creative (X) | 1600×900 | 80 px | 24 px | 56 px | ≤20 | hero |
| Ad creative (Reddit) | 1200×628 | 60 px / 32 px | 24 px | 48 px | ≤25 | hero |
| Landing hero (web) | viewport | 32 px side / 64 px top-bottom | 16 px | 48 px (md+) / 32 px (sm) | ≤25 | hero |
| Landing section (web) | viewport | 32 px side / 48 px top-bottom | 16 px | 32 px | ≤75 | data-dense |
| Email header | 600 px wide | 24 px | 16 px | 28 px | ≤20 | hero |
| Infographic (single image) | 1080×1350 | 54 px | 18 px | 36 px | ≤120 | data-dense |

Word budgets are guidelines, not hard caps for all rules — Rule 2 (glanceable in 3s) and Rule 20 (mode lock) reference these when scoring.

---

## Per-format anti-pattern overrides

### Social square (1080×1080)
- Quote canvases: bump whitespace ratio to ≥75% (not 70%) — square format makes overcrowding obvious.
- Single-accent rule: tighten to ≤8% of pixel area (instead of 10%) — small canvas amplifies accent presence.

### Carousel slide 1 vs 2+
- Slide 1 must work standalone (Rule 1: one idea, glanceable in 3s) — it gates whether anyone swipes.
- Slides 2+ allow ≤50 word budget but still must respect ≤4 type sizes per slide; consistent system across all slides.

### OG / social share (1200×630)
- Vertical safe-zone is tighter (32 px) — banner format has limited height. Keep headline + supporting tag in the safe-zone; logo can sit at edge.
- Headline min 48 px even though canvas is short — must read at thumbnail preview size (often rendered at 200–500 px wide in feeds).

### Thumbnail (1280×720)
- Word budget ≤6 at 700+ font weight. Anything more is unreadable at 120 px preview.
- Face presence ≥50% of canvas area when face-led.
- Ban neutral expressions — thumbnails compete on emotional read at preview size.
- Contrast: target 7:1 (not just 4.5:1) — preview compression destroys mid-range contrast.

### Ad creative (any platform)
- Single-accent rule is non-negotiable. The accent is the conversion driver; multiple accents kill click-through.
- Rule 19 (F/Z pattern) is strict — eye must reach the CTA in one saccade.

### Landing page (web)
- Mode mixing is allowed *across sections* (hero = hero mode; subsequent sections = data-dense). But within a single section, Rule 20 still holds.
- Whitespace ratio measured per section, not per viewport. Each section must hit its mode's ratio.
- Rule 16 (12-col grid) means the workspace 1400 px max-width, 32 px side padding, 24 px gutter — match `_context/brand-style.md` if specified there.

### Infographic
- Word budget ≤120 — denser than other canvases by definition.
- Data-ink ratio still ≥80% on every chart subsection.
- ≤6 type sizes total (not 4) — infographics legitimately need more hierarchy.
- Mode is data-dense by default; presenter mode rejects infographics outright.

### Slide deck (general)
- Title + closing slides exempt from the 96 px safe-zone for backgrounds (full-bleed allowed) but text inside must still respect the safe-zone.
- Logo on every interior slide allowed only if Power-Design-style small wordmark in safe-zone (≤24 px tall, bottom-left). Section dividers and title slide can carry larger logo.
- Mixing presenter and document mode in one deck is a Rule 20 fail. Pick one.

---

## How the Critic applies overrides

```
1. Read the artifact's format from the brief (or detect from canvas dimensions).
2. Look up the row in the table above.
3. Use those thresholds to evaluate Rules 4, 5, 8, 11, and 20.
4. Apply per-format anti-pattern overrides on top of the universal anti-AI-slop floor.
5. Default-table thresholds apply to any rule not explicitly overridden.
6. Report Pass/Fail using the override values, but cite which override row was applied.
```

If an override is missing for a format and the default is genuinely wrong for it, do not improvise — flag it back to the user with `[NEEDS OVERRIDE: <format> on <rule>]` and add the override to this file once decided.
