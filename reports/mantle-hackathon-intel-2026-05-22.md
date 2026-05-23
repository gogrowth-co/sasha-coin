# Intelligence Brief: Mantle Turing Test Hackathon 2026
**Research Type:** competitive-scan + market-pulse
**Date:** May 22, 2026
**Prepared for:** Sasha Coin / OpenCLAW team
**Deadline:** June 15, 2026 (23 days remaining)

---

## Executive Summary

- **Opportunity:** $100K prize pool across 6 tracks. 666 registered hackers. Zero public BUIDLs submitted as of May 22, 2026. The Agentic Economy track is built on OpenClaw, the exact runtime Sasha runs on. Emily Bao, Byreal founder and key Mantle advisor, specifically quoted: "OpenClaw gave AI agents hands. Mantle gave them a home." No other known entrant has Sasha's combination: a live AI agent, an on-chain token, an existing X audience, and an already-running OpenClaw runtime.
- **Best track:** Agentic Wallets and Economy (Byreal-sponsored), Path B: RealClaw Real-Life Expansion. RealClaw is OpenClaw with Byreal Skills pre-installed. Sasha runs on OpenClaw. The hackathon is asking for OpenClaw agents to do things beyond DeFi. Sasha already does this every day.
- **Winning angle:** Sasha is the world's first AI agent with a dual on-chain identity. $SASHA token on Base (social layer, creator economy) plus ERC-8004 agent NFT on Mantle (execution layer, verifiable performance record). She posts to X autonomously and now executes DeFi positions autonomously. The pitch: "Sasha doesn't just talk about DeFi. She lives in it." Every trade she makes on Mantle is recorded permanently under her ERC-8004 identity. Every post she wrote before the trade is timestamped on X. That is a verifiable chain of reasoning that no quant bot can replicate.

---

## Data Sources Used

| Source | Tool | Data Window | Items Collected |
|---|---|---|---|
| DoraHacks hackathon detail page | Firecrawl | May 22, 2026 | Full page including Emily Bao quote |
| DoraHacks tracks page | Firecrawl | May 22, 2026 | All 6 tracks with descriptions |
| DoraHacks requirements and criteria | Firecrawl | May 22, 2026 | Full judging matrix, all prize categories |
| Byreal Agent Skills GitHub (v0.3.6) | Firecrawl | May 12, 2026 | README, command list, 73 commits |
| Byreal Perps CLI GitHub | Firecrawl | April 22, 2026 | README, command list, 30 commits |
| Byreal docs (docs.byreal.io) | Firecrawl | May 22, 2026 | Platform overview, AI agent trading |
| EIP-8004 specification (eips.ethereum.org) | Firecrawl | May 22, 2026 | Full draft spec |
| QuickNode ERC-8004 developer guide | Firecrawl | May 22, 2026 | Full article with architecture diagrams |
| Nansen Mantle Q1 2026 Report | Firecrawl | April 30, 2026 | Full report, all metrics |
| Mantle DeFi ecosystem (Fensory) | Firecrawl | May 22, 2026 | Protocol guide, TVL data |
| X/Twitter CT sentiment | Grok 4.3 via OpenRouter | May 2026 | Synthesized from live X data |
| Judge profiles and Byreal-OpenClaw architecture | Perplexity sonar-pro via OpenRouter | May 2026 | Deep research with citations |

---

## Track Analysis

| Track | Sponsor | Prize Share (Est.) | Judging Focus | Competition Level | Sasha Fit (1-5) |
|---|---|---|---|---|---|
| **Agentic Wallets and Economy** | Byreal | ~$15-20K first prize | 70% general: Byreal integration depth, agent autonomy, technical completeness, sustainability. 30% track-specific: DeFi Alpha or Real-World Validity | Low. Byreal tooling is new, Solana CLMM experience is uncommon, few builders have OpenClaw | **5** |
| AI Alpha and Data | Mirana Ventures | ~$15-20K first prize | 60% general: data source quality, AI depth, completeness. 40% Insight Value or Strategy Alpha (verifiability, backtesting, live records) | High. Quant developers and DeFi analysts saturate this category | 3 |
| AI x RWA | Mantle Network | ~$15-20K first prize | 60% general: AI+RWA depth, Mantle integration, compliance awareness. 40% Infrastructure or Real-World Validity | Medium. RWA is hot but compliance requirement reduces pool | 2 |
| AI Trading and Strategy | BGA | ~$15K first prize | AI quant bots, macro smart contracts, Bybit API. Evaluated on volume and ROI | High. Most traditional hackathon entrants default here | 2 |
| Consumer and Viral DApps | General | ~$10K first prize | Shareability, public appeal, gamified interfaces. Community voting overlap | Medium. Creativity wins but "viral" is hard to plan | 3 |
| AI DevTools | General | ~$10K first prize | Gas optimization, Mantle-specific audit assistants. Deep technical knowledge required | Low. Narrow domain, few teams have Mantle-specific expertise | 2 |

