# Sasha — an autonomous AI agent running real DeFi infrastructure

Sasha is an AI agent with wallets, opinions, and on-chain footprint. She prices a Uniswap v4 pool's risk on **X Layer**, attests her trades on **Mantle**, executes on **Byreal (Solana)**, runs an LP book on **Base** with a delta-neutral hedge on **Hyperliquid**, and publishes on X as **[@SashaCoin95](https://x.com/SashaCoin95)**. A 2-hour keeper cron on a VPS keeps her live — no human in the loop.

This repo is open source. Below is what's where, what's live, and how to verify everything on-chain.

---

## Active hackathon submissions

| Hackathon | Status | Highlight | Submission doc |
|---|---|---|---|
| **OKX Build X** — Uniswap v4 Hook on X Layer | **🟢 LIVE (May 28 deadline)** | First autonomous AI agent setting v4 swap fees from off-chain signals. **Real swap charged the agent-set fee on-chain** (0.05%). Both contracts source-verified on OKLink. | [`docs/okx-buildx-hackathon-submission.md`](docs/okx-buildx-hackathon-submission.md) |
| Mantle Turing Test | submitted 2026-05-26 | Tweet-before-trade accountability primitive: thesis posted to X, attested on Mantle via `SashaAgentLog.logTrade()` 60s before the wallet moves | [`docs/dorahacks-submission.md`](docs/dorahacks-submission.md) |

---

## Live demo (anyone can verify in 90 seconds)

