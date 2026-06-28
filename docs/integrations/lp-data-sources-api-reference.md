# LP Data Sources — API Reference (verified)

**Date:** 2026-06-04
**Status:** Live-verified against each API (not training knowledge). Field names, rate limits, and chain slugs confirmed by direct probes.
**Last auto-verified:** 2026-06-22 — all documented shapes OK (transient down: thegraph). Checked weekly by `scripts/signals/lp-data-source-verifier.mjs` (launchd `com.mangaos.lp-datasource-check`, Mondays 09:05).
**Purpose:** Exact endpoint/field spec for the pool-scanner v2 + dashboard pool-health rebuild.
**Companion:** strategy + the "why DefiLlama lies" proof live in [`research/lp-data-sources-methodology-2026-06-02.md`](../../research/lp-data-sources-methodology-2026-06-02.md). This file is the *how* (the API spec); that file is the *why* (the validated stack + fee-APR math).

**One-line stack:** DexScreener / GeckoTerminal for volume+TVL → The Graph for exact per-pool daily history + tick-level in-range depth (EVM) → on-chain `fee()` for the fee rate → compute fee APR yourself with 7d-avg volume → Revert `/v1/positions` as the realized-fee-APR cross-check. DefiLlama = discovery + token prices only, never CL fee APR.

---

## 1. DefiLlama — discovery + token prices only

| Surface | Base URL | Auth |
|---|---|---|
| Yields (free) | `https://yields.llama.fi` | none |
| Prices (free) | `https://coins.llama.fi` | none |
| TVL (free) | `https://api.llama.fi` | none |
| Pro (all + extras) | `https://pro-api.llama.fi/{KEY}/...` | key in **path** |

**Limits:** free = no key, no published RPM (Cloudflare soft-throttle, responses cached). `/pools` is a multi-MB payload of ~16.4k pools — poll in minutes, not seconds. Pro = $300/mo, 1,000 req/min, 1M calls/month.

**Endpoints we use:**
- `GET /pools` (yields host) → `{data:[...]}`, every pool's latest snapshot. Key fields: `chain`, `project`, `symbol`, `pool` (UUID), `poolMeta` (fee tier string, e.g. `"0.3%"` / `"CL50 - 0.05%"`), `tvlUsd`, `apy`, `apyBase`, `apyReward`, `apyBase7d`, `volumeUsd1d`, `volumeUsd7d`, `underlyingTokens[]`, `rewardTokens[]`.
- `GET /chart/{pool}` (yields host) → daily history for one pool (ISO-8601 timestamps).
- **Prices** (`coins.llama.fi`), IDs are `{chain}:{address}` lowercase, comma-batched:
  - `GET /prices/current/{coins}` → `{coins:{id:{price, decimals, symbol, timestamp, confidence}}}`
  - `GET /prices/historical/{unixSeconds}/{coins}`
  - `GET /chart/{coins}?span=N&period=1d` (regular-interval series)
  - `GET /block/{chain}/{unixSeconds}` → nearest block
  - **Gate on `confidence >= 0.9`.** Canonical WETH on Base = `0x4200000000000000000000000000000000000006`; native ETH via `coingecko:ethereum`.

**CL limitations (why we distrust its APY):**
- `il7d` is **always null** (0 / 16,437 pools) — compute IL yourself via `defi-lp-math`.
- `apy`/`apyBase` is **whole-pool, full-range-equivalent** — tells you nothing about a specific tick range. (Live ex: Base WETH-USDC 0.3% showed `apy: 205%` blended over $105M TVL.)
- `apyBase` null on ~10.5% of pools; `volumeUsd1d` present on only ~55% (95% of uni-v3); `volumeUsd7d` on ~44%.
- `tvlUsd` is aggregate, not in-range. No tick / sqrtPrice / per-tier liquidity.
- Daily granularity → lags intraday; CL ranges break in hours.
- **Verdict:** use for *discovery* (does the pool exist, rough TVL/vol, fee tier from `poolMeta`) and for *token prices*. Never rank capital on its APY.

---

## 2. GeckoTerminal — volume + TVL (validation)

- **Base URL:** `https://api.geckoterminal.com/api/v2` · OpenAPI 3.0.1
- **Pin schema:** `Accept: application/json;version=20230302`
- **Auth/limit:** no key, **30 calls/min** (authoritative FAQ figure; returns clean HTTP 429 JSON on breach — add backoff). Same data on CoinGecko Pro `https://pro-api.coingecko.com/api/v3/onchain/...` with `x-cg-pro-api-key` for higher limits.
- **Chain slugs:** `base`, `solana` (literal strings).

