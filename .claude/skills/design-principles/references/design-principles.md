# Design Principles for Codified Visual Generation

*Adapted from ItsssssJack/power-design (MIT). Source authorities: Tufte, Reynolds, Duarte, Williams (CRAP), Refactoring UI, Müller-Brockmann, Bringhurst, Butterick, Mayer, NN/g, WCAG 2.2.*

> **Scope.** Every rule below is **codifiable** — a number, ratio, threshold, or "if X then Y." Rules that resist measurement have been refused or rewritten as concrete checks. Where two authorities conflict, the contradiction is surfaced with a recommendation. Applies to every visual artifact — slides, social graphics, carousels, landing pages, OG images, ad creatives, thumbnails, infographics. Format-specific relaxations live in `format-overrides.md`.

---

## TL;DR — The 20 Rules That Matter Most

1. **One idea per canvas.** Maximum one headline (≤10 words) + at most one supporting body block. If you'd need a second headline, split. [Reynolds; Duarte]
2. **Glanceable in ≤3 seconds.** A viewer must extract the canvas's single message in ≤3s. [Duarte; NN/g]
3. **Maximum 7 ± 2 distinct visual chunks per canvas; ideal 3–5.** Group with proximity. [Miller 1956; Cowan 2001 ≈ 4]
4. **40% minimum whitespace ratio.** ≥40% empty pixel area; hero/title canvases ≥60%; quote canvases ≥70%. [Refactoring UI; Reynolds]
5. **Edge safe-zone = 5% of canvas width on every side.** No text, logo, or focal element inside that band. [Broadcast title-safe; Apple HIG]
6. **Type scale uses a fixed ratio (1.25, 1.333, 1.414, 1.5, or 1.618).** Pick one; derive every size from it. [Tschichold; Bringhurst; Tim Brown]
7. **Maximum 4 type sizes per canvas, 6 across the deck/page.** [Refactoring UI; Müller-Brockmann]
8. **Body text ≥24 px on a 1920×1080 reference (≥16 px on web), ≥28 pt for projection.** Title ≥48 px. Caption floor 18 px. [Reynolds; Duarte]
9. **Line-height 1.4–1.6 for body, 1.05–1.2 for display.** [Butterick; Bringhurst]
10. **Line length ≤60 characters; ideal 45–60.** [Bringhurst; Butterick]
11. **WCAG contrast ≥4.5:1 body, ≥3:1 large; aim for 7:1 (AAA) on slides for projector resilience.** [WCAG 2.2]
12. **60-30-10 color split.** 60% dominant, 30% secondary, 10% accent. [Itten; Refactoring UI]
13. **One accent color per canvas.** Multiple accents = no accent. [Tufte; Schoger]
14. **Never encode meaning in hue alone.** Pair color with shape, label, weight, or icon. [WCAG 1.4.1; ColorBrewer]
15. **8-pt grid for all spacing.** All values ∈ {8, 16, 24, 32, 48, 64, 96, 128}. Never 13, never 27. [Bryn Jackson; Material]
16. **Align everything to one grid; prefer 12-column with 24–32 px gutters.** [Müller-Brockmann]
17. **Proximity: related items ≤16 px apart, unrelated ≥48 px apart.** [Gestalt; Williams CRAP]
18. **Data-ink ratio ≥80% on charts.** No 3D, no gradients on data, no chartjunk. [Tufte 1983]
19. **F-pattern: headline + key visual top-left.** First 200 px vertical = primary attention zone. [NN/g eye-tracking 2006/2017]
20. **Two valid modes per artifact — pick one and stay.** Presenter (sparse, ≤25 words) vs. document (denser, hierarchical). Or for non-deck formats: hero (≤10 words) vs. data-dense (≤75 words). [Tufte vs. Reynolds — synthesis]

---

## Section 1 — Cognitive Load & Attention

### Miller's Law (working-memory limit)
**Source:** Miller 1956; Cowan 2001 (≈ 4 chunks).
**Rule:** Maximum 7 distinct visual elements before chunking; target 3–5 chunks after grouping. If item count > 5, group into ≤5 super-chunks via proximity, borders, or cards.
**Note:** Visual artifacts are scanned, not studied — apply the stricter Cowan limit (4 ± 1).

