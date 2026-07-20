# Sasha Coin Ops Board — Design System

**ENG-022.** Canonical token/component design system for `sasha-coin/tasks.html`, Sasha Coin's internal engineering/content ops kanban board. Built 2026-07-08 following the same 6-step process the `mangaos-design` system used for `mission-control.html` and `tasks-v2.html` this week (see `marketing/.claude/skills/mangaos-design/README.md`).

---

## What this board is

`sasha-coin/tasks.html` is the daily-driver task board for Sasha Coin production work: content tasks, X growth, infrastructure, research, and SOP items on a 5-column kanban (Todo / In Progress / Review / Done / Scheduled), plus a Content Engine sub-board (parent/child cards through a 9-stage pipeline), a publishing calendar, and a Blog CMS table. It is an internal-only ops tool, not a client-facing surface, so per `dashboard-design`'s "console vs. showcase" rule, this system stays on the strict, no-personality-detours side: legibility over flourish.

## Where this system stood before this pass

`tasks.html` (4,231 lines) currently runs the generic `_templates/project-template/tasks.html` styling **completely unmodified**. Its `:root` token block is the literal mangabeira.net Navy/Aqua/Gold set (`--navy: #0A2540`, `--aqua: #1FB6FF`, `--gold: #FFB800`) — zero Sasha Coin brand identity anywhere in the file, despite Sasha Coin having a fully specified, distinct visual identity in `_context/style-guide.md` (dark purple `#7B2FBE`, deeper purple `#4A1A8C`, bright aqua `#00D4FF`, near-black-purple `#0D0D1A`). This is a real gap, not a drift from an existing system — there was no Sasha-specific board system to drift from.

## Reconciliation source

`sasha-coin/_context/style-guide.md` is the real, populated brand source and was used for every color/font decision below. `sasha-coin/_context/brand-style.md` is still the unpopulated `/init-project` placeholder template as of this build (its content is literally the schema-reference comment, no real tokens) — it could not be used as a source. If `brand-style.md` gets populated later, diff it against `colors_and_type.css` for drift before trusting it as canonical.

Sasha Coin's brand is an **AI agent persona on Crypto Twitter** — "dark, crypto-native, terminal screens, neon highlights, Matrix-adjacent without being cliche... alive, dynamic, data-forward, slightly mysterious. No corporate polish" (style-guide.md). This system channels that aesthetic into the internal ops tool: dark-native surfaces, purple structural identity, a single aqua interactive accent, hairline borders, depth via tone stacking rather than shadow — the "Operator's Console" discipline `mangaos-design` uses for Mission Control, re-derived from Sasha's own palette rather than MangaOS's.

---

## The 6-step build (per the mangabeira.net precedent)

### Step 1 — Inventory

Read `tasks.html`'s shipped `<style>` block (lines 9-821) in full. Findings:

