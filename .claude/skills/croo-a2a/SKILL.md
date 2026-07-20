---
name: croo-a2a
description: Build, debug, and operate CROO Agent-to-Agent orders on the CAP protocol (Base mainnet). Covers both provider (selling services) and requester (buying from other agents) roles. Wire when working on croo/ directory, CROO hackathon, or A2A order graph.
---

# CROO A2A Skill

CROO (CAP = CROO Agent Protocol) is a decentralized agent commerce layer on Base L2.
Agents register services, negotiate with each other, pay via USDC escrow, and deliver proofs on-chain.

---

## Platform Facts

| Fact | Value |
|------|-------|
| Chain | Base Mainnet (Chain ID 8453) |
| Payment token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Gas | Sponsored by CROO (Pimlico Paymaster). No ETH needed. |
| SDK | `@croo-network/sdk` (Node.js), `croo-sdk` (Python), `go-sdk` (Go) |
| API | `https://api.croo.network` |
| WS | `wss://api.croo.network/ws` |
| Dashboard | https://agent.croo.network |
| Docs | https://docs.croo.network/llms.txt (append `.md` to any page URL for raw markdown) |
| GitHub | https://github.com/CROO-Network |

---

## Account Hierarchy

```
User
└── Owner (EOA wallet — shared across all agents)
    ├── Navigator (auto-created, primary UI account)
    │   └── AA Wallet — Navigator balance (used by UI chatbot, NOT by SDK)
    └── Sasha Risk Desk (our agent)
        └── AA Wallet — agent balance, SDK payment source, earnings destination
```

- **Navigator**: the CROO UI chatbot. Its AA wallet holds the "$X.XX" balance shown in dashboard.
- **Agent AA Wallet**: what the SDK uses for all on-chain operations. MUST hold USDC for buying.
- **Deposit USDC to the Agent AA Wallet** (visible in Dashboard → Configure), NOT the Navigator.
- Agent status: `draft` (SDK not connected) → `online` (WS connected + heartbeat) → `offline` (paused).
- Agent goes Online automatically when `connectWebSocket()` is called and handshake completes.

### Sasha's Addresses
- Sasha Risk Desk agent AA wallet: `0x7bA979aC02EA8eF26B0556949F8e60AE6834191E` (Base) ← fund THIS for buying
- Navigator AA wallet: `0xeBD07bD2767F7A6822d15b3CC4AA5f5Fc2C094de` ($3.98 — displayed in CROO dashboard, NOT used by SDK)
- Sasha Risk Desk agentId: `f64edd68-41f0-4b2f-8ee3-8a21fdc87edb`

---

## Order Lifecycle

```
Off-chain                              On-chain
────────                              ────────
Requester: negotiateOrder()
  → Provider WS: negotiation_created
Provider: acceptNegotiation()     →   createOrder (from Requester AA wallet)
                                  →   [WS] order_created → both parties
Requester: payOrder()             →   USDC locked in CAPVault escrow
                                  →   [WS] order_paid → provider
Provider: deliverOrder()          →   keccak256 hash on-chain → settlement
                                  →   [WS] order_completed → requester
Requester: getDelivery()
```

Order statuses: `created` → `paid` → `completed` | `rejected` | `expired`

Negotiation statuses: `pending` → `accepted` | `rejected` | `expired`

---

## SDK Reference (Node.js)

```typescript
import { AgentClient, NegotiationStatus, EventType, DeliverableType } from '@croo-network/sdk';

const client = new AgentClient(
  { baseURL: 'https://api.croo.network', wsURL: 'wss://api.croo.network/ws' },
  'croo_sk_...'
);
```

### Requester methods
```typescript
// Initiate negotiation (requirements MUST be JSON.stringify'd string, not raw object)
const neg = await client.negotiateOrder({ serviceId, requirements: JSON.stringify({ key: val }) });

// Poll until accepted
const updated = await client.getNegotiation(neg.negotiationId);

// List orders — role param is REQUIRED (throws INVALID_PARAMETERS without it)
const orders = await client.listOrders({ role: 'buyer', page: 1, page_size: 50 });
// Returns raw array, not { orders: [...] }

// Pay — handles USDC approve automatically. MUST be sequential, not concurrent.
await client.payOrder(orderId);

// Get delivery
const delivery = await client.getDelivery(orderId);
// delivery.deliverableText for text services
```

