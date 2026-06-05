#!/usr/bin/env node
/**
 * migrate-state-update.js — ONE-OFF: update lp-positions.json after the cbBTC/USDC -> WETH/USDC ts100 migration.
 * Moves the old position to closedPositions, adds the new WETH/USDC ts100 position + ETH hedge.
 * Pass --execute to write; default prints the resulting JSON.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')
const P = path.join(WORKSPACE, 'state', 'lp-positions.json')
const EXECUTE = process.argv.includes('--execute')
const now = new Date().toISOString()

const store = JSON.parse(fs.readFileSync(P, 'utf8'))
const OLD_ID = 'aerodrome-usdc-cbbtc-cl2000-001'
const NEW_ID = 'aerodrome-weth-usdc-ts100-001'

// close old
const idx = store.positions.findIndex(p => p.id === OLD_ID)
if (idx !== -1) {
  const old = store.positions.splice(idx, 1)[0]
  store.closedPositions = store.closedPositions || []
  store.closedPositions.push({ ...old, status: 'closed', closedAt: now, closeReason: 'migrated_to_weth_usdc_ts100',
    closeTxs: { decreaseLiquidity: '0xd9d78129d16f390b44ceae560a7fc253fecb3ff936f987afe98e3efd24ab35fd', collect: '0xac9b21d40836ede3ac1e02f4326d0e555a5820b34b2dddb1f6a061ebd7984ea3' } })
}

// add new (only if not present)
if (!store.positions.find(p => p.id === NEW_ID)) {
  store.positions.push({
    _comment: 'WETH/USDC Aerodrome Slipstream ts100. UNSTAKED (fee-collect mode, do NOT stake). STATIC HEDGE: pool is intentionally NOT in hedge-executor POOL_REGISTRY, so the 30-min cron will NOT auto-rebalance this ETH short (matches the no-rebalance decision). Funding-kill + KILL policy are MANUAL: close LP+hedge if OOR>24h, or ETH price >5% beyond a band (<$1511 or >$2040), or hedge within 3% of liq ($2082).',
    id: NEW_ID,
    status: 'open',
    symbol: 'WETH/USDC',
    chain: 'base',
    project: 'aerodrome-slipstream',
    poolAddress: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59',
    feeTier: 'CL100',
    coinId: 'coingecko:ethereum',
    lowerPrice: 1590.87,
    upperPrice: 1943.07,
    tickLower: -202600,
    tickUpper: -200600,
    capitalUsd: 40.28,
    deployedBasisUsd: 40.28,
    openedAt: now,
    nftTokenId: '71722642',
    openTxHash: '0xca933aebc52a9bf861c11a7d7a55c812bd342a81fc443d1454f7f30292d700c6',
    staked: false,
    gaugeAddress: null,
    staticHedge: true,
    morpho: null,
    pendingFeesUsd: 0,
    lastClaimAt: null,
    firstOorAt: null,
    inRange: true,
    currentPrice: 1770.62,
    oorMinutes: 0,
    hedgePerp: 'ETH',
    hedgeSize: 0.0106,
    hedgeSide: 'short',
    hedgeLeverage: 5,
    hedgeIsolated: true,
    hedgeEntryMark: 1770.6,
    hedgeLiquidationPx: 2082,
    hedgeMarginUsd: 3.74,
    hedgeNotionalUsd: 18.77,
    hedgeVenue: 'Hyperliquid',
    hedgeWallet: '0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04',
    hedgeOpenOid: 457778830715,
    hedgeUpdatedAt: now,
    migrationAeroClaimed: 0.585288,
  })
}
store.updatedAt = now
store.lastCheckedAt = now

if (!EXECUTE) { console.log(JSON.stringify(store, null, 2)); console.log('\n(DRY — pass --execute to write)'); process.exit(0) }
fs.writeFileSync(P, JSON.stringify(store, null, 2) + '\n')
console.log(`✅ wrote ${P} | open: ${store.positions.length} | closed: ${store.closedPositions.length}`)
console.log(`  open ids: ${store.positions.map(p => p.id).join(', ')}`)
