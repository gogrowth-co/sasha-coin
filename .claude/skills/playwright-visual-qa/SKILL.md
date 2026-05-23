---
name: playwright-visual-qa
description: Visual QA for landing pages and web assets using playwright-cli. Captures screenshots at 3 breakpoints (375px mobile / 768px tablet / 1440px desktop), tests interactive elements (collapsibles, tabs, CTAs), and reports layout issues before publishing to Supabase. Designed for the designer agent's Phase 3 (Design Critic) on landing page tasks.
---

## PURPOSE

Run pre-publish visual QA on any HTML file or staging URL. Three modes:

1. **Breakpoint audit** — Screenshots at mobile / tablet / desktop. Default mode, always run.
2. **Interactive test** — Click/expand collapsibles, tabs, CTAs, forms. Run when the page uses components from `_context/html-elements.md`.
3. **Diff check** — Compare before/after screenshots when editing an existing published page. Run on refresh tasks.

---

## INSTALL (run once per machine)

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills
```

Check if already installed:

```bash
playwright-cli --version 2>/dev/null && echo "INSTALLED" || echo "NEEDS INSTALL"
```

If the machine doesn't have Node/npm, install via Homebrew first:

```bash
brew install node && npm install -g @playwright/cli@latest && playwright-cli install --skills
```

---

## MODE 1: BREAKPOINT AUDIT

Run this on every landing page before pushing to Supabase.

### Step 1: Resolve the target

**Local HTML file (staging draft):**
```bash
# Open in a local server so relative asset paths resolve
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing"
npx serve pages/ -p 8765 &
SERVER_PID=$!
TARGET_BASE="http://localhost:8765"
# e.g. TARGET_URL="http://localhost:8765/web3-growth-audit/index.html"
```

**Supabase draft URL (preferred for post-MCP push):**
```bash
TARGET_URL="https://mangabeira.net/publications/[slug]"
# Confirm it's in draft status before running QA
```

### Step 2: Run breakpoint screenshots

```bash
SLUG="[page-slug]"  # replace with actual slug

for VIEWPORT in "375x812:mobile" "768x1024:tablet" "1440x900:desktop"; do
  WIDTH=$(echo $VIEWPORT | cut -d: -f1 | cut -dx -f1)
  HEIGHT=$(echo $VIEWPORT | cut -d: -f1 | cut -dx -f2)
  LABEL=$(echo $VIEWPORT | cut -d: -f2)

  playwright-cli screenshot \
    --url "$TARGET_URL" \
    --viewport "${WIDTH}x${HEIGHT}" \
    --output "/tmp/qa-${SLUG}-${LABEL}.png" \
    --wait-for-load
  
  echo "Captured: /tmp/qa-${SLUG}-${LABEL}.png (${WIDTH}px)"
done

