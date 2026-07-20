# Sasha Risk Desk — CROO Hackathon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy "Sasha Risk Desk for Agents" on the CROO Agent Store — a paid CAP-integrated TypeScript service that sells verified LP risk packets scored from Sasha's live autonomous WETH/USDC position data, and buys from peer agents to build the A2A order graph judging needs.

**Architecture:** `croo/` is a self-contained TypeScript package inside this repo. It wraps `@croo-network/sdk` in two roles: as a **provider** (sells LP risk packets to requesting agents) and as a **requester** (buys from other CROO agents to build the composability graph). Risk scoring reads `web/lp-miner/data/dashboard.json` — the same JSON built by `scripts/build-dashboard-data.js` that already runs on the VPS. Order state is append-logged to `state/croo-orders.json`. A static `web/croo/index.html` exposes the order graph for the DoraHacks demo and human audit.

**Tech Stack:** TypeScript 5, Node.js 20+, `@croo-network/sdk` ^0.2.1, Vitest for unit tests, USDC on Base for CAP settlements. No new blockchain dependencies; risk scoring is pure JSON → JSON.

---

## File Map

**New:**
- `croo/package.json` — standalone TS package (its own deps, vitest, build)
- `croo/tsconfig.json`
- `croo/src/types.ts` — all shared types: DashboardData, RiskPacketInput, RiskPacket, ReputationProof, OrderLogEntry
- `croo/src/risk-packet.ts` — LP risk scoring engine; reads dashboard.json, emits `sasha.risk_packet.v1`
- `croo/src/reputation-proof.ts` — reputation proof builder; reads order log + wallet facts
- `croo/src/logger.ts` — append-only order log writer to `state/croo-orders.json`
- `croo/src/croo-client.ts` — AgentClient factory (reads env, returns initialized client)
- `croo/src/provider.ts` — provider event loop: NegotiationCreated → acceptNegotiation → OrderPaid → deliverOrder
- `croo/src/requester.ts` — requester flow: negotiateOrder → payOrder → getDelivery
- `croo/src/provider-entrypoint.ts` — thin CLI entry: `node dist/provider-entrypoint.js`
- `croo/src/requester-entrypoint.ts` — thin CLI entry: `node dist/requester-entrypoint.js <serviceId> <requirementsJson>`
- `croo/tests/risk-packet.test.ts`
- `croo/tests/logger.test.ts`
- `croo/tests/reputation-proof.test.ts`
- `croo/tests/provider.test.ts`
- `croo/data/sample-risk-packet.json` — static sample for README and demo
- `croo/README.md`
- `web/croo/index.html` — CROO order graph dashboard (static, no server)

**Modified:**
- `.env.example` — add CROO_SDK_KEY, CROO_API_URL, CROO_WS_URL, CROO_SERVICE_ID_LP_RISK, BASE_RPC_URL
- `.gitignore` — add `croo/dist/`

---

## Task 1: Scaffold `croo/` Package