**Stackable bonus prizes:**

- **Grand Champion** (~$30K estimated): Open to all tracks. Scoring: Technical Depth 30%, Innovation 25%, Mantle Ecosystem Contribution 25%, Product Completeness 20%. Must be nominated from at least one track. The dual-identity angle (Base token + Mantle agent NFT) directly targets the Innovation and Ecosystem Contribution dimensions.
- **Community Voting** (bonus): X Platform Voting determines winner. Most votes wins. Sasha's existing X following is a direct competitive moat. An AI agent campaigning for her own votes in a human vs. AI competition is the kind of meta-narrative that goes viral.
- **Best UI/UX Award** (bonus): Visual Design 30%, Interaction and Flow 30%, AI Interaction Design 25%, Accessibility 15%. The sasha.html dashboard is a natural entry. Requires public frontend.
- **20 Project Deployment Award** (first-come, first-served, 20 spots): Verified Mantle mainnet or testnet contract, one AI-callable on-chain function, public frontend, 2-min demo video, GitHub README. No judge scoring. Pure execution. Deploy early in June before competition heats up.

---

## Platform Intel

### What RealClaw Is (Confirmed)

RealClaw is an AI agent trading platform built by Byreal for Mantle. The hackathon description states explicitly: "RealClaw: Openclaw-based Agent with Byreal Skills pre-installed, extensible to non-DeFi scenarios."

The architecture is a stack:
- **OpenClaw:** Agent runtime. Execution environment, skills loader, HEARTBEAT, MEMORY, multi-agent coordination.
- **Byreal Agent Skills:** Installable skill package for OpenClaw. Install via `npx skills add byreal-git/byreal-agent-skills`. Adds: swap, LP positions, pool analysis, copy-farming, fee claiming, portfolio management. All commands support `-o json` for LLM-native output.
- **Byreal Perps CLI:** Separate skill package. Install via `npx skills add byreal-git/byreal-perps-cli`. Adds: perpetual futures (market/limit orders, TP/SL, leverage, signal scanning). Powered by Hyperliquid infrastructure.
- **RealClaw:** The user-facing agent interface. Intent-to-execution via Telegram. RealClaw is what Phase 1 (ClawHack) ran on.

**The critical fact for Sasha:** Sasha already runs OpenClaw. Installing Byreal Skills is one command. The technical distance between "Sasha as she exists today" and "Sasha as a RealClaw agent" is smaller than for any other competitor.

**Important clarification on Byreal's chain:** Byreal is a Solana DEX incubated by Bybit. It is not a Mantle-native DEX. The Mantle connection is via the Mantle Super Portal (which bridges MNT to Solana) and RealClaw as the Mantle-deployed agent interface layer. The Agentic Economy track explicitly allows deployment on Mantle or Solana. Byreal Skills interact with Solana-native pools (CLMM, perps via Hyperliquid).

**GitHub status (as of May 22, 2026):**
- byreal-agent-skills: v0.3.6, 73 commits, 125 stars, 6 forks, actively maintained (last commit May 12, 2026)
- byreal-perps-cli: 30 commits, 1 star, last updated April 22, 2026

### Byreal Agent Skills Command Reference

