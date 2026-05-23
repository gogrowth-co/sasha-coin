# landing-taste

Visual direction layer for mangabeira.net landing pages. Prevents generic SaaS layout defaults before frontend-design or the designer agent touches HTML. Combinatorial engine selects the page's visual language before a single line of code is written.

---

## When to use

Use this skill before any landing page production task:
- New service pages (`/services/web3-growth-audit`, etc.)
- Campaign-specific landing pages
- Sample/proof pages (`/samples/web3-growth-audit`)
- Any page produced via SOP-13 (landing page ops)

Load this skill at Phase 1 of SOP-13 — before the copy outline, not after. Visual direction shapes copy hierarchy.

---

## Configuration

```
DESIGN_VARIANCE: 8       // layout experimentation (high = asymmetric, unexpected)
MOTION_INTENSITY: 4      // subtle — no scroll-jacking or heavy animations
VISUAL_DENSITY: 5        // balanced — data-rich sections alternate with breathing room
BRAND_STRICTNESS: 7      // Navy/Aqua/Gold system applies, but not on every section
```

---

## Combinatorial Engine

Run before briefing the designer agent or writing HTML. Select one per dimension.

### Dimension 1 — Hero Architecture

| Option | Description |
|---|---|
| **A. Asymmetric split** | Copy left, visual right. Off-center. Tension from the first pixel. |
| **B. Headline-dominant** | Huge typographic statement above the fold. No hero image. Whitespace does the work. |
| **C. Proof-first** | Lead with a client result, audit output, or data visualization. Then explain the offer. |
| **D. Face + authority** | Gabriel's photo large, left-anchored. Headline right. Trust signal before the pitch. |
| **E. Cinematic full-bleed** | One powerful image fills the hero. Minimal text overlay. Scroll for the pitch. |

### Dimension 2 — Section Rhythm

| Option | Description |
|---|---|
| **1. Alternating density** | Dense data sections alternate with spacious narrative sections. Breathing rhythm. |
| **2. Progressive reveal** | Sections build on each other. Each one raises a question the next answers. |
| **3. Bento grid** | Information dense. Multiple data points per section in card clusters. Analytics brand feel. |
| **4. Long editorial** | Single-column, long-form. Reads like a report. Credibility through depth. |

### Dimension 3 — Visual Proof Treatment

| Option | Description |
|---|---|
| **I. Miro board embed** | Real client audit boards shown as visual proof. Screenshots with callouts. |
| **II. Data visualization** | Dune queries, GA4 gaps, attribution maps rendered as in-page charts. |
| **III. Before/After comparison** | Scrollable split. ICP sees their problem on left, the fix on right. |
| **IV. Process diagram** | The 6-pillar audit framework visualized as a flowchart or matrix. |

### Dimension 4 — CTA Treatment

| Option | Description |
|---|---|
| **α. Sticky persistent** | CTA bar stays in view as user scrolls. Always one click away. |
| **β. Section-based** | CTA appears after each proof section. Multiple entry points. |
| **γ. Single terminal** | One CTA at the bottom of the page. Earned through content. |
| **δ. Inline anchored** | CTA lives inside the pricing section only. No floating buttons. |

---

## Anti-Slop Rules — Landing Pages

BANNED. Regenerate if present:

| Pattern | Why it fails |
|---|---|
| Centered hero with equal padding, headline + subline + button | Generic SaaS default. Every Lovable/Webflow template looks like this. |
| 3-column "how it works" cards with icons | Every consulting site. Zero differentiation. |
| Testimonial carousel with star ratings | Stock testimonial feel. Use named quotes with protocol names. |
| Navy gradient + glowing Aqua accent on hero | Crypto-bro 2022 look. Screams AI-generated. |
| "Trusted by X clients" logo strip of tiny logos | Only works if the logos are recognizable. DeFi protocols are not Salesforce. |
| Generic stock imagery | Zero credibility for a consultant brand. Real screenshots or no images. |
| Inter font for headlines | Use Montserrat (brand font). Inter is the default — avoid defaults. |
| Every section on navy background | Monotone pages kill scroll. Alternate light/dark. |
| CTA that says "Get Started" or "Learn More" | Means nothing. Use specific action: "Start your audit", "See a sample". |
| Fake urgency countdown timers | Kills trust instantly for a B2B consulting buyer. |

---

## Section Architecture for Growth Audit Page

Required sections in recommended order:

1. **Hero** — One bold claim + proof signal (e.g. "12 protocols audited"). CTA to pricing or sample.
2. **Problem** — The gap the ICP lives in. Data-led. No fluff.
3. **The 6 pillars** — Visual framework. Matrix or process diagram. Not a bullet list.
4. **Sample audit** — Real screenshot or embed of redacted client output. Proof of work.
5. **Tiers** — Pricing cards. Starter / Pro / Elite. Conference offer if active.
6. **Past audits** — Miro board previews. Client logos if permissible. Named protocol names.
7. **FAQ** — Objection handling. Async delivery, turnaround, what's included.
8. **Final CTA** — Specific. Urgency only if real (conference window).

---

## Integration

- **Owner:** `designer` agent (production), `seo-agent` (schema + meta)
- **Pairs with:** `frontend-design` skill (HTML production), `mangabeira-content` MCP (publish)
- **SOP:** SOP-13 — invoke at Phase 1 before copy outline
- **Context files to load:** `_context/html-elements.md`, `_context/product-info.md`, `_context/style-guide.md`

---

## Anti-Slop Floor (inherited)

This skill provides **variety** through its combinatorial dimensions. The **quality floor** comes from the `design-principles` skill (`references/critic-checklist.md` + `references/format-overrides.md`).

When generating prompts or selecting directions:

- Inherit the universal anti-AI-slop list from `critic-checklist.md` (centered-everything symmetric layouts, purple/blue gradients as default, uniform rounded corners on every element, drop shadow on text, neon glow on text, six-bullet hero, em dashes anywhere on the artifact). These are non-negotiable across all formats.
- Apply the format-specific row from `format-overrides.md` for safe-zone, body min, headline min, word budget, and default mode.
- This skill keeps any **skill-specific** anti-patterns that the universal floor does not cover (e.g., thumbnails ban neutral expressions; landing pages ban 3-column logo carousels; ads enforce single-accent for conversion). These remain in this file and stack on top of the universal floor.

The combinatorial dimensions in this skill produce *variety above a quality floor*. They are not a license to drop below it.