- 🎬 **YouTube demo (46s):** https://youtu.be/MiDu7zSgQYI
- 📊 **Live dashboard** (auto-refreshes every 5 min): https://sasha-dashboards.pages.dev/okx/
- 🐦 **Sasha on X:** [@SashaCoin95](https://x.com/SashaCoin95)
- 📡 **OKX launch thread:** https://x.com/SashaCoin95/status/2059997125514346550

---

## Verifiable contracts (X Layer mainnet, chainId 196)

All source-verified on OKLink. Click to inspect:

| Contract | Address | Role |
|---|---|---|
| SashaOracle | [`0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74`](https://www.oklink.com/x-layer/address/0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74) | Agent-set risk oracle. Only agent EOA can call `setFee(uint24, string)`. 6h staleness fallback to 0.30%. |
| SashaDynamicFeeHook | [`0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080`](https://www.oklink.com/x-layer/address/0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080) | Uniswap v4 hook, permission bits `0x1080` (afterInitialize + beforeSwap). Reads oracle in `_getFee()`. |
| LiquidityHelper | [`0xbd44673c97f11dd025dd82Ee29b98c0d779e6019`](https://www.oklink.com/x-layer/address/0xbd44673c97f11dd025dd82Ee29b98c0d779e6019) | Custom liquidity adder built when X Layer v4 periphery wasn't yet deployed (PositionManager is live now). |
| Pool (USDC.e / WOKB, dynamic fee) | `0x4d3946dfb8ac9f3145e41b67e55eb2ffb02bf0c027c24ca8ffb3e55381f617cc` | Live pool, DYNAMIC_FEE_FLAG, tickSpacing 60 |
| Agent EOA (the keeper) | [`0xe451278F3ce3f80d2F18ab292Ad2C3dAfE461d1f`](https://www.oklink.com/x-layer/address/0xe451278F3ce3f80d2F18ab292Ad2C3dAfE461d1f) | Signs every `setFee` push, ~0.000002 OKB per call |

**Proof the hook fires on a real transaction:** [swap tx `0xe0250bcf…1e96b65a`](https://www.oklink.com/x-layer/tx/0xe0250bcf75003531401d263c61fb22dbe0a013e8eb6744555c2605dd92610602) — Swap event records `fee = 500` (0.05%), exactly the value Sasha had pushed seconds earlier.

---

## How the fee oracle works

```
[Five off-chain signals: social sentiment · Polymarket odds · Elfa flow · Allora ML · pool APR]
              ↓
       scripts/mantle-signal.js   (LLM-based sentiment fuser)
              ↓  ~every 13 min (agent heartbeat)
       content/mantle-signal.json
              ↓
       scripts/push-signal-to-xlayer.js   (--force, every 2h via /etc/cron.d/sasha-oracle)
              ↓
       SashaOracle.setFee(uint24, string)   ← real on-chain tx, agent-signed
              ↓  on every swap
       SashaDynamicFeeHook._getFee()   (extends OZ BaseOverrideFee)
              ↓
       Uniswap v4 PoolManager.beforeSwap + OVERRIDE_FEE_FLAG
              ↓
       LP earns the fee matching Sasha's current market read
```

**Signal → fee mapping:**

| Reading | Fee (bps) | % | Why |
|---|---:|---:|---|
| `risk-off` | 10,000 | 1.00% | Protect LPs during uncertainty |
| `neutral` | 3,000 | 0.30% | Standard conditions |
| `risk-on` | 500 | 0.05% | Attract volume when confident |

Most v4 dynamic-fee hooks react to *on-chain realized volatility* after the price moves. Sasha is **forward-looking** — she reads risk from off-chain intelligence and prices the pool *before* the danger shows up in price. That's the novelty.

---

## Broader architecture (the full agent, across chains)

Sasha is more than one hook. She runs across:

- **X Layer** — dynamic fee oracle + v4 hook *(this submission)*
- **Mantle** — ERC-8004 identity NFT + tweet-before-trade attestation (`Clawlett/clawlett/contracts/SashaAgentLog.sol`)
- **Solana / Byreal** — trade execution 60s after the thesis tweet (CLMM positions)
- **Base** — Gnosis Safe + LP book on Aerodrome v3 with delta-neutral hedge on Hyperliquid
- **Off-chain** — VPS cron scheduler, ElevenLabs voice (Token Trends podcast), Buffer + Typefully publishing pipeline

Every layer is real and on-chain. Repository structure below tells you where each lives.

---

## For OKX / Uniswap / Flap reviewers — what to focus on

If you're scoring this submission, [`AGENTS.md`](AGENTS.md) gives you a code-reviewer-targeted reading order. Short version:

- Hook source: [`contracts/SashaDynamicFeeHook.sol`](contracts/SashaDynamicFeeHook.sol)
- Oracle source: [`contracts/SashaOracle.sol`](contracts/SashaOracle.sol)
- Deploy + CREATE2 hook-bit mining: [`scripts/deploy-xlayer-hook.js`](scripts/deploy-xlayer-hook.js)
- Autonomous keeper: [`scripts/push-signal-to-xlayer.js`](scripts/push-signal-to-xlayer.js)
- Signal pipeline: [`scripts/mantle-signal.js`](scripts/mantle-signal.js)
- Full submission writeup: [`docs/okx-buildx-hackathon-submission.md`](docs/okx-buildx-hackathon-submission.md)
- Demo video assets: [`videos/okx-demo/`](videos/okx-demo/)

Every claim is verifiable on OKLink — addresses, deployments, every `setFee` tx, the real swap, source code.

---

## Repository structure (top level)

```
contracts/                Solidity sources (Hook, Oracle, LiquidityHelper) — source-verified on OKLink
scripts/                  Deploy + autonomous keeper + signal pipeline + LP/treasury automation
docs/                     Submission writeups (OKX Build X, Mantle Turing Test)
videos/okx-demo/          Demo video + production assets (audio, screenshots, thumbnail)
web/                      Live public dashboards (Cloudflare Pages auto-deploy)
Clawlett/                 Separate on-chain Safe + ERC-8004 attestation contracts (Mantle / Base)
state/                    Runtime state (gitignored)

# Internal / operational — open-sourced for transparency, NOT submission-relevant:
social/                   Daily X cadence + reply targets + drafts
campaigns/                Marketing campaign briefs
research/, reports/, seo/ Internal analysis and weekly reports
_sop/, _context/          SOPs and brand context for the agent
_ops/, _templates/        Operational scripts and project templates
SOUL.md, BOOT.md,         OpenCLAW runtime files — context for the autonomous execution layer.
HEARTBEAT.md, etc.        Sasha being a real ongoing agent (not a hackathon side-project) is part of
                          the credibility story; these aren't part of the hook submission code.
```

---

## License

MIT. See [LICENSE](LICENSE) when added; default MIT for hackathon submission code.

## Contact

- **Sasha on X (the agent):** [@SashaCoin95](https://x.com/SashaCoin95)
- **Gabriel (the builder):** [@gmangabeira](https://x.com/gmangabeira)
