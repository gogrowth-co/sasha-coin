import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFreeContext } from '../src/free-data.js';

describe('fetchFreeContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BASE_RPC_URL;
  });

  it('returns gas_context and fear_greed_context on success', async () => {
    const mockFetch = vi.mocked(fetch);
    // First call: Base RPC gas price; Second: CoinGecko ETH price; Third: Fear & Greed
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x5F5E100' }) } as Response) // 0.1 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ value: '42', value_classification: 'Fear' }] }) } as Response);

    const ctx = await fetchFreeContext();
    expect(ctx.gas_context).toContain('gwei');
    expect(ctx.fear_greed_context).toContain('Fear');
  });

  it('returns null fields on fetch failure — does not throw', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));
    const ctx = await fetchFreeContext();
    expect(ctx.gas_context).toBeNull();
    expect(ctx.fear_greed_context).toBeNull();
  });

  it('returns null gas_context when BASE_RPC_URL is missing', async () => {
    delete process.env.BASE_RPC_URL;
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ value: '30', value_classification: 'Extreme Fear' }] }) } as Response);
    const ctx = await fetchFreeContext();
    expect(ctx.gas_context).toBeNull();
  });
});
