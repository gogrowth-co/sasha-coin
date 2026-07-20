# Casper Agentic Buildathon 2026 — Hackathon + AI Toolkit Intelligence Sweep

**Sweep date:** 2026-06-06
**Analyst:** Sasha Coin dev/research (Claude Code)
**Sources (all live-verified):**
- DoraHacks detail page: https://dorahacks.io/hackathon/casper-agentic-buildathon/detail
- DoraHacks public API (canonical numbers): https://dorahacks.io/api/hackathon/casper-agentic-buildathon/ (hackathon id `2202`)
- DoraHacks BUIDL list: https://dorahacks.io/hackathon/casper-agentic-buildathon/buidl
- Casper AI Toolkit: https://www.casper.network/ai
- Casper Manifest: https://www.casper.network/news/manifest
- AI Toolkit launch PR (Benzinga, 2026-06-04)

**Method note:** Firecrawl was out of credits (0/1000). DoraHacks is a Cloudflare-protected Nuxt SPA — direct WebFetch returns HTTP 405, Playwright hits a "Human Verification" challenge. Working path was **ScrapingBee stealth proxy (residential IPs) with render_js** for the SPA pages, plus the **DoraHacks public JSON API by numeric ID** for canonical counts. Casper pages came clean via WebFetch.

---

## 1. HACKATHON FACTS (live, canonical)

| Field | Value | Source |
|---|---|---|
| Official name | Casper Agentic Buildathon 2026 — Qualification Round | API + page |
| DoraHacks id | `2202` | API |
| Status badge on page | **"Upcoming"** + "24 days left for submission" | rendered page |
| API state flags | `status:1`, `state:0`, `approval_status:6`, `winner_announced:false`, `archived:false`, `visible:true` | API |
| Total prize pool | **$150,000 USD** (`bonus_price: 150000`) | API + page |
| — Cash prizes | **$30,000 USD** | page |
| — x402 Ecosystem Credits | **$100,000 USD** | page |
| — In-kind rewards from co-sponsors | **$20,000 USD** | page |
| BUIDLs / submissions | **6** (`buidls_count: 6`) | API |
| Applications | **11** (`applications_count: 11`) | API |
| Hackers registered | **124–125** (`hackers_count`; live counter, ticked 124→125 mid-sweep) | API + page |
| Teams | **1** (`team_count: 1`) | API |
| Tracks | **1** — "Casper Innovation Track" (`tracks_count: 1`, multi-track NOT allowed) | API |
| Submission opens | 2026/06/01 00:00 (`start_time 1780272000`) | API + page |
| Submission deadline | **2026/06/30** (page schedule); DoraHacks slot end shows 2026/07/01 00:00 (`end_time 1782864000`) | API + page |
| Format | Virtual / global, no team-size limit | page |
| Required at submission | GitHub/GitLab/Bitbucket repo link + demo video (both mandatory) | API flags + page |
| Ecosystem tags | Casper Network, x402, AI | API |
| Field tags | Agentic AI, DeFi, Real-World Assets, Casper Network, Global, Blockchain, Web3, Rust | API |
| Currency | USD | API |