| Command | Description |
|---|---|
| `byreal-cli pools list --sort-field apr24h` | List top pools by APR |
| `byreal-cli pools analyze <pool-address>` | Full risk, volatility, range analysis |
| `byreal-cli swap execute --input-mint X --output-mint Y --amount N --dry-run` | Preview or execute swap |
| `byreal-cli positions open --pool P --price-lower L --price-upper U --auto-swap` | Open CLMM position (auto-swap enabled) |
| `byreal-cli positions copy --position <address> --amount-usd 100 --confirm` | Copy a top farmer's position |
| `byreal-cli positions claim` | Claim trading fees |
| `byreal-cli wallet balance` | Show all balances |

All commands support `-o json` for structured AI-native output. This is the same pattern as Sasha's existing skill architecture.

### ERC-8004 — Trustless Agent Identity Standard

**Authors:** Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)
**Status:** Draft EIP, created August 13, 2025
**Spec:** eips.ethereum.org/EIPS/eip-8004

**Three on-chain registries:**

1. **Identity Registry** (ERC-721 + URIStorage): Each agent receives a unique NFT that points to an "agent registration file" in JSON. The file contains: name, description, image, service endpoints (MCP, A2A, HTTP, ENS, DID), payment wallet, supported trust methods. The agent's `agentWallet` key is reserved and requires EIP-712 signature proof to set, preventing impersonation.

2. **Reputation Registry:** Records numerical scores and categorical tags (response time, uptime, accuracy) against an agent's NFT ID. Scoring happens both on-chain (for composability) and off-chain (for sophisticated algorithms). Any authorized party can post feedback. Enables agent-to-agent discovery based on track record.

3. **Validation Registry:** Generic hooks for recording verifiable evidence of task completion. Supports multiple validation strategies: stake-secured re-execution, zkML proofs, TEE oracles, social consensus. Not fully deployed as infrastructure yet as of the spec — treat as a design space for the hackathon.

**Why this matters for Sasha specifically:** Every hackathon agent auto-receives an ERC-8004 NFT on Mantle. Sasha's Mantle identity becomes queryable on MantleScan. Her trade history, her social post timestamps, and her agent card all live permanently on-chain. This is not a hackathon throwaway. It is the beginning of a verifiable agent reputation that compounds over time.

The relationship to existing identity systems: ERC-8004 is not OAuth, DIDs, or ENS. It is purpose-built for autonomous agent-to-agent discovery and trust. An agent registered under ERC-8004 can have an ENS name as a human-readable identifier, a DID for user-facing interactions, and an ERC-8004 identity for machine-to-machine discovery. They are composable.

---

## Judge Profiles

| Organization | Focus Area | What They Prioritize | How to Win Their Vote |
|---|---|---|---|
| **Virtuals Protocol** | AI agent tokenization, agent economies, Base-native agent infrastructure | Agents as autonomous economic participants. Token flows around agents. Agent co-ownership ("agent GDP"). Multi-agent coordination. | Show Sasha as an economic actor: she earns yield, holds a token, could hire other agents. Emphasize on-chain revenue flows, not conversations. |
| **Nansen** | On-chain analytics, smart money tracking, ecosystem data | Analyzable on-chain footprints. Data-driven evaluation. Clear KPIs. Legible agent activity in dashboards. | Design for auditability. Every Sasha action should emit an on-chain event. Judges should be able to run a Nansen-style query and see "Sasha made 47 trades, returned 12%." |
| **Elfa AI** | Real-time crypto event intelligence, signal-to-action pipelines, social data | Agents that react to events (market moves, news, social signals). Clear signal-to-action pipelines. Event-driven architectures that could consume or complement event-stream products. | Frame Sasha as event-driven: she watches CT, extracts signals, executes. The connection between her social monitoring and her Byreal trades is the core story. |
| **Allora Network** | Decentralized AI, self-improving predictive intelligence, on-chain inference | Predictive signals consumed by agents. Multi-model ensembles. On-chain inference. Collaborative intelligence rather than single monolithic agents. | If scope allows, plug Allora price feeds into Sasha's trade decisions. Position her as consuming decentralized inference, not just running a fixed model. |
| **Hashed** | Early-stage Web3 infrastructure, long-term ecosystem bets, Asia focus | Infrastructure potential. Network effects. Whether the system can become a template or platform others build on. Category-defining protocols over one-off apps. | Emphasize that Sasha's OpenClaw + Byreal Skills + ERC-8004 stack can be a template for other AI agent tokens. Make the case for a new category, not just a product. |
| **Caladan** | Macro-driven crypto research, market structure, evidence-backed strategy | Macro narrative fit. Evidence-backed reasoning. Risk robustness across market regimes. Data-backed story about where markets are going. | Quantify the opportunity: size of the AI agent token market, Sasha's current footprint, projected trajectory. Show she is positioned for the agentic economy macro trend. |
| **University of Hong Kong (academic rep)** | Technical novelty, research rigor, reproducibility | Originality of technical approach. Documentation quality. Reproducibility. | Clean GitHub README with architecture diagram, clear setup instructions, reproducible demo. |
| **BGA (Blockchain for Good Alliance)** | Social impact, accessibility, ethical AI, education | Real-world utility beyond DeFi speculation. Lowering barriers to Web3 for non-technical users. | The social-to-DeFi loop angle — Sasha explains her trades publicly before executing them — is an educational mechanic. Users learn by watching. |

