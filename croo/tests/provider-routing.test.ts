import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getHandlerForService, SCHEMA_FOR_SERVICE } from '../src/provider.js';

describe('getHandlerForService', () => {
  beforeEach(() => {
    process.env.CROO_SERVICE_ID_LP_RISK = 'svc-lp-risk';
    process.env.CROO_SERVICE_ID_LP_RANGE = 'svc-lp-range';
    process.env.CROO_SERVICE_ID_GAS_CHECK = 'svc-gas-check';
  });
  afterEach(() => {
    delete process.env.CROO_SERVICE_ID_LP_RISK;
    delete process.env.CROO_SERVICE_ID_LP_RANGE;
    delete process.env.CROO_SERVICE_ID_GAS_CHECK;
  });

  it('returns lp_risk for LP risk service ID', () => {
    expect(getHandlerForService('svc-lp-risk')).toBe('lp_risk');
  });

  it('returns lp_range for LP range service ID', () => {
    expect(getHandlerForService('svc-lp-range')).toBe('lp_range');
  });

  it('returns gas_check for gas check service ID', () => {
    expect(getHandlerForService('svc-gas-check')).toBe('gas_check');
  });

  it('returns null for unknown service ID', () => {
    expect(getHandlerForService('svc-unknown')).toBeNull();
  });

  it('SCHEMA_FOR_SERVICE maps all three handlers', () => {
    expect(SCHEMA_FOR_SERVICE.lp_risk).toBe('sasha.risk_packet.v1');
    expect(SCHEMA_FOR_SERVICE.lp_range).toBe('sasha.lp_range_signal.v1');
    expect(SCHEMA_FOR_SERVICE.gas_check).toBe('sasha.gas_check.v1');
  });
});
