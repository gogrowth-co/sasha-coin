import crypto from 'crypto';
import type { DashboardData, DashboardPosition, ExternalAgentInput, FreeContext, RiskPacket, RiskPacketInput } from './types.js';

const DASHBOARD_URL = 'https://sasha-dashboards.pages.dev/lp-miner/';

function findPosition(dashboard: DashboardData, input: RiskPacketInput): DashboardPosition | null {
  const opens = dashboard.positions.items.filter(p => p.status === 'open');
  if (!opens.length) return null;
  if (input.pool) {
    return opens.find(p => p.poolAddress.toLowerCase() === input.pool!.toLowerCase()) ?? null;
  }
  if (input.position_nft) {
    return opens.find(p => p.nftTokenId === input.position_nft) ?? null;
  }
  return opens[0] ?? null;
}

function dataAgeMinutes(asOf: string): number {
  return (Date.now() - new Date(asOf).getTime()) / 60000;
}

function confidenceFromAge(ageMin: number): number {
  if (ageMin < 60) return 90;
  if (ageMin < 120) return 75;
  if (ageMin < 240) return 40;
  return 10;
}

function liquidationDistancePct(liquidationPx: number, currentPx: number): number {
  return Math.abs((liquidationPx - currentPx) / currentPx);
}

/**
 * Compute delivery_hash over the core scoring fields.
 * Hash is computed before the hash field itself is set (circular exclusion).
 */
