# DoraHacks BUIDL Submission — Mantle Turing Test Hackathon 2026
# Ready to paste at: https://dorahacks.io/hackathon/mantleturingtesthackathon2026/buidl

---

## PROJECT NAME
Sasha — Autonomous Economic Actor

---

## ONE-LINE PITCH
An AI agent that posts her trade thesis to X before her wallet moves — reasoning timestamped in public, execution attested on-chain, identity permanent.

---

## TRACK
Agentic Wallets & Economy (Byreal-sponsored)
Path A: DeFi Deep Dive

---

## DEMO VIDEO URL
https://youtu.be/BirU_Z57Z3A

---

## LIVE DEMO / FRONTEND URL
https://sasha-dashboards.pages.dev/mantle/
(Paste into the DoraHacks BUIDL "Live Demo / Website" link field — NOT the video field.)

---

## GITHUB REPO
https://github.com/gogrowth-co/sasha-coin

---

## DEPLOYED CONTRACT
SashaAgentLog.sol on Mantle Mainnet:
0x71e27D792ADF726eD5C55f74052E8A8f063B9EF8

Explorer: https://explorer.mantle.xyz/address/0x71e27D792ADF726eD5C55f74052E8A8f063B9EF8
Verified: https://sourcify.dev/server/v2/contract/5000/0x71e27D792ADF726eD5C55f74052E8A8f063B9EF8

ERC-8004 Agent Identity:
Agent #100 at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
Explorer: https://explorer.mantle.xyz/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/instance/100

---

## PROJECT DESCRIPTION (long form — paste into DoraHacks)

### The problem with AI trading agents

Every AI agent can claim it predicted the trade after the fact. A post-hoc "thesis" is unfalsifiable. Prediction is cheap when you write it after you've already seen the outcome.

Sasha solves this with a single constraint: she posts her thesis before her wallet moves.

---

### What Sasha is

Sasha is an autonomous AI agent running on OpenCLAW, a self-hosted agent runtime. She has a permanent on-chain identity, a productive treasury, a public reasoning feed, and an execution layer that spans multiple chains.

She is not a trading bot. She is a reference implementation of an autonomous economic actor — one that uses each chain for what it is actually best at, and whose reasoning is permanently auditable before any transaction is signed.

She was active before this hackathon started. She will be active after it ends.

---

### The accountability primitive: tweet-before-trade

Every trade Sasha executes follows this exact sequence:

1. Sasha runs five signal sources in parallel and computes a weighted recommendation
2. Sasha posts her trading thesis to X — timestamped, public, permanent — before any transaction is signed
3. 60-second accountability window. The thesis is on record. The clock is running.
4. Trade executes on Byreal (CLMM, Solana)
5. `SashaAgentLog.logTrade()` attests the trade on Mantle, permanently linking the execution TX hash, the X post timestamp, and the reasoning

Any agent can execute a trade and claim it was predicted. Sasha's thesis is public before her wallet moves. The trade is the consequence, not the claim.

---

### Five-source signal fusion

Every 6 hours, the signal engine runs a deterministic, auditable fusion across five independent sources:

| Source | Weight | What it measures |
|---|---|---|
| Sasha's X posts | 25% | LLM-extracted DeFi sentiment + risk appetite from her own public feed |
| Byreal pool data | 20% | Live APR, TVL, volume from Byreal CLMM pools |
| Allora inference | 25% | Reputation-weighted ensemble predictions (5m + 8h horizon) |
| Elfa AI smart mentions | 15% | Smart-account social activity that historically leads price moves |
| Polymarket implied odds | 15% | Real-money crowd intelligence — uncorrelated, unfakeable |

Hard risk-off override: if Polymarket flags a tail risk event, Sasha moves 50% to stablecoins regardless of other signals.

The weights are fixed and public. The inputs are verifiable. The output is a single score that determines whether Sasha opens, holds, or closes a position.

---

### Multi-chain architecture: right tool for each layer

Sasha does not live on one chain. She uses each chain for what it does best:

| Layer | What | Chain | Why this chain |
|---|---|---|---|
| Identity | ERC-8004 agent NFT | Mantle | Native ERC-8004 registry, near-zero gas, permanent |
| Attestation | SashaAgentLog.sol | Mantle | Immutable on-chain record of every trade + reasoning link |
| Treasury | mETH staking | Mantle | mETH yield funds her own gas — she is self-sustaining |
| Execution | Byreal CLMM positions + swaps | Solana (via Byreal) | Best CLMM yields, Byreal Skills CLI for agent-native execution |
| Community | $SASHA social token | Base | Creator economy, Zora mints, community layer |
| Reasoning | Pre-trade theses | X (public feed) | Timestamped, censorship-resistant, any third party can verify |

Mantle is not in the stack because of this hackathon. It is in the stack because the ERC-8004 standard lives there and the attestation cost is negligible. That distinction matters for long-term sustainability.

---

### Architecture diagram

```
X post (timestamped thesis — public before wallet moves)
        |
        v
   [60-second accountability window]
        |
        v
Byreal Skills CLI → Solana CLMM execution
        |
        +---> SashaAgentLog.logTrade() → Mantle (permanent attestation)
        |           links: Solana TX + X post timestamp + rationale
        |
        +---> mETH auto-compound → Mantle (yield loop)
        |           Sasha funds her own gas
        |
        +---> ERC-8004 Agent #100 → Mantle (persistent identity)
                    portable reputation feed: /api/sasha-reputation
```

---

### Live attestation (already happened)

Pre-trade tweet: https://x.com/SashaCoin95/status/2059070214021718310

Mantle attestation TX: https://explorer.mantle.xyz/tx/0x28d057caec328a4eda62fa622383ba66be691b6498334af55645a7308ba60cef

Solana LP TX: https://solscan.io/tx/3bv6jDpsKxCPW3soLaPbHQBftNXxH4bKWiLZ8JVw8rjhJtvUmkVkmCaN456b5kncsspq3kujp5nehh5JjZxWW5k6

Live dashboard (real-time state, refreshes every 60s): https://sasha-dashboards.pages.dev/mantle/

This is not a demo environment. These are mainnet transactions from a live, running agent.

---

### Autonomous runtime

The pipeline runs 3× per day (12:00 / 17:00 / 21:00 UTC) on a self-hosted VPS with no human in the loop:

1. Five-source signal fusion
2. Pre-trade tweet → Buffer API (timestamped)
3. Byreal trade execution via `byreal-cli`
4. Mantle attestation via `SashaAgentLog.logTrade()`
5. Telegram notification to operator

No human intervention required between cron fires. The cron fires whether or not anyone is watching.

---

### Which Byreal capabilities does the project use?

Sasha uses the **Byreal Skills CLI** for three distinct operations:

1. `byreal swap` — routing signal output to execution (SOL/USDC)
2. `byreal lp open` — opening CLMM positions on Byreal pools (live: Goblin/USDC, 705% APR at time of execution)
3. Byreal pool data API — live APR, TVL, and volume feed into the 20% signal weight

All three are called autonomously. The agent decides, the agent executes, the agent attests.

---

### What scenario are they applied to?

Sasha is not just a DeFi trading agent. She is a proof of concept for autonomous economic actors with verifiable reasoning.

The scenario: an AI agent that manages its own treasury across multiple chains, forms views from heterogeneous data sources, commits to those views publicly before acting on them, and builds a portable on-chain reputation that any third-party protocol can query and verify independently.

The accountability primitive generalizes beyond trading. Any autonomous agent making consequential decisions — financial, governance, operational — can use the same pattern: post reasoning before acting, attest the action, link them permanently.

---

## TELL THE JUDGES

**What makes this different from every other submission:**

Every project in this hackathon executes trades on Byreal. Sasha does one thing no other agent does: she creates an immutable, unfalsifiable record of her reasoning before any transaction is signed.

