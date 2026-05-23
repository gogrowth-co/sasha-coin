# carousel-generator

Deterministic LinkedIn carousel pipeline. Claude writes slide content as JSON. Playwright renders HTML/CSS slides at exact pixel dimensions. img2pdf merges PNGs losslessly to a single PDF. No image generation models. No model drift.

**Trigger:** "generate a carousel", "create a LinkedIn carousel", "build carousel slides", "carousel PDF"

---

## Why This Skill Exists

Image generation models (including nanobanana) drift across multi-slide sets and treat typography prompts as literal content. This skill replaces image generation with a deterministic code pipeline: the text Claude writes is the text that prints on the slide.

---

## Visual References (load before composing slides)

Before writing the slide JSON, scan the curated reference library at:

```
_templates/social-creatives/carousel-references/README.md
```

It catalogs ~10 real top-tier carousel projects (Behance case studies) with **take / leave** notes per reference, sorted by category (cover, stat, process, closer, sequence). Pick 1-2 references per slide type before composing. The vision board HTML at `_templates/social-creatives/carousel-references/` (open the README for the index) tells you what's there.

The reference library is refreshed quarterly. If it's stale, run the refresh script documented at the bottom of the README.

---

## Prerequisites

Run once before first use:

```bash
# Install Playwright
npm install playwright
npx playwright install chromium

# Install img2pdf
brew install img2pdf
# or: pip install img2pdf
```

Verify:

```bash
node -e "require('playwright')" && echo "Playwright OK"
img2pdf --version && echo "img2pdf OK"
```

---

## File Locations

| File | Path |
|---|---|
| Generator script | `.claude/skills/carousel-generator/generate.mjs` |
| Content JSON (per carousel) | `social/linkedin/carousels/[slug]-YYYY-MM-DD.json` |
| Output PNGs + PDF | `social/linkedin/carousels/[slug]-YYYY-MM-DD/` |

---

## Step 1: Write Content JSON

Claude writes a JSON array. Each object is one slide. Fields:

| Field | Type | Description |
|---|---|---|
| `layout` | string | Preset: `cover` \| `stat` \| `quote` \| `process` \| `author-cta` \| (default) |
| `eyebrow` | string | ALL CAPS label in Aqua. Short (3-5 words). |
| `heading` | string | Main headline. Montserrat Bold. Keep under 12 words. |
| `stat` | string | Large gold numeral / percentage (152px). |
| `statLabel` | string | Aqua uppercase label below the stat. |
| `body` | string | Body text. Max 40 words per slide. |
| `accentBar` | boolean | Show 56px aqua bar above heading. |
| `bgImage` | string | URL or local path. Full-bleed background, dark navy overlay applied. **Only use clean photos or pure-decorative AI imagery — never AI-generated images that contain text.** |
| `bgGradient` | string | CSS gradient string (alternative to bgImage). |
| `image` | string | URL or local path. Right-side hero image (40% width split layout). Use for headshots, article heroes, real screenshots. |
| `icon` | string | URL or local path. 96x96 corner icon (top-right). Use for protocol logos (`simple-icons`), Heroicons, Lucide, Phosphor. |
| `processNodes` | array | For `layout: process` — `[{n: '01', label: 'Audit current crawl'}]` |
| `customHTML` | string | Raw HTML injected before the footer. |
| `customCSS` | string | Additional CSS injected into the `<style>` block. |

**Image safety rule:** AI-generated images go in `bgImage` only when the image contains no text. The slide's typography is rendered by HTML over the top. If you generate decorative imagery via nanobanana for a background, prompt for abstract shapes, gradients, blurred orbs, geometric patterns — never anything that asks the model to render letters, words, eyebrow zones, quote marks, or labels.

**Slide count:** 8-12 slides. First slide is always the hook (heading only, large, no body text). Last slide is always the CTA (with URL to mangabeira.net/publications/...).

**Example content JSON:**

