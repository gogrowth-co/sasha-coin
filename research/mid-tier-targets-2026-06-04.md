# Mid-Tier Reply Target Research: Sasha Coin X Growth Sprint
# 2026-06-04

## Verification Method

Every handle in the `targets` array was cross-checked by two independent methods:

1. **Grok live X search** (`x-ai/grok-4.20:online` via OpenRouter) — real-time X data pull with date filters May 15 to June 4, 2026. Confirmed account existence, approximate follower count, and active posting in the window.
2. **Apify tweet scraper** (`CJdippxWmn9uRfooo`) via `apify-rotate.js` — `from:HANDLE` query returning 3 recent tweets, extracting `author.followers` from the API response. This gives a machine-verified follower count at time of scrape (June 4, 2026).

Any handle where both methods agreed is marked **VERIFIED**. Handles where Grok found the account but Apify returned `no_tweets` or a low follower count (<2k) are placed in `unverified_candidates`. Handles that Grok could not find on X at all are excluded entirely.

**Apify actor:** `CJdippxWmn9uRfooo` | **Scrape date:** 2026-06-04 | **OpenRouter model:** `x-ai/grok-4.20:online`

---

## Ready-to-Merge JSON `targets` Array (Verified Only)

```json
[
  {
    "handle": "wagmiAlexander",
    "tier": 2,
    "followers_approx": 20732,
    "topics_of_interest": [
      "Aerodrome Finance",
      "Velodrome Finance",
      "veAERO mechanics",
      "DeFi liquidity strategy",
      "Base ecosystem",
      "Dromos Labs dashboards"
    ],
    "sasha_angle": "Alexander is the Dromos Labs / Aerodrome core contributor who posts gauge vote data and LP dashboards — Sasha replies with her own live epoch data: fees claimed, gauge weight direction, and auto-claim tx link from the same pool he's analyzing."
  },
  {
    "handle": "BaseCaptainHB",
    "tier": 2,
    "followers_approx": 17490,
    "topics_of_interest": [
      "Base ecosystem",
      "AI agents on Base",
      "onchain builders",
      "Base momentum",
      "agentic economy"
    ],
    "sasha_angle": "BaseCaptainHB tracks Base builders and lists active AI infra projects — Sasha replies to his ecosystem roundups as a working example of the agent economy he describes, with her cross-chain footprint (Aerodrome LP + Mantle treasury + Byreal) as the receipt."
  },
  {
    "handle": "LukeYoungblood",
    "tier": 2,
    "followers_approx": 23665,
    "topics_of_interest": [
      "MoonwellDeFi",
      "Mamo agentic finance",
      "open financial systems",
      "Base DeFi",
      "Ethereum infrastructure"
    ],
    "sasha_angle": "Luke builds Mamo — an agentic finance layer on Base — which is the exact infrastructure stack Sasha runs on; she replies to his product threads with first-person usage data from that stack, not cheerleading."
  },
  {
    "handle": "Tanaka_L2",
    "tier": 2,
    "followers_approx": 45656,
    "topics_of_interest": [
      "AI agents",
      "agent tokens",
      "Base ecosystem",
      "DeFi thesis",
      "Sei",
      "Mantle",
      "rebase experiments"
    ],
    "sasha_angle": "Tanaka posts theses on AI agents as onchain business infrastructure and agent token economics — Sasha's $VIRTUAL token on creator.bid with a live Aerodrome LP is precisely the model he theorizes; she replies with actual revenue and LP data from the position."
  },
  {
    "handle": "Okada_DeFi0x",
    "tier": 2,
    "followers_approx": 31059,
    "topics_of_interest": [
      "DeFi alpha hunting",
      "Virtuals Protocol",
      "low-to-mid cap research",
      "protocol analysis",
      "onchain deep dives"
    ],
    "sasha_angle": "Okada runs Virtuals maxi research threads and deep protocol dives — Sasha replies to his agent GDP and mindshare breakdowns with the 32% non-trading-bot data she represents: on-chain skill attestations, LP receipts, and cross-chain activity that survive his fact-check filter."
  },
  {
    "handle": "Ark_carmelo",
    "tier": 2,
    "followers_approx": 33087,
    "topics_of_interest": [
      "AI agents",
      "crypto regulatory landscape",
      "stablecoins",
      "DeFi builders",
      "Web3 infrastructure",
      "system design"
    ],
    "sasha_angle": "Carmelo posts macro-level AI agent + regulatory takes where the policy implications touch what Sasha does — she replies to his agent compliance and stablecoin infrastructure threads with specifics: her x402 micropayment flow and what the 'Automated account' label means operationally for a live agent."
  },
  {
    "handle": "DjGriffith",
    "tier": 2,
    "followers_approx": 9075,
    "topics_of_interest": [
      "microcap AI agent infrastructure",
      "onchain research tools",
      "distributed compute",
      "agent infrastructure tokens",
      "builder spotlights"
    ],
    "sasha_angle": "Griffith surfaces and spotlights builders in the agent infra space — Sasha replies as a live deployment of the agent compute stack he researches, with specific metrics on what her running costs and yield returns look like on that infrastructure."
  },
  {
    "handle": "defivas",
    "tier": 2,
    "followers_approx": 7534,
    "topics_of_interest": [
      "Velvet Capital",
      "VU Virtuals",
      "AI x crypto",
      "DeFi portfolio tools",
      "Virtuals ecosystem"
    ],
    "sasha_angle": "Defivas builds Velvet Capital (DeFi portfolio automation) and VU Virtuals — Sasha replies to his product threads on the agent-DeFi intersection with her actual portfolio automation receipts: which pools she shifted, why, and what the net P&L was."
  },
  {
    "handle": "Kairos_Res",
    "tier": 2,
    "followers_approx": 9440,
    "topics_of_interest": [
      "onchain analytics",
      "wallet flow analysis",
      "protocol TVL and volume",
      "DeFi data research",
      "institutional onchain"
    ],
    "sasha_angle": "Kairos Research posts proprietary wallet flow and TVL data — Sasha replies to their onchain analysis threads by contributing her own transparent agent wallet flows as a data point: what an autonomous LP manager actually moved and when, with tx links."
  },
  {
    "handle": "AlphaSeeker21",
    "tier": 2,
    "followers_approx": 58517,
    "topics_of_interest": [
      "first-principles crypto research",
      "distributed compute",
      "AI agent infrastructure",
      "machine-to-machine commerce",
      "low-cap conviction plays"
    ],
    "sasha_angle": "AlphaSeeker posts first-principles conviction research on the agent compute economy including x402 machine-to-machine commerce — Sasha replies to these threads with her actual x402 micropayment receipts from her skill attestations, converting his thesis into verifiable on-chain data."
  },
  {
    "handle": "0x_Osprey",
    "tier": 2,
    "followers_approx": 11271,
    "topics_of_interest": [
      "Aerodrome Finance",
      "DeFi on Base",
      "AI agent traffic",
      "agentic DeFi commentary"
    ],
    "sasha_angle": "Osprey posts Aerodrome commentary including AI agent traffic data on Base — Sasha replies to his agentic DeFi threads from the inside, with her LP position performance, not general commentary."
  },
  {
    "handle": "aaronjmars",
    "tier": 3,
    "followers_approx": 12434,
    "topics_of_interest": [
      "autonomous agent frameworks",
      "Aeon framework",
      "agent simulations",
      "AI agent building",
      "token unlock mechanics"
    ],
    "sasha_angle": "Aaron builds the Aeon autonomous agent framework and posts agent simulation research — Sasha replies as a live production deployment: not a simulation, but a real agent with a public wallet running LP positions and skill attestations since her genesis, with concrete behavioral receipts."
  }
]
```

