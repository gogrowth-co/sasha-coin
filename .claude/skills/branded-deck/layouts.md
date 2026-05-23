# Branded Deck Layouts

Complete PptxGenJS implementations for all 9 layout types. Copy the scaffold, select the layouts you need, fill in content, and generate.

---

## Script Scaffold

Every deck script starts with this structure. Copy it, then call the layout functions you need.

```javascript
const pptxgen = require("pptxgenjs");

// ═══════════════════════════════════════════
// BRAND CONSTANTS
// ═══════════════════════════════════════════

const C = {
  navy:        "0A2540",
  aqua:        "1FB6FF",
  gold:        "FFB800",
  white:       "FFFFFF",
  slate:       "8B9BAD",
  midNavy:     "0D3558",
  darkNavy:    "071829",
  crimson:     "CC3355",
  darkCrimson: "1A0A10",
};

const FONT = { head: "Montserrat", body: "Inter" };

// ═══════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════

function addBackground(slide, color = C.navy) {
  slide.background = { color };
}

function addEdgeBar(slide, color = C.aqua) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color },
  });
}

function addSectionLabel(slide, text, color = C.aqua) {
  slide.addText(text.toUpperCase(), {
    x: 0.50, y: 0.45, w: 8.0, h: 0.30,
    fontFace: FONT.head, fontSize: 9, bold: true,
    color, charSpacing: 4, margin: 0,
  });
}

function addHeadline(slide, lines, opts = {}) {
  // lines: string or array of strings
  const fontSize = opts.fontSize || 38;
  const align = opts.align || "left";
  const y = opts.y || 0.85;
  const w = opts.w || 8.50;

  if (Array.isArray(lines)) {
    const textArr = lines.map((line, i) => ({
      text: line,
      options: {
        fontFace: FONT.head, fontSize, bold: true,
        color: C.white, breakLine: i < lines.length - 1,
      },
    }));
    slide.addText(textArr, { x: 0.50, y, w, h: 1.30, margin: 0, align, valign: "middle" });
  } else {
    slide.addText(lines, {
      x: 0.50, y, w, h: 0.85,
      fontFace: FONT.head, fontSize, bold: true,
      color: C.white, margin: 0, align, valign: "middle",
    });
  }
}

function addDotGrid(slide, position = "topRight", color = C.aqua) {
  const startX = position === "topRight" ? 8.50 : 0.40;
  const startY = position === "topRight" ? 0.35 : 0.55;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      slide.addShape("oval", {
        x: startX + col * 0.28,
        y: startY + row * 0.28,
        w: 0.10, h: 0.10,
        fill: { color },
      });
    }
  }
}

function addCardTopStripe(slide, x, y, w, color = C.aqua) {
  slide.addShape("rect", {
    x, y, w, h: 0.06,
    fill: { color },
  });
}

function addCardBg(slide, x, y, w, h, opts = {}) {
  const borderColor = opts.borderColor || C.midNavy;
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: opts.fill || C.midNavy },
    line: opts.borderColor ? { color: borderColor, width: 1 } : undefined,
  });
}

// ═══════════════════════════════════════════
// LAYOUT FUNCTIONS — see implementations below
// ═══════════════════════════════════════════

// ... paste layout functions here ...

// ═══════════════════════════════════════════
// COMPOSE DECK
// ═══════════════════════════════════════════

let pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Gabriel Mangabeira";
pres.title = "Deck Title Here";

// Call layout functions here, e.g.:
// titleSlide(pres, { ... });
// statCards(pres, { ... });

pres.writeFile({ fileName: "presentations/output.pptx" });
```

---

## Layout 1: Title Slide

**Edge bar:** Aqua
**Default dot grid:** top-right, aqua

```
┌──────────────────────────────────────────────────┐
│▎                                    ● ● ● ●     │
│▎                                    ● ● ● ●     │
│▎  SECTION LABEL                     ● ● ● ●     │
│▎                                    ● ● ● ●     │
│▎  Hero Name / Title                              │
│▎                                                 │
│▎  Subtitle line                                  │
│▎  ════════════                                   │
│▎  url                                            │
│▎                                                 │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel` (string): e.g. "ANALYST IN THE ARENA"
- `heroText` (string): e.g. "Gabriel Mangabeira"
- `subtitle` (string): e.g. "Web3 Growth Strategist  ·  Distribution Systems Installer"
- `url` (string): e.g. "mangabeira.net"

