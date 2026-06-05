# Signal sources — endpoints, auth, fallback

All NAMES only; values live in `.env` (gitignored) and the VPS `.env`.

## Allora Network — `scripts/signals/allora.js`
- Endpoint: `https://api.allora.network/v2/allora/consumer/` (chain ethereum-11155111; topics 3 and 17).
- Auth: `ALLORA_API_KEY`.
- Returns: reputation-weighted SOL/USD log-return + 24h target.
- Fallback: on error/timeout → CoinGecko `simple/price` spot, judge flagged degraded.

## Elfa AI — `scripts/signals/elfa.js`
- Endpoint: `https://api.elfa.ai/v2/aggregations/trending-tokens` (SOL/MNT/USDC).
- Auth: `ELFA_API_KEY`. Cached endpoint notes: `.firecrawl/elfa-endpoints.md`.
- Fallback: mark judge degraded; do not block fusion.

## Polymarket — `scripts/signals/polymarket.js`
- Endpoint: `https://gamma-api.polymarket.com/events` (Solana exploit/hack odds → risk-off).
- Auth: none (public).
- Fallback: mark judge degraded.

## OpenRouter social bias — inside `scripts/mantle-signal.js`
- Endpoint: `https://openrouter.ai/api/v1` (model `google/gemini-2.5-flash`).
- Auth: `OPENROUTER_API_KEY` (falls back to `OPENAI_API_KEY`).
- Reads Sasha's recent posts to extract a directional bias.
- Fallback: if no key, skip this judge (not fatal).

## Prices — DefiLlama + CoinGecko
- DefiLlama: `https://coins.llama.fi/prices/current/{coinId}`, yields `https://yields.llama.fi/pools`. Cached docs `.firecrawl/defillama-api-docs.md`.
- CoinGecko: `https://api.coingecko.com/api/v3/simple/price` (fallback spot).
- Both public; on failure skip the affected mark rather than emit a bad number.

## Degradation contract
`mantle-signal.json` should record, per judge, whether it was `live | degraded | skipped`. The fused verdict must be derivable from live judges alone. Never let a single dead source flip the on-chain fee.