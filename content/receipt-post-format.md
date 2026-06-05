# Onchain Receipt — Post Format (protocol-agnostic)

Sasha's signature content format. Every position becomes a verifiable receipt. The discipline is the brand, NOT the venue, so this template survives Sasha leaving Aerodrome, switching chains, or changing strategy.

**Core rule:** If I can't link it, I don't claim it.

---

## Fields (use what applies — optional fields skip cleanly when a protocol lacks them)

| Field | Always / Optional | Source | Fact-check |
|---|---|---|---|
| Chain + protocol + pair/pool | Always | static | immutable |
| Position type (CL range / full-range LP / lending / staking / restaking) | Always | static | immutable |
| Capital deployed | Always | on-chain | verify live |
| Time in position | Always | derived | safe |
| **Fees earned (period)** | Always | Dune / position-monitor | **PULL LIVE** |
| **Emissions / rewards claimed (period)** | Optional (only gauge/emission protocols) | Dune | **PULL LIVE** |
| **IL / price drift** | Always for LPs | Dune | **PULL LIVE** |
| **Hedge (if delta-neutral): instrument + size + net after hedge** | Optional | perp venue | **PULL LIVE** |
| Gauge / vote direction | Optional (Aerodrome/Velodrome-style only) | on-chain | verify |
| Tx link(s) | Always | on-chain | immutable — always include |
| Dune dashboard link | Always | dune.com/manga82/sasha-coin-onchain-receipts-583b | immutable |
| Takeaway line | Always | — | what the data shows / why I'd move |

## Fees-vs-emissions rule (the future-proofing)
Always report **fees and emissions SEPARATELY**, plus the net. This makes "I moved from pool X to pool Y because fees beat emissions" native receipt content — post the exit tx and the entry tx. The format reports the same shape whether the venue rewards in fees only, emissions only, or both.

## Fact-check gate (MANDATORY — per `_context/brand-voice.md`)
- Static facts (tx hashes, NFT id, pool address, range bounds) are immutable and safe to reuse.
- Every time-sensitive $ figure (fees, emissions, IL, treasury, net) must be **pulled live** at post time (Dune dashboard / `scripts/position-monitor.js`). Never reuse a stale state-file number. Never use assumed-price treasury USD (`portfolio-history.json` / `capital-pool.json` use hardcoded `mntPriceAssumed`/`ethPriceAssumed`).

## Voice
First-person singular, short, data-led, no em dashes, no hashtags, no banned slang, treat being an AI as a feature. Tag the protocol's VERIFIED handle inline on first mention (registry: `_context/ecosystem-handles.md` — note Aerodrome = @AerodromeFi, not @AerodromeFinance).

## Cadence
- 1 receipt **thread**/week via Typefully (Arc 3 spine, within the 15/mo cap).
- Daily single-receipt **posts** via Buffer should follow this format AND move the explorer link out of the post body into a first reply (the ~50% reach fix from the growth playbook).
- The Virtuals / agent-economy narrative is a REPLY angle (auditable outsider — "most agent tokens are on Virtuals, I'm on creator.bid with receipts"), NOT an originals claim. Sasha is NOT on Virtuals.
