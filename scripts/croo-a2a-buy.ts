#!/usr/bin/env npx ts-node --esm
/**
 * croo-a2a-buy.ts
 * Buy from 6 external CROO agents to build the A2A order graph.
 * Run with: cd croo && npx ts-node --esm ../scripts/croo-a2a-buy.ts
 */
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { AgentClient } from '@croo-network/sdk';
import fs from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────
const BUY_TARGETS = [
  {
    envVar: 'CROO_SERVICE_ID_FEAR_GREED',
    agent: 'DCA Signal AI Agent',
    serviceName: 'Bitcoin Fear & Greed Index',
    requirementsText: '{"asset":"BTC"}',
    used_for: 'fear_greed_context',
  },
  {
    envVar: 'CROO_SERVICE_ID_GAS_TRACKER',
    agent: 'SwapCat',
    serviceName: 'Gas Tracker',
    requirementsText: '{"chain":"ethereum"}',
    used_for: 'gas_context',
  },
  {
    envVar: 'CROO_SERVICE_ID_HL_VAULT',
    agent: 'HL Vault Strategy Agent',
    serviceName: 'Hyperliquid Vault Overview',
    requirementsText: '{"summary":true}',
    used_for: 'hl_vault_context',
  },
  {
    envVar: 'CROO_SERVICE_ID_WHALE_POSITIONS',
    agent: 'WhaleScope',
    serviceName: 'wallet_positions',
    requirementsText: '{"summary":true}',
    used_for: 'whale_context',
  },
  {
    envVar: 'CROO_SERVICE_ID_BTC_TRADES',
    agent: 'BtcForecast',
    serviceName: 'BTC Recent Trades',
    requirementsText: '{}',
    used_for: 'btc_trade_context',
  },
  {
    envVar: 'CROO_SERVICE_ID_TOP_TRADERS',
    agent: 'AlphaTrack',
    serviceName: 'top_traders',
    requirementsText: '{}',
    used_for: 'top_traders_context',
  },
];

const LOG_PATH = path.resolve(__dirname, '../croo/data/orders-log.json');
const TIMEOUT_MS = 45_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadLog(): object[] {
  try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch { return []; }
}

function appendLog(entry: object) {
  const log = loadLog();
  log.push(entry);
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// ─── Buy single service ────────────────────────────────────────────────────────
async function buyOne(
  client: AgentClient,
  target: (typeof BUY_TARGETS)[number],
): Promise<{ ok: boolean; orderId?: string; summary?: string; error?: string }> {
  const serviceId = process.env[target.envVar] ?? '';
  if (!serviceId) return { ok: false, error: `${target.envVar} not set` };

  const deadline = Date.now() + TIMEOUT_MS;
  console.log(`\n→ Buying "${target.serviceName}" from ${target.agent}...`);

  try {
    const neg = await client.negotiateOrder({
      serviceId,
      requirements: target.requirementsText,
    });
    const negId = neg.negotiationId;
    console.log(`  negotiation: ${negId}`);

    // Poll for acceptance
    let orderId: string | null = null;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      const updated = await client.getNegotiation(negId).catch(() => null);
      if (!updated) continue;
      const { NegotiationStatus } = await import('@croo-network/sdk');
      if (updated.status === NegotiationStatus.Rejected || updated.status === NegotiationStatus.Expired) {
        return { ok: false, error: `negotiation ${updated.status}` };
      }
      if (updated.status === NegotiationStatus.Accepted) {
        const orders = await client.listOrders().catch(() => []);
        const match = orders.find((o: any) => o.negotiationId === negId);
        if (match) { orderId = match.orderId; break; }
      }
    }
    if (!orderId) return { ok: false, error: 'timeout waiting for acceptance' };
    console.log(`  order: ${orderId}`);

    // Pay
    await client.payOrder(orderId);
    console.log(`  paid ✓`);

    // Poll for delivery
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      const delivery = await client.getDelivery(orderId).catch(() => null);
      if (delivery?.deliverableText) {
        const summary = delivery.deliverableText.slice(0, 200);
        console.log(`  delivered ✓: ${summary.slice(0, 80)}…`);
        return { ok: true, orderId, summary };
      }
    }
    return { ok: false, orderId, error: 'timeout waiting for delivery' };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const CROO_SDK_KEY = process.env.CROO_SDK_KEY ?? '';
const CROO_API_URL = process.env.CROO_API_URL ?? 'https://api.croo.network';
const CROO_WS_URL = process.env.CROO_WS_URL ?? 'wss://api.croo.network/ws';

if (!CROO_SDK_KEY) { console.error('CROO_SDK_KEY not set'); process.exit(1); }

const client = new AgentClient(
  { baseURL: CROO_API_URL, wsURL: CROO_WS_URL },
  CROO_SDK_KEY,
);

const active = BUY_TARGETS.filter(t => (process.env[t.envVar] ?? '').length > 0);
console.log(`Running A2A buying for ${active.length} services...`);

let successCount = 0;
const results: object[] = [];

// Buy all concurrently — each has its own 45s timeout
const settled = await Promise.allSettled(active.map(t => buyOne(client, t)));

for (let i = 0; i < active.length; i++) {
  const target = active[i]!;
  const result = settled[i]!;
  const value = result.status === 'fulfilled' ? result.value : { ok: false, error: String((result as any).reason) };

  const entry = {
    ts: new Date().toISOString(),
    agent: target.agent,
    serviceName: target.serviceName,
    serviceId: process.env[target.envVar],
    used_for: target.used_for,
    ...value,
  };
  results.push(entry);
  appendLog(entry);

  if (value.ok) {
    successCount++;
    console.log(`\n✅ ${target.agent} — ${target.serviceName}: order ${value.orderId}`);
  } else {
    console.log(`\n❌ ${target.agent} — ${target.serviceName}: ${value.error}`);
  }
}

console.log(`\n─────────────────────────────────`);
console.log(`Done: ${successCount}/${active.length} buys succeeded`);
console.log(`Log: ${LOG_PATH}`);
