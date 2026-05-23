# og-taste

Visual direction for blog hero images and Open Graph (OG) images on mangabeira.net. Stops every article from getting the same dark-gradient-with-text treatment. Combinatorial engine ensures each article has a distinct, on-brand visual identity.

---

## When to use

Use before generating any:
- Blog article hero image (above-fold, 1200×630)
- Open Graph / social share image (1200×630)
- Article thumbnail for LinkedIn when repurposing a blog post

Invoke at the start of `mangabeira-blog-writer` production or during SEO article production. Visual direction precedes writing, not the other way around.

---

## Configuration

```
VISUAL_AMBITION: 7       // distinctive but not distracting from the article
COPY_WEIGHT: 3           // article title + optional subline only
BRAND_VISIBILITY: 5      // consistent branding signals without looking templated
DISTINCTIVENESS: 9       // no two articles should have the same hero treatment
```

---

## Combinatorial Engine

Select one per dimension. Track selections in `seo/blog-registry.json` under `hero_style` so the same combination is never used for two articles in the same cluster.

### Dimension 1 — Visual Concept

| Option | Description |
|---|---|
| **A. Data visualization** | An actual chart, graph, or query result relevant to the article's core finding. Real data as the hero. |
| **B. Concept metaphor** | A striking image that visualizes the article's central idea without literal representation. |
| **C. Annotated screenshot** | A real tool UI (Dune, GA4, Etherscan) with one key finding annotated/highlighted. |
| **D. Bold typographic** | The article's most provocative sentence or stat, rendered as pure typography. No image. |
| **E. Face + context** | Gabriel's face with a brief visual context line. Used for opinion pieces and POV content. |

### Dimension 2 — Background Treatment

| Option | Description |
|---|---|
| **1. White editorial** | Clean, publication feel. Typography-forward. NYT/Substack energy. |
| **2. Brand navy** | `#0A2540` base. Aqua or Gold accent. Authoritative. Use for data-heavy articles. |
| **3. Textured warm** | Off-white or cream with subtle grain. Editorial warmth. Less crypto, more analyst. |
| **4. High-contrast dark** | Near-black. White text. Cinematic. Use for provocative or contrarian takes. |

### Dimension 3 — Text on Image

| Option | Description |
|---|---|
| **I. Title only** | Article H1, set large. No subline. Clean. |
| **II. Title + one stat** | Headline + the single most interesting data point from the article. |
| **III. Pull quote** | The article's sharpest sentence. Not the title. A line from inside the piece. |
| **IV. No text** | Pure visual. Article title handled by the page template. Only works for concept metaphor or annotated screenshot anchors. |

### Dimension 4 — Composition

| Option | Description |
|---|---|
| **α. Left-aligned** | Title/stat anchored left. Right side breathes. |
| **β. Full-bleed visual** | Image fills canvas. Text overlaid with contrast treatment. |
| **γ. Split horizontal** | Top half visual or color. Bottom half typography. |
| **δ. Typographic anchor** | Text dominates. Image or graphic element is subordinate accent. |

---

## Anti-Slop Rules — Blog Hero Images

BANNED. Regenerate if present:

| Pattern | Why it fails |
|---|---|
| Dark navy background + Aqua gradient glow on every article | All articles look identical. Zero distinctiveness. |
| Generic stock photo of a laptop or person typing | Zero credibility for a data/analytics brand. |
| Article title in a pill/badge at the top + subtitle below + author line | Looks like a generic blog template card, not an editorial image. |
| Purple/teal AI-aesthetic gradient | 2023 crypto content mill look. |
| Decorative wave or blob shapes as background accent | Design filler. Adds nothing. |
| The word "BLOG" anywhere in the image | Redundant. The page tells users it's a blog. |
| Font size below 28px at 1200px canvas width | Illegible in social share previews. |
| Text centered on a busy background image with no contrast treatment | Unreadable at thumbnail size. |

---

## OG Image vs. Hero Image

| Use | Dimensions | Where it appears |
|---|---|---|
| Blog hero | 1200×630 | Above fold on the article page. Largest visual. |
| OG image | 1200×630 | Social shares, search engine rich cards, LinkedIn previews. Must read at 400px width. |

For most articles: produce one image that serves both roles. Add `preserve_styles: true` if pushed via mangabeira-content MCP.

If producing separate versions: OG image must have higher contrast and larger text (legibility > artistry at thumbnail size).

---

## Naming Convention

```
seo/images/[slug]-hero.png        // blog hero
seo/images/[slug]-og.png          // OG/social share (if different)
```

Update `seo/blog-registry.json`:
```json
"hero_image": "seo/images/[slug]-hero.png",
"hero_style": "[D1][D2][D3][D4]"   // e.g. "A2Iα" — track to prevent repeats
```

---

## Integration

- **Owner:** `content-writer` (article production), `seo-agent` (OG meta tag injection)
- **Execution tool:** nanobanana (`mcp__nanobanana__generate_image`)
- **Pairs with:** `mangabeira-blog-writer` (article), `seo-aeo-geo` (meta tags)
- **Trigger:** Start of every blog article production run

---

## Anti-Slop Floor (inherited)

This skill provides **variety** through its combinatorial dimensions. The **quality floor** comes from the `design-principles` skill (`references/critic-checklist.md` + `references/format-overrides.md`).

When generating prompts or selecting directions:

- Inherit the universal anti-AI-slop list from `critic-checklist.md` (centered-everything symmetric layouts, purple/blue gradients as default, uniform rounded corners on every element, drop shadow on text, neon glow on text, six-bullet hero, em dashes anywhere on the artifact). These are non-negotiable across all formats.
- Apply the format-specific row from `format-overrides.md` for safe-zone, body min, headline min, word budget, and default mode.
- This skill keeps any **skill-specific** anti-patterns that the universal floor does not cover (e.g., thumbnails ban neutral expressions; landing pages ban 3-column logo carousels; ads enforce single-accent for conversion). These remain in this file and stack on top of the universal floor.

The combinatorial dimensions in this skill produce *variety above a quality floor*. They are not a license to drop below it.
