import crypto from 'crypto';
import type { DashboardData, LpRangeSignal } from '../types.js';

const NEAR_BOUNDARY_THRESHOLD_PCT = 10;

export function handleLpRangeSignal(dashboard: DashboardData): string {
  const opens = dashboard.positions.items.filter(p => p.status === 'open');
  const pos = opens[0] ?? null;

  let signal: LpRangeSignal;

  if (!pos) {
    const core = {
      in_range: false,
      distance_to_lower_pct: 0,
      distance_to_upper_pct: 0,
      verdict: 'out_of_range' as const,
      position_id: null,
      current_price: null,
      as_of: dashboard.asOf,
    };
    signal = {
      schema: 'sasha.lp_range_signal.v1',
      ...core,
      delivery_hash: crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex'),
    };
    return JSON.stringify(signal);
  }

  const { range } = pos;
  let verdict: LpRangeSignal['verdict'];

  if (!range.inRange) {
    verdict = 'out_of_range';
  } else if (range.distanceToLowerPct < NEAR_BOUNDARY_THRESHOLD_PCT) {
    verdict = 'near_lower';
  } else if (range.distanceToUpperPct < NEAR_BOUNDARY_THRESHOLD_PCT) {
    verdict = 'near_upper';
  } else {
    verdict = 'in_range';
  }

  const core = {
    in_range: range.inRange,
    distance_to_lower_pct: range.distanceToLowerPct,
    distance_to_upper_pct: range.distanceToUpperPct,
    verdict,
    position_id: pos.nftTokenId,
    current_price: range.currentPrice,
    as_of: dashboard.asOf,
  };

  signal = {
    schema: 'sasha.lp_range_signal.v1',
    ...core,
    delivery_hash: crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };

  return JSON.stringify(signal);
}
