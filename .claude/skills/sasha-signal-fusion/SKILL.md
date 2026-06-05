---
name: sasha-signal-fusion
description: Correct usage of Sasha's multi-source market-risk signal pipeline — Allora, Elfa, Polymarket, OpenRouter/Gemini social bias, CoinGecko and DefiLlama prices — fused into content/mantle-signal.json and pushed on-chain. Use when running, debugging, or extending the signal; or when a feed returns bad/empty data and you must keep the fused signal honest (degrade, never silently zero).
---

# Sasha Signal Fusion

`scripts/mantle-signal.js` fuses several independent "judges" into one risk verdict written to `content/mantle-signal.json`, which `sasha-xlayer-oracle-keeper` then pushes on-chain. The pool scanner also patches LP candidates into the signal.

## When to use
- Running/debugging the 6-hourly signal, adding a source, or diagnosing why the on-chain fee looks wrong.
- Before editing `scripts/mantle-signal.js` or anything in `scripts/signals/`.

## Correct-usage workflow
1. **Run a source in isolation first** to confirm it returns data:
   - `node scripts/signals/allora.js` (SOL/USD inference)
   - `node scripts/signals/elfa.js` (smart-mention trending)
   - `node scripts/signals/polymarket.js` (risk-off odds)
2. **Fuse:** `node scripts/mantle-signal.js` (`--dry-run` to preview). Writes `content/mantle-signal.json`.
3. **Push:** hand to `sasha-xlayer-oracle-keeper` (`push-signal-to-xlayer.js`).

## The honesty rule (most important)
A dead feed must **degrade**, not corrupt. If a judge errors/times out, mark it degraded and fuse the rest — never let one missing source silently push a neutral/zero signal on-chain. See `references/sources.md` for each source's fallback. Confirm `mantle-signal.json` records which judges were live.

## Sources at a glance
| Judge | Source | Env | Fallback |
|---|---|---|---|
| Price/inference | Allora (topics 3,17) | `ALLORA_API_KEY` | CoinGecko spot |
| Mentions | Elfa trending | `ELFA_API_KEY` | mark degraded |
| Risk-off | Polymarket gamma | none | mark degraded |
| Social bias | OpenRouter→gemini-2.5-flash | `OPENROUTER_API_KEY` (→`OPENAI_API_KEY`) | skip judge |
| Prices/yields | DefiLlama, CoinGecko | none | skip mark |

## Pool / LP data sources (what `pool-scanner.js` should trust)
DefiLlama (here as a price/yields judge) is **discovery + token-price only** for LP pools — its CL `apyBase` is unreliable (gave 783% vs ~38% on-chain on Sasha's own pool). For LP candidate volume/TVL/APR, the verified stack is GeckoTerminal/DexScreener (volume+TVL) → The Graph subgraphs (exact daily history + tick-level in-range depth on Base/Ethereum; needs `THE_GRAPH_API_KEY`) → on-chain `fee()` (rate) → Revert (realized APR), computed with 7d-avg volume. Full spec + weekly integrity check: `docs/integrations/lp-data-sources-api-reference.md`. That doc is auto-verified every Monday by `scripts/signals/lp-data-source-verifier.mjs` (launchd `com.mangaos.lp-datasource-check`) which probes all 5 sources incl. The Graph; if a source drifts, the doc's Drift log and the fleet dashboard flag it.

## Files & registry
- `scripts/mantle-signal.js`, `scripts/signals/{allora,elfa,polymarket}.js`, `scripts/pool-scanner.js`, `scripts/signals/lp-data-source-verifier.mjs`.
- Registry owner of Allora/Elfa/Polymarket/OpenRouter/Gemini/CoinGecko/DefiLlama rows.
- References: `references/sources.md`, `references/fusion-and-output.md`, `docs/integrations/lp-data-sources-api-reference.md`. Cached API docs in `.firecrawl/`.