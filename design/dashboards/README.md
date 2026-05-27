# Sasha Coin — Dashboard Design Briefs

This folder is the pre-build deliverable for three dashboards. It is what a top-tier design studio (think MetaLab, Ueno, Vercel's in-house team) would hand you *before* writing a single line of UI code. The goal is to think through every element — audience, data, hierarchy, aesthetic, components, edge cases — so that implementation becomes a translation job, not a discovery one.

## What's in here

| File | What it contains | Read when |
|---|---|---|
| [00-foundation.md](./00-foundation.md) | Shared design system. Brand thesis, token spec, component inventory, data-viz rules, accessibility commitment. The trunk; the three briefs are the branches. | Read first. Every dashboard inherits from this. |
| [01-mantle-hackathon.md](./01-mantle-hackathon.md) | Mantle Hackathon submission dashboard. Audience: judges + Crypto Twitter. Hero story: the accountability chain (tweet → trade → attestation). | Building the Mantle submission demo. |
| [02-okx-hackathon.md](./02-okx-hackathon.md) | OKX Build X Hackathon submission dashboard. Audience: OKX/X Layer judges. Hero story: first AI agent setting dynamic fees on a real Uniswap v4 hook. | Building the OKX submission demo. |
| [03-lp-miner.md](./03-lp-miner.md) | Internal liquidity miner control panel. Audience: Gabriel + future investors. Hero story: multi-chain LP portfolio with active hedge and rebalance queue. | Building the operational product. |

## The three dashboards are not the same product

Each has a different audience, a different success metric, and a different aesthetic direction. The foundation defines what they share (Sasha's voice in pixels). The briefs define what makes each one specific.

| Dashboard | Audience | Success metric | Aesthetic anchor |
|---|---|---|---|
| Mantle Hackathon | Hackathon judges (60s scan), Crypto Twitter (shareable) | Judge says "this is a real autonomous agent, not a chatbot with a wallet" | The confessional terminal — Bloomberg density, Sasha's voice as the human layer |
| OKX Hackathon | OKX/X Layer judges (technical scan) | Judge verifies the hook + oracle on-chain in under 90 seconds | The trading terminal — minimal, technical, glanceable, mostly black and one accent |
| LP Miner | Gabriel (daily), future investors (occasional) | Gabriel can answer "what's my portfolio doing right now" in 5 seconds | The hedge fund operator's screen — multi-pane density, professional, hierarchical |

## The process this followed

Pre-build deliverables in real agency work cover 14 things. Each brief includes all 14, in this order:

1. Executive summary
2. Audience & stakeholder map
3. Jobs-to-be-done
4. Competitive teardown
5. Data audit
6. Information architecture
7. User flows
8. Content strategy & microcopy
9. Aesthetic direction (3 options, one recommended)
10. Design tokens
11. Component inventory
12. Data visualization spec
13. Screen specs (low-fi)
14. Engineering handoff

Implementation is not in scope here. When you are ready to build, the brief is the source of truth — the Storybook, the Tailwind config, the component code, all answer to it.

## What's deliberately not in here yet

- **High-fidelity mocks (Figma equivalent).** Until you pick an aesthetic direction per dashboard, mocks would be premature. Each brief presents three named directions; once you pick, the next step is annotated hi-fi screens.
- **Live data wiring.** The data audit per brief tells engineering exactly what to wire. Wiring is a build step, not a design step.
- **Animation prototypes.** Motion tokens are specified. Prototypes happen after aesthetic direction is locked.

## How to read these documents

If you have 15 minutes: read the executive summary of each brief, plus the foundation's "brand thesis" and "color system" sections.

If you have an hour: read the foundation in full, then read the brief for whichever dashboard ships first.

If you are about to build: read the foundation, then read the brief end to end, then start with section 11 (component inventory) and 13 (screen specs).

---

*Authored as a pre-build deliverable. Every section is meant to survive contact with engineering — if anything reads vague or unactionable, flag it and it gets sharpened, not deleted.*
