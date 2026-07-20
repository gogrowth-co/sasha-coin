# CROO Multi-Service Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Sasha's CROO provider from 1 service to 3, replace the paid A2A per-order buys with free API context, and route the provider to the right handler per service.

**Architecture:** Three new files under `croo/src/services/` (one per service), a `free-data.ts` module that replaces per-order CROO buys with zero-cost API calls, and a routing layer added to the existing `provider.ts`. The A2A buyer (`a2a-buyer.ts`) stays intact but is decoupled from per-order delivery — it will be used for strategic reciprocal buys, not per-order context fetching.

**Tech Stack:** TypeScript/ESM, `@croo-network/sdk`, Node 23 `fetch` (no extra HTTP libs), existing `BASE_RPC_URL` env var, `alternative.me` public API, CoinGecko public API, `web/lp-miner/data/dashboard.json` (live VPS file).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `croo/src/free-data.ts` | Create | Fetch gas price (Base RPC) + Fear & Greed (alternative.me) at zero cost |
| `croo/src/services/lp-range-signal.ts` | Create | LP range status handler — reads dashboard.json, no external calls |
| `croo/src/services/gas-check.ts` | Create | Base gas cost estimate handler — RPC + CoinGecko |
| `croo/src/types.ts` | Modify | Add `FreeContext`, `LpRangeSignal`, `GasCheck` types |
| `croo/src/risk-packet.ts` | Modify | Accept optional `FreeContext` arg; populate `gas_context`/`fear_greed_context` from it |
| `croo/src/provider.ts` | Modify | (1) Filter by serviceId in NegotiationCreated; (2) Route OrderPaid to right handler |
| `.env.example` | Modify | Add `CROO_SERVICE_ID_LP_RANGE`, `CROO_SERVICE_ID_GAS_CHECK` |
| `croo/tests/free-data.test.ts` | Create | Unit tests for free-data module (fetch mocked) |
| `croo/tests/lp-range-signal.test.ts` | Create | Unit tests for LP range handler |
| `croo/tests/gas-check.test.ts` | Create | Unit tests for gas check handler |
| `croo/tests/provider-routing.test.ts` | Create | Unit tests for the new multi-service routing |

---

## Task 1: Add types for new services and free context

**Files:**
- Modify: `croo/src/types.ts`

- [ ] **Step 1: Write the failing type-check test**

Create `croo/tests/types-check.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { FreeContext, LpRangeSignal, GasCheck } from '../src/types.js';

describe('new types compile', () => {
  it('FreeContext has gas_context and fear_greed_context', () => {
    const fc: FreeContext = { gas_context: 'cheap', fear_greed_context: 'Fear 42' };
    expect(fc.gas_context).toBe('cheap');
    expect(fc.fear_greed_context).toBe('Fear 42');
  });

  it('LpRangeSignal has required fields', () => {
    const s: LpRangeSignal = {
      schema: 'sasha.lp_range_signal.v1',
      in_range: true,
      distance_to_lower_pct: 5.2,
      distance_to_upper_pct: 12.1,
      verdict: 'in_range',
      position_id: 'abc',
      current_price: 1800,
      as_of: '2026-01-01T00:00:00Z',
      delivery_hash: 'abc123',
    };
    expect(s.schema).toBe('sasha.lp_range_signal.v1');
  });

  it('GasCheck has required fields', () => {
    const g: GasCheck = {
      schema: 'sasha.gas_check.v1',
      gas_price_gwei: 0.01,
      eth_price_usd: 3500,
      lp_rebalance_cost_usd: 0.18,
      verdict: 'cheap',
      as_of: '2026-01-01T00:00:00Z',
      delivery_hash: 'abc123',
    };
    expect(g.verdict).toBe('cheap');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd croo && npm test -- tests/types-check.test.ts
```

Expected: FAIL — types not found.

- [ ] **Step 3: Add types to `croo/src/types.ts`**

