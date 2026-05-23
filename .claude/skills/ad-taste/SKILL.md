# ad-taste

Generates scroll-stopping paid social ad creatives for B2B consulting offers. Stops AI from producing text-heavy, slop-looking, over-designed ads. Visual-first. Combinatorial engine forces variety.

---

## When to use

Use this skill whenever producing ad creatives for any paid campaign. Replace `ad-creative` + nanobanana free-form prompting entirely. This skill IS the prompting strategy.

---

## Configuration

```
VISUAL_AMBITION: 9       // how bold and unexpected the creative is (1=safe, 10=stops scroll)
COPY_WEIGHT: 2           // how much text appears in the image (1=almost none, 10=text-heavy)
HUMAN_PRESENCE: 8        // whether a real face anchors the creative (1=none, 10=face-dominant)
```

Default values above. Adjust per campaign phase:
- Cold audience: HUMAN_PRESENCE 9, COPY_WEIGHT 2
- Warm retargeting: COPY_WEIGHT 4, HUMAN_PRESENCE 5
- Conference: HUMAN_PRESENCE 9, VISUAL_AMBITION 10

---

## The Combinatorial Engine

Before generating any image, run the engine. Pick **exactly one** option from each dimension. Do not mix freely. The combination becomes the creative direction.

### Dimension 1 — Visual Anchor (what stops the scroll)

| Option | Description |
|---|---|
| **A. Face-dominant** | A real human face fills 40-60% of the canvas. Eye contact. Emotion. Expression matches the hook. |
| **B. Number-punch** | One statistic — "0%", "$0", "6" — rendered at massive scale. The number IS the creative. |
| **C. Before/After split** | Canvas divided. Left side shows the broken state. Right shows the fixed state. No words needed to understand the gap. |
| **D. Metaphor image** | A striking visual concept — a blindfolded pilot, a dashboard with no gauges, a receipt with all zeros. Real photography or sharp illustration. |
| **E. Screenshot proof** | Looks like a real tool output — Dune query result, GA4 screenshot, audit readout. The ICP recognizes the interface and stops. |

### Dimension 2 — Background Treatment

| Option | Description |
|---|---|
| **1. High-contrast solid** | One strong color fills the background. No gradient. No texture. The subject pops violently. |
| **2. Clean white/off-white** | Pure content, zero noise. Makes the subject feel naked and credible. |
| **3. Dark dramatic** | Near-black background. Subject lit from front. Cinematic feel. NOT navy with glows. |
| **4. Platform-native** | Looks like the UI of the platform it runs on (white card with gray borders = LinkedIn, dark gray = Reddit). |

### Dimension 3 — Typography Weight

| Option | Description |
|---|---|
| **I. Zero copy** | No words except the URL at the bottom. The visual says everything. |
| **II. One word or number** | "0%". "Blind." "6." One word, massive scale, 80% of height. |
| **III. One bold line** | 4-7 words. No more. Set at scale where it reads in 0.3 seconds. |
| **IV. Hook + proof** | Short headline + one supporting data point. Max 12 words total. |

### Dimension 4 — Composition

| Option | Description |
|---|---|
| **α. Asymmetric split** | Subject takes 55-65% of canvas, copy takes the rest. Off-center. Tension. |
| **β. Full bleed** | Subject fills 100% of canvas. Text overlaid with high contrast. |
| **γ. Center punch** | One element (face, number, word) centered with extreme negative space around it. Silence = impact. |
| **δ. Diagonal tension** | Visual elements on a diagonal axis. Energy. Not static. |

---

## Step 1 — Read the Brief

Before selecting dimensions, load:
- `_context/product-info.md` — current offer, price points, proof points
- Campaign brief if one exists — ICP, platform, campaign phase
- Any Gabriel photos requested for face-dominant options

---

## Step 2 — Select the Combination

For each of 3 concept directions, pick a different combination. No two directions can share the same Dimension 1 option. Visual diversity is the rule.

Document the selection:

```
Direction 1: [A/B/C/D/E] + [1/2/3/4] + [I/II/III/IV] + [α/β/γ/δ]
Direction 2: [A/B/C/D/E] + [1/2/3/4] + [I/II/III/IV] + [α/β/γ/δ]
Direction 3: [A/B/C/D/E] + [1/2/3/4] + [I/II/III/IV] + [α/β/γ/δ]
```

---

## Step 3 — Write the nanobanana Prompt

Use this formula for each direction. Every prompt must:
- Describe the **visual first** (what you see before you read anything)
- Specify **exact text** to appear (max 12 words total on the image)
- Specify **exact dimensions**: 1200×627 landscape for LinkedIn/X, 1200×1200 square for Instagram
- Name the **background color or treatment** explicitly
- Name the **typography style** (weight, size relative to canvas, color)
- Specify the **human element** if face-dominant (which photo, expression, crop)
- Include the **CTA** as the smallest element (URL only, bottom edge)

