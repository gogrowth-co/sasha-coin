// croo/src/types.ts

export interface ExternalAgentInput {
  agent: string;       // human name e.g. "Gas Tracker"
  serviceId: string;
  orderId: string;
  used_for: string;   // e.g. "gas_context"
  summary: string;    // first 200 chars of delivery text
}

export interface DashboardPosition {
  id: string;
  symbol: string;
  chain: string;
  poolAddress: string;
  nftTokenId: string;
  status: 'open' | 'closed';
  deployedBasisUsd: number;
  funded: boolean;
  lpValueUsd: number;
  swapFeesUsd: number;
  range: {
    lowerPrice: number;
    upperPrice: number;
    currentPrice: number;
    inRange: boolean;
    pctOfRange: number;
    distanceToLowerPct: number;
    distanceToUpperPct: number;
  };
  hedge: {
    configured: boolean;
    active: boolean;
    deltaNeutral: boolean;
    staticHedge: boolean;
    liquidationPx: number;
    markPx: number;
    fundingAnnPct: number;
    marginUsedUsd: number;
  } | null;
  pnl: {
    netResultUsd: number;
    returnPct: number;
  };
}

export interface DashboardData {
  asOf: string;
  book: {
    deployedBasisUsd: number;
    lpValueUsd: number;
    navUsd: number;
  };
  overall: {
    deltaNeutral: boolean;
    killArmed: number;
    status: string;
  };
  positions: {
    openCount: number;
    items: DashboardPosition[];
  };
  killSwitch: {
    armed: string[];
  };
}

export interface RiskPacketInput {
  chain: string;
  pool?: string;
  position_nft?: string;
  risk_horizon?: '6h' | '24h' | '7d';
  consumer_agent?: string;
  output_mode?: 'compact' | 'full';
}

export interface RiskPacket {
  schema: 'sasha.risk_packet.v1';
  as_of: string;
  score: number;
  verdict: 'open' | 'hold' | 'reduce' | 'avoid';
  confidence: number;
  reasons: string[];
  risk_factors: {
    range_status: string;
    range_distance_min_pct: number | null;
    hedge_active: boolean;
    liq_distance_pct: number | null;
    funding_ann_pct: number | null;
    data_age_minutes: number;
    kill_armed: string[];
  };
  evidence: {
    dashboard: string;
    position_id: string | null;
    pool_address: string | null;
    onchain_links: string[];
    content_hash: string;
  };
  ttl_seconds: number;
  delivery_hash: string;           // sha256 of core packet fields
  external_agent_inputs: ExternalAgentInput[];
  gas_context: string | null;
  fear_greed_context: string | null;
  hl_vault_context: string | null;
}

export interface ReputationProof {
  schema: 'sasha.reputation_proof.v1';
  as_of: string;
  agent: {
    name: string;
    x: string;
    wallets: string[];
  };
  checks: Array<{
    id: string;
    verdict: 'pass' | 'partial' | 'fail';
    note: string;
  }>;
  verdict: 'verified' | 'partial' | 'unverifiable';
  evidence: string[];
}

export interface OrderLogEntry {
  orderId: string;
  type: 'provider' | 'requester';
  serviceId?: string;
  counterpartyAgent?: string;
  requirementsSummary: string;
  verdict?: string;
  score?: number;
  completedAt: string;
  settlementTxHash?: string;
}

export interface FreeContext {
  gas_context: string | null;
  fear_greed_context: string | null;
}

export interface LpRangeSignal {
  schema: 'sasha.lp_range_signal.v1';
  in_range: boolean;
  distance_to_lower_pct: number;
  distance_to_upper_pct: number;
  verdict: 'in_range' | 'near_lower' | 'near_upper' | 'out_of_range';
  position_id: string | null;
  current_price: number | null;
  as_of: string;
  delivery_hash: string;
}

export interface GasCheck {
  schema: 'sasha.gas_check.v1';
  gas_price_gwei: number;
  eth_price_usd: number | null;
  lp_rebalance_cost_usd: number | null;
  verdict: 'cheap' | 'moderate' | 'expensive';
  as_of: string;
  delivery_hash: string;
}
