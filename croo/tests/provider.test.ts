import { describe, it, expect, vi } from 'vitest';

// Mock dependencies before importing provider
vi.mock('../src/croo-client.js', () => ({ createClient: vi.fn() }));
vi.mock('../src/risk-packet.js', () => ({
  buildRiskPacket: vi.fn().mockReturnValue({
    schema: 'sasha.risk_packet.v1',
    verdict: 'hold',
    score: 62,
    confidence: 90,
    reasons: ['in range'],
    risk_factors: {},
    evidence: { content_hash: '0xabc' },
    ttl_seconds: 3600,
    as_of: new Date().toISOString(),
  }),
}));
vi.mock('../src/logger.js', () => ({ appendOrder: vi.fn() }));

import { parseRequirements, shouldAcceptNegotiation } from '../src/provider.js';

describe('parseRequirements', () => {
  it('parses valid JSON requirements string', () => {
    const req = parseRequirements('{"chain":"base","pool":"0xb2cc"}');
    expect(req?.chain).toBe('base');
    expect(req?.pool).toBe('0xb2cc');
  });

  it('returns null for invalid JSON', () => {
    expect(parseRequirements('not-json')).toBeNull();
  });

  it('returns null when chain is missing', () => {
    expect(parseRequirements('{"pool":"0xb2cc"}')).toBeNull();
  });
});

describe('shouldAcceptNegotiation', () => {
  it('accepts when requirements are valid (chain=base)', () => {
    expect(shouldAcceptNegotiation({ chain: 'base', pool: '0xb2cc' })).toBe(true);
  });

  it('rejects when chain is unsupported', () => {
    expect(shouldAcceptNegotiation({ chain: 'ethereum', pool: '0xb2cc' })).toBe(false);
  });
});