### Prompt Template

```
[FORMAT]: 16:9 landscape, 1200x627px equivalent
[VISUAL ANCHOR]: [describe exactly what fills the frame]
[BACKGROUND]: [exact color or treatment, no gradients unless specified]
[TEXT ON IMAGE]: [exact words, size, placement, color — 12 words max]
[HUMAN]: [if face-dominant: describe the photo, crop, expression, position]
[MOOD]: [2-3 adjectives — e.g. "raw, confrontational, credible"]
[URL]: mangabeira.net in small text, bottom right or bottom center
```

---

## Step 4 — Generate via nanobanana

For face-dominant directions:
- Pass Gabriel's photo via `input_image_path_1`
- Use `model_tier: "pro"`, `resolution: "2k"`

For non-face directions:
- Pure generation — no input image
- Use `model_tier: "nb2"` for speed, `"pro"` if the concept requires precision

Output path: `/tmp/ad-taste-[direction]-[date].png`

---

## Step 5 — Review and Save

Read each generated image immediately. Check:
- Is the visual anchor actually dominant (>40% of canvas)?
- Is the copy legible at 400px preview width?
- Does it look like an ad or does it look like content?
- Would you stop scrolling if you saw this?

If any check fails — regenerate with tighter constraints before showing Gabriel.

Save approved creatives to:
`ads/active/[campaign-slug]/creatives/`

---

## Anti-Slop Rules — B2B Consulting Ads

These patterns are BANNED. If your output contains any of these, regenerate:

| Pattern | Why it fails |
|---|---|
| Dark navy background with glowing accent | Screams "AI made this crypto ad" |
| Text taking >40% of canvas | Not an ad, it's a document |
| More than 3 visual elements competing for attention | No hierarchy = no focus |
| Generic stock-photo-looking scene | Zero credibility signal |
| Gradient headline text | 2019 SaaS look |
| Centered layout with equal padding all sides | Boring, invisible in feed |
| "Growth", "Scale", "Transform" in the copy | Banned words |
| Brand colors used for background | Looks branded, not native |
| Bullet points or numbered lists IN the image | That's a slide, not an ad |
| Copy that could apply to any business | Zero specificity = zero trust |

---

## Ad Formats Reference

| Platform | Dimensions | Aspect Ratio | Notes |
|---|---|---|---|
| LinkedIn Sponsored | 1200×627 | 16:9 | Primary format. Face-dominant performs best. |
| LinkedIn Square | 1200×1200 | 1:1 | Better for mobile feed. |
| X/Twitter | 1600×900 | 16:9 | Slightly wider crop needed. |
| Reddit | 1200×628 | ~16:9 | Meme and data formats perform here. |

---

## Proven Combinations for Web3 Growth Audit

Based on what's worked for B2B consulting in DeFi:

| Direction | Why it converts |
|---|---|
| **A+1+II+β** (Face + bold color BG + one word + full bleed) | Face = human trust. Bold color = scroll stop. One word = instant curiosity. Full bleed = no ad feel. |
| **B+2+II+γ** (Big number + white + one word + centered) | "0%" in massive type on white canvas. ICP reads it and feels the punch. No explanation needed. |
| **C+4+III+α** (Before/after + platform-native + one line + split) | Looks like content someone shared. The ICP recognizes both sides of the split from their own reality. |
| **D+3+III+β** (Metaphor + dark + one line + full bleed) | Cinematic concept image with one brutal line. "You're flying blind." No pitch, just mirror. |

---

## Integration

- **Owner:** `paid-media-agent`
- **Triggers:** Any ad creative generation task for Gabriel's brand
- **Pairs with:** `ad-creative` (copy strategy), `ad-variation-engine` (batch variations after hero approved)
- **Does NOT replace:** `social-graphics` (for organic social images, not ads)

---

## Anti-Slop Floor (inherited)

This skill provides **variety** through its combinatorial dimensions. The **quality floor** comes from the `design-principles` skill (`references/critic-checklist.md` + `references/format-overrides.md`).

When generating prompts or selecting directions:

- Inherit the universal anti-AI-slop list from `critic-checklist.md` (centered-everything symmetric layouts, purple/blue gradients as default, uniform rounded corners on every element, drop shadow on text, neon glow on text, six-bullet hero, em dashes anywhere on the artifact). These are non-negotiable across all formats.
- Apply the format-specific row from `format-overrides.md` for safe-zone, body min, headline min, word budget, and default mode.
- This skill keeps any **skill-specific** anti-patterns that the universal floor does not cover (e.g., thumbnails ban neutral expressions; landing pages ban 3-column logo carousels; ads enforce single-accent for conversion). These remain in this file and stack on top of the universal floor.

The combinatorial dimensions in this skill produce *variety above a quality floor*. They are not a license to drop below it.
