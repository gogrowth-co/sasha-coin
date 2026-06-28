import { AgentClient, NegotiationStatus } from '@croo-network/sdk';
import type { ExternalAgentInput } from './types.js';

interface BuyConfig {
  agent: string;
  serviceId: string;
  requirementsText: string;
  used_for: string;
}

/**
 * Buy a single external input from a CROO agent.
 * Resilient: any error or timeout returns null so the caller's packet still delivers.
 */
export async function buyExternalInput(
  client: AgentClient,
  config: BuyConfig,
  timeoutMs = 30_000,
): Promise<ExternalAgentInput | null> {
  const deadline = Date.now() + timeoutMs;

  try {
    // Step 1: create negotiation
    const negotiation = await client.negotiateOrder({
      serviceId: config.serviceId,
      requirements: config.requirementsText,
    });
    const negotiationId = negotiation.negotiationId;
    console.log(`[a2a-buyer] negotiation created for ${config.agent}: ${negotiationId}`);

    // Step 2: poll for acceptance
    let orderId: string | null = null;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const updated = await client.getNegotiation(negotiationId).catch(() => null);
      if (!updated) continue;

      if (
        updated.status === NegotiationStatus.Rejected ||
        updated.status === NegotiationStatus.Expired
      ) {
        console.warn(`[a2a-buyer] negotiation ${negotiationId} ended: ${updated.status}`);
        return null;
      }

      if (updated.status === NegotiationStatus.Accepted) {
        const orders = await client.listOrders().catch(() => []);
        const match = orders.find(o => o.negotiationId === negotiationId);
        if (match) {
          orderId = match.orderId;
          console.log(`[a2a-buyer] order found for ${config.agent}: ${orderId}`);
          break;
        }
      }
    }

    if (!orderId) {
      console.warn(`[a2a-buyer] timeout waiting for acceptance from ${config.agent}`);
      return null;
    }

    // Step 3: pay
    await client.payOrder(orderId);
    console.log(`[a2a-buyer] paid order ${orderId} for ${config.agent}`);

    // Step 4: poll for delivery
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const delivery = await client.getDelivery(orderId).catch(() => null);
      if (delivery && delivery.deliverableText) {
        console.log(`[a2a-buyer] delivery received from ${config.agent}`);
        return {
          agent: config.agent,
          serviceId: config.serviceId,
          orderId,
          used_for: config.used_for,
          summary: delivery.deliverableText.slice(0, 200),
        };
      }
    }

    console.warn(`[a2a-buyer] timeout waiting for delivery from ${config.agent}`);
    return null;
  } catch (err) {
    console.error(`[a2a-buyer] failed to buy from ${config.agent}:`, err);
    return null;
  }
}

/**
 * Buy from up to 3 external agents concurrently.
 * Skips any service whose env var is not set.
 * Returns only the successful inputs (failed/missing = omitted from array).
 */
export async function buyExternalInputs(client: AgentClient): Promise<ExternalAgentInput[]> {
  const configs: Array<BuyConfig & { envVar: string }> = [
    {
      envVar: 'CROO_SERVICE_ID_GAS_TRACKER',
      agent: 'Gas Tracker',
      serviceId: process.env.CROO_SERVICE_ID_GAS_TRACKER ?? '',
      requirementsText: '{"chain":"ethereum"}',
      used_for: 'gas_context',
    },
    {
      envVar: 'CROO_SERVICE_ID_FEAR_GREED',
      agent: 'Fear & Greed',
      serviceId: process.env.CROO_SERVICE_ID_FEAR_GREED ?? '',
      requirementsText: '{"asset":"BTC"}',
      used_for: 'fear_greed_context',
    },
    {
      envVar: 'CROO_SERVICE_ID_HL_VAULT',
      agent: 'Hyperliquid Vault',
      serviceId: process.env.CROO_SERVICE_ID_HL_VAULT ?? '',
      requirementsText: '{"summary":true}',
      used_for: 'hl_vault_context',
    },
  ];

  const active = configs.filter(c => c.serviceId.length > 0);

  if (active.length === 0) {
    console.log('[a2a-buyer] no external service IDs configured — skipping A2A buys');
    return [];
  }

  const results = await Promise.all(
    active.map(cfg => buyExternalInput(client, cfg)),
  );

  return results.filter((r): r is ExternalAgentInput => r !== null);
}
