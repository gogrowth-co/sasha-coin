import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGasCheck } from '../src/services/gas-check.js';

describe('handleGasCheck', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BASE_RPC_URL;
  });

  it('returns cheap verdict for low gas (<0.05 gwei)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x2540BE4' }) } as Response) // ~0.039 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response);
    const result = JSON.parse(await handleGasCheck());
    expect(result.schema).toBe('sasha.gas_check.v1');
    expect(result.verdict).toBe('cheap');
    expect(result.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.lp_rebalance_cost_usd).toBeTypeOf('number');
  });

  it('returns moderate for gas 0.05–0.5 gwei', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x5F5E100' }) } as Response) // 0.1 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response);
    const result = JSON.parse(await handleGasCheck());
    expect(result.verdict).toBe('moderate');
  });

  it('returns expensive for gas > 0.5 gwei', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x77359400' }) } as Response) // 2 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response);
    const result = JSON.parse(await handleGasCheck());
    expect(result.verdict).toBe('expensive');
  });

  it('returns zero gas and moderate verdict when RPC fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'));
    const result = JSON.parse(await handleGasCheck());
    expect(result.gas_price_gwei).toBe(0);
    expect(result.lp_rebalance_cost_usd).toBeNull();
    expect(result.verdict).toBe('moderate');
  });
});
