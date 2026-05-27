# 02 — OKX Build X Hackathon Dashboard

**Project:** Sasha Coin — OKX Build X Hackathon 2026 submission (Uniswap v4 Hook on X Layer)
**Live data sources:** `state/xlayer-deployment.json`, `state/xlayer-oracle-pushes.json`, `docs/okx-buildx-hackathon-submission.md`
**Audience:** OKX / X Layer hackathon judges (technical scan), DeFi-literate evaluators
**Hero question this dashboard answers:** *"Is there really an AI agent setting dynamic swap fees on a live Uniswap v4 hook, and can I verify it on-chain right now?"*
**Deadline note (from memory):** May 28. This is the most time-constrained build.

---

## 1. Executive summary

This is a **verification dashboard for a technical judge**. The OKX judge is more sophisticated than the average Mantle judge — they will want to see the hook contract, the oracle contract, the pool, and the fee-adjustment mechanism, and they will want to verify each on X Layer's explorer (chainId 196). The dashboard's entire job is to make that verification *fast and undeniable*.

The hero artifact is the **fee response loop**: a visual showing *Sasha's signal → oracle push (on-chain) → hook reads oracle → swap fee changes*. The killer detail is the mapping: risk-off → 1.0% fee, neutral → 0.3%, risk-on → 0.05%. When a judge sees a real swap that paid a fee Sasha set, the submission wins.

Aesthetic: **the trading terminal.** This is the most minimal of the three dashboards. Mostly black, mono-heavy, one accent, dense but precise. No personality fluff. The OKX judge respects restraint and precision over voice. Sasha's voice gets *one* line, not a section.

**Critical constraint:** this ships fastest (May 28 deadline). The scope must be ruthless. If a section is not directly serving verification, cut it.

---

## 2. Audience & stakeholder map

| Audience | Frequency | Time on screen | Primary goal | First-5-seconds need |
|---|---|---|---|---|
| **OKX/X Layer judge** | Once | 90–180s | Verify hook + oracle + pool on-chain | Contract addresses with explorer links + last oracle push |
| **DeFi engineer evaluator** | Once | 3–5 min | Understand the hook mechanism | The fee-response loop diagram + signal→fee mapping table |
| **OKX ecosystem/grants** | Once | 5 min | Evaluate novelty and X Layer fit | "First autonomous agent setting v4 fees" claim + proof |
| **Gabriel** | A few times pre-deadline | 20s | Confirm the oracle is pushing | Last push timestamp + agent wallet balance |

The OKX judge is the only audience that matters for winning. The DeFi engineer is the judge's more skeptical inner voice. Design for both.

---

## 3. Jobs-to-be-done

1. **JTBD-01: Verify the contracts exist on X Layer.** *Judge needs the SashaOracle and SashaDynamicFeeHook addresses, each linking to a verified contract on X Layer explorer.* Success = judge clicks through to a verified contract.
2. **JTBD-02: Verify the pool is live.** *Judge needs the USDC/WOKB pool ID, with current liquidity and recent swaps.* Success = judge sees a real pool with real swaps.
3. **JTBD-03: Understand the fee-response mechanism.** *Judge needs to see how a signal becomes a fee — the mapping and a real example.* Success = judge says "so the AI is literally pricing the pool's risk."
4. **JTBD-04: Verify autonomy.** *Judge needs to see that oracle pushes happen on a schedule, by the agent, not by a human clicking a button.* Success = judge sees a feed of timestamped pushes with the agent's wallet as sender.
5. **JTBD-05: See the novelty claim substantiated.** *Judge needs the one-liner ("first AI agent setting dynamic v4 fees") tied to evidence.* Success = judge believes the claim.

JTBD-01, -02, -03 are critical. -04 supports autonomy. -05 is the framing.

---

## 4. Competitive teardown

Five references studied for *on-chain verification + protocol mechanism explanation*:

| Reference | What works | What to steal | What to avoid |
|---|---|---|---|
| **app.uniswap.org pool page** | The pool stat strip (TVL, vol, fee tier) is canonical. | The pool header pattern: pair, fee, TVL, 24h vol in one row. | Their hooks UI is immature — don't copy. |
| **info.uniswap.org** | Transaction table for a pool. | The "recent swaps" table: time, type, value, account. | Slow. |
| **oklink.com (X Layer explorer)** | This is where judges will verify. Match its visual language slightly so the handoff feels native. | The "verified contract" green check pattern. | Cluttered. |
| **dune.com hook dashboards** | Several v4 hook dashboards exist. The fee-over-time chart is the genre standard. | The "fee bps over time" step chart. | Query chrome. |
| **docs.uniswap.org/contracts/v4/concepts/hooks** | The hook lifecycle diagram. | A simplified version of the beforeSwap → getFee → swap flow. | Too academic for a dashboard. |

