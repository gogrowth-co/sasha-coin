import { AgentClient } from '@croo-network/sdk';

export function createClient(): AgentClient {
  const apiUrl = process.env.CROO_API_URL;
  const wsUrl = process.env.CROO_WS_URL;
  const sdkKey = process.env.CROO_SDK_KEY;
  if (!apiUrl || !wsUrl || !sdkKey) {
    throw new Error('Missing required env vars: CROO_API_URL, CROO_WS_URL, CROO_SDK_KEY');
  }
  return new AgentClient(
    {
      baseURL: apiUrl,
      wsURL: wsUrl,
    },
    sdkKey,
  );
}