```javascript
function titleSlide(pres, { sectionLabel, heroText, subtitle, url }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.aqua);
  addDotGrid(slide, "topRight", C.aqua);

  addSectionLabel(slide, sectionLabel, C.aqua);

  // Hero text
  slide.addText(heroText, {
    x: 0.50, y: 1.85, w: 8.00, h: 1.10,
    fontFace: FONT.head, fontSize: 52, bold: true,
    color: C.white, margin: 0, valign: "middle",
  });

  // Subtitle
  slide.addText(subtitle, {
    x: 0.50, y: 3.00, w: 8.00, h: 0.45,
    fontFace: FONT.body, fontSize: 15,
    color: C.aqua, margin: 0, valign: "middle",
  });

  // Gold rule
  slide.addShape("rect", {
    x: 0.50, y: 3.55, w: 2.20, h: 0.05,
    fill: { color: C.gold },
  });

  // URL
  slide.addText(url, {
    x: 0.50, y: 3.75, w: 5.00, h: 0.35,
    fontFace: FONT.body, fontSize: 12,
    color: C.slate, margin: 0, valign: "middle",
  });
}
```

---

## Layout 2: Stat Cards

**Edge bar:** Gold
**Cards:** 3 equal columns with aqua top stripe

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎                                                 │
│▎  Headline line 1                                │
│▎  Headline line 2                                │
│▎                                                 │
│▎  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│▎  │▔▔▔aqua▔▔│  │▔▔▔aqua▔▔│  │▔▔▔aqua▔▔│        │
│▎  │  value  │  │  value  │  │  value  │        │
│▎  │  label  │  │  label  │  │  label  │        │
│▎  │ caption │  │ caption │  │ caption │        │
│▎  └─────────┘  └─────────┘  └─────────┘        │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel` (string)
- `headline` (string or string[])
- `stats` (array of 3): `[{ value, label, caption }]`

```javascript
function statCards(pres, { sectionLabel, headline, stats }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.gold);
  addSectionLabel(slide, sectionLabel, C.gold);
  addHeadline(slide, headline);

  const cardW = 2.90, cardH = 1.90, startY = 3.05, gap = 0.25;
  const positions = [0.50, 0.50 + cardW + gap, 0.50 + 2 * (cardW + gap)];

  stats.forEach((stat, i) => {
    const x = positions[i];

    addCardBg(slide, x, startY, cardW, cardH);
    addCardTopStripe(slide, x, startY, cardW);

    // Stat value
    slide.addText(stat.value, {
      x, y: startY + 0.15, w: cardW, h: 0.70,
      fontFace: FONT.head, fontSize: 36, bold: true,
      color: C.gold, align: "center", valign: "middle", margin: 0,
    });

    // Label
    slide.addText(stat.label, {
      x, y: startY + 0.85, w: cardW, h: 0.30,
      fontFace: FONT.head, fontSize: 11, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });

    // Caption
    slide.addText(stat.caption, {
      x, y: startY + 1.15, w: cardW, h: 0.30,
      fontFace: FONT.body, fontSize: 9,
      color: C.slate, align: "center", valign: "middle", margin: 0,
    });
  });
}
```

---

## Layout 3: Credential Rows

**Edge bar:** Aqua
**Rows:** 2-4 full-width horizontal rows with gold left accent bar

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎  Headline                                       │
│▎                                                 │
│▎  ┌──────────────────────────────────────────┐   │
│▎  │▏ Name                     Description    │   │
│▎  │▏ Role                                    │   │
│▎  └──────────────────────────────────────────┘   │
│▎  ┌──────────────────────────────────────────┐   │
│▎  │▏ Name                     Description    │   │
│▎  │▏ Role                                    │   │
│▎  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel`, `headline` (string or string[])
- `rows` (array of 2-4): `[{ name, role, description }]`

