import type { FreeContext } from './types.js';

async function fetchGasGwei(): Promise<{ gwei: number; ethUsd: number | null } | null> {
  const rpc = process.env.BASE_RPC_URL;
  if (!rpc) return null;

  try {
    const [gasRes, priceRes] = await Promise.all([
      fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'),
    ]);

    if (!gasRes.ok || !priceRes.ok) return null;

    const gasJson = await gasRes.json() as { result?: string };
    const priceJson = await priceRes.json() as { ethereum?: { usd?: number } };

    const weiHex = gasJson.result;
    if (!weiHex) return null;

    const gwei = parseInt(weiHex, 16) / 1e9;
    const ethUsd = priceJson.ethereum?.usd ?? null;

    return { gwei, ethUsd };
  } catch {
    return null;
  }
}

async function fetchFearGreed(): Promise<string | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return null;
    const json = await res.json() as { data?: Array<{ value?: string; value_classification?: string }> };
    const entry = json.data?.[0];
    if (!entry) return null;
    return `${entry.value_classification} ${entry.value}/100`;
  } catch {
    return null;
  }
}

export async function fetchFreeContext(): Promise<FreeContext> {
  const [gasSettled, fearGreedSettled] = await Promise.allSettled([fetchGasGwei(), fetchFearGreed()]);

  const gas = gasSettled.status === 'fulfilled' ? gasSettled.value : null;
  const fg = fearGreedSettled.status === 'fulfilled' ? fearGreedSettled.value : null;

  let gasContext: string | null = null;
  if (gas) {
    const gwei = gas.gwei.toFixed(4);
    if (gas.ethUsd) {
      const costUsd = (gas.gwei * 500_000 * 1e-9 * gas.ethUsd).toFixed(4);
      gasContext = `${gwei} gwei — LP rebalance ≈ $${costUsd}`;
    } else {
      gasContext = `${gwei} gwei`;
    }
  }

  return {
    gas_context: gasContext,
    fear_greed_context: fg,
  };
}
