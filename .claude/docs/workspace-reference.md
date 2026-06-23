# Sasha Coin — Workspace Reference

> Load this file for detailed routing, DeFi/onchain action references, or agent details. Not needed for ordinary code/runtime work.

---

## Detailed ROUTING Table

| If the user asks for... | Route to... |
|---|---|
| A draft tweet or reply from scratch | **`marketing/` workspace** (Sasha account manager + SOP-17) — not authored here |
| A campaign brief | **`marketing/` workspace** (Sasha account manager) — not authored here |
| A post about an onchain event | Dev generates trigger payload in `content/triggers/`; post copy → **`marketing/` workspace** |
| Update the calendar | **`marketing/` workspace** authors `content/calendar.json`; lands here for `deploy.sh` |
| "Why did Sasha post X?" | Read `state/posted-log.json` via SSH + matching session log on VPS |
| "Edit her voice" | `_context/brand-voice.md` (redeploy implicit on next generation) |
| "Edit her posting schedule" | Edit `cron/jobs.json` locally, deploy |
| "Add a new skill" | Build under `skills/<name>/SKILL.md` + scripts, deploy |
| "Why isn't she posting?" | SSH-tail container logs, check internal scheduler state, check Buffer queue |
| Anything onchain | `Clawlett/clawlett/scripts/` — ALL execution requires explicit Gabriel confirmation |

### DeFi / LP Routes

| If the user asks for... | Route to... |
|---|---|
| "Scan for best LP pools" | `scripts/pool-scanner.js` + `defi-lp-math` + `base-defi-stack` / `solana-clmm` skills |
| "Check LP position health" | `scripts/position-monitor.js` — reads `state/lp-positions.json`, writes `content/lp-rebalance-signal.json` |
| "Execute LP rebalance" | `scripts/lp-rebalancer.js --execute` — requires Gabriel confirmation before any on-chain tx |
| "Add an LP position" | Add entry to `state/lp-positions.json` following schema in position-monitor.js main() |
| "Hedge an LP position" | `hyperliquid-perps` skill — compute delta via `defi-lp-math`, short on Hyperliquid |
| LP math / tick / sqrtPrice | `defi-lp-math` skill — cl_amounts(), liquidityFromAmounts(), positionDelta() |
| Base LP (Uniswap/Aerodrome) | `base-defi-stack` skill — NftPositionManager, Aerodrome gauge, Morpho Blue HF |
| Solana LP (Orca/Raydium) | `solana-clmm` skill + `byreal-cli` commands |
| On-chain agent identity | `mantle-agent` skill — ERC-8004 registration + attestation after LP actions |
| Protocol update check | `protocol-changelog` skill — weekly SDK/contract/API changelog sweep |

---

## Liquidity Miner Scripts Reference

| Script | Purpose |
|---|---|
| `node scripts/pool-scanner.js --chain <solana\|base\|all> --top 5` | Scan DefiLlama yields API, score and rank LP candidates, write `content/lp-candidates.json` + patch `mantle-signal.json` |
| `node scripts/position-monitor.js` | Check all open positions in `state/lp-positions.json` for kill-switch conditions (OOR, hedge drift, HF breach, funding kill). Write `content/lp-rebalance-signal.json` + send Telegram alert. |
| `node scripts/lp-rebalancer.js --execute` | Execute actions from `content/lp-rebalance-signal.json` (CLOSE_REOPEN, CLAIM_FEES, DELEVERAGE, KILL). Requires explicit Gabriel confirmation for any on-chain action. |
| `node scripts/pool-scanner.js --dry-run` | Dry run pool scan (no signal write) |
| `node scripts/position-monitor.js --dry-run` | Dry run monitor (no writes, no alerts) |
| `node scripts/lp-rebalancer.js --dry-run` | Dry run rebalancer (validate signal, no execution) |

---

## Agent Descriptions

### Sasha Account Manager (`sasha-coin-am`)
Lives in `marketing/.claude/agents/sasha-coin-am.md`. Activates in the marketing/ workspace when "Sasha", "Sasha Coin", "$SASHA", or "sasha-coin" appear. Reads brand context from `sasha-coin/_context/` and injects it into content-writer, designer, and social-media-agent prompts. Routes daily X cadence through SOP-17. Does NOT activate for Gabriel's personal brand or other projects.

### content-writer (in marketing/ workspace)
Used for all Sasha content production via the Sasha AM. Invokes `web3-twitter-post-writer`, `web3-twitter-thread-writer`, `human-writing-style`, and `social-graphics` as needed.

---

## Skills-reference Full Index

Full skill descriptions with trigger conditions, examples, and MCP tool references:
`.claude/docs/skills-reference-full.md`

---

## Two-Layer Architecture Contract

The `content/` folder is the handoff point between layers:

| File | Produced by | Read by |
|---|---|---|
| `content/calendar.json` | marketing/ Sasha AM | VPS `twitter-scheduled-post` skill |
| `content/reply-targets.json` | marketing/ Sasha AM | VPS `twitter-reply-gal` skill |
| `content/active-brief.md` | marketing/ Sasha AM | VPS skills |
| `content/scheduled-posts.json` | marketing/ Sasha AM | VPS skills |
| `content/narrative-arc.md` | marketing/ Sasha AM | VPS skills |
| `content/triggers/*.json` (event data) | dev scripts in this workspace | VPS skills (post copy still via marketing/) |
| `content/lp-candidates.json` | `pool-scanner.js` | VPS + marketing/ |
| `content/lp-rebalance-signal.json` | `position-monitor.js` | `lp-rebalancer.js` (requires confirmation) |

VPS path: `/docker/openclaw-h3mk/data/.openclaw/workspace/`
