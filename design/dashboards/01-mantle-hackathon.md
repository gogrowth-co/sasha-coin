# 01 — Mantle Hackathon Dashboard

**Project:** Sasha Coin — Mantle Hackathon 2026 submission
**Live data sources:** `state/mantle-trade-log.json`, `content/mantle-signal.json`, `state/erc8004-identity.json`, `state/capital-pool.json`
**Audience:** Hackathon judges (60-second scan), Crypto Twitter (shareable artifact)
**Hero question this dashboard answers:** *"Is this a real autonomous on-chain agent, or just a chatbot with a wallet?"*

---

## 1. Executive summary

This is not a portfolio dashboard. It is a **proof-of-life dashboard**. The judge gets 60 seconds before they swipe to the next submission. In those 60 seconds the dashboard must prove three things, in order:

1. There is an AI agent making decisions (the signal exists, with sources, weights, and a recommendation).
2. The agent acts on those decisions on-chain (the trade log shows real TXs).
3. The agent owns those decisions in public (the attestation on Mantle + the tweet that announced it are bound together as an unbroken chain).

The hero artifact is the **accountability chain**: a horizontal flow showing *Signal → Tweet → Trade TX → Attestation → Outcome*, each step a clickable on-chain link. If a judge clicks one link and lands on a real Mantlescan page, the submission has won.

Everything else on the dashboard is in service of that chain. Stat tiles support it. Charts contextualize it. The voice layer ("Sasha's note") makes it shareable.

**This dashboard is not for Gabriel.** Gabriel uses the LP Miner. This dashboard exists to win a hackathon and to generate a shareable artifact for Crypto Twitter.

---

## 2. Audience & stakeholder map

| Audience | Frequency | Time on screen | Primary goal | What they need to see in 5 seconds |
|---|---|---|---|---|
| **Hackathon judge** | Once | 60–120s | Validate "real, autonomous, on-chain" | Live signal + recent on-chain TX with attestation |
| **Crypto Twitter** | Once via shared link | 30s | "Is this dope?" | The accountability chain visual, ideally as a tweet image |
| **Mantle ecosystem team** | Once | 3–5 min | Evaluate fit for ecosystem grants | ERC-8004 identity #100, attestation pattern, trade volume |
| **Gabriel** | Daily during hackathon week | 30s | Confirm Sasha is up and pushing | "Last signal: 14 min ago. Last trade: 4h ago. All green." |
| **Sasha (the agent, via API)** | Continuous | n/a | Read her own state for posts | Same data via JSON endpoint, not UI |

The judge is the primary user. Every design decision is judged against: *would this make a tired hackathon judge stop scrolling?*

---

## 3. Jobs-to-be-done

Ranked by impact on judge conversion:

1. **JTBD-01: Verify autonomy in under 30 seconds.** *When the judge lands, they need to see a recently-generated signal and a recently-executed trade, both timestamped, both with on-chain links.* Success = judge clicks one TX link.
2. **JTBD-02: Verify the accountability chain.** *When the judge wants to know "is the tweet the agent posted actually tied to the trade?", they need a single visual that shows tweet ↔ trade ↔ attestation as one bound thing.* Success = judge says "huh, that's clever."
3. **JTBD-03: Understand the signal source mix.** *When the judge digs in, they need to see what data feeds the agent (Allora, Elfa, social, Polymarket, on-chain).* Success = judge believes the agent is not a coin flip.
4. **JTBD-04: Verify ERC-8004 identity.** *When the judge wants to confirm the agent has on-chain identity, they need the registry contract + agent ID + most recent attestation.* Success = judge sees identity #100 with at least one attestation in the last 24h.
5. **JTBD-05: Share the artifact.** *When Crypto Twitter sees this, they need one image worth tweeting.* Success = the accountability chain section is screenshot-shaped (16:9, no UI chrome around it when in "share mode").

JTBD-01 and -02 are critical. JTBD-03 and -04 are supportive. JTBD-05 is the upside.