```javascript
function credentialRows(pres, { sectionLabel, headline, rows }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.aqua);
  addSectionLabel(slide, sectionLabel, C.aqua);
  addHeadline(slide, headline, { fontSize: 34 });

  const rowW = 9.00, rowH = 0.82, startY = 2.35, gap = 0.18;

  rows.forEach((row, i) => {
    const y = startY + i * (rowH + gap);

    addCardBg(slide, 0.50, y, rowW, rowH);

    // Gold left accent bar
    slide.addShape("rect", {
      x: 0.50, y, w: 0.05, h: rowH,
      fill: { color: C.gold },
    });

    // Company/credential name
    slide.addText(row.name, {
      x: 0.70, y: y + 0.06, w: 4.00, h: 0.28,
      fontFace: FONT.head, fontSize: 13, bold: true,
      color: C.gold, margin: 0, valign: "middle",
    });

    // Role
    slide.addText(row.role, {
      x: 0.70, y: y + 0.34, w: 3.50, h: 0.22,
      fontFace: FONT.head, fontSize: 10,
      color: C.aqua, margin: 0, valign: "middle",
    });

    // Description
    slide.addText(row.description, {
      x: 4.50, y: y + 0.10, w: 4.80, h: 0.50,
      fontFace: FONT.body, fontSize: 10,
      color: C.slate, margin: 0, valign: "middle",
    });
  });
}
```

---

## Layout 4: Two-Panel Comparison

**Edge bar:** Gold
**Panels:** Two side-by-side with different border colors

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎  Headline                                       │
│▎                                                 │
│▎  ┌── aqua border ──┐  ┌── crimson border ──┐   │
│▎  │ LEFT LABEL      │  │ RIGHT LABEL        │   │
│▎  │ ✓ Item 1        │  │ ✗ Item 1           │   │
│▎  │ ✓ Item 2        │  │ ✗ Item 2           │   │
│▎  │ ✓ Item 3        │  │ ✗ Item 3           │   │
│▎  └─────────────────┘  └────────────────────┘   │
│▎  ┌──────── bottom banner (gold text) ────────┐  │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel`, `headline`
- `leftLabel` (string), `leftItems` (string[])
- `rightLabel` (string), `rightItems` (string[])
- `banner` (string, optional): centered gold text below panels

```javascript
function twoPanelComparison(pres, { sectionLabel, headline, leftLabel, leftItems, rightLabel, rightItems, banner }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.gold);
  addSectionLabel(slide, sectionLabel, C.gold);
  addHeadline(slide, headline, { fontSize: 40 });

  const panelY = 1.85, panelH = 2.80;

  // Left panel (positive)
  addCardBg(slide, 0.50, panelY, 4.50, panelH, { borderColor: C.aqua });

  slide.addText(leftLabel.toUpperCase(), {
    x: 0.60, y: panelY + 0.10, w: 4.00, h: 0.28,
    fontFace: FONT.head, fontSize: 9, bold: true,
    color: C.aqua, charSpacing: 3, margin: 0,
  });

  leftItems.forEach((item, i) => {
    slide.addText("\u2713  " + item, {
      x: 0.65, y: panelY + 0.50 + i * 0.55, w: 4.20, h: 0.45,
      fontFace: FONT.body, fontSize: 10,
      color: C.white, margin: 0, valign: "middle",
    });
  });

  // Right panel (negative)
  addCardBg(slide, 5.20, panelY, 4.30, panelH, { fill: C.darkCrimson, borderColor: C.crimson });

  slide.addText(rightLabel.toUpperCase(), {
    x: 5.30, y: panelY + 0.10, w: 4.00, h: 0.28,
    fontFace: FONT.head, fontSize: 9, bold: true,
    color: C.crimson, charSpacing: 3, margin: 0,
  });

  rightItems.forEach((item, i) => {
    slide.addText("\u2717  " + item, {
      x: 5.35, y: panelY + 0.50 + i * 0.55, w: 4.00, h: 0.45,
      fontFace: FONT.body, fontSize: 10,
      color: C.white, margin: 0, valign: "middle",
    });
  });

  // Bottom banner
  if (banner) {
    addCardBg(slide, 0.50, 4.80, 9.00, 0.55);
    slide.addText(banner, {
      x: 0.60, y: 4.82, w: 8.80, h: 0.45,
      fontFace: FONT.head, fontSize: 11, bold: true,
      color: C.gold, align: "center", valign: "middle", margin: 0,
    });
  }
}
```

---

## Layout 5: Process Steps

**Edge bar:** Aqua
**Cards:** 3 tall equal columns with numbered steps

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎  Headline                                       │
│▎                                                 │
│▎  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│▎  │▔▔▔aqua▔▔▔│  │▔▔▔aqua▔▔▔│  │▔▔▔aqua▔▔▔│     │
│▎  │    01    │  │    02    │  │    03    │     │
│▎  │  Title   │  │  Title   │  │  Title   │     │
│▎  │ ════════ │  │ ════════ │  │ ════════ │     │
│▎  │ desc...  │  │ desc...  │  │ desc...  │     │
│▎  └──────────┘  └──────────┘  └──────────┘     │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel`, `headline`
- `steps` (array of 3): `[{ number, title, description }]`

