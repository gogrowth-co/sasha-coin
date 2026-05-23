---
name: social-graphics
description: "Design and generate branded social media graphics using the nanobanana MCP server. Supports 8 LinkedIn image formats (4 face-led, 4 infographic), carousel sequences, and single-post visuals. Use when the user asks to create social images, carousels, infographics, or visual content for social media. Triggers: 'create a carousel', 'social graphic', 'LinkedIn carousel', 'infographic', 'social visual', 'Instagram slides', 'make a graphic for', 'text card', 'step grid', 'mind map', 'before after', 'sketchnote'."
---

# Social Graphics Skill

Generate branded social media graphics and carousels using the `nanobanana` MCP image generation tools.

**This skill does not define the visual system.** The visual system is already documented in:
- `_templates/social-creatives/linkedin-image-style-guide.md` (8 formats, prompt structures, specs)
- `_context/style-guide.md` (colors, typography, component patterns — human prose)
- `_context/brand-style.md` (machine-readable brand DNA — modular ratio, 60-30-10 roles, accent, default mode)
- **Skill: `design-principles`** (universal floor — 20 codified rules with numeric thresholds; format relaxations in `format-overrides.md`)
- `_templates/social-creatives/` (reference images and the photo library)

This skill defines the **workflow** for calling nanobanana and the **technical integration** details (tool parameters, prompt sizing, file naming, QA). Variety comes from `social-taste`. Quality floor comes from `design-principles`.

---

## Principles Injection (mandatory)

Every nanobanana prompt this skill emits MUST inject four hard constraints derived from `design-principles` + the project's `brand-style.md`. Append these to `system_instruction` after the brand voice line, before the negative prompt:

1. **Type discipline.** "Use modular type scale ratio `<ratio from brand-style.md>` (default 1.333). Maximum 4 distinct text sizes on this canvas."
2. **60-30-10 color split.** "Background `<dominant hex>` ~60% area. Secondary `<secondary hex>` ~30%. Single accent moment in `<accent hex>` covering 5-15% of pixel area. No second accent."
3. **8pt grid + safe-zone.** "All proportions snap to 8/16/24/32/48/64/96. Maintain edge safe-zone per format-overrides table (54 px on 1080x1080, 60 px on 1200x630)."
4. **Whitespace + chunks.** "Whitespace ratio ≥40% on info canvases, ≥60% on hero/quote. Maximum 5 distinct visual chunks after grouping."

These translate cleanly to nanobanana's natural-language prompts. The model honors them when they appear in `system_instruction`, not in the user prompt.

For carousel slides specifically: slide 1 must hit hero mode (≤15 words, ≥60% whitespace) and stand alone; slides 2+ run data-dense (≤50 words, ≥40% whitespace). Maintain identical type system across all slides — this is Rule 7 (≤6 sizes per deck) plus CRAP Repetition.

---

## Before You Start

1. **Read the visual system.** Load `_templates/social-creatives/linkedin-image-style-guide.md`. This file defines all 8 formats with exact visual specs and prompt structures. Do not generate images without reading it first.
2. **Read brand context.** Load `_context/style-guide.md` for color hex codes and typography rules.
3. **Pick the right format.** Use the Image-to-Post Matching Table from the style guide:

| Post type | Best format(s) |
|---|---|
| Contrarian take / short claim | Format 1: Text Card |
| Personal story / "things I learned" | Format 2: Face + Post UI Overlay |
| Framework reveal / how-to | Format 3: Face + Bold Text |
| Resource launch / playbook | Format 4: Face + Document Spread |
| Multi-step system or process | Format 5: Step Grid |
| Before/after transformation | Format 6: Before vs After Split |
| Narrative concept / flow explanation | Format 7: Sketchnote Flow |
| Ecosystem / taxonomy / full map | Format 8: Mind Map |

### When Called with a Visual Brief

When the designer agent passes a locked Visual Brief, **do not re-select the format or improvise the art direction.** The brief already specifies:
- Format and dimensions
- Composition and focal point
- Color emphasis and typography hierarchy
- Visual tone and anti-slop directives

