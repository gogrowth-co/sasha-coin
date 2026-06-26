import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appendOrder, readOrders } from '../src/logger.js';
import { rmSync, existsSync } from 'fs';

const TEST_LOG = '/tmp/croo-test-orders.json';

describe('logger', () => {
  beforeEach(() => { if (existsSync(TEST_LOG)) rmSync(TEST_LOG); });
  afterEach(() => { if (existsSync(TEST_LOG)) rmSync(TEST_LOG); });

  it('creates file and appends first entry', () => {
    appendOrder({
      orderId: 'ord-001',
      type: 'provider',
      serviceId: 'svc-lp-risk',
      requirementsSummary: 'chain=base pool=0xb2cc',
      verdict: 'hold',
      score: 62,
      completedAt: new Date().toISOString(),
    }, TEST_LOG);
    const orders = readOrders(TEST_LOG);
    expect(orders).toHaveLength(1);
    expect(orders[0].orderId).toBe('ord-001');
  });

  it('appends a second entry without overwriting', () => {
    appendOrder({ orderId: 'ord-001', type: 'provider', requirementsSummary: 'x', completedAt: new Date().toISOString() }, TEST_LOG);
    appendOrder({ orderId: 'ord-002', type: 'requester', requirementsSummary: 'y', completedAt: new Date().toISOString() }, TEST_LOG);
    const orders = readOrders(TEST_LOG);
    expect(orders).toHaveLength(2);
    expect(orders.map(o => o.orderId)).toEqual(['ord-001', 'ord-002']);
  });

  it('readOrders returns empty array when file does not exist', () => {
    const orders = readOrders('/tmp/nonexistent-croo.json');
    expect(orders).toEqual([]);
  });
});
