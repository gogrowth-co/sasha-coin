# thumbnail-taste

Visual direction for video thumbnails across X short-form video, Remotion renders, and YouTube. Stops the "text on dark gradient" default. Combinatorial engine forces high-contrast, expression-led thumbnails that drive clicks.

---

## When to use

Use before producing any:
- X/Twitter short video thumbnail (1600×900)
- Remotion composition cover frame
- YouTube thumbnail (1280×720)
- LinkedIn video cover image

Invoke at the start of `web3-twitter-video-editor` or any Remotion production task. Thumbnail direction shapes the opening frame of the video.

---

## Configuration

```
VISUAL_AMBITION: 9       // thumbnails compete against every other video in the feed
COPY_WEIGHT: 2           // 3-5 words max. thumbnails are scanned in 0.2 seconds.
HUMAN_PRESENCE: 9        // face-dominant thumbnails outperform everything else on video
CONTRAST_LEVEL: 10       // thumbnails must pop at 120×68px preview size
```

---

## Combinatorial Engine

### Dimension 1 — Primary Subject

| Option | Description |
|---|---|
| **A. Expression-dominant** | Gabriel's face fills 50%+ of the canvas. Strong expression — shock, confidence, seriousness. Not neutral. |
| **B. Face + data** | Gabriel's face takes 40%, one key data point takes 40%. The number explains the expression. |
| **C. Before/after split** | Left: broken state. Right: fixed state. No face. Pure data contrast. |
| **D. Bold statement** | 3-5 words in massive type. No face. Typography IS the thumbnail. |
| **E. Screen recording crop** | A dramatic crop of a real tool (Dune, GA4, audit doc) with one finding highlighted. |

### Dimension 2 — Background

| Option | Description |
|---|---|
| **1. Solid high-contrast** | One bold color — Gold `#FFB800`, red `#DC2626`, or brand navy. Subject pops hard. |
| **2. White/light** | Clean. Works when the subject or typography is visually strong enough alone. |
| **3. Split color** | Two contrasting colors divide the canvas. Face on one side, text on the other. |
| **4. Blurred environment** | Real-world or work context blurred behind subject. Depth without distraction. |

### Dimension 3 — Text Overlay

| Option | Description |
|---|---|
| **I. No text** | Face and expression carry everything. Works for expression-dominant + strong visual. |
| **II. One number** | "0%", "$0", "6x". The number is the punch. Set at 30-40% canvas height. |
| **III. 3-5 word hook** | Short, bold, specific. Set at max readable size. No subtitle. |
| **IV. Question** | A one-line question the ICP can't ignore. "Does your KOL budget actually work?" |

### Dimension 4 — Composition

| Option | Description |
|---|---|
| **α. Rule of thirds** | Face at left third. Text fills right two-thirds. Classic, works at any size. |
| **β. Face full-bleed** | Face fills canvas. Text overlaid with shadow or outline for contrast. |
| **γ. Center impact** | Face or text centered. Aggressive negative space. Designed to feel deliberate. |
| **δ. Diagonal energy** | Visual elements on a diagonal. Movement and energy. Face angled or cropped. |

---

## Anti-Slop Rules — Thumbnails

BANNED. Regenerate if present:

| Pattern | Why it fails |
|---|---|
| Dark navy + glowing text outline | Every crypto YouTube channel. Zero differentiation. |
| Neutral facial expression | No emotion = no click. Thumbnails require performance. |
| More than 6 words of text | Unreadable at preview size. |
| Generic arrow pointing at something off-screen | MrBeast parody. Only works at MrBeast's scale. |
| Face pasted on a gradient background with no grounding | Looks like a bad composite. Uncanny. |
| Multiple faces or subjects competing | One subject. Always. |
| Thin font weight for thumbnail text | Must use 700-900 weight minimum. |
| Text color that matches the background | Zero contrast = invisible. |
| Thumbnail that only makes sense after watching the video | Thumbnail must create curiosity standalone. |

---

## Size Requirements

| Platform | Dimensions | Notes |
|---|---|---|
| X/Twitter | 1600×900 | 16:9. Must read at 400px preview width. |
| YouTube | 1280×720 | 16:9. Must read at 120×68px (search result). |
| LinkedIn video | 1200×627 | Slightly different crop. Check letterboxing. |
| Remotion cover frame | Match composition dimensions | First frame is auto-used as thumbnail if no custom image. |

---

## Remotion Integration

When building a Remotion composition:
1. Run thumbnail-taste to select direction BEFORE building the composition.
2. Design the first frame of the composition to match the thumbnail direction.
3. The opening frame IS the thumbnail — no separate file needed.
4. The opening frame must work as a still image (no motion-dependent elements in frame 0).

For X short videos: produce a separate static thumbnail PNG in addition to the video. X uses the thumbnail for the feed card before the video autoplays.

---

## Gabriel Photo Usage

For expression-dominant thumbnails, the best sources:
- `Documents/gabriel profile yellow.jpeg` — high energy, smiling, yellow BG pops against anything
- `Documents/gabriel profile blue.jpg` — more serious/authoritative tone
- `Documents/1697526999668.jpeg` — check for any conference/speaking photos

Preferred: shoot new expression-specific photos for high-stakes video campaigns. Expression should match the video's tone (serious for audit teardowns, energetic for wins, skeptical for contrarian takes).

---

## Integration

- **Owner:** `content-writer` (social video), `designer` agent (Remotion production)
- **Execution tool:** nanobanana (`mcp__nanobanana__generate_image`) or HTML + Chrome headless for text-dominant directions
- **Pairs with:** `web3-twitter-video-editor`, `remotion-best-practices`
- **Trigger:** Start of any video production task

---

## Anti-Slop Floor (inherited)

This skill provides **variety** through its combinatorial dimensions. The **quality floor** comes from the `design-principles` skill (`references/critic-checklist.md` + `references/format-overrides.md`).

When generating prompts or selecting directions:

- Inherit the universal anti-AI-slop list from `critic-checklist.md` (centered-everything symmetric layouts, purple/blue gradients as default, uniform rounded corners on every element, drop shadow on text, neon glow on text, six-bullet hero, em dashes anywhere on the artifact). These are non-negotiable across all formats.
- Apply the format-specific row from `format-overrides.md` for safe-zone, body min, headline min, word budget, and default mode.
- This skill keeps any **skill-specific** anti-patterns that the universal floor does not cover (e.g., thumbnails ban neutral expressions; landing pages ban 3-column logo carousels; ads enforce single-accent for conversion). These remain in this file and stack on top of the universal floor.

The combinatorial dimensions in this skill produce *variety above a quality floor*. They are not a license to drop below it.
