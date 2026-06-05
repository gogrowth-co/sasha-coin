# Fusion + output — mantle-signal.js → content/mantle-signal.json

## Pipeline
1. `scripts/mantle-signal.js` calls each judge (Allora, Elfa, Polymarket, social bias), pulls prices (DefiLlama/CoinGecko), and fuses to a single risk verdict.
2. `scripts/pool-scanner.js` patches LP candidates into `mantle-signal.json` (weekly cron, Mondays 10:00 UTC).
3. `sasha-xlayer-oracle-keeper` reads `content/mantle-signal.json` and pushes the risk on-chain.

## Output file: content/mantle-signal.json
Treat it as the single source of truth for "what risk does Sasha currently see." It should carry, at minimum:
- the fused risk verdict (risk-on / neutral / risk-off),
- per-judge status (live / degraded / skipped) + raw values,
- a generated-at timestamp,
- LP candidates (patched by the pool scanner).

## Cron
- Signal fusion + oracle push: documented as every 6h in `HEARTBEAT.md`; the live oracle push runs every 2h via `/etc/cron.d/sasha-oracle`. The trade signal also runs inside `auto-trade.js` (3x/day) — `sasha-trade.log` shows `[signal] [A] Found 5 recent posts` etc.

## Debugging a wrong on-chain fee
1. `cat content/mantle-signal.json` — is the verdict sane and recent?
2. Re-run each judge in isolation (`scripts/signals/*.js`).
3. Check `sasha-trade.log` / `sasha-oracle.log` on the VPS for the last fusion + push.
4. Confirm no judge silently failed and dragged the verdict to neutral.