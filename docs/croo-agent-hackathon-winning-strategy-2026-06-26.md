# CROO Agent Hackathon — Sasha Winning Strategy

**Date:** 2026-06-26  
**Hackathon:** https://dorahacks.io/hackathon/croo-hackathon  
**Submission window:** 2026-06-09 09:00 → 2026-07-12 09:00  
**Prize pool:** ~$10,200 + Agent Store featured listing + $CROO airdrop whitelist  
**Status:** research + strategy brief, not yet implemented

## Executive Call

Build **Sasha Risk Desk for Agents**: a paid CROO/CAP service where Sasha sells machine-readable DeFi risk, position-quality, and agent-reputation intelligence backed by her real autonomous LP/trading history.

Primary tracks:

1. **DeFi / On-chain Ops Agents** — monitoring, alerts, execution.
2. **Data & Verification Agents** — provenance, credentials, output checks.

Winning thesis:

> Most CROO entries will be wrappers around an API or a one-off chatbot. Sasha is already a live autonomous economic actor with wallets, positions, dashboards, on-chain attestations, and a public social identity. CROO should not make Sasha possible; CROO should make Sasha commercially callable by other agents.

Do not pitch "another alpha bot." Pitch **a commercial primitive for other agents**: pay Sasha over CAP, receive verified DeFi risk intelligence with evidence links, hashes, and a reproducible schema.

## What CROO Judges Actually Score

Judging criteria from the DoraHacks judging image:

| Criterion | Weight | What it rewards | Sasha implication |
|---|---:|---|---|
| Technical Execution | 30% | Robust CAP integration, reliable A2A interactions, proper payment state handling. Bonus: 10+ real CAP orders. | We need provider and requester flows, logs, retries, and real completed orders. |
| A2A Composability | 25% | Number, diversity, and depth of A2A relationships. CROO supplies aggregated CAP order data to judges. | The order graph matters almost as much as the code. Target 10+ orders, 5+ buyer wallets, 3+ counterparty agents. |
| Innovation | 20% | Hard-to-replicate use case; worse or impossible on a normal API marketplace. | Sasha's moat is real autonomous DeFi state + public accountability + commercial composability. |
| Usability & Real Adoption | 15% | Path to real users, early organic interactions, retention potential. | Make outputs immediately useful to agents: JSON schemas, compact risk scores, links, TTLs. |
| Presentation | 10% | Demo clarity, README reproducibility, crisp value prop. | Max 5-min demo: CAP order → USDC settlement → Sasha delivers verified risk packet → requester consumes it. |

Hard submission requirements:

- Listed on CROO Agent Store.
- Integrated with CAP: callable and settles on-chain.
- Public repo with permissive license.
- Demo video max 5 minutes.
- README with setup instructions, SDK methods used, integration notes.
- DoraHacks BUIDL filed before 2026-07-12 09:00.

Anti-sybil / reward-risk flags:

- Fewer than 3 unique counterparty agents.
- Fewer than 5 unique buyer wallets.
- Highly concentrated self-trade pattern.
- Random 10% human audit failure.

Therefore: **do not ship a lonely demo order.** The win path includes distribution engineering.

## Competitor Scan

The BUIDL page showed 39 submissions as of 2026-06-26. Visible competitors include:

- **CROO AI Oracle** — DeFi intelligence, zone entries, provider failover.
- **ProofMesh** — multi-agent verification network for Web3 claims.
- **SwapCat Vision** — Telegram-native on-chain data/swap/discovery agent.
- **Polymarket Broker** — prediction market data + strategy execution.
- **BTC Up/Down Polymarket Agent** — 5-minute BTC prediction market trader.
- **WhaleScope** — Hyperliquid whale-open monitoring.
- **DeFi Yield Scout** — callable DeFi yield intelligence over CAP.
- **CAProxy** — composes several CROO Store agents into one paid flow.
- **Flow Forensics** — CAP order lifecycle debugging.
- **vibe-deploy** — paid deploy primitive for agents.

Takeaways:

- The DeFi lane is crowded with generic alpha/yield/wallet intelligence.
- The verification lane is crowded with "trust me less" claims.
- Few visible projects combine a live autonomous economic actor, a public track record, and a paid A2A service.
- The strongest rival by fit is probably **DeFi Yield Scout**; beat it by being narrower, more credible, and more verifiable: "Sasha can score an LP because Sasha runs one."

## Product Shape

### Service 1 — Sasha LP Risk Packet

Provider service listed on CROO Store.

Input schema:

```json
{
  "chain": "base",
  "pool": "0x...",
  "position_nft": "optional token id",
  "risk_horizon": "6h | 24h | 7d",
  "consumer_agent": "optional agent name/id",
  "output_mode": "compact | full"
}
```

Output schema:

```json
{
  "schema": "sasha.risk_packet.v1",
  "as_of": "2026-06-26T00:00:00Z",
  "score": 0,
  "verdict": "open | hold | reduce | avoid",
  "confidence": 0,
  "reasons": [],
  "risk_factors": {
    "range_distance": null,
    "hedge_drift": null,
    "funding": null,
    "liquidity": null,
    "volatility": null,
    "oracle_or_data_health": null
  },
  "evidence": {
    "dashboard": "https://sasha-dashboards.pages.dev/lp-miner/",
    "source_files": [],
    "onchain_links": [],
    "content_hash": "0x..."
  },
  "ttl_seconds": 3600
}
```

Why it can win:

- Uses existing Sasha LP monitor, dashboard data, Base/Aerodrome position reconciler, Hyperliquid hedge checks, and signal scripts.
- Clear utility for other agents: "Should I route capital to this LP, copy it, hedge it, or avoid it?"
- Output is structured, composable, and auditable.

### Service 2 — Sasha Reputation Proof

Provider service for agents that need to evaluate whether Sasha, or another agent following the Sasha schema, is credible.

Input:

```json
{
  "agent": "sasha | url | address",
  "checks": ["pre_trade_disclosure", "onchain_attestation", "order_history", "wallet_continuity"]
}
```

Output:

```json
{
  "schema": "sasha.reputation_proof.v1",
  "agent": {
    "name": "Sasha",
    "x": "https://x.com/SashaCoin95",
    "wallets": [],
    "identity": []
  },
  "checks": [],
  "verdict": "verified | partial | unverifiable",
  "evidence": []
}
```

This reuses `docs/erc8004-reputation-schema.md`, `contracts/SashaAgentLog.sol`, and the planned `/api/sasha-reputation` surface.

### Service 3 — Sasha Counterparty Scout

Requester-side agent that buys services from other CROO agents and aggregates their answers into Sasha's risk loop.

This is how to score A2A composability:

- Buy from DeFi Yield Scout, WhaleScope, Polymarket Broker, Flow Forensics, ProofMesh, CAProxy, and any early agent willing to reciprocate.
- Feed those purchased outputs into Sasha's own deliverables.
- Document every counterparty order ID, tx hash, and delivered artifact.

Important: this should be real usage, not fake self-trading. Sasha can pay other agents because those outputs improve her product.

## Architecture

```
CROO Store service
      |
      v
@croo-network/sdk AgentClient
      |
      +-- provider flow:
      |     negotiation_created -> acceptNegotiation()
      |     order_paid -> build risk packet -> deliverOrder()
      |
      +-- requester flow:
            negotiateOrder() -> payOrder()
            order_completed -> getDelivery()

Sasha data sources
      |
      +-- web/lp-miner/data/dashboard.json
      +-- scripts/build-dashboard-data.js
      +-- scripts/lp-reconcile.js
      +-- scripts/position-monitor.js
      +-- scripts/hedge-executor.js --check
      +-- docs/erc8004-reputation-schema.md
      +-- Mantle / X Layer / Base explorer links
```

Implementation should live in a small, inspectable submodule, probably:

```
croo/
  README.md
  package.json
  src/
    provider.ts
    requester.ts
    risk-packet.ts
    reputation-proof.ts
    croo-client.ts
    types.ts
  examples/
    request-lp-risk.ts
    request-reputation-proof.ts
  data/
    sample-risk-packet.json
```

Use the Node SDK. Current SDK facts:

- Package: `@croo-network/sdk`, latest observed version `0.2.1`.
- Config needs `CROO_API_URL`, `CROO_WS_URL`, `CROO_SDK_KEY`, optional `BASE_RPC_URL`.
- Provider flow listens to `EventType.NegotiationCreated`, calls `acceptNegotiation`, then listens to `EventType.OrderPaid`, calls `deliverOrder`.
- Requester flow calls `negotiateOrder`, listens to `OrderCreated`, calls `payOrder`, then reads `getDelivery`.
- Deliverables can be `text` or `schema`; choose `schema` if the Store UI supports it cleanly, otherwise deliver JSON as text and document the schema.

## Build Plan

### Phase 0 — CROO Onboarding Spike

Goal: one successful CAP order using SDK examples before touching Sasha logic.

Tasks:

- Create Sasha agent in CROO Dashboard.
- Register one cheap service, e.g. `$0.10` "Sasha heartbeat proof".
- Get `CROO_SDK_KEY`, service ID, and AA wallet address.
- Fund the agent AA wallet with Base USDC as needed.
- Run a provider loop based on CROO's example.
- Run a requester loop from either a second Sasha test agent or a collaborator.
- Record `orderId`, `payTxHash`, `deliverTxHash`, `clearTxHash`.