**Anti-pattern to reject:** explaining Uniswap v4 hooks from scratch. The judge knows what a hook is. Do not waste pixels on a v4 explainer. Show *our specific hook* doing *our specific thing*.

---

## 5. Data audit

### What exists and is reliable

| Source | File | Refresh | Reliability | Use for |
|---|---|---|---|---|
| Deployment addresses | `state/xlayer-deployment.json` | Static (deployed) | High | Contract cards, verification links |
| Oracle push log | `state/xlayer-oracle-pushes.json` | On each push | High (but only 2 entries currently) | Push feed, fee-over-time chart |
| Submission doc | `docs/okx-buildx-hackathon-submission.md` | Manual | High | Signal→fee mapping table source of truth |
| X Layer explorer (oklink) | oklink.com/xlayer/... | On demand | Medium | TX/contract verification links |

Known facts from data:

- SashaOracle: `0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74`
- SashaDynamicFeeHook: `0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080`
- Pool: USDC/WOKB, chainId 196, pool ID `0x4d3946dfb8ac9f3145e41b67e55eb2ffb02bf0c027c24ca8ffb3e55381f617cc`
- Fee mapping: risk-off 1.0% (10000 bps), neutral 0.3% (3000 bps), risk-on 0.05% (500 bps)
- Agent wallet: ~0.037 OKB remaining

### What is missing or thin

| Gap | Problem | Mitigation |
|---|---|---|
| Only 2 oracle pushes logged | Fee-over-time chart and push feed look empty | **Pre-deadline action:** run more pushes before judging. Failing that, design the 2-entry state to look intentional, not broken. |
| No swap data ingestion | Cannot show "swaps that paid Sasha's fee" | Query X Layer subgraph or oklink API for pool swaps. If not feasible by deadline, show pool liquidity only and label swaps "indexing." |
| No pool TVL/liquidity fetch | Pool card has no live TVL | Fetch from pool contract via RPC (slot0 + liquidity). |
| Agent wallet balance | Low (0.037 OKB) — risk of pushes failing | Show balance with a warning threshold; if it runs dry mid-judging the dashboard must degrade gracefully. |

### Refresh strategy

- **Live (30s poll):** last oracle push, agent wallet balance, pool liquidity.
- **Static (page-load):** contract addresses, fee mapping, pool ID.
- **On-demand:** explorer links (no fetch, just hrefs).

---

## 6. Information architecture

Single-scroll page, even tighter than Mantle. Five blocks:

```
[Top strip]
  Logo · "X Layer · chainId 196" · ● Oracle live · oklink ↗

[Hero band]
  H1: "Sasha prices this pool's risk. On-chain. Autonomously."
  Sub: "An AI agent setting dynamic swap fees on a Uniswap v4 hook. X Layer."

[Section 1 — The fee response loop]  ← HERO
  Diagram: Signal → Oracle push (TX) → Hook reads → Fee = X%
  + the live fee right now, large.

[Section 2 — Verify it]
  Three contract cards: Oracle, Hook, Pool. Each with address, verified badge, explorer link.

[Section 3 — Signal → fee mapping]
  The mapping table (risk-off/neutral/risk-on → bps) + current state highlighted.

[Section 4 — Oracle push feed]
  Vertical feed of pushes: timestamp, signal, fee set, TX link, sender = agent wallet.
  + fee-over-time step chart.

[Section 5 — Pool activity]
  Pool stat strip + recent swaps table (or "indexing" state).

[Footer]
  Novelty claim + GitHub + stack credits.
```

---

## 7. User flows

### Flow A — Judge verifies the submission (the only flow that matters)

```
Land
  → Read hero: "AI agent setting dynamic v4 fees" (3s)
  → See fee response loop + current fee = 0.3% (5s)
  → Scroll to "Verify it"
  → Click Hook contract → oklink → sees VERIFIED contract (15s)
  → Back. Click Oracle contract → verified (10s)
  → Scroll to mapping table → understands risk→fee logic (15s)
  → Scroll to push feed → sees timestamped pushes from agent wallet (15s)
  → Click a push TX → oklink → real TX (10s)
  → Verdict formed (~90s)
```