---

## Unverified Candidates

These handles were surfaced by Grok live search as relevant but could NOT be verified by the Apify scraper with sufficient follower counts (below 5k, returned no tweets, or Grok itself could not confirm the exact handle). Do NOT load these into `reply-targets.json` until on-platform manual verification is run.

| Handle | Issue | What Grok Said | Action |
|---|---|---|---|
| `QuantumCred` | Not found on X in any search pass | Cited in previous ecosystem-conversation-map research; surfaced in early Grok pass but subsequent verification returned no account | Remove entirely. Prior research may have been based on a misread handle. |
| `Charlie85270R` | Exists, but 604 followers (Apify confirmed) | Builds @OctavFi LP analytics tool; highly relevant content, tiny following | Add to watch list; re-evaluate at 2k+ followers |
| `signalseeker_v1` | Exists, but 40 followers (Apify confirmed) | Posts about Base + Virtuals agent tracking | Too small; monitor, do not target |
| `Def7771` | Exists, but 914 followers (Apify confirmed) | Posts Base ecosystem on-chain data | Too small; monitor |
| `0x7_anderson` | Exists, but 2,021 followers (Apify confirmed) | Virtuals maxi research, Base ecosystem | Close but below threshold; monitor |
| `degenpark_eth` | Exists, but ~30 followers (Grok confirmed) | Ships agents on Base | Way too small |
| `ssynq_ai` | Exists, but ~21 followers (Grok confirmed) | Trust/reputation layer research | Way too small |
| `danfinlay` | 32,379 followers (Apify confirmed), but last tweet April 24 2026 | MetaMask co-founder, wallet UX | Inactive for 6+ weeks — skip until activity resumes |
| `0xSplits` | 5,876 followers (Apify confirmed), but last tweet Dec 2025 | Revenue-sharing protocol | Inactive for 6 months — exclude |
| `Tokenomist_ai` | 73,381 followers (Apify confirmed) — above range | Weekly token unlock digests, emissions tracking | Above 50k ceiling; treat as a stretch target only; reply during unlock events when directly relevant |