```json
[
  {
    "eyebrow": "WEB3 SEO",
    "heading": "Most Web3 protocols are invisible to Google.",
    "accentBar": true
  },
  {
    "eyebrow": "THE DATA",
    "stat": "78%",
    "body": "of DeFi protocols have no organic search strategy. They rely on token price to drive awareness."
  },
  {
    "eyebrow": "WHY THIS MATTERS",
    "heading": "PMF without distribution is a slow death.",
    "body": "Protocols that hit product-market fit still stall. Not from competition. From distribution debt that compounds every quarter."
  },
  {
    "eyebrow": "READ MORE",
    "heading": "The Definitive Guide to Web3 SEO",
    "body": "mangabeira.net/publications/definitive-guide-web3-seo",
    "accentBar": true
  }
]
```

---

## Step 2: Run the Generator

```bash
node .claude/skills/carousel-generator/generate.mjs \
  --content social/linkedin/carousels/web3-seo-2026-04-27.json \
  --out social/linkedin/carousels/web3-seo-2026-04-27/
```

The script:
1. Reads the JSON file
2. Builds an HTML file for each slide (brand colors, Montserrat + Inter from Google Fonts)
3. Opens each HTML file in headless Chromium at 1080x1350px
4. Waits for fonts to load (`networkidle`)
5. Screenshots each slide as a PNG
6. Merges all PNGs to a single PDF via img2pdf
7. Outputs `carousel.pdf` in the specified `--out` directory

**Output:**

```
social/linkedin/carousels/web3-seo-2026-04-27/
  slide-01.html
  slide-01.png
  slide-02.html
  slide-02.png
  ...
  carousel.pdf    ← Upload this to LinkedIn
```

---

## Step 3: Upload to LinkedIn

1. Open `carousel.pdf` in Preview. Verify text is correct on every slide.
2. Go to linkedin.com, click "Start a post", click the document icon.
3. Upload `carousel.pdf`. LinkedIn renders each PDF page as a swipeable slide.
4. Add the post copy (written separately using `linkedin-post-writer` skill).
5. Do not add hashtags. See brand-voice.md.

---

## Format Options

The script defaults to 1080x1350 (4:5 portrait). To generate 1080x1080 (square):

```bash
SLIDE_H=1080 node .claude/skills/carousel-generator/generate.mjs ...
```

Or edit `SLIDE_H` at the top of `generate.mjs`.

**LinkedIn rule:** Use one format per carousel. Do not mix portrait and square slides in one PDF. LinkedIn applies the first slide's aspect ratio to the entire deck.

---

## Slide Type Reference

| Slide Type | Required Fields | Notes |
|---|---|---|
| Hook / Cover | `eyebrow`, `heading`, `accentBar: true` | Slide 1. No body text. Large heading only. |
| Data / Stat | `eyebrow`, `stat`, `body` | Gold stat, supporting body text. |
| Point / Insight | `eyebrow`, `heading`, `body` | One idea. Max 40 words in body. |
| Comparison | `eyebrow`, `heading`, `customHTML` | Use `customHTML` to inject a 2-column table. |
| CTA / Close | `eyebrow`, `heading`, `body` | Last slide. body = URL or call to action. |

---

## PDF Size Check

After generation:

```bash
du -sh social/linkedin/carousels/[slug]-YYYY-MM-DD/carousel.pdf
```

Target: under 3 MB for a 10-slide 1080x1350 carousel. If over 5 MB, run ghostscript compression:

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=carousel-compressed.pdf carousel.pdf
```

---

## Fallback: @slashgear/linkedin-carousel-gen

If Playwright/Chromium is unavailable (no browser on the system):

```bash
git clone https://github.com/Slashgear/linkedin-carousel-gen
cd linkedin-carousel-gen
bun install
# Edit src/render.ts: height: 1080 → height: 1350 for portrait
bun run generate
```

This uses Satori (JSX to SVG) + resvg (SVG to PNG) + pdf-lib (PNG to PDF). No browser required. Last commit February 22, 2026. See research brief for details.

---

## Quality Check Before Upload

- [ ] Every slide text matches the JSON content exactly. No auto-generated text.
- [ ] Fonts render as Montserrat (headings) and Inter (body). Not system fallback.
- [ ] All slides are 1080x1350. Check image dimensions: `file slide-01.png` should show 1080x1350.
- [ ] PDF under 3 MB.
- [ ] CTA slide links to a live URL on mangabeira.net.
- [ ] No em dashes anywhere in the slide copy.

---

## Research Reference

Full tooling analysis at `research/carousel-generator-tooling-2026-04-27.md`.