**Endpoints:**
| Path | Returns |
|---|---|
| `/networks/{network}/pools?sort=h24_volume_usd_desc&include=base_token,quote_token,dex` | top pools (20/page, max 10 pages = ~200) |
| `/networks/{network}/dexes/{dex}/pools` | top pools by DEX |
| `/networks/{network}/tokens/{token}/pools` | pools for a token |
| `/networks/{network}/pools/{address}` | single pool |
| `/networks/{network}/pools/multi/{addr1,addr2,...}` | **batch pools — one call, many pools** (use this to save budget) |
| `/networks/{network}/pools/{address}/ohlcv/day?aggregate=1&limit=7&currency=usd` | **7d volume** (sum index 5 of `ohlcv_list`) |
| `/search/pools?query=&network=` · `/networks/trending_pools?duration=24h` · `/networks/{network}/new_pools` | search / trending / new |

**Pool `attributes` (exact names):** `name` (**fee tier lives inside the name string**, e.g. `"WETH / USDC 0.01%"`), `address`, `base_token_price_usd`, `quote_token_price_usd`, `reserve_in_usd` (**= TVL**), `fdv_usd`, `market_cap_usd`, `pool_created_at`, `volume_usd{m5,m15,m30,h1,h6,h24}`, `price_change_percentage{...}`, `transactions{...:{buys,sells,buyers,sellers}}`. Relationships → `base_token`/`quote_token`/`dex` resolved via top-level `included[]`. `sort` only supports `h24_volume_usd_desc` / `h24_tx_count_desc` (no TVL/APR sort — re-rank locally).

**Limitations:** no fee tier field (parse from `name` or read on-chain), no fees/APR field, volume caps at h24 in the pool object (7d needs the OHLCV call = 1 extra call/pool → mind the 30/min budget), `reserve_in_usd` is whole-pool not in-range.

---

## 3. DexScreener — volume + liquidity (discovery, fastest)

- **Base URL:** `https://api.dexscreener.com` · fully public, no key.
- **Rate limits:** market-data endpoints (`/latest/dex/*`, `/tokens/v1/*`, `/token-pairs/v1/*`) = **300 req/min**; discovery/metadata (`/token-profiles/*`, `/token-boosts/*`, etc.) = **60 req/min**.
- **Chain IDs:** `base`, `solana` (slug strings, NOT numeric `8453`).

**Endpoints:**
| Path | Returns |
|---|---|
| `/latest/dex/pairs/{chainId}/{pairAddress}` | one pair (`{pairs:[Pair], pair:Pair}`) |
| `/token-pairs/v1/{chainId}/{tokenAddress}` | **all pools for a token on a chain** (bare array, ~30 cap) — workhorse for a per-token sweep |
| `/tokens/v1/{chainId}/{addr1,addr2,...}` | pairs for ≤30 tokens (bare array) — batch this |
| `/latest/dex/search?q=` | search (~30 cap) |
| `/token-profiles/*`, `/token-boosts/*`, `/metas/trending/v1` | discovery/metadata (60/min tier) |

**Pair fields (exact):** `chainId`, `dexId`, `pairAddress`, `labels[]` (pool *type* e.g. `["v3"]`/`["CLMM"]`, **not** fee tier), `baseToken{address,name,symbol}`, `quoteToken{...}`, `priceNative` (string), `priceUsd` (string|null), `txns{m5,h1,h6,h24:{buys,sells}}`, `volume{m5,h1,h6,h24}`, `priceChange{...}`, `liquidity{usd,base,quote}|null`, `fdv`, `marketCap`, `pairCreatedAt` (unix ms).

**Limitations:** no fee tier, no APR/fees, **volume caps at h24** (no native 7d — poll daily + average, or use GeckoTerminal OHLCV), `liquidity.usd` is total not in-range, prices are strings (parse first), ~30-pair caps, null-guard everything.

---

## 4. Revert Finance — realized fee APR (the trusted cross-check)

- **No documented API.** Their docs explicitly deny one. **But** the web app is backed by an undocumented, public, unauthenticated REST endpoint, verified live:
- **`GET https://api.revert.finance/v1/positions`** → `{success, total_count, data:[...]}` (CORS locked to `revert.finance`, so **server-side only** — fine for our scanner; browser calls blocked).

**Working query params (verified):**
| Param | Effect |
|---|---|
| `limit` / `offset` | pagination (default 100, tested to 1000) |
| `network=base` | chain filter |
| `exchange=aerodrome` | DEX filter |
| **`pool=0x...`** | **per-pool filter — this is the key for pool aggregation** (previously "not yet mapped") |
| `account=0x...` | one owner |
| `sort=fee_apr` | affects ordering |

