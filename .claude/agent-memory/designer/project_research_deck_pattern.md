---
name: research-deck-pattern
description: Proven pattern for single-file HTML intelligence brief decks in Sasha workspace
type: project
---

Self-contained single-file HTML deck pattern for operator-facing research briefs (9 slides, keyboard/click navigable).

**Palette:** Dark Operator's Console -- surfaces #06070A / #0A0B0F / #13141A / #1B1D26, borders #22242E / #2D2F3B, text #F0F1F5 / #9EA3B8 / #6B7090, accent Aqua #00D4FF, semantic Green #34D399 / Amber #FBBF24 / Red #F87171.

**Fonts:** Inter Tight 700-800 (headlines), Inter 400-600 (body), JetBrains Mono 400-600 (eyebrows, labels, mono values).

**Navigation:** Fixed bottom pill nav (`position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%)`). Click-on-body also advances. Arrow keys supported. Slide counter in center of pill.

**Color coding for risk/signal:** badge-green (Low/High), badge-amber (Early/Mixed), badge-red (Blocker/Medium-High). Each is a `.badge` with matching `-dim` background and semi-transparent border -- no solid fills.

**Verdict slide pattern (slide 8):** Two `.verdict-hero` spans side by side, one green one red ("Legit platform," / "wrong chain."). Below: a full-width card with `<table class="verdict-table">` -- no outer border-radius, `border-collapse: collapse`, colored `.risk-pill` in rightmost column.

**Blocker banner pattern:** `.blocker-banner` = dark red dim bg + red border + emoji icon + eyebrow label. Background swap for green/amber variants (green-dim for success callout, amber-dim for warning).

**QA notes:** Playwright screenshots via local `npx serve` on a spare port (used 9988). `file://` protocol is blocked by playwright-cli. Serve the directory then `goto http://localhost:PORT/file.html`.

**Why:** Gabriel requested dark branded operator-console aesthetic matching the LP Miner dashboard palette (set 2026-06-03). First research deck in this format, confirmed QA pass 2026-07-09.

**How to apply:** Reuse this file's CSS token set and slide structure for future intelligence briefs, pre-mortem decks, or competitor analyses. The 9-slide arc (title, question, what it is, legitimacy, credentials, blocker, noise warning, verdict table, recommendation) is a reusable template for binary go/no-go decisions.