### Hick's Law
**Source:** Hick & Hyman 1952. Decision time ∝ log₂(n+1).
**Rule:** ≤1 call-to-action and ≤1 decision per canvas. Pricing tiers: cap at 3 visible options.

### Fitts's Law (visual acquisition variant)
**Source:** Fitts 1954.
**Rule:** Dominant focal element occupies ≥25% of canvas area or is ≥3× larger than secondary elements. Interactive elements ≥44 × 44 px.

### One Idea Per Canvas
**Source:** Reynolds *Presentation Zen*; Duarte *Slide:ology*.
**Rule:** 1 headline (≤10 words, ideal 5–7) + 1 supporting block. If two arguments are needed, split into two artifacts.

### Signal-to-Noise
**Source:** Tufte *The Visual Display of Quantitative Information* (1983); *Beautiful Evidence* (2006).
**Rule:** Every non-data pixel is a candidate for deletion. Test: remove the element — does comprehension drop? If no, delete permanently.
**Codifiable:** No drop shadows >4 px, no gradients on non-meaningful surfaces, no decorative borders, no background patterns behind text, no logos repeated on every interior slide.

### Don't Make Me Think
**Source:** Krug 2000.
**Rule:** Zero cognitive effort to parse structure — only content. Headline always top, body below, supporting visual paired with the claim, source citation bottom-right at 14–16 px / 50% opacity neutral.

---

## Section 2 — Visual Hierarchy

### Scale-Based Emphasis
**Source:** Müller-Brockmann; Refactoring UI.
**Rule:** Primary ≥2× secondary; secondary ≥1.5× tertiary. Avoid 10–20% size differences (read as the same).
**Codifiable:** Headline:body ratio ∈ [2.0, 4.0]. Subhead:body ∈ [1.25, 1.5].

### Weight-Based Emphasis
**Source:** Refactoring UI; Bringhurst.
**Rule:** Use weight before size for inline emphasis. Bold (600–700) for emphasis, regular (400) for body. **Ban weights below 300 on body text** — they vanish under projection or low-DPI screens.

### Color-Based Emphasis (single accent)
**Source:** Tufte's smallest effective difference; Schoger.
**Rule:** Neutral grayscale for ~90% of UI/text. Reserve full-saturation accent for the one thing the viewer must see. Per canvas: ≤1 accent-colored element.

### F-Pattern / Z-Pattern
**Source:** NN/g eye-tracking 2006, 2017, 2023.
**Rule:** Text-heavy → F-pattern (headline top-left, visual along top horizontal, secondary along left vertical). Image-led → Z-pattern (top-left → top-right → diagonal → bottom-right CTA). Most important element in the top-left quadrant or first 30% of canvas height.

### Single Focal Point
**Source:** Reynolds; Duarte.
**Rule:** Each canvas has exactly 1 focal point. Test: squint — what do you see first?
**Codifiable:** Largest element ≥1.5× area of next largest, OR is the only saturated-color element, OR isolated by ≥48 px more whitespace than any other.

---

## Section 3 — Gestalt

### Proximity
**Source:** Wertheimer 1923; Williams CRAP.
**Rule:** Related items ≤16 px apart; unrelated ≥48 px apart. Gap between groups ≥2× gap within groups.

### Similarity
**Rule:** Same visual treatment ⇒ same role. Each role (heading, body, caption, link, accent number) has exactly one style spec.

### Common Region (containers)
**Source:** Palmer 1992.
**Rule:** Items inside the same container are perceived as a group. Card padding ≥24 px on all sides; card gap ≥24 px between cards.

### Figure/Ground
**Rule:** Foreground and background must be unambiguously separable. Text on image: scrim ≥40% opacity, OR text shadow ≥2 px / 30% opacity, OR shifted into solid color zone.
**Codifiable:** Measure contrast at 9 sample points across the text bounding box; ≥4.5:1 at every point.

### Closure & Continuity
**Rule:** Avoid heavy borders when implied alignment achieves the same grouping. Use continuous lines/edges to lead the eye between related elements.