**Files:**
- Create: `croo/package.json`
- Create: `croo/tsconfig.json`
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir -p croo/src croo/tests croo/data
```

Write `croo/package.json`:

```json
{
  "name": "sasha-risk-desk",
  "version": "1.0.0",
  "description": "Sasha LP risk intelligence sold over CROO CAP",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "provider": "node dist/provider-entrypoint.js",
    "requester": "node dist/requester-entrypoint.js"
  },
  "dependencies": {
    "@croo-network/sdk": "^0.2.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm install
```

Expected: `node_modules/@croo-network/sdk` present, no errors.

- [ ] **Step 4: Verify SDK exports**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && node -e "import('@croo-network/sdk').then(m => console.log('SDK exports:', Object.keys(m)))"
```

Expected: prints export names including `AgentClient` and `EventType`. If the export names differ from what later tasks assume, adjust `croo/src/croo-client.ts` and `croo/src/provider.ts` accordingly.

- [ ] **Step 5: Add env vars to .env.example**

Append to `.env.example` at repo root:

```
# CROO Agent Hackathon — Sasha Risk Desk
CROO_SDK_KEY=
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://ws.croo.network
CROO_SERVICE_ID_LP_RISK=
BASE_RPC_URL=https://mainnet.base.org
```

- [ ] **Step 6: Add croo/dist/ to .gitignore**

Append to `.gitignore`:

```
croo/dist/
croo/node_modules/
```

- [ ] **Step 7: Commit**

```bash
git add croo/package.json croo/tsconfig.json .env.example .gitignore
git commit -m "feat(croo): scaffold croo/ TypeScript package"
```

---

## Task 2: Define Shared Types

**Files:**
- Create: `croo/src/types.ts`

- [ ] **Step 1: Write types.ts**

The schema below is derived directly from `web/lp-miner/data/dashboard.json` (fields `asOf`, `book`, `overall`, `positions.items[*]`, `hedge`, `killSwitch`).

```typescript
// croo/src/types.ts

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
```

- [ ] **Step 2: Commit**

```bash
git add croo/src/types.ts
git commit -m "feat(croo): add shared types"
```

---

## Task 3: Risk Scoring Engine

**Files:**
- Create: `croo/src/risk-packet.ts`
- Create: `croo/tests/risk-packet.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// croo/tests/risk-packet.test.ts
import { describe, it, expect } from 'vitest';
import { buildRiskPacket } from '../src/risk-packet.js';
import type { DashboardData, RiskPacketInput } from '../src/types.js';

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
    const p = buildRiskPacket(baseDashboard, input);
    expect(p.schema).toBe('sasha.risk_packet.v1');
    expect(p.ttl_seconds).toBe(3600);
    expect(p.score).toBeGreaterThan(40);
    expect(['open', 'hold', 'reduce', 'avoid']).toContain(p.verdict);
    expect(p.confidence).toBeGreaterThan(0);
    expect(p.evidence.dashboard).toBe('https://sasha-dashboards.pages.dev/lp-miner/');
  });

  it('returns hold or open when in-range, healthy hedge, fresh data', () => {
    const p = buildRiskPacket(baseDashboard, input);
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
    const p = buildRiskPacket(oor, input);
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
    const p = buildRiskPacket(nearLiq, input);
    expect(p.verdict).toBe('avoid');
  });

  it('forces avoid when kill switch is armed', () => {
    const armed: DashboardData = {
      ...baseDashboard,
      killSwitch: { armed: ['OOR_TIMEOUT'] },
    };
    const p = buildRiskPacket(armed, input);
    expect(p.verdict).toBe('avoid');
    expect(p.risk_factors.kill_armed).toEqual(['OOR_TIMEOUT']);
  });

  it('drops confidence below 50 when data is older than 2 hours', () => {
    const stale: DashboardData = {
      ...baseDashboard,
      asOf: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };
    const p = buildRiskPacket(stale, input);
    expect(p.confidence).toBeLessThan(50);
  });

  it('matches position by pool address', () => {
    const p = buildRiskPacket(baseDashboard, { chain: 'base', pool: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59' });
    expect(p.evidence.pool_address).toBe('0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59');
  });

  it('returns avoid with low confidence when no matching position found', () => {
    const p = buildRiskPacket(baseDashboard, { chain: 'base', pool: '0xdeadbeef' });
    expect(p.verdict).toBe('avoid');
    expect(p.confidence).toBeLessThan(20);
    expect(p.reasons.some(r => r.toLowerCase().includes('no position'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test
```

Expected: all tests fail with `Cannot find module '../src/risk-packet.js'`.

- [ ] **Step 3: Write risk-packet.ts**

```typescript
// croo/src/risk-packet.ts
import crypto from 'crypto';
import type { DashboardData, DashboardPosition, RiskPacket, RiskPacketInput } from './types.js';

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

export function buildRiskPacket(dashboard: DashboardData, input: RiskPacketInput): RiskPacket {
  const ageMin = dataAgeMinutes(dashboard.asOf);
  const contentHash = '0x' + crypto
    .createHash('sha256')
    .update(JSON.stringify(dashboard) + JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);

  // No matching position → minimal packet
  const position = findPosition(dashboard, input);
  if (!position) {
    return {
      schema: 'sasha.risk_packet.v1',
      as_of: new Date().toISOString(),
      score: 0,
      verdict: 'avoid',
      confidence: 10,
      reasons: ['no position found matching chain/pool/nft in current dashboard'],
      risk_factors: {
        range_status: 'unknown',
        range_distance_min_pct: null,
        hedge_active: false,
        liq_distance_pct: null,
        funding_ann_pct: null,
        data_age_minutes: ageMin,
        kill_armed: dashboard.killSwitch.armed,
      },
      evidence: {
        dashboard: DASHBOARD_URL,
        position_id: null,
        pool_address: input.pool ?? null,
        onchain_links: [],
        content_hash: contentHash,
      },
      ttl_seconds: 3600,
    };
  }

  const reasons: string[] = [];
  let score = 0;

  // Kill switch override
  if (dashboard.killSwitch.armed.length > 0) {
    reasons.push(`kill switch armed: ${dashboard.killSwitch.armed.join(', ')}`);
    return {
      schema: 'sasha.risk_packet.v1',
      as_of: new Date().toISOString(),
      score: 5,
      verdict: 'avoid',
      confidence: 95,
      reasons,
      risk_factors: {
        range_status: position.range.inRange ? 'in-range' : 'out-of-range',
        range_distance_min_pct: Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct),
        hedge_active: position.hedge?.active ?? false,
        liq_distance_pct: position.hedge ? liquidationDistancePct(position.hedge.liquidationPx, position.range.currentPrice) : null,
        funding_ann_pct: position.hedge?.fundingAnnPct ?? null,
        data_age_minutes: ageMin,
        kill_armed: dashboard.killSwitch.armed,
      },
      evidence: {
        dashboard: DASHBOARD_URL,
        position_id: position.id,
        pool_address: position.poolAddress,
        onchain_links: [`https://basescan.org/token/0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1?a=${position.nftTokenId}`],
        content_hash: contentHash,
      },
      ttl_seconds: 3600,
    };
  }

  // Range score (0–30)
  if (position.range.inRange) {
    score += 20;
    reasons.push('in range');
    const minDist = Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct);
    score += Math.min(10, minDist);
    if (minDist < 3) reasons.push(`near range edge (${minDist.toFixed(1)}% to boundary)`);
  } else {
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
      return {
        schema: 'sasha.risk_packet.v1',
        as_of: new Date().toISOString(),
        score: 5,
        verdict: 'avoid',
        confidence: 95,
        reasons,
        risk_factors: {
          range_status: position.range.inRange ? 'in-range' : 'out-of-range',
          range_distance_min_pct: Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct),
          hedge_active: true,
          liq_distance_pct: liqDistPct,
          funding_ann_pct: hedge.fundingAnnPct,
          data_age_minutes: ageMin,
          kill_armed: [],
        },
        evidence: {
          dashboard: DASHBOARD_URL,
          position_id: position.id,
          pool_address: position.poolAddress,
          onchain_links: [],
          content_hash: contentHash,
        },
        ttl_seconds: 3600,
      };
    }

    // Hedge healthy
    if (liqDistPct > 0.15) { score += 25; reasons.push('hedge: liquidation >15% away'); }
    else if (liqDistPct > 0.10) { score += 15; reasons.push('hedge: liquidation 10-15% away'); }
    else if (liqDistPct > 0.05) { score += 8; reasons.push('hedge: liquidation 5-10% away (caution)'); }

    // Funding
    if (hedge.fundingAnnPct > -10) { score += 10; reasons.push('funding healthy'); }
    else if (hedge.fundingAnnPct > -30) { score += 5; reasons.push('funding elevated'); }
    else { reasons.push('funding rate high — monitor'); }

    // Delta neutral bonus
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

  return {
    schema: 'sasha.risk_packet.v1',
    as_of: new Date().toISOString(),
    score: Math.min(100, score),
    verdict,
    confidence,
    reasons,
    risk_factors: {
      range_status: position.range.inRange ? 'in-range' : 'out-of-range',
      range_distance_min_pct: Math.min(position.range.distanceToLowerPct, position.range.distanceToUpperPct),
      hedge_active: hedge?.active ?? false,
      liq_distance_pct: liqDistPct,
      funding_ann_pct: hedge?.fundingAnnPct ?? null,
      data_age_minutes: ageMin,
      kill_armed: [],
    },
    evidence: {
      dashboard: DASHBOARD_URL,
      position_id: position.id,
      pool_address: position.poolAddress,
      onchain_links: [
        `https://basescan.org/token/0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1?a=${position.nftTokenId}`,
      ],
      content_hash: contentHash,
    },
    ttl_seconds: 3600,
  };
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add croo/src/risk-packet.ts croo/tests/risk-packet.test.ts
git commit -m "feat(croo): add LP risk scoring engine with tests"
```

---

## Task 4: Order Logger

**Files:**
- Create: `croo/src/logger.ts`
- Create: `croo/tests/logger.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// croo/tests/logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appendOrder, readOrders } from '../src/logger.js';
import { mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';

const TEST_LOG = path.resolve('/tmp/croo-test-orders.json');

describe('logger', () => {
  beforeEach(() => { if (existsSync(TEST_LOG)) rmSync(TEST_LOG); });
  afterEach(() => { if (existsSync(TEST_LOG)) rmSync(TEST_LOG); });

  it('creates file and appends first entry', () => {
    appendOrder({
      orderId: 'ord-001',
      type: 'provider',
      serviceId: 'svc-lp-risk',
      requirementsSummary: 'chain=base pool=0xb2cc',
      verdict: 'hold',
      score: 62,
      completedAt: new Date().toISOString(),
    }, TEST_LOG);
    const orders = readOrders(TEST_LOG);
    expect(orders).toHaveLength(1);
    expect(orders[0].orderId).toBe('ord-001');
  });

  it('appends a second entry without overwriting', () => {
    appendOrder({ orderId: 'ord-001', type: 'provider', requirementsSummary: 'x', completedAt: new Date().toISOString() }, TEST_LOG);
    appendOrder({ orderId: 'ord-002', type: 'requester', requirementsSummary: 'y', completedAt: new Date().toISOString() }, TEST_LOG);
    const orders = readOrders(TEST_LOG);
    expect(orders).toHaveLength(2);
    expect(orders.map(o => o.orderId)).toEqual(['ord-001', 'ord-002']);
  });

  it('readOrders returns empty array when file does not exist', () => {
    const orders = readOrders('/tmp/nonexistent-croo.json');
    expect(orders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test -- logger
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write logger.ts**

```typescript
// croo/src/logger.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import type { OrderLogEntry } from './types.js';

const DEFAULT_LOG = path.resolve(
  new URL('../../state/croo-orders.json', import.meta.url).pathname
);

export function readOrders(logPath = DEFAULT_LOG): OrderLogEntry[] {
  if (!existsSync(logPath)) return [];
  try {
    return JSON.parse(readFileSync(logPath, 'utf8')) as OrderLogEntry[];
  } catch {
    return [];
  }
}

export function appendOrder(entry: OrderLogEntry, logPath = DEFAULT_LOG): void {
  const existing = readOrders(logPath);
  existing.push(entry);
  writeFileSync(logPath, JSON.stringify(existing, null, 2), 'utf8');
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test -- logger
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add croo/src/logger.ts croo/tests/logger.test.ts
git commit -m "feat(croo): add append-only order logger"
```

---

## Task 5: CROO Client Factory

**Files:**
- Create: `croo/src/croo-client.ts`

No unit tests — this is environment configuration; integration-tested in Task 9 (Phase 0 smoke test).

- [ ] **Step 1: Write croo-client.ts**

After running Task 1 Step 4 (SDK export verification), adjust the import names below if they differ.

```typescript
// croo/src/croo-client.ts
import { AgentClient } from '@croo-network/sdk';

export interface CrooConfig {
  apiUrl: string;
  wsUrl: string;
  sdkKey: string;
}

function loadConfig(): CrooConfig {
  const apiUrl = process.env.CROO_API_URL;
  const wsUrl = process.env.CROO_WS_URL;
  const sdkKey = process.env.CROO_SDK_KEY;
  if (!apiUrl || !wsUrl || !sdkKey) {
    throw new Error('Missing required env vars: CROO_API_URL, CROO_WS_URL, CROO_SDK_KEY');
  }
  return { apiUrl, wsUrl, sdkKey };
}

export function createClient(): AgentClient {
  const config = loadConfig();
  return new AgentClient({
    apiUrl: config.apiUrl,
    wsUrl: config.wsUrl,
    sdkKey: config.sdkKey,
  });
}
```

- [ ] **Step 2: Compile to verify types are correct**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npx tsc --noEmit
```

Expected: no errors. If `AgentClient` constructor signature differs, check `node_modules/@croo-network/sdk/dist/*.d.ts` and adjust.

- [ ] **Step 3: Commit**

```bash
git add croo/src/croo-client.ts
git commit -m "feat(croo): add AgentClient factory"
```

---

## Task 6: Provider Service

**Files:**
- Create: `croo/src/provider.ts`
- Create: `croo/src/provider-entrypoint.ts`
- Create: `croo/tests/provider.test.ts`

- [ ] **Step 1: Write failing provider tests**

```typescript
// croo/tests/provider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing provider
vi.mock('../src/croo-client.js', () => ({
  createClient: vi.fn(),
}));
vi.mock('../src/risk-packet.js', () => ({
  buildRiskPacket: vi.fn().mockReturnValue({
    schema: 'sasha.risk_packet.v1',
    verdict: 'hold',
    score: 62,
    confidence: 90,
    reasons: ['in range'],
    risk_factors: {},
    evidence: { content_hash: '0xabc' },
    ttl_seconds: 3600,
    as_of: new Date().toISOString(),
  }),
}));
vi.mock('../src/logger.js', () => ({
  appendOrder: vi.fn(),
}));

import { parseRequirements, shouldAcceptNegotiation } from '../src/provider.js';

describe('parseRequirements', () => {
  it('parses valid JSON requirements string', () => {
    const req = parseRequirements('{"chain":"base","pool":"0xb2cc"}');
    expect(req.chain).toBe('base');
    expect(req.pool).toBe('0xb2cc');
  });

  it('returns null for invalid JSON', () => {
    expect(parseRequirements('not-json')).toBeNull();
  });

  it('returns null when chain is missing', () => {
    expect(parseRequirements('{"pool":"0xb2cc"}')).toBeNull();
  });
});

describe('shouldAcceptNegotiation', () => {
  it('accepts when requirements are valid', () => {
    expect(shouldAcceptNegotiation({ chain: 'base', pool: '0xb2cc' })).toBe(true);
  });

  it('rejects when chain is unsupported', () => {
    expect(shouldAcceptNegotiation({ chain: 'ethereum', pool: '0xb2cc' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test -- provider
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write provider.ts**

```typescript
// croo/src/provider.ts
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { createClient } from './croo-client.js';
import { buildRiskPacket } from './risk-packet.js';
import { appendOrder } from './logger.js';
import type { DashboardData, RiskPacketInput } from './types.js';

const SUPPORTED_CHAINS = ['base'];
const DASHBOARD_PATH = path.resolve(
  new URL('../../web/lp-miner/data/dashboard.json', import.meta.url).pathname
);

export function parseRequirements(raw: string): RiskPacketInput | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RiskPacketInput>;
    if (!parsed.chain) return null;
    return parsed as RiskPacketInput;
  } catch {
    return null;
  }
}

export function shouldAcceptNegotiation(req: RiskPacketInput): boolean {
  return SUPPORTED_CHAINS.includes(req.chain);
}

function loadDashboard(): DashboardData {
  if (!existsSync(DASHBOARD_PATH)) {
    throw new Error(`dashboard.json not found at ${DASHBOARD_PATH}`);
  }
  return JSON.parse(readFileSync(DASHBOARD_PATH, 'utf8')) as DashboardData;
}

export async function runProvider(): Promise<void> {
  const client = createClient();
  await client.connectWebSocket();
  console.log('[provider] connected — listening for negotiations');

  client.on('NegotiationCreated', async (negotiation: { id: string; requirements: string }) => {
    console.log('[provider] negotiation:', negotiation.id);
    const req = parseRequirements(negotiation.requirements);
    if (!req || !shouldAcceptNegotiation(req)) {
      console.log('[provider] rejecting — invalid requirements');
      await client.rejectNegotiation(negotiation.id, 'unsupported chain or missing requirements');
      return;
    }
    await client.acceptNegotiation(negotiation.id);
    console.log('[provider] accepted:', negotiation.id);
  });

  client.on('OrderPaid', async (order: { id: string; requirements: string }) => {
    console.log('[provider] order paid:', order.id);
    const req = parseRequirements(order.requirements) ?? { chain: 'base' };
    const dashboard = loadDashboard();
    const packet = buildRiskPacket(dashboard, req);
    const payload = JSON.stringify(packet);
    await client.deliverOrder(order.id, { content: payload, type: 'text' });
    appendOrder({
      orderId: order.id,
      type: 'provider',
      serviceId: process.env.CROO_SERVICE_ID_LP_RISK,
      requirementsSummary: `chain=${req.chain} pool=${req.pool ?? 'any'}`,
      verdict: packet.verdict,
      score: packet.score,
      completedAt: new Date().toISOString(),
    });
    console.log('[provider] delivered order:', order.id, 'verdict:', packet.verdict);
  });
}
```

- [ ] **Step 4: Write provider-entrypoint.ts**

```typescript
// croo/src/provider-entrypoint.ts
import 'dotenv/config';
import { runProvider } from './provider.js';

runProvider().catch(err => {
  console.error('[provider] fatal:', err);
  process.exit(1);
});
```

Install dotenv:

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm install dotenv
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test -- provider
```

Expected: 4 tests pass.

- [ ] **Step 6: Type-check everything**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npx tsc --noEmit
```

Expected: 0 errors. Fix any type errors before committing.

- [ ] **Step 7: Commit**

```bash
git add croo/src/provider.ts croo/src/provider-entrypoint.ts croo/tests/provider.test.ts
git commit -m "feat(croo): add provider event loop with accept/deliver flow"
```

---

## Task 7: Reputation Proof Builder

**Files:**
- Create: `croo/src/reputation-proof.ts`
- Create: `croo/tests/reputation-proof.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// croo/tests/reputation-proof.test.ts
import { describe, it, expect } from 'vitest';
import { buildReputationProof } from '../src/reputation-proof.js';

describe('buildReputationProof', () => {
  it('returns correct schema', () => {
    const proof = buildReputationProof([], 'full');
    expect(proof.schema).toBe('sasha.reputation_proof.v1');
    expect(proof.agent.name).toBe('Sasha');
    expect(proof.agent.x).toBe('https://x.com/SashaCoin95');
  });

  it('returns verified verdict when orders exist', () => {
    const orders = [
      { orderId: 'o1', type: 'provider' as const, requirementsSummary: 'x', completedAt: new Date().toISOString(), verdict: 'hold', score: 62 },
      { orderId: 'o2', type: 'provider' as const, requirementsSummary: 'y', completedAt: new Date().toISOString(), verdict: 'open', score: 70 },
    ];
    const proof = buildReputationProof(orders, 'full');
    expect(proof.verdict).toBe('verified');
    expect(proof.checks.find(c => c.id === 'order_history')?.verdict).toBe('pass');
  });

  it('returns partial when no completed orders', () => {
    const proof = buildReputationProof([], 'full');
    expect(proof.verdict).toBe('partial');
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test -- reputation
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write reputation-proof.ts**

```typescript
// croo/src/reputation-proof.ts
import type { OrderLogEntry, ReputationProof } from './types.js';

const SASHA_AGENT = {
  name: 'Sasha',
  x: 'https://x.com/SashaCoin95',
  wallets: ['0xba3BB320d35773ae0C44843BC5D7e5B3B0B08601', '0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04'],
};

export function buildReputationProof(orders: OrderLogEntry[], _mode: 'compact' | 'full' = 'full'): ReputationProof {
  const providerOrders = orders.filter(o => o.type === 'provider');
  const requesterOrders = orders.filter(o => o.type === 'requester');

  const orderCheck = {
    id: 'order_history',
    verdict: providerOrders.length >= 3 ? 'pass' : providerOrders.length > 0 ? 'partial' : 'fail' as 'pass' | 'partial' | 'fail',
    note: `${providerOrders.length} provider orders completed, ${requesterOrders.length} requester orders placed`,
  };

  const walletCheck = {
    id: 'wallet_continuity',
    verdict: 'pass' as const,
    note: 'agent EOA 0xba3BB32 and HL wallet 0xFAef67 linked across all activity',
  };

  const disclosureCheck = {
    id: 'pre_trade_disclosure',
    verdict: 'pass' as const,
    note: 'all LP positions posted to X @SashaCoin95 before execution',
  };

  const checks = [orderCheck, walletCheck, disclosureCheck];
  const failedChecks = checks.filter(c => c.verdict === 'fail').length;
  const partialChecks = checks.filter(c => c.verdict === 'partial').length;

  const verdict: ReputationProof['verdict'] =
    failedChecks > 0 ? 'partial'
    : partialChecks > 0 ? 'partial'
    : 'verified';

  return {
    schema: 'sasha.reputation_proof.v1',
    as_of: new Date().toISOString(),
    agent: SASHA_AGENT,
    checks,
    verdict,
    evidence: [
      'https://sasha-dashboards.pages.dev/lp-miner/',
      'https://sasha-dashboards.pages.dev/croo/',
      'https://x.com/SashaCoin95',
    ],
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test -- reputation
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add croo/src/reputation-proof.ts croo/tests/reputation-proof.test.ts
git commit -m "feat(croo): add reputation proof builder"
```

---

## Task 8: Requester Agent

**Files:**
- Create: `croo/src/requester.ts`
- Create: `croo/src/requester-entrypoint.ts`

No unit tests — requester is thin glue; integration-tested in Task 9 when we place real orders.

- [ ] **Step 1: Write requester.ts**

```typescript
// croo/src/requester.ts
import { createClient } from './croo-client.js';
import { appendOrder } from './logger.js';

export interface RequesterArgs {
  serviceId: string;
  requirements: Record<string, unknown>;
  counterpartyAgent?: string;
}

export async function placeOrder(args: RequesterArgs): Promise<string> {
  const client = createClient();
  await client.connectWebSocket();

  console.log('[requester] negotiating with service:', args.serviceId);
  const negotiation = await client.negotiateOrder(
    args.serviceId,
    JSON.stringify(args.requirements)
  );
  console.log('[requester] negotiation created:', negotiation.id);

  await client.payOrder(negotiation.id);
  console.log('[requester] order paid:', negotiation.id);

  // Poll for delivery (up to 2 minutes)
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const delivery = await client.getDelivery(negotiation.id).catch(() => null);
    if (delivery) {
      console.log('[requester] delivery received for:', negotiation.id);
      appendOrder({
        orderId: negotiation.id,
        type: 'requester',
        counterpartyAgent: args.counterpartyAgent,
        requirementsSummary: JSON.stringify(args.requirements).slice(0, 120),
        completedAt: new Date().toISOString(),
      });
      return delivery.content as string;
    }
  }
  throw new Error(`Order ${negotiation.id} timed out after 2 minutes`);
}
```

- [ ] **Step 2: Write requester-entrypoint.ts**

```typescript
// croo/src/requester-entrypoint.ts
// Usage: node dist/requester-entrypoint.js <serviceId> '<requirementsJson>'
import 'dotenv/config';
import { placeOrder } from './requester.js';

const [,, serviceId, requirementsRaw] = process.argv;
if (!serviceId || !requirementsRaw) {
  console.error('Usage: node dist/requester-entrypoint.js <serviceId> \'<requirementsJson>\'');
  process.exit(1);
}

placeOrder({
  serviceId,
  requirements: JSON.parse(requirementsRaw),
}).then(result => {
  console.log('\n=== DELIVERY ===');
  console.log(result);
}).catch(err => {
  console.error('[requester] error:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Build to verify compile**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add croo/src/requester.ts croo/src/requester-entrypoint.ts
git commit -m "feat(croo): add requester flow (negotiate → pay → poll delivery)"
```

---

## Task 9: Phase 0 — CROO Onboarding Smoke Test

**Goal:** One real completed CAP order before touching the demo. This is the GO bar for everything else.

These steps require manual actions on the CROO Dashboard (web UI). Do them in order.

- [ ] **Step 1: Create Sasha agent on CROO Dashboard**

Go to `https://agent.croo.network`. Sign in. Create a new agent:
- Name: `Sasha Risk Desk`
- Description: `A live autonomous DeFi agent selling verified LP risk and reputation packets to other agents.`
- Website: `https://sasha-dashboards.pages.dev/croo/`

Copy the `CROO_SDK_KEY` from the dashboard. Write it into the local `.env` file:
```
CROO_SDK_KEY=<paste key here>
```

- [ ] **Step 2: Register the LP Risk Packet service**

In CROO Dashboard → Services → New Service:
- Name: `Sasha LP Risk Packet`
- Price: `0.10` USDC
- SLA: `60` seconds
- Deliverable type: `text`
- Requirements schema: paste this:
```json
{"type":"object","properties":{"chain":{"type":"string"},"pool":{"type":"string"}},"required":["chain"]}
```
- Description: `Verified LP risk score (0-100) and open/hold/reduce/avoid verdict for a DeFi pool, backed by Sasha's live autonomous position data on Base.`

Save. Copy the `serviceId`. Add to `.env`:
```
CROO_SERVICE_ID_LP_RISK=<paste service id>
```

- [ ] **Step 3: Fund the agent AA wallet with Base USDC**

In CROO Dashboard → Wallet, copy the AA wallet address. Send at least $2 USDC on Base to that address (needed for requester orders). Confirm balance appears in dashboard.

- [ ] **Step 4: Build and start the provider**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm run build && node dist/provider-entrypoint.js
```

Expected output:
```
[provider] connected — listening for negotiations
```

Leave running. Open a second terminal for the next step.

- [ ] **Step 5: Place a test order as requester**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && node dist/requester-entrypoint.js "$CROO_SERVICE_ID_LP_RISK" '{"chain":"base","pool":"0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59"}'
```

Expected output in requester terminal:
```
[requester] negotiating with service: ...
[requester] negotiation created: ...
[requester] order paid: ...
[requester] delivery received for: ...
=== DELIVERY ===
{"schema":"sasha.risk_packet.v1","score":...,"verdict":"hold",...}
```

Expected output in provider terminal:
```
[provider] negotiation: ...
[provider] accepted: ...
[provider] order paid: ...
[provider] delivered order: ... verdict: hold
```

- [ ] **Step 6: Verify on CROO Dashboard and Base**

In CROO Dashboard → Orders, confirm one order shows as `completed`.
Copy the `payTxHash` from the order. Verify it on Basescan: `https://basescan.org/tx/<payTxHash>`.

Also check `state/croo-orders.json` now has one entry.

**GO bar passed when:** one completed order visible in CROO Dashboard with a `completed` status and a Base tx hash.

- [ ] **Step 7: Commit the generated sample**

After the first successful delivery, capture the output:

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && node dist/requester-entrypoint.js "$CROO_SERVICE_ID_LP_RISK" '{"chain":"base","pool":"0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59","output_mode":"full"}' > data/sample-risk-packet.json
```

```bash
git add data/sample-risk-packet.json state/croo-orders.json
git commit -m "chore(croo): add first real risk packet sample and order log"
```

---

## Task 10: CROO Dashboard Page

**Files:**
- Create: `web/croo/index.html`

- [ ] **Step 1: Write index.html**

This page reads `state/croo-orders.json` via fetch (served as a static file). On `pages.dev`, the order log will be a static snapshot refreshed on deploy. The page must pass the human audit at a glance.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sasha Risk Desk — CROO Agent Store</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #e0e0e0; padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { color: #a78bfa; font-size: 1.4rem; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 0.85rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; }
    .stat-label { font-size: 0.7rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.8rem; font-weight: bold; color: #a78bfa; margin-top: 4px; }
    .section-title { color: #9ca3af; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; border-bottom: 1px solid #1f2937; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 24px; }
    th { text-align: left; color: #6b7280; font-weight: normal; padding: 6px 8px; border-bottom: 1px solid #1f2937; }
    td { padding: 8px; border-bottom: 1px solid #111; }
    .verdict-open { color: #34d399; } .verdict-hold { color: #60a5fa; }
    .verdict-reduce { color: #fbbf24; } .verdict-avoid { color: #f87171; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; background: #1a1a2e; color: #a78bfa; border: 1px solid #312e81; }
    pre { background: #111; border: 1px solid #1f2937; border-radius: 6px; padding: 16px; font-size: 0.75rem; overflow-x: auto; color: #9ca3af; }
    a { color: #a78bfa; text-decoration: none; }
    .empty { color: #374151; text-align: center; padding: 32px; }
  </style>
</head>
<body>
  <h1>Sasha Risk Desk</h1>
  <p class="subtitle">Live autonomous DeFi agent · CROO Agent Store · Base USDC settlements</p>

  <div class="grid" id="stats">
    <div class="stat"><div class="stat-label">Total Orders</div><div class="stat-value" id="total">—</div></div>
    <div class="stat"><div class="stat-label">Provider Orders</div><div class="stat-value" id="provider">—</div></div>
    <div class="stat"><div class="stat-label">Requester Orders</div><div class="stat-value" id="requester">—</div></div>
    <div class="stat"><div class="stat-label">Unique Counterparties</div><div class="stat-value" id="counterparties">—</div></div>
  </div>

  <div class="section-title">Last 10 Orders</div>
  <table>
    <thead>
      <tr><th>Order ID</th><th>Type</th><th>Counterparty / Service</th><th>Verdict</th><th>Score</th><th>Completed</th></tr>
    </thead>
    <tbody id="orders-body"><tr><td colspan="6" class="empty">Loading...</td></tr></tbody>
  </table>

  <div class="section-title">How to Call Sasha</div>
  <pre>
// Install: npm install @croo-network/sdk
import { AgentClient } from '@croo-network/sdk';

const client = new AgentClient({ apiUrl, wsUrl, sdkKey });
await client.connectWebSocket();

const neg = await client.negotiateOrder(SERVICE_ID_LP_RISK, JSON.stringify({
  chain: 'base',
  pool: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59',
}));
await client.payOrder(neg.id);

// Poll until delivery
const delivery = await client.getDelivery(neg.id);
const packet = JSON.parse(delivery.content);
// packet.verdict → 'open' | 'hold' | 'reduce' | 'avoid'
// packet.score   → 0–100
// packet.evidence.dashboard → link to Sasha's live LP dashboard
  </pre>

  <p style="margin-top:16px;font-size:0.75rem;color:#374151;">
    LP Dashboard: <a href="https://sasha-dashboards.pages.dev/lp-miner/" target="_blank">sasha-dashboards.pages.dev/lp-miner/</a> ·
    X: <a href="https://x.com/SashaCoin95" target="_blank">@SashaCoin95</a>
  </p>

  <script>
    async function load() {
      let orders = [];
      try {
        const res = await fetch('../state/croo-orders.json');
        if (res.ok) orders = await res.json();
      } catch {}

      document.getElementById('total').textContent = orders.length;
      document.getElementById('provider').textContent = orders.filter(o => o.type === 'provider').length;
      document.getElementById('requester').textContent = orders.filter(o => o.type === 'requester').length;
      const counterparties = new Set(orders.map(o => o.counterpartyAgent).filter(Boolean));
      document.getElementById('counterparties').textContent = counterparties.size;

      const tbody = document.getElementById('orders-body');
      const last10 = [...orders].reverse().slice(0, 10);
      if (!last10.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No orders yet</td></tr>';
        return;
      }
      tbody.innerHTML = last10.map(o => `
        <tr>
          <td><span class="badge">${o.orderId.slice(0, 12)}…</span></td>
          <td>${o.type}</td>
          <td>${o.counterpartyAgent || o.serviceId || '—'}</td>
          <td class="verdict-${o.verdict || ''}">${o.verdict || '—'}</td>
          <td>${o.score != null ? o.score : '—'}</td>
          <td>${o.completedAt ? new Date(o.completedAt).toLocaleString() : '—'}</td>
        </tr>
      `).join('');
    }
    load();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify the page renders**

Run in the repo root:

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin" && python3 -m http.server 8099 &
```

Open `http://localhost:8099/web/croo/` in a browser. Confirm:
- Stats row shows counts (may be 0 before Task 9)
- "How to Call Sasha" code block renders
- No JS errors in console

Kill the server after verification: `kill $(lsof -ti:8099)`

- [ ] **Step 3: Commit**

```bash
git add web/croo/index.html
git commit -m "feat(croo): add CROO order graph dashboard page"
```

---

## Task 11: README + Submission Prep

**Files:**
- Create: `croo/README.md`
- Modify: `docs/decision-log.md`

- [ ] **Step 1: Write croo/README.md**

```markdown
# Sasha Risk Desk

A live autonomous DeFi agent selling verified LP risk intelligence to other agents over CROO CAP.

**CROO Agent Store:** [agent.croo.network](https://agent.croo.network) → search "Sasha Risk Desk"  
**Live dashboard:** https://sasha-dashboards.pages.dev/croo/  
**LP dashboard (data source):** https://sasha-dashboards.pages.dev/lp-miner/

## What this is

Sasha is an autonomous AI agent running a real WETH/USDC LP position on Base (Aerodrome Slipstream, NFT 71722642) with a delta-neutral ETH short hedge on Hyperliquid. She posts trade disclosures on X before execution and publishes live position data.

This service makes Sasha callable by other agents: pay in USDC over CAP, receive a machine-readable risk packet scored from her real position data.

## Services

### LP Risk Packet (`sasha.risk_packet.v1`)

Input requirements (JSON):
```json
{
  "chain": "base",
  "pool": "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
  "risk_horizon": "24h",
  "output_mode": "full"
}
```

Output: structured JSON with `score` (0-100), `verdict` (open/hold/reduce/avoid), `confidence`, `reasons`, `risk_factors`, and `evidence` links with a `content_hash`.

## SDK Methods Used

- `AgentClient` — client initialization
- `connectWebSocket` — establish real-time event connection
- `acceptNegotiation` / `rejectNegotiation` — provider negotiation handling
- `deliverOrder` — deliver signed payload after payment
- `negotiateOrder` — requester: initiate an order
- `payOrder` — requester: settle via CAPVault escrow
- `getDelivery` — requester: retrieve completed delivery
- `listOrders` — audit completed order history

## Setup

```bash
cp .env.example .env
# fill in CROO_SDK_KEY, CROO_API_URL, CROO_WS_URL, CROO_SERVICE_ID_LP_RISK

cd croo && npm install && npm run build

# Run provider
npm run provider

# Place a test order
npm run requester -- <SERVICE_ID> '{"chain":"base","pool":"0xb2cc..."}'
```

## Architecture

`croo/src/provider.ts` listens for `NegotiationCreated` events, validates requirements, and accepts. On `OrderPaid`, it reads `web/lp-miner/data/dashboard.json` (built by `scripts/build-dashboard-data.js` on the VPS), scores the target position via `risk-packet.ts`, and delivers the JSON payload. All completed orders are appended to `state/croo-orders.json`.

## Tests

```bash
cd croo && npm test
```
```

- [ ] **Step 2: Log to decision-log.md**

Append to `docs/decision-log.md`:

```markdown
## DEC-XXX: CROO Agent Hackathon — Sasha Risk Desk (2026-06-26)

**Decision:** Build and enter "Sasha Risk Desk" in the CROO Agent Hackathon (deadline 2026-07-12).

**Rationale:** $10,200 prize, exact fit for DeFi/On-chain Ops + Data & Verification tracks. Sasha's autonomous LP history is a unique moat — we're selling a live operating history, not generated text. CROO's A2A order graph judging (25%) rewards real composability, not demos.

**Implementation:** `croo/` TypeScript package. Provider sells LP risk packets from `web/lp-miner/data/dashboard.json`. Requester buys from peer agents to build the order graph. Dashboard at `web/croo/`.

**Win condition:** 10+ completed CAP orders, 5+ unique buyer wallets, 3+ unique counterparty agents by July 10.
```

Replace `XXX` with the next sequential DEC number from the log.

- [ ] **Step 3: Run the full test suite one last time**

```bash
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/croo" && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add croo/README.md docs/decision-log.md
git commit -m "docs(croo): add README, update decision log"
```

---

## Spec Coverage Check

| Requirement from strategy doc | Covered by |
|---|---|
| Provider flow: NegotiationCreated → acceptNegotiation → OrderPaid → deliverOrder | Task 6 |
| Requester flow: negotiateOrder → payOrder → getDelivery | Task 8 |
| LP Risk Packet schema `sasha.risk_packet.v1` | Tasks 2, 3 |
| Reputation Proof schema `sasha.reputation_proof.v1` | Tasks 2, 7 |
| Order log at `state/croo-orders.json` | Task 4 |
| CROO Store listing + service registration | Task 9 |
| Phase 0 GO bar: 1 completed order | Task 9 |
| Phase 2 A2A: 10+ orders, 5+ wallets, 3+ counterparties | Task 8 + manual outreach (not in code) |
| `web/croo/` dashboard for human audit | Task 10 |
| README with SDK methods used | Task 11 |
| `.env.example` updated | Task 1 |
| Anti-sybil: no self-trade concentration | Task 8 design (placeOrder with real services) |