### Provider methods
```typescript
const stream = await client.connectWebSocket();

stream.on(EventType.NegotiationCreated, async (e) => {
  await client.acceptNegotiation(e.negotiation_id);
});

stream.on(EventType.OrderPaid, async (e) => {
  await client.deliverOrder(e.order_id, {
    deliverableType: DeliverableType.Text,
    deliverableText: 'result here',
  });
});
```

### List options
```typescript
// Negotiations — role required: 'requester' | 'provider'
await client.listNegotiations({ role: 'requester', status: 'pending', page: 1, pageSize: 50 });

// Orders — role required: 'buyer' | 'provider'
await client.listOrders({ role: 'buyer', status: 'paid', page: 1, pageSize: 50 });
```

### WS events

| Event | Pushed to | Trigger |
|-------|-----------|---------|
| `NegotiationCreated` | Provider | Requester initiated negotiation |
| `NegotiationRejected` | Requester | Provider rejected |
| `NegotiationExpired` | Requester | Timeout |
| `OrderCreated` | Both | On-chain order created |
| `OrderPaid` | Provider | Escrow locked |
| `OrderCompleted` | Requester | Delivery confirmed |
| `OrderRejected` | Both | Order rejected |
| `OrderExpired` | Both | SLA timeout |

---

## Sasha's Services (Provider)

| Env var | Service | Price | Description |
|---------|---------|-------|-------------|
| `CROO_SERVICE_ID_LP_RANGE` | LP Range Status Signal | $0.10 | Is Sasha's WETH/USDC position in range? |
| `CROO_SERVICE_ID_GAS_CHECK` | Base Gas Cost Check | $0.05 | Current Base L2 gas in Gwei |

Provider is a bundled CJS file at `/tmp/croo-ws-provider.cjs` on VPS, running as PID (check with `ps aux | grep croo`).
Build: `npm run build && npx esbuild dist/provider-entrypoint.js --bundle --platform=node --format=cjs --outfile=/tmp/croo-ws-provider.cjs`
Start: `/tmp/start-ws-provider.sh`

---

## A2A Buy Targets (Requester)

| Env var | Agent | Service |
|---------|-------|---------|
| `CROO_SERVICE_ID_FEAR_GREED` | DCA Signal AI Agent | Bitcoin Fear & Greed Index |
| `CROO_SERVICE_ID_GAS_TRACKER` | SwapCat / SwapGod | Gas Tracker |
| `CROO_SERVICE_ID_HL_VAULT` | HL Vault Strategy Agent | Hyperliquid Vault Overview |
| `CROO_SERVICE_ID_WHALE_POSITIONS` | WhaleScope | wallet_positions |
| `CROO_SERVICE_ID_BTC_TRADES` | BtcForecast | BTC Recent Trades |
| `CROO_SERVICE_ID_TOP_TRADERS` | AlphaTrack | top_traders |
| `CROO_SERVICE_ID_PROOF_MESH` | proofMesh | verification |
| `CROO_SERVICE_ID_CROO_CONTRACTOR` | CROO Contractor | contractor |
| `CROO_SERVICE_ID_VERIS_DILIGENCE` | VERIS | Agent Due Diligence |
| `CROO_SERVICE_ID_VERIS_PROJECT` | VERIS | Project Due Diligence |
| `CROO_SERVICE_ID_VERIS_TRUST` | VERIS | Trust Compare |
| `CROO_SERVICE_ID_VERICLAIM` | VeriClaim | Insurance Claim 2 |

Buy script: `cd croo && node run-a2a-buy.mjs`

---

## Known Gotchas (Hard-Won)

### 1. AA wallet must hold USDC
When provider accepts a negotiation, CROO auto-calls `createOrder` from the REQUESTER's AA wallet via Pimlico USDC paymaster. 0 USDC → UserOperation fails silently → negotiation stays "pending" forever.
- **Symptom**: All negotiations stay "pending" even for agents with 5,000+ orders/day.
- **Fix**: Send USDC to `0xeBD07bD2767F7A6822d15b3CC4AA5f5Fc2C094de` on Base.
- **Confirm**: If you see `PIMLICO_ERROR: failed to request usdc payma` in any rejection, it's this.

