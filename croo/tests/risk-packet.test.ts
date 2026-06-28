import { describe, it, expect } from 'vitest';
import { buildRiskPacket } from '../src/risk-packet.js';
import type { DashboardData, ExternalAgentInput, RiskPacketInput } from '../src/types.js';

const NOW = new Date().toISOString();

const basePosition = {
  id: 'aerodrome-weth-usdc-ts100-001',
  symbol: 'WETH/USDC',
  chain: 'base',
  poolAddress: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59',
  nftTokenId: '71722642',
  status: 'open' as const,
  deployedBasisUsd: 40.28,
  funded: true,
  lpValueUsd: 38.01,
  swapFeesUsd: 0.54,
  range: {
    lowerPrice: 1590.87,
    upperPrice: 1943.07,
    currentPrice: 1625.26,
    inRange: true,
    pctOfRange: 9.8,
    distanceToLowerPct: 2.2,
    distanceToUpperPct: 19.6,
  },
  hedge: {
    configured: true,
    active: true,
    deltaNeutral: true,
    staticHedge: true,
    liquidationPx: 2083,
    markPx: 1627.3,
    fundingAnnPct: -0.6,
    marginUsedUsd: 5.27,
  },
  pnl: { netResultUsd: -0.21, returnPct: -0.46 },
};

const baseDashboard: DashboardData = {
  asOf: NOW,
  book: { deployedBasisUsd: 40.28, lpValueUsd: 38.01, navUsd: 63.17 },
  overall: { deltaNeutral: true, killArmed: 0, status: 'delta-neutral · carry accruing' },
  positions: { openCount: 1, items: [basePosition] },
  killSwitch: { armed: [] },
};

const input: RiskPacketInput = {
  chain: 'base',
  pool: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59',
};

describe('buildRiskPacket', () => {
  it('returns correct schema and ttl on healthy position', () => {
    const p = buildRiskPacket(baseDashboard, input, []);
    expect(p.schema).toBe('sasha.risk_packet.v1');
    expect(p.ttl_seconds).toBe(3600);
    expect(p.score).toBeGreaterThan(40);
    expect(['open', 'hold', 'reduce', 'avoid']).toContain(p.verdict);
    expect(p.confidence).toBeGreaterThan(0);
    expect(p.evidence.dashboard).toBe('https://sasha-dashboards.pages.dev/lp-miner/');
  });

  it('returns hold or open when in-range, healthy hedge, fresh data', () => {
    const p = buildRiskPacket(baseDashboard, input, []);
    expect(['open', 'hold']).toContain(p.verdict);
  });

  it('returns reduce or avoid when out of range', () => {
    const oor: DashboardData = {
      ...baseDashboard,
      positions: {
        openCount: 1,
        items: [{
          ...basePosition,
          range: { ...basePosition.range, inRange: false, distanceToLowerPct: 0, distanceToUpperPct: 0 },
        }],
      },
    };
    const p = buildRiskPacket(oor, input, []);
    expect(['reduce', 'avoid']).toContain(p.verdict);
    expect(p.score).toBeLessThan(50);
  });

  it('forces avoid when liquidation < 5% away', () => {
    const nearLiq: DashboardData = {
      ...baseDashboard,
      positions: {
        openCount: 1,
        items: [{
          ...basePosition,
          hedge: { ...basePosition.hedge!, liquidationPx: 1625.26 * 1.03, markPx: 1625.26 },
        }],
      },
    };
    const p = buildRiskPacket(nearLiq, input, []);
    expect(p.verdict).toBe('avoid');
  });

  it('forces avoid when kill switch is armed', () => {
    const armed: DashboardData = {
      ...baseDashboard,
      killSwitch: { armed: ['OOR_TIMEOUT'] },
    };
    const p = buildRiskPacket(armed, input, []);
    expect(p.verdict).toBe('avoid');
    expect(p.risk_factors.kill_armed).toEqual(['OOR_TIMEOUT']);
  });

  it('drops confidence below 50 when data is older than 2 hours', () => {
    const stale: DashboardData = {
      ...baseDashboard,
      asOf: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };
    const p = buildRiskPacket(stale, input, []);
    expect(p.confidence).toBeLessThan(50);
  });

  it('matches position by pool address', () => {
    const p = buildRiskPacket(baseDashboard, { chain: 'base', pool: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59' }, []);
    expect(p.evidence.pool_address).toBe('0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59');
  });

  it('returns avoid with low confidence when no matching position found', () => {
    const p = buildRiskPacket(baseDashboard, { chain: 'base', pool: '0xdeadbeef' }, []);
    expect(p.verdict).toBe('avoid');
    expect(p.confidence).toBeLessThan(20);
    expect(p.reasons.some(r => r.toLowerCase().includes('no position'))).toBe(true);
  });

  it('includes external_agent_inputs and sets gas_context when provided', () => {
    const gasInput: ExternalAgentInput = {
      agent: 'Gas Tracker',
      serviceId: 'svc-gas-001',
      orderId: 'ord-gas-001',
      used_for: 'gas_context',
      summary: 'ETH gas: 15 gwei base fee, medium congestion',
    };
    const p = buildRiskPacket(baseDashboard, input, [gasInput]);
    expect(p.external_agent_inputs.length).toBe(1);
    expect(p.gas_context).toBe('ETH gas: 15 gwei base fee, medium congestion');
    expect(p.fear_greed_context).toBeNull();
    expect(p.hl_vault_context).toBeNull();
  });

  it('delivery_hash is a 64-char hex string on healthy position', () => {
    const p = buildRiskPacket(baseDashboard, input, []);
    expect(p.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('delivery_hash is a 64-char hex string on no-position packet', () => {
    const p = buildRiskPacket(baseDashboard, { chain: 'base', pool: '0xdeadbeef' }, []);
    expect(p.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('delivery_hash is a 64-char hex string on kill-switch packet', () => {
    const armed: DashboardData = {
      ...baseDashboard,
      killSwitch: { armed: ['OOR_TIMEOUT'] },
    };
    const p = buildRiskPacket(armed, input, []);
    expect(p.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('delivery_hash is a 64-char hex string on liq-imminent packet', () => {
    const nearLiq: DashboardData = {
      ...baseDashboard,
      positions: {
        openCount: 1,
        items: [{
          ...basePosition,
          hedge: { ...basePosition.hedge!, liquidationPx: 1625.26 * 1.03, markPx: 1625.26 },
        }],
      },
    };
    const p = buildRiskPacket(nearLiq, input, []);
    expect(p.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
