---
name: visual-references
description: Use when the designer agent needs visual inspiration before generating concept directions. Triggered when a brief lacks specific visual direction, or when the user asks for vision boards, references, examples, or comparable designs across social media, landing pages, web apps, dashboards, and interactive elements. Saves to a persistent per-project reference library, not /tmp.
---

# Visual References

## Overview

Builds and maintains a per-project visual reference library at `_templates/references/`. On each run: reads existing library, scrapes vertically-aware sources based on the project's aesthetic + industry, captures screenshots, saves them permanently, updates `library.json`, regenerates the HTML viewer, and returns style anchors for nanobanana.

The library grows over time. Every Phase 4 run adds to it — it is never rebuilt from scratch.

## When to Use

Invoke at the start of Phase 1 (before generating concept directions) when:
- Brief has no specific visual direction
- User says "vision board", "references", "show me examples", "inspiration"
- Starting a new campaign, new asset format, or new brand expression
- A new format is being produced for the first time (even if the library already has other formats)

**Skip when:**
- Brief names specific references directly and they are already in the library
- Task is a minor variation of an already-approved visual direction with a saved anchor
- The library already has 6+ references for the exact format requested and the brief is well-defined

---

## Step 1 — Load Project Context

Read the following files from the project root (current working directory):

1. `_context/style-guide.md` — extract: aesthetic category, visual style, color palette, any "brand don'ts"
2. `_context/brand-voice.md` — extract: tone adjectives (e.g. precise, bold, warm)
3. `_context/product-info.md` — extract: industry/vertical (DeFi, SaaS, editorial, etc.), product type
4. `_templates/references/library.json` — load existing references if present

Parse from the above:
- **Vertical** (e.g. `defi`, `saas`, `editorial`, `personal-brand`, `ai-agent`, `ecommerce`)
- **Aesthetic** (e.g. `dark-technical`, `light-minimal`, `bold-high-contrast`, `warm-editorial`, `clinical`)
- **Format** — from the current request (see Format Catalog below)
- **Mood keywords** — tone adjectives + aesthetic category combined

If `_templates/references/library.json` does not exist, create it as an empty library (see schema in Step 5).

---

## Step 2 — Select Sources (Vertical-Aware)

Do NOT use a single fixed source list. Pick 3–4 sources from the table below, matching both vertical and format. Vertical takes priority over generic galleries.

### Source Catalog

| Vertical | Format | Primary Sources | Fallback |
|---|---|---|---|
| **DeFi / Crypto / Web3** | Dashboard / app UI | `screenlane.com`, `ui-sources.com`, `collectui.com/challenges/dashboard` | `mobbin.com` (public pages only) |
| **DeFi / Crypto / Web3** | Landing page | `lapa.ninja` (filter: saas), `land-book.com` (filter: dark or startup) | `saaslandingpage.com` |
| **DeFi / Crypto / Web3** | Social graphic | `dribbble.com/search/defi-ui`, `dribbble.com/search/crypto-dashboard` | `muzli.space` |
| **DeFi / Crypto / Web3** | Ad creative | `dribbble.com/search/fintech-ads`, `behance.net/search/projects/crypto-ads` | pinterest via Apify |
| **Fintech / Analytics / Data** | Dashboard / app UI | `screenlane.com`, `collectui.com/challenges/dashboard`, `ui-sources.com` | `pageflows.com` |
| **Fintech / Analytics / Data** | Landing page | `land-book.com`, `saaslandingpage.com` | `lapa.ninja` |
| **Fintech / Analytics / Data** | Social graphic | `dribbble.com/search/fintech-social`, `muzli.space` | pinterest via Apify |
| **SaaS (general)** | Dashboard / app UI | `screenlane.com`, `collectui.com/challenges/dashboard` | `ui-sources.com` |
| **SaaS (general)** | Landing page | `saaslandingpage.com`, `land-book.com` | `lapa.ninja` |
| **SaaS (general)** | Social graphic | `dribbble.com/search/saas-social-media`, `muzli.space` | pinterest via Apify |
| **Personal brand / Consulting** | Landing page | `godly.website`, `lapa.ninja` | `land-book.com` |
| **Personal brand / Consulting** | Social graphic | `dribbble.com/search/personal-brand-social`, `muzli.space` | pinterest via Apify |
| **Personal brand / Consulting** | Deck / presentation | `behance.net/search/projects/presentation-design`, `dribbble.com/search/pitch-deck` | pinterest via Apify |
| **Editorial / Media / Publisher** | Landing page | `godly.website`, `awwwards.com/websites/` | `siteinspire.com` |
| **Editorial / Media / Publisher** | Social graphic | `muzli.space`, `dribbble.com/search/editorial-social` | pinterest via Apify |
| **Editorial / Media / Publisher** | Email / Newsletter | `reallygoodemails.com`, `goodemailcopy.com` | `milled.com` |
| **AI Agent / Persona** | Social graphic | `dribbble.com/search/ai-social-media`, `muzli.space` | pinterest via Apify |
| **AI Agent / Persona** | Profile / Avatar | `dribbble.com/search/ai-character-design`, `behance.net/search/projects/ai-persona` | pinterest via Apify |
| **Any vertical** | OG image / Blog hero | `dribbble.com/search/og-image`, `land-book.com` | `lapa.ninja` |
| **Any vertical** | Award-level general | `godly.website`, `awwwards.com/websites/` | `siteinspire.com` |

