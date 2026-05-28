# OKX Build X Hackathon — Submission Document
# Project: Sasha Coin — AI-Driven Dynamic Fee Hook on X Layer
# Deadline: May 28, 2026 23:59 UTC
# Submission form: https://docs.google.com/forms/d/e/1FAIpQLSdH_ZfkA7qREpVciUrTVBy9zZHssvBgbvATVzkt0Sog_usq2Q/viewform
# Hackathon page: https://web3.okx.com/xlayer/build-x-hackathon/hook
# (NOT DoraHacks — that is the separate Mantle Turing Test submission, BUIDL 44012, already submitted)

---

## Project Name
**Sasha Coin — AI Dynamic Fee Hook**

## One-liner
An AI agent that reads 5 market signals and autonomously pushes a market-risk fee to a Uniswap v4 Hook on X Layer every 2 hours — no human intervention after deploy.

## Track
**Uniswap v4 Hook** on X Layer (OKX EVM L2, chainId 196)

---

## Deployed Contracts (X Layer Mainnet, chainId 196)

| Contract | Address | Explorer |
|---|---|---|
| SashaOracle | `0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74` | [View](https://www.oklink.com/x-layer/address/0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74) |
| SashaDynamicFeeHook | `0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080` | [View](https://www.oklink.com/x-layer/address/0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080) |
| PoolManager (v4) | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` | [View](https://www.oklink.com/x-layer/address/0x360e68faccca8ca495c1b759fd9eee466db9fb32) |
| LiquidityHelper | `0xbd44673c97f11dd025dd82Ee29b98c0d779e6019` | [View](https://www.oklink.com/x-layer/address/0xbd44673c97f11dd025dd82Ee29b98c0d779e6019) |

**Agent wallet:** `0xe451278F3ce3f80d2F18ab292Ad2C3dAfE461d1f`

---

## Pool

| Field | Value |
|---|---|
| Pool ID | `0x4d3946dfb8ac9f3145e41b67e55eb2ffb02bf0c027c24ca8ffb3e55381f617cc` |
| currency0 (USDC.e) | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` |
| currency1 (WOKB) | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` |
| Fee flag | `0x800000` (DYNAMIC_FEE_FLAG) |
| tickSpacing | 60 |
| Hook | `0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080` |
| Init TX | [0x1f22055b...](https://www.oklink.com/x-layer/tx/0x1f22055bb0f9b3ac4357116056d8524d6826d5160e95223d166c49ff3fa84e77) |
| Liquidity TX | [0x84837361...](https://www.oklink.com/x-layer/tx/0x848373614d382a01d2db4b076c84919d6c06d40e2be0a5a7f05973cf97ef564c) |

---

## Key Transactions (chronological)

1. **Oracle deploy:** SashaOracle deployed with agent EOA as keeper
2. **Hook deploy:** SashaDynamicFeeHook deployed via CREATE2 (Nick's Factory) with exact hook permission bits `0x1080` (afterInitialize + beforeSwap)
3. **Pool init:** v4 pool initialized with DYNAMIC_FEE_FLAG and SashaDynamicFeeHook
4. **WOKB wrap:** 0.022 OKB wrapped to WOKB
5. **WOKB→USDC swap:** 0.015 WOKB → 1.016304 USDC.e via v3 fee=100 pool (liquidity sourced without bridging)
6. **Oracle push:** `setFee(3000, "neutral")` — first oracle update registered on-chain
7. **Liquidity provision:** LiquidityHelper deploys unlock-callback pattern to add position to v4 pool

---

## Architecture

```
[5-source signal pipeline on VPS]
    ↓  every 2 hours (autonomous, no human needed)
[mantle-signal.js] → content/mantle-signal.json
    ↓
[push-signal-to-xlayer.js] → SashaOracle.setFee()
    ↓  on every swap
[SashaDynamicFeeHook._getFee()]
    ↓
[Uniswap v4 beforeSwap + OVERRIDE_FEE_FLAG]
    ↓
LP earns fee matching Sasha's current market read
```

### Signal Sources (5)
1. **Social sentiment** — Sasha's own X posts + CT sentiment analysis
2. **Byreal pool APR** — Solana DeFi pool performance signals
3. **Allora predictions** — AI-native prediction market data
4. **Elfa** — on-chain activity and smart money signals
5. **Polymarket** — prediction market probability scores

### Fee Mapping
| Signal | Fee | Rationale |
|---|---|---|
| `risk-off` | 10000 (1.0%) | Protect LPs during uncertainty |
| `neutral` | 3000 (0.3%) | Standard market conditions |
| `risk-on` | 500 (0.05%) | Attract volume when market is confident |

**Live fee history and mechanism demonstration.** In normal operation the fee tracks Sasha's autonomously-computed signal. Because her recent posts read as non-directional, the genuine signal has been `neutral` (0.3%) — an honest result, not a stuck value. To prove the hook sets every tier on-chain, the agent was directed to exercise the full range (risk-on, neutral, risk-off, neutral, risk-on, neutral) in a one-time mechanism demonstration on 2026-05-27; these are real `setFee` transactions verifiable on X Layer. The autonomous 2-hour keeper then resumes tracking the live signal.

### Safety
- Oracle staleness check (6h) — falls back to 0.3% if Sasha goes silent
- Fee bounded: MIN=50, MAX=10000
- Hook address validated by CREATE2 salt (exact 14-bit permission match)
- Agent-only write: only Sasha's EOA can call `setFee()`

---

## Hook Permission Bits

Hook address `0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080`:
- Last 14 bits: `0x1080`
- `bit 7` = `beforeSwap = true` (fires `_getFee()` on every swap)
- `bit 12` = `afterInitialize = true` (hook validates at pool creation)

This was mined via CREATE2 salt iteration through Nick's Factory (`0x4e59b44847b379578588920ca78fbf26c0b4956c`).

---

## The Problem We're Solving (and why an AI agent is the right tool)

**Liquidity providers get adversely selected, and a fixed fee can't stop it.** In every AMM, LPs earn the swap fee but lose to faster, better-informed traders: when the market moves, arbitrageurs trade against the pool's stale price and the LP is always on the wrong side. Academics call this **Loss-Versus-Rebalancing (LVR)** — the single largest hidden cost in AMM design, and the reason many "high-APR" LP positions quietly lose money once impermanent loss is netted out.

A static fee cannot win this fight: **0.3% is too low during volatility** (arbitrageurs happily pay it to pick off LPs) and **too high during calm** (it scares away the benign, uninformed flow that actually pays LPs). One fixed number is wrong in both regimes.

**The known answer is a fee that moves with risk** — raise it when danger is high, lower it when calm. A few v4 hooks already do this using *on-chain realized volatility*, but that is **backward-looking**: it only reacts after the price has already moved and the LP has already been hit.

**Sasha's contribution is a forward-looking, AI-driven risk oracle.** She fuses *off-chain* intelligence — social sentiment, prediction-market odds (Polymarket), smart-money flow (Elfa), and ML price forecasts (Allora) — into a single market-risk read and pushes it on-chain *before* the danger shows up in price. The pitch is not "dynamic fees exist." It is **an autonomous AI agent pricing a pool's risk from off-chain signals and setting the fee on-chain, with no human in the loop** — a DeFi primitive that did not exist.

**What this proves (the thesis: agentic DeFi).** An AI agent can autonomously operate real DeFi infrastructure — managing a pool's economics — not just answer prompts. It is the same agent that trades in public on Mantle and runs a multi-chain LP book; the dynamic-fee hook is the most sophisticated expression of that autonomy. If AI-managed fees beat static fees on LVR, the door opens to **AI-managed liquidity** as a real strategy.

## What Makes This Novel

1. **AI agent as DeFi infrastructure.** Sasha is not a dashboard — she IS the fee oracle. Her signal runs autonomously on VPS, pushes to chain, and the hook reads it on every swap.

2. **5-source signal fusion.** Unlike static AMMs or single-oracle hooks, Sasha fuses social, onchain, AI prediction, smart money, and prediction market data into a single market-risk reading.

3. **Fully autonomous.** After deployment, no human action is required. The VPS keeper cron runs every 2 hours. If Sasha's signal pipeline breaks, the oracle staleness check protects LPs with a 0.3% fallback.

4. **Capital-efficient.** The entire system was built and deployed with <0.06 OKB, zero bridging, by sourcing USDC.e through an existing X Layer v3 pool.

---

## Live Demo (judges can verify right now)

**Live dashboard:** https://sasha-dashboards.pages.dev/okx/ — shows the current on-chain fee, the fee-over-time step chart (all three tiers, real `setFee` pushes), the verified contracts, and the agent wallet. Updates automatically from chain every 5 min.

**On-chain proof:** oracle `updateCount` is 15+ with pushes across all three tiers (`0.05% / 0.30% / 1.0%`), each a verifiable `setFee` tx on X Layer. Every contract address above links to OKLink.

**Hook triggered by a real swap.** A live swap through the pool (USDC.e → WOKB, via the canonical Uniswap Universal Router) fired the hook's `beforeSwap` → `_getFee` and charged the exact fee Sasha had set. The pool's `Swap` event records `fee = 3000` (0.30%) — the agent-set value, applied to a real transaction. Swap tx: [`0x49bcd571…1e96b65a`](https://www.oklink.com/x-layer/tx/0x49bcd571028089aad259ef6e65b5bac824e63f14b2f260810c638adf1e96b65a). Both contracts are source-verified on OKLink (green check).

## GitHub Repository
https://github.com/gogrowth-co/sasha-coin (public)
- Hook + oracle: [`contracts/SashaDynamicFeeHook.sol`](https://github.com/gogrowth-co/sasha-coin/blob/main/contracts/SashaDynamicFeeHook.sol), [`contracts/SashaOracle.sol`](https://github.com/gogrowth-co/sasha-coin/blob/main/contracts/SashaOracle.sol), [`contracts/LiquidityHelper.sol`](https://github.com/gogrowth-co/sasha-coin/blob/main/contracts/LiquidityHelper.sol)
- Autonomous keeper: [`scripts/push-signal-to-xlayer.js`](https://github.com/gogrowth-co/sasha-coin/blob/main/scripts/push-signal-to-xlayer.js)

## Demo Video
[To be recorded — ~60s: live dashboard fee-over-time chart → click an oracle push tx on OKLink → show the hook contract. Step-chart footage is ready on the live page.]

## X Post
[@SashaCoin95 thread — draft at social/x/drafts/xlayer-hook-launch.md, ready to post]