Your job is to translate the brief into a nanobanana prompt and generate the final, publication-ready image. Follow the brief exactly.

Build the nanobanana prompt by mapping brief fields to prompt elements:
- **Composition** -> spatial layout descriptions in the prompt ("positioned center-left", "headline upper-third")
- **Color Emphasis** -> explicit hex color instructions ("dominant navy (#0A2540) background, gold (#FFB800) stat number")
- **Typography Hierarchy** -> text content with relative sizing ("large bold headline reading '...', smaller subtitle reading '...'")
- **Visual Tone** -> adjective anchors at the start of the prompt ("Clean, authoritative, data-forward image:")
- **Anti-Slop Directives** -> add to the negative_prompt alongside the standard negative prompt

When called WITHOUT a brief (e.g., by a content-writer for a quick companion image), use the existing format selection and art direction workflow as before.

---

## The 8 Formats at a Glance

**Formats 1-4 (face-led, reach-focused):**
- Format 1: Text Card. Bold typographic statement on white or navy background. No face.
- Format 2: Face + Post UI Overlay. AI-generated photo of Gabriel + LinkedIn card mockup.
- Format 3: Face + Bold Text (dark bg). Gabriel's photo + large headline on dark background.
- Format 4: Face + Document Spread. Gabriel over a grid of deliverable thumbnails.

**Formats 5-8 (infographic, authority-focused):**
- Format 5: Step Grid. Numbered card matrix (5-9 steps) on light background.
- Format 6: Before vs After Split. Two-column comparison with illustrations.
- Format 7: Sketchnote Flow. Hand-drawn 3-panel narrative (problem, process, outcome).
- Format 8: Mind Map. Hub-and-spoke whiteboard diagram.

Full specs, visual anatomy, and prompt templates for each format are in `_templates/social-creatives/linkedin-image-style-guide.md`.

---

## nanobanana Tool Reference

### `mcp__nanobanana__generate_image`

| Parameter | Value for this brand | Notes |
|-----------|---------------------|-------|
| `prompt` | Built from format templates (see style guide) | Max 8192 chars. Be explicit about colors with hex codes. |
| `system_instruction` | See shortened version below | Max 512 chars. Used for ALL calls in a set. |
| `negative_prompt` | See below | Blocks common AI generation artifacts. |
| `aspect_ratio` | Per platform table below | Must match the format spec. |
| `model_tier` | `"nb2"` for most. `"pro"` for complex infographics. | nb2 is default 4K. Pro for max quality on step grids, mind maps. |
| `resolution` | `"high"` | Default. Use `"4k"` for print-quality infographics. |
| `output_path` | `"social/linkedin/[filename].png"` or `"social/x/[filename].png"` | Route to channel subfolder: `li-` prefixed files to `social/linkedin/`, `x-` prefixed files to `social/x/`. |
| `n` | `1` | Generate one at a time. Review before next. |
| `enable_grounding` | `false` for pure graphics, `true` if the prompt references real-world subjects | Grounding fetches real data. Disable for abstract/typographic images. |

### System Instruction (use on all calls, max 512 chars)

```
Branded social graphic. Dark navy (#0A2540) or white backgrounds. Accents: aqua (#1FB6FF) and gold (#FFB800). White text on dark, navy text on light. Fonts: Montserrat Bold headers, Inter body. No neon, no glow, no gradients on text. Clean, minimal, professional. Cards use #0D3558 on dark backgrounds.
```

### Negative Prompt (use on all calls)

```
neon glow, gradient text, busy backgrounds, clip art, watermarks, stock photography, comic style, cartoon, low contrast, blurry text, light gray background, generic corporate blue, drop shadow on text
```

---

## Platform Specs

| Platform | Type | Aspect Ratio | nanobanana param | Dimensions |
|----------|------|-------------|------------------|------------|
| LinkedIn | Carousel | 4:5 | `"4:5"` | 1080x1350 |
| LinkedIn | Single post | 16:9 | `"16:9"` | 1200x627 |
| LinkedIn | Square post | 1:1 | `"1:1"` | 1200x1200 |
| Instagram | Carousel | 1:1 | `"1:1"` | 1080x1080 |
| Instagram | Portrait | 4:5 | `"4:5"` | 1080x1350 |
| Twitter/X | Single | 16:9 | `"16:9"` | 1200x675 |

