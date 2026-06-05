# LP Miner — Phase 5: Chain-Agnostic Pool Hunting (DEFERRED)

**Status:** PARKED 2026-06-04. Decision: stick with Base for now (DEC-005). Revisit when a trigger below fires.
**Why parked:** A live multichain sweep (2026-06-04) confirmed Base already hosts the best stable/bluechip pools anywhere. Nothing on other chains beats it enough to justify the build + bridging now.

## What the multichain sweep found (2026-06-04, read-only)

Scanned Ethereum, Arbitrum, Base, Optimism, BSC, Polygon, Avalanche, Solana — stable/bluechip, TVL ≥ $1M, on-chain fee, 30d-avg volume. 25 pools cleared 15% fee APR. Verdict:

1. **Base wins, structurally.** Top two pools on the entire cross-chain board are Base Aerodrome Slipstream: **WETH/USDC ts100 ~246%** and **cbBTC/USDC ts100 ~89%**. Aerodrome's concentrated pools run huge volume/TVL ratios ($146M/day on $10M TVL) — that ratio is what mints fee APR, and no other chain matched it.
2. **One non-Base outlier worth a later look:** **Avalanche WAVAX/USDC on Pharaoh ~127%** ($3M TVL, AVAX hedgeable on HL). Caveats: smaller pool, thinner AVAX perp (wider hedge slippage), newer Ramses-fork DEX (more contract risk). A diversification second-position candidate, not a primary.
3. **Ethereum mainnet is now gas-viable but lower-APR.** Live gas was ~0.22 gwei → a full rebalance costs **~$0.32** (the old "mainnet gas trap" assumption was stale). But mainnet pools run 20-37% — deep, not high-turnover. Depth ≠ fee APR. No edge over Base.
4. **Solana inconclusive.** No `fee()` selector; the quick script fell back to the name label which Solana pools don't carry. Needs the dedicated Orca/Raydium fee-read path before it can be judged.

Gas per full rebalance, all chains, was negligible at current levels: ETH $0.32, Arbitrum $0.03, Base $0.008, everything else sub-cent.

## What building Phase 5 actually takes

The data plumbing is the easy ~70%; the honest scoring is the 30% that matters.

| Piece | Effort | Notes |
|---|---|---|
| GeckoTerminal + DexScreener discovery/TVL/volume | trivial | Already multichain. Change the network slug (`eth`, `arbitrum`, `bsc`, `polygon_pos`, `optimism`, `avax`, `solana`). |
| Dune `dex.trades` realized-volume validation | trivial | `blockchain` filter already covers all majors incl. solana. |
| On-chain `fee()` — EVM chains | easy (½ day) | Identical selector `0xddca3f43`; just a chain→RPC map (publicnode serves all). Non-Aerodrome fees are static tiers (simpler than Base). |
| On-chain fee — **Solana** | bespoke (½–1 day) | No `fee()`. Parse Orca/Raydium pool account or use their API. `solana-clmm` skill + `defi-lp-math` cover the math. |
| **Gas-aware net-APR scoring** | few hours | THE part that matters. Read live base fee per chain at scan time, subtract real rebalance cost scaled to position size + rebalance frequency. Don't *assume* gas, *measure* it (same principle as fee/volume). |
| Bridging/capital-logistics note | n/a (judgment) | Capital lives on Base/Solana/HL; entering another chain means bridge cost/time/risk. The scanner finds pools; capital routing is a separate cost. Hedge always runs on Hyperliquid regardless of LP chain. |

Estimated total: ~1.5–2 days. Reuse the locked `scripts/lp-scout.js` (classify/score/output logic is chain-independent) and parameterize a chain config from `docs/integrations/lp-data-sources-api-reference.md` (already lists chain slugs). The one-off sweep script lived at `/tmp/lp-scan-multichain.mjs`.

## Triggers to revisit (any one)

- Capital scales past the point where Base's two pools can absorb it without moving the price / diluting our fee share.
- A non-Base pool clears Base's best by a wide margin **net of gas, bridging, and hedge-leg liquidity** (not just gross APR) — e.g., the Avalanche Pharaoh pool sustains 100%+ over a calmer multi-month window with a usable AVAX hedge.
- We want a second, decorrelated LP position for diversification and Base has no good second pair.
- Solana gets its fee-read module (then it can finally be judged fairly).

## Out of scope for Phase 5

Hedge mechanics are unchanged — Hyperliquid hedges any chain's LP. Phase 5 is purely about *where to find the pool*, not how to hedge it.
