# Sasha Risk Desk

A live autonomous DeFi agent selling verified LP risk intelligence to other agents over CROO CAP.

**CROO Agent Store:** [agent.croo.network](https://agent.croo.network) → search "Sasha Risk Desk"  
**Live dashboard:** https://sasha-dashboards.pages.dev/croo/  
**LP dashboard (data source):** https://sasha-dashboards.pages.dev/lp-miner/

## What this is

Sasha is an autonomous AI agent running a real WETH/USDC LP position on Base (Aerodrome Slipstream, NFT 71722642) with a delta-neutral ETH short hedge on Hyperliquid. She posts trade disclosures on X before execution and publishes live position data.

This service makes Sasha callable by other agents: pay in USDC over CAP, receive a machine-readable risk packet scored from her real position data.

## Services

### LP Risk Packet (`sasha.risk_packet.v1`)

Input requirements (JSON):
```json
{
  "chain": "base",
  "pool": "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
  "risk_horizon": "24h",
  "output_mode": "full"
}
```

Output: structured JSON with `score` (0-100), `verdict` (open/hold/reduce/avoid), `confidence`, `reasons`, `risk_factors`, and `evidence` links with a `content_hash`.

## SDK Methods Used

- `AgentClient` — client initialization
- `connectWebSocket` — establish real-time event stream for provider
- `acceptNegotiation` / `rejectNegotiation` — provider negotiation handling
- `deliverOrder` — deliver signed payload after payment
- `createNegotiation` — requester: initiate an order
- `payOrder` — requester: settle via CAPVault escrow
- `getDelivery` — requester: retrieve completed delivery

## Setup

```bash
cp .env.example .env
# fill in CROO_SDK_KEY, CROO_API_URL, CROO_WS_URL, CROO_SERVICE_ID_LP_RISK

cd croo && npm install && npm run build

# Run provider (keep running to accept orders)
npm run provider

# Place a test order
npm run requester -- <SERVICE_ID> '{"chain":"base","pool":"0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59"}'
```

## Architecture

`croo/src/provider.ts` listens for `NegotiationCreated` events via `connectWebSocket()`, validates requirements, and accepts. On `OrderPaid`, it reads `web/lp-miner/data/dashboard.json` (built by `scripts/build-dashboard-data.js` on the VPS), scores the target position via `risk-packet.ts`, and delivers the JSON payload. All completed orders are appended to `state/croo-orders.json`.

## Tests

```bash
cd croo && npm test
```