No login, no wallet connect, mobile read-only acceptable.

### Flow B — Gabriel pre-deadline check

```
Land
  → Top strip: ● Oracle live (2s)
  → Push feed: last push timestamp (3s)
  → Agent wallet balance: is it above warning threshold? (3s)
  → Done.
```

The agent wallet balance is the anxiety metric here — at 0.037 OKB it could run dry. Surface it prominently for Gabriel; keep it quiet for judges.

---

## 8. Content strategy & microcopy

### Voice rules

Most restrained of the three. Sasha's first-person voice appears in exactly one line (the fee loop caption). Everything else is precise, technical, terse.

### Microcopy bank

| Slot | Copy |
|---|---|
| Page title | Sasha · Dynamic Fee Hook · X Layer |
| Hero H1 | Sasha prices this pool's risk. On-chain. Autonomously. |
| Hero sub | An AI agent setting dynamic swap fees on a Uniswap v4 hook. X Layer, chainId 196. |
| Fee loop caption (Sasha's one line) | When I read risk, I make this pool more expensive to trade. When I read calm, I make it cheap. |
| Current fee label | Current swap fee |
| Verify section title | Verify it |
| Contract verified badge | Verified on X Layer |
| Mapping table title | How a signal becomes a fee |
| Push feed title | Oracle pushes |
| Push entry | {time} · signal {label} · fee set {bps} bps · {tx} ↗ |
| Pool section title | Pool activity |
| Swaps indexing state | Indexing recent swaps. Verify directly on oklink ↗. |
| Wallet warning (Gabriel-facing) | Agent wallet low: {balance} OKB. Top up before deadline. |
| Novelty footer | First autonomous AI agent setting dynamic Uniswap v4 fees on X Layer. Code on GitHub. |

### Number formatting

Inherits foundation rules. Additions:

| Type | Format | Example |
|---|---|---|
| Fee in bps | `{n} bps` | 3000 bps |
| Fee in percent | `{n.nn}%` | 0.30% |
| OKB balance | `{n.nnn} OKB` | 0.037 OKB |
| Pool ID | `0xabcd…1234` (truncated, copy button) | 0x4d39…17cc |

---

## 9. Aesthetic direction — three options

### Direction A — "Trading Terminal" *(recommended)*

**Moodboard:** Uniswap pool page restraint + oklink explorer credibility + a single amber accent for the live fee.

- Near-black, mono-forward (addresses, bps, pool ID all in JetBrains Mono).
- One hero number: the current fee, 56px mono, gold.
- Charts: a single fee-over-time step chart, monochromatic.
- Zero illustration. The fee loop is drawn with simple boxes and arrows, not graphics.
- Why recommended: matches judge expectations, fastest to build (critical given May 28), maximally credible.

**References:** app.uniswap.org pool page, oklink.com/xlayer, linear.app.

### Direction B — "Mechanism Diagram"

**Moodboard:** a beautiful technical schematic, like a circuit diagram of the hook.

- The fee response loop is rendered as a polished animated SVG: signal flows through the oracle into the hook into the pool, with the fee value animating as it changes.
- More illustrative, more memorable, slower to build.
- Why secondary: stunning if executed well, but risky on a tight deadline. The animation is the whole value and animations eat time.

**References:** docs.uniswap.org hook diagrams, stripe.com/docs architecture diagrams, observablehq.

### Direction C — "Live Tape"

**Moodboard:** a Bloomberg-style scrolling tape of oracle pushes and swaps.

- The whole dashboard is organized around a live, scrolling feed. Pushes and swaps interleave chronologically.
- Feels alive, but with only 2 pushes logged it will feel empty until more data exists.
- Why tertiary: data-dependent, and we are data-thin right now.

**Decision:** strongly recommend A given the May 28 deadline. B only if there is slack. C needs more push volume first.

---

## 10. Tokens (OKX-specific)

- Single chain context: X Layer. Chain pill uses X Layer brand color as a 1px accent only.
- The "current fee" number is the one place `accent-primary` gold is used at full 56px scale — it is THE hero metric.
- Fee state colors map to data colors: risk-off uses `data-negative` (expensive = caution), neutral uses `data-neutral`, risk-on uses `data-positive` (cheap = go). This double-encodes the fee logic with color, reinforcing comprehension.

---

## 11. Component inventory (OKX-specific)

| # | Component | Purpose |
|---|---|---|
| O-01 | `FeeResponseLoop` | The hero. Signal box → arrow → Oracle push box → arrow → Hook box → arrow → Fee output. Current fee value large at the end. |
| O-02 | `CurrentFeeDisplay` | 56px mono number, color-coded to fee state, with "as of {time}" and "set by signal {label}" sub-text. |
| O-03 | `ContractCard` | Contract name, truncated address, copy button, verified badge, "view on oklink" link. Three instances: Oracle, Hook, Pool. |
| O-04 | `FeeMappingTable` | 3-row table: signal label, bps, percent, color swatch. Current state row highlighted with accent border. |
| O-05 | `OraclePushFeed` | Vertical feed. Each entry: timestamp, signal label, fee set, TX link, sender address. |
| O-06 | `FeeOverTimeChart` | Step line chart. Y-axis fee bps. X-axis time. Steps colored by fee state. |
| O-07 | `PoolStatStrip` | Pair, fee tier, TVL, 24h volume, pool ID (truncated + copy). |
| O-08 | `RecentSwapsTable` | Time, type (buy/sell), value, account. Has "indexing" empty state. |
| O-09 | `OklinkLink` | `TxLink` variant for X Layer. Detects chainId 196, links to oklink.com/xlayer. |

---

## 12. Data visualization spec — OKX dashboard

### Hero — Fee response loop

**Type:** Horizontal flow diagram (boxes + arrows), not a chart.
**Layout:** `[Signal: risk-on] →(oracle push TX)→ [Hook reads oracle] →(beforeSwap)→ [Fee: 0.05%]`
**The final fee box is the hero** — large, color-coded, with the live value.
**Empty state:** if no push yet, show the loop greyed with "Awaiting first push."

### Chart 1 — Fee over time (step chart)

**Type:** Step line (not smooth). Fee changes are discrete events, so steps are honest; a smooth line would lie.
**Y-axis:** fee in bps (or toggle to %). **X-axis:** time.
**Color:** each segment colored by fee state (negative/neutral/positive data colors).
**Annotation:** each step labeled with the signal that caused it on hover.
**Current data:** 2 pushes = 2 steps. Design the 2-step state to read as intentional ("2 pushes so far") not broken. Show a "next push: {time}" annotation.

### Mapping table

**Type:** 3-row table. Not a chart, but a first-class viz.
**Visual:** each row has a color swatch matching its fee state. The currently-active row gets an accent-glow border and a "← live now" tag.

### Pool stat strip

**Type:** Horizontal KPI strip. TVL, 24h vol, fee tier, pool ID.
**Live:** TVL and volume poll every 30s.

---

## 13. Screen specs

Single screen, single scroll. ASCII low-fi:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Sasha     X Layer · chainId 196     ● Oracle live · 22 min ago     oklink ↗  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│ Sasha prices this pool's risk. On-chain. Autonomously.                         │
│ An AI agent setting dynamic swap fees on a Uniswap v4 hook.                     │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐      ┌──────────────┐      ┌────────────┐                        │
│  │ Signal   │─push→│ SashaOracle  │─read→│ Hook       │── beforeSwap ──┐       │
│  │ risk-on  │  TX  │ on-chain     │      │ getFee()   │                │       │
│  └──────────┘      └──────────────┘      └────────────┘                ▼       │
│                                                            Current swap fee     │
│  "When I read risk, I make this pool                          ┌──────────────┐ │
│   expensive. When I read calm, cheap."                        │   0.05%      │ │
│                                                               │   500 bps    │ │
│                                                               └──────────────┘ │
│                                                          set by signal: risk-on │
├────────────────────────────────────────────────────────────────────────────────┤
│ Verify it                                                                      │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────────────┐  │
│ │ SashaOracle        │ │ SashaDynamicFeeHook│ │ Pool USDC/WOKB             │  │
│ │ 0xfE53…5c74  [copy]│ │ 0xe1ae…9080 [copy] │ │ 0x4d39…17cc  [copy]        │  │
│ │ ✓ Verified  oklink↗│ │ ✓ Verified oklink↗ │ │ TVL $— · vol $—   oklink↗ │  │
│ └────────────────────┘ └────────────────────┘ └────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────┤
│ How a signal becomes a fee                                                     │
│ ┌──────────────────────────────────────────────────────────────────────────┐  │
│ │ ▮ risk-off    1.00%   10000 bps                                          │  │
│ │ ▮ neutral     0.30%    3000 bps                                          │  │
│ │ ▮ risk-on     0.05%     500 bps   ← live now                             │  │
│ └──────────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────┤
│ Oracle pushes                          Fee over time                           │
│ ● 22m ago · risk-on  · 500 bps · 0x…↗  │   1.0% ┤▔▔▔▔▔▏                       │
│ ● 8h ago  · neutral  · 3000 bps · 0x…↗ │   0.3% ┤      ▔▔▔▔▏                  │
│   sender: 0xba3B…32 (agent)            │   0.05%┤           ▔▔▔▔▔             │
│                                        │        └──────────────────           │
├────────────────────────────────────────────────────────────────────────────────┤
│ Pool activity                                                                  │
│ USDC/WOKB · dynamic fee · TVL $— · 24h vol $—                                  │
│ Recent swaps: indexing. Verify directly on oklink ↗.                           │
├────────────────────────────────────────────────────────────────────────────────┤
│ First autonomous AI agent setting dynamic Uniswap v4 fees on X Layer.          │
│ GitHub: github.com/… · Stack: Uniswap v4 · X Layer · Solidity · Ethers        │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**

- The fee response loop is the visual anchor. The current-fee box at the end of the loop is the single hero number of the whole dashboard.
- The "← live now" tag on the mapping table reinforces JTBD-03 instantly.
- The push feed shows the sender address (agent wallet) explicitly — this is the autonomy proof (JTBD-04). Make "agent" label unmissable.
- Pool TVL/vol show `$—` until RPC fetch lands; do not show $0 (reads as broken).

### State coverage

| State | OKX treatment |
|---|---|
| Loading | Loop greyed, contract cards skeleton, fee number shimmer. |
| Empty | "Awaiting first oracle push" on loop; push feed "No pushes yet." |
| Partial | Pool TVL `$—` with "fetching" if RPC slow; swaps "indexing." |
| Error | Oracle status pill yellow if last push failed; show reason. |
| Stale | If last push >24h, pill yellow "stale · 26h ago." |
| Live | Oracle dot pulses. Fee number count-up animates on change. |
| Wallet low (Gabriel) | Yellow banner top of page, only visible to Gabriel (or always, small). |

---

## 14. Engineering handoff

### Pre-requisites (before judging, ideally before build-freeze)

1. **Run more oracle pushes.** 2 entries is thin. Aim for ≥6 with varied signals so the fee-over-time chart and feed look substantive. This is an operational task, not a code task — schedule pushes ahead of judging.
2. **Pool liquidity fetch.** Add an RPC call (slot0 + liquidity) so the pool card shows real TVL. If subgraph available on X Layer, prefer it.
3. **Swap data.** Query X Layer subgraph/oklink for pool swaps. If infeasible by May 28, ship the "indexing" state honestly and rely on the oklink link.
4. **Agent wallet top-up.** 0.037 OKB risks running dry. Top up before judging window opens.
5. **Contract verification.** Confirm both contracts show as Verified on oklink before launch. If not verified, verify them — a green check is half the JTBD-01 win.

### Stack

Same as Mantle (Next.js + Tailwind + Radix + Recharts). Shares the foundation token export and component library, so building this second is cheaper than building it first. **Build sequence recommendation: build the shared component library during the Mantle dashboard, then OKX reuses 80% of it.**

### Routes

- `/` — single-scroll dashboard.
- `/api/pool` — server route fetching pool liquidity via X Layer RPC.
- `/api/health` — monitoring.

### Build sequence (compressed for deadline)

1. Reuse foundation components from Mantle build.
2. Build O-01 (fee loop) and O-02 (fee display) first — they are the hero.
3. Contract cards (O-03) + mapping table (O-04) — these are the verification core.
4. Push feed (O-05) + fee chart (O-06).
5. Pool strip + swaps (O-07, O-08) — ship "indexing" state if data not ready.
6. Wire live data.
7. Lighthouse + axe.
8. Verify every explorer link resolves to a real, verified oklink page (this is the make-or-break QA step).

### Definition of done

- Every contract/TX link resolves to a real oklink page (manually click all of them).
- Both contracts show Verified.
- ≥6 oracle pushes visible in the feed.
- Fee response loop renders with the live current fee.
- Real screenshot at 1440×900 in PR.
- axe-core zero violations.
- A DeFi-literate third party verifies the submission cold in under 2 minutes (record it).

---

*End of OKX Hackathon Dashboard brief. Next: LP Miner (`03-lp-miner.md`).*
