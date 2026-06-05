# Execution map — scripts, crons, state files

## Crons on the VPS (host /etc/cron.d/, all currently firing)
| File | Schedule (UTC) | Runs | Live? |
|---|---|---|---|
| sasha-lp-miner | `*/30` monitor; `3,33 * * *` rebalancer; `0 10 * * 1` scan | position-monitor.js; lp-rebalancer.js --execute; pool-scanner.js | yes |
| sasha-hedge | `*/30` | hedge-executor.js --execute (HEDGE_LIVE_OK=1) | yes |
| sasha-oracle | `0 */2` | push-signal-to-xlayer.js --force | yes |
| sasha-trade | `0 12,17,21` trade; `*/30` treasury-monitor; `0 11` yield report; `0 12 * * 1` yield tweet; `30 11` compound; `0 18 * * 0` dust | auto-trade.js; treasury-monitor.js; mantle-treasury.js; weekly-yield-tweet.js; dust-consolidator.js | yes |
| sasha-dashboard | `*/5` | xlayer-pool-state → snapshot → build-dashboard-data → lp-reconcile → deploy | yes |

> NOTE: there is **no** twitter-scheduled-post / twitter-reply-gal cron here — that gap is the social degradation, owned by `sasha-social-agent` + `sasha-distribution-liveness`.

## Signal → action data flow
```
state/lp-positions.json ──position-monitor.js──> content/lp-rebalance-signal.json ──lp-rebalancer.js --execute──> on-chain
                          (every 30m, read-only)        (CLAIM_FEES|CLOSE_REOPEN|DELEVERAGE|KILL)
content/mantle-signal.json ──auto-trade.js / push-signal-to-xlayer.js──> trade / oracle
state/lp-positions.json <──hedge-executor.js (HL short reconcile)
state/mantle-treasury.json <──mantle-treasury.js (stake/compound/report)
```

## Dry-run first, always
Every mutating script supports `--dry-run` (default-safe) and a separate `--execute`. npm aliases: `monitor:dry`, `trade:dry`, `hedge:*`, `lp:*`, `signal:dry`, `treasury`. Validate the signal/plan in dry-run, confirm with Gabriel, then `--execute`.

## Wallets (reads, not values)
- Agent EOA `0xba3BB32...` is the FROM address for txs and Dune queries (not the Safe `0x7833...`).
- HL hedge wallet `0xFAef67...`. Solana agent wallet via byreal-cli config (host-side `~/.config/byreal/keys/id.json`).