---

## 4. Competitive teardown

Six dashboards studied for their handling of *autonomy + verification + narrative*:

| Reference | URL pattern | What works | What to steal | What to avoid |
|---|---|---|---|---|
| **dune.com (any embedded dashboard)** | dune.com/[user]/[dashboard] | The chart density is judge-friendly. Every number traceable to a query ID. | The "query link under every chart" pattern. Build a Mantle equivalent. | The bloated chrome above each chart. |
| **terminal.aixbt.tech** | terminal.aixbt.tech | The "agent thinking out loud" feed feels alive. | A vertical activity log on the right rail showing the last 10 things Sasha did. | The blurry purple gradients — too SaaS. |
| **debank.com/profile/0x…** | debank.com | The portfolio strip at the top is iconic — chains, value, 24h change. | The horizontal chain strip with live values. Reuse for capital-pool. | The ads. |
| **etherscan.io transaction page** | etherscan.io/tx/0x… | The "transaction succeeded" badge is reassuring. | The pattern of badge + hash + timestamp + counterparty on a single row. | Crowded info architecture. |
| **safe.global** | app.safe.global | Calm, restrained, professional. | The way they handle "wallet not connected" — clear, unalarming. | Slow load times. |
| **Vercel dashboard** | vercel.com/dashboard | Deployment cards as a timeline. | The vertical timeline pattern for the trade log. | Nothing — borrow liberally. |

**Two anti-patterns to actively reject:**

- The "many tiny charts in a 3×3 grid" Bloomberg trap. Judges will glaze. Pick one hero and three supports.
- The "agent personality is the whole dashboard" trap (we are not building a chatbot UI). Sasha's voice appears in *one* spot — the daily note — and the rest is data.

---

## 5. Data audit

### What exists and is reliable

| Source | File / Endpoint | Refresh | Reliability | Use for |
|---|---|---|---|---|
| Mantle trade log | `state/mantle-trade-log.json` | On trade execution (≤3/day) | High | Trade timeline, accountability chain |
| Mantle signal | `content/mantle-signal.json` | Every 8h via cron | High | Signal weights, recommendation tile |
| ERC-8004 identity | `state/erc8004-identity.json` | On registration + attestation | High | Identity badge, attestation list |
| Capital pool | `state/capital-pool.json` | After every trade | High | Capital strip |
| Mantlescan API | api.mantlescan.xyz/api?... | On demand | Medium (rate-limited free tier) | TX status confirmation, link generation |

### What is missing or broken

| Source | Problem | Mitigation |
|---|---|---|
| Allora API | 403 errors (per memory file) | Show source tile with "fallback active" badge. Do not hide. |
| Elfa API | 403 errors (per memory file) | Same. |
| Polymarket signal | Mocked weight 0.15, no real fetch path documented | Tile labeled "Polymarket — coming next deploy" |
| Tweet-to-trade binding | Not currently stored together; need to add `tweet_url` field to trade log | **Engineering pre-req:** update `scripts/auto-trade.js` to write the tweet URL into the trade log entry it appends. |

**Data audit recommendation:** before this dashboard is built, the trade log schema needs one new field per entry: `tweet_url`. Without it, the accountability chain (JTBD-02) cannot be drawn. This is a one-script change.

### Refresh strategy

- **Live (polling every 30s):** capital pool, latest signal, latest trade.
- **Push (websocket or SSE):** trade execution event, attestation TX confirmation. Use `aria-live="polite"` to announce.
- **Static (page-load):** ERC-8004 identity card, historical 30-day signal chart.
- **Manual refresh button** (top-right): clears cache, re-fetches everything. Useful during judge demo.

---

## 6. Information architecture

The dashboard is a **single scroll page**, not a multi-route app. Reasoning: judges do not click into sub-routes; they swipe down. Information architecture is a vertical narrative:

