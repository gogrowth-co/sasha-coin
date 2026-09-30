# LP Data-Source Verification — 2026-09-28

**Verdict:** OK — all sources match the doc
**Sources checked:** DefiLlama, GeckoTerminal, DexScreener, Revert, The Graph
**Doc:** `docs/integrations/lp-data-sources-api-reference.md`

| Source | Status | Missing documented fields | Drift vs baseline |
|---|---|---|---|
| defillama | LIVE | — | — |
| geckoterminal | LIVE | — | — |
| dexscreener | LIVE | — | — |
| revert | LIVE | — | — |
| thegraph | LIVE | — | — |

## Notes
- **defillama:** yields/pools: 17019 pools, 28 distinct fields · coins/current: ok (WETH $2687.818424872522, conf 0.99)
- **geckoterminal:** swagger: vv2-beta, 20 paths · base/pools: ok (20 on page 1)
- **dexscreener:** token-pairs/v1/base/WETH: 30 pairs
- **revert:** /v1/positions: ok (total_count 4571)
- **thegraph:** uniV3Mainnet: ok (block 26075877) · aerodromeBase: ok (block 51904122)

_Status legend: LIVE = matches the doc; DRIFT = 200 but documented field/shape changed (doc needs a prose fix); DOWN = unreachable/transient (no doc change implied)._