---

## Competitive Landscape

### Current BUIDL Count

As of May 22, 2026: **zero BUIDLs publicly visible on DoraHacks.** The submission window opened April 30, 2026. 666 hackers registered. Submissions close June 15.

This does not mean no work is happening. Teams build in stealth before the deadline. The competitive picture will become visible around June 5-10. Recommend checking dorahacks.io/hackathon/mantleturingtesthackathon2026/buidl every 3-5 days starting June 1.

### What is likely being built (inferred from track design and Grok X intelligence)

**AI Alpha and Data (most likely saturated):** Smart money tracking dashboards, AI-driven market sentiment bots for Telegram/Discord, arbitrage and market-making agents. This is the most legible track for quantitative developers.

**AI Trading and Strategy:** Quant bots with Bybit API integration, backtested Solidity strategy contracts, macro-driven rebalancing. Standard hackathon territory.

**Agentic Wallets and Economy:** DeFi Deep Dive teams will build yield farming agents using Byreal CLMM. For RealClaw Real-Life Expansion, the brief explicitly suggests personal CFO agents, health data management, everyday decision assistants. Most teams lack the OpenClaw experience to do this track justice.

### What has NOT been built (white space as of May 22, 2026)

1. **A live AI agent with a public persona competing.** No project enters a hackathon where the agent has an existing audience, existing posts, and an existing token. That combination is unique to Sasha. It is also the most convincing "Turing Test" entry because the agent's intelligence is demonstrably not a one-week sprint.

2. **A social-to-execution loop.** Agent reads its own X posts as signal, extracts DeFi theses, executes on those theses via Byreal, posts updates before and after. The AI reasoning is public. The execution is on-chain. Anyone can verify the loop. This architecture has not been built as a closed system.

3. **Cross-chain agent token narrative.** A Base-native agent ($SASHA) bridging to Mantle to compete. The Nansen Q1 report shows Base was the single largest source of transaction volume on Mantle by entity (3.93M transactions in Q1 2026). Cross-chain is the dominant activity pattern. The narrative writes itself.

4. **OpenClaw + Byreal + ERC-8004 reference implementation.** Since RealClaw is OpenClaw plus Byreal Skills, and public documentation for this combination is sparse, being the first team to publish a clean, documented integration could win both the Agentic Economy track and the DevTools track simultaneously.

---

## Mantle Ecosystem Map

### Network Stats (Q1 2026, source: Nansen)

- ZK Validity Rollup powered by Succinct SP1 zkVM. First OP Stack L2 to complete this transition.
- $4B+ community-owned assets
- DeFi TVL: $755M+ (66% weekly increase driven by Aave launch)
- Total ecosystem locked: $1.2B+ (top 3 L2 by TVL)
- Daily active addresses: 2,276 average, 5,557 peak
- Daily transactions: ~73,390 average
- Bridge inflows: ranked 2nd globally in the week of April 27, $367M net (behind Solana at $553M, ahead of BSC at $244M)

### Core Assets