### Symmetry vs. Asymmetry
**Source:** Gestalt; Tschichold.
**Rule:** Either fully symmetric (centered title canvases, section dividers) or deliberately asymmetric on a grid. **Never accidentally near-symmetric** — a 10-px offset reads as a mistake.
**Codifiable:** If horizontal-center distance differs by ≤5% of width, snap to true center; otherwise enforce ≥15% asymmetry.

---

## Section 4 — Typography

### Modular Type Scale
**Source:** Tim Brown *Modular Scale*; Bringhurst.
**Rule:** Pick one ratio; derive all sizes:
- 1.200 (minor third) — tight, dense
- 1.250 (major third) — balanced default
- 1.333 (perfect fourth) — confident, presentation-friendly **(workspace default)**
- 1.414 (augmented fourth, √2) — strong contrast
- 1.500 (perfect fifth) — high-drama hero
- 1.618 (golden) — editorial

**Default:** 1.333 with base 20 px → 20, 27, 36, 48, 64, 85, 113. Round to 8-pt-friendly: **20, 28, 36, 48, 64, 84, 112.**

### Font Pairing
**Rule:** Maximum 2 typefaces (display + body). Must contrast in classification, width, or weight personality. Single-family decks (e.g. Inter only) also valid.

### Line-Height
**Rule:**
- Body (16–24 px): 1.4–1.6
- Subhead (24–40 px): 1.25–1.4
- Display (≥48 px): 1.0–1.2
- Tight headlines: 0.95 acceptable for very large display
**Codifiable:** `line-height = 1.5 - (font-size-px - 16) × 0.005`, clamped to [1.0, 1.6].

### Tracking
- Display ≥48 px: tighten -0.5% to -2% (`letter-spacing: -0.01em` to `-0.02em`)
- Body 16–24 px: 0
- ALL CAPS: open +5% to +10%

### Hierarchy via Limited Sizes
**Rule:** ≤4 sizes per canvas; ≤6 per deck/page.

### Line Length
**Rule:** Body ≤60 characters; display ≤30 characters per line. `max-width: 60ch` for body.

### Minimum Readable Size
**Rule:**
- 1920×1080 reference: body ≥24 px, headline ≥48 px, caption ≥18 px
- Web (1440 viewport): body ≥16 px, headline ≥32 px, caption ≥14 px
- Projected: body ≥28 pt
- Footer/source: 14–16 px, 50–60% opacity

---

## Section 5 — Color & Contrast

### 60-30-10 Distribution
**Codifiable check:** Sample canvas pixels — accent should occupy 5–15% of pixel area. >15% reduce; <2% no focal accent.

### WCAG Contrast Minimums

| Element | AA | AAA |
|---|---|---|
| Body (<24 px regular or <18.66 px bold) | 4.5:1 | 7:1 |
| Large (≥24 px regular or ≥18.66 px bold) | 3:1 | 4.5:1 |
| UI / graphical objects | 3:1 | — |

**Note:** Aim for AAA (7:1) on slides — projectors wash contrast 30–50%.

### Color Harmony Schemes
Pick one and stick:
- **Monochromatic** — one hue, vary L and S only
- **Analogous** — 3 hues within 30°
- **Complementary** — 2 hues 180° apart, one as accent only
- **Split-complementary** — base + 2 hues flanking complement
- **Triadic** — 3 hues 120° apart

### HSL Reasoning over Hex
Build palettes by holding hue constant and varying L/S. 9 shades per hue (50–900). For text on background, pair shades ≥400 numerical steps apart.

### Don't Encode Meaning by Hue Alone
For any color-coded distinction, pair color with shape, label, icon, weight, or position. ~8% of men have red-green color blindness.

### Single-Accent System
Per deck/page: one accent color. Per canvas: one accent moment.

---

## Section 6 — Spatial Systems

### 8-Point Grid
**Source:** Bryn Jackson "The 8-Point Grid"; Material.
**Rule:** Every margin, padding, gap, and component dimension = multiple of 8 px. 4-px allowed for icon-internal only.
**Scale:** 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 256.