**Append mood keywords to search queries** when using Dribbble or Behance:
- Dark/technical + DeFi → `"dark defi dashboard UI"`
- Minimal + SaaS → `"minimal saas landing page"`
- Bold + editorial → `"bold editorial layout design"`

---

## Step 3 — Scrape Gallery Pages

Use `firecrawl:firecrawl` (scrape mode) on each selected source gallery page.

Instruction to pass Firecrawl:
> "Extract all links to individual design examples or portfolio items on this page. Return as a plain list of URLs. Include only links to individual pages, not navigation, tag pages, or external links."

Target: 15–20 candidate URLs per source. With 3 sources = 45–60 candidates.

**For Pinterest** (mood board context or abstract brief):
```
apify-mcp — actor: apidojo/pinterest-scraper
query: "[mood keywords] [asset type] UI design"
maxItems: 20
```

**Check existing library first:** Before scraping, read `library.json`. Any URL already in the library with the same format can be skipped during filtering — no need to re-screenshot known references.

---

## Step 4 — Filter + Prioritize

From the candidate pool, select 8–10 that best match the brief:
- At least 2 different layout approaches represented
- At least 2 different color treatments represented
- No two references with identical aesthetic
- Exclude login walls, paywalled content, 404s
- Exclude URLs already in `library.json` for this format (already captured)

Target net-new references: 6–8 (accounting for existing library entries that may already cover some slots).

---

## Step 5 — Capture Screenshots

For each selected URL, invoke `screenshot-taker` skill:
- Mode: above-the-fold (default, 1440×900)
- Save to: `_templates/references/screenshots/[format]/ref-[YYYYMMDD]-[n].png`

Where `[format]` is the kebab-case format name (see Format Catalog). Where `[n]` is a zero-padded 3-digit index starting from the next available number in the library (e.g. if library has 4 references for this format, start at 005).

After each capture, confirm it shows real design content (not a login wall, error page, or blank screen). Discard and replace any that fail.

**Credit policy:** Do not use ScrapingBee Tier 2 for reference gathering. If a site consistently 403s ScreenshotOne, skip it and pick an alternative source.

---

## Step 6 — Update library.json

Read the existing `_templates/references/library.json` (or create it if absent). Append one entry per new captured reference. Write the updated file back.

### library.json Schema

```json
{
  "project": "[project name from _context/product-info.md]",
  "lastUpdated": "YYYY-MM-DD",
  "references": [
    {
      "id": "ref-[format]-[YYYYMMDD]-[NNN]",
      "url": "https://...",
      "screenshot": "_templates/references/screenshots/[format]/ref-[YYYYMMDD]-[NNN].png",
      "format": "[format]",
      "vertical_tags": ["defi", "dark", "dashboard"],
      "style_anchors": ["dark background", "data-dense grid", "monospace accent"],
      "patterns_avoid": [],
      "notes": "",
      "date_added": "YYYY-MM-DD",
      "source": "[gallery site domain]",
      "session_slug": "[brief-slug this was captured for]"
    }
  ]
}
```

