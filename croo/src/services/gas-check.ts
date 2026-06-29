import crypto from 'crypto';
import type { GasCheck } from '../types.js';

const LP_REBALANCE_GAS = 500_000;

async function fetchGasAndPrice(): Promise<{ gwei: number; ethUsd: number | null }> {
  const rpc = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';

  try {
    const [gasRes, priceRes] = await Promise.all([
      fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'),
    ]);

    const gasJson = await gasRes.json() as { result?: string };
    const priceJson = await priceRes.json() as { ethereum?: { usd?: number } };

    const gwei = gasJson.result ? parseInt(gasJson.result, 16) / 1e9 : 0;
    const ethUsd = priceJson.ethereum?.usd ?? null;

    return { gwei, ethUsd };
  } catch {
    return { gwei: 0, ethUsd: null };
  }
}

function gasVerdict(gwei: number): GasCheck['verdict'] {
  if (gwei === 0) return 'moderate';
  if (gwei < 0.05) return 'cheap';
  if (gwei < 0.5) return 'moderate';
  return 'expensive';
}

export async function handleGasCheck(): Promise<string> {
  const { gwei, ethUsd } = await fetchGasAndPrice();

  const costUsd =
    gwei > 0 && ethUsd !== null
      ? parseFloat((gwei * LP_REBALANCE_GAS * 1e-9 * ethUsd).toFixed(4))
      : null;

  const core = {
    gas_price_gwei: parseFloat(gwei.toFixed(6)),
    eth_price_usd: ethUsd,
    lp_rebalance_cost_usd: costUsd,
    verdict: gasVerdict(gwei),
    as_of: new Date().toISOString(),
  };

  const signal: GasCheck = {
    schema: 'sasha.gas_check.v1',
    ...core,
    delivery_hash: crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };

  return JSON.stringify(signal);
}
