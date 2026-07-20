---
name: sasha-x402-kit-readme-conventions
description: Rules for writing and updating the public sasha-x402-kit GitHub README for hackathon judges and crypto/DeFi developers
metadata:
  type: project
---

This repo is the Casper Agentic Buildathon 2026 entry. The README is public and judged.

**Rules that must hold on every update:**
- Voice is third-person project documentation, NOT Sasha's first-person tweet voice. "The agent" not "I".
- Preserve all tx hashes verbatim. Never paraphrase or truncate them beyond the existing `…` ellipsis format.
- SHIPPED = PAY + ATTEST live on casper-test. ROADMAP = ACT, EXPOSE, EVM proof adapter. Never flip these categories without a real deploy.
- The AgentAttest contract is clean-room original. Upstreams (odradev/casper-x402-poc, make-software/casper-x402) are Apache-2.0 dependencies, not vendored. This distinction must stay in the README.
- The "Live on casper-test" proof table is the strongest credibility signal. Keep it near the top.
- No em dashes. No banned vocab (revolutionary, game-changing, etc.). Hemingway Grade 9 or below.
- Image paths: `assets/sasha-hero.png` (hero, top of file) and `assets/agent-loop.png` (architecture section).

**Why:** Judges verify claims. Any overclaim or factual drift in a judged public repo is a credibility failure, not a style issue.

**How to apply:** Before any README edit, re-read the current tx hashes and status table in the file. Treat them as immutable facts. Only update when a new deploy is confirmed on-chain.