---

## Keep / Drop Recommendation for Current Mega-KOL Handles

**Context:** The June 2026 research consensus is unanimous — mega-KOL replies (100k+ followers) generate views but near-zero follows because the reply gets buried in hundreds of others. The correct ratio is 70-80% mid-tier, 20-30% mega-KOL. Mega-KOL replies are still worth doing but only inside the 5-15 minute post window and only when the tweet is directly in Sasha's niche.

The current `reply-targets.json` has 8 tier-1 handles, 6 tier-2, and 2 tier-3. All 8 tier-1 are mega-KOLs. The sprint requires re-weighting.

### KEEP (Fast-Window Only — reply within 5-15 min, niche-relevant posts only)

| Handle | Followers (Apify/Grok verified) | Keep Rationale |
|---|---|---|
| `jessepollak` | ~353k | Base protocol creator; every Base ecosystem thread is Sasha's home turf; she can always contribute a specific on-chain data point from her Base LP |
| `virtuals_io` | ~289k | Core protocol — Sasha is a Virtuals-native agent; protocol updates, ACP v2, agent GDP announcements are her most relevant reply material |
| `aixbt_agent` | ~471k | Peer agent; agent-to-agent replies read authentic; Sasha's onchain receipts differentiate her from AIXBT's narrative-only output |
| `cookiedotfun` | ~189k | Posts agent mindshare/metrics data — Sasha's receipts add a dimension (verifiable on-chain behavior) that Cookie.fun's mindshare score doesn't capture |
| `shawmakesmagic` | ~163k | ElizaOS creator; builder-to-agent tone works; Shaw's threads on agent rails are exactly where Sasha's "I ran it in production" angle lands |
| `creatorbid` | ~156k | Sasha's token is live on this platform; she has standing as a participant in every CreatorBid thread |

### DROP (Remove from daily scrape pass; keep handles for manual use only)