### Modular / Columnar Grid
**Rule:** 12-column grid with 24–32 px gutters and 96 px outer margin on 1920×1080 reference. Web: 1400px max-width container, 32px side padding, 12-col with 24px gutters.

### Golden Ratio (1.618)
**Rule:** When canvas divides into two zones, prefer 1:1.618 (≈38% / 62%). Use sparingly — 8-pt grid is the daily driver.

### Rule of Thirds
**Rule:** Place focal points at thirds intersections (not center). For 1920×1080: (640, 360), (1280, 360), (640, 720), (1280, 720).

### Whitespace Ratio
- Information canvas: ≥40% empty pixels
- Hero/title/section: ≥60%
- Quote: ≥70%
**Check:** Render canvas; count pixels matching background color. Below threshold → increase padding / reduce content.

### Active vs Passive Whitespace
Whitespace inside components (line-height, padding) is *passive*; whitespace separating sections is *active*. Increase active before reducing passive.

---

## Section 7 — Alignment & Rhythm

### Strict Grid Alignment
**Rule:** Every element aligns to ≥1 grid line (left, right, center, top, baseline). Misalignments ≤4 px get snapped.

### Vertical Rhythm
**Rule:** Vertical spacing increments are multiples of body line-height. With body 24 px × 1.5 = 36 px line, vertical gaps = 36, 72, 108, 144 px. Pure baseline grid is hard on slides; 8-pt vertical grid is the practical compromise.

### Optical vs Mathematical Alignment
**Rule:** For circular/triangular shapes, icons, and large punctuation, override mathematical center by 1–4 px so the shape *looks* centered. Quotation marks, bullets, asterisks should hang outside the text block.

### Edge Safe-Zone
**Rule:** No text, logo, or focal element within 5% of any canvas edge. On 1920×1080: ≥96 px. On 1080×1080 social: ≥54 px. On 1200×630 OG: ≥60 px wide / ≥32 px tall.

---

## Section 8 — Format-Specific Rules

### Presenter Mode vs Document Mode (the two valid modes for slides)
**Source:** Reynolds (presenter); Tufte (document); Duarte (acknowledges both).
- **Presenter mode (live):** ≤25 words per slide, image-led, headline + visual.
- **Document mode (read alone, sent as PDF):** dense allowed but hierarchical — headlines, sub-points, source citations.

For non-deck formats, the two valid modes are:
- **Hero mode:** ≤10 words per canvas, image- or typographic-led (landing hero, OG, ad)
- **Data-dense mode:** ≤75 words, structured (carousel slide 2+, infographic, document page)

**Codifiable:** Mode token at deck/page/asset level. Presenter rejects >25 words. Document rejects no headline. Hero rejects >10 words. Data-dense rejects no hierarchy.

### Glanceable Comprehension (3-second rule)
**Rule:** ≤3 seconds to grasp the single message. Word count budget ≤25 (presenter/hero) or ≤75 (document/data-dense). 1 focal point identifiable. Headline answers "so what?"

### Reject the 6×6 Rule
**Rule:** ≤3 bullets per canvas, ≤8 words per bullet — OR no bullets at all (preferred). Bullets are a fallback; use a diagram, image, chart, or single statement first.

### Tufte's PowerPoint Critique
**Rule:** Banish 3D charts, bevels, shadows, gradients on data, decorative borders. Banish bullet-summaries that strip causal/numeric detail. Data-ink ≥80%. If content has dense numeric/causal structure, output a one-page report, not a slide deck.

### Mayer's Multimedia Learning Principles
- **Coherence:** every element earns its place
- **Signaling:** 1 accent + 1 weight emphasis per canvas
- **Redundancy:** presenter notes ≠ on-canvas text verbatim
- **Spatial contiguity:** label-to-target distance ≤32 px
- **Temporal contiguity:** labels appear with their visuals

---

## Section 9 — Accessibility

### Color-Blind Safe Pairs
Blue + orange, blue + red (avoid red + green), purple + yellow, navy + tan. Never red vs green for win/loss without an icon.

### Minimum Type for Projection
28 pt for body; 24 pt acceptable for high-DPI screens viewed close. Footer/source: 14–16 px, 50% opacity.