```javascript
function processSteps(pres, { sectionLabel, headline, steps }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.aqua);
  addSectionLabel(slide, sectionLabel, C.aqua);
  addHeadline(slide, headline);

  const cardW = 3.00, cardH = 3.00, startY = 2.00, gap = 0.15;
  const positions = [0.50, 0.50 + cardW + gap, 0.50 + 2 * (cardW + gap)];

  steps.forEach((step, i) => {
    const x = positions[i];

    addCardBg(slide, x, startY, cardW, cardH);
    addCardTopStripe(slide, x, startY, cardW);

    // Step number
    slide.addText(step.number || String(i + 1).padStart(2, "0"), {
      x, y: startY + 0.15, w: cardW, h: 0.45,
      fontFace: FONT.head, fontSize: 28, bold: true,
      color: C.gold, align: "center", valign: "middle", margin: 0,
    });

    // Step title
    slide.addText(step.title, {
      x, y: startY + 0.65, w: cardW, h: 0.38,
      fontFace: FONT.head, fontSize: 14, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });

    // Gold divider
    slide.addShape("rect", {
      x: x + (cardW - 1.40) / 2, y: startY + 1.10, w: 1.40, h: 0.04,
      fill: { color: C.gold },
    });

    // Description
    slide.addText(step.description, {
      x: x + 0.15, y: startY + 1.25, w: cardW - 0.30, h: 1.50,
      fontFace: FONT.body, fontSize: 9.5,
      color: C.slate, align: "center", valign: "top", margin: 0,
    });
  });
}
```

---

## Layout 6: Vertical Timeline

