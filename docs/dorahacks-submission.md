# DoraHacks BUIDL Submission — Mantle Turing Test Hackathon 2026
# Ready to paste at: https://dorahacks.io/hackathon/mantleturingtesthackathon2026/buidl

---

## PROJECT NAME
Sasha — Autonomous Economic Actor on Mantle

---

## ONE-LINE PITCH
An AI agent that tweets her trade thesis before her wallet moves — every decision timestamped on X, every execution attested on Mantle.

---

## TRACK
Agentic Wallets & Economy (Byreal-sponsored)
Path B: RealClaw Real-Life Expansion

---

## DEMO VIDEO URL
[To be filled — see demo script below]

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

Sasha is an autonomous AI agent running on OpenCLAW, a self-hosted agent runtime. She has an identity (ERC-8004 NFT on Mantle), a treasury (mETH staking), a public reasoning feed (X posts), and an execution layer (Byreal CLMM on Solana).

She is not a trading bot. She is a reference implementation of an autonomous economic actor — one whose reasoning is permanently auditable before any transaction is signed.

---

### The accountability primitive: tweet-before-trade

Every trade Sasha executes follows this exact sequence:

1. Sasha analyzes five signal sources
2. Sasha posts her trading thesis to X (timestamped, public, permanent)
3. 60-second accountability window — thesis is on-chain record before wallet moves
4. Trade executes on Byreal (Solana CLMM)
5. `SashaAgentLog.logTrade()` attests the trade on Mantle mainnet, linking the Solana TX hash + the X post timestamp

Any agent can execute a trade and claim it was predicted. Sasha's thesis is on-chain before her wallet moves. The trade is the consequence, not the claim.

---

### Five-source signal fusion

Every 6 hours, `mantle-signal.js` runs a deterministic, auditable signal fusion:

| Source | Weight | What it measures |
|---|---|---|
| Sasha's X posts | 25% | LLM-extracted DeFi sentiment + risk appetite from recent tweets |
| Byreal pool data | 20% | Live APR, TVL, volume from Byreal CLMM |
| Allora inference | 25% | Reputation-weighted ensemble SOL/USD predictions (5m + 8h horizon) |
| Elfa AI smart mentions | 15% | Smart-account social activity leading price moves |
| Polymarket implied odds | 15% | Real-money crowd intelligence — uncorrelated, unfakeable |

Hard risk-off override: if Polymarket detects a tail risk event, Sasha moves 50% to USDC regardless of other signals.

---

### Five-layer architecture

| Layer | What | Where |
|---|---|---|
| Identity | ERC-8004 agent NFT | Mantle mainnet |
| Treasury | mETH staking position | Mantle (mETH yield funds her gas) |
| Execution | Byreal CLMM positions + swaps | Solana |
| Reasoning | X posts, timestamped pre-trade | X + indexed on Mantle |
| Reputation | `/api/sasha-reputation` portable feed | Any consumer |

---

### Three-chain diagram

```
X post (timestamped thesis)
        |
        v
   [60s accountability window]
        |
        v
Byreal / Solana (CLMM execution)
        |
        +---> SashaAgentLog.logTrade() on Mantle (attestation)
        |
        +---> mantle-treasury.js autoCompound() on Mantle (yield loop)
                ^
                |
        Base $SASHA (social token — community layer)
```

---

### Live attestation

Pre-trade tweet: https://x.com/SashaCoin95/status/2059070214021718310

Mantle attestation TX: https://explorer.mantle.xyz/tx/0x28d057caec328a4eda62fa622383ba66be691b6498334af55645a7308ba60cef

Solana LP TX: https://solscan.io/tx/3bv6jDpsKxCPW3soLaPbHQBftNXxH4bKWiLZ8JVw8rjhJtvUmkVkmCaN456b5kncsspq3kujp5nehh5JjZxWW5k6

---

### Autonomous runtime

The pipeline runs autonomously 3× per day (12:00/17:00/21:00 UTC) via cron on a self-hosted VPS:

- Signal fusion → recommendation
- Tweet → Buffer API (timestamped before trade)
- Byreal trade execution via `byreal-cli`
- Mantle attestation via `SashaAgentLog.logTrade()`
- Telegram notification to operator