Append after the existing `OrderLogEntry` interface:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd croo && npm test -- tests/types-check.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add croo/src/types.ts croo/tests/types-check.test.ts
git commit -m "feat(croo): add FreeContext, LpRangeSignal, GasCheck types"
```

---

## Task 2: Free data module

Replace the paid A2A per-order context buys with free public API calls. The existing `a2a-buyer.ts` is unchanged — it will be used for strategic reciprocal buys later.

**Files:**
- Create: `croo/src/free-data.ts`
- Create: `croo/tests/free-data.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `croo/tests/free-data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFreeContext } from '../src/free-data.js';

describe('fetchFreeContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BASE_RPC_URL;
  });

  it('returns gas_context and fear_greed_context on success', async () => {
    const mockFetch = vi.mocked(fetch);
    // First call: Base RPC gas price
    // Second call: CoinGecko ETH price
    // Third call: Fear & Greed
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x5F5E100' }) } as Response) // 100_000_000 wei = 0.1 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ value: '42', value_classification: 'Fear' }] }) } as Response);

    const ctx = await fetchFreeContext();
    expect(ctx.gas_context).toContain('gwei');
    expect(ctx.fear_greed_context).toContain('Fear');
  });

  it('returns null fields on fetch failure — does not throw', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));
    const ctx = await fetchFreeContext();
    expect(ctx.gas_context).toBeNull();
    expect(ctx.fear_greed_context).toBeNull();
  });

  it('returns null fear_greed_context when BASE_RPC_URL is missing', async () => {
    delete process.env.BASE_RPC_URL;
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ value: '30', value_classification: 'Extreme Fear' }] }) } as Response);
    const ctx = await fetchFreeContext();
    expect(ctx.gas_context).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd croo && npm test -- tests/free-data.test.ts
```

Expected: FAIL — `free-data.ts` not found.

- [ ] **Step 3: Create `croo/src/free-data.ts`**

```typescript
import type { FreeContext } from './types.js';

async function fetchGasGwei(): Promise<{ gwei: number; ethUsd: number | null } | null> {
  const rpc = process.env.BASE_RPC_URL;
  if (!rpc) return null;

  try {
    const [gasRes, priceRes] = await Promise.all([
      fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'),
    ]);

    if (!gasRes.ok || !priceRes.ok) return null;

    const gasJson = await gasRes.json() as { result?: string };
    const priceJson = await priceRes.json() as { ethereum?: { usd?: number } };

    const weiHex = gasJson.result;
    if (!weiHex) return null;

    const gwei = parseInt(weiHex, 16) / 1e9;
    const ethUsd = priceJson.ethereum?.usd ?? null;

    return { gwei, ethUsd };
  } catch {
    return null;
  }
}

async function fetchFearGreed(): Promise<string | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return null;
    const json = await res.json() as { data?: Array<{ value?: string; value_classification?: string }> };
    const entry = json.data?.[0];
    if (!entry) return null;
    return `${entry.value_classification} ${entry.value}/100`;
  } catch {
    return null;
  }
}

export async function fetchFreeContext(): Promise<FreeContext> {
  const [gasData, fearGreed] = await Promise.allSettled([fetchGasGwei(), fetchFearGreed()]);

  const gas = gasData.status === 'fulfilled' ? gasData.value : null;
  const fg = fearGreed.status === 'fulfilled' ? fearGreed.value : null;

  let gasContext: string | null = null;
  if (gas) {
    const gwei = gas.gwei.toFixed(4);
    if (gas.ethUsd) {
      // LP rebalance ≈ 500k gas on Base
      const costUsd = (gas.gwei * 500_000 * 1e-9 * gas.ethUsd).toFixed(4);
      gasContext = `${gwei} gwei — LP rebalance ≈ $${costUsd}`;
    } else {
      gasContext = `${gwei} gwei`;
    }
  }

  return {
    gas_context: gasContext,
    fear_greed_context: fg,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd croo && npm test -- tests/free-data.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add croo/src/free-data.ts croo/tests/free-data.test.ts
git commit -m "feat(croo): free-data module — gas + fear/greed from public APIs"
```