- **9 CSS custom properties**, all mangabeira.net brand colors, zero Sasha Coin colors (`--navy`, `--dark-navy`, `--mid-navy`, `--aqua`, `--gold`, `--white`, `--muted`, `--green`, `--red`, `--orange`, `--purple` — note: `--purple` here is `#A78BFA`, a generic lavender used only for the "content" tag category, NOT Sasha's brand purple `#7B2FBE`).
- **2 fonts loaded** via the page's Google Fonts `<link>`: Montserrat (500-900) + Inter (400-600). Matches `style-guide.md` exactly — this part was already correct.
- **1 font referenced but never loaded**: `'DM Mono'` appears at 2 call sites (`.track-card-label` line 813, `.track-badge` line 818) but is absent from the `<link>` tag entirely — real drift, silently falling back to the browser's generic monospace this whole time.
- **Border-radius**: mostly 3-14px, clustering around 8px for cards, 10px for columns, 14px for the modal — a consistent-enough pattern to reconcile into a named scale rather than force onto a different one.
- **Opacity-wash colors**: ~50+ `rgba()` literals across aqua/gold/green/red/purple/orange hues, same "raw rgba() everywhere, no wash token" pattern the mangaos-design audit found on `tasks-v2.html` at 60-instance scale — this file has it too, just never audited before.
- **No skeleton-loader pattern** anywhere in the shipped CSS — loading states are undocumented.
- **Priority/health accent borders** (`.task.high/medium/low`, `.ce-card.parent/child`, `.status-blocked`) — same left-border-as-state-indicator pattern already vetted and accepted for the MangaOS Task Board (`feedback_repeated_accent_border_slop.md`).

### Step 2 — Token set decisions

See the inline decision comments in `colors_and_type.css` for full reasoning. Summary:

| Decision | Resolution |
|---|---|
| **Surfaces (60%)** | `#0D0D1A` base (style-guide.md's literal background hex), purple-tinted stack up through raised/overlay, purple-tinted down through sunken. Never drifts toward neutral gray or MangaOS navy. |
| **Structural color (30%)** | Sasha's brand purple family (`#7B2FBE` primary, `#4A1A8C` secondary) — used for category tags, dividers, decorative accents. Explicitly NOT a status color and NOT the interactive accent. |
| **Interactive accent (10%)** | Aqua `#00D4FF`, exactly as style-guide.md specifies. The ONE interactive accent — links, primary buttons, active/selected states, focus rings. Rule 13 compliant. |
| **"Needs you" / scheduled status color** | New non-brand token `#FBBF24` (warm gold), NOT the brand purple. See "the purple-as-status question" below — this was the one real judgment call in the build. |
| **Font** | Montserrat + Inter, unchanged (already correct). `'DM Mono'` drift fixed to a generic system-monospace stack — no 3rd webfont introduced. |
| **Radius** | Single reconciled scale (4/6/8/10/14/full), not invented, derived from what was already shipped. |
| **Wash tokens** | 2-tier (12%/30%) family per hue (aqua, purple, and each status color), same pattern `mangaos-design` promoted for `tasks-v2.html`. |

**The purple-as-status question (the one open aesthetic call, resolved via `dashboard-design` "decide" mode):** Sasha's brand purple is the natural instinct for a "needs attention" status color (it's the brand's #1 hue) — but purple is already assigned a structural role (category tags, dividers) in this token set. Making it also the status-alert color would make every purple element on a card ambiguous: "is this decorative brand color or does it mean something is waiting on me?" `dashboard-design`'s anti-pattern #21 ("no traffic-light overload... color tracks problem density") and Rule 13 (single accent) both push toward keeping status semantics in their own small, non-brand-overloaded set — the same pattern `mangaos-design` already uses (its aqua accent is brand, but 8 of its 10 agent-state colors are non-brand semantics, not purple-family). Resolution: `--color-state-scheduled` (`#FBBF24`, warm gold) is a new, deliberately non-brand token, kept clearly distinct from `--color-brand-primary` (`#7B2FBE`). No brand color is currently assigned as a status semantic in this system.

### Step 3 — Component library

Built in `components.css`: dot/status-indicator + 6 board states (todo/inprogress/review/done/scheduled/blocked) + 3 content-freshness states (fresh/aging/stale), state-chip, column shell, task-card + ce-card (priority/parent/child/pending-approval/blocked variants), the full tag/badge family (category tags, blocked-badge, approval-badge, due-date-badge, channel chips), buttons (primary/ghost/danger + the compact `.ce-btn` variant), form fields, modal, empty state, calendar pill, blog-status pill, stage pill, and a **prescribed** skeleton-loader family (see below).

**Skeleton loaders are a prescribed addition, not a reconciliation.** `tasks.html` has no loading-state CSS today. Per `dashboard-design`'s anti-slop floor rule #5 ("No 'Loading…' spinner where a skeleton would work"), this system ships the skeleton primitive now so the next loading-state build has something to reach for instead of inventing a spinner or a bare "Loading…" string. Not wired into `tasks.html` — available for the next feature pass that needs it.

**Accepted `impeccable` false positives (both flagged, both left unchanged, matching precedent):**
- `side-tab` findings on `.task.high/medium/low`, `.ce-card.parent/child` (components.css L105-112) — same pattern already vetted as intentional for the MangaOS Task Board (`feedback_repeated_accent_border_slop.md`, `project_task_board_design_system_reconciliation_2026-07-07.md`). A semantic priority/health indicator on cards that ARE in that state, always paired with a text badge, not decoration repeated across every sibling for no reason.
- `overused-font` on Inter (style-guide-viewer.html L7) — Inter is brand-mandated by `style-guide.md`, not a discretionary choice.

### Step 4 — Catalog + viewer

`component-catalog.json` lists every family above with 2-3 representative HTML examples each, machine-readable, matching the mangaos-design catalog schema (`label`/`families[]`/`examples[]`). `style-guide-viewer.html` is a **self-contained** HTML page (colors_and_type.css + components.css linked, the catalog JSON inlined as a JS constant rather than fetched) so it renders correctly whether opened directly as a file or served — sasha-coin's task-server does not have the same `ALLOWED_ROLES` asset-proxy route the marketing workspace's `task-server.js` uses for `mangaos-design`, so this viewer does not depend on that infrastructure existing.

### Step 5 — This README

Covers what this board is, the token reconciliation (what came from `style-guide.md`, what's board-specific), the one open aesthetic call and its resolution, and the file index below. No fixed status vocabulary section beyond what's already covered in Step 2/3 — this board's status words (todo/in progress/review/done/scheduled/blocked, plus CE stages and blog freshness) are the vocabulary, fully enumerated in the dot/tag components above.

### Step 6 — `tasks.html` was not touched

Per the task's explicit instruction, matching the mangabeira.net precedent's own step 6: this pass is system-build only. `sasha-coin/tasks.html`'s markup and its own `<style>` block were not edited. Every fix above is "ready to apply," not applied. Wiring `tasks.html` to import these tokens (repointing its existing CSS var names, e.g. `--aqua` → `var(--color-action-primary)`, and introducing the purple structural color that currently doesn't exist anywhere in the file) is a separate, deliberate follow-up pass, same two-step discipline `mangaos-design` used for `tasks-v2.html` (reconcile, then a later wiring pass).

---

## Index — what's in this system

| Path | What |
|---|---|
| `README.md` | This file |
| `colors_and_type.css` | Canonical tokens — surfaces, brand purple, interactive aqua accent, status palette, channel identity colors, type scale, spacing, radii, motion |
| `components.css` | Component library — dot/status system, columns, task/CE cards, tags/badges, buttons, fields, modal, empty state, skeleton (prescribed), calendar pill, blog/stage pills |
| `component-catalog.json` | Machine-readable example HTML for every family above, consumed by `style-guide-viewer.html` |
| `style-guide-viewer.html` | Self-contained viewer — token swatches, type scale, and every component example rendered live |
| `SKILL.md` | Agent-Skills entry point |

**Not deployed / not wired.** `sasha-coin/tasks.html` itself is unmodified — see Step 6 above. This is a source-of-truth pass only.