`format` must be one of the values in the Format Catalog below. `style_anchors` are extracted during synthesis (Step 8) — leave as empty array when first writing the entry, then update after synthesis.

---

## Step 7 — Regenerate HTML Viewer

After updating `library.json`, regenerate `_templates/references/index.html` from scratch using all entries in the library (not just the new ones). This is the persistent visual browser for the project.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Reference Library — [Project Name]</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #08111f; font-family: Inter, -apple-system, sans-serif; padding: 32px; color: #fff; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { color: rgba(255,255,255,0.35); font-size: 12px; margin-bottom: 24px; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 28px; }
  .filter-btn {
    padding: 5px 14px; border-radius: 20px; border: 1px solid rgba(31,182,255,0.25);
    background: transparent; color: rgba(255,255,255,0.5); font-size: 12px; cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }
  .filter-btn:hover, .filter-btn.active {
    background: #1FB6FF; border-color: #1FB6FF; color: #000; font-weight: 600;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .card {
    background: #0d1f35; border-radius: 10px; overflow: hidden;
    border: 1px solid rgba(31,182,255,0.08); transition: border-color 0.15s;
  }
  .card:hover { border-color: rgba(31,182,255,0.3); }
  .card img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; }
  .card-meta { padding: 10px 12px; }
  .format-tag { font-size: 10px; color: #1FB6FF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  .source-name { font-size: 12px; color: rgba(255,255,255,0.7); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .source-url { font-size: 10px; color: rgba(255,255,255,0.2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
  .tag { font-size: 9px; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.35); }
  .card[style*="display: none"] { display: none !important; }
</style>
</head>
<body>
  <h1>Reference Library — [Project Name]</h1>
  <p class="subtitle">[N] references · Last updated [date]</p>

  <div class="filters">
    <button class="filter-btn active" onclick="filter('all')">All</button>
    <!-- One button per unique format in the library -->
    <!-- e.g. <button class="filter-btn" onclick="filter('landing-page')">Landing Page</button> -->
    [FILTER_BUTTONS]
  </div>

  <div class="grid" id="grid">
    <!-- One .card block per reference in library.json, sorted by date_added desc -->
    [REFERENCE_CARDS]
  </div>

<script>
function filter(format) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.card').forEach(card => {
    card.style.display = (format === 'all' || card.dataset.format === format) ? '' : 'none';
  });
}
</script>
</body>
</html>
```

Replace `[FILTER_BUTTONS]` with one button per unique `format` value in the library. Replace `[REFERENCE_CARDS]` with one `.card` block per reference, adding `data-format="[format]"` to each card div.

Save to: `_templates/references/index.html`

---

## Step 8 — Synthesize Aesthetic Patterns

After capturing new references, review the screenshots from this session and extract recurring patterns:

| Dimension | Extract |
|---|---|
| **Color treatment** | Background palette, accent color role, light vs. dark dominant |
| **Layout approach** | Hero structure, grid density, white space ratio |
| **Typography style** | Display weight/size, body contrast, expressive choices |
| **Compositional device** | Focal point strategy, diagonal use, visual flow |
| **What to avoid** | Patterns from weaker references |

Update `style_anchors` and `patterns_avoid` on each new entry in `library.json`.

Then produce 2–3 style anchor strings for nanobanana:

```
Anchor A: "Inspired by [observed layout + color treatment]. [Typography note]. Avoid [anti-pattern]."
Anchor B: "Draws from [second aesthetic direction]. [Compositional device]. Avoid [anti-pattern]."
Anchor C (hybrid): "Merges [A's color treatment] with [B's layout]. [What makes it distinctive]."
```

---

## Format Catalog

Use exactly these values in `format` fields:

| Value | Description |
|---|---|
| `social-post` | LinkedIn single image (1200×627), X post image (1600×900) |
| `carousel` | LinkedIn carousel slide (1080×1080), presentation slide (16:9) |
| `landing-page` | Full marketing landing page above-fold |
| `dashboard` | Web app / data dashboard / analytics UI |
| `deck` | Pitch deck, strategy deck, presentation |
| `video-thumbnail` | Short-form video overlay, YouTube/X thumbnail (1920×1080 or 1080×1920) |
| `ad-creative` | Paid social ad (platform-specific) |
| `email-header` | Newsletter header, email hero (600px wide) |
| `og-image` | Open Graph / blog hero image (1200×630) |
| `profile-asset` | Avatar, banner, profile visual |

---

## Output Format

Return this block to the designer agent after completing the workflow:

```
VISUAL REFERENCES COMPLETE
library: _templates/references/index.html
library_json: _templates/references/library.json
new_references_added: N
total_library_size: N (across all formats)
format: [format this run targeted]
sources_used: [list]
top_references: [3 strongest URLs from this session]