---

## Task 3: Update `risk-packet.ts` to accept FreeContext

**Files:**
- Modify: `croo/src/risk-packet.ts`

The function currently gets `gas_context`/`fear_greed_context` from `externalInputs`. Add an optional `freeCtx` argument that takes priority over externalInputs for those two fields.

- [ ] **Step 1: Write the failing test**

In `croo/tests/risk-packet.test.ts`, add inside the describe block:

```typescript
it('uses freeCtx gas_context over externalInputs', () => {
  const dashboard = buildMockDashboard(); // use the existing helper already in the test file
  const packet = buildRiskPacket(
    dashboard,
    { chain: 'base' },
    [],
    { gas_context: 'free gas data', fear_greed_context: 'Fear 32/100' },
  );
  expect(packet.gas_context).toBe('free gas data');
  expect(packet.fear_greed_context).toBe('Fear 32/100');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd croo && npm test -- tests/risk-packet.test.ts
```

Expected: FAIL — `buildRiskPacket` does not accept 4th argument.

- [ ] **Step 3: Update signature in `croo/src/risk-packet.ts`**

Change the function signature from:
```typescript
export function buildRiskPacket(
  dashboard: DashboardData,
  input: RiskPacketInput,
  externalInputs: ExternalAgentInput[] = []
): RiskPacket
```

To:
```typescript
export function buildRiskPacket(
  dashboard: DashboardData,
  input: RiskPacketInput,
  externalInputs: ExternalAgentInput[] = [],
  freeCtx: FreeContext = { gas_context: null, fear_greed_context: null }
): RiskPacket
```

Add `import type { FreeContext } from './types.js';` at the top if not already present.

Then update the two context assignments inside the function body. Find the lines that look like:
```typescript
gas_context: externalInputs.find(e => e.used_for === 'gas_context')?.summary ?? null,
fear_greed_context: externalInputs.find(e => e.used_for === 'fear_greed_context')?.summary ?? null,
```

Replace with:
```typescript
gas_context: freeCtx.gas_context ?? externalInputs.find(e => e.used_for === 'gas_context')?.summary ?? null,
fear_greed_context: freeCtx.fear_greed_context ?? externalInputs.find(e => e.used_for === 'fear_greed_context')?.summary ?? null,
```

- [ ] **Step 4: Run all tests to verify pass**

```bash
cd croo && npm test
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add croo/src/risk-packet.ts croo/tests/risk-packet.test.ts
git commit -m "feat(croo): buildRiskPacket accepts FreeContext for gas/fear-greed context"
```

---

## Task 4: Update `provider.ts` to use free context

**Files:**
- Modify: `croo/src/provider.ts` (lines 125-144)

Replace the `buyExternalInputs` call with `fetchFreeContext`, and pass the result into `buildRiskPacket`.

- [ ] **Step 1: Update the import block in `croo/src/provider.ts`**

Find:
```typescript
import { buyExternalInputs } from './a2a-buyer.js';
```

Replace with:
```typescript
import { fetchFreeContext } from './free-data.js';
```

- [ ] **Step 2: Update the OrderPaid handler body**

Find (around lines 125-144):
```typescript
// Buy from external CROO agents before delivery (resilient — failures return [])
const externalInputs = await buyExternalInputs(client);

// Log each external purchase as a requester entry
for (const ext of externalInputs) {
  try {
    appendOrder({
      orderId: ext.orderId,
      type: 'requester',
      serviceId: ext.serviceId,
      counterpartyAgent: ext.agent,
      requirementsSummary: `a2a:${ext.used_for}`,
      completedAt: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error('[provider] appendOrder for external input failed:', logErr);
  }
}

const packet = buildRiskPacket(dashboard, req, externalInputs);
```

