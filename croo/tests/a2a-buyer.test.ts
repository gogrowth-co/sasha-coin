import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NegotiationStatus } from '@croo-network/sdk';

// We import the functions after setting up env — vi.mock runs at hoist time
import { buyExternalInput, buyExternalInputs } from '../src/a2a-buyer.js';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function makeMockClient(overrides: Partial<{
  negotiateOrder: ReturnType<typeof vi.fn>;
  getNegotiation: ReturnType<typeof vi.fn>;
  listOrders: ReturnType<typeof vi.fn>;
  payOrder: ReturnType<typeof vi.fn>;
  getDelivery: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    negotiateOrder: overrides.negotiateOrder ?? vi.fn().mockResolvedValue({ negotiationId: 'neg-001' }),
    getNegotiation: overrides.getNegotiation ?? vi.fn().mockResolvedValue({ status: NegotiationStatus.Accepted }),
    listOrders: overrides.listOrders ?? vi.fn().mockResolvedValue([{ negotiationId: 'neg-001', orderId: 'ord-001' }]),
    payOrder: overrides.payOrder ?? vi.fn().mockResolvedValue({ txHash: '0xdeadbeef' }),
    getDelivery: overrides.getDelivery ?? vi.fn().mockResolvedValue({ deliverableText: 'ETH gas: 15 gwei' }),
    // other methods provider/requester use — not needed for a2a-buyer tests
    connectWebSocket: vi.fn(),
    getOrder: vi.fn(),
    acceptNegotiation: vi.fn(),
    rejectNegotiation: vi.fn(),
    deliverOrder: vi.fn(),
    rejectOrder: vi.fn(),
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('buyExternalInput', () => {
  it('returns null immediately when negotiateOrder rejects', async () => {
    const client = makeMockClient({
      negotiateOrder: vi.fn().mockRejectedValue(new Error('network error')),
    });

    const result = await buyExternalInput(client, {
      agent: 'Gas Tracker',
      serviceId: 'svc-001',
      requirementsText: '{"chain":"ethereum"}',
      used_for: 'gas_context',
    });

    expect(result).toBeNull();
  });

  it('returns null when negotiation never reaches accepted (timeout)', async () => {
    // getNegotiation always returns Pending — never Accepted
    const client = makeMockClient({
      getNegotiation: vi.fn().mockResolvedValue({ status: 'pending' }),
    });

    // Use a very short timeout so the test doesn't hang
    const result = await buyExternalInput(client, {
      agent: 'Gas Tracker',
      serviceId: 'svc-001',
      requirementsText: '{"chain":"ethereum"}',
      used_for: 'gas_context',
    }, 50); // 50ms timeout — way shorter than 2s poll interval

    expect(result).toBeNull();
  }, 5000);

  it('returns ExternalAgentInput on happy path', async () => {
    const client = makeMockClient();

    const result = await buyExternalInput(client, {
      agent: 'Gas Tracker',
      serviceId: 'svc-001',
      requirementsText: '{"chain":"ethereum"}',
      used_for: 'gas_context',
    }, 10_000);

    expect(result).not.toBeNull();
    expect(result?.agent).toBe('Gas Tracker');
    expect(result?.serviceId).toBe('svc-001');
    expect(result?.orderId).toBe('ord-001');
    expect(result?.used_for).toBe('gas_context');
    expect(result?.summary).toBe('ETH gas: 15 gwei');
  }, 10_000);

  it('truncates summary to 200 chars', async () => {
    const longText = 'x'.repeat(300);
    const client = makeMockClient({
      getDelivery: vi.fn().mockResolvedValue({ deliverableText: longText }),
    });

    const result = await buyExternalInput(client, {
      agent: 'Gas Tracker',
      serviceId: 'svc-001',
      requirementsText: '{"chain":"ethereum"}',
      used_for: 'gas_context',
    }, 10_000);

    expect(result?.summary.length).toBe(200);
  }, 10_000);

  it('returns null when negotiation is rejected by provider', async () => {
    const client = makeMockClient({
      getNegotiation: vi.fn().mockResolvedValue({ status: NegotiationStatus.Rejected }),
    });

    const result = await buyExternalInput(client, {
      agent: 'Gas Tracker',
      serviceId: 'svc-001',
      requirementsText: '{"chain":"ethereum"}',
      used_for: 'gas_context',
    }, 10_000);

    expect(result).toBeNull();
  }, 10_000);
});

describe('buyExternalInputs', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    // Clear all relevant env vars
    delete process.env.CROO_SERVICE_ID_GAS_TRACKER;
    delete process.env.CROO_SERVICE_ID_FEAR_GREED;
    delete process.env.CROO_SERVICE_ID_HL_VAULT;
  });

  afterEach(() => {
    // Restore env
    process.env.CROO_SERVICE_ID_GAS_TRACKER = origEnv.CROO_SERVICE_ID_GAS_TRACKER;
    process.env.CROO_SERVICE_ID_FEAR_GREED = origEnv.CROO_SERVICE_ID_FEAR_GREED;
    process.env.CROO_SERVICE_ID_HL_VAULT = origEnv.CROO_SERVICE_ID_HL_VAULT;
  });

  it('returns [] when all env vars are empty', async () => {
    const client = makeMockClient();
    const result = await buyExternalInputs(client);
    expect(result).toEqual([]);
  });

  it('only calls agents with populated env vars', async () => {
    process.env.CROO_SERVICE_ID_GAS_TRACKER = 'svc-gas';
    // Leave FEAR_GREED and HL_VAULT empty

    const client = makeMockClient({
      negotiateOrder: vi.fn().mockResolvedValue({ negotiationId: 'neg-gas' }),
      listOrders: vi.fn().mockResolvedValue([{ negotiationId: 'neg-gas', orderId: 'ord-gas' }]),
      getDelivery: vi.fn().mockResolvedValue({ deliverableText: 'gas summary' }),
    });

    const result = await buyExternalInputs(client);

    expect(result.length).toBe(1);
    expect(result[0].used_for).toBe('gas_context');
    expect(result[0].agent).toBe('Gas Tracker');
  }, 10_000);
});
