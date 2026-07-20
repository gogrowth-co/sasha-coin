---
name: 21st-components
description: Use as a reference/starting-point engine when building any frontend UI, landing page, dashboard, or component from scratch — before hand-rolling a pricing table, hero, nav, form, pattern, or other common UI block. Search the 21st.dev component registry (via MCP or CLI) for a real, production-quality reference implementation, adapt it to brand tokens and voice, never ship it unmodified. Triggers: "build a landing page", "build a dashboard", "design a component", "I need a pricing table / hero / nav / pattern", "find a reference for this UI", "what does a good [X] component look like". Not for content-only tasks (copywriting, carousels, social graphics) — those stay on content-writer/designer's other skills.
---

Reference-engine, not a page builder. 21st.dev is a community registry of React/Tailwind/shadcn components. Use it to skip blank-page syndrome and see how a well-built version of a UI pattern is structured — then adapt, never paste verbatim into a brand surface without passing it through this workspace's design floor.

## When to reach for this

Any time a task calls for building a UI pattern that's been solved a thousand times before: pricing tables, hero sections, nav bars, pricing/feature comparison grids, testimonial walls, forms, dashboards, cards, modals, empty states, onboarding flows. Search first, then adapt — don't invent a bespoke structure for a solved problem, and don't ship the registry result unmodified either.

## Access paths (both wired, prefer MCP inside Claude Code)

**MCP server** (`21st`, registered at user scope in `~/.claude.json`, connects to `https://21st.dev/api/mcp`): use the MCP tools directly if surfaced via ToolSearch — search by query, fetch component code and metadata.

**CLI** (`@21st-dev/cli`, installed globally as `21st`): use from Bash for scripted lookups.
```bash
21st search "pricing table"                 # search the registry
21st add shadcn/button                       # install a shadcn primitive into the current project
21st get <id>                                 # fetch full component code + metadata for a search result
21st publish ./Component.tsx --description "…"  # publish a workspace-built component back to the registry
21st edit <slug> --type component --visibility public
21st delete <slug> --type component --yes
```
API key: `API_KEY_21ST` in `marketing/.env` (canonical; propagates via `sync-env.mjs`). Pass explicitly when the CLI doesn't pick up the env var: `21st search "..." --api-key "$API_KEY_21ST"`. Never print the key value — presence/length only, per the global secrets rule.

## Workflow

1. **Search before building.** `21st search "<pattern>"` — pull 3-5 candidates, not just the first hit.
2. **Fetch the strongest match's code** (`21st get <id>` or the MCP get-component-code tool) to see real structure: component composition, state handling, responsive behavior, accessibility patterns.
3. **Adapt, don't paste.** Rewrite copy, colors, spacing, and tokens to match this workspace's brand (`_context/brand-style.md`, `_context/style-guide.md`) or the active project's own `_context/`. Run the result through `design-principles` (the 20-rule anti-slop floor) and, for landing pages specifically, `landing-taste` before calling it done.
4. **Framework fit check.** 21st components are React/Tailwind/shadcn-first. If the target surface isn't React (e.g. plain HTML/CSS for a static landing page, or Remotion for video), port the *pattern* (layout, hierarchy, interaction model), not the JSX verbatim.
5. **Publishing back.** Only publish a workspace-built component to the public registry (`21st publish`) on explicit instruction — this is an outward-facing action.

## Division of labor

- `designer` agent: primary owner. Reaches for this skill during `frontend-design`, `landing-taste`, `dashboard-design`, or `mangaos-design` work whenever the deliverable includes a solved-pattern UI block.
- `marketing-systems-engineer` agent: uses this for Mission Control / internal tool UI (task boards, dashboards, admin panels) where the deliverable is functional product UI, not brand content.
- Not for `content-writer` — copy-only deliverables don't need a component registry.
