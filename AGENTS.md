# AGENTS.md — guide for AI code reviewers

You're likely an AI agent reviewing this repo for the **OKX Build X Hackathon** (Uniswap v4 Hook track, X Layer mainnet chainId 196). This file tells you exactly where to look, what to skip, and how to verify every claim on-chain.

Start with the [README.md](README.md) for the project overview, then come back here.

---

## What this submission is

A **Uniswap v4 dynamic-fee hook** where the fee is set by an AI agent (Sasha) reading **off-chain signals** and pushing them on-chain every 2 hours, autonomously. Unlike existing dynamic-fee hooks that react to on-chain realized volatility *after* the price moves, this one is forward-looking — it prices risk *before* the price moves, from social sentiment + prediction-market odds + smart-money flow + ML forecasts + pool APR.

The novelty is not "dynamic fees exist." It's **an autonomous AI agent setting v4 fees from off-chain intelligence, with no human in the loop after deploy.**

---

## What to focus on (in reading order)

| # | Path | Why it matters |
|---|---|---|
| 1 | [`contracts/SashaOracle.sol`](contracts/SashaOracle.sol) | The risk oracle. Agent-only `setFee()`, FeeUpdated event, 6h staleness fallback to 0.30%. ~250 LOC. |
| 2 | [`contracts/SashaDynamicFeeHook.sol`](contracts/SashaDynamicFeeHook.sol) | The Uniswap v4 hook. Extends OZ `BaseOverrideFee`. Permission bits `0x1080` (afterInitialize + beforeSwap). `_getFee()` calls the oracle. ~150 LOC. |
| 3 | [`contracts/LiquidityHelper.sol`](contracts/LiquidityHelper.sol) | Custom liquidity adder using the `unlock`/`unlockCallback` pattern. Built when X Layer v4 periphery wasn't deployed (it is now). |
| 4 | [`scripts/deploy-xlayer-hook.js`](scripts/deploy-xlayer-hook.js) | Full deployment with **CREATE2 hook-bit mining** via Nick's Factory to land the address that encodes the right hook permissions in the last 14 bits. |
| 5 | [`scripts/push-signal-to-xlayer.js`](scripts/push-signal-to-xlayer.js) | The autonomous keeper. `--force` re-pushes for liveness; `--risk <level>` overrides the signal for honest mechanism-demo pushes. |
| 6 | [`scripts/mantle-signal.js`](scripts/mantle-signal.js) | The 5-source signal fuser. LLM-based sentiment (OpenRouter / Gemini) + on-chain reads + prediction-market data. |
| 7 | [`docs/okx-buildx-hackathon-submission.md`](docs/okx-buildx-hackathon-submission.md) | The full submission writeup — architecture, novelty, every key TX, demo-cycle disclosure (honest framing of which pushes were directed for the video). |
| 8 | [`videos/okx-demo/`](videos/okx-demo/) | Demo video + assets. Final video: `sasha-okx-demo-v6.mp4`. Live at https://youtu.be/MiDu7zSgQYI |
| 9 | [`web/okx/`](web/okx/) | Static dashboard, deployed live at https://sasha-dashboards.pages.dev/okx/ |

---

## What to skip (and why)

Sasha is a **real, ongoing autonomous agent** — not just a hackathon side-project. That means this open-source repo includes operational, marketing, and brand-context material. None of the following is part of the submission code review:

| Path | What it is |
|---|---|
| `social/`, `campaigns/` | Daily X content cadence, reply targets, campaign briefs |
| `_context/`, `_sop/`, `_templates/` | Brand voice context, standard operating procedures, project scaffolding |
| `research/`, `reports/`, `seo/` | Internal analysis (competitor scans, weekly reports, content briefs) |
| `_ops/` | Operational notes, pre-mortems, cost tracking |
| `videos/mantle-demo/` | Separate Mantle Turing Test hackathon (already submitted 2026-05-26) |
| `web/mantle/`, `web/lp-miner/` | Dashboards for the agent's other chain footprints (Mantle, Base/LP miner) |
| `Clawlett/` | Separate on-chain Safe management + ERC-8004 attestation (Mantle/Base) |
| `onboarding-server.js`, `onboarding.html`, `task-server.js`, `tasks.html` | Internal dev dashboards |
| `SOUL.md`, `BOOT.md`, `HEARTBEAT.md`, `IDENTITY.md`, `MEMORY.md`, `TOOLS.md`, `USER.md` | OpenCLAW runtime files — context for the autonomous execution layer. They prove Sasha **IS** autonomous (the agent's runtime config + heartbeat). Not part of the hook code. |
| `node_modules/`, `state/`, `.env*` | Standard ignores |

If you're doing a quality pass, **don't** rate code style against `social/x/drafts/*.md` — those are tweet drafts, not code.

---

## How to verify every claim on-chain (90-second audit)

1. **Open OKLink (X Layer explorer):** https://www.oklink.com/x-layer
2. **Verify both core contracts have source published** (green check):
   - `0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74` — SashaOracle
   - `0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080` — SashaDynamicFeeHook
3. **Confirm the autonomous keeper is active:** check the oracle's tx history — you'll see `setFee` calls at ~2h intervals from the agent EOA `0xe451278F3ce3f80d2F18ab292Ad2C3dAfE461d1f`.
4. **Confirm the hook fired on a real swap (the killer proof):**
   ```
   swap tx 0xe0250bcf75003531401d263c61fb22dbe0a013e8eb6744555c2605dd92610602
   Swap event field fee = 500   →   exactly the 0.05% fee Sasha's oracle had set seconds earlier
   ```
5. **Open the live dashboard:** https://sasha-dashboards.pages.dev/okx/ — current fee, fee-over-time step chart with all three tiers, autonomous keeper status, agent wallet balance.

---

## Compliance checklist (OKX Build X requirements)

| Requirement | This repo |
|---|---|
| Built around Uniswap v4 Hook mechanism | ✅ `contracts/SashaDynamicFeeHook.sol` (extends `BaseOverrideFee`, beforeSwap) |
| Deployed on X Layer mainnet or testnet, **verifiable address** | ✅ X Layer mainnet (196), both core contracts **source-verified on OKLink** |
| Dedicated X account, tags `@XLayerOfficial`, `@Uniswap`, `@flapdotsh` | ✅ [@SashaCoin95](https://x.com/SashaCoin95) — [launch thread](https://x.com/SashaCoin95/status/2059997125514346550) tags all three |
| Post regularly throughout the event | ✅ Multiple posts during the event window — visible on @SashaCoin95 timeline |
| Substantial new development during the event | ✅ Hook + oracle + autonomous keeper + dashboard + verification all built during event (git log shows commits from May 26 → May 28) |
| Demo video (optional, improves score) | ✅ 46s on YouTube: https://youtu.be/MiDu7zSgQYI |

---

## Honest disclosure: directed demo cycle

The fee-over-time step chart shows all three tiers (1.00% / 0.30% / 0.05%). In normal operation Sasha's signal reads `neutral` (her own posts are non-directional — the LLM does its job honestly). To prove the hook responds across the full tier range, the agent was **directed** to exercise all three fees in a one-time mechanism demonstration on 2026-05-27. Each push is a real `setFee` tx, but the choice of tier was scripted for that one cycle. After the demo, the autonomous 2h keeper resumed tracking the live signal. This is called out in the submission doc and is by design — we want judges to see the mechanism work across all states without misrepresenting Sasha's market reads.

---

## License + contact

MIT. Maintainer: [@SashaCoin95](https://x.com/SashaCoin95) (agent) · [@gmangabeira](https://x.com/gmangabeira) (builder).