| Handle | Followers | Drop Rationale |
|---|---|---|
| `MilesD` | ~672k | Now handles @milesdeutscher; content shifted to general AI/agent workflows — not DeFAI-specific enough for Sasha's niche angle; reply pool is extremely crowded |
| `CryptoWendyO` | ~465k | General DeFi education; Sasha's onchain-receipt angle rarely fits her threads; prior blocklist incident (donations/lobby tweet) confirms risk |
| `sassal0x` | ~298k | General Ethereum commentary; rarely DeFAI/agent-specific; Sasha's unique angle has limited entry points in his threads |
| `rleshner` | ~1.05M | 1M+ followers; reply burial is severe; primarily DeFi protocol/lending (less DeFAI/agent niche); the risk/reward at this scale is poor |
| `tayvano_` | ~90k | Wallet security focus; overlaps with DeFAI only occasionally; confirmed low reply activity from her side; not worth daily scrape |
| `OnChainWizard` | ~77k | 77k is mid-large, not mega; content overlaps but his reply pool is crowded and recent activity is unclear; consider adding back to mid-tier list if activity is confirmed |
| `DefiIgnas` | ~161k | Good research but general DeFi — Sasha's angle is agent-specific; DefiIgnas rarely posts DeFAI content; keep for quarterly check, not daily |

### UPGRADE RECOMMENDATION

Move `creatorbid` and `virtuals_io` from tier-1 to tier-2 in the JSON (they are protocol-specific, not mega-broadcast KOLs in the traditional sense). Their reply pools are smaller and more topically concentrated — Sasha can get more visibility there than on jesse/rleshner.

---

## Notes on Verification Confidence

| Account | Apify Verified | Grok Verified | Confidence |
|---|---|---|---|
| wagmiAlexander | 20,732 followers, tweet Jun 4 | Active, content confirmed | **High** |
| BaseCaptainHB | 17,490 followers, tweet Jun 4 | Active, content confirmed | **High** |
| LukeYoungblood | 23,665 followers, tweet Jun 4 | Active, content confirmed | **High** |
| Tanaka_L2 | 45,656 followers, tweet Jun 4 | Active, content confirmed | **High** |
| Okada_DeFi0x | 31,059 followers, tweet Jun 4 (×2 scrapes) | Active, content confirmed | **High** |
| Ark_carmelo | 33,087 followers, tweet Jun 3 (×2 scrapes) | Active, content confirmed | **High** |
| DjGriffith | 9,075 followers, tweet Jun 4 (×2 scrapes) | Active, content confirmed | **High** |
| defivas | 7,534 followers, tweet Jun 4 | Active, content confirmed | **High** |
| Kairos_Res | 9,440 followers, tweet Jun 4 (×2 scrapes) | Active, content confirmed | **High** |
| AlphaSeeker21 | 58,517 followers, tweet Jun 4 | Active, content confirmed | **High** — above 50k range but niche-aligned |
| 0x_Osprey | 11,271 followers, tweet Jun 4 | Active, sarcastic/Aero commentary | **High** |
| aaronjmars | 12,434 followers, tweet Jun 4 | Active, Aeon framework | **High** |

**Unresolved:** QuantumCred — this handle was cited in the prior ecosystem-conversation-map research but could not be found in any X search pass or via Apify. Likely based on a misread handle from an earlier research pass. Treat as void until confirmed on-platform.

---

## Sprint Usage Note

Load the 13 `targets` entries into `reply-targets.json` alongside the reduced mega-KOL list. Suggested daily allocation at 7-10 replies/day:
- 5-7 replies: mid-tier accounts (tier-2/3 above)
- 2-3 replies: mega-KOL keep list (fast-window only, niche-relevant tweets only)

For accounts like `Tanaka_L2` (45k) and `Okada_DeFi0x` (31k) at the upper end of the range, apply the same reply-age filter (post < 30 min old, < 30 existing replies) — they get enough traffic that timing still matters.

---

*Research Agent | 2026-06-04*
*OpenRouter cost estimate: ~$0.18 (7 Grok-4.20:online calls at standard rates)*
*Apify cost: 2 batches × 12 handles each via key-rotation pool*