No human intervention required between cron fires.

---

### Which Byreal capabilities does the project use?

Sasha uses the **Byreal Skills CLI** for:
1. `byreal swap` — converting signal output to execution (SOL/USDC routing)
2. `byreal lp open` — opening CLMM positions on Byreal's Solana pools (Goblin/USDC pool at 705% APR in live test)
3. Pool data API — Byreal pool APR, TVL, and volume feed into the 20% weight Byreal signal

These capabilities are called autonomously — no human in the loop.

---

### What scenario are they applied to?

Sasha demonstrates that a Byreal-powered agent can:
- Form a trading thesis from heterogeneous signals (social, on-chain, prediction markets, AI inference)
- Commit to that thesis publicly before acting on it
- Create a permanent, auditable record linking: reasoning → execution → attestation

This is the architecture for AI agents that want to build verifiable reputation on-chain — not just execute trades, but have a track record any protocol can inspect.

---

## TELL THE JUDGES

**What makes this different:**

Every project in this hackathon executes trades on Byreal. Sasha does something no other agent does: she creates an immutable, unfalsifiable record of her reasoning before any transaction is signed. The ERC-8004 identity NFT is not cosmetic — it's the anchor point for a reputation feed (`/api/sasha-reputation`) that any DeFi protocol can query to evaluate Sasha's historical accuracy.

This is not an agent for a hackathon. She was posting to X before the hackathon started and she'll keep posting after it ends.

---

## COMMUNITY VOTING STRATEGY

The Community Voting award is decided on X. The hook: "An AI agent is lobbying for votes in a human vs. AI competition." This is meta-content that writes itself. Sasha will campaign for votes autonomously.

See `docs/voting-tweets.md` for the full campaign script.

---

## DEMO VIDEO SCRIPT (2+ minutes)

**Scene 1 (0:00–0:20): The problem**
- "AI agents claim to predict things they already did. Here's an agent that can't."

**Scene 2 (0:20–0:45): Signal fusion live**
- Show `npm run signal:dry` output — five sources running in parallel
- Score: 0.71 → OPEN_LONG

**Scene 3 (0:45–1:15): Tweet before trade**
- Show the X tweet that went out before the wallet moved
- Timestamp visible — pre-dates the Solana TX by >60 seconds

**Scene 4 (1:15–1:40): Byreal execution**
- Show Byreal LP position open
- Solana TX on Solscan

**Scene 5 (1:40–2:00): Mantle attestation**
- Show `SashaAgentLog.logTrade()` TX on Mantle Explorer
- `tradeCount` counter incrementing on-chain

**Scene 6 (2:00–2:20): ERC-8004 identity**
- Show Agent #100 on Mantle Explorer
- Reputation feed output

**Scene 7 (2:20–2:30): Close**
- "Every trade, timestamped and attested. Vote for the agent building verifiable reputation, not just verifiable trades."

---

## SUBMISSION CHECKLIST

- [x] Smart contract deployed on Mantle Mainnet (0x71e27D792ADF726eD5C55f74052E8A8f063B9EF8)
- [x] Contract verified on Sourcify (exact_match) — will show on Mantle Explorer once 502 resolved
- [x] At least one AI-powered function callable on-chain (logTrade() — autonomous execution, no human trigger)
- [x] Open-source GitHub repo: https://github.com/gogrowth-co/sasha-coin (made public 2026-05-25)
- [x] Deployment address in submission
- [x] ERC-8004 agent identity registered (Agent #100)
- [ ] Demo video (≥ 2 min) — PENDING
- [ ] Frontend demo publicly accessible — PENDING (see docs/live-dashboard-spec.md)
- [ ] DoraHacks form submitted — PENDING

---

## PRIZES ELIGIBLE FOR

1. **Agentic Economy Track — First Prize** (primary track, Byreal-sponsored)
2. **Grand Champion** (strongest cross-dimensional score: technical depth 30%, innovation 25%, Mantle ecosystem 25%, product completeness 20%)
3. **Community Voting** (X platform campaign — see voting-tweets.md)
4. **20 Project Deployment Award** (first-come, first-served — submit early)
