# LP Miner Dashboard — Detailed Requirements

**Status:** Draft v1 · 2026-05-26
**Owner:** Gabriel + Claude Code
**Context:** Sasha Coin liquidity miner, built for the Mantle Turing Test Hackathon 2026 (also spanning Solana/Byreal, Base/Aerodrome, X Layer/Uniswap v4).

---

## 1. Purpose & audience

Two audiences, one surface, two modes:

1. **Public / judges (primary).** A proof-of-autonomy view. The pitch is "an AI agent runs a real, multi-chain LP book with its own kill-switches and posts about it." It must read as *live and autonomous* — last action, current positions, P&L, on-chain attestations, all timestamped and link-verifiable. No login.
2. **Gabriel ops (secondary).** A control/observability view for catching problems: stale state, kill-switch arming, failed txs, capital drift, unfunded positions (the exact failure that prompted this — a planned Base position with no capital behind it). Behind a simple gate or a `?ops=1` toggle.

**Non-goal:** this is not a trading terminal. No order entry from the dashboard. Execution stays in the scripts with Gabriel-confirmation gates. The dashboard is read-only.

---

## 2. Source of truth (inputs)

The dashboard renders from state files (synced from VPS) plus **live on-chain reads** for balances and position status. It must never trust a single state file's `updatedAt` as ground truth for money — the 45-USDC incident proved state can lag reality.

| Source | Path | Feeds |
|---|---|---|
| Open/closed positions | `state/lp-positions.json` | Positions table, range status, fees, hedge |
| Capital snapshot | `state/capital-pool.json` | Capital panel, per-chain wallet balances |
| Trade ledger | `state/mantle-trade-log.json` | Activity feed, realized P&L, attestation links |
| mETH treasury yield | `state/treasury-yield-log.json` | Treasury/yield panel |
| Pool blacklist | `state/pool-blacklist.json` | "Lessons learned" / rejected pools |
| Pool scan history | `state/pool-history.json` | Candidate pool trends |
| Latest signal | `content/mantle-signal.json` | Signal fusion panel + current recommendation |
| Rebalance signal | `content/lp-rebalance-signal.json` | Active kill-switch / pending actions |
| X Layer deployment | `state/xlayer-deployment.json` | X Layer hook pool card |
| Deposits | `state/deposits.json` | Inbound capital events |
| Dust sweeps | `state/dust-sweep-log.json` | Housekeeping log |
| **Live RPC** | Base / Solana / Mantle / X Layer | Wallet balances, NFT range status, mETH balance — the trust layer over state files |

**Reconciliation rule (hard requirement):** every position and capital figure shows a state value *and* a live on-chain value, with a visual flag when they diverge beyond a tolerance. A position marked `pending_open` with $0 on-chain capital behind it must render a loud "UNFUNDED" badge, not a quiet pending state.

---

## 3. Functional requirements (panels)

### 3.1 Header / hero — "Is Sasha alive?"
- Agent identity: name, X handle (@SashaCoin95), ERC-8004 identity link on Mantle.
- **Last autonomous action** with relative time ("opened LP 2h ago") + tx link. Goes red if no action in N hours (configurable, default 24h).
- Total book value across all chains (live), 24h delta.
- Heartbeat dot: green if cron/monitor ran within expected window, amber if stale, red if down.

### 3.2 Capital panel (per chain)
- Per-wallet balances: Solana (`647TT6SW…`), **LP-miner EOA `0x21AF273…` (signs Base AND Mantle)**, Base Safe `0x7833…` (identity/holdings only), X Layer agent `0xe451…`. NOTE: `0xba3BB32…` is the old Clawlett agent EOA, NOT the LP signer — do not use it for LP data.
- **Capital locked in positions must be read from the position NFT, not wallet balanceOf.** A staked Aerodrome position shows zero wallet balance for both token and NFT (gauge custodies it). `capital-pool.json` currently omits Base entirely — the dashboard's live reads are the only source for Base LP value.
- Live on-chain balance vs `capital-pool.json` snapshot, divergence flag.
- Gas reserve vs deployable pool split.
- Inbound deposit events (from `deposits.json`) — so a fresh 45 USDC shows up here the moment it lands, on whichever chain.

### 3.3 Open positions table
Columns: pair · chain/protocol · status · capital · current value · **in-range / OOR** (live tick vs range) · pending fees · lifetime fees · hedge size & drift · Morpho HF (if levered) · age · P&L ($/%) · attestation tx.
- Row states: `live`, `pending_open`, **`UNFUNDED`** (pending + no on-chain capital), `out-of-range`, `kill-armed`, `closing`.
- Click row → detail drawer: range chart, fee accrual over time, funding history, all txs.

### 3.4 Kill-switch / risk panel
Mirror `position-monitor.js` thresholds, show distance-to-trigger per position:
- OOR timer (trips at 240 min out-of-range).
- Hedge drift (5% from target).
- Morpho HF (deleverage <1.20, emergency <1.05).
- Hyperliquid funding (kill < −54.75% annualized, 3 consecutive periods).
- Stop-loss / profit-take ladder status.
- Any armed condition surfaces at the top with the pending action from `lp-rebalance-signal.json`.

