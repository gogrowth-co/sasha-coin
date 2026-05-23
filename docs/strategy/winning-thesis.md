# Sasha Coin — Mantle Turing Test Hackathon 2026
## The Winning Thesis

**Date:** May 23, 2026 — 23 days to submission.
**Track:** Agentic Wallets & Economy (Byreal-sponsored), Path B — RealClaw Real-Life Expansion.
**Goal:** Win Track 6 First Prize. Stack Community Voting, 20 Project Deployment, Best UI/UX. Get nominated for Grand Champion.

---

## 1. The Structural Insight (read this twice)

The hackathon's Grand Champion rubric weights Mantle Ecosystem Contribution at 25%. As currently designed, Sasha's Mantle footprint is a single ERC-8004 NFT and an on-chain attestation log. Solana does the work. Base holds the token. Mantle gets a receipt.

> Every judge who reads the rubric will notice that the most Mantle-weighted category is the one where Sasha contributes the least.

This is not a content problem. It is a structural problem. We cannot write our way out of it. We have to **rebuild the economic loop so Mantle is load-bearing, not decorative.**

That is the single most important fix in this document. Everything else is leverage.

---

## 2. The Reframe — From Trading Bot to Autonomous Economic Actor

Every other hackathon entry is some version of: *"AI agent that trades crypto on [chain] using [signals]."* That story is dead on arrival. Judges have seen 50 versions of it.

Sasha is not a trading bot. She is the reference implementation of an autonomous economic actor with **five layers** that no other agent has assembled together:

| Layer | What | Where | Why it matters |
|---|---|---|---|
| **Identity** | ERC-8004 agent NFT | Mantle | Verifiable, portable, persistent. Other protocols can read it. |
| **Treasury** | mETH staking position | Mantle | Idle capital earns yield. Yield funds her gas. Self-sustaining. |
| **Execution** | Byreal CLMM positions, perps via Hyperliquid | Solana | Where money actually moves. Highest liquidity, lowest fees. |
| **Reasoning** | Public X posts, timestamped before each trade | X + indexed on Mantle | Auditable chain of thought. Pre-trade thesis is permanent. |
| **Reputation** | ERC-8004 reputation registry feedback | Mantle | The output other agents and protocols consume. |

Sasha doesn't trade. She **lives**. She has an identity, a treasury, an income, a public reasoning process, and a reputation. The trading is just one of the things she does. The hackathon track asks for "RealClaw Real-Life Expansion." Living is the expansion.

---

## 3. The Five Unfair Advantages

Ranked by impact × effort. Each one is a skill or signal that no other entry will combine, much less integrate.

### 3.1 mETH Yield Loop — Mantle Becomes Load-Bearing 🔴 CRITICAL

**The fix for the structural problem.** Sasha holds mETH on Mantle as her primary treasury asset. The staking yield (currently ~3.5% APR via Mantle LSP) funds her gas for ERC-8004 attestations and her trading capital allocation. When a trade closes profitably, profits route back to mETH compounding.

This makes Mantle economically essential, not architecturally adjacent. Mantle Ecosystem Contribution score jumps from 4/10 to 9/10. Track sponsor Byreal is happy because RealClaw remains the execution interface; Mantle Network (Track 3 sponsor) is happy because mETH gets meaningful AI agent demand; Grand Champion judges see a system where Mantle isn't a log — it's the balance sheet.

**Build:** Add `mantle-treasury.js` script that uses `ethers.js` to interact with Mantle's mETH contract (`0xcDA86A272531e8640cD7F1a92c01839911B90bb0`). Track staked balance, accumulated yield, and auto-compound on threshold. Wire it into `byreal-trade.js` so post-trade profit allocation includes mETH compounding.

**Time:** 4 hours. **Dependencies:** MANTLE_AGENT_PK in env, small starter mETH balance.

---

### 3.2 Allora as Decision Prior — Judge Play #1 🏆

Allora Network is a judge. They have a free decentralized inference API. Their reputation-weighted ensemble price predictions are already a meta-signal — exactly what a thoughtful agent should consume.

**Integration:** Sasha's signal pipeline calls Allora's inference endpoint for SOL/USD at 5m and 8h horizons. If Allora's combined inference (which is already weighted by worker reliability) disagrees with Sasha's social bias by more than 30%, she reduces position size or holds. If they agree, she sizes up.

**Pitch to Allora judge:** *"Sasha trusts your reputation-weighted ensemble over any single model — including her own."*

**Build:** New file `scripts/signals/allora.js`. REST call to `https://api.allora.network/v2/allora/consumer/<chainId>?allora_topic_id=<topicId>`. Auth via `x-api-key`. Returns `{ direction: 'long'|'short'|'neutral', confidence: 0..1 }`. Plug into `mantle-signal.js` as a third signal layer alongside social bias and on-chain pool data. Weighting: 30%.

