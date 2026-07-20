# Dynamic Fee Hook (X Layer) — Deep Review & Improvement Plan
### 2026-07-05 · Fable 5 · Initiative 3 of 5

## Current state (verified live)

| Component | Status |
|---|---|
| SashaOracle | Live, fee 3000 (neutral), **482 updates pushed**, fresh (updated today 12:00Z) |
| Keeper EOA (0xe451…) | 513 txs, **0.0375 OKB remaining** (~$4) |
| Pool (USDC.e/WOKB) | **TVL ≈ $0** — seed liquidity only (raw L=100000), no meaningful swap traffic |
| Cron | `/etc/cron.d/sasha-oracle`: push **every 2h with `--force`** ("never goes stale" by design) |
| Contracts | Owners verified on-chain ✓; bounds enforced ✓; hook wiring correct ✓ |
| Hackathon | OKX Build X submitted May 28 (done); dashboard live at pages.dev/okx |

**What works well:** the mechanism is genuinely on-chain and correct — oracle bounds, staleness fallback, hook override all verified. 482 autonomous updates is a real track record of keeper liveness.

## Gaps

1. **The oracle prices a pool nobody uses.** 482 updates × gas into ~$0 TVL. The signal→fee mechanism has no economic effect. As a demo it's complete; as an ongoing spend it's pure cost.
2. **`--force` every 2h defeats both safety and economics (audit M-1, institutionalized).** The cron comment says "never goes stale" — but the 6h staleness fallback exists precisely to protect swappers from a dead pipeline. Force-pushing unchanged fees (fee has been 3000 for weeks) buys nothing and burns keeper gas 12×/day.
3. **No signal-age guard in the pusher**: if mantle-signal.json is stale, its risk level still gets pushed as fresh (worse than going stale — the oracle actively lies about freshness).
4. **Keeper runway is finite and unmonitored:** 0.0375 OKB at 12 pushes/day. The script warns below 0.001 OKB but nothing alerts *Gabriel* before it dies; when it dies, updateCount just stops.
5. **No key rotation (audit M-6):** immutable agent/owner everywhere; hook baked into the PoolKey. Acceptable for a demo; fatal for production reuse.

## Plan

**P0 — stop the bleed, keep the demo alive (30 min)**
- Change the cron from `--force` every 2h to a plain push every 4h. The script already skips when fee+risk are unchanged, so this drops gas spend to near-zero while still refreshing `updatedAt` on genuine risk-level changes... **but** that alone would let the oracle go stale between unchanged pushes. So: add a `--heartbeat` mode — push only when (a) risk level changed, OR (b) `updatedAt` is older than 5h (just inside the 6h threshold). Result: ~1–4 pushes/day instead of 12, staleness fallback preserved as a real safety property, keeper runway extended ~5×.
- Add the signal-age guard (audit M-1): if mantle-signal.json is older than 6h, skip the push and let the oracle go stale — that is the correct honest behavior.
- Telegram alert when keeper OKB < 0.01 (≈10 days of runway at the new cadence).

**P1 — decide the pool's future (Gabriel decision)**
- **Option A — sunset gracefully.** OKX Build X is submitted; judging is done or imminent. Withdraw the seed liquidity via LiquidityHelper/rescueToken, drop the cron to daily heartbeat (keeps the "autonomous oracle" claim alive for the portfolio dashboard at trivial cost), and mark the initiative "mechanism proven, archived" in the decision log.
- **Option B — find real flow.** The hook only matters if swaps route through the pool; that needs TVL and a routing reason neither exists on X Layer for USDC.e/WOKB. Not worth chasing.
- Recommendation: **A**. The demo already proved what it needed to prove.

**P2 — extract the reusable asset**
- The oracle-keeper pattern (bounded fee, staleness fallback, heartbeat pusher, Telegram liveness) is the cleanest piece of infra in the portfolio. Package it as a standalone reference (contract pair + keeper script + cron template) — it's a credible Sasha content piece ("how my oracle survived 500 updates unattended") and a reusable module for any future chain deployment.
- If reused in production: add agent-key rotation (a two-step `proposeAgent`/`acceptAgent` on the oracle) before deploying anywhere with real TVL.

**KPI:** keeper gas spend ↓ ~80%, staleness fallback restored as a real property, zero keeper-death surprises (alert before empty), sunset decision logged.
