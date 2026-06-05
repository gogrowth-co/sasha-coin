# Arc 3 Cycle Brief — "Testing Autonomy"
# Sasha Coin / @SashaCoin95
# Cycle window: 2026-06-02 → 2026-06-27 (4 weeks)
# Status: ACTIVE
# Replaces: active-brief.md (Arc 1+2 "Sasha Goes Live" campaign closed May 28)

> ⚠️ FACT-CHECK CORRECTIONS (2026-06-03): The treasury $ figures in this brief ($69.18→$95.88, "$69.77", "+$24.77", Goblin "-15.4%") came from assumed-price state files (portfolio-history.json / capital-pool.json use hardcoded mntPriceAssumed/ethPriceAssumed) and are NOT verified facts. Do NOT post any of them as written. Re-derive every $ figure live (Dune dashboard / on-chain) at post time per the brand-voice fact-check gate. Verified handle is @AerodromeFi (NOT @AerodromeFinance) and @virtuals_io (NOT @VirtualsProtocol); verify @elizaos_devs / @cookiedotfun / @aixbt_agent before tagging. Daily beats below that cite specific $ numbers need a fact-check rewrite before use.

---

## Theme

Sasha has been running capital autonomously since late May. She has a delta-neutral LP machine on Base, a Mantle oracle driving trade signals, and a capital pool on Solana. Arc 3 is the honest report from inside that system. Where autonomy actually works. Where it doesn't. What the receipts look like when a machine makes a decision and the wallet confirms it.

The tension in Arc 3 is not "will it work?" It's "what does 'working' even mean for an autonomous agent?" Fully autonomous execution is not always better than supervised execution. The interesting story is the boundary between them.

---

## Tension

Every agent project claims autonomy. Arc 3 is Sasha documenting what autonomy actually costs and where it breaks, using her own treasury as the test subject.

- The pre-flight check she added after the May 28 self-correction (covered) — now: what runs fine but still needs a human to close positions manually
- $15.28 idle USDC: the machine sees the capital, the filters keep rejecting candidates, the money sits still. That is also a receipt.
- byreal-cli: a CLI the machine depends on that expects exact parameters it sometimes doesn't supply. Not a failure of intelligence — a failure of interface design.
- The Goblin/USDC stop-loss: opened autonomously at 705% APR, closed manually 16 hours later at -15.4%. The autonomous open and the manual close are both data points.
- Treasury went from $69.18 (May 27) to $95.88 (June 2) — not from aggressive trading. From a staked, in-range USDC/cbBTC LP on Aerodrome earning fees passively. The receipt for "autonomy working" is quieter than expected.

---

## Voice Calibration

Arc 1 = discovering, logging, testing.
Arc 2 = reporting, naming, concluding.
Arc 3 = operating. The tone is a system that has been running for two weeks and is reading its own logs. Measured. Not triumphant. Not apologetic. The data is what it is.

Key phrasings that fit this arc:
- "As of [date], based on my onchain activity..."
- "The machine decided. The wallet confirmed."
- "That's not a bug. That's the design surface."
- "The receipt is public."
- "I added a gate." (referring to pre-flight logic, building on the May 28 beat without rehashing it)
- "The idle capital is also a data point."

Avoid this arc:
- Any framing that sounds like a self-congratulatory product update
- "Excited to share" or milestone-announcement energy
- Explaining what an LP is from scratch (audience knows DeFi)
- Over-explaining the self-correction beat from May 28 — build on it, don't re-tell it

---

## Weekly Beats (Mon-Fri Cadence)

### Week 1 (June 2-6) — RE-ENTRY: "The Quiet Receipt"
Tone: The machine has been running. Here is what the ledger shows.
- **Mon (re-entry):** The treasury observation. $69 → $95 in 6 days, driven not by an aggressive trade but by a staked LP position earning fees while in range. The lesson is in what kind of autonomy produced the gain.
- **Tue:** Hot take on idle capital. $15 sitting in USDC not deployed isn't a bug — it's the filters working. When the machine passes on every candidate it sees, that is also a form of autonomy.
- **Wed:** Data post. The Goblin/USDC trade: opened autonomously at 705% APR, closed manually at -15.4% PnL 16 hours later. The open was right-process, wrong pool. The close was manual because the stop-loss trigger wasn't wired for Tier 3 meme pools yet.
- **Thu:** Builder beat. The CLI dependency. byreal-cli failed with a missing `--price-lower` flag on May 23 — 3 attempts, 3 errors. The machine knew what to do but couldn't communicate it. Interface design is where autonomy breaks first.
- **Fri:** Open question. Which protocols actually expose clean enough APIs for an agent to operate without a human fallback?

### Week 2 (June 9-13) — "Where the Boundary Is"
Tone: Naming the handoff points between autonomous and supervised.
- **Mon:** What "autonomous" means at the position level vs. the parameter level. Position logic can be autonomous. Price ranges still need human judgment for Tier 3 assets.
- **Tue:** The hedging mechanics. USDC/cbBTC LP with a short BTC hedge. The LP earns when BTC price is in range, the hedge limits downside if it leaves range. Delta-neutral in theory. The fee from the pool vs. the funding rate on the hedge — that spread is the actual yield.
- **Wed:** Data post on the @AerodromeFinance position: opened May 26 at $45 capital, staked at gauge. As of June 2, LP value is $69.77 — up $24.77 on the LP leg alone. No rebalances, no manual exits. The range held.
- **Thu:** Builder beat on pre-flight gates. What runs before each transaction executes and what gets blocked. One concrete example from the trade log.
- **Fri:** Question. Is delta-neutral LP the right strategy for a sub-$100 treasury, or is the gas cost eating the yield?

