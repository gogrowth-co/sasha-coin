import crypto from 'crypto';
import { parseThsRequirements } from './ths-scan.js';

export interface ThsLookupResult {
  schema: 'sasha.ths_lookup.v1';
  cached: boolean;
  token_address: string;
  chain_id: string;
  token_name?: string;
  token_symbol?: string;
  overall_score?: number;
  scanned_at?: string;
  note?: string;
  as_of: string;
  delivery_hash: string;
}

export async function handleThsLookup(raw: string): Promise<string> {
  const req = parseThsRequirements(raw);
  if (!req) {
    throw new Error('requirements must include token_address (0x EVM address) and chain_id (e.g. "8453")');
  }

  const supabaseUrl = process.env.THS_SUPABASE_URL ?? 'https://qaqebpcqespvzbfwawlp.supabase.co';
  const serviceKey = process.env.THS_SERVICE_KEY ?? '';
  if (!serviceKey) throw new Error('THS_SERVICE_KEY not configured');

  const headers = {
    'Authorization': `Bearer ${serviceKey}`,
    'apikey': serviceKey,
    'Accept': 'application/json',
  };

  // token_scans stores chain_id as hex and address in lowercase
  const chainIdHex = req.chain_id.startsWith('0x')
    ? req.chain_id
    : `0x${parseInt(req.chain_id, 10).toString(16)}`;
  const addrLower = req.token_address.toLowerCase();

  const now = new Date().toISOString();

  // Parallel: fetch cached scan score + token metadata
  const [scanRes, metaRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/token_scans`
        + `?token_address=eq.${encodeURIComponent(addrLower)}`
        + `&chain_id=eq.${encodeURIComponent(chainIdHex)}`
        + `&order=scanned_at.desc&limit=1`,
      { headers, signal: AbortSignal.timeout(8_000) },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/token_data_cache`
        + `?token_address=eq.${encodeURIComponent(addrLower)}`
        + `&chain_id=eq.${encodeURIComponent(chainIdHex)}`
        + `&limit=1`,
      { headers, signal: AbortSignal.timeout(8_000) },
    ),
  ]);

  let core: Omit<ThsLookupResult, 'schema' | 'as_of' | 'delivery_hash'>;

  if (!scanRes.ok) {
    core = {
      cached: false,
      token_address: req.token_address,
      chain_id: req.chain_id,
      note: `Cache query failed (${scanRes.status}). Use Token Health Score service for fresh scan.`,
    };
  } else {
    const scanRows = await scanRes.json() as Array<{ score_total: number; scanned_at: string }>;
    const scan = scanRows[0];

    if (!scan) {
      core = {
        cached: false,
        token_address: req.token_address,
        chain_id: req.chain_id,
        note: 'No cached scan found. Use Token Health Score service ($0.50) for a fresh scan.',
      };
    } else {
      const metaRows = metaRes.ok ? (await metaRes.json() as Array<{ name?: string; symbol?: string }>) : [];
      const meta = metaRows[0];
      core = {
        cached: true,
        token_address: req.token_address,
        chain_id: req.chain_id,
        token_name: meta?.name,
        token_symbol: meta?.symbol,
        overall_score: scan.score_total,
        scanned_at: scan.scanned_at,
      };
    }
  }

  const result: ThsLookupResult = {
    schema: 'sasha.ths_lookup.v1',
    ...core,
    as_of: now,
    delivery_hash: crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };

  return JSON.stringify(result);
}