### 3.5 Signal fusion panel
- Current recommendation from `mantle-signal.json` (action, target pool, sizing %, rationale).
- Weighted-score breakdown with the five inputs (social 0.25 / onchain 0.20 / allora 0.25 / elfa 0.15 / polymarket 0.15).
- **Feed health badges** — flag when a signal returns `null` (all three of Allora/Elfa/Polymarket are null right now; the dashboard must make that visible, not silently weight around it).
- Top candidate pools (from scanner) with quality-filter pass/fail and the blacklist.

### 3.6 Treasury / yield panel
- mETH balance, exchange rate, ETH-equivalent yield, 7-day yield (the figure `weekly-yield-tweet.js` posts).
- Compounding history, last attestation link.

### 3.7 Activity feed
- Unified, reverse-chronological stream from `mantle-trade-log.json`: opens, closes, harvests, dust sweeps, bridges, attestations.
- Each entry: action, P&L if realized, rationale (one line), tx link(s), Solscan/Basescan/OKLink as appropriate.
- Surfaces failures too (the May-23 byreal-cli errors, the simulation-failed tx) — autonomy includes visible recovery.

### 3.8 Multi-chain deployment cards
- Solana/Byreal · Base/Aerodrome · X Layer/Uniswap v4 hook · Mantle/ERC-8004 — each a card with contract addresses, status (LIVE/idle), explorer links. X Layer card pulls from `xlayer-deployment.json`.

---

## 4. Non-functional requirements

- **Refresh:** state panels poll every 30–60s; live RPC balances every 60–120s (respect public RPC rate limits, fall back across endpoints — mainnet.base.org died mid-session today, so multi-RPC failover is mandatory, not optional).
- **Resilience:** a dead RPC or missing state file degrades one panel, never blanks the page. Show "stale (last good: <ts>)" instead of erroring.
- **No secrets client-side:** all RPC reads are public/read-only endpoints or proxied through the server; no private keys, no write paths.
- **Timestamps:** absolute UTC + relative ("2h ago"). Every money figure carries its as-of time.
- **Mobile-legible:** judges will open it on a phone. Single-column collapse.
- **Brand:** Sasha voice in copy where copy exists; first-person, no em dashes, per `_context/brand-voice.md`.

---

## 5. Architecture (decisions locked 2026-05-26)

- **Primary audience: judges/public.** Default view is the proof-of-autonomy surface. Ops detail lives behind a `?ops=1` toggle, no auth (hackathon speed).
- **Hosting: VPS-served public URL.** Runs on the Hostinger VPS (`openclaw-h3mk` host, `187.77.42.134`), reads live state files directly on the box (no SSH-pull lag). A small Node service (Express/static + `/api/lp/*` JSON) serves the page and proxies RPC. Needs a port + reverse-proxy/firewall opening — to be wired during build.
- **Live reads (Phase 1): balances + NFT range/tick status.** Server-side module with multi-RPC failover across Base, Solana, Mantle, X Layer and short-TTL caching. Phase 1 reads both wallet balances *and* live position tick/range, not just balances.
- **No client-side secrets:** all RPC endpoints are public read-only; no private keys reach the browser; no write paths exposed.

---

## 6. Phasing

- **Phase 1 (MVP, hackathon-critical):** Header heartbeat, capital panel with live-vs-state reconciliation + UNFUNDED detection, open-positions table, activity feed, multi-chain cards. Read from state + live balances.
- **Phase 2:** Kill-switch distance-to-trigger panel, signal fusion panel with feed-health badges, treasury/yield panel.
- **Phase 3:** Position detail drawers (range/fee/funding charts), historical P&L curve, candidate-pool trend charts from `pool-history.json`.

---

## 7. Decisions (resolved 2026-05-26)

1. **Primary audience:** judges/public first; ops behind `?ops=1`. ✅
2. **Hosting:** VPS-served public URL on `openclaw-h3mk`. ✅
3. **Phase 1 live reads:** balances + NFT range/tick status. ✅
4. **Auth:** none (hackathon speed). ✅

### Verified live state (2026-05-26)
- **Base Aerodrome position IS live and funded.** $45 USDC arrived at `0x21AF273…` at 15:32 UTC, was swapped + minted into NFT **#71397771** (15:52, tx `0xd176d5…`), and staked into gauge `0x9B55cb6c…` (15:57, tx `0xe8dd7f…`). In-range, ~$0.044 fees accrued. The dashboard's first real Base data point is a healthy LIVE position, not UNFUNDED.

### Build blockers to resolve first
- **VPS port/proxy.** Pick a port and open it (or reverse-proxy via the existing Sasha web stack) so the public URL is reachable.
- **Read position state from VPS, not local git.** Local `lp-positions.json` lags the runtime. The dashboard runs on the VPS, so this resolves naturally — but any local tooling must SSH for truth.