### 2. listOrders requires `role`
`listOrders()` without `role` throws `INVALID_PARAMETERS`. The SDK silently swallows this if you catch it and return `{ orders: [] }`. Result: you never find your order ID → never pay → never complete.
```js
// WRONG — silently returns nothing
const orders = await client.listOrders({ page: 1 }).catch(() => ({ orders: [] }));

// CORRECT
const orders = await client.listOrders({ role: 'buyer', page: 1, page_size: 50 }).catch(() => []);
const orderList = Array.isArray(orders) ? orders : (orders.orders || orders.items || []);
```

### 3. requirements must be JSON string
`negotiateOrder` requires `requirements: JSON.stringify({...})`, NOT a raw object. Raw object → `CODEC 400`.
```js
requirements: JSON.stringify({ asset: 'BTC' })  // correct
requirements: { asset: 'BTC' }                   // 400 error
```

### 4. PayOrder must be sequential
Concurrent `payOrder` calls from the same agent wallet → `NONCE_ERROR` at the bundler. Always loop sequentially.

### 5. One WS connection per SDK key
If VPS provider is running (WS open) and another process tries to open a WS with the same key → `1008: key already has an active connection`. The buy script (`run-a2a-buy.mjs`) uses REST only, so it's safe to run while provider is live. Never start two providers simultaneously.

### 6. esbuild: use CJS format for provider
`--format=esm` fails when bundling CJS deps (dotenv etc.): "Dynamic require of 'fs' is not supported".
Use `--format=cjs`. But in CJS bundles, `import.meta.url` is undefined → wrap `fileURLToPath` in try/catch.
```ts
let __dirname = '';
try { __dirname = path.dirname(fileURLToPath(import.meta.url)); } catch {}
```

### 7. Agents are NOT offline during high-volume periods
SwapGod (5,000+ orders), DCA Signal (5,000+ orders) complete orders every minute 24/7. If YOUR negotiations stay pending, the cause is almost certainly the USDC balance issue (#1), not agent availability.

### 8. payOrder(orderId) not payOrder(negotiationId)
`payOrder` takes the ORDER ID (from `listOrders`), not the negotiation ID. After acceptance, always call `listOrders({ role: 'buyer' })` to find the order, then pay using `order.orderId || order.id`.

### 9. VPS .env patching — use Python scp, not SSH heredoc
Shell heredocs strip backtick template literals and `${}` tokens. Write Python patch scripts locally, scp them over, run via `python3 /tmp/patch.py /path/.env`.

### 10. CROO acceptance window is narrow
After acceptance, listOrders may return 0 immediately — poll with 5s burst for 3 minutes.
But if wallet is empty (see #1), `listOrders` will never return the order because createOrder failed.

---

## Hackathon A2A Order Graph Requirements

| Requirement | Status |
|-------------|--------|
| 10+ completed orders | Need USDC funded first |
| 5+ unique wallets involved | Achieved via multiple agents + our A2A buys |
| 3+ unique agents | SwapGod + DCA Signal + AlphaTrack + VERIS + proofMesh |
| delivery_hash in packets | Wired in provider.ts `deliverOrder` |
| A2A composability proof | LP Risk Packet embeds `external_agent_inputs` with gas check order ID |

Hackathon deadline: **Jul 12, 2026** | Prize: $10,200 | Score: 25% from A2A order graph

---

## Deployment Checklist (Provider)

1. `npm run build` in croo/
2. `npx esbuild dist/provider-entrypoint.js --bundle --platform=node --format=cjs --outfile=/tmp/croo-ws-provider.cjs`
3. `scp /tmp/croo-ws-provider.cjs root@187.77.42.134:/tmp/`
4. Kill old provider: `ssh ... "kill $(pgrep -f croo-ws-provider) 2>/dev/null; true"`
5. Start: `ssh ... "nohup node /tmp/croo-ws-provider.cjs > /tmp/croo-ws.log 2>&1 &"`
6. Verify: `ssh ... "tail -5 /tmp/croo-ws.log"` → should see "websocket connected"
7. Check store: https://agent.croo.network/agents → Sasha Risk Desk → status Online

## Runtime Checks

```bash
# Provider alive?
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 "ps aux | grep croo-ws | grep -v grep"

# Recent provider logs
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 "tail -20 /tmp/croo-ws.log"

# Run A2A buys
cd croo && node run-a2a-buy.mjs

# Check buy log
cat croo/data/orders-log.json | python3 -c "import json,sys; [print(e['ts'][:19], e['agent'], e.get('ok'), e.get('error','')[:60]) for e in json.load(sys.stdin)[-20:]]"
```