Ignored params (don't use): `chain=`, `protocol=`, `order_by=`, `min_value=`, and `/v1/positions/{protocol}` path segments (segment ignored, returns global set). There is **no pool-aggregate endpoint** (`/v1/pools` = 404) — aggregate per `pool` yourself (TVL-weight `fee_apr`, count in-range).

**Per-position fields:** `in_range`, `pool`, `age` (days), `nft_id`, `underlying_value` (USD), `token0`/`token1`, `tick_lower`/`tick_upper`, `fee_tier`, `network`, `exchange`, `autocompounding`, `tokens{}`, and `performance.hodl{pnl, roi, apr, pool_pnl, pool_roi, pool_apr, il, fee_apr}` (decimal strings).
- **`fee_apr`** = realized **fee-only** APR (does NOT include divergence loss) — the number we trust. **`apr`** = total incl. divergence loss, gas, rewards.

**Coverage:** docs list Uniswap v2/v3/v4 + Sushiswap on ETH/Arbitrum/Polygon/Optimism/BNB/Unichain. **Live feed also returns Base + Aerodrome** (cbBTC/AERO present) despite not being in docs. **Solana = unconfirmed/likely absent** in this endpoint.

**Methodology (documented, the valuable part):** fee APR = accrued fees only; Pool PnL = `current underlying − deposited@current + withdrawn@current`; price divergence = `abs(token0_chg% − token1_chg%)` vs 30d ago. Backtested fee APR is **not** in the API — it's a separate open-source MIT tool: `github.com/revert-finance/revert-backtester` (ClojureScript; uses Uniswap v3 subgraph `poolHourData`). Replicate that engine if we want 7d/30d backtests.

**Integration caution:** undocumented → build defensively (schema-guard + graceful degradation + cache), always filter by network/exchange/pool (`total_count` ~600k — never fetch all), throttle (no published limit). Use as the **validation layer**, not the sole source. **Do not cite Revert as a "documented API" anywhere public.**

---

## 5. The Graph — subgraph data (tick-level depth + exact historical fees) ⭐

The most powerful source for CL math: subgraphs expose what no aggregator does — **per-tick liquidity** (in-range depth) and **exact per-pool daily/hourly history** (`volumeUSD`, `feesUSD`, `tvlUSD`, OHLC over any window). It's the layer Revert and the aggregators are built on. **Requires the `THE_GRAPH_API_KEY` key (auth) — so it's the one source the local verifier checks but the cloud routine cannot (no key in the cloud sandbox).**

- **Gateway (hosted service is dead — gateway only):** `https://gateway.thegraph.com`
  - **Path auth:** `https://gateway.thegraph.com/api/{KEY}/subgraphs/id/{SUBGRAPH_ID}`
  - **Bearer auth (preferred — keeps key out of the URL):** POST `https://gateway.thegraph.com/api/subgraphs/id/{SUBGRAPH_ID}` with header `Authorization: Bearer {KEY}`
  - All queries are **POST**, `Content-Type: application/json`, body `{"query":"..."}`. GET → 405.
- **Auth key:** `THE_GRAPH_API_KEY` (env). **Must be exactly 32 hex chars** — the gateway rejects anything else with `malformed API key`. (Our stored value arrived with ~119 junk chars appended; we trim to the first 32. The verifier asserts length 32.)
- **Free tier:** 100,000 queries/month, then rejected until upgrade. Growth plan = usage-based (credit card or GRT on Arbitrum), optional per-key USD cap. No published per-second rate limit — weekly scanner is a non-issue.

**Finding subgraph IDs:** the base58 Subgraph ID is on each subgraph's [Graph Explorer](https://thegraph.com/explorer) page (Query tab). **Explorer search results and blog IDs are unreliable** — several "Uniswap v3 Base/Arbitrum" hits resolve to the wrong schema (no `pools` field) or a mainnet-height index. **Always verify a new ID with `{ pools(first:1){id} _meta{block{number} hasIndexingErrors} }` before wiring it in.**

| Protocol / chain | Subgraph ID | Status |
|---|---|---|
| **Uniswap v3 — Ethereum** | `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV` | ✅ verified live (canonical, from Uniswap docs) |
| **Aerodrome — Base (Slipstream CL)** | `GENunSHWLBXm59mBSgPzQ8metBEp9YDfdqwFr91Av1UM` | ✅ verified live (full v3-style schema; top pool WETH/USDC 0.05%) |
| Uniswap v4 — Ethereum | `DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G` | ⚠ from docs, NOT tested (v4 uses hook addresses, different pool shape — verify schema first) |
| Uniswap v3 — Base / Arbitrum | (find via Explorer + verify) | ❌ search-surfaced IDs resolved to wrong schema; pull the real one and probe before use |

**Key CL entities (exact verified field names):**
- `pools(first, skip, orderBy, orderDirection, where)` — `id, feeTier, liquidity, sqrtPrice, tick, token0{symbol decimals}, token1{symbol decimals}, totalValueLockedUSD, volumeUSD, feesUSD, txCount`. (No `tickSpacing` on this schema.) `first` max 1000; pool IDs lowercase.
- `poolDayDatas` ⭐ (exact daily history → 7d/30d-avg) — `date` (unix, day-aligned), `volumeUSD, feesUSD, tvlUSD, liquidity, open, high, low, close`. Note: TVL field is **`tvlUSD`** here, **`totalValueLockedUSD`** on the pool entity.
- `poolHourDatas` — same, but the time field is **`periodStartUnix`** (not `date`).
- `ticks(where:{poolAddress})` — `tickIdx, liquidityGross, liquidityNet, price0, price1` → in-range depth. (Field is `tickIdx`, not `tick`.)
- `_meta { block { number timestamp } hasIndexingErrors }` — liveness/lag.

**Drop-in 7d query:**
```graphql
{ pool(id:"0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"){ id feeTier token0{symbol} token1{symbol} totalValueLockedUSD }
  poolDayDatas(first:7, where:{pool:"0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"}, orderBy:date, orderDirection:desc){
    date volumeUSD feesUSD tvlUSD liquidity } }
```

**What `feesUSD`/`tvlUSD` mean (do NOT over-trust):**
- **`feesUSD` is DERIVED, not realized.** Proven: a day with `volumeUSD 79.85M` had `feesUSD 39,926` = exactly `volumeUSD × feeTier/1e6` (0.05%). It's fees *generated by swaps*, not what LPs actually collected, and ignores in-range concentration. Good for fee-APR *estimation*; it is not on-chain realized yield. (Same as our own `volume × feeTier` math — but The Graph gives the exact historical volume so we don't have to poll.)
- **`totalValueLockedUSD`/`tvlUSD` are derived USD** (token `derivedETH × ETH price`) → inherit pricing error for thin tokens. **Order by `volumeUSD` and filter `volumeUSD_gt`/`txCount_gt`, never raw TVL** — a spoofed pool reported $1.1T TVL with 4 txns.

