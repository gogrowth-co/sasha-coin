import { describe, it, expect } from 'vitest';
import { handleLpRangeSignal } from '../src/services/lp-range-signal.js';
import type { DashboardData } from '../src/types.js';

function makeDashboard(overrides: {
  inRange?: boolean;
  distanceLower?: number;
  distanceUpper?: number;
  currentPrice?: number;
  openCount?: number;
} = {}): DashboardData {
  const o = {
    inRange: true,
    distanceLower: 15.0,
    distanceUpper: 12.3,
    currentPrice: 1800,
    openCount: 1,
    ...overrides,
  };
  return {
    asOf: new Date().toISOString(),
    book: { deployedBasisUsd: 20, lpValueUsd: 19, navUsd: 19 },
    overall: { deltaNeutral: true, killArmed: 0, status: 'ok' },
    killSwitch: { armed: [] },
    positions: {
      openCount: o.openCount,
      items: o.openCount === 0 ? [] : [{
        id: 'pos-1',
        symbol: 'WETH/USDC',
        chain: 'base',
        poolAddress: '0xb2cc',
        nftTokenId: '71722642',
        status: 'open',
        deployedBasisUsd: 20,
        funded: true,
        lpValueUsd: 19,
        swapFeesUsd: 0.1,
        range: {
          lowerPrice: 1591,
          upperPrice: 1943,
          currentPrice: o.currentPrice,
          inRange: o.inRange,
          pctOfRange: 50,
          distanceToLowerPct: o.distanceLower,
          distanceToUpperPct: o.distanceUpper,
        },
        hedge: null,
        pnl: { netResultUsd: -1, returnPct: -5 },
      }],
    },
  };
}

describe('handleLpRangeSignal', () => {
  it('returns in_range verdict when in range and distances > 10%', () => {
    const result = JSON.parse(handleLpRangeSignal(makeDashboard({})));
    expect(result.schema).toBe('sasha.lp_range_signal.v1');
    expect(result.in_range).toBe(true);
    expect(result.verdict).toBe('in_range');
    expect(result.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns near_lower when distance to lower < 10%', () => {
    const result = JSON.parse(handleLpRangeSignal(makeDashboard({ distanceLower: 4.5 })));
    expect(result.verdict).toBe('near_lower');
  });

  it('returns near_upper when distance to upper < 10%', () => {
    const result = JSON.parse(handleLpRangeSignal(makeDashboard({ distanceUpper: 3.2 })));
    expect(result.verdict).toBe('near_upper');
  });

  it('returns out_of_range when position is not in range', () => {
    const result = JSON.parse(handleLpRangeSignal(makeDashboard({ inRange: false, distanceLower: 0, distanceUpper: 18 })));
    expect(result.verdict).toBe('out_of_range');
    expect(result.in_range).toBe(false);
  });

  it('returns out_of_range with null position_id when no open positions', () => {
    const result = JSON.parse(handleLpRangeSignal(makeDashboard({ openCount: 0 })));
    expect(result.position_id).toBeNull();
    expect(result.verdict).toBe('out_of_range');
  });
});
