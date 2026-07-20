---
name: sasha-board-design
description: Use this skill to generate well-branded UI for the Sasha Coin internal ops board — sasha-coin/tasks.html, the daily-driver kanban for content tasks, X growth, infrastructure, research, Content Engine, calendar, and Blog CMS. Contains the canonical tokens, type, fonts, and component library derived from sasha-coin/_context/style-guide.md (purple structural identity + single aqua interactive accent on near-black). Triggers: "design the Sasha board", "Sasha ops board UI", "build a [X] view for tasks.html", "sasha-board-design".
user-invocable: true
---

# Sasha Coin Ops Board — design skill

Read `README.md` first — it carries the full reconciliation (what came from `style-guide.md`, what was a real judgment call, what was left as an accepted `impeccable` false positive). Then use the token/component files.

## What this is

The canonical design system for `sasha-coin/tasks.html` (ENG-022), an internal engineering/content ops kanban. Dark-native surfaces (`#0D0D1A` purple-tinted near-black), Sasha's brand purple (`#7B2FBE`/`#4A1A8C`) as the structural/decorative color, a single aqua accent (`#00D4FF`) for everything interactive, hairline borders, depth via tone stacking not shadow. This is an internal-only console — per `dashboard-design`'s console-vs-showcase rule, it stays on the strict side: legibility over flourish, no personality detours.

## Files

- `README.md` — full context: what existed before this pass, the reconciliation table, the one open aesthetic call (purple-as-status, resolved against non-brand status color) and its reasoning, accepted false positives, file index.
- `colors_and_type.css` — canonical tokens. Always reference by name, never raw hex.
- `components.css` — dot/status system (6 board states + 3 content-freshness states), columns, task/CE cards, tags/badges, buttons, fields, modal, empty state, skeleton loader (prescribed, not yet wired), calendar pill, blog/stage pills.
- `component-catalog.json` — machine-readable examples per family, consumed by `style-guide-viewer.html`.
- `style-guide-viewer.html` — self-contained specimen page (tokens linked, catalog inlined) — open directly, no server required.

## How to use

- **Visual artifacts** (mocks, prototypes, new views for `tasks.html`): copy `colors_and_type.css` + `components.css` next to the new HTML and link them, or lift class names directly since they already match `tasks.html`'s shipped markup 1:1.
- **Production code** (editing the real `sasha-coin/tasks.html`): this file is NOT yet wired to this token system (see README Step 6 — deliberately out of scope for the system-build pass). Wiring is a separate, deliberate follow-up: repoint the existing `:root` var VALUES to `var(--color-*)` tokens, keep the existing var NAMES so the 4,000+ call sites in the file don't need touching, same discipline `mangaos-design` used for `tasks-v2.html`.

## Non-negotiables (STRICT)

1. All colors referenced by token name, never raw hex.
2. Every status = the dot component + text label. Never color alone.
3. Board status vocabulary is exactly: `todo · in-progress · review · done · scheduled · blocked` (task/CE cards) and `fresh · aging · stale` (Blog CMS content-freshness). Don't invent new status words — extend the token set instead if a genuinely new state is needed.
4. **Aqua `#00D4FF` is the ONE interactive accent.** Purple (`#7B2FBE`/`#4A1A8C`) is structural/decorative only — never used for status, never used as a second "accent."
5. Depth via surface-tone stacking — no box-shadows (the modal backdrop blur and review-panel slide-in edge are the only accepted exceptions).
6. Montserrat + Inter only. No 3rd webfont — `'DM Mono'` (found at 2 legacy call sites in `tasks.html`) is drift, not a real 3rd family; it was never loaded and silently fell back to generic monospace.
7. Priority/health left-border accents on cards (`.task.high/medium/low`, `.ce-card.parent/child/blocked`) are an accepted, documented exception to the side-tab anti-pattern — always paired with a text badge, never color alone, never applied decoratively to a whole grid.

## Forbidden

Brand purple used as a status/alert color (breaks the single-accent + non-ambiguous-purple decision, see README) · gradients as default background · glassmorphism as the default surface treatment (the modal backdrop blur is the one accepted exception) · drop shadows on text · neon glow on text · spinners as a loading state (use the skeleton primitive) · a 3rd font family · pie charts for time series · equal-sized metric-card grids with no hierarchy.

If invoked without guidance, ask which view of `tasks.html` is being built or redesigned, confirm the token set against `README.md`, then act as an expert designer who outputs HTML/CSS wired to this system.