```
[Top strip — always visible]
  Logo · Status pill · "Last update: 14 min ago" · Mantlescan link · Share button

[Hero band — the 60-second story]
  H1: "Sasha is trading on Mantle, in public."
  Sub: "Autonomous AI agent. ERC-8004 identity #100. Every trade attested on-chain."

[Section 1 — The accountability chain]
  Hero visual. Signal → Tweet → Trade → Attestation, one bound row.
  Five most recent chains, stacked vertically. Each row links to four explorer pages.

[Section 2 — Live signal]
  Current recommendation card (large) + 5-source weight breakdown + 30-day signal history chart.

[Section 3 — Capital & positions]
  Capital strip (Mantle EOA, Solana, total). Active positions (1 currently).

[Section 4 — Trade log]
  Vertical timeline of last 8 trades. Each card: pool, action, capital, status, TX, attestation.

[Section 5 — ERC-8004 identity]
  Identity card with agent ID 100, registration TX, attestation count.

[Section 6 — Sasha's note]
  One paragraph in first-person. "Why I made today's trade." Updated daily by content-writer.

[Footer]
  Stack credits, contract addresses, links to GitHub repo.
```

Single page. No tabs. No nav drawer. The judge's mouse wheel is the navigation.

---

## 7. User flows (the only three that matter)

### Flow A — Judge cold-lands on dashboard

```
Land on dashboard
  → See hero band (1s)
  → See accountability chain row 1 (3s)
  → Hover on the trade TX hash → tooltip shows "Mantlescan, view"
  → Click → opens Mantlescan in new tab → sees real TX
  → Returns to dashboard
  → Scrolls down to signal section
  → Sees 5-source weight breakdown
  → Done. Forms verdict.
```

Total: 60–120s. Must not need login. Must not need wallet connect. Must work on mobile read-only.

### Flow B — Crypto Twitter shares the artifact

```
Land on dashboard (referred by Sasha's tweet)
  → Click "Share" in top strip
  → Modal: "Generate share image"
  → Three options: "Accountability chain", "Capital + identity", "Signal breakdown"
  → Pick → 1200×675 PNG generated server-side
  → Auto-prefilled tweet text: "Sasha's last trade, in full chain of custody: [URL]"
  → Posts to X
```

Share image generation is a backend job (Vercel OG, satori, or similar). Out of UI scope but in IA scope.

### Flow C — Gabriel checks Sasha is alive

```
Land on dashboard (saved as a bookmark)
  → Look at status pill in top strip
  → "Live · 14 min" = good
  → Look at trade log section
  → Most recent trade timestamp = sanity check
  → Done.
```

Total: 5s. The status pill is the hero of this flow.

---

## 8. Content strategy & microcopy

### Voice rules (per foundation doc, applied)

- Headlines: assertive, present tense. "Sasha is trading on Mantle." NOT "Sasha trades on Mantle" or "Welcome to Sasha's dashboard."
- Labels: nouns, no verbs. "Latest signal" not "View latest signal."
- Empty states: in Sasha's voice. "I haven't traded today. Reading the books. Check back at 18:00 BRT."
- Errors: factual, not apologetic. "Allora API returned 403. Falling back to social weight."
- Numbers: tabular figures (foundation enforces), accounting format with `+` or `−` prefix.

### Microcopy bank (write once, reuse)

