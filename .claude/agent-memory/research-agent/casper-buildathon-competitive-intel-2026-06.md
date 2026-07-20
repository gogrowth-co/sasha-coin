---
name: casper-buildathon-competitive-intel-2026-06
description: Casper Agentic Buildathon 2026 competitive field snapshot — competitor strengths, CSPR.fans vote path confirmed, qualification rules verified
metadata:
  type: project
---

# Casper Agentic Buildathon 2026 — Competitive Intel (June 26, 2026)

**Why:** Audit run 4 days before June 30 deadline to calibrate competitive position and surface top-leverage actions.

## Key facts verified from live pages

- **Total BUIDLs:** 63 submitted. 390 registered hackers.
- **Deadline confirmed:** June 30, 2026 21:00 UTC (DoraHacks shows "20:00" on detail page — treat as UTC).
- **Prize structure:** $150K total ($30K cash, $100K x402 credits, $20K in-kind).
- **CSPR.fans vote path: CONFIRMED REAL.** Top 3 community-voted projects on CSPR.fans advance directly to Final Round WITHOUT additional judging. All others must meet prototype eligibility to advance and face full jury evaluation. CSPR.fans login requires Telegram + CSPR.click — not open web voting.
- **Qualification bar (prototype path):** Working prototype on Casper Testnet with transaction-producing on-chain component + open-source GitHub + demo video.

## sasha-x402-kit (BUIDL 45337) status as of June 26

- **Upvotes:** 1 (Gabriel's own)
- **Followers:** not shown separately from upvoters tab
- **Demo video:** LIVE on YouTube — youtu.be/z3LX7MbsC5o — embedded and showing on DoraHacks page. YouTube shows 1 subscriber.
- **GitHub link:** LIVE — github.com/gogrowth-co/sasha-x402-kit
- **Casper dashboard link:** LIVE — sasha-dashboards.pages.dev/casper
- **Updated:** 9 days ago (June 17)
- **CI badge:** present (secret-scan.yml) — green at time of publish

## GitHub repo status

- Stars: 0, Forks: 0, Watchers: 0
- Last commit: June 10, 2026 (CI badge fix after repo move) — 16 days stale
- 10 total commits. 2 contributors (gabriel-opascope + claude bot).
- Stack: Go 66.5% / Rust 24.4% / Shell 9.1%
- README: polished, visual, hero banner, architecture diagram, live tx proof table, honest shipped/roadmap table
- CI: gitleaks full-history secret scan + go build/vet on every push

## Top competitors

### CasperFlow (BUIDL 45588) — HIGHEST THREAT
- No-code visual agent builder (n8n-style) for Casper. Compose agents with drag/drop.
- Updated 2 DAYS AGO — most recently active BUIDL in the field.
- Ships: x402 PAY (live end-to-end), x402 EARN (live), EIP-712 attestation anchored on-chain, CSPR real transfers headless, Telegram alerts, MCP server on npm (`casperflow-mcp`), treasury guardian demo with guardrails.
- Roadmap in next 10 days: x402 conditional escrow Odra contract, live two-agent marketplace, hosted runner.
- Demo: youtu.be/hexnF7Gd9lw + youtu.be/qeYvUQhODN0
- Assessment: broadest surface area, platform framing ("not one use case"), recently updated. Likely top jury pick.

### Vouch (BUIDL 45565) — STRONG THREAT
- 2-person team (zhang + daniel_web3). **2 upvotes** — highest confirmed vote count visible.
- Ships: Rust/Odra TrustRegistry + EscrowPoc + RwaOracle + CEP-18 token — 4 contracts deployed. Multi-agent adversarial verifier network (3 LLMs with different personas re-fetch evidence, vote on-chain). Proved honest vs malicious claim scenarios in 2 live runs.
- Live dApp on Vercel (vouch-agent.vercel.app). Updated 7 days ago.
- Assessment: strongest trust/reputation angle, most contracts deployed, live dApp = best UX score.

### Custodian (BUIDL 45659) — STRONG THREAT
- Single dev. Ships 25 real transactions in one autonomous run: 14 x402 data payments + 11 contract calls.
- RWA use case (coffee shipment, Santos→Rotterdam). MCP server (15 tools) + Agent Skill (SKILL.md operating procedure). Self-hosted x402 facilitator (no third-party dependency). Gemini reasoning.
- Ships: full lifecycle settlement, pro-rata payout, cold-chain breach detection, customs clearance — all autonomous.
- Updated 5 days ago. Assessment: most impressive transaction density, strong RWA/DeFi criterion score.

### VeriFeed (BUIDL 45472) — MODERATE THREAT / DIRECT THESIS OVERLAP
- **4 upvotes, 4 followers** — highest confirmed vote and follow count in the visible field. This is the vote leader.
- Thin scope: x402 settlement + verifiable receipt primitive, Odra contract, MCP server, Cloudflare Worker backend.
- Direct overlap with sasha-x402-kit's ATTEST leg but narrower (receipt primitive only, no real book behind it).
- Assessment: Most popular on votes. Jury score probably lower (simpler build) but community path threat is real.

### AgentPay (BUIDL 45456) — MODERATE THREAT
- x402 micropayment marketplace: 2 Odra contracts (escrow + service registry), Next.js dashboard, 4 Prisma data models, 15+ API endpoints. Ed25519 signing.
- Roadmap items are still unfinished (mock txHash replacement, full signing flow noted as "to do" in roadmap).
- Updated 8 days ago. Assessment: impressive surface area but honest roadmap signals partial completion.

## CSPR.fans vote path details

- Mechanism CONFIRMED REAL: top 3 CSPR.fans votes → directly to Final Round without judging.
- Login requires Telegram auth + CSPR.click wallet. Not an open web vote — requires crypto wallet holder.
- VeriFeed is current visible vote leader (4 upvotes on DoraHacks, proxy for engagement). True CSPR.fans vote counts are behind the app login.
- sasha-x402-kit: 1 DoraHacks upvote. No CSPR.fans vote campaign run.

## How to apply this intelligence

- Path B (jury) is the realistic path — sasha-x402-kit will not win the community vote without a targeted campaign.
- Jury differentiator: the "real book" angle (Sasha runs a live LP position and attests it) is unique in the field. No other BUIDL has a real production agent behind it.
- Jury weakness: 0 GitHub stars, stale since June 10, 1 DoraHacks upvote signals low community signal to judges browsing.
- Single highest-leverage action before deadline: push at least one meaningful commit to GitHub to update the "last commit" timestamp (shows active development), and run at least one fresh ATTEST transaction to show the loop is still live.