**Edge bar:** Gold
**Rows:** 3 full-width rows with aqua numbered circles and connectors

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎  Headline                                       │
│▎                                                 │
│▎  ┌─────────────────────────────────────────┐    │
│▎  │ (1)  Title                              │    │
│▎  │      Description                        │    │
│▎  └─────────────────────────────────────────┘    │
│▎      │                                          │
│▎  ┌─────────────────────────────────────────┐    │
│▎  │ (2)  Title                              │    │
│▎  │      Description                        │    │
│▎  └─────────────────────────────────────────┘    │
│▎      │                                          │
│▎  ┌─────────────────────────────────────────┐    │
│▎  │ (3)  Title                              │    │
│▎  │      Description                        │    │
│▎  └─────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel`, `headline`
- `steps` (array of 3): `[{ title, description }]`
- `footerQuote` (string, optional): italic aqua text at bottom

```javascript
function verticalTimeline(pres, { sectionLabel, headline, steps, footerQuote }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.gold);
  addSectionLabel(slide, sectionLabel, C.gold);
  addHeadline(slide, headline);

  const rowW = 9.00, rowH = 0.95, startY = 1.85, gap = 0.20;
  const circleSize = 0.50;

  steps.forEach((step, i) => {
    const y = startY + i * (rowH + gap);

    // Row background
    addCardBg(slide, 0.50, y, rowW, rowH);

    // Aqua numbered circle
    slide.addShape("oval", {
      x: 0.62, y: y + (rowH - circleSize) / 2,
      w: circleSize, h: circleSize,
      fill: { color: C.aqua },
    });

    // Number inside circle
    slide.addText(String(i + 1), {
      x: 0.62, y: y + (rowH - circleSize) / 2,
      w: circleSize, h: circleSize,
      fontFace: FONT.head, fontSize: 14, bold: true,
      color: C.navy, align: "center", valign: "middle", margin: 0,
    });

    // Title
    slide.addText(step.title, {
      x: 1.30, y: y + 0.05, w: 4.50, h: 0.38,
      fontFace: FONT.head, fontSize: 14, bold: true,
      color: C.white, margin: 0, valign: "middle",
    });

    // Description
    slide.addText(step.description, {
      x: 1.30, y: y + 0.45, w: 8.00, h: 0.30,
      fontFace: FONT.body, fontSize: 10,
      color: C.slate, margin: 0, valign: "middle",
    });

    // Connector between rows (not after last)
    if (i < steps.length - 1) {
      slide.addShape("rect", {
        x: 0.80, y: y + rowH,
        w: 0.08, h: gap,
        fill: { color: C.aqua },
      });
    }
  });

  // Footer quote
  if (footerQuote) {
    slide.addShape("rect", {
      x: 0.50, y: 5.15, w: 9.00, h: 0.30,
      fill: { color: C.darkNavy },
    });
    slide.addText(footerQuote, {
      x: 0.60, y: 5.16, w: 8.80, h: 0.28,
      fontFace: FONT.body, fontSize: 9.5, italic: true,
      color: C.aqua, align: "center", valign: "middle", margin: 0,
    });
  }
}
```

---

## Layout 7: Pillar Cards

**Edge bar:** Aqua
**Cards:** 3-5 equal columns. If 4 or 5 items, wraps to 2 rows (3 top + remainder bottom).

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎  Headline                                       │
│▎                                                 │
│▎  ┌────────┐  ┌────────┐  ┌────────┐           │
│▎  │  01    │  │  02    │  │  03    │           │
│▎  │ Title  │  │ Title  │  │ Title  │           │
│▎  │ desc   │  │ desc   │  │ desc   │           │
│▎  └────────┘  └────────┘  └────────┘           │
│▎  ┌────────────┐  ┌────────────┐                │
│▎  │  04  Title │  │  05  Title │  (row 2, wider)│
│▎  └────────────┘  └────────────┘                │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel`, `headline`
- `pillars` (array of 3-5): `[{ number, title, description }]`

```javascript
function pillarCards(pres, { sectionLabel, headline, pillars }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.aqua);
  addSectionLabel(slide, sectionLabel, C.aqua);
  addHeadline(slide, headline);

  const startY = 1.85, cardH = 1.40, gap = 0.20, row2Y = startY + cardH + gap;

  if (pillars.length <= 3) {
    // Single row of 3
    const cardW = 2.90;
    const positions = [0.50, 0.50 + cardW + gap, 0.50 + 2 * (cardW + gap)];
    pillars.forEach((p, i) => drawPillarCard(slide, positions[i], startY, cardW, cardH, p, i));
  } else {
    // Row 1: first 3
    const cardW1 = 2.90;
    const pos1 = [0.50, 0.50 + cardW1 + gap, 0.50 + 2 * (cardW1 + gap)];
    pillars.slice(0, 3).forEach((p, i) => drawPillarCard(slide, pos1[i], startY, cardW1, cardH, p, i));

    // Row 2: remaining (wider cards)
    const remaining = pillars.slice(3);
    const cardW2 = (9.00 - (remaining.length - 1) * gap) / remaining.length;
    remaining.forEach((p, i) => {
      const x = 0.50 + i * (cardW2 + gap);
      drawPillarCard(slide, x, row2Y, cardW2, cardH, p, i + 3);
    });
  }
}

function drawPillarCard(slide, x, y, w, h, pillar, index) {
  addCardBg(slide, x, y, w, h);

  // Number
  slide.addText(pillar.number || String(index + 1).padStart(2, "0"), {
    x, y: y + 0.10, w, h: 0.35,
    fontFace: FONT.head, fontSize: 18, bold: true,
    color: C.gold, align: "center", valign: "middle", margin: 0,
  });

  // Title
  slide.addText(pillar.title, {
    x, y: y + 0.45, w, h: 0.30,
    fontFace: FONT.head, fontSize: 11, bold: true,
    color: C.white, align: "center", valign: "middle", margin: 0,
  });

  // Description
  slide.addText(pillar.description, {
    x: x + 0.10, y: y + 0.80, w: w - 0.20, h: 0.50,
    fontFace: FONT.body, fontSize: 9,
    color: C.slate, align: "center", valign: "top", margin: 0,
  });
}
```