Replace with:
```typescript
// Fetch free context (gas price + fear/greed) — zero CROO cost
const freeCtx = await fetchFreeContext().catch(() => ({ gas_context: null, fear_greed_context: null }));

const packet = buildRiskPacket(dashboard, req, [], freeCtx);
```

- [ ] **Step 3: Run all tests**

```bash
cd croo && npm test
```

Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add croo/src/provider.ts
git commit -m "feat(croo): replace A2A per-order buys with free API context"
```

---

## Task 5: LP Range Status Signal service

**Files:**
- Create: `croo/src/services/lp-range-signal.ts`
- Create: `croo/tests/lp-range-signal.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `croo/tests/lp-range-signal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleLpRangeSignal } from '../src/services/lp-range-signal.js';
import type { DashboardData } from '../src/types.js';

function makeDashboard(overrides: Partial<{
  inRange: boolean;
  distanceLower: number;
  distanceUpper: number;
  currentPrice: number;
  killArmed: string[];
  openCount: number;
}>): DashboardData {
  const o = { inRange: true, distanceLower: 8.5, distanceUpper: 12.3, currentPrice: 1800, killArmed: [], openCount: 1, ...overrides };
  return {
    asOf: new Date().toISOString(),
    book: { deployedBasisUsd: 20, lpValueUsd: 19, navUsd: 19 },
    overall: { deltaNeutral: true, killArmed: 0, status: 'ok' },
    killSwitch: { armed: o.killArmed },
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
  it('returns in_range verdict when position is in range and distances > 10%', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd croo && npm test -- tests/lp-range-signal.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `croo/src/services/lp-range-signal.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd croo && npm test -- tests/lp-range-signal.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add croo/src/services/lp-range-signal.ts croo/tests/lp-range-signal.test.ts
git commit -m "feat(croo): LP Range Status Signal service handler"
```

---

## Task 6: Base Gas Cost Check service

**Files:**
- Create: `croo/src/services/gas-check.ts`
- Create: `croo/tests/gas-check.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `croo/tests/gas-check.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGasCheck } from '../src/services/gas-check.js';

describe('handleGasCheck', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BASE_RPC_URL;
  });

  it('returns cheap verdict for low gas (<0.05 gwei)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x2540BE4' }) } as Response) // 0.039 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response);
    const result = JSON.parse(await handleGasCheck());
    expect(result.schema).toBe('sasha.gas_check.v1');
    expect(result.verdict).toBe('cheap');
    expect(result.delivery_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.lp_rebalance_cost_usd).toBeTypeOf('number');
  });

  it('returns moderate for gas 0.05–0.5 gwei', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x5F5E100' }) } as Response) // 0.1 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response);
    const result = JSON.parse(await handleGasCheck());
    expect(result.verdict).toBe('moderate');
  });

  it('returns expensive for gas > 0.5 gwei', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x77359400' }) } as Response) // 2 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ethereum: { usd: 3500 } }) } as Response);
    const result = JSON.parse(await handleGasCheck());
    expect(result.verdict).toBe('expensive');
  });

  it('returns null cost fields and moderate verdict when RPC fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'));
    const result = JSON.parse(await handleGasCheck());
    expect(result.gas_price_gwei).toBe(0);
    expect(result.lp_rebalance_cost_usd).toBeNull();
    expect(result.verdict).toBe('moderate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd croo && npm test -- tests/gas-check.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `croo/src/services/gas-check.ts`**

```typescript
import crypto from 'crypto';
import type { GasCheck } from '../types.js';

const LP_REBALANCE_GAS = 500_000; // estimated gas units for a full LP position adjustment on Base

