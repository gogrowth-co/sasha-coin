import { describe, it, expect } from 'vitest';
import { buildReputationProof } from '../src/reputation-proof.js';

describe('buildReputationProof', () => {
  it('returns correct schema and agent identity', () => {
    const proof = buildReputationProof([], 'full');
    expect(proof.schema).toBe('sasha.reputation_proof.v1');
    expect(proof.agent.name).toBe('Sasha');
    expect(proof.agent.x).toBe('https://x.com/SashaCoin95');
  });

  it('returns verified verdict when 3+ provider orders exist', () => {
    const orders = [
      { orderId: 'o1', type: 'provider' as const, requirementsSummary: 'x', completedAt: new Date().toISOString(), verdict: 'hold', score: 62 },
      { orderId: 'o2', type: 'provider' as const, requirementsSummary: 'y', completedAt: new Date().toISOString(), verdict: 'open', score: 70 },
      { orderId: 'o3', type: 'provider' as const, requirementsSummary: 'z', completedAt: new Date().toISOString(), verdict: 'hold', score: 55 },
    ];
    const proof = buildReputationProof(orders, 'full');
    expect(proof.verdict).toBe('verified');
    expect(proof.checks.find(c => c.id === 'order_history')?.verdict).toBe('pass');
  });

  it('returns partial when no completed provider orders', () => {
    const proof = buildReputationProof([], 'full');
    expect(proof.verdict).toBe('partial');
  });
});
