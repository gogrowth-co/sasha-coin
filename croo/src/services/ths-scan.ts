import crypto from 'crypto';

export interface ThsScanRequirements {
  token_address: string;
  chain_id: string;
}

export interface ThsScorePacket {
  schema: 'sasha.ths_scan.v1';
  token_address: string;
  chain_id: string;
  token_name: string;
  token_symbol: string;
  overall_score: number;
  scores: {
    security: number;
    liquidity: number;
    tokenomics: number;
    community: number;
    development: number;
  };
  processing_time_ms: number;
  as_of: string;
  delivery_hash: string;
}

export function parseThsRequirements(raw: string): ThsScanRequirements | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ThsScanRequirements>;
    if (!parsed.token_address || !parsed.chain_id) return null;
    if (!/^0x[0-9a-fA-F]{40}$/.test(parsed.token_address)) return null;
    return parsed as ThsScanRequirements;
  } catch {
    return null;
  }
}

export async function handleThsScan(raw: string): Promise<string> {
  const req = parseThsRequirements(raw);
  if (!req) {
    throw new Error('requirements must include token_address (0x checksum EVM address) and chain_id (e.g. "8453" for Base)');
  }

  const supabaseUrl = process.env.THS_SUPABASE_URL ?? 'https://qaqebpcqespvzbfwawlp.supabase.co';
  const serviceKey = process.env.THS_SERVICE_KEY ?? '';
  if (!serviceKey) throw new Error('THS_SERVICE_KEY not configured');

  const res = await fetch(`${supabaseUrl}/functions/v1/run-token-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({
      token_address: req.token_address,
      chain_id: req.chain_id,
      force_refresh: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`run-token-scan failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    success: boolean;
    token_address: string;
    chain_id: string;
    overall_score: number;
    token_name: string;
    token_symbol: string;
    scores: { security: number; liquidity: number; tokenomics: number; community: number; development: number };
    processing_time_ms: number;
    error?: string;
  };

  if (!data.success) {
    throw new Error(`scan error: ${data.error ?? 'unknown'}`);
  }

  const core = {
    token_address: data.token_address,
    chain_id: data.chain_id,
    token_name: data.token_name,
    token_symbol: data.token_symbol,
    overall_score: data.overall_score,
    scores: data.scores,
    processing_time_ms: data.processing_time_ms,
  };

  const packet: ThsScorePacket = {
    schema: 'sasha.ths_scan.v1',
    ...core,
    as_of: new Date().toISOString(),
    delivery_hash: crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };

  return JSON.stringify(packet);
}
