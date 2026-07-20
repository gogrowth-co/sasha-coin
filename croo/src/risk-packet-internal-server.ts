import { createServer } from 'http';
import { loadDashboard } from './provider.js';
import { buildRiskPacket } from './risk-packet.js';
import { fetchFreeContext } from './free-data.js';
import type { RiskPacketInput } from './types.js';

// Localhost-only feed for the sasha-x402-kit Casper resource server: it has already collected
// payment before it calls here, so this endpoint stays unauthenticated but bound to loopback —
// it must never be reachable from outside the host it runs on.
const PORT = Number(process.env.RISK_PACKET_INTERNAL_PORT ?? 8977);
const HOST = '127.0.0.1';

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' || req.url === undefined || !req.url.startsWith('/risk-packet')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  try {
    const dashboard = loadDashboard();
    const input: RiskPacketInput = { chain: 'base' };
    const freeCtx = await fetchFreeContext().catch(() => ({ gas_context: null, fear_greed_context: null }));
    const packet = buildRiskPacket(dashboard, input, [], freeCtx);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(packet));
  } catch (err) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'dashboard unavailable' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[risk-packet-internal-server] listening on http://${HOST}:${PORT}/risk-packet`);
});