| Slot | Copy |
|---|---|
| Page title | Sasha · Live on Mantle |
| Hero H1 | Sasha is trading on Mantle, in public. |
| Hero sub | Autonomous AI agent. ERC-8004 identity #100. Every trade attested on-chain. |
| Status pill — live | Live · last update {n} min ago |
| Status pill — stale | Stale · last update {n}h ago |
| Status pill — error | Signal pipeline down · investigating |
| Accountability chain title | Receipts |
| Empty chain | I haven't posted a trade chain today. Working on it. |
| Signal recommendation — risk-on | Lean risk-on. Confidence {n}%. |
| Signal recommendation — neutral | Holding. Confidence {n}%. |
| Signal recommendation — risk-off | Lean risk-off. Confidence {n}%. |
| Allora source — error state | Allora · fallback. 403 on last poll. |
| Trade log — successful | Trade {action} · {pool} · {capital_usd} · ✓ confirmed |
| Trade log — pending | Trade {action} · {pool} · {capital_usd} · pending {n} blocks |
| Trade log — error | Trade {action} · failed · {reason} |
| Identity card | ERC-8004 identity #100 |
| Sasha's note empty | No note yet. Writing one. |
| Footer | Built by Sasha. Contracts verified on Mantlescan. Code on GitHub. |

### Number formatting rules (these are non-trivial — agencies always miss them)

| Type | Format | Example |
|---|---|---|
| USD value > $10k | `$1,234,567` | $1,250,000 |
| USD value $1k–$10k | `$X.Xk` | $4.7k |
| USD value < $1k | `$X.XX` | $19.63 |
| Percent change | `+X.X%` / `−X.X%` (use minus sign, not hyphen) | +12.4% / −3.1% |
| APR | `X.X%` no sign | 123.9% |
| Address | `0xab12…cd34` | 0x7833…a4f1 |
| TX hash | `0xab12…cd34` | 0x9e44…0c2d |
| Timestamp (≤24h ago) | `n min ago` / `n h ago` | 14 min ago |
| Timestamp (>24h ago) | `MMM D` | May 24 |
| Block number | `block #{n,nnn,nnn}` | block #67,442,318 |

---

## 9. Aesthetic direction — three options

Each direction below would produce a recognizably different dashboard from the same component library. Pick one. The recommended direction is listed first.

### Direction A — "The Glass House" *(recommended)*

**Reference moodboard:** Vercel dashboard meets the Etherscan transaction page meets the Sasha Coin gold accent.

- Surfaces near-black, generous whitespace, single accent (Sasha Gold) used for one CTA per section.
- Typography: Inter Tight for headlines, Inter for body, JetBrains Mono for hashes. Hero numbers very large (56px), generous line-heights.
- Data: monochromatic with two-color encoding (positive green / negative red), no chart chrome.
- Personality: comes through in microcopy only. The pixels themselves are restrained.
- Why recommended: this aesthetic ages well, is judge-credible, screenshots well to Twitter, and matches the brand thesis ("calm transparency").

**Three reference URLs to study before mocks:**

- vercel.com/dashboard (layout, restraint, type hierarchy)
- etherscan.io/tx/[any] (badge + hash + timestamp pattern)
- linear.app/changelog (dense info, calm surface)

### Direction B — "Confessional Terminal"

**Reference moodboard:** Bloomberg Terminal + early Crypto Twitter posters + Sasha's first-person voice as a recurring text element.

- Surfaces darker still, denser, more data per square inch.
- Typography: monospace for half the UI. Yes, half. Numbers, labels, even some headlines.
- Data: amber-on-black for accent, green/red for PnL, very little white.
- Personality: blasts through. Sasha's voice appears in 3–4 places, not 1. The dashboard reads more like a journal.
- Why secondary: brilliant for Crypto Twitter virality, but judges might mistake it for "novelty over substance." High-risk high-reward.

**Three references:** bloomberg.com/markets, terminal.aixbt.tech, dexscreener.com.

### Direction C — "Galaxy Map"

**Reference moodboard:** a star map of agent activity. Each trade is a star. The signal is the gravity well.

- Surfaces black, more illustrative, more SVG-heavy.
- Typography: large display type, sparing body.
- Data: a single hero visualization — a radial timeline of trades — anchors the whole page.
- Personality: poetic. Sasha is "in orbit."
- Why tertiary: visually arresting but harder to verify. A judge may love it or write it off as "art project."

**Three references:** moontrack.io, recent NFT project landing pages, observablehq.com/@d3.

