---
name: branded-deck
description: "Create branded presentation decks in the Analyst in the Arena visual identity. Use this skill when the user asks to create a strategy deck, campaign deck, pitch deck, client presentation, or any .pptx output for this project. This skill extends the official pptx skill with brand-specific layouts, colors, fonts, and decorative elements. Triggers: 'create a deck', 'build a presentation', 'make slides', 'branded deck', 'strategy presentation', 'campaign deck'."
---

# Branded Deck Skill

Create presentation decks that match the Analyst in the Arena visual identity exactly.

This skill extends the official `pptx` skill. Read the `pptx` skill's `pptxgenjs.md` for PptxGenJS API reference, and its `SKILL.md` for QA workflow and image conversion. This file defines the brand-specific design system and composition workflow. The layout implementations are in [layouts.md](layouts.md).

**Reference template:** `assets/deck_template.pptx` (visual reference for what the output should look like).
**Full analysis:** See `presentations/deck-template-analysis.md` in the project root for the complete reverse-engineering of the template.

---

## Design System

### Colors

No `#` prefix. PptxGenJS takes bare hex strings.

| Name | Hex | Role |
|------|-----|------|
| Navy | `0A2540` | Primary background (all slides except CTA) |
| Aqua | `1FB6FF` | Accent 1: edge bars, top stripes, labels, connectors, links |
| Gold | `FFB800` | Accent 2: edge bars, stat numbers, company names, CTAs, rules |
| White | `FFFFFF` | Headlines, card titles, list items |
| Slate | `8B9BAD` | Descriptions, captions, URLs, supporting text |
| MidNavy | `0D3558` | Card/panel surface background |
| DarkNavy | `071829` | CTA slide background, footer bars |
| Crimson | `CC3355` | Danger accent (disqualifiers border and label) |
| DarkCrimson | `1A0A10` | Danger surface (disqualifiers panel fill) |

### Fonts

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| Headers | Montserrat | Bold | Headlines, section labels, stat numbers, card titles, CTA text |
| Body | Inter | Regular | Descriptions, captions, supporting text, URLs |

These are Google Fonts. They must be installed on the machine rendering the .pptx. If not available, PowerPoint falls back to Calibri.

### Text Styles

All text boxes use `margin: 0` for precise alignment.

| Style | Font | Size (pt) | Bold | Color | Align | Case | charSpacing |
|-------|------|-----------|------|-------|-------|------|-------------|
| Section label | Montserrat | 9 | yes | Aqua or Gold | left | UPPER | 4 |
| Hero headline | Montserrat | 38 | yes | White | left | title | 0 |
| Title headline | Montserrat | 52 | yes | White | left | title | 0 |
| Stat number | Montserrat | 36 | yes | Gold | center | - | 0 |
| Step number | Montserrat | 28 | yes | Gold | center | - | 0 |
| Card title | Montserrat | 14 | yes | White | left or center | title | 0 |
| Card label | Montserrat | 11 | yes | White | center | title | 0 |
| Sub-label | Montserrat | 9 | yes | Aqua | UPPER | UPPER | 3 |
| Body text | Inter | 10 | no | Slate | left | sentence | 0 |
| Caption | Inter | 9 | no | Slate | left or center | sentence | 0 |
| Subtitle | Inter | 15 | no | Aqua | left | title | 0 |
| URL | Inter | 12 | no | Slate | left | lower | 0 |
| CTA button text | Montserrat | 16 | yes | Navy | center | title | 0 |
| CTA label | Montserrat | 10 | yes | Gold | center | UPPER | 5 |

### Key Measurements (inches)

Slide dimensions: 10" x 5.625" (`LAYOUT_16x9`)

| Element | Value |
|---------|-------|
| Edge bar width | 0.08" |
| Content left margin | 0.50" |
| Section label position | x: 0.50", y: 0.45" |
| Headline position | x: 0.50", y: 0.85" |
| Headline width | 8.50" |
| Card top stripe height | 0.06" |
| Gold rule height | 0.05" |
| Left accent bar width | 0.05" |
| Dot grid circle diameter | 0.10" |
| Dot grid spacing | 0.28" |
| Step circle diameter | 0.50" |
| Connector bar | 0.08" x 0.20" |
| CTA button | 3.00" x 0.65" |

---

## Layout Catalog

Nine layout types, each with a default edge bar color. See [layouts.md](layouts.md) for the PptxGenJS implementation of each.

| # | Layout | Edge Bar | Use for |
|---|--------|----------|---------|
| 1 | `titleSlide` | Aqua | Opening slide. Brand label, hero name/title, subtitle, gold rule, URL. |
| 2 | `statCards` | Gold | 3 big-number callouts with labels and captions. |
| 3 | `credentialRows` | Aqua | 2-4 horizontal proof-point rows (case studies, credentials). |
| 4 | `twoPanelComparison` | Gold | Side-by-side lists: fit/disqualify, before/after, pros/cons. |
| 5 | `processSteps` | Aqua | 3 numbered columns showing a methodology or workflow. |
| 6 | `verticalTimeline` | Gold | 3 numbered full-width rows with connectors (how-it-works). |
| 7 | `pillarCards` | Aqua | 3-5 equal columns for categories, pillars, or service lines. |
| 8 | `tagGrid` | Aqua | 2-row grid of labeled tags (verticals, skills, tools). |
| 9 | `ctaSlide` | Gold (top) | Closing slide with CTA button and contact info. |