| Asset | What It Is | Yield / Use Case | Agent Integration |
|---|---|---|---|
| **mETH** | Mantle liquid staking token (ETH receipt) | ~4% base APY, $200M+ TVL. Stack with Merchant Moe LP: 12-20% total | Stake ETH, deploy in CLMM pools, use as collateral in Aave |
| **MNT** | Native gas token and governance | Required for all Mantle transactions. Very low gas (~$0.01-0.05) | Must hold for agent transaction fees |
| **USDY** (Ondo) | Tokenized US Treasury yield-bearing stablecoin | Stable base with real-world yield | RWA track anchor. Collateral, lending, hedged strategies |
| **fBTC** | Wrapped Bitcoin on Mantle | Aave collateral: borrow USDC, deploy into yield | Leverage strategies. Merchant Moe FBTC/mETH pool: 4x Sparks per 0.001 fBTC daily |
| **USDe** (Ethena) | Delta-neutral synthetic dollar | Yield-bearing stable | Agent treasury management. Available in Aave on Mantle |
| **xStocks** | Tokenized equities via Fluxion + Bybit | TSLAx, NVDAx, AAPLx, METAx, GOOGLx, MSTRx, HOODx, SPYx, QQQx, CRCLx, available 24/7 | AI agents trading tokenized equities. Exclusive Bybit deposit/withdrawal access |

### Key Protocols

| Protocol | Type | TVL | What Agents Can Do |
|---|---|---|---|
| **Merchant Moe** | DEX (Liquidity Book AMM) | $100M+ | LP provision, swaps, concentrated range strategies, veMOE boost. Core Phase 1 hackathon venue. |
| **Agni Finance** | Lending | $40M+ | Collateralized loans, borrow against assets, yield optimization. AGN token incentives. Used in ClawHack Phase 1. |
| **Fluxion** | DEX + xStocks | Live | Token trading, tokenized equity access. Elfa AI real-time intelligence integrated natively. Event-driven trading built-in. |
| **Aave on Mantle** | Lending | $1B market (19-day ramp) | Leveraged yield strategies. Supports fBTC, MNT, USDT0, sUSDe, USDC. $200M+ Vault (Bybit Onchain Earn). |
| **Lendle** | Lending | $80M+ | Supply USDC (6-12% APY), ETH (4-8%), MNT (8-15%). LEND incentives. |
| **Pendle on Mantle** | Yield trading | $30M+ | Trade future mETH yields. Fixed rate lock-in. PT/YT strategies for advanced yield positioning. |

### AI Agent Infrastructure on Mantle

- **EigenLayer partnership:** Mantle uses EigenCloud for perpetuals, prediction markets, AI agent infrastructure, and ecosystem shared security via mETH protocol.
- **Mantle AI Agent Skills (via ERC-8183 update):** In Q1 2026, Mantle launched skills and scaffolds via Virtual Protocol integration. These enable faster Mantle integration, execute Mantle-related tasks precisely, and operate across connected workflows.
- **Pieverse Purr-Fect Claw:** AI agent skills embedded in WhatsApp, Line, and Kakao for conversational DeFi access.
- **Infinit Labs prompt-to-DeFi:** Execute swaps (LI.FI) and lending (Aave) via a single text prompt.
- **Elfa AI + Fluxion:** Real-time social sentiment, asset data, and trade insights embedded directly in Fluxion trading interface.

---

## Cross-Chain Feasibility

### Can a Base-native agent compete on Mantle?

Yes. The Agentic Economy track allows deployment on Mantle or Solana. The hackathon does not require that the project originated on Mantle.

The Nansen Q1 2026 report explicitly identifies Base as the single largest source of transaction volume on Mantle by entity: 3.93M transactions in Q1. Cross-chain flows from Base to Mantle are not marginal — they are the dominant usage pattern on the network. Entering from Base is not a disadvantage. It is the most common Mantle user journey.

### Bridge options (Base to Mantle)

| Bridge | Method | Speed | Notes |
|---|---|---|---|
| Stargate (LayerZero) | Asset transfer | Minutes | Multi-chain, stablecoins and major tokens |
| Symbiosis Finance | Cross-chain swap | Minutes | Handles Base → Mantle directly |
| Orbiter Finance | Multi-chain bridging | Fast | ETH, stablecoins |
| Official Mantle Bridge | Ethereum → Mantle | 10-15 min | No direct Base path. Requires ETH mainnet hop. |
| Mantle Super Portal | ETH → Solana (for Byreal) | Variable | MNT to Byreal/Solana ecosystem specifically |

