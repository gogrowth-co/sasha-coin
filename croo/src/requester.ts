import { NegotiationStatus } from '@croo-network/sdk';
import { createClient } from './croo-client.js';
import { appendOrder } from './logger.js';
import type { OrderLogEntry } from './types.js';

export interface RequesterArgs {
  serviceId: string;
  requirements: Record<string, unknown>;
  counterpartyAgent?: string;
}

/**
 * Full requester flow:
 *  1. Create a negotiation (negotiateOrder)
 *  2. Poll until the provider accepts (negotiation status → "accepted")
 *  3. Find the order created by the backend for our negotiation
 *  4. Pay the order (payOrder)
 *  5. Poll for delivery (getDelivery) up to 2 minutes
 *  6. Log the completed order and return deliverableText
 */
export async function placeOrder(args: RequesterArgs): Promise<string> {
  const client = createClient();
  const { serviceId, requirements, counterpartyAgent } = args;

  // Step 1: Create negotiation
  const requirementsText = JSON.stringify(requirements);
  console.log(`[requester] negotiating order for service ${serviceId}`);
  const negotiation = await client.negotiateOrder({
    serviceId,
    requirements: requirementsText,
  });
  const negotiationId = negotiation.negotiationId;
  console.log(`[requester] negotiation created: ${negotiationId}`);

  // Step 2: Poll for negotiation acceptance (up to 2 minutes)
  const acceptDeadline = Date.now() + 120_000;
  let acceptedOrder: string | null = null;

  while (Date.now() < acceptDeadline) {
    await new Promise(r => setTimeout(r, 5000));

    const updated = await client.getNegotiation(negotiationId).catch(() => null);
    if (!updated) continue;

    if (updated.status === NegotiationStatus.Rejected || updated.status === NegotiationStatus.Expired) {
      throw new Error(`Negotiation ${negotiationId} ended with status: ${updated.status}`);
    }

    if (updated.status === NegotiationStatus.Accepted) {
      // Step 3: Find the order the backend created for this negotiation
      const orders = await client.listOrders().catch(() => []);
      const order = orders.find(o => o.negotiationId === negotiationId);
      if (order) {
        acceptedOrder = order.orderId;
        console.log(`[requester] negotiation accepted — order: ${acceptedOrder}`);
        break;
      }
    }
  }

  if (!acceptedOrder) {
    throw new Error(`Negotiation ${negotiationId} timed out waiting for acceptance`);
  }

  const orderId = acceptedOrder;

  // Step 4: Pay the order
  console.log(`[requester] paying order ${orderId}`);
  const payResult = await client.payOrder(orderId);
  console.log(`[requester] payment submitted — tx: ${payResult.txHash}`);

  // Step 5: Poll for delivery (up to 2 minutes, every 5 seconds)
  const deliveryDeadline = Date.now() + 120_000;
  while (Date.now() < deliveryDeadline) {
    await new Promise(r => setTimeout(r, 5000));
    const delivery = await client.getDelivery(orderId).catch(() => null);
    if (delivery && delivery.deliverableText) {
      console.log(`[requester] delivery received for order ${orderId}`);

      // Step 6: Log completed order
      const logEntry: OrderLogEntry = {
        orderId,
        type: 'requester',
        serviceId,
        counterpartyAgent,
        requirementsSummary: requirementsText.slice(0, 120),
        completedAt: new Date().toISOString(),
        settlementTxHash: payResult.txHash,
      };
      try {
        appendOrder(logEntry);
      } catch (err) {
        console.warn('[requester] appendOrder failed (non-fatal):', err);
      }

      return delivery.deliverableText;
    }
  }

  throw new Error(`Order ${orderId} timed out after 2 minutes waiting for delivery`);
}
