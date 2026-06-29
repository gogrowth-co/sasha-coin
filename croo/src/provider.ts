import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DeliverableType, EventType } from '@croo-network/sdk';
import { createClient } from './croo-client.js';
import { buildRiskPacket } from './risk-packet.js';
import { fetchFreeContext } from './free-data.js';
import { appendOrder } from './logger.js';
import { handleLpRangeSignal } from './services/lp-range-signal.js';
import { handleGasCheck } from './services/gas-check.js';
import type { DashboardData, RiskPacketInput, OrderLogEntry } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPPORTED_CHAINS = ['base'];
const DASHBOARD_PATH = path.resolve(__dirname, '../../web/lp-miner/data/dashboard.json');

export function parseRequirements(raw: string): RiskPacketInput | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RiskPacketInput>;
    if (!parsed.chain) return null;
    return parsed as RiskPacketInput;
  } catch {
    return null;
  }
}

export function shouldAcceptNegotiation(req: RiskPacketInput): boolean {
  return SUPPORTED_CHAINS.includes(req.chain);
}

type HandlerKey = 'lp_risk' | 'lp_range' | 'gas_check';

export const SCHEMA_FOR_SERVICE: Record<HandlerKey, string> = {
  lp_risk: 'sasha.risk_packet.v1',
  lp_range: 'sasha.lp_range_signal.v1',
  gas_check: 'sasha.gas_check.v1',
};

export function getHandlerForService(serviceId: string): HandlerKey | null {
  if (serviceId === process.env.CROO_SERVICE_ID_LP_RISK) return 'lp_risk';
  if (serviceId === process.env.CROO_SERVICE_ID_LP_RANGE) return 'lp_range';
  if (serviceId === process.env.CROO_SERVICE_ID_GAS_CHECK) return 'gas_check';
  return null;
}

function loadDashboard(): DashboardData {
  if (!existsSync(DASHBOARD_PATH)) {
    throw new Error(`dashboard.json not found at ${DASHBOARD_PATH}`);
  }
  return JSON.parse(readFileSync(DASHBOARD_PATH, 'utf8')) as DashboardData;
}

export async function runProvider(): Promise<void> {
  const client = createClient();

  // Open a persistent WebSocket connection — EventStream handles reconnects internally
  const stream = await client.connectWebSocket();

  // Listen for incoming negotiations from requesters
  stream.on(EventType.NegotiationCreated, async (event) => {
    const negotiationId = event.negotiation_id;
    if (!negotiationId) {
      console.warn('[provider] NegotiationCreated missing negotiation_id — skipping');
      return;
    }

    console.log(`[provider] negotiation received: ${negotiationId}`);

    // Fetch full negotiation to read requirements
    let negotiation;
    try {
      negotiation = await client.getNegotiation(negotiationId);
    } catch (err) {
      console.error(`[provider] failed to fetch negotiation ${negotiationId}:`, err);
      return;
    }

    // Check we support this service before accepting
    const handlerKey = getHandlerForService((negotiation as any).serviceId ?? '');
    if (!handlerKey) {
      console.log(`[provider] rejecting negotiation ${negotiationId} — unknown serviceId`);
      try { await client.rejectNegotiation(negotiationId, 'service not supported'); } catch {}
      return;
    }

    // For LP risk: also validate requirements (chain must be 'base')
    if (handlerKey === 'lp_risk') {
      const req = parseRequirements(negotiation.requirements ?? '');
      if (!req || !shouldAcceptNegotiation(req)) {
        const reason = !req
          ? 'requirements parse error or missing chain field'
          : `unsupported chain: ${req.chain}`;
        console.log(`[provider] rejecting negotiation ${negotiationId} — ${reason}`);
        try {
          await client.rejectNegotiation(negotiationId, reason);
        } catch (err) {
          console.error(`[provider] rejectNegotiation failed:`, err);
        }
        return;
      }
    }

    console.log(`[provider] accepting negotiation ${negotiationId} (handler=${handlerKey})`);
    try {
      await client.acceptNegotiation(negotiationId);
    } catch (err) {
      console.error(`[provider] acceptNegotiation failed:`, err);
    }
  });

  // Listen for paid orders — this is when we deliver the service response
  stream.on(EventType.OrderPaid, async (event) => {
    const orderId = event.order_id;
    if (!orderId) {
      console.warn('[provider] OrderPaid missing order_id — skipping');
      return;
    }

    console.log(`[provider] order paid: ${orderId} — routing to handler`);

    // Fetch order to get requirements via the negotiation
    let order;
    try {
      order = await client.getOrder(orderId);
    } catch (err) {
      console.error(`[provider] failed to fetch order ${orderId}:`, err);
      return;
    }

    let negotiation;
    try {
      negotiation = await client.getNegotiation(order.negotiationId);
    } catch (err) {
      console.error(`[provider] failed to fetch negotiation for order ${orderId}:`, err);
      return;
    }

    const ordHandlerKey = getHandlerForService((order as any).serviceId ?? '');
    if (!ordHandlerKey) {
      console.warn(`[provider] unknown serviceId on paid order ${orderId}`);
      try { await client.rejectOrder(orderId, 'service not supported'); } catch {}
      return;
    }

    let deliverableText: string;
    let verdict: string | undefined;
    let score: number | undefined;

    if (ordHandlerKey === 'lp_risk') {
      let dashboard: DashboardData;
      try {
        dashboard = loadDashboard();
      } catch (err) {
        console.error(`[provider] dashboard load failed — rejecting order ${orderId}:`, err);
        try { await client.rejectOrder(orderId, 'dashboard unavailable'); } catch {}
        return;
      }
      const req = parseRequirements(negotiation.requirements ?? '') ?? { chain: 'base' };
      const freeCtx = await fetchFreeContext().catch(() => ({ gas_context: null, fear_greed_context: null }));
      const packet = buildRiskPacket(dashboard, req, [], freeCtx);
      deliverableText = JSON.stringify(packet);
      verdict = packet.verdict;
      score = packet.score;
    } else if (ordHandlerKey === 'lp_range') {
      let dashboard: DashboardData;
      try {
        dashboard = loadDashboard();
      } catch (err) {
        console.error(`[provider] dashboard load failed — rejecting order ${orderId}:`, err);
        try { await client.rejectOrder(orderId, 'dashboard unavailable'); } catch {}
        return;
      }
      deliverableText = handleLpRangeSignal(dashboard);
    } else {
      deliverableText = await handleGasCheck();
    }

    const schema = SCHEMA_FOR_SERVICE[ordHandlerKey];

    let result;
    try {
      result = await client.deliverOrder(orderId, {
        deliverableType: DeliverableType.Schema,
        deliverableSchema: schema,
        deliverableText,
      });
    } catch (err) {
      console.error(`[provider] deliverOrder failed for ${orderId}:`, err);
      return;
    }

    console.log(`[provider] delivered order ${orderId} — handler=${ordHandlerKey}${verdict ? ` verdict=${verdict}` : ''}`);

    const logEntry: OrderLogEntry = {
      orderId,
      type: 'provider',
      serviceId: (order as any).serviceId,
      counterpartyAgent: order.requesterAgentId,
      requirementsSummary: `handler=${ordHandlerKey}`,
      verdict,
      score,
      completedAt: new Date().toISOString(),
      settlementTxHash: result.txHash,
    };

    try {
      appendOrder(logEntry);
    } catch (err) {
      console.error(`[provider] appendOrder failed:`, err);
    }
  });

  console.log('[provider] connected — listening for negotiations');

  // Keep the process alive; EventStream reconnects internally on disconnect
  await new Promise<never>(() => {});
}