### Motion & Animation
Avoid auto-play. Transitions ≤300 ms. No flashing >3× per second. (WCAG 2.2 SC 2.3.3)

---

## Section 10 — Imagery

### Full-Bleed vs Framed
- **Full-bleed:** image *is* the message (hero, emotional impact). 100% canvas area, text overlay with scrim.
- **Framed:** image *supports* the message. 50–66% width, padded inside grid columns.

### Rule of Thirds in Composition
Place focal subject on a thirds intersection. Avoid dead-center subjects unless the canvas is a perfectly symmetric title.

### Image-Text Overlay (legibility)
Text on image requires:
- Scrim 40–70% opacity, OR
- Gradient scrim `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0))` bottom-up, OR
- Solid panel ≥24 px padding, full opacity
**Re-measure contrast** at 9 sample points after compositing; require ≥4.5:1 at every point.

### Photo vs Illustration vs Diagram
- **Photo:** when emotion, authenticity, or a real person/place matters
- **Illustration:** when concept is abstract and personality matters
- **Diagram:** when relationships/flow/structure is the point
- **Icon:** reinforce a label at small size; never replaces the label
**Rule:** One image type per canvas.

### Icon Sizing
Inline icons match cap height (1 em). Standalone: 24, 32, 48, or 64 px. Never <16 px. Allowed sizes: {16, 20, 24, 32, 40, 48, 64, 96}.

---

## Section 11 — Information Density & Charts

### Tufte's Data-Ink Ratio
≥~80% of chart pixels encode data. Cuts: no 3D, no drop shadows on bars/lines, no gradient fills unless encoding value, ≤4 horizontal gridlines at 50% opacity, axis labels only at relevant ticks, direct labels over legends.

### Sparkline & Small-Multiples
For trend across many entities, prefer small-multiples over a single dense overlay. Cap series in one chart at 5; beyond that, small-multiples.

### Chart Title = Conclusion, Not Topic
**Source:** Knaflic *Storytelling with Data*.
**Rule:** Title states the takeaway. "Q3 revenue grew 22%" not "Q3 revenue."
**Codifiable:** Titles must contain a verb or comparison; reject pure noun-phrase titles.

### Information Density Budget
- Title canvas: ≤10 words
- Section divider: ≤8 words
- Content (presenter/hero): ≤25 words
- Content (document/data-dense): ≤75 words
- Quote: ≤30 words
- Closing: ≤10 words

### When to Split a Canvas
Split if any of these is true: word count exceeds budget, more than 1 headline-worthy claim, more than 5 chunks after grouping, two charts of equal weight, more than 1 accent moment.

---

## Section 12 — Williams's CRAP

**Source:** Williams *The Non-Designer's Design Book* (1994).

Every canvas passes 4 checks:
1. **Contrast.** If two elements aren't identical, make them very different (size ≥1.5×, weight ≥200 apart, color ≥3:1).
2. **Repetition.** Visual elements repeat across the deck/page. Tokens reused; no canvas invents a new style.
3. **Alignment.** Every element aligns to something — preferably the same column on every canvas.
4. **Proximity.** Related items close, unrelated items far.

This is the cheapest, most powerful checklist Claude can run before emitting any visual.

---

## Section 13 — Resolved Contradictions

| Conflict | Resolution |
|---|---|
| Tufte (more density) vs Reynolds (less density) | Both right within mode. `mode = 'presenter' \| 'document' \| 'hero' \| 'data-dense'` at deck/page level. |
| 6×6 bullet rule vs no-bullet rule | 6×6 is mediocre with measurable comprehension cost (Mayer). Replace with ≤3 bullets ≤8 words OR no bullets. |
| Golden ratio vs 8-pt grid | 8-pt grid wins for daily layout; golden ratio reserved for hero/title splits. |
| Symmetry (Gestalt) vs Asymmetry (Tschichold) | Either fully symmetric or ≥15% offset. Danger zone is near-symmetric. |
| Brand voice/saturation vs WCAG contrast | WCAG wins for text. Preserve brand at 100% only for non-text accents; use brand-derived shades for text to hit contrast. |