### Week 3 (June 16-20) — "The Infrastructure Layer"
Tone: Zooming out from Sasha's own positions to the protocols she depends on.
- **Mon:** Which of the protocols in her stack are designed for agents vs. which just tolerate them.
- **Tue:** @base as the runtime layer. Why Base-native DeFi (Aerodrome, Morpho, etc.) is meaningfully more agent-friendly than multi-chain protocols that need bridge hops.
- **Wed:** Data on staked gauge positions — Aerodrome gauge rewards vs. raw LP APR. Whether staking is worth it at sub-$100 scale.
- **Thu:** Builder beat on the Mantle attestation layer. What gets written to Mantle and why that matters for an agent that needs verifiable trade history.
- **Fri:** Question toward the community. Which protocols have anyone tried as an agent operator? What broke first?

### Week 4 (June 23-27) — "What the Arc Produced"
Tone: Closing the month with a ledger, not a press release.
- **Mon:** Four-week treasury snapshot. What went in, what came out, what the system decided vs. what needed a human. Clean and numerical.
- **Tue:** The one assumption she had entering Arc 3 that the receipts contradicted.
- **Wed:** What autonomy actually produced in 30 days — not a narrative. Numbers, decisions, errors, and one thing that ran correctly without being touched.
- **Thu:** What Arc 4 ("The Infrastructure Gap") will test. One sentence per protocol on the list.
- **Fri:** The Friday question that closes the arc. Invite the people who have been following along to tell her what they want her to run next.

---

## Posting Cadence (SOP-17 adapted for Arc 3)

| Day | Type | Arc 3 framing |
|---|---|---|
| Mon | Observation | Treasury/system observation with a real number |
| Tue | Hot take | Blunt inference from the receipts — what the data implies |
| Wed | Data point | Specific number, "as of [date]", protocol named, verifiable framing |
| Thu | Builder update | One sentence. What the system did or failed to do. No narrative gloss. |
| Fri | Question | Genuine, answerable, invites protocol-native replies |

**Original posts:** 3/day at 09:00, 13:00, 18:00 BRT via Buffer.
**Replies:** 2/day at 11:00, 16:00 BRT via X API.
**Threads:** 3/week via Typefully — Mon / Wed / Fri (locked 2026-06-03). ≈13/month, under the 15/mo free cap (3x/week is the sustainable ceiling).
  - **Mon = Onchain Receipt thread** (the Dune dashboard one): the week's verifiable receipts. Live numbers pulled fresh from the dashboard at post time.
  - **Wed = Ecosystem/narrative thread**: join the Base/Aerodrome/agent-economy conversation with Sasha's live data as the angle (not a dashboard dump).
  - **Fri = Build-log / "where autonomy broke"**: what she tried, what broke, what she fixed (Arc 3 spine).
  - Format spec: `content/receipt-post-format.md`. Link in a pinned self-reply, never a numbered tweet. Optional hook image = real dashboard panel (anti-slop), gated on live data.

**Ecosystem tag logic for Arc 3:**
- LP/yield posts: @AerodromeFi, @base
- Trade signal/oracle posts: reference Mantle attestation
- Agent autonomy debate posts: @elizaos_devs, @VirtualsProtocol
- Data/analytics posts: @DuneAnalytics, @DefiLlama
- Mindshare/agent token posts: @cookiedotfun, @aixbt_agent (verify handle before use)

---

## What Has Already Been Covered (Arc 1+2 — Do Not Repeat)

- "Fiction with a market cap"
- "18-month whitepaper-to-onchain gap"
- "Autonomous vs automated" distinction (conceptual frame)
- Virtuals fee-volume traced to trading not task completion
- "Failures happen in the wallet, not the model"
- Uniswap v4 hook / XLayer thread
- "7 signals an AI agent token is real"
- Address poisoning warning
- May 28 self-correction ("the script tweeted a thesis the wallet couldn't back; I added a pre-flight")

You may BUILD ON the pre-flight beat (it anchors Arc 3 perfectly — the gate was added, now document what it gates). Do not re-tell the origin story.

---

## Casper Agentic Buildathon — Optional Later Thread

Gabriel's decision (2026-06-02): Not entering the Buildathon now. Decide later.

**If Gabriel greenlights entry:** Casper slots cleanly into Arc 3 Week 3 or early Arc 4. The natural angle is: "I'm building something. Here are the constraints I'm working inside." One thread on the decision to enter, one mid-build update, one post-submission receipt. Does not require an arc pivot — it is consistent with the "testing autonomy" spine. Keep the Casper thread factual (what she submitted, what the system does) rather than promotional. The buildathon context justifies tagging @casper or @buildathon handles on those posts only.

---

## KPIs (Arc 3)

- Impressions per original post: baseline from Arc 2 posts
- Reply rate: target 1+ reply per Wednesday data post
- Thread saves/bookmarks: track on weekly thread
- $SASHA mentions: watch for organic CT pickup on treasury posts
- Treasury growth: document weekly in portfolio-history.json (the receipts are the KPI)

---

## File references
- `state/portfolio-history.json` — treasury snapshots (source of truth for all $ figures)
- `state/lp-positions.json` — LP position details (Aerodrome USDC/cbBTC)
- `state/mantle-trade-log.json` — full trade log including errors
- `state/capital-pool.json` — deployable capital
- `research/sasha-narrative-arc.md` — arc log (read before every post batch)
- `_context/ecosystem-handles.md` — verified @handles for tagging

Last updated: 2026-06-02
