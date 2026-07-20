# Mantle/Solana Trader — Deep Review & Improvement Plan
### 2026-07-05 · Fable 5 · Initiative 2 of 5

## Current state (verified live)

| Component | Status |
|---|---|
| Capital | **$7.05 total** — Solana $5.72 (incl. 4.07 USDC), Mantle $1.33 (MNT + mETH dust) |
| Trading | **Dormant** — every cycle pre-flight aborts: "max position $1.51 < floor $2" |
| Signal pipeline | Healthy, runs 3×/day (12/17/21 UTC cron): social + Byreal + Allora + Elfa + Polymarket all returning data; today's rec: MOVE_TO_STABLE |
| ERC-8004 identity | **Verified**: agent NFT #100 owned by 0x21AF on Mantle registry ✓ |
| Attestation | Goes to the ERC-8004 registry via erc8004-write.js; SashaAgentLog contract (0x71e2…) has tradeCount=0, never used |
| Safety fixes | Pre-flight capital check works (observed live today: abort BEFORE tweet — the phantom-tweet bug is closed for the capital case) |
| Mantle treasury | mETH position is dust ($1.33); mantle-treasury.js staking loop effectively idle |

**What works well:** the 5-source signal fusion is the most sophisticated data pipeline Sasha has, and it runs reliably. The tweet-before-trade accountability design with pre-flight validation is now sound. ERC-8004 identity is real and verifiable.

## Gaps

1. **The initiative is spending without earning.** 3×/day the cron burns Allora + Elfa + OpenRouter + Polymarket API calls to compute recommendations that always abort on the $2 floor. That's ~90 signal computations/month producing zero trades.
2. **Trade-failure tweet stranding still open (audit M-8):** a trade that fails *after* the tweet posts leaves the announcement up. The capital pre-flight closed the common case but not execution failure (slippage, route failure, byreal-cli error).
3. **SashaAgentLog is dead weight** — deployed, documented as the attestation log, never called. Either wire it or retire it from the docs (audit M-7).
4. **CLOSE_LP has no execution path** — auto-trade routes CLOSE_LP to a Telegram alert because byreal-cli lacks close support in the routing (known). Asymmetric: the agent can open but not close autonomously.
5. **Memory/goal mismatch:** the stated goal (per decision memory) is *autonomy demonstration, not yield* — clean attested decisions on SOL/USDC only. The current dormant state produces neither yield nor decisions.

## Plan

**P0 — decide: top-up or hibernate (Gabriel decision, this week)**
This is the fork everything else hangs on:
- **Option A — top up to ~$25–30 SOL/USDC.** Restores the $2-floor headroom (30% sizing → $7.50+ positions), resumes the attested-decision track record. Cost: pocket change; benefit: the autonomy demo (the actual KPI) resumes.
- **Option B — hibernate cleanly.** Disable `/etc/cron.d/sasha-trade`, keep the signal pipeline OFF too (it exists to feed trades and the X Layer oracle — see hook plan for the oracle's separate needs), and post a Sasha X thread closing the chapter with the track record to date. Zero cost, no zombie spend.
- Recommendation: **A** if the CROO Risk Desk gets traction (the trader's attested decisions are Sasha's reputation collateral); otherwise B.

**P1 — if resumed (1–2 days of work)**
- Close the tweet-stranding gap: post a follow-up "trade aborted, here's why" reply on execution failure (honest > silent), or delete via Buffer API where possible.
- Wire CLOSE_LP: byreal-cli supports `position close` (the rebalancer already uses it) — route auto-trade CLOSE_LP through the same call with the standard gates instead of alert-only.
- One attestation per decision, including aborts: attest "PRE-FLIGHT ABORT" cycles to the ERC-8004 registry too. For an autonomy-demonstration KPI, a verifiable record of *declining* to trade is as valuable as a trade.
- Retire SashaAgentLog from all docs (or spend 10 minutes wiring erc8004-write.js to also call logTrade — cheap, makes the doc claim true).

**P2 — efficiency**
- Gate signal computation on capital: if poolUsd × 0.30 < $2, skip the LLM/API-heavy legs entirely and log one line. Saves ~90% of the pipeline's API spend while dormant.
- Byreal WSOL naming and pool-quality filter specs (whitelist, minVolToTvl 0.3, 30-day age) are specified in memory but should be asserted in code with a unit test — they've regressed before.

**KPI:** decisions attested per week (including aborts) > 0, zero stranded tweets, API spend ≈ 0 while dormant.
