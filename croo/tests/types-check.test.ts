import { describe, it, expect } from 'vitest';
import type { FreeContext, LpRangeSignal, GasCheck } from '../src/types.js';

describe('new types compile', () => {
  it('FreeContext has gas_context and fear_greed_context', () => {
    const fc: FreeContext = { gas_context: 'cheap', fear_greed_context: 'Fear 42' };
    expect(fc.gas_context).toBe('cheap');
    expect(fc.fear_greed_context).toBe('Fear 42');
  });

  it('LpRangeSignal has required fields', () => {
    const s: LpRangeSignal = {
      schema: 'sasha.lp_range_signal.v1',
      in_range: true,
      distance_to_lower_pct: 5.2,
      distance_to_upper_pct: 12.1,
      verdict: 'in_range',
      position_id: 'abc',
      current_price: 1800,
      as_of: '2026-01-01T00:00:00Z',
      delivery_hash: 'abc123',
    };
    expect(s.schema).toBe('sasha.lp_range_signal.v1');
  });

  it('GasCheck has required fields', () => {
    const g: GasCheck = {
      schema: 'sasha.gas_check.v1',
      gas_price_gwei: 0.01,
      eth_price_usd: 3500,
      lp_rebalance_cost_usd: 0.18,
      verdict: 'cheap',
      as_of: '2026-01-01T00:00:00Z',
      delivery_hash: 'abc123',
    };
    expect(g.verdict).toBe('cheap');
  });
});