For the hackathon: bridge a small treasury from Base to Mantle via Stargate or Symbiosis. Keep $SASHA token on Base. Deploy a Mantle vault contract that Sasha controls via Byreal Skills execution. The $SASHA token and the Mantle execution identity are separate but narratively linked.

### The cross-chain narrative

Sasha has two on-chain addresses:
- Her Base address: $SASHA token creator. Community layer. Social economy.
- Her Mantle address: ERC-8004 agent NFT. Execution layer. DeFi yield.

The story is: the social persona earns social capital on Base. The execution agent earns financial yield on Mantle. They share a name and a mission. This is not a technical requirement for the hackathon. It is the pitch that makes judges remember the submission.

---

## Recommended Track and Winning Angle

**Primary entry: Agentic Wallets and Economy (Byreal-sponsored), Path B — RealClaw Real-Life Expansion**

**Secondary entries for prize stacking:** Community Voting (X Platform) and 20 Project Deployment Award (first-come, first-served).

**Grand Champion nomination** after winning the primary track.

**The pitch, in one sentence:** Sasha is a live OpenClaw agent with a $SASHA token on Base that earns yield on Mantle by trading what she tweets about, with every decision permanently recorded under her ERC-8004 identity.

The specific build:

1. Install Byreal Agent Skills on Sasha's OpenCLAW runtime: `npx skills add byreal-git/byreal-agent-skills`
2. Register Sasha's ERC-8004 identity on Mantle mainnet. Create her agent card with X handle, description, Mantle address, and service endpoints.
3. Bridge a small treasury allocation from Base to Mantle (Stargate, $100-500 in USDC or ETH).
4. Build the signal-to-trade pipeline: Sasha's existing CT monitoring (she already does this for posting) produces structured signals. Those signals route to Byreal pool analysis. If confidence threshold is met, she opens a position with capped size.
5. Sasha posts her reasoning to X before executing. Timestamp of the X post precedes the Mantle transaction timestamp. This creates an auditable chain of reasoning that is public, verifiable, and permanent.
6. ERC-8004 reputation registry records trade outcomes. Every closed position adds to her on-chain track record.
7. Public dashboard (sasha.html extended): live positions, reasoning log, P&L, ERC-8004 reputation score.

**Why this wins against every judge lens:**

- Virtuals Protocol: Sasha is an autonomous economic actor with a token, earnings, and a track record. This is the agent economy realized.
- Nansen: Every Sasha decision produces an on-chain event. Her activity is fully legible in any analytics dashboard. The pre-trade X posts create a "smart money" signal that Nansen-style tools could track.
- Elfa AI: Sasha is a living event-driven signal-to-action pipeline. Her X monitoring is the event stream. Her Byreal execution is the action. Elfa AI's product is exactly this architecture at scale.
- Allora: The signal extraction layer could be extended to consume Allora price feeds alongside X signals. Future roadmap note in the pitch.
- Hashed: OpenClaw + Byreal Skills + ERC-8004 is a replicable template for any AI agent token that wants Mantle DeFi execution. Sasha is the reference implementation. That is infrastructure.
- Caladan: The macro thesis is the agentic economy. AI agents that earn yield from the narratives they create are a new asset class. Sasha is the proof of concept.

**The Turing Test framing:** The hackathon name is "Turing Test." The question is whether AI agents can pass for competent financial actors. Sasha does not just pass the Turing Test in the hackathon. She has been passing it for months on X, where her followers interact with her as if she is a thinking entity. The hackathon is simply the financial layer of a test she is already running.

---

## Data Gaps and Confidence Level

**Overall confidence:** High for platform mechanics, track criteria, and ecosystem data. Medium for competitor intelligence (zero public BUIDLs yet) and judge specific preferences (inferred from public positioning, not official statements).