---

## Layout 8: Tag Grid

**Edge bar:** Aqua
**Cards:** Up to 10 items in 2 rows of 5

```
┌──────────────────────────────────────────────────┐
│▎  SECTION LABEL                                  │
│▎  Headline                                       │
│▎  Subheadline (optional)                         │
│▎                                                 │
│▎  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│▎  │Tag 1│ │Tag 2│ │Tag 3│ │Tag 4│ │Tag 5│    │
│▎  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
│▎  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│▎  │Tag 6│ │Tag 7│ │Tag 8│ │Tag 9│ │T 10 │    │
│▎  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `sectionLabel`, `headline`
- `subheadline` (string, optional)
- `tags` (string[]): up to 10 labels

```javascript
function tagGrid(pres, { sectionLabel, headline, subheadline, tags }) {
  let slide = pres.addSlide();
  addBackground(slide);
  addEdgeBar(slide, C.aqua);
  addSectionLabel(slide, sectionLabel, C.aqua);
  addHeadline(slide, headline);

  if (subheadline) {
    slide.addText(subheadline, {
      x: 0.50, y: 1.50, w: 9.00, h: 0.40,
      fontFace: FONT.body, fontSize: 12,
      color: C.slate, margin: 0, valign: "middle",
    });
  }

  const cols = 5, cardW = 1.72, cardH = 1.10, gapX = 0.14, gapY = 0.20;
  const row1Y = 2.15, row2Y = row1Y + cardH + gapY;

  tags.forEach((tag, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = 0.50 + col * (cardW + gapX);
    const y = row === 0 ? row1Y : row2Y;

    addCardBg(slide, x, y, cardW, cardH);

    slide.addText(tag, {
      x, y, w: cardW, h: cardH,
      fontFace: FONT.head, fontSize: 11, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });
  });
}
```

---

## Layout 9: CTA / Closing Slide

**No left edge bar.** Uses a gold top stripe instead.
**Background:** DarkNavy (not Navy)
**Dot grid:** top-left, navy dots

```
┌══════════════════ gold top stripe ═══════════════┐
│● ● ● ●                                          │
│● ● ● ●                                          │
│● ● ● ●                                          │
│                                                  │
│          CTA LABEL                               │
│                                                  │
│          Headline line 1                         │
│          Headline line 2                         │
│                                                  │
│          ┌═══════════════════┐                    │
│          │   button text     │  (gold button)    │
│          └═══════════════════┘                    │
│                                                  │
│          location · timezone · tagline           │
│          social handles                          │
└──────────────────────────────────────────────────┘
```

**Parameters:**
- `ctaLabel` (string): e.g. "READY TO BUILD?"
- `headline` (string or string[])
- `buttonText` (string): e.g. "mangabeira.net"
- `locationLine` (string): e.g. "Florianopolis, SC  ·  UTC-3  ·  The work travels."
- `socialLine` (string): e.g. "@manga82  ·  /in/mangabeira  ·  mangabeira.net"

```javascript
function ctaSlide(pres, { ctaLabel, headline, buttonText, locationLine, socialLine }) {
  let slide = pres.addSlide();
  addBackground(slide, C.darkNavy);

  // Gold top stripe (replaces edge bar)
  slide.addShape("rect", {
    x: 0, y: 0, w: 10.00, h: 0.07,
    fill: { color: C.gold },
  });

  // Dot grid top-left (navy dots on dark background)
  addDotGrid(slide, "topLeft", C.navy);

  // CTA label
  slide.addText(ctaLabel.toUpperCase(), {
    x: 1.50, y: 1.10, w: 7.00, h: 0.35,
    fontFace: FONT.head, fontSize: 10, bold: true,
    color: C.gold, charSpacing: 5, align: "center", valign: "middle", margin: 0,
  });

  // Headline
  if (Array.isArray(headline)) {
    const textArr = headline.map((line, i) => ({
      text: line,
      options: {
        fontFace: FONT.head, fontSize: 38, bold: true,
        color: C.white, breakLine: i < headline.length - 1,
      },
    }));
    slide.addText(textArr, {
      x: 1.00, y: 1.60, w: 8.00, h: 1.50,
      align: "center", valign: "middle", margin: 0,
    });
  } else {
    slide.addText(headline, {
      x: 1.00, y: 1.60, w: 8.00, h: 1.50,
      fontFace: FONT.head, fontSize: 38, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });
  }

  // CTA button
  slide.addShape("rect", {
    x: 3.50, y: 3.30, w: 3.00, h: 0.65,
    fill: { color: C.gold },
  });
  slide.addText(buttonText, {
    x: 3.50, y: 3.30, w: 3.00, h: 0.65,
    fontFace: FONT.head, fontSize: 16, bold: true,
    color: C.navy, align: "center", valign: "middle", margin: 0,
  });

  // Location line
  slide.addText(locationLine, {
    x: 2.00, y: 4.20, w: 6.00, h: 0.35,
    fontFace: FONT.body, fontSize: 10,
    color: C.slate, align: "center", valign: "middle", margin: 0,
  });

  // Social line
  slide.addText(socialLine, {
    x: 2.00, y: 4.60, w: 6.00, h: 0.35,
    fontFace: FONT.body, fontSize: 10,
    color: C.aqua, align: "center", valign: "middle", margin: 0,
  });
}
```

---

## Complete Example

A full deck script using multiple layouts:

```javascript
const pptxgen = require("pptxgenjs");