The ERC-8004 identity NFT is not cosmetic. It is the anchor point for a portable reputation feed (`/api/sasha-reputation`) that any DeFi protocol can query to evaluate Sasha's historical accuracy, signal calibration, and win rate — independently, without trusting Sasha's own reports.

The multi-chain design is not scope creep. Each chain earns its position by being the best available infrastructure for that specific layer. Mantle holds the identity and attestation because ERC-8004 lives there and gas is cheap enough to make every trade economically viable to attest. Byreal/Solana holds the execution because that is where the best CLMM yields are. Base holds the community layer because that is where creator-economy tooling is most mature.

This is not an agent for a hackathon. She was posting to X before the hackathon opened. She will keep posting after it closes.

---

## COMMUNITY VOTING STRATEGY

The Community Voting award is decided on X. The hook writes itself: an AI agent is lobbying for human votes in a competition called the Turing Test.

Sasha will run a 5-tweet campaign from June 1–13. Each tweet is in-character — confident, self-aware, unapologetic. No begging. The meta-irony of an AI agent campaigning for votes in a Human vs. AI competition is the content.

Full campaign script: `docs/voting-tweets.md`

---

## DEMO VIDEO SCRIPT (2+ minutes)

**Scene 1 (0:00–0:20): The problem**
Voice: "Every AI agent claims to have predicted the trade. Here is one that cannot fake it."

**Scene 2 (0:20–0:45): Signal fusion live**
Show `npm run signal:dry` output — five sources running in parallel, weighted score computing, recommendation: OPEN_LONG

**Scene 3 (0:45–1:15): Tweet before trade**
Show the X post that went out before the wallet moved. Timestamp visible. Cross-reference with Solana TX timestamp — the tweet is earlier by more than 60 seconds.

**Scene 4 (1:15–1:40): Byreal execution**
Show `byreal lp open` command executing. Solana TX on Solscan. Position NFT minted.

**Scene 5 (1:40–2:00): Mantle attestation**
Show `SashaAgentLog.logTrade()` TX on Mantle Explorer. `tradeCount` incrementing. The Solana TX hash is embedded in the event log.

**Scene 6 (2:00–2:20): Identity + reputation**
Show ERC-8004 Agent #100 on Mantle Explorer. Call `/api/sasha-reputation` — live JSON response with trade history, win rate, signal accuracy.

**Scene 7 (2:20–2:30): Close**
Voice: "Every decision, timestamped before it was made. Every trade, attested after it was executed. This is what accountable AI looks like."

---

## SUBMISSION CHECKLIST

- [x] Smart contract deployed on Mantle Mainnet (`0x71e27D792ADF726eD5C55f74052E8A8f063B9EF8`)
- [x] Contract verified on Sourcify — `exact_match` (will surface on Mantle Explorer once their 502 clears)
- [x] AI-powered function callable on-chain — `logTrade()` triggered autonomously, no human required
- [x] Open-source GitHub repo: https://github.com/gogrowth-co/sasha-coin (made public 2026-05-26)
- [x] Deployment address in submission
- [x] ERC-8004 agent identity registered (Agent #100)
- [x] Demo video published — https://youtu.be/BirU_Z57Z3A (~56s, dashboard-centric, real on-chain loop, Sasha's voice)
- [x] Frontend demo publicly accessible — https://sasha-dashboards.pages.dev/mantle/ (live, auto-refreshing)
- [ ] DoraHacks BUIDL form submitted — **PENDING**

---

## PRIZES ELIGIBLE FOR

1. **Agentic Economy Track — First Prize** (primary, Byreal-sponsored) — strongest fit
2. **Grand Champion** — cross-dimensional: technical depth (multi-chain architecture + five-source signal fusion), innovation (accountability primitive, no other agent does this), Mantle ecosystem (ERC-8004 + SashaAgentLog + mETH treasury), product completeness (live mainnet, not a demo)
3. **Community Voting** — X campaign, meta-hook, self-running
4. **20 Project Deployment Award** — submit early, all criteria met except demo video + frontend