# Kill local server if used
[ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
```

### Step 3: Read and inspect each screenshot

Read all three screenshots sequentially. For each one, check against this list:

**Mobile (375px):**
- [ ] Hero headline visible and not truncated
- [ ] CTA button fully visible, not overlapping other elements
- [ ] No horizontal scroll (overflow-x hidden)
- [ ] Text readable — no font below 14px
- [ ] Navigation collapses or hides correctly
- [ ] Images scale without distortion

**Tablet (768px):**
- [ ] Two-column grids don't collapse to one if they shouldn't
- [ ] Stats/metrics cards align correctly
- [ ] No orphaned single elements in a multi-column grid

**Desktop (1440px):**
- [ ] Max-width container centered correctly
- [ ] No elements stretching full-width when they shouldn't
- [ ] Gold CTA buttons use correct Navy text
- [ ] Brand colors match exactly — no off-palette Tailwind defaults

### Step 3.5: Numeric design-principles checks (run on every breakpoint)

These are deterministic JS evaluators that surface design-principles violations the eye misses. Run via `playwright-cli eval`. They map to rules in the `design-principles` skill (`references/critic-checklist.md`):

**Rule 8 — Minimum readable size.** Detect any rendered text element where `getComputedStyle(el).fontSize` is below threshold (16 px body / 14 px caption / 32 px headline at md+ web; 14 px floor on mobile). Report element + actual size.

**Rule 10 — Line length ≤60ch.** For each text block where `getBoundingClientRect().width / approxCharWidth` exceeds 60 characters, log `[FAIL] line-length too long: <selector> = <X>ch`.

**Rule 11 — WCAG contrast ≥4.5:1 body, ≥3:1 large.** Sample text vs. background pairs. Flag any pair below 4.5:1 (body) or 3:1 (large = ≥24 px regular, ≥18.66 px bold). For text that overlays imagery, sample at 9 points across the text bounding box — flag if any point fails.

**Rule 15 — 8pt grid.** Audit `padding`, `margin`, `gap` computed values across visible elements. Any non-multiple of 4 (allowed for icons only) or any value not in {4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128} → log as a hint (not a hard fail unless the value drifts >2 px from the nearest grid stop).

Failures from these checks are treated identically to the Step 3 visual checklist failures.

Report all failures (Step 3 + Step 3.5) as a numbered list: `[FAIL] [breakpoint] [rule or element] — [what's wrong] — [actual measurement]`

---

## MODE 2: INTERACTIVE ELEMENT TEST

Run when the page uses any component from `_context/html-elements.md`. After the breakpoint audit, open a persistent session and test each interactive component.

```bash
SLUG="[page-slug]"
SESSION="qa-${SLUG}"

# Open the page in a named session
playwright-cli open --url "$TARGET_URL" -s="$SESSION"

# Test collapsible sections (details/summary elements)
playwright-cli click --selector "details:first-of-type summary" -s="$SESSION"
playwright-cli screenshot --output "/tmp/qa-${SLUG}-collapsible-open.png" -s="$SESSION"
playwright-cli click --selector "details:first-of-type summary" -s="$SESSION"  # close it back

# Test tab components (if present)
playwright-cli click --selector "[role='tab']:nth-child(2)" -s="$SESSION"
playwright-cli screenshot --output "/tmp/qa-${SLUG}-tab-2.png" -s="$SESSION"

# Test primary CTA
playwright-cli snapshot -s="$SESSION"
# Read snapshot to find the CTA button's ref, then verify href:
# playwright-cli console --code "document.querySelector('[href*=\"web3-growth-audit\"]')?.href" -s="$SESSION"

# Close session
playwright-cli close -s="$SESSION"
```

**Interactive check list:**
- [ ] Collapsible sections open and close without layout shift
- [ ] Tab switching shows correct panel (no empty content)
- [ ] Primary CTA links to `https://mangabeira.net/services/web3-growth-audit` (or the campaign URL)
- [ ] No broken links (404 on same-domain anchor nav)
- [ ] Form fields (if any) accept input without errors

---

## MODE 3: DIFF CHECK (refresh/edit tasks)

Use when comparing a before/after for an existing published page.

```bash
SLUG="[page-slug]"

# BEFORE: screenshot the current live page
playwright-cli screenshot \
  --url "https://mangabeira.net/publications/${SLUG}" \
  --viewport "1440x900" \
  --output "/tmp/qa-${SLUG}-before.png" \
  --wait-for-load

# [make your edits to the page content, push as draft to Supabase]

# AFTER: screenshot the draft
playwright-cli screenshot \
  --url "https://mangabeira.net/publications/${SLUG}?preview=true" \
  --viewport "1440x900" \
  --output "/tmp/qa-${SLUG}-after.png" \
  --wait-for-load

# Read both screenshots and describe the visible differences
```

Read both files. Describe what changed visually. Flag any regressions.

---

## QA REPORT FORMAT

After completing Mode 1 (and Mode 2 if applicable), produce this report before presenting results to the user:

```
## Playwright QA Report — [slug]
Date: [YYYY-MM-DD]
Mode: breakpoint [+ interactive if run]

### Breakpoints
| Viewport | Status | Issues |
|---|---|---|
| Mobile 375px | ✅ PASS / ❌ FAIL | [list or —] |
| Tablet 768px | ✅ PASS / ❌ FAIL | [list or —] |
| Desktop 1440px | ✅ PASS / ❌ FAIL | [list or —] |

### Interactive Elements [skip if Mode 2 not run]
| Component | Status | Notes |
|---|---|---|
| Collapsibles | ✅ / ❌ | |
| Tabs | ✅ / ❌ | |
| CTA links | ✅ / ❌ | href: [actual href found] |

### Verdict
[PASS — ready for Approval Gate 2]
OR
[FAIL — N issues found. Fix before requesting approval.]

### Issues to fix
1. [breakpoint] [element]: [description + fix instruction]
2. ...
```

Save the report to `/tmp/qa-report-[slug]-[YYYY-MM-DD].md`.

---

## INTEGRATION WITH DESIGNER AGENT

This skill runs at **Step 4 (QA)** of the designer agent's landing page workflow, BEFORE Approval Gate 2. Sequence:

1. Designer builds page HTML (Step 3)
2. Push as draft to Supabase via `upsert_page` with `status: "draft"` (or serve locally)
3. Run `playwright-visual-qa` — breakpoint audit always, interactive test if components present
4. Fix all FAIL items
5. Re-run audit to confirm PASS
6. Flag `[NEEDS APPROVAL — Landing page preview ready]` (Approval Gate 2)

**Do not request Approval Gate 2 until the QA report shows all PASS.**

---

## TIPS

- `--wait-for-load` waits for `networkidle` — gives Tailwind time to apply all classes
- If Tailwind CDN hasn't loaded, screenshots will show unstyled HTML — check the network tab with `playwright-cli requests -s="$SESSION"`
- For local `pages/` files, always use a local server (`npx serve` or `python3 -m http.server`) — `file://` paths break relative CSS imports
- If the page has a sticky nav, it may obscure content in the screenshot at mobile — verify with `overflow: hidden` or `position: static` temporarily
- playwright-cli sessions persist within a terminal session — always `close` when done to free resources