---

## Workflow: Single Image

### 1. Select format

Match the post type to the best format using the table above. If unsure, ask the user.

### 2. Build the prompt

Read the specific format section in `_templates/social-creatives/linkedin-image-style-guide.md`. Each format has a **Nano Banana Pro prompt structure** section with a template. Fill in the content-specific parts.

**Prompt construction rules:**
- Always specify colors by hex code: "dark navy (#0A2540)" not just "dark navy"
- Describe text content literally: 'text reading "Your headline here"'
- Specify what is NOT there: "No images, no icons, no illustrations" for Format 1
- Describe spatial layout: "positioned center-left", "in the top-right corner"
- Keep text on the image short: 30 words max. AI models render short strings more reliably.

### 3. Generate

```
mcp__nanobanana__generate_image(
  prompt: [built from template],
  system_instruction: [the 512-char instruction above],
  negative_prompt: [the negative prompt above],
  aspect_ratio: [from platform table],
  model_tier: "nb2" or "pro",
  resolution: "high",
  output_path: "social/linkedin/[filename].png"  # or "social/x/[filename].png" for X/Twitter
)
```

### 4. Review

Look at the generated image. Check:
- [ ] Brand colors are correct (Navy, Aqua, Gold, no random purples or greens)
- [ ] Text is legible at 1080px wide
- [ ] No invented data or placeholder text in the image
- [ ] No glow, neon, or over-rendered effects
- [ ] Aspect ratio is correct
- [ ] Layout matches the format spec from the style guide

If any check fails, adjust the prompt and regenerate.

### 5. Design Critic Evaluation

After the image passes the basic review checklist above, run the 5-dimension Design Critic. This is defined in the designer agent but summarized here for when the skill runs standalone:

| Dimension | Pass criteria |
|---|---|
| Brand Compliance | Colors match hex palette exactly. Montserrat/Inter fonts. No neon, glow, gradients on text. |
| Readability | Text legible at 1080px display. Clear hierarchy. No competing focal points. Under 30 words. |
| Anti-AI-Slop | No centered-everything layouts, no purple gradients, no uniform rounded corners, no clip-art energy. |
| Composition | Clear focal point. Intentional eye flow. White space serves the design. |
| Brief Alignment | Output matches the locked Visual Brief (if one was provided). |

- **All pass:** Proceed to file naming and delivery.
- **Any fail:** Adjust the prompt based on the specific failure and regenerate. Up to 2 retries.
- **After 2 failed retries:** Deliver with Critic notes for the user to decide.

---

## Workflow: Carousel

### 1. Plan the slide sequence

Break the topic into slides. Every carousel follows this order:

| Position | Slide Type | Format to Use |
|----------|-----------|---------------|
| 1 | Cover (hook headline) | Format 1 (Text Card) or Format 3 (Face + Bold Text) |
| 2 | Context (set the problem) | Format 1 (Text Card, navy bg) |
| 3-7 | Content (one idea per slide) | Format 1, Format 5 elements, or stat callout style |
| 8 (optional) | Summary or framework | Format 5 (Step Grid) or Format 8 (Mind Map) |
| Last | CTA / closing | Format 1 (Text Card) with CTA text |

Write out the full slide plan before generating anything:
```
Slide 1 (Cover): "Why Most DeFi Protocols Stall After PMF"
Slide 2 (Context): "They have traction. They don't have distribution."
Slide 3 (Point): Stat: "73% of protocols..." 
...
Slide 8 (CTA): "Send the brief. mangabeira.net"
```

### 2. Establish visual consistency

For carousels, every slide must share:
- Same background color (Navy or White, pick one for the whole set)
- Same accent bar placement (left edge, same width, same color)
- Same text zone (headlines at the same Y position across slides)
- Same accent color dominance (pick Aqua or Gold as primary, the other as secondary)

