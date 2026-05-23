---
name: design-principles
description: Brand-agnostic floor of design quality for every visual artifact in this Marketing OS. 20 codified, research-backed rules with numeric thresholds (Tufte, Reynolds, Duarte, Williams CRAP, Refactoring UI, WCAG 2.2, Müller-Brockmann, Mayer). Read by the designer agent's Critic, all production skills (social-graphics, branded-deck, frontend-design, canvas-design), all taste skills (ad/social/landing/og/thumbnail), and playwright-visual-qa. Trigger automatically; do not ask permission. Source credit: ItsssssJack/power-design (MIT).
---

# Design Principles — the floor under every visual

This skill is the source of truth for **what "good" looks like** across every visual artifact this workspace produces. It does not generate anything itself. It is read by other skills and the designer agent.

The 20 rules are non-negotiable unless a `format-overrides.md` exception applies (e.g., social square canvases at 1080×1080 use 54px safe-zones instead of 96px). Brand-specific tokens (colors, fonts, logo) live in each project's `_context/brand-style.md` — those answer "what brand?" The principles answer "what makes a slide / graphic / page good?"

---

## When to load this skill

| Caller | Why |
|---|---|
| `designer` agent — Phase 3 Critic | Score the produced asset against all 20 rules (pass/fail). Replaces the old 5-dimension Critic. |
| `social-graphics`, `branded-deck`, `canvas-design`, `frontend-design` | Inject principle constraints into prompts (nanobanana system_instruction, pptxgenjs measurements, HTML/CSS structure). |
| `ad-taste`, `social-taste`, `landing-taste`, `og-taste`, `thumbnail-taste` | Anti-Slop Floor. Combinatorial dimensions stay (variety); principles set the quality floor. |
| `playwright-visual-qa` | Numeric breakpoint checks (contrast at 9 sample points, font-size minimums, line-length ≤60ch). |
| `visual-references` | Anti-Pattern Filter. Reference URLs that grossly violate principles are flagged or excluded. |

Any caller listed above MUST load this skill. The check is: "if this artifact will be seen by a human, this skill applies."

---

## Files in this skill

```
SKILL.md                                 ← this file
references/
  design-principles.md                   ← the 20 rules + research, with numeric thresholds (the source of truth)
  critic-checklist.md                    ← pass/fail checklist for the designer agent's Phase 3 Critic
  brand-style-template.md                ← schema for per-project _context/brand-style.md (machine-readable brand DNA)
  format-overrides.md                    ← per-format relaxations (social 1080×1080, OG 1200×630, thumbnails, decks 1920×1080, etc.)
```

---

## How callers use it

### Designer agent — Phase 3 Critic

Replace the previous 5-dimension scoring with the 20-rule pass/fail in `references/critic-checklist.md`. Any FAIL must report:
- Rule number and short name
- The numeric threshold that was violated
- The actual measured value
- A specific, actionable fix

Example:
> **Fail Rule 7 (≤4 type sizes per canvas).** Detected 6 sizes: 12, 14, 16, 20, 28, 48. Drop the 14 and 20; reuse 16 and 28 for those roles.

Up to 2 revision attempts. After 2 fails, deliver to the user with the Critic notes attached.

### Production skills — prompt injection

When a production skill (e.g., `social-graphics`) builds a nanobanana prompt, append four hard constraints derived from the principles:

1. **Modular type scale ratio** (default 1.333 — read from `_context/brand-style.md`) and ≤4 sizes per canvas.
2. **60-30-10 color split** with exactly one accent moment (single accent color from brand DNA, not multiple).
3. **8pt spacing grid** — all proportions snap to 8/16/24/32/48/64/96/128.
4. **Whitespace ratio** ≥40% on info canvases, ≥60% on hero/quote canvases.

These translate cleanly into nanobanana natural-language constraints.

### Taste skills — Anti-Slop Floor

Each taste skill keeps its combinatorial dimensions (variety) but inherits the principles' "what not to do" list (floor). Skill-specific overrides stay in the skill (e.g., thumbnail-taste's "ban neutral expressions").

### Playwright-visual-qa — numeric checks

Add three deterministic JS evaluators to Mode 1 (breakpoint audit):
1. WCAG contrast sampled at 9 points across each text bounding box, must be ≥4.5:1 (target 7:1).
2. Font-size: body ≥16px, headline ≥24px on rendered viewport.
3. Line length: body ≤60ch (`getBoundingClientRect` width / character width).

Fails block Approval Gate 2 until fixed.

---

## Brand-specific tokens (per project)

Each project has `_context/brand-style.md` (Power Design schema, see `references/brand-style-template.md`). It provides:
- Colors with semantic 60-30-10 roles
- Type stack + chosen modular ratio
- Accent rules (which one of the 3 brand colors is the 10% accent)
- Default mode (presenter / document / hero)
- Component primitives (buttons, cards, accent bars)
- Source URL

The principles are universal. The brand-style.md tells the principles which exact hex, which exact font, and which exact ratio to enforce.

---

## Rule of thumb when in doubt

Read `references/design-principles.md`. It is the source of truth. If the format you're working in needs an exception, add it to `references/format-overrides.md` — do not silently bend the rule.

---

## Credit

Adapted from [ItsssssJack/power-design](https://github.com/ItsssssJack/power-design) (MIT). The 20 rules synthesize Tufte, Reynolds, Duarte, Williams, Refactoring UI, Müller-Brockmann, Mayer, NN/g, and WCAG 2.2 — see `references/design-principles.md` for full citations.