**Decision needed:** pick A, B, or C before mocks. My strong recommendation is A. B is the fallback if you want to lean harder into shareability. C is high-risk for a hackathon.

---

## 10. Tokens (Mantle-specific overrides only — inherits foundation)

Mantle-specific accent extension: when a number is *attested on-chain via Mantle*, it gets a faint gold underline (1px, `accent-primary` at 50% alpha) and a small ERC-8004 badge after the value. This is the only Mantle-specific token. Everything else uses foundation tokens.

Chain icons (resolve to small SVG inline):

- Mantle — official Mantle "M" mark
- Solana — official Solana mark
- Base — official Base "B" mark
- Ethereum — Ξ

---

## 11. Component inventory (Mantle-specific, new builds)

In addition to foundation components:

| # | Component | Purpose |
|---|---|---|
| M-01 | `AccountabilityChain` | Horizontal row: Signal pill → Tweet card → Trade card → Attestation badge → Outcome chip. Flex layout, mobile collapses to vertical stack. |
| M-02 | `SignalRecommendationCard` | Hero card. Recommendation label, confidence percent, 5-source weight bar, "valid until" timestamp. |
| M-03 | `SourceWeightBar` | Horizontal stacked bar, 5 segments, hover-detail per source (value, weight, last fetch, error state). |
| M-04 | `TradeTimelineCard` | Vertical card. Action, pool, capital, status, TX link, attestation link. Variants: pending, confirmed, failed. |
| M-05 | `ERC8004IdentityCard` | Identity #, registration TX, attestation count, "view registry" link to contract on Mantlescan. |
| M-06 | `SashasNote` | First-person paragraph. Markdown-rendered. Updated daily. Has "by Sasha · {timestamp}" footer. |
| M-07 | `CapitalStrip` | Horizontal strip. Three values: Mantle EOA, Solana wallet, Total. Each with a sparkline of 7-day balance. |
| M-08 | `ShareImageButton` | Top-right of relevant sections. Opens modal to generate 1200×675 PNG. |
| M-09 | `MantlescanLink` | Specialized `TxLink` variant. Auto-detects Mantle TX, formats hash, opens Mantlescan in new tab. |

---

## 12. Data visualization spec — Mantle dashboard

### Chart 1 — Signal recommendation (hero)

**Type:** Large card with a 5-segment horizontal stacked bar.
**Data:** weights from `content/mantle-signal.json`.
**Hierarchy:** the recommendation text (e.g. "Lean risk-on") is the hero, 36px, accent color. Confidence percent is sub, 24px mono. The 5-segment bar is below, ~60% width of card, 12px tall. Each segment hover-revealed.
**Empty state:** "Signal not yet computed. Next run: 18:00 BRT."
**Error state per source:** segment shows striped diagonal pattern + tooltip "API 403, fallback active."

### Chart 2 — 30-day signal history

**Type:** Line chart, single series. Y-axis: confidence score −1 to +1 (risk-off to risk-on). X-axis: 30 days.
**Data:** historical signals (requires backfill — engineering pre-req — currently only the latest is stored).
**Annotation:** vertical line at each trade-execution event. Hover shows "Trade executed: {pool} · ${capital}."
**Empty state:** "Building history. Need 7 days of signals first."

### Chart 3 — Trade outcomes (post-event)

**Type:** Horizontal bar chart, one bar per closed trade, color-coded.
**Data:** `state/mantle-trade-log.json` filtered to status: closed.
**Currently:** only 2 closes in data. So this chart is empty for now — design for both empty-state and 5+ trade state.

### Chart 4 — Attestation pipeline

**Type:** Progress bar / step indicator.
**States:** 1) Tweet posted, 2) Trade TX submitted, 3) Trade confirmed, 4) Attestation TX submitted, 5) Attestation confirmed.
**Always 5 steps. Color the completed steps gold, the active step accent-glow, the pending steps tertiary.**

### Chart 5 — Capital sparkline (per chain)