async function fetchGasAndPrice(): Promise<{ gwei: number; ethUsd: number | null }> {
  const rpc = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';

  try {
    const [gasRes, priceRes] = await Promise.all([
      fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'),
    ]);

    const gasJson = await gasRes.json() as { result?: string };
    const priceJson = await priceRes.json() as { ethereum?: { usd?: number } };

    const gwei = gasJson.result ? parseInt(gasJson.result, 16) / 1e9 : 0;
    const ethUsd = priceJson.ethereum?.usd ?? null;

    return { gwei, ethUsd };
  } catch {
    return { gwei: 0, ethUsd: null };
  }
}

function gasVerdict(gwei: number): GasCheck['verdict'] {
  if (gwei === 0) return 'moderate'; // unknown — default to middle
  if (gwei < 0.05) return 'cheap';
  if (gwei < 0.5) return 'moderate';
  return 'expensive';
}

export async function handleGasCheck(): Promise<string> {
  const { gwei, ethUsd } = await fetchGasAndPrice();

  const costUsd =
    gwei > 0 && ethUsd !== null
      ? parseFloat((gwei * LP_REBALANCE_GAS * 1e-9 * ethUsd).toFixed(4))
      : null;

  const core = {
    gas_price_gwei: parseFloat(gwei.toFixed(6)),
    eth_price_usd: ethUsd,
    lp_rebalance_cost_usd: costUsd,
    verdict: gasVerdict(gwei),
    as_of: new Date().toISOString(),
  };

  const signal: GasCheck = {
    schema: 'sasha.gas_check.v1',
    ...core,
    delivery_hash: crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };

  return JSON.stringify(signal);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd croo && npm test -- tests/gas-check.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Run full test suite**

```bash
cd croo && npm test
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add croo/src/services/gas-check.ts croo/tests/gas-check.test.ts
git commit -m "feat(croo): Base Gas Cost Check service handler"
```

---

## Task 7: Multi-service provider routing

Wire both new services into `provider.ts`. The router checks `negotiation.serviceId` to decide which handler to call.

**Files:**
- Modify: `croo/src/provider.ts`
- Modify: `.env.example`
- Create: `croo/tests/provider-routing.test.ts`

- [ ] **Step 1: Write the failing routing tests**

Create `croo/tests/provider-routing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
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

  it('returns lp_risk handler for LP risk service ID', () => {
    expect(getHandlerForService('svc-lp-risk')).toBe('lp_risk');
  });

  it('returns lp_range handler for LP range service ID', () => {
    expect(getHandlerForService('svc-lp-range')).toBe('lp_range');
  });

  it('returns gas_check handler for gas check service ID', () => {
    expect(getHandlerForService('svc-gas-check')).toBe('gas_check');
  });

  it('returns null for unknown service ID', () => {
    expect(getHandlerForService('svc-unknown')).toBeNull();
  });

  it('SCHEMA_FOR_SERVICE maps all handlers', () => {
    expect(SCHEMA_FOR_SERVICE.lp_risk).toBe('sasha.risk_packet.v1');
    expect(SCHEMA_FOR_SERVICE.lp_range).toBe('sasha.lp_range_signal.v1');
    expect(SCHEMA_FOR_SERVICE.gas_check).toBe('sasha.gas_check.v1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd croo && npm test -- tests/provider-routing.test.ts
```

Expected: FAIL — `getHandlerForService` and `SCHEMA_FOR_SERVICE` not exported.

- [ ] **Step 3: Update `croo/src/provider.ts`**

Add imports at the top (after existing imports):

```typescript
import { handleLpRangeSignal } from './services/lp-range-signal.js';
import { handleGasCheck } from './services/gas-check.js';
import { fetchFreeContext } from './free-data.js';
```

Add these exports after the existing `shouldAcceptNegotiation` function (before `loadDashboard`):

```typescript
type HandlerKey = 'lp_risk' | 'lp_range' | 'gas_check';

export const SCHEMA_FOR_SERVICE: Record<HandlerKey, string> = {
  lp_risk: 'sasha.risk_packet.v1',
  lp_range: 'sasha.lp_range_signal.v1',
  gas_check: 'sasha.gas_check.v1',
};

export function getHandlerForService(serviceId: string): HandlerKey | null {
  if (serviceId === process.env.CROO_SERVICE_ID_LP_RISK) return 'lp_risk';
  if (serviceId === process.env.CROO_SERVICE_ID_LP_RANGE) return 'lp_range';
  if (serviceId === process.env.CROO_SERVICE_ID_GAS_CHECK) return 'gas_check';
  return null;
}
```

Update the `NegotiationCreated` handler — after fetching the negotiation, add a service ID check:

```typescript
// After: negotiation = await client.getNegotiation(negotiationId);

const handlerKey = getHandlerForService(negotiation.serviceId ?? '');
if (!handlerKey) {
  console.log(`[provider] rejecting negotiation ${negotiationId} — unknown serviceId: ${negotiation.serviceId}`);
  try { await client.rejectNegotiation(negotiationId, 'service not supported'); } catch {}
  return;
}

// For LP risk: also parse requirements to validate chain
if (handlerKey === 'lp_risk') {
  const req = parseRequirements(negotiation.requirements ?? '');
  if (!req || !shouldAcceptNegotiation(req)) {
    const reason = !req ? 'missing chain field' : `unsupported chain: ${req.chain}`;
    console.log(`[provider] rejecting negotiation ${negotiationId} — ${reason}`);
    try { await client.rejectNegotiation(negotiationId, reason); } catch {}
    return;
  }
}
```

Update the `OrderPaid` handler — replace the existing `buildRiskPacket` call with a routing dispatch:

```typescript
// Replace everything from "const externalInputs = ..." to "result = await client.deliverOrder..." with:

const handlerKey = getHandlerForService(order.serviceId ?? '');
if (!handlerKey) {
  console.warn(`[provider] unknown serviceId on paid order ${orderId} — rejecting`);
  try { await client.rejectOrder(orderId, 'service not supported'); } catch {}
  return;
}

let deliverableText: string;
let verdict: string | undefined;
let score: number | undefined;

if (handlerKey === 'lp_risk') {
  let dashboard: DashboardData;
  try {
    dashboard = loadDashboard();
  } catch (err) {
    console.error(`[provider] dashboard load failed — rejecting order ${orderId}:`, err);
    try { await client.rejectOrder(orderId, 'dashboard unavailable'); } catch {}
    return;
  }
  const freeCtx = await fetchFreeContext().catch(() => ({ gas_context: null, fear_greed_context: null }));
  const packet = buildRiskPacket(dashboard, req, [], freeCtx);
  deliverableText = JSON.stringify(packet);
  verdict = packet.verdict;
  score = packet.score;
} else if (handlerKey === 'lp_range') {
  let dashboard: DashboardData;
  try {
    dashboard = loadDashboard();
  } catch (err) {
    console.error(`[provider] dashboard load failed — rejecting order ${orderId}:`, err);
    try { await client.rejectOrder(orderId, 'dashboard unavailable'); } catch {}
    return;
  }
  deliverableText = handleLpRangeSignal(dashboard);
} else {
  // gas_check
  deliverableText = await handleGasCheck();
}

const schema = SCHEMA_FOR_SERVICE[handlerKey];

let result;
try {
  result = await client.deliverOrder(orderId, {
    deliverableType: DeliverableType.Schema,
    deliverableSchema: schema,
    deliverableText,
  });
} catch (err) {
  console.error(`[provider] deliverOrder failed for ${orderId}:`, err);
  return;
}

console.log(`[provider] delivered order ${orderId} — handler=${handlerKey}`);
```

- [ ] **Step 4: Run all tests**

```bash
cd croo && npm test
```

Expected: ALL PASS.

- [ ] **Step 5: Add new env vars to `.env.example`**

Find the CROO section and add after `CROO_SERVICE_ID_LP_RISK`:

```
CROO_SERVICE_ID_LP_RANGE=
CROO_SERVICE_ID_GAS_CHECK=
```

- [ ] **Step 6: Build to confirm clean compile**

```bash
cd croo && npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add croo/src/provider.ts croo/src/services/ croo/tests/provider-routing.test.ts .env.example
git commit -m "feat(croo): multi-service router — LP range + gas check + free context"
```

---

## Task 8: Register services on CROO + deploy to VPS

This task is operational, not code. It requires Gabriel to navigate the CROO dashboard.

**Step 1: Register LP Range Status Signal**

On `agent.croo.network → My Agents → Sasha Risk Desk → Add Service`:
- Name: `Sasha LP Range Signal`
- Price: `0.10` USDC
- SLA: `5` min
- Deliverable: Schema
- Field name: `lp_range_signal`
- Description: `In-range status and boundary distances for Sasha's active WETH/USDC CL position on Base. Returns verdict: in_range, near_lower, near_upper, or out_of_range.`
- Requirements: Text — `Optionally specify pool address or NFT token ID. Leave empty to get the primary position.`

After saving: copy the service ID → paste here.

**Step 2: Register Base Gas Cost Check**

Same flow:
- Name: `Sasha Base Gas Check`
- Price: `0.05` USDC
- SLA: `5` min
- Deliverable: Schema
- Field name: `gas_check`
- Description: `Current Base L2 gas price in gwei plus USD cost estimate for a standard LP position rebalance (~500k gas). Verdict: cheap, moderate, or expensive.`
- Requirements: Text — `No input required. Optionally pass {} or any JSON.`

After saving: copy the service ID → paste here.

**Step 3: Set service IDs on VPS**

Once both IDs are pasted into the conversation, run the VPS env update script with both IDs (same pattern as setting `CROO_SERVICE_ID_LP_RISK` earlier).

**Step 4: Deploy updated croo/ to VPS**

```bash
# From sasha-coin root:
tar -czf /tmp/croo-v3.tar.gz --exclude='croo/node_modules' --exclude='croo/dist' croo/
scp -i ~/.ssh/hostinger_vps /tmp/croo-v3.tar.gz root@187.77.42.134:/tmp/croo-v3.tar.gz
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 '
  cd /docker/openclaw-h3mk/data/.openclaw/workspace &&
  tar -xzf /tmp/croo-v3.tar.gz &&
  rm /tmp/croo-v3.tar.gz &&
  cd croo &&
  npm run build &&
  pm2 restart sasha-croo-provider
'
```

**Step 5: Verify**

```bash
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 'pm2 logs sasha-croo-provider --nostream --lines 8'
```

Expected: `[provider] connected — listening for negotiations` with no errors.

---

## Self-Review

**Spec coverage:**
- ✅ Replace A2A per-order CROO buys with free APIs (Tasks 2–4)
- ✅ LP Range Status Signal service (Task 5)
- ✅ Base Gas Cost Check service (Task 6)
- ✅ Multi-service routing in provider (Task 7)
- ✅ Registration + deployment (Task 8)
- ✅ All new types defined before use (Task 1)

**Placeholder scan:** None found. Every step has complete code.

**Type consistency:**
- `FreeContext` defined in Task 1, used in Task 2 (`free-data.ts`) and Task 3 (`risk-packet.ts`)
- `LpRangeSignal` defined in Task 1, used in Task 5 (`lp-range-signal.ts`)
- `GasCheck` defined in Task 1, used in Task 6 (`gas-check.ts`)
- `HandlerKey` defined and used within Task 7 only
- `handleLpRangeSignal` returns `string` (JSON) — Task 7 uses it as `string` ✅
- `handleGasCheck` returns `Promise<string>` (JSON) — Task 7 awaits it ✅