### 3. Generate slides sequentially

Generate one slide at a time. Review each before moving to the next. If a slide breaks visual consistency with previous slides, regenerate it.

For each slide, include a consistency anchor in the prompt:
```
...matching the visual style of the previous slides in this carousel set: dark navy background (#0A2540), thin aqua accent bar on the left edge, Montserrat-style bold white headline text, Inter-style gray body text...
```

### 4. Review the full set

After generating all slides, review them as a sequence:
- Visual consistency across the whole set
- Narrative flow from slide 1 to the CTA
- No duplicate ideas across slides
- Text stays under 30 words per slide

### 5. Design Critic Evaluation

Run the 5-dimension Design Critic on the full carousel set:
- Evaluate each slide individually for Brand Compliance, Readability, Anti-AI-Slop, and Composition
- Evaluate the set as a whole for visual consistency (same background, same accent placement, same text zone positioning)
- If a Visual Brief was provided, check Brief Alignment across all slides

Any slide that fails gets regenerated with adjusted prompts. The full set must pass before delivery.

---

## Using Gabriel's Photos

Formats 2, 3, and 4 require Gabriel's face. Photo assets are in `_templates/social-creatives/`:

| File | Best for |
|------|----------|
| `gabriel mangabeira profile.jpg` | Format 2 (Face + UI overlay) |
| `gabriel mangabeira standing.png` | Format 3 (Face + Bold Text), Format 4 (Document Spread) |
| `gabriel pointing right.png` | Format 3, Format 4 |
| `inpiration - working.jpg` | Format 2 (working context) |
| `inspiration - sitting.jpg` | Format 2 (casual context) |

To use a photo as input for image composition or editing:
```
mcp__nanobanana__generate_image(
  prompt: [format template with photo direction],
  input_image_path_1: "_templates/social-creatives/gabriel mangabeira standing.png",
  mode: "edit",
  ...
)
```

For AI-generated photos of Gabriel (Format 2), generate fresh images following the photo direction spec in the style guide: modern workspace, laptop visible, dark casual clothing, engaged expression.

---

## File Naming Convention

Route outputs to channel subfolders. `li-` prefixed files go to `social/linkedin/`, `x-` prefixed files go to `social/x/`. Follow the naming pattern from the style guide:

```
social/linkedin/li-img-[YYYY-MM-DD]-[format]-[slug].png
social/x/x-img-[YYYY-MM-DD]-[format]-[slug].png

Format tags:
  textcard     (Format 1)
  faceui       (Format 2)
  darktext     (Format 3)
  docspread    (Format 4)
  stepgrid     (Format 5)
  beforeafter  (Format 6)
  sketchnote   (Format 7)
  mindmap      (Format 8)
  carousel     (Carousel slides, numbered)
```

Examples:
```
social/linkedin/li-img-2026-04-10-textcard-buybacks-dont-work.png
social/linkedin/li-img-2026-04-10-stepgrid-web3-gtm-7-steps.png
social/linkedin/li-img-2026-04-10-carousel-defi-growth-01.png
social/x/x-img-2026-04-13-beforeafter-token-emissions.png
```

---

## Rules

1. **Read the style guide first.** Always load `_templates/social-creatives/linkedin-image-style-guide.md` before generating. No exceptions.
2. **One idea per slide.** Never pack two arguments onto one image.
3. **30 words max per slide.** Carousel slides are scannable, not readable.
4. **No em dashes in image text.** Use periods or commas.
5. **No banned phrases.** Check `_context/brand-voice.md`.
6. **Review every generated image.** Do not batch-generate and declare success.
7. **Sequential generation for carousels.** One slide at a time, reviewed before the next.
8. **Use real photos for face formats.** Don't generate AI photos when a real one from the library works.
9. **system_instruction is 512 chars max.** Use the shortened version from this skill, not a longer one.
10. **Infographic formats use `"pro"` model.** Step grids (5), before/after (6), sketchnotes (7), and mind maps (8) benefit from the higher reasoning quality of the pro tier.