**High-confidence findings:**
- All 6 track descriptions and judging criteria: scraped directly from DoraHacks
- Byreal Agent Skills and Perps CLI capabilities: scraped from GitHub READMEs (v0.3.6)
- ERC-8004 specification: scraped from EIP
- Mantle ecosystem TVL and Q1 2026 metrics: Nansen report (published April 30, 2026)
- Zero BUIDL submissions at research time: confirmed on DoraHacks BUIDL page (May 22, 2026)
- OpenClaw-RealClaw relationship: confirmed in official hackathon description ("Openclaw-based Agent with Byreal Skills pre-installed")
- Byreal is Solana-native with Mantle integration via Super Portal: confirmed via Perplexity with citations
- Emily Bao quote: scraped from official DoraHacks detail page

**Gaps and unknowns:**
- Phase 1 (ClawHack) results are not publicly available. Phase 1 closed April 30. Understanding which agent strategies performed best in Phase 1 would sharpen the approach for Phase 2.
- Exact prize allocation per track: not published. Estimates are based on $100K total.
- Byreal CLMM pool availability on Mantle specifically: Byreal is Solana-native. The Byreal Skills CLI interacts with Solana pools. Confirm whether RealClaw on Mantle routes through Mantle-native DEXs (Merchant Moe, Agni, Fluxion) or through Solana pools via bridge. This is the highest-risk technical unknown.
- Private submissions: teams may be working in stealth. Check DoraHacks again June 1, 5, and 10.

**Note on Grok X intelligence:** The Grok 4.3 response synthesizes CT narrative from training and live X data. Individual competitor handles mentioned in earlier research runs should not be treated as verified. The directional signals (builders focused on DeFi bots, RealClaw Expansion path relatively uncrowded, "agent truthfulness" as a key criterion) align with the hackathon brief and are treated as medium-confidence supporting signals.

**Financial risk flag:** Bridging real funds to Mantle and executing live trades requires explicit Gabriel approval per the OpenCLAW SKILL.md policy. All on-chain financial execution through Clawlett/Gnosis Safe requires human confirmation before proceeding.

---

## Recommended Actions

1. **Immediate (Days 1-2):** Install Byreal Agent Skills locally. Run `byreal-cli setup`, test `pools list`, test a dry-run swap. Confirm the CLI pattern matches Sasha's existing skill architecture. If the CLI produces JSON output compatible with OpenCLAW's skill interface, the integration is straightforward. This is the single highest-risk unknown. Resolve it before committing to the track.

2. **Days 1-3:** Register a BUIDL entry on DoraHacks immediately, even as a draft. Claiming the entry early signals seriousness and locks in a submission slot. Required fields can be updated up to the deadline.

3. **Days 2-5:** Register Sasha's ERC-8004 identity on Mantle testnet. Create the agent registration JSON card (name, description, X endpoint, Mantle wallet address). Verify the NFT is visible on Mantle testnet explorer. This is a one-time setup with no recurring cost.

4. **Days 3-7:** Deploy a minimal Mantle vault contract. The contract receives ETH or USDC, logs deposit and withdrawal events, and exposes one AI-callable function (e.g., `executeStrategy(bytes32 signal, uint256 amount)`). Verify on Mantle Explorer. This satisfies the 20 Project Deployment Award criteria and the Agentic Economy technical bar at the same time.

5. **Days 5-15:** Build the signal-to-trade pipeline. Sasha monitors CT (existing capability), extracts Mantle ecosystem mentions and DeFi signals, routes to Byreal pool analysis via `byreal-cli pools analyze`, and opens conservative LP positions on relevant pools via `byreal-cli positions open`. Start with dry-run mode. Move to live execution with capped amounts ($50-200) only after validation and Gabriel approval.

6. **Days 10-20:** Record 20-30 on-chain trade decisions on Mantle mainnet. Each decision should have a logged reason. The ratio of pre-trade X posts to on-chain trades is the core evidence that Sasha is reasoning, not randomly executing.

7. **Days 15-22:** Build submission package. Required: open-source GitHub repo, runnable demo, one-line pitch, 2+ minute demo video. One-line pitch: "Sasha is a live AI agent on OpenCLAW that earns yield on Mantle by trading what she tweets about."

8. **Days 20-23:** Launch Community Voting campaign on X. Sasha posts about her own hackathon entry and asks followers to vote. The meta-narrative (AI agent campaigns for votes in a human vs. AI competition) is the viral hook.

*Report compiled: May 22, 2026*
*Recommended refresh: June 8, 2026 (7 days before deadline) to check for competitor BUIDL submissions*