**Type:** Sparkline (80×24px), area-filled.
**Data:** `state/capital-pool.json` snapshots over 7 days.
**Pre-req:** capital snapshots need to be persisted nightly (currently overwritten). Engineering pre-req.

---

## 13. Screen specs

Two screens. One is the dashboard. The other is the share-image modal.

### Screen 1 — Main dashboard (single-scroll)

ASCII low-fi follows. Hi-fi mocks happen after aesthetic direction lock.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Sasha     ● Live · 14 min ago     Mantlescan ↗     [ Share image ]           │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│ Sasha is trading on Mantle, in public.                                         │
│ Autonomous AI agent. ERC-8004 identity #100. Every trade attested on-chain.    │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│ Receipts                                                                       │
│                                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │ Signal (risk-on) → Tweet ↗ → Trade 0xab12…cd34 ↗ → Attest ✓ → +2.1%   │    │
│ │ Signal (neutral) → Tweet ↗ → Trade 0x9e44…0c2d ↗ → Attest ✓ → −0.4%   │    │
│ │ Signal (risk-off) → Tweet ↗ → Trade 0x5a73…1b8e ↗ → Attest ✓ → +1.8%  │    │
│ │ … (5 most recent)                                                       │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│ Live signal                                              Capital pool          │
│                                                                                │
│ ┌──────────────────────────────────┐  ┌────────────────────────────────────┐   │
│ │ Lean risk-on                     │  │ Mantle    $0.65    ▁▂▃▄▅▆▇         │   │
│ │ Confidence 64%                   │  │ Solana    $19.63   ▇▆▅▄▃▂▁         │   │
│ │                                  │  │ Total     $20.28                   │   │
│ │ ▓▓▓▓ Social    ░░░░ Allora       │  │                                    │   │
│ │ ▒▒▒▒ Onchain   ▓▓▓▓ Polymarket   │  └────────────────────────────────────┘   │
│ │ ▓▓▓▓ Elfa·fb                     │                                          │
│ │                                  │  Active positions  ·  1 open             │
│ │ Valid until 18:00 BRT (+4h 12m)  │                                          │
│ └──────────────────────────────────┘                                          │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│ Trade log                                                                      │
│                                                                                │
│ ●  May 24 · 18:02   Open LP   SOL/USD1   $5.00   0xab12…cd34 ↗   Attest ✓   ▶ │
│ ●  May 23 · 18:01   Close LP  SOL/USD1   $4.81   0x9e44…0c2d ↗   Attest ✓   ▶ │
│ ●  May 22 · 09:14   Open LP   SOL/USD1   $5.00   0x5a73…1b8e ↗   Attest ✓   ▶ │
│ ○  May 22 · 09:08   Open LP   SOL/USD1   ERROR   slippage > 1%               ▶ │
│ ●  May 21 · 18:00   Open LP   SOL/USD1   $5.00   0x2d11…8a40 ↗   Attest ✓   ▶ │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│ Identity              ┌─── Sasha's note (May 24) ──────────────────────────┐   │
│ ERC-8004 #100         │ I leaned risk-on today. Social was hot, on-chain   │   │
│ Registered Mar 12     │ vol was building, Allora was down so I weighted    │   │
│ Mantlescan ↗          │ the rest accordingly. Opened a 0.3% range on       │   │
│ Attestations: 14      │ SOL/USD1. If I'm wrong, you'll see it close in     │   │
│                       │ 24h. Receipts above.                               │   │
│                       └────────────────────────────────────────────────────┘   │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│ Built by Sasha. Contracts on Mantlescan: SashaAgentLog 0x… · Registry 0x…     │
│ GitHub: github.com/… · Stack: Mantle · ERC-8004 · Node.js · Ethers v6          │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations to engineering:**

