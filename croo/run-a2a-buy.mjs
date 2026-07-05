#!/usr/bin/env node
/**
 * run-a2a-buy.mjs — A2A buying run: purchase from 6 external CROO agents.
 * Run: cd croo && node run-a2a-buy.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load .env from parent sasha-coin directory
const envPath = path.resolve(__dirname, '../.env');
const envVars = {};
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
  if (m) envVars[m[1]] = m[2].trim();
});
Object.assign(process.env, envVars);

const { AgentClient, NegotiationStatus } = require('@croo-network/sdk');

// ── Targets ──────────────────────────────────────────────────────────────────
const BUY_TARGETS = [
  {
    envVar: 'CROO_SERVICE_ID_FEAR_GREED',
    agent: 'DCA Signal AI Agent',
    serviceName: 'Bitcoin Fear & Greed Index',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_GAS_TRACKER',
    agent: 'SwapCat',
    serviceName: 'Gas Tracker',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_HL_VAULT',
    agent: 'HL Vault Strategy Agent',
    serviceName: 'Hyperliquid Vault Overview',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_WHALE_POSITIONS',
    agent: 'WhaleScope',
    serviceName: 'wallet_positions',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_BTC_TRADES',
    agent: 'BtcForecast',
    serviceName: 'BTC Recent Trades',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_TOP_TRADERS',
    agent: 'AlphaTrack',
    serviceName: 'top_traders',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_PROOF_MESH',
    agent: 'proofMesh',
    serviceName: 'verification',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_CROO_CONTRACTOR',
    agent: 'CROO Contractor',
    serviceName: 'contractor',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_VERIS_DILIGENCE',
    agent: 'VERIS',
    serviceName: 'Agent Due Diligence',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_VERIS_PROJECT',
    agent: 'VERIS',
    serviceName: 'Project Due Diligence',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_VERIS_TRUST',
    agent: 'VERIS',
    serviceName: 'Trust Compare',
    requirementsText: '{}',
  },
  {
    envVar: 'CROO_SERVICE_ID_VERICLAIM',
    agent: 'VeriClaim',
    serviceName: 'Insurance Claim 2',
    requirementsText: '{}',
  },
];

const LOG_PATH = path.resolve(__dirname, 'data/orders-log.json');
const TIMEOUT_MS = 180_000;

function loadLog() {
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf8')); } catch { return []; }
}
function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

async function buyOne(client, target) {
  const serviceId = process.env[target.envVar] ?? '';
  if (!serviceId) return { ok: false, error: `${target.envVar} not set` };

  const deadline = Date.now() + TIMEOUT_MS;
  console.log(`\n→ Buying "${target.serviceName}" from ${target.agent} (${serviceId.slice(0,8)}…)`);

  try {
    const neg = await client.negotiateOrder({
      serviceId,
      requirements: target.requirementsText,
    });
    const negId = neg.negotiationId;
    console.log(`  negotiation: ${negId}`);

    let orderId = null;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      const updated = await client.getNegotiation(negId).catch(() => null);
      if (!updated) continue;

      if (updated.status === NegotiationStatus.Rejected ||
          updated.status === NegotiationStatus.Expired) {
        return { ok: false, error: `negotiation ${updated.status}` };
      }

      if (updated.status === NegotiationStatus.Accepted) {
        const orders = await client.listOrders({ role: 'buyer', page: 1, page_size: 50 }).catch(() => []);
        const orderList = Array.isArray(orders) ? orders : (orders.orders || orders.items || []);
        const match = orderList.find(o => o.negotiationId === negId);
        if (match) { orderId = match.orderId || match.id; break; }
      }
    }

    if (!orderId) return { ok: false, error: 'timeout waiting for acceptance' };
    console.log(`  order accepted: ${orderId}`);

    // Wait for order to transition from 'creating' → 'created' before paying
    let orderStatus = 'creating';
    while (orderStatus === 'creating' && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const orders = await client.listOrders({ role: 'buyer', page: 1, page_size: 50 }).catch(() => []);
      const orderList = Array.isArray(orders) ? orders : (orders.orders || orders.items || []);
      const current = orderList.find(o => (o.orderId || o.id) === orderId);
      if (current) { orderStatus = current.status; console.log(`  order status: ${orderStatus}`); }
    }
    if (orderStatus !== 'created') return { ok: false, orderId, error: `order stuck in ${orderStatus}` };

    await client.payOrder(orderId);
    console.log(`  paid ✓`);

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      const delivery = await client.getDelivery(orderId).catch(() => null);
      const text = delivery?.deliverableText || delivery?.deliverable_text || delivery?.content || '';
      const done = text || delivery?.status === 'accepted' || delivery?.status === 'confirmed';
      if (done) {
        const summary = text.slice(0, 200) || `[delivery ${delivery?.status}]`;
        console.log(`  delivered ✓  →  ${summary.slice(0, 80)}`);
        return { ok: true, orderId, summary, deliveryStatus: delivery?.status };
      }
    }
    return { ok: false, orderId, error: 'timeout waiting for delivery' };
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.log(`  error: ${msg.slice(0, 120)}`);
    return { ok: false, error: msg };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const KEY = process.env.CROO_SDK_KEY ?? '';
if (!KEY) { console.error('CROO_SDK_KEY not set'); process.exit(1); }

const client = new AgentClient(
  {
    baseURL: process.env.CROO_API_URL ?? 'https://api.croo.network',
    wsURL: process.env.CROO_WS_URL ?? 'wss://api.croo.network/ws',
  },
  KEY,
);

const active = BUY_TARGETS.filter(t => (process.env[t.envVar] ?? '').length > 0);
console.log(`A2A buy run: ${active.length} services targeted\n${'─'.repeat(50)}`);

// Sequential — concurrent PayOrder calls cause NONCE_ERROR on AA wallet
let successCount = 0;
for (const target of active) {
  let res;
  try {
    res = await buyOne(client, target);
  } catch (err) {
    res = { ok: false, error: String(err) };
  }

  const entry = {
    ts: new Date().toISOString(),
    type: 'requester',
    agent: target.agent,
    serviceName: target.serviceName,
    serviceId: process.env[target.envVar],
    ...res,
  };
  appendLog(entry);
  if (res.ok) successCount++;
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Done: ${successCount}/${active.length} successful`);
console.log(`Log: ${LOG_PATH}`);
console.log(`Current log size: ${loadLog().length} entries`);