GO bar: one completed order visible in CROO and on Base.

### Phase 1 — Provider MVP

Goal: Sasha sells a real LP Risk Packet.

Tasks:

- Add `croo/src/risk-packet.ts` that reads `web/lp-miner/data/dashboard.json`.
- Build deterministic scoring from existing dashboard fields:
  - funded/reconciled state,
  - in-range / out-of-range state,
  - range distance,
  - hedge delta,
  - liquidation/funding flags,
  - data freshness.
- Include evidence links and content hash.
- Wire provider event loop:
  - reject malformed requirements with clear reason,
  - accept valid jobs,
  - deliver JSON after payment only,
  - log every order to `state/croo-orders.json` or `croo/data/orders-log.json` with no secrets.
- Add README reproduction.

GO bar: 3 completed paid orders, at least 2 distinct requester wallets/agents.

### Phase 2 — A2A Order Graph

Goal: turn judging's 25% A2A composability into a visible strength.

Tasks:

- Register a requester Sasha agent/service key.
- Buy 5+ services from other CROO agents.
- Recruit 3+ other builders for reciprocal calls:
  - DeFi Yield Scout,
  - WhaleScope,
  - Polymarket Broker,
  - Flow Forensics,
  - ProofMesh,
  - CAProxy,
  - vibe-deploy.
- Use purchased outputs inside Sasha's packet under `external_signals`.
- Log all counterparty `orderId`s and tx hashes.

GO bar: 10+ real CAP orders, 3+ unique counterparty agents, 5+ unique buyer wallets if possible.

### Phase 3 — Dashboard + Demo

Goal: make human audit pass instantly.

Add `web/croo/` static page:

- Current CROO services.
- Completed CAP orders count.
- Unique buyers/counterparties.
- Last 5 delivered risk packets.
- Links to Base txs / CROO order IDs.
- "How to call Sasha" code snippet.

Demo video structure, max 5 minutes:

1. CROO problem: agents can work but cannot earn or compose.
2. Sasha is already live: show LP dashboard / on-chain history.
3. CROO Store listing: show Sasha service.
4. Requester pays over CAP: show order and Base tx.
5. Provider delivery: show structured JSON packet and evidence hash.
6. A2A graph: show Sasha buying other agents and using their results.
7. Close: Sasha is not a demo agent; CROO made her commercially callable.

### Phase 4 — Submission

Required fields:

- Project name: `Sasha Risk Desk`
- One-liner: `A live autonomous DeFi agent selling verified LP risk and reputation packets to other agents over CROO CAP.`
- Tracks: DeFi / On-chain Ops Agents; Data & Verification Agents.
- GitHub: existing repo or a filtered public repo if secrets/state risk requires it.
- Demo: YouTube link, under 5 minutes.
- Live: `https://sasha-dashboards.pages.dev/croo/`
- CROO Store listing URL.
- README section with SDK methods used:
  - `connectWebSocket`,
  - `acceptNegotiation`,
  - `rejectNegotiation`,
  - `payOrder`,
  - `deliverOrder`,
  - `getDelivery`,
  - `listOrders`.

## What To Avoid

- Do not make a generic "ask Sasha anything" chatbot.
- Do not frame the product as investment advice.
- Do not rely on one self-paid order.
- Do not let the demo show only the UI; show CAP order state and tx hashes.
- Do not overbuild execution/fund-transfer services unless the provider flow is already stable.
- Do not promise autonomous capital movement through CROO. Start with intelligence and verification; execution can be future work.

## Winning Edge

The phrase to keep coming back to:

> Sasha is the first CROO-listed agent whose product is her own operating history.

Most agents sell generated text. Sasha sells a verified read on a real autonomous balance sheet.

## Source Notes

- DoraHacks detail page via reader: submission requirements, tracks, anti-sybil flags, deadline, prize pool.
- DoraHacks judging image: Technical 30%, A2A 25%, Innovation 20%, Adoption 15%, Presentation 10%.
- CROO docs `llms.txt`: docs index and markdown page availability.
- CROO core mechanics: Negotiate / Lock / Deliver / Clear lifecycle; order, provider, requester, SLA, log attestation, escrow.
- CROO order lifecycle docs: `created -> paid -> completed`, WebSocket events, escrow refund on rejection/expiry, hash-on-chain delivery.
- CROO service registration docs: services are created in Agent Store; price, SLA, deliverable type, requirements type; USDC on Base.
- CROO security docs: AA wallets, Owner/Executor separation, CAPVault escrow, Base deployment.
- CROO Node SDK README/GitHub: `@croo-network/sdk` v0.2.1, provider/requester examples, API methods.
- CAP contracts README: Base mainnet deployments for CAPCore and CAPVault, ERC-4337/7579, EIP-3009 gasless payments.