// Paste brand constants and helpers from scaffold above, then:

let pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Gabriel Mangabeira";
pres.title = "Growth Strategy - Client Name";

titleSlide(pres, {
  sectionLabel: "ANALYST IN THE ARENA",
  heroText: "Gabriel Mangabeira",
  subtitle: "Web3 Growth Strategist  \u00b7  Distribution Systems Installer",
  url: "mangabeira.net",
});

statCards(pres, {
  sectionLabel: "THE POSITION",
  headline: ["One Strategist.", "A System Built to Scale."],
  stats: [
    { value: "3", label: "Clients at a time", caption: "Focused, not spread thin" },
    { value: "48h", label: "Response window", caption: "Async-first by design" },
    { value: "$0", label: "Cost to apply", caption: "Paid work starts day one" },
  ],
});

credentialRows(pres, {
  sectionLabel: "PROOF POINTS",
  headline: ["Built at the top.", "Deployed where it counts."],
  rows: [
    { name: "Binance", role: "Former Head of Growth", description: "Scale. Global campaigns. Complexity at 100M+ users." },
    { name: "International Olympic Comm.", role: "Growth consultant", description: "Governance-led marketing. Institutional execution." },
    { name: "Competitive swimming", role: "National-level athlete", description: "Performance systems mindset applied to business." },
  ],
});

ctaSlide(pres, {
  ctaLabel: "READY TO BUILD?",
  headline: ["Send the brief.", "Get a scoped proposal in 48h."],
  buttonText: "mangabeira.net",
  locationLine: "Florianopolis, SC  \u00b7  UTC-3  \u00b7  The work travels.",
  socialLine: "@manga82  \u00b7  /in/mangabeira  \u00b7  mangabeira.net",
});

pres.writeFile({ fileName: "presentations/output.pptx" });
```