style_anchors:
  A: "[anchor string]"
  A_principles: "[which design-principles rules this exemplifies, e.g., 'Rule 4 (60% whitespace), Rule 13 (single accent), Rule 19 (F-pattern)']"
  B: "[anchor string]"
  B_principles: "[same — different rule emphasis]"
  C: "[hybrid anchor string]"
  C_principles: "[merged emphasis]"

patterns:
  color: [observed]
  layout: [observed]
  typography: [observed]
  composition: [observed]
  avoid: [observed — must include any reference URLs filtered by the anti-pattern filter below]

anti_pattern_filter:
  excluded_count: N
  excluded_urls: [list of URLs filtered before producing anchors]
  reasons: [one-line per URL — e.g., "low contrast hero <3:1", ">7 chunks above the fold", "centered-everything symmetric layout"]
```

### Anti-Pattern Filter (run before assembling anchors)

For every candidate reference URL gathered this session, evaluate against the design-principles **anti-AI-slop floor** + **CRAP** quick check (`design-principles/references/critic-checklist.md`). Exclude any reference that grossly violates the floor:

- Low contrast text on imagery (<3:1 sampled at hero region)
- More than 7 distinct visual chunks above the fold
- Centered-everything symmetric layouts (unless a section divider)
- Drop shadows or neon glow on text
- Default purple/blue gradient hero backgrounds

Filtering keeps the reference library calibrated to the principles. Style anchors should only emerge from references that already pass the floor.

---

## Integration with Designer Phase 1

The designer agent uses this output as follows:
- **Visual Brief A** anchors to `style_anchor.A`
- **Visual Brief B** anchors to `style_anchor.B`
- **Visual Brief C** anchors to `style_anchor.C` (hybrid)
- The `Anti-Slop Directives` field inherits from `patterns.avoid`
- When generating concept visuals, append the brief's style anchor to the nanobanana `system_instruction`
- Present `_templates/references/index.html` (filtered to the current format) to the user alongside the 3 concept options

---

## Source-Specific Notes

- **Dribbble**: loads heavy JS — use `delay=2` in screenshot-taker
- **Godly.website**: best single source for award-level web design. Start here for landing pages, editorial, and personal brand
- **Screenlane**: best for web app UI, forms, onboarding, dashboards. Start here for anything data-heavy
- **Mobbin**: most pages require login — screenshot public browse/explore page only, or use Firecrawl to extract publicly visible card links
- **Pinterest**: needs Apify scraper for useful results. Direct ScreenshotOne shows mostly a sign-in prompt
- **Awwwards**: bot-protected — use Firecrawl (not ScreenshotOne) to extract URLs from listing pages, then screenshot individual sites
- **Really Good Emails**: use for email-header format only. Firecrawl extracts clean links

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Saving to /tmp | Always save to `_templates/references/screenshots/[format]/`. /tmp is ephemeral and defeats the purpose of the library |
| Using generic gallery sources for a DeFi or fintech project | Match sources to vertical first. Dribbble generics return irrelevant results |
| Rebuilding all references on every run | Read library.json first. Only add new entries — never delete existing ones |
| Skipping the HTML viewer regeneration | Regenerate index.html after every run so the library stays browsable |
| Selecting visually similar references | Enforce: at least 2 different layout approaches and 2 different color treatments in each session |
| Burning Tier 2 credits on reference gathering | Tier 2 is for content embeds only. Skip 403 sites and pick alternates |
| Not verifying screenshots | Read every capture after download. A successful exit code does not mean you got a real screenshot |
| Anchoring all 3 briefs to the same style | Each brief must pull from a different anchor — A, B, C are genuinely different directions |