function computeDeliveryHash(
  score: number,
  verdict: string,
  confidence: number,
  risk_factors: RiskPacket['risk_factors'],
  evidence: RiskPacket['evidence'],
): string {
  const payload = JSON.stringify({ score, verdict, confidence, risk_factors, evidence });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Build the external-input context fields from the array of A2A purchases.
 * freeCtx values take priority over externalInputs for gas_context and fear_greed_context.
 */
function externalContext(externalInputs: ExternalAgentInput[], freeCtx: FreeContext) {
  return {
    external_agent_inputs: externalInputs,
    gas_context: freeCtx.gas_context ?? externalInputs.find(e => e.used_for === 'gas_context')?.summary ?? null,
    fear_greed_context: freeCtx.fear_greed_context ?? externalInputs.find(e => e.used_for === 'fear_greed_context')?.summary ?? null,
    hl_vault_context: externalInputs.find(e => e.used_for === 'hl_vault_context')?.summary ?? null,
  };
}

export function buildRiskPacket(
  dashboard: DashboardData,
  input: RiskPacketInput,
  externalInputs: ExternalAgentInput[] = [],
  freeCtx: FreeContext = { gas_context: null, fear_greed_context: null },
): RiskPacket {
  const ageMin = dataAgeMinutes(dashboard.asOf);
  const contentHash = '0x' + crypto
    .createHash('sha256')
    .update(JSON.stringify(dashboard) + JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);

  const position = findPosition(dashboard, input);
  if (!position) {
    const score = 0;
    const verdict: RiskPacket['verdict'] = 'avoid';
    const confidence = 10;
    const reasons = ['no position found matching chain/pool/nft in current dashboard'];
    const risk_factors: RiskPacket['risk_factors'] = {
      range_status: 'unknown',
      range_distance_min_pct: null,
      hedge_active: false,
      liq_distance_pct: null,
      funding_ann_pct: null,
      data_age_minutes: ageMin,
      kill_armed: dashboard.killSwitch.armed,
    };
    const evidence: RiskPacket['evidence'] = {
      dashboard: DASHBOARD_URL,
      position_id: null,
      pool_address: input.pool ?? null,
      onchain_links: [],
      content_hash: contentHash,
    };
    return {
      schema: 'sasha.risk_packet.v1',
      as_of: new Date().toISOString(),
      score,
      verdict,
      confidence,
      reasons,
      risk_factors,
      evidence,
      ttl_seconds: 3600,
      delivery_hash: computeDeliveryHash(score, verdict, confidence, risk_factors, evidence),
      ...externalContext(externalInputs, freeCtx),
    };
  }

  const reasons: string[] = [];
  let score = 0;

  // Kill switch override
  if (dashboard.killSwitch.armed.length > 0) {
    reasons.push(`kill switch armed: ${dashboard.killSwitch.armed.join(', ')}`);
    const verdict: RiskPacket['verdict'] = 'avoid';
    const confidence = 95;
    const risk_factors: RiskPacket['risk_factors'] = {
      range_status: position.range.inRange ? 'in-range' : 'out-of-range',
      range_distance_min_pct: Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct),
      hedge_active: position.hedge?.active ?? false,
      liq_distance_pct: position.hedge ? liquidationDistancePct(position.hedge.liquidationPx, position.range.currentPrice) : null,
      funding_ann_pct: position.hedge?.fundingAnnPct ?? null,
      data_age_minutes: ageMin,
      kill_armed: dashboard.killSwitch.armed,
    };
    const evidence: RiskPacket['evidence'] = {
      dashboard: DASHBOARD_URL,
      position_id: position.id,
      pool_address: position.poolAddress,
      onchain_links: [`https://basescan.org/token/0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1?a=${position.nftTokenId}`],
      content_hash: contentHash,
    };
    return {
      schema: 'sasha.risk_packet.v1',
      as_of: new Date().toISOString(),
      score: 5,
      verdict,
      confidence,
      reasons,
      risk_factors,
      evidence,
      ttl_seconds: 3600,
      delivery_hash: computeDeliveryHash(5, verdict, confidence, risk_factors, evidence),
      ...externalContext(externalInputs, freeCtx),
    };
  }

  // Range score (0–30); OOR penalty applied to total
  if (position.range.inRange) {
    score += 20;
    reasons.push('in range');
    const minDist = Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct);
    score += Math.min(10, minDist);
    if (minDist < 3) reasons.push(`near range edge (${minDist.toFixed(1)}% to boundary)`);
  } else {
    score -= 10; // out-of-range penalty
    reasons.push('out of range');
  }

  // Hedge score (0–40)
  const hedge = position.hedge;
  let liqDistPct: number | null = null;
  if (hedge?.active && hedge.deltaNeutral) {
    liqDistPct = liquidationDistancePct(hedge.liquidationPx, position.range.currentPrice);

    // Critical: liquidation < 5% → force avoid
    if (liqDistPct < 0.05) {
      reasons.push(`liquidation imminent: ${(liqDistPct * 100).toFixed(1)}% away`);
      const verdict: RiskPacket['verdict'] = 'avoid';
      const confidence = 95;
      const risk_factors: RiskPacket['risk_factors'] = {
        range_status: position.range.inRange ? 'in-range' : 'out-of-range',
        range_distance_min_pct: Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct),
        hedge_active: true,
        liq_distance_pct: liqDistPct,
        funding_ann_pct: hedge.fundingAnnPct,
        data_age_minutes: ageMin,
        kill_armed: [],
      };
      const evidence: RiskPacket['evidence'] = {
        dashboard: DASHBOARD_URL,
        position_id: position.id,
        pool_address: position.poolAddress,
        onchain_links: [],
        content_hash: contentHash,
      };
      return {
        schema: 'sasha.risk_packet.v1',
        as_of: new Date().toISOString(),
        score: 5,
        verdict,
        confidence,
        reasons,
        risk_factors,
        evidence,
        ttl_seconds: 3600,
        delivery_hash: computeDeliveryHash(5, verdict, confidence, risk_factors, evidence),
        ...externalContext(externalInputs, freeCtx),
      };
    }

    if (liqDistPct > 0.15) { score += 25; reasons.push('hedge: liquidation >15% away'); }
    else if (liqDistPct > 0.10) { score += 15; reasons.push('hedge: liquidation 10-15% away'); }
    else if (liqDistPct > 0.05) { score += 8; reasons.push('hedge: liquidation 5-10% away (caution)'); }

    if (hedge.fundingAnnPct > -10) { score += 10; reasons.push('funding healthy'); }
    else if (hedge.fundingAnnPct > -30) { score += 5; reasons.push('funding elevated'); }
    else { reasons.push('funding rate high — monitor'); }

    if (hedge.deltaNeutral) score += 5;
  } else {
    reasons.push('no active hedge');
  }

  // Data freshness (0–10)
  if (ageMin < 60) { score += 10; }
  else if (ageMin < 120) { score += 7; }
  else if (ageMin < 240) { score += 3; reasons.push(`data ${Math.round(ageMin)}min old`); }
  else { reasons.push(`data stale: ${Math.round(ageMin)}min old`); }

  const confidence = confidenceFromAge(ageMin);

  const verdict: RiskPacket['verdict'] =
    score >= 65 ? 'open'
    : score >= 45 ? 'hold'
    : score >= 25 ? 'reduce'
    : 'avoid';

  const finalScore = Math.min(100, score);

  const risk_factors: RiskPacket['risk_factors'] = {
    range_status: position.range.inRange ? 'in-range' : 'out-of-range',
    range_distance_min_pct: Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct),
    hedge_active: hedge?.active ?? false,
    liq_distance_pct: liqDistPct,
    funding_ann_pct: hedge?.fundingAnnPct ?? null,
    data_age_minutes: ageMin,
    kill_armed: [],
  };
  const evidence: RiskPacket['evidence'] = {
    dashboard: DASHBOARD_URL,
    position_id: position.id,
    pool_address: position.poolAddress,
    onchain_links: [
      `https://basescan.org/token/0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1?a=${position.nftTokenId}`,
    ],
    content_hash: contentHash,
  };

  return {
    schema: 'sasha.risk_packet.v1',
    as_of: new Date().toISOString(),
    score: finalScore,
    verdict,
    confidence,
    reasons,
    risk_factors,
    evidence,
    ttl_seconds: 3600,
    delivery_hash: computeDeliveryHash(finalScore, verdict, confidence, risk_factors, evidence),
    ...externalContext(externalInputs, freeCtx),
  };
}
