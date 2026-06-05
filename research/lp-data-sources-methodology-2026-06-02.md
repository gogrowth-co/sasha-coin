# LP Data Sources — Precision Methodology (where to get fast + reliable pool data)

**Date:** 2026-06-02
**Purpose:** The validated data stack for finding and monitoring profitable LP pools. Feeds the pool scan and the dashboard pool-health v2. Built because DefiLlama lags and mis-derives fee APR on concentrated liquidity.
**Method:** Empirically benchmarked sources against Sasha's own USDC/cbBTC pool (known on-chain ground truth) + cross-checked with multi-model research (Perplexity web/forums, Grok CT consensus).

---

## The verdict: the stack serious LPs actually use

| Tier | Tool | Trust for | Notes |
|---|---|---|---|
| Discovery | **DexScreener** | broad real-time scan, volume spikes | open first; CT's default scanner |
| Validation | **GeckoTerminal** | real-time volume / TVL / liquidity | cross-check; CoinGecko-backed |
| Position truth | **Revert Finance** | range-specific fee APR, fees/TVL, IL, PnL | the LP gold standard; has API (see below) |
| Fee rate (ground truth) | **on-chain `fee()`** | exact current swap fee | mandatory; labels lie (esp. Slipstream dynamic fees) |
| Realized fees / custom window | **Dune** | exact fees over any window, backtest | precise but too slow for live decisions |
| Incentive APR | **Merkl** + **on-chain gauge** | reward/emission APR | Merkl = Angle/Uniswap/QuickSwap incentives; **Aerodrome emissions come from the gauge, not Merkl** |
| Discovery only — DISTRUSTED | **DefiLlama** | macro TVL reference | never trust for pool-level fee APR (see proof) |

**Daily workflow consensus:** DexScreener → GeckoTerminal → Revert, with on-chain/Dune as arbiter.

---

## Proof, on Sasha's own pool (USDC/cbBTC, `0x3e66…a9fb`)

- **GeckoTerminal vs DexScreener agreed to 0.1%**: TVL $2.939M vs $2.937M; 24h volume $8.844M vs $8.846M. Both fast, both accurate. → use either for volume/TVL.
- **On-chain `fee()` = 0.0350%** is the only reliable fee. GeckoTerminal's label said "1%" (wrong by ~28x); the dashboard said "0.0338%" (close). **Aerodrome Slipstream fees are dynamic, so labels must never be trusted.**
- **DefiLlama failed exactly as warned:** six conflicting "USDC-CBBTC" Base entries; the one matching our TVL claimed **783% fee APR vs the ~38% the on-chain math gives.** Also lists apyReward of 16-18% (plausible) but its apyBase is junk for CL. Use DefiLlama only to discover that a pool exists, never for the number.

---

## The precise fee-APR computation (do this, don't trust a label)

```
fee_rate   = on-chain fee() / 1e6            # hundredths-of-bip -> fraction (350 -> 0.000350)
daily_fees = volume_7d_avg * fee_rate        # use 7-DAY-AVG volume, not 24h (24h spikes in volatile weeks)
fee_APR    = daily_fees / TVL * 365 * 100
```

- **Use 7-day-avg daily volume**, not 24h. Validated: Sasha's pool showed 41% fee APR on the 24h snapshot (BTC -10% week inflated it) but **17% on the 7-day average.** The 24h number overstates during volatile weeks.
- **Volume + TVL** from GeckoTerminal or DexScreener (proven accurate). **Fee rate** from on-chain `fee()` (proven necessary). 7-day volume from GeckoTerminal OHLCV (`/pools/{addr}/ohlcv/day?limit=8`).
- **Emission APR** (Aerodrome): read the gauge `rewardRate()` (AERO/sec) × seconds/yr × AERO price / staked TVL. Do NOT trust the reconcile script's `pendingFeesUsd` field as an APR proxy (it implied ~172% on Sasha's pool; the gauge-derived figure is ~21%).
- **Hedgeability filter:** the volatile leg must have a liquid Hyperliquid perp (BTC, ETH, SOL, majors) for delta-neutral.

---

## API reference (so the dashboard can wire these)

- **GeckoTerminal:** `https://api.geckoterminal.com/api/v2/networks/base/pools?sort=h24_volume_usd_desc` (discovery), `/pools/{addr}` (TVL+vol), `/pools/{addr}/ohlcv/day?limit=8` (7d volume). No key needed (rate-limited ~30/min).
- **DexScreener:** `https://api.dexscreener.com/latest/dex/pairs/base/{addr}` (volume h24/h6/h1, liquidity, txns). No key.
- **On-chain (Base RPC `https://base-rpc.publicnode.com`, send a browser User-Agent):** `fee()` = `0xddca3f43`, `tickSpacing()` = `0xd0c93a7c`, `liquidity()` = `0x1a686502`. Gauge `rewardRate()` = `0x7b0a47ee`, `rewardToken()` = `0xf7c618c1`.
- **Revert Finance API (undocumented, works):** positions `https://api.revert.finance/v1/positions/account/{addr}?limit=100&active=false&with-v4=true` (cursor-paginated; `active=true` for open). **Pool-level filtering now mapped (2026-06-04):** `https://api.revert.finance/v1/positions?network=base&exchange=aerodrome&pool=0x...&limit=1000&offset=N` — `network`/`exchange`/`pool`/`account`/`sort=fee_apr` all work; returns per-position records (no pool-aggregate endpoint, aggregate `performance.hodl.fee_apr` per pool yourself). Server-side only (CORS locked to revert.finance). Full spec: [`docs/integrations/lp-data-sources-api-reference.md`](../docs/integrations/lp-data-sources-api-reference.md).
- **Merkl:** `https://api.merkl.xyz/v4/opportunities?chainId=8453&status=LIVE` (note: returns mostly non-Aerodrome incentives; Aerodrome uses its own gauge).

**Dashboard pool-health v2 should be built on GeckoTerminal + DexScreener + on-chain `fee()`/gauge, NOT DefiLlama.**
