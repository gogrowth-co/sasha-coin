---
name: protocol-changelog
description: Weekly protocol update monitoring for all protocols Sasha's liquidity miner depends on. Covers GitHub release feeds, npm version checks, Discord channels for Orca, Raydium, Uniswap v3, Aerodrome, Morpho Blue, Hyperliquid, Base, Solana, and Byreal CLI. Use before any deploy and on weekly maintenance runs.
---

# Protocol Changelog Monitor — Expert Reference

> **Two monitors, do not confuse them.** This skill watches **protocol SDKs/contracts** (Orca, Raydium, Uniswap, Aerodrome, Morpho, Hyperliquid, Base, Solana, Byreal). The **data-source APIs** that feed the pool scanner (DefiLlama, GeckoTerminal, DexScreener, Revert) are watched by a separate automated job — `scripts/signals/lp-data-source-verifier.mjs`, run weekly by launchd `com.mangaos.lp-datasource-check` (Mondays 09:05). It probes those four APIs, diffs against a baseline, stamps and drift-logs `docs/integrations/lp-data-sources-api-reference.md`, and pings the fleet dashboard. **Section 6 below** covers them; don't hand-check them here unless the verifier flags drift.

## 1. Protocols and Update Sources

| Protocol | Role | GitHub | npm | Social |
|---|---|---|---|---|
| Orca Whirlpools | Solana CLMM | github.com/orca-so/whirlpools/releases | @orca-so/whirlpools-sdk | @orca_so |
| Raydium CLMM | Solana secondary | github.com/raydium-io/raydium-sdk-V2/releases | @raydium-io/raydium-sdk-v2 | @RaydiumProtocol |
| Uniswap v3 | Base LP positions | github.com/Uniswap/v3-core/releases | N/A | @Uniswap |
| Aerodrome Slipstream | Base CLMM + AERO | github.com/aerodrome-finance/slipstream/releases | N/A | @aerodromefi |
| Morpho Blue | Base leverage | github.com/morpho-org/morpho-blue/releases | @morpho-org/morpho-ts | @MorphoLabs |
| Hyperliquid | Hedge executor | github.com/hyperliquid-dex/hyperliquid-python-sdk/releases | N/A | @HyperliquidX |
| Base chain | All Base ops | github.com/base-org/node/releases | N/A | @base |
| Solana | All Solana ops | github.com/solana-labs/solana/releases | N/A | @solana |
| Byreal CLI | CLMM abstraction | github.com/byreal-git/byreal-agent-skills | @byreal-io/byreal-cli | N/A |

---

## 2. Weekly Check Procedure

### Step 1: npm version checks
```bash
npm view @orca-so/whirlpools-sdk version
npm view @raydium-io/raydium-sdk-v2 version
npm view @morpho-org/morpho-ts version
npm view @byreal-io/byreal-cli version

# Compare installed vs latest
cd /path/to/sasha-coin && npm outdated
```

### Step 2: Byreal self-check
```bash
byreal-cli --version
byreal-cli update check
byreal-cli catalog list    # verify position/pool commands still exist
```

### Step 3: GitHub release feed
```bash
# Latest Orca release
curl -s "https://api.github.com/repos/orca-so/whirlpools/releases/latest" | \
  python3 -c "import sys,json; r=json.load(sys.stdin); print('Orca:', r['tag_name'], r['published_at'][:10])"

# Latest Morpho release
curl -s "https://api.github.com/repos/morpho-org/morpho-blue/releases/latest" | \
  python3 -c "import sys,json; r=json.load(sys.stdin); print('Morpho:', r['tag_name'], r['published_at'][:10])"

# Latest Aerodrome Slipstream release
curl -s "https://api.github.com/repos/aerodrome-finance/slipstream/releases/latest" | \
  python3 -c "import sys,json; r=json.load(sys.stdin); print('Aerodrome:', r['tag_name'], r['published_at'][:10])"

# Hyperliquid SDK (proxy for API changes)
curl -s "https://api.github.com/repos/hyperliquid-dex/hyperliquid-python-sdk/releases/latest" | \
  python3 -c "import sys,json; r=json.load(sys.stdin); print('HL SDK:', r['tag_name'], r['published_at'][:10])"
```

### Step 4: Contract address verification
```bash
# Verify Uniswap v3 NftPosManager still active on Base
curl -s "https://api.basescan.org/api?module=contract&action=getabi&address=0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f6" | \
  python3 -c "import sys,json; r=json.load(sys.stdin); print('UniV3 NftPosManager:', 'OK' if r['status']=='1' else 'NOT FOUND')"
```

### Step 5: Hyperliquid API schema check
```bash
curl -s -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type":"metaAndAssetCtxs"}' | \
  python3 -c "
import sys, json
meta, ctxs = json.load(sys.stdin)
eth_idx = next((i for i,a in enumerate(meta['universe']) if a['name']=='ETH'), None)
print(f'ETH asset index: {eth_idx}')
print(f'ETH funding: {ctxs[eth_idx][\"funding\"]}')
print(f'Total assets: {len(meta[\"universe\"])}')
"
```

---

## 3. Breaking Change Assessment