**Time:** 2 hours. **Cost:** Free.

---

### 3.3 Elfa AI Smart Mentions — Judge Play #2 + Social Alpha 🏆

Elfa AI is a judge AND their product is the literal definition of what Sasha's social signal layer should be. Their `/smart-mentions/{ticker}` endpoint returns weighted social activity from accounts that historically lead price moves. This is social alpha quantified.

**Integration:** Replace Sasha's current naive X-post-only social signal with Elfa-weighted smart mentions. When Elfa shows smart-account chatter for a target token surging 24h-over-24h, that becomes a leading signal — often hours ahead of price.

**Pitch to Elfa judge:** *"Sasha's social layer is built on your infrastructure. Smart mentions precede on-chain alpha. We let your data lead her chain."*

**Build:** New file `scripts/signals/elfa.js`. REST call to `https://api.elfa.ai/smart-mentions/<ticker>`. Auth via `x-elfa-api-key`. Returns smart mention count, mindshare %, sentiment direction. Replaces or augments the existing posted-log social signal layer.

**Time:** 2 hours. **Cost:** Free tier sign-up.

---

### 3.4 Polymarket Implied Odds — The Signal Nobody Else Will Use 💎

Real-money prediction markets are skin-in-the-game crowd intelligence. Polymarket has crypto-specific markets ("SOL above $200 by date X", "Solana network outage by date Y"). Probabilities move on real conviction, not Twitter noise. **Zero hackathon teams will think of this.**

**Integration:** Sasha reads Polymarket order book depth and implied odds on SOL price targets. Sharp probability moves trigger directional bias. Sudden volume spikes on risk-event markets (exploits, outages, halts) trigger immediate risk-off — close positions, stop opening new ones.

**Pitch to all judges:** *"Sasha reads crowd-implied odds from real-money prediction markets. The signal is uncorrelated with Twitter sentiment and impossible to fake."*

**Build:** New file `scripts/signals/polymarket.js`. REST call to `https://gamma-api.polymarket.com/markets?...` (no auth needed). Filter for SOL/Solana-related markets, parse implied probabilities, detect sharp moves. Returns `{ directionalBias, riskOffSignal }`. Plug into `mantle-signal.js` at 15% weight.

**Time:** 1 hour. **Cost:** Free, no auth.

---

### 3.5 ERC-8004 Reputation as Downstream Product — Innovation Pillar 💡

The pre-mortem flagged this: nobody is building **on top of** the ERC-8004 reputation registry. Everyone mints the identity NFT and stops. That makes the attestation feel like a receipt, not infrastructure.

The fix: position Sasha's ERC-8004 record as a **product other agents and protocols can consume.** Specifically, build a tiny public endpoint (`/api/sasha-reputation`) that returns her verified track record (total trades, win rate, average P&L, sentiment accuracy) in a standardized JSON schema. Mention in the pitch that other DeFi protocols could use this to extend credit to her, that other agents could copy-trade her with verifiable trust, that the schema is portable to any ERC-8004 agent.

**Pitch to judges (Hashed, Caladan, Virtuals):** *"Sasha isn't just an agent. She's the reference implementation. Any ERC-8004 agent can publish a reputation feed in this schema. We built the primitive. She's just the proof."*

