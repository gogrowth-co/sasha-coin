# LP Miner — Pool Migration Plan (gated, capital-moving)

**Created:** 2026-06-03 (from the 2026-06-02 pool scan)
**Status:** QUEUED. Do not start until the precondition is met.
**Why:** The current pool nets ~−$0.80/7d (real `gauge.earned()` = 0.44 AERO, not the projected $1.485). A same-pair, same-hedge pool yields ~6x. Per DEC-002 the unit cannot stay negative.

## Inputs (all on disk — read first, do not re-derive)
- `research/lp-pool-scan-2026-06-02.md` (ranking + 5 caveats + open precision item)
- `research/lp-data-sources-methodology-2026-06-02.md` (precise data stack: GeckoTerminal/DexScreener/on-chain `fee()`, NOT DefiLlama)
- `docs/decision-log.md` DEC-001/DEC-002 (proof artifact; must net positive; pool selection is the lever)
- `reports/lp-miner-performance-2026-06-02.md` (the −$0.80 correction)

## Key facts
- Current: pool `0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb` (USDC/cbBTC ts2000), NFT 71397771, gauge `0x9B55cb6cAe1e303B5EDce6F9fcf90246D382809c` (~17% fee / ~21% emission, −$0.80/7d)
- Target: pool `0x4e962bb3889bf030368f56810a9c96b83cb3e778` (cbBTC/USDC ts100, ~$11M TVL, ~$128M/day 7d-avg vol, on-chain fee ~0.028%, ~118% durable fee APR)
- Hedge: Hyperliquid BTC short, wallet `0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04`

## PRECONDITION (do not start until true)
The corrected dashboard is deployed AND verified live on `pages.dev/lp-miner` (shows marked-to-market value + range bar). It is the instrument used to verify this migration. No migrating blind.

## Sequence (each capital-moving tx is a [NEEDS APPROVAL] gate — flag before signing)
1. **Resolve the open precision item:** does the target ts100 pool have an Aerodrome gauge, and its emission APR? Decide fee-collect (unstaked) vs stake-for-emissions in the NEW pool. At ~118% fee APR, collecting fees likely dominates — verify on-chain, don't assume.
2. **Rebalancer gate:** ts100 is far tighter than ts2000. Test `lp-rebalancer.js` against ts100 in dry-run/sim BEFORE real funds (range placement, OOR behavior, gas). Do NOT migrate if it isn't proven at ts100.
3. **Pre-mortem:** run the pre-mortem skill on the full plan (autonomous capital path). Bake mitigations in.
4. **Execute (gated):** unstake from current gauge → withdraw liquidity from the ts2000 NFT → swap to target composition → open position in the ts100 pool → stake-or-collect per step 1 → re-confirm/re-size the BTC hedge for the new position's delta → log to state.
5. **Hold size at ~$45** for this first migration. Do not scale until the ts100 rebalancer is proven over real cycles.

## Safety
Diff local↔VPS before any deploy (one-writer rule). Verify every on-chain tx hash. Do not claim the migration is done until the new position is observed live on the dashboard with the BTC hedge re-matched. State the proof to check, do not assert success.

## Verify
New ts100 position shows on the dashboard, in-range, net delta ~0, fees accruing.

## Recommended thread order (three concurrent sasha-coin workstreams)
dashboard deploy → distribution-liveness audit + content-engine fix → THIS pool migration.
Fixing whether Sasha can speak comes before optimizing what her treasury earns.