| Change Type | Action |
|---|---|
| Orca/Raydium program ID change | Update solana-clmm SKILL.md, test on devnet |
| Uniswap/Aerodrome contract address change | Update base-defi-stack SKILL.md |
| SDK method rename | Check CHANGELOG.md, update position-monitor.js, lp-rebalancer.js |
| Byreal command rename | Run `byreal-cli skill`, update all scripts that call byreal-cli |
| Hyperliquid API schema change | Re-test order placement on testnet, update hyperliquid-perps SKILL.md |
| Morpho market params | Recheck HF formula, update base-defi-stack SKILL.md |

---

## 4. Automated Changelog Script

```js
// scripts/signals/changelog-monitor.js
import https from 'https'
import fs from 'fs'
import path from 'path'

const PROTOCOLS = [
  { name: 'orca',        owner: 'orca-so',           repo: 'whirlpools'               },
  { name: 'raydium',     owner: 'raydium-io',        repo: 'raydium-sdk-V2'           },
  { name: 'aerodrome',   owner: 'aerodrome-finance', repo: 'slipstream'               },
  { name: 'morpho',      owner: 'morpho-org',        repo: 'morpho-blue'              },
  { name: 'hyperliquid', owner: 'hyperliquid-dex',   repo: 'hyperliquid-python-sdk'   },
]

async function fetchLatest(owner, repo) {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname: 'api.github.com', path: `/repos/${owner}/${repo}/releases/latest`, headers: { 'User-Agent': 'sasha/1.0' } },
      res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); }
    ).on('error', reject)
  })
}

const results = await Promise.all(PROTOCOLS.map(async p => {
  try {
    const r = await fetchLatest(p.owner, p.repo)
    return { protocol: p.name, version: r.tag_name, date: r.published_at.slice(0,10) }
  } catch(e) { return { protocol: p.name, error: e.message } }
}))

const out = { generatedAt: new Date().toISOString(), protocols: results }
fs.writeFileSync(`state/changelog-report-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(out, null, 2))
console.log(results.map(r => `  ${r.protocol}: ${r.version || 'error'}`).join('\n'))
```

VPS cron (add to openclaw.json):
```json
{ "name": "changelog-monitor", "schedule": "0 9 * * 1", "command": "node scripts/signals/changelog-monitor.js" }
```

---

## 5. Skill Staleness Triggers

| Event | Stale Skill |
|---|---|
| New Orca SDK major version | solana-clmm |
| Byreal CLI minor version bump | byreal-cli, solana-clmm |
| Aerodrome gauge migration | base-defi-stack |
| Morpho oracle/market change | base-defi-stack |
| Hyperliquid API breaking change | hyperliquid-perps |
| Mantle hard fork | mantle-agent |
| DefiLlama/GeckoTerminal/DexScreener/Revert endpoint or field change | lp-data-sources-api-reference.md (auto-flagged by the verifier, §6) |

---

## 6. Data-Source API Monitor (automated)

The pool scanner depends on four off-chain data APIs. These are **not** hand-checked in the weekly procedure above — they are probed automatically and the reference doc is kept honest by the verifier.

| API | What we use it for | Drift risk |
|---|---|---|
| DefiLlama (`yields.llama.fi`, `coins.llama.fi`) | pool discovery + token prices | low (stable, public) |
| GeckoTerminal (`api.geckoterminal.com/api/v2`) | accurate volume + TVL; OpenAPI at `/docs/v2/swagger.json` | low-med (versioned schema — verifier diffs the path set + version) |
| DexScreener (`api.dexscreener.com`) | fast volume + liquidity scan | low (public, stable) |
| Revert (`api.revert.finance/v1/positions`) | realized fee APR cross-check | **HIGH — undocumented**; can change silently. The verifier's top watch target. |
| The Graph (`gateway.thegraph.com`, Bearer key) | tick-level depth + exact daily volume/fees/TVL (Base/Ethereum) | med — per-subgraph schema can change on upgrade; **authed (key) so only the LOCAL verifier checks it, not the cloud routine**. Verified subgraphs: Uniswap v3 ETH `5zvR82...`, Aerodrome Base `GENunSHW...`. Key must be 32 hex. |

**The job:** `node scripts/signals/lp-data-source-verifier.mjs` (`--dry-run` to preview, `--rebaseline` to accept current live state as the new normal).
- Probes each API's documented endpoints + field shape; for GeckoTerminal it diffs the machine-readable `swagger.json` (version + path set).
- Compares to `state/lp-data-source-baseline.json`.
- Always stamps `**Last auto-verified:**` in `docs/integrations/lp-data-sources-api-reference.md` and writes `reports/lp-data-source-check-YYYY-MM-DD.{json,md}`.
- On drift: appends a dated entry to the doc's **Drift log**, pings Telegram (VPS) + the fleet dashboard (local).
- **When drift fires:** read the report, fix the prose spec in the reference doc, then `--rebaseline` to clear the alert. The script never rewrites the spec itself.

**Schedule:** launchd `com.mangaos.lp-datasource-check`, Mondays 09:05 (runner `~/bin/run-lp-datasource-check.sh`, log `~/Library/Logs/lp-datasource-check.log`).