- The "Receipts" section is the visual JTBD-02 deliverable. It must be the most magnetic block on the page. Use the foundation `shadow-accent-glow` on the section frame.
- Each row in Receipts is a single `AccountabilityChain` instance.
- The status dot in the trade log (●) is gold for confirmed, hollow ○ for pending/error.
- The signal source weights are stacked horizontally in one bar; the labels below are a legend with dot indicators (no separate legend block).
- Sasha's note is `text-body-lg` with `text-secondary` color. Not boxed — just a quiet right-rail.

### Screen 2 — Share image modal

A modal that produces a 1200×675 PNG, server-rendered. UI presents three template choices:

1. **Receipts** (default) — top 3 accountability chain rows, large.
2. **Capital + identity** — capital strip + identity card, large.
3. **Signal breakdown** — recommendation card with source weights, large.

Modal layout: left half is preview (live updates as you toggle), right half is the three template choices + a "Tweet this" button (opens X compose with prefilled text and image).

### State coverage checklist (from foundation §11)

| State | Mantle dashboard treatment |
|---|---|
| Loading | Skeleton matches each block. Receipts: 5 dotted rows. Signal: a gray bar where recommendation goes. |
| Empty first-time | "Sasha hasn't traded yet. Watching markets. Check back at 09:00 BRT." |
| Empty intentional | "Sasha hasn't posted a trade chain today." (different copy from first-time) |
| Partial data | Allora/Elfa "fallback active" pill. Polymarket "coming next deploy" pill. |
| Error | Status pill turns warning yellow. Affected section shows error inline; rest of dashboard stays live. |
| Permission denied | Not applicable — dashboard is public. |
| Stale | If last signal >12h old, status pill goes yellow "stale · last update 13h ago." |
| Live | Status dot pulses 1s ease-in-out. |

---

## 14. Engineering handoff

### Pre-requisites (must ship before this dashboard goes live)

1. **`state/mantle-trade-log.json` schema update** — add `tweet_url` and `signal_id` fields to each entry. Without these, the accountability chain cannot be drawn. (Update `scripts/auto-trade.js`.)
2. **Signal history persistence** — currently only latest signal stored. Add nightly snapshot of `content/mantle-signal.json` to `state/mantle-signal-history.json` (append-only).
3. **Capital pool snapshots** — append-only `state/capital-pool-history.json`, snapshot every 6h.
4. **Backfill** — at least 7 days of signal history before the 30-day chart is meaningful. If hackathon deadline is sooner than 7 days from today, design must explicitly handle the "still gathering" state.

### Stack

- **Framework:** Next.js (App Router), TypeScript.
- **Styling:** Tailwind CSS with the foundation token export.
- **Components:** Radix UI primitives + shadcn/ui patterns where useful.
- **Charts:** Recharts.
- **OG image generation:** `@vercel/og` (satori) for the share images.
- **Data fetching:** Server components for static, SWR for live polling.
- **Hosting:** Vercel. Subdomain `mantle.sashacoin.[domain]` (decision needed).

### Routes

- `/` — the single-scroll dashboard.
- `/share/[template]` — server-side OG image endpoint.
- `/api/health` — health check for monitoring.

### Build sequence

1. Tokens → Tailwind config → Storybook foundational components (foundation §8 items 1–17).
2. Domain components (Mantle items M-01 through M-09).
3. Section assembly — Receipts first (it is the hero).
4. Live data wiring.
5. Share image generation.
6. Mobile read-only review.
7. Lighthouse + axe pass.
8. Judge dry-run with a real third party (someone who has never seen Sasha).

### Definition of done

Pull request includes:

- All components in Storybook.
- All 8 states demonstrated per relevant component.
- A real screenshot at 1440×900 in the PR description.
- A real screenshot at 375×812 in the PR description.
- An axe-core run with zero violations.
- A 60-second judge dry-run video (Loom or similar) attached.
- A note confirming the OG share image renders correctly when posted to X (test post to a private account first).

---

*End of Mantle Hackathon Dashboard brief. Next: OKX Hackathon (`02-okx-hackathon.md`).*
