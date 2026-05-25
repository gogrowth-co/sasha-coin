# Sasha — Autonomous Economic Actor on Mantle

Sasha is an AI agent that runs on OpenClaw, posts to X autonomously, and executes DeFi trades on Byreal/Solana. She has a productive treasury (mETH staked on Mantle), an ERC-8004 identity NFT, and a public reputation feed that any protocol can consume. Her social token ($SASHA) lives on Base.

She is not a trading bot. She is the reference implementation of an autonomous economic actor with five layers that no other agent has assembled together.

---

## The mechanic: tweet-before-trade (the accountability primitive)

Sasha posts her trading thesis to X before any transaction is signed. That post is timestamped on a public, immutable feed. Sixty seconds later, she executes the trade on Byreal. The trade is then attested on Mantle via `SashaAgentLog.logTrade()`.

Any agent can execute a trade and claim it was predicted. Sasha's thesis is on-chain before her wallet moves. The trade is the consequence, not the claim.

---

## Five-layer architecture

| Layer | What | Where |
|---|---|---|
| **Identity** | ERC-8004 agent NFT | Mantle |
| **Treasury** | mETH staking position | Mantle (mETH yield funds her gas) |
| **Execution** | Byreal CLMM positions, swaps | Solana |
| **Reasoning** | X posts, timestamped pre-trade | X + indexed on Mantle |
| **Reputation** | `/api/sasha-reputation` portable feed | Any consumer |

---

## Three-chain diagram

```
X post (timestamped thesis)
        |
        v
   [60s accountability window]
        |
        v
Byreal / Solana (CLMM execution)
        |
        +---> SashaAgentLog.logTrade() on Mantle (attestation)
        |
        +---> mantle-treasury.js autoCompound() on Mantle (yield loop)
                ^
                |
        Base $SASHA (social token layer — community, creator economy)
```

---

## Five-source signal pipeline

Every 6 hours, `mantle-signal.js` runs a deterministic, auditable fusion:

| Source | Weight | Data |
|---|---|---|
| Sasha's X posts | **25%** | LLM extracts DeFi sentiment + risk appetite from recent tweets |
| Byreal pool data | **20%** | Live APR, TVL, volume from Byreal CLMM via `byreal-cli` |
| Allora inference | **25%** | Reputation-weighted ensemble SOL/USD predictions (5m + 8h) |
| Elfa AI smart mentions | **15%** | Smart-account social activity leading price moves |
| Polymarket implied odds | **15%** | Real-money crowd intelligence — uncorrelated, unfakeable |

Hard risk-off override: if Elfa or Polymarket detects a risk event, Sasha moves 50% to USDC immediately regardless of other signals. Allora disagreement with social bias reduces position size 40%.

---

## How to run locally

### Prerequisites

```bash
node >= 20
npm install
npm install -g byreal-cli
```

### Environment variables

Copy `.env.example` to `.env`:

```bash
# Required for Mantle execution (VPS only)
MANTLE_AGENT_PK=0x<private-key>
MANTLE_RPC_URL=https://rpc.mantle.xyz

# Signal sources
OPENROUTER_API_KEY=<openrouter.ai>   # social bias LLM
ALLORA_API_KEY=<app.allora.network or developer.upshot.xyz>  # free
ELFA_API_KEY=<elfa.ai>               # free tier

# Notifications
TELEGRAM_BOT_TOKEN=<BotFather>
TELEGRAM_CHAT_ID=<chat-id>

# Polymarket: no key needed
```

### Commands

```bash
npm run signal:dry       # Five-source signal dry-run
npm run signal:allora    # Test Allora signal alone
npm run signal:elfa      # Test Elfa signal alone
npm run signal:polymarket # Test Polymarket signal alone
npm run trade:dry        # Full tweet-before-trade pipeline dry-run
npm run treasury         # mETH treasury status
npm run erc8004:status   # Check ERC-8004 registration
npm run deploy:testnet   # Deploy SashaAgentLog to Mantle Sepolia
npm run deploy:mainnet   # Deploy to Mantle mainnet
```

---

## Signal pipeline verification (dry-run output)

```bash
npm run signal:dry
# → Five-source fusion runs in parallel
# → Logs: social bias, Allora direction, Elfa smart mentions, Polymarket odds
# → Final weighted score and recommendation
```

---

## Deployed contract

```
Address:  [placeholder — update after VPS deploy]
Network:  Mantle Mainnet
TX:       [placeholder]
Explorer: https://explorer.mantle.xyz/address/[address]
```

---

## ERC-8004 agent identity

```
Agent ID: [placeholder — update after erc8004:register runs on VPS]
```

---

## Reputation feed

```
Endpoint: /api/sasha-reputation
Schema:   docs/erc8004-reputation-schema.md
Auth:     none (public, CORS open)
```

Returns: `tradeCount`, `winRate`, `signalAccuracy`, recent trades with Solana TXs + Mantle attestations + pre-tweet IDs. Any DeFi protocol can query this and verify the entire track record independently.

---

## mETH yield loop

`mantle-treasury.js` monitors Sasha's MNT balance on Mantle and auto-compounds yield into mETH when balance exceeds the threshold. Post-trade, `byreal-trade.js` triggers `--action compound` non-blocking. This makes Mantle economically load-bearing — not a receipt chain, her balance sheet.

---

## Hackathon

- **DoraHacks:** https://dorahacks.io/hackathon/mantleturingtesthackathon2026
- **Track:** Agentic Wallets & Economy (Byreal), Path B — RealClaw Real-Life Expansion
- **Deadline:** June 15, 2026

---

## Live dashboard

```
URL: [placeholder — update after Cloudflare Pages deploy]
```

Shows: signal state (all 5 sources), last trade, ERC-8004 + SashaAgentLog status, mETH treasury balance.

---

## Project structure

```
scripts/
  mantle-signal.js         Five-source signal fusion
  byreal-trade.js          Tweet-before-trade orchestration
  mantle-treasury.js       mETH yield loop on Mantle
  deploy-contract.js       Deploy SashaAgentLog.sol
  erc8004-register.js      One-time ERC-8004 registration
  erc8004-write.js         Per-trade attestation
  signals/
    allora.js              Allora inference signal (25% weight)
    elfa.js                Elfa smart mentions (15% weight)
    polymarket.js          Polymarket implied odds (15% weight)
contracts/
  SashaAgentLog.sol        On-chain attestation log (Mantle)
docs/
  erc8004-reputation-schema.md  Portable reputation schema spec
  vps-setup.md             VPS deployment guide
  strategy/winning-thesis.md    Strategic source of truth
```

Full VPS setup: [docs/vps-setup.md](docs/vps-setup.md)
