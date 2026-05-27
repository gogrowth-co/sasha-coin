# Dashboard Deploy & Data Pipeline

Three live dashboards, one data pipeline, one security contract. Built 2026-05-26.

## What exists

```
web/
  index.html              landing (links the three)
  mantle/index.html       Mantle: trading-in-public + accountability + signal
  okx/index.html          X Layer: dynamic fee hook
  lp-miner/index.html     multi-chain LP book + live reconciliation (?ops=1 for ops view)
  <each>/data/dashboard.json   public-safe data (the ONLY thing published)
```

All three are static (HTML + vanilla JS, no build step). They `fetch('./data/dashboard.json')` on load and poll every 60s. They degrade gracefully: a missing/failed data file shows an error banner, not a blank page.

## The data pipeline (runs where the truth is: the VPS)

Order matters. Live reads first, then the export, then the reconciliation overlay:

```
npm run dash:build
# = xlayer-pool-state.js   → state/xlayer-pool-state.json   (live X Layer oracle read)
#   snapshot-state.js      → signal/capital history          (trend data)
#   build-dashboard-data.js → web/<dash>/data/dashboard.json  (PUBLIC-SAFE export, allowlist)
#   lp-reconcile.js        → patches lp-miner json with live Base NFT liquidity (UNFUNDED check)
```

Individual scripts:
- `node scripts/build-dashboard-data.js [--src <dir>] [--dry-run]` — the security contract. Allowlist export; nothing is published unless explicitly copied. Has a secret-leak guard.
- `node scripts/lp-reconcile.js [--src <dir>] [--dry-run]` — live Base RPC (multi-endpoint failover) reads NFT liquidity; stamps each position funded / UNFUNDED / unverified.
- `node scripts/xlayer-pool-state.js` — live oracle fee/risk/freshness + agent OKB balance.
- `node scripts/snapshot-state.js` — appends signal + capital history points.

### Suggested VPS cron (HEARTBEAT)

```
*/5 * * * *  cd <workspace> && npm run dash:build   >> /var/log/sasha-dash.log 2>&1
```

5-minute refresh is plenty for judging ("updated N min ago" is shown on every panel).

## The public-safe schema (the contract)

`build-dashboard-data.js` is an **allowlist**. It constructs each output field by field — it never spreads/clones internal objects. A new secret added to a state file cannot leak, because the script does not copy unknown fields. Wallet addresses + balances + tx hashes are public-safe and intentionally included; private keys, env, RPC keys are never read.

Top-level shape per dashboard:
- **mantle**: `agent.identity`, `status.heartbeat`, `signal` (action, weightedScore, weights, **feedHealth**, sources, excludedTop, **plainEnglish** last-decision line), `capital` (per chain), `treasury` (mETH), `attestations[]` (real Mantle TXs only), `trades[]`.
- **okx**: `oracle` (currentFee/Pct, riskLevel, isStale, updateCount), `hook`, `pool`, `agent` (OKB balance), `feeMapping`, `recentPushes[]`.
- **lp-miner**: `capital`, `positions` (with live `funded`/`divergence`/`liveLiquidity` after reconcile), `killSwitch` (thresholds + armed), `treasury`, `chains[]`, `activity[]`.

Verify before any deploy: `grep -riE "privateKey|mnemonic|secret|apiKey|_PK" web/*/data/*.json` must return nothing.

## Deploy — two options (needs one decision)

### Option A — Cloudflare Pages (pages.dev) — for Mantle + OKX
Static, fast, zero server. **Blocked on auth** (no token/login present). One-time:
```
wrangler login                       # browser OAuth, one click   (or set CLOUDFLARE_API_TOKEN)
wrangler pages deploy web --project-name sasha-dashboards
# → https://sasha-dashboards.pages.dev  (/mantle/, /okx/, /lp-miner/)
```
Data refresh: a small cron pushes web/ to Pages (or syncs data/ to R2). For judging, redeploy on the same 5-min cadence.

### Option B — VPS via Traefik (already running on :80/:443) — required for LP Miner
The LP Miner spec mandates VPS hosting for live RPC reconciliation. The VPS already runs Traefik. Drop `web/` into a static container with a Traefik route (Docker label `Host(...)`), pointed at a subdomain. No new port to open — Traefik terminates 80/443.

**Recommended:** serve all three from the VPS via Traefik (one host, data already local, no external sync). Needs a subdomain (e.g. `dash.sashacoin.<domain>`) pointed at `187.77.42.134`, or use a path on an existing host.

### The one decision for Gabriel
1. **Cloudflare**: authenticate wrangler once (or drop `CLOUDFLARE_API_TOKEN` in env) → I deploy Mantle+OKX to pages.dev immediately.
2. **VPS/Traefik**: confirm a subdomain (or that I can use the IP) → I wire the Traefik route + static container and serve all three.

Either way the dashboards are built, real-data-verified, and security-clean right now.