**Reliability:** assert `_meta.hasIndexingErrors === false` and check `_meta.block.timestamp` is within ~10 min of now on every call (a stalled indexer silently returns old numbers). Block/time-travel supported: `pool(id:"...", block:{number:N})`.

**Solana:** practically **EVM-only**. Orca/Raydium Substreams modules exist but there's no maintained public CLMM subgraph comparable to Uniswap's — stay on `byreal-cli` + Orca/Raydium SDKs + GeckoTerminal for Solana.

**Role in the stack:** the **Base + Ethereum (+ Arbitrum once verified)** source for (a) tick-level in-range depth and (b) exact historical daily volume/fees/TVL → cleanest realized-fee-APR window math. Keep the aggregators for discovery + Solana; The Graph is one layer below them.

---

## 6. Recommended scanner v2 flow

1. **Discover:** DexScreener `/token-pairs/v1/{chain}/{token}` (or DefiLlama `/pools` filtered by `chain`+`project`) → candidate pool list + rough TVL/vol/fee-tier.
2. **Validate volume + TVL:** GeckoTerminal `/pools/multi/{...}` (batch) → `reserve_in_usd` + `volume_usd.h24`; `/ohlcv/day?limit=7` per finalist for **7d-avg volume**.
3. **Exact history + in-range depth (EVM):** The Graph `poolDayDatas(first:7)` → exact daily `volumeUSD`/`tvlUSD` per pool (cleaner than polling), and `ticks` → in-range liquidity around current `tick`. This is the most accurate window-volume + concentration source for Base/Ethereum pools.
4. **Fee rate (ground truth):** on-chain `fee()` (`0xddca3f43`) — labels lie, esp. Aerodrome Slipstream dynamic fees. (The Graph `feesUSD` is derived `volume × feeTier`, not realized — use it for the volume, not as a fee oracle.)
5. **Compute fee APR yourself:** `fee_APR = (volume_7d_avg × fee_rate) / in_range_TVL × 365 × 100` (see methodology file).
6. **Emissions:** Aerodrome gauge `rewardRate()` (not Merkl); Merkl `/v4/opportunities?chainId=8453&status=LIVE` for non-Aerodrome incentives.
7. **Cross-check realized APR:** Revert `/v1/positions?network=&exchange=&pool=` → aggregate `fee_apr` per pool, compare to your computed figure.
8. **Token prices:** `coins.llama.fi/prices/current/{chain}:{addr}` (gate `confidence >= 0.9`).
9. **Hedgeability filter:** volatile leg must have a liquid Hyperliquid perp.

---

## Drift log

_Auto-maintained by the weekly verifier (`scripts/signals/lp-data-source-verifier.mjs`). Each entry = a change detected between the live API and the baseline signature; the prose above is corrected in the session following the alert. To accept a change as the new normal, re-run the verifier with `--rebaseline`._

- (no drift detected yet)