### When Called with a Visual Brief

When the designer agent passes a locked Visual Brief, the brief determines:
- Which layout types to use (mapped from the brief's Format field)
- Color emphasis (which accent color dominates: Aqua or Gold)
- Visual tone (influences spacing density, text volume, decorative elements)
- Anti-slop directives (specific layout patterns to avoid)

Map the brief to deck-specific decisions:
- **Composition** -> slide sequence and layout type selection
- **Color Emphasis** -> edge bar color choices, accent color dominance across slides
- **Typography Hierarchy** -> headline sizes, stat number prominence, body text density
- **Visual Tone** -> spacing density (airy vs. dense), number of slides, content per slide
- **Anti-Slop Directives** -> add to the QA checklist as additional fail conditions

When called WITHOUT a brief, use the existing planning workflow as before.

---

## Workflow

### 1. Plan the deck

Before writing any code, plan the slide sequence. Each slide needs:
- A layout type from the catalog above
- A section label (ALL CAPS, short)
- A headline (1-2 lines)
- Content specific to the layout (items, stats, rows, etc.)

Write the plan as a simple list before coding:
```
1. titleSlide: "Gabriel Mangabeira" / "Web3 Growth Strategist"
2. statCards: "THE POSITION" / 3 stats
3. credentialRows: "PROOF POINTS" / 3 credentials
...
9. ctaSlide: "READY TO BUILD?"
```

### 2. Read brand context

Read `_context/brand-voice.md` and `_context/product-info.md` for content. Do not invent metrics, claims, or case study figures. If real data is not available, flag `[NEEDS DATA]` in the slide content.

### 3. Generate the script

Write a single PptxGenJS script that:
1. Imports pptxgenjs
2. Defines the brand constants (copy from layouts.md scaffold)
3. Calls layout functions in sequence, passing content
4. Writes the output .pptx

Read [layouts.md](layouts.md) for the complete scaffold and all layout implementations.

### 4. Run the script

```bash
NODE_PATH=$(npm root -g) node deck.js
```

The `NODE_PATH` prefix ensures the globally installed pptxgenjs is found. Output goes to the `presentations/` folder per the project's routing rules.

### 5. QA and Design Critic (required)

Follow the official `pptx` skill's QA workflow for content and visual checks:

**Content check:**
```bash
python -m markitdown output.pptx
```

**Visual check (use subagents):**
```bash
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
```

Inspect each slide image. Then run the **20-rule Design Critic from the `design-principles` skill** (`references/critic-checklist.md`), applying the Slide (16:9) row of `format-overrides.md` (1920×1080 canvas, 96 px safe-zone, body ≥24 px, headline ≥48 px, mode = presenter unless brief specifies document).

Brand-specific overrides for decks (apply on top of the universal floor):

- Navy or DarkNavy backgrounds only — no white slides.
- Montserrat headlines + Inter body. Optional Playfair Display for accent only.
- Edge bar on every slide except CTA (gold top stripe).
- Section label at consistent x:0.50", y:0.45".
- Layout variety — never repeat the same layout type on consecutive slides.
- Mode lock — if the brief is presenter, reject any slide with >25 words; if document, reject any slide with no headline. No mixing within one deck (Rule 20).

Fail report format (one block per failed rule):

```
Fail Rule <N> — <name>
Threshold: <numeric threshold>
Measured: <actual value detected>
Fix: <specific change in the PptxGenJS script — sizes, paddings, layout swap>
```

- **All pass:** Deliver the .pptx with a one-line confidence note ("20/20 + brand overrides + mode lock").
- **Any fail:** Fix the specific issue in the PptxGenJS script per the `Fix` line, regenerate, and re-run QA. Up to 2 retries.
- **After 2 failed retries:** Deliver with Critic notes for the user to decide.

Assume there are problems. Fix and re-verify until clean.

---

## Rules

1. **No white slides.** Every background is Navy or DarkNavy.
2. **No generic fonts.** Always Montserrat + Inter. Never Arial, Calibri, or system defaults.
3. **No em dashes.** Use periods or commas instead (per brand-voice.md).
4. **Edge bar on every slide** except CTA (which uses a gold top stripe).
5. **Section label on every slide** at the same position (x:0.50", y:0.45").
6. **Vary layouts.** Never repeat the same layout type on consecutive slides. Alternate between card-based and row-based layouts.
7. **Reuse option objects carefully.** PptxGenJS mutates options. Always create fresh objects per call (use factory functions, not shared references).
8. **No accent lines under titles.** The official pptx skill flags these as AI hallmarks. Use the gold rule only where the template uses it (title slide).
