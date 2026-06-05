---
name: sasha-signal-fusion
description: Runtime reference for the multi-source risk signal — run each judge, fuse, and keep a dead feed from corrupting the on-chain signal. Mirror of the dev skill.
---

# Sasha Signal Fusion (runtime mirror)

`scripts/mantle-signal.js` fuses Allora + Elfa + Polymarket + social bias + prices into `content/mantle-signal.json`, which the oracle keeper pushes on-chain.

## Run
- Per source: `node scripts/signals/allora.js` · `node scripts/signals/elfa.js` · `node scripts/signals/polymarket.js`
- Fuse: `node scripts/mantle-signal.js [--dry-run]`
- Then: `node scripts/push-signal-to-xlayer.js`

## The honesty rule
A dead/timed-out source must **degrade** (mark that judge degraded and fuse the rest), never silently flip the on-chain fee to neutral/zero. `mantle-signal.json` should record per-judge status (live/degraded/skipped).

## Auth env (names only)
`ALLORA_API_KEY`, `ELFA_API_KEY`, Polymarket none, `OPENROUTER_API_KEY` (→`OPENAI_API_KEY`), DefiLlama/CoinGecko none.

Full version + per-source endpoints/fallbacks: dev workspace `.claude/skills/sasha-signal-fusion/`.