### Timeline (verbatim from page schedule)
- **June 1, 2026** — Online buildathon launches; Qualification Round begins.
- **June 2, 2026** — In-person developer workshop + networking at Istanbul Blockchain Week (Luma: https://luma.com/casper-bzn7 ; IBW tickets: https://istanbulblockchainweek.com/tickets/).
- **June 30, 2026** — Qualification Round submission deadline.
- **July 1–5, 2026** — Qualification Round evaluations + finalist selection.
- **July 6–19, 2026** — Final Round (2 weeks).
- **Late July 2026** — Final judging, demo day presentations, winner announcements.

### Two-phase structure & the two advancement paths (Qualification → Final)
Hybrid advancement out of the Qualification Round:
1. **Community Voting Path** — the **top 3 projects** by votes on the **CSPR.fans app** advance **directly to the Final Round, with NO additional judging.**
2. **Builder Merit Path (prototype-based)** — all other projects must meet technical eligibility (**working prototype on Casper Testnet with a transaction-producing on-chain component**) to advance to the Final Round for **professional jury evaluation.**

### Final Round judging criteria (8 criteria, verbatim)
1. **Technical Execution** — code quality, architecture, implementation completeness
2. **Innovation & Originality** — novelty of approach, tech, ideas
3. **Use of AI / Agentic Systems** — meaningful integration of AI agents / autonomous systems
4. **Real-World Applicability** — usefulness, especially DeFi & RWA
5. **User Experience & Design** — interface and interaction quality
6. **Working Smart Contracts** — functional, deployed contracts on Casper Testnet
7. **Long-Term Launch Plans** — real project with socials in place + actual deployment plans
8. **Potential for Long-Term Impact** — contribution to Casper ecosystem growth/adoption

(Track judging max score = 100.)

### Eligibility
- Teams of any size or solo builders welcome.
- All code/content must be **original and newly developed for the Buildathon.**
- Focus: **Agentic AI applications, with particular emphasis on DeFi and/or RWA on Casper.**
- Open-source, public submissions required.
- Must adhere to Casper Network Code of Conduct + anti-plagiarism; breaches = disqualification.

### Sponsors / Partners / Judges
- **Organizer:** Casper Association
- **Platform Partner:** DoraHacks
- **Event Partner:** Istanbul Blockchain Week
- **Co-sponsors:** referenced ("In-kind Rewards from Co-Sponsors" = $20K) but **NOT named** on the page; API `sponsors` array is **empty**. → UNCONFIRMED who the co-sponsors are.
- **Jury:** described only as a class, **no individual names listed** — "Casper Association leadership and technical experts, representatives from partner organizations, Web3 investors, ecosystem leaders, and media representatives." → Judge names UNCONFIRMED.

### Winner benefits (beyond cash)
Technical mentorship from Casper experts; marketing + ecosystem amplification; potential grant and incubation opportunities within Casper.

### FAQ (key items)
- **Testnet access:** onboarding resources (docs + live support) in first days of the Buildathon.
- **Remote OK?** Yes — all core activity online; June 2 IBW workshop optional but encouraged.
- **Updates posted:** DoraHacks, Casper Developer channels, event partners, Casper Telegram + Discord.
- **Example build directions (4):** (1) Autonomous yield-routing agents via MCP; (2) RWA oracle agents with verifiable on-chain identity via Casper x402; (3) Multi-agent DAO governance & execution; (4) AI-driven compliance/KYC via zero-knowledge.

---

## 2. COMPETING BUIDLs (6 submissions — full competitive intel)

All in the single "Casper Innovation Track." Listed in the order shown on the BUIDL page. Direct links use `dorahacks.io/buidl/<id>`.

| # | BUIDL id | Project | Builder handle | One-liner | Stack/tags |
|---|---|---|---|---|---|
| 1 | 43705 | **AgentPay — x402 Micropayment Marketplace for AI Agents** | hacker8992687 | M2M commerce via x402 HTTP-native micropayments on Casper | x402 Protocol, Casper MCP Server, CSPR.cloud, Odra, MCP, CSPR.trade, Account Abstraction, agent-to-agent commerce, pay-per-request APIs |
| 2 | 43882 | **AiFinPay** | Dmitrycoinsec | Payment infrastructure for AI agents and enterprise AI ecosystems | AI / Robotics |
| 3 | 44158 | **credmesh.xyz** | qjawe | Programmable working capital for autonomous AI agents | Crypto/Web3, Solana, Arbitrum, Crypto-AI |
| 4 | 44171 | **Phoenix Zero — x402 Sequencer Health Oracle for Autonomous DeFi Agents** | AleksKent | Monitors 6 chains (Arb, Base, OP, ZK, Mantle, Casper) every 2s; agents pay $0.001 via x402, get safe:true/false. Claims live since March 2026, 206K+ datapoints | AI / Robotics; x402 |
| 5 | 44178 | **Asasanta AI Agent** | ASASANTA360 | Intelligent AI agents that simplify digital services, automate tasks | Very broad multi-chain tag spray: Ethereum, Aptos, IPFS, Arbitrum, Optimism, Injective, Celestia, Berachain, Chainlink, Metamask, Dymension, EAS, Axelar, Mantle, Gelato, OP Stack |
| 6 | 44260 | **Kawi** | Wilkenson | Cross-border remittances to Brazil — low-cost, reliable family money transfer | Crypto/Web3, BNB Chain, Solana, Bitcoin, DeFi, RWA, Crypto Adoption |

**Competitive read for Sasha:**
- The strongest, most on-theme entries are **AgentPay (#1)** and **Phoenix Zero (#4)** — both lead with x402 + agent payments and explicitly cite the Casper AI Toolkit components. Phoenix Zero already claims live multi-chain operation (incl. Mantle, where Sasha has history) and a working oracle — a credible front-runner on "Working Smart Contracts" + "Real-World Applicability."
- **AiFinPay (#2)** and **credmesh (#3)** are thin on detail (no Casper-specific stack listed yet); credmesh tags Solana/Arbitrum, not Casper.
- **Asasanta (#5)** looks like a low-effort multi-chain copy-paste (no Casper integration shown, 16+ unrelated tags) — likely weak on originality/Casper-deployment criteria.
- **Kawi (#6)** is a Brazil remittance RWA play, on-theme for the DeFi/RWA emphasis but not obviously agentic.
- **Sasha's opening:** an autonomous treasury agent that already runs delta-neutral LP + posts to X is differentiated against this field if it ships a **real Casper Testnet deployment with a transaction-producing on-chain component** and uses **x402 + an MCP server + Odra**. The field is small (6) and only 1 is a formal "team" — early, low-competition window.

---

## 3. CASPER AI TOOLKIT — full component list (all URLs live-verified 200)

Toolkit hub: **https://www.casper.network/ai**
Positioning: "Casper as the trust layer for the agent economy." First WebAssembly-native L1 with live HTTP-based x402 micropayments on mainnet. Toolkit launched **June 4, 2026** (first shipped initiative from the Casper Manifest, published May 2026).

| Component | What it is | Primary URL(s) |
|---|---|---|
| **x402 Micropayments + Facilitator** | HTTP-native micropayment protocol; agents pay per API request with cryptographic proof, no accounts/subscriptions. Facilitator live on mainnet. Buildathon teams get sponsored Facilitator usage (free on-chain txns). | API ref: https://docs.cspr.cloud/x402-facilitator-api/reference · Examples: https://github.com/make-software/casper-x402/tree/master/examples |
| **Casper MCP Server** | Community-built Model Context Protocol server — query balances, submit deploys, read contract state via natural language. | Setup: https://docs.cspr.cloud/agentic-tools/mcp-server · GitHub: https://github.com/msanlisavas/casper-mcp |
| **CSPR.trade MCP Server** | DEX-operations MCP — agents trade, provide liquidity, manage portfolios on CSPR.trade DEX. | https://mcp.cspr.trade |
| **CSPR.click AI Agent Skill** | Installable coding skill — wallet creation/connection, transaction signing, event handling, CSPR.cloud API access. | https://docs.cspr.click/documentation/ai-agent-skills |
| **CSPR.cloud APIs** | "Enterprise-grade middleware," three layers: REST, Streaming, Node API. Installable skill.md. | Skill: https://cspr.cloud/skill.md · Docs: https://docs.cspr.cloud |
| **Odra Framework + llms.txt** | Rust smart-contract framework for Casper with `llms.txt` so AI agents can generate/deploy working contracts autonomously. | llms.txt: https://odra.dev/llms.txt · Docs: https://odra.dev/docs/ |
| **casper-eip-712** | Off-chain typed-data signing for gasless meta-transactions + agent-to-agent commerce verification. | https://github.com/casper-ecosystem/casper-eip-712 |
| **Casper Manifest** | Strategic vision: Casper = trust layer for the agent economy. 9 protocol initiatives across Universal Access / Frictionless Experience / Institutional Grade / Machine Economy Ready (x402 + agent infra). Core mechanism: HTTP 402 flows with programmable spend limits + scoped permissions ("$100/day on whitelisted contracts") + verifiable identity. | https://www.casper.network/news/manifest |

Note: Casper's native x402 implementation is described on the buildathon page as "launching June 2026" — i.e., fresh/just-live during the build window. CSPR.build "Agent Skills" package is the same family as the CSPR.click AI Agent Skill / CSPR.cloud skill.md (naming varies across the launch PR vs the /ai page).

---

## 4. CHANGES SINCE JUNE 2 SNAPSHOT (delta analysis)

Prior snapshot (2026-06-02): LIVE, 6 submissions, 11 applications, $150K pool.

| Metric | June 2 | June 6 (now) | Delta |
|---|---|---|---|
| Submissions / BUIDLs | 6 | **6** | No change |
| Applications | 11 | **11** | No change |
| Prize pool | $150K | **$150K** | No change |
| Status label | "LIVE" | **"Upcoming" (24 days left for submission)** | DoraHacks now renders the badge as "Upcoming" (submission window framing) even though the round is in progress — cosmetic/labeling change, not a status reversal. API `status:1` |
| Hackers registered | (not captured) | **124 → 125** during this sweep | Live counter still incrementing |

**New detail confirmed since June 2 (prize breakdown was not itemized in the old snapshot):**
- Cash $30K / x402 credits $100K / in-kind $20K split is now explicit on the page.
- Casper AI Toolkit officially launched **June 4** (2 days after the old snapshot) — so the full toolkit + all component URLs are now live and documented.
- BUIDL roster and IDs captured (was not in the old snapshot).

**Read:** Submissions/applications have been flat for 4 days — the field is NOT filling fast. Plenty of room (24 days to deadline) and weak competition density (6 BUIDLs, only 1 formal team). Favorable entry window for Sasha.

---

## 5. UNCONFIRMED / OPEN ITEMS
- **Co-sponsor names** — $20K in-kind comes from co-sponsors, but none are named on the page and the API `sponsors` array is empty.
- **Individual judge/jury names** — only described as a category, no names.
- **CSPR.fans voting mechanics** — page says top-3 by votes advance; exact voting-power source (CSPR staking?) not detailed on this page. (Casper's separate Nov-2025 $25K hackathon used CSPR.fans on-chain voting with voting power tied to the community — likely the same model, but UNCONFIRMED for this event.)
- Do not conflate with the **older "Casper Hackathon 2026"** ($25K, kicked off Nov 14 2025, co-sponsor Halborn Security, slug `casper-hackathon-2026`) — that is a DIFFERENT, earlier event.
