# social-taste

Visual-first social graphic generation for LinkedIn and X. Stops AI from producing centered, gradient-heavy, over-designed posts. Combinatorial engine forces variety across every content piece.

---

## When to use

Use this skill instead of free-form nanobanana prompting whenever producing:
- LinkedIn single-image posts (1200×1200 or 1200×627)
- LinkedIn carousels (1200×1500 per slide)
- X/Twitter post images (1600×900)
- Any organic social graphic

Replaces ad-hoc `social-graphics` skill invocations. Use `social-graphics` only for execution (nanobanana calls). This skill drives the prompt strategy.

---

## Configuration

```
VISUAL_AMBITION: 8       // how unexpected the layout is
COPY_WEIGHT: 4           // social posts need slightly more text than ads
HUMAN_PRESENCE: 6        // face optional, data/concept also works
BRAND_VISIBILITY: 3      // subtle branding only — looks like content, not promotion
```

---

## Combinatorial Engine

Pick one from each dimension before generating. No two posts in the same week should share Dimension 1.

### Dimension 1 — Content Anchor

| Option | Description |
|---|---|
| **A. Stat-led** | One number dominates. The data point IS the post. Everything else supports it. |
| **B. Quote-led** | A short, punchy quote from Gabriel or a client. Set at scale. Attribution minimal. |
| **C. List visual** | A scannable vertical list — but VISUAL, not a text dump. Icons, contrast, rhythm. Max 5 items. |
| **D. Face + hook** | Gabriel's face anchors the left. A bold hook fills the right. Emotion matches the topic. |
| **E. Concept image** | A strong visual metaphor. No face, no text-heavy. The image communicates the idea before reading. |
| **F. Before/After** | Two-state split. Broken vs. fixed. Then vs. now. Zero-attribution vs. full-stack. |

### Dimension 2 — Background

| Option | Description |
|---|---|
| **1. White/off-white** | Clean. Credible. Content-first. Typography does the work. |
| **2. Brand navy** | `#0A2540`. Use sparingly — only when contrast is needed against platform UI. |
| **3. Accent bold** | Gold `#FFB800` or Aqua `#1FB6FF` as full background. Only one accent per graphic. |
| **4. Textured neutral** | Paper, grain, concrete feel. Warm editorial tone. Not crypto. |
| **5. Dark dramatic** | Near-black. White text. Cinematic. Not navy + glow. |

### Dimension 3 — Typography Weight

| Option | Description |
|---|---|
| **I. Editorial large** | One headline at 60-80% canvas height. Everything else is footnote-sized. |
| **II. Balanced hierarchy** | Headline + subline + label. Three levels, clear contrast between each. |
| **III. Data callout** | Number massive, label tiny, context line small. Number is 5× larger than everything else. |
| **IV. Minimal label** | One short phrase. Lots of breathing room. The graphic carries the weight. |

### Dimension 4 — Layout

| Option | Description |
|---|---|
| **α. Asymmetric** | Content off-center. Visual tension. Nothing balanced. |
| **β. Full-bleed** | Image or color fills 100%. Text overlaid. No contained box. |
| **γ. Split** | Canvas divided cleanly. Two states, two ideas, two columns. |
| **δ. Centered with tension** | Centered content but with deliberate visual weight pulling in one direction (large background element, off-axis type). |

---

## Anti-Slop Rules — Social Graphics

BANNED patterns. If present, regenerate:

| Pattern | Why it fails |
|---|---|
| Purple/blue gradient background | 2021 crypto look. Instantly skippable. |
| Centered headline in a colored box | Every AI post looks like this. Zero differentiation. |
| Emoji bullets replacing real visual hierarchy | Lazy list design. Use real icons or spacing. |
| Brand colors as primary background on every post | Looks like a corporate newsletter, not content. |
| Gabriel's face floating on a dark gradient | v3. We know. Never again. |
| Decorative lines, dividers, or corner accents | Design for design's sake. Remove. |
| Font smaller than 24px at 1200px canvas width | Illegible at preview size. |
| More than 3 competing visual elements | Hierarchy collapse. Pick one focal point. |
| Fake testimonial cards with stock avatars | Kills credibility instantly. |
| "Designed" border with rounded shadow frame | Makes organic content look like an ad. |

---

## Format Specs

| Format | Dimensions | Notes |
|---|---|---|
| LinkedIn single image | 1200×1200 (square) | Primary format. Square outperforms 16:9 on mobile. |
| LinkedIn wide | 1200×627 | Use for data-heavy or split formats. |
| LinkedIn carousel slide | 1200×1500 | Portrait. First slide must stop scroll alone. |
| X post image | 1600×900 | 16:9. Bold and simple — X moves fast. |

---

## Carousel-Specific Rules

When producing a carousel:
1. **Slide 1 must work as a standalone ad.** It is shown before the swipe. If it doesn't stop scroll, the rest doesn't matter.
2. **Consistent visual system across slides.** Same background, same type scale, same icon treatment.
3. **Each slide = one idea.** No slide has more than 20 words.
4. **Last slide = CTA.** URL + one action. Nothing else.
5. **Max 7 slides.** Fewer is almost always better.

---

## Integration

- **Owner:** `content-writer` (organic social), `paid-media-agent` (boosted posts)
- **Execution tool:** `social-graphics` skill (nanobanana)
- **Pairs with:** `linkedin-post-writer` (copy first, then visual)
- **Does NOT replace:** `ad-taste` (paid ad creatives have different rules)

---

## Anti-Slop Floor (inherited)

This skill provides **variety** through its combinatorial dimensions. The **quality floor** comes from the `design-principles` skill (`references/critic-checklist.md` + `references/format-overrides.md`).

When generating prompts or selecting directions:

- Inherit the universal anti-AI-slop list from `critic-checklist.md` (centered-everything symmetric layouts, purple/blue gradients as default, uniform rounded corners on every element, drop shadow on text, neon glow on text, six-bullet hero, em dashes anywhere on the artifact). These are non-negotiable across all formats.
- Apply the format-specific row from `format-overrides.md` for safe-zone, body min, headline min, word budget, and default mode.
- This skill keeps any **skill-specific** anti-patterns that the universal floor does not cover (e.g., thumbnails ban neutral expressions; landing pages ban 3-column logo carousels; ads enforce single-accent for conversion). These remain in this file and stack on top of the universal floor.

The combinatorial dimensions in this skill produce *variety above a quality floor*. They are not a license to drop below it.
