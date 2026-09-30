# LP Data-Source Verification — 2026-08-24

**Verdict:** OK with warnings (down: dexscreener, thegraph)
**Sources checked:** DefiLlama, GeckoTerminal, DexScreener, Revert, The Graph
**Doc:** `docs/integrations/lp-data-sources-api-reference.md`

| Source | Status | Missing documented fields | Drift vs baseline |
|---|---|---|---|
| defillama | LIVE | — | — |
| geckoterminal | LIVE | — | — |
| dexscreener | DOWN | — | — |
| revert | LIVE | — | — |
| thegraph | DOWN | — | — |

## Notes
- **defillama:** yields/pools: 16883 pools, 28 distinct fields · coins/current: ok (WETH $2490.877484381435, conf 0.99)
- **geckoterminal:** swagger: vv2-beta, 20 paths · base/pools: ok (20 on page 1)
- **dexscreener:** token-pairs DOWN: timeout
- **revert:** /v1/positions: ok (total_count 356365)
- **thegraph:** uniV3Mainnet: ok (block 25824919) · aerodromeBase DOWN: 0 timeout

_Status legend: LIVE = matches the doc; DRIFT = 200 but documented field/shape changed (doc needs a prose fix); DOWN = unreachable/transient (no doc change implied)._