**Build:** Add `/api/sasha-reputation` endpoint to `task-server.js`. Read from `state/mantle-trade-log.json` + ERC-8004 attestations. Return standardized schema (we'll define it). Document the schema in `docs/erc8004-reputation-schema.md` as a portable spec.

**Time:** 3 hours. **Cost:** Free.

---

## 4. Tier 2 — Stack These If Time Permits

| Skill | Why | Time | Cost |
|---|---|---|---|
| **Fear & Greed Index** | Position sizing multiplier. Extreme fear = contrarian long bias, extreme greed = reduce size. | 30 min | Free |
| **Byreal GitHub event counter** | Monitor commit velocity on byreal-clmm. High activity = protocol shipping = bullish bias. | 1 hr | Free |
| **byreal-perps-cli signals scan** | Built-in TA signals on Hyperliquid. `byreal-cli signals scan` returns technical setups. Adds a TA layer Sasha doesn't have yet. | 1 hr | Free |
| **byreal-hermes LLM API** | RealClaw has a built-in LLM API. Run inference without OpenAI/Anthropic dependency. Pitch to Tencent Cloud judges. | 2 hr | Free |
| **Cross-chain $MNT yield arb** | Monitor APR differentials between Byreal Solana MNT pool and Mantle native pools. Route capital to higher side. | 4 hr | Gas only |
| **Nansen MCP** | Smart money netflows via their MCP server. Judges from Nansen. ~$149/mo gates the signal. Use only if budget allows. | 1 hr | Paid |

---

## 5. Pre-Mortem Killers — Fix Status Tracker

| Risk | Fix | Status |
|---|---|---|
| Mantle is just a timestamp (loses 25% of Grand Champion score) | mETH yield loop (§3.1) | Plan written |
| "Attestation is just a receipt" (Innovation score collapse) | Reputation-as-product (§3.5) | Plan written |
| THS signal has no proven alpha (claims unsupported) | Backfill: run retrospective on existing posted-log → "if I had used this signal, here's what would have changed." Put the number in the submission. | Plan written |
| Community vote: no audience | Daily trade posts starting today. 3 CT influencer shares before voting opens. Target +1000 followers by June 15. | Marketing prompt |
| "AI trading bot" cliche kills narrative | Reframe as autonomous economic actor (§2). 5-layer architecture. Trading is one of her functions, not her identity. | This doc |
| Demo video forgettable | 90-sec script: hook (Sasha tweet) → trade (Solscan link) → attestation (Mantle Explorer) → reputation feed (other protocols can consume). | Marketing prompt |
| Submission incomplete | Lock submission text by June 8. All deliverables verified by June 10. | Marketing prompt |
| Cross-chain latency kills demo | Pre-stage replay mode showing last 10 real trades with full attestation chain. Demo runs against forked Mantle. | Engineering note |

---

## 6. The 23-Day Execution Sequence

### Week 1 — May 23 to May 30 (Foundation)
**Engineering (sasha-coin workspace):**
- Fix the two bugs (price range, posted-log schema)
- Build mETH yield loop (§3.1) — the Mantle load-bearing fix
- Wire Allora signal (§3.2)
- Wire Elfa smart mentions (§3.3)
- Wire Polymarket (§3.4)
- Update signal weighting in `mantle-signal.js`: social bias 25%, on-chain pools 20%, Allora 25%, Elfa 15%, Polymarket 15%

**Marketing (MangaOS workspace):**
- Draft 5 hackathon campaign posts
- Publish post #1: "I'm entering the Turing Test Hackathon" (announcement)
- Start daily public trade thread on X — even if just signal calls, no execution yet

### Week 2 — May 31 to June 7 (Shipping)
**Engineering:**
- Deploy SashaAgentLog smart contract on Mantle testnet, then mainnet by June 5
- Build `/api/sasha-reputation` endpoint (§3.5)
- Write ERC-8004 reputation schema doc
- Public dashboard URL live (Cloudflare Pages or Vercel)
- First successful real trade with full pipeline (Gabriel-approved live tweet)

**Marketing:**
- Publish post #2: "How I actually decide" — the signal stack
- Publish post #3: The Turing Test irony — voting setup
- Start engaging Allora, Elfa, Nansen, Virtuals official accounts

### Week 3 — June 8 to June 15 (Polish + Submit)
**Engineering:**
- Backfill THS retrospective analysis with real numbers
- Demo replay mode for safe live demo
- Record 90-sec demo video
- DoraHacks submission draft locked June 10

**Marketing:**
- Submit BUIDL to DoraHacks
- Launch Community Voting campaign (3-post arc, peak velocity)
- Outreach to 3 CT influencers for vote sharing

---

## 7. Pitch Frame — The One Paragraph

> Sasha is the reference implementation of an autonomous economic actor on Mantle. She holds a productive treasury (mETH staked, compounding), executes on Solana via Byreal (where the liquidity is), publishes her reasoning to X before signing transactions (the accountability primitive), and exposes her verified track record as a portable ERC-8004 reputation feed that any protocol or agent can consume. She uses Allora's reputation-weighted inference as her decision prior, Elfa AI's smart mentions as her social signal layer, and Polymarket implied odds as her crowd-intelligence filter. Mantle is not where she logs trades. Mantle is where she lives — it is her identity, her balance sheet, her reputation. The trading is one of the things she does, not what she is.

---

## 8. What This Document Does Not Say

It does not say we will win. It says **here is the plan that beats every other plan we know about.** Execution risk is real. The mETH yield loop must work cleanly. The smart contract must deploy on mainnet without bugs. Demo Day must run on a pre-staged replay so live latency does not break the narrative.

We have 23 days. If we ship the five unfair advantages, fix the structural Mantle problem, and run a tight community voting campaign — we win Track 6 First Prize, contend for Grand Champion, and stack Community Voting + 20 Project Deployment + likely Best UI/UX.

If we ship only half — we still hit 20 Project Deployment Award (no judging, pure execution) and likely place on Track 6.

If we ship the bug fixes alone and stop — we get an incomplete submission and lose. That is the floor. The ceiling is everything above it.

---

*This document is the strategic source of truth for the hackathon entry. Every engineering and marketing decision references back to this. Update it when the strategy changes. Do not let it go stale.*
