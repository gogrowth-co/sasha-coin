#!/usr/bin/env node
/**
 * lp-close.js — close an Aerodrome Slipstream CL position: decreaseLiquidity(ALL) + collect(MAX,MAX).
 *
 * Generalises the --close path of migrate-lp-exit.js (which was hardcoded to the June-2026
 * cbBTC/USDC migration). Token addresses, decimals and symbols are read from the position NFT
 * itself, so this works for any Slipstream position owned by the agent EOA.
 *
 * Exists because lp-rebalancer.js's killPosition() has no Base implementation — it warns
 * "Base kill requires AGENT_PRIVATE_KEY", writes a CLOSE_LP_POSITION attestation and sends a
 * Telegram saying EXECUTED, while moving nothing on-chain. This script is the real thing.
 *
 * Default = DRY RUN (read-only: prints planned calls, amounts, min-outs). --execute signs.
 * Signs with AGENT_PRIVATE_KEY || MANTLE_AGENT_PK. Base public-RPC failover.
 * Aborts without broadcasting if the decreaseLiquidity staticCall would revert.
 *
 * Requires the NFT to be held by the EOA. A staked position must be unstaked from its gauge first.
 *
 * Usage:
 *   node scripts/lp-close.js --token-id 71722642
 *   node scripts/lp-close.js --token-id 71722642 --execute
 *
 * Sasha Coin — LP Miner
 */
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

;(() => {
  const cands = ['/data/.openclaw/.env', path.resolve(WORKSPACE, '..', '.env'), path.resolve(WORKSPACE, '.env')]
  for (const p of cands) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i); if (!m) continue
      const [, k, rv] = m; if (process.env[k]) continue
      let v = rv.trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[k] = v
    }
    break
  }
})()

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
// --collect-only: skip decreaseLiquidity and just sweep tokensOwed. Needed when a broadcast
// succeeded but the confirmation poll died (RPC 403/rate-limit), leaving liquidity at 0 with
// the principal still owed on the NFT — re-running the full path would revert on a 0-liquidity
// decrease and strand the funds.
const COLLECT_ONLY = args.includes('--collect-only')
const RPC_OVERRIDE = args.includes('--rpc') ? args[args.indexOf('--rpc') + 1] : null
const tokenIdArg = args[args.indexOf('--token-id') + 1]
if (!args.includes('--token-id') || !/^\d+$/.test(tokenIdArg || '')) {
  console.error('Usage: node scripts/lp-close.js --token-id <id> [--execute]')
  process.exit(1)
}
const TOKEN_ID = BigInt(tokenIdArg)

const NPM = '0x827922686190790b37229fd06084350E74485b72' // Aerodrome Slipstream NftPositionManager
const SLIPPAGE = 0.03
const GAS_LIMIT = 600000n
const MAX128 = (1n << 128n) - 1n

const BASE_RPCS = (RPC_OVERRIDE ? [RPC_OVERRIDE] : [process.env.ALCHEMY_BASE_RPC, 'https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.llamarpc.com']).filter(Boolean)

const NPM_ABI = [
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 fg0,uint256 fg1,uint128 owed0,uint128 owed1)',
  'function ownerOf(uint256) view returns (address)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) returns (uint256 amount0,uint256 amount1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) returns (uint256 amount0,uint256 amount1)',
]
const ERC20 = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]
const POOL_FACTORY_ABI = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,bool)']

const log = (...a) => console.log(...a)

async function provider() {
  for (const url of BASE_RPCS) {
    try { const p = new ethers.JsonRpcProvider(url, undefined, { batchMaxCount: 1 }); await p.getBlockNumber(); return p } catch {}
  }
  throw new Error('all Base RPCs failed')
}

function clAmounts(sqrtP, tickLower, tickUpper, L) {
  const sqrtA = Math.sqrt(1.0001 ** tickLower), sqrtB = Math.sqrt(1.0001 ** tickUpper)
  if (sqrtP <= sqrtA) return { a0: L * (sqrtB - sqrtA) / (sqrtA * sqrtB), a1: 0 }
  if (sqrtP >= sqrtB) return { a0: 0, a1: L * (sqrtB - sqrtA) }
  return { a0: L * (sqrtB - sqrtP) / (sqrtP * sqrtB), a1: L * (sqrtP - sqrtA) }
}

async function main() {
  const pk = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
  if (!pk) { console.error('No Base key (AGENT_PRIVATE_KEY|MANTLE_AGENT_PK) in env'); process.exit(1) }
  const prov = await provider()
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, prov)
  log(`lp-close ${EXECUTE ? '(EXECUTE)' : '(DRY RUN)'} | EOA ${wallet.address} | tokenId ${TOKEN_ID}`)

  const npm = new ethers.Contract(NPM, NPM_ABI, wallet)
  const owner = await npm.ownerOf(TOKEN_ID)
  const pos = await npm.positions(TOKEN_ID)
  const [t0addr, t1addr] = [pos[2], pos[3]]
  const tickLower = Number(pos[5]), tickUpper = Number(pos[6]), liquidity = pos[7]

  const t0 = new ethers.Contract(t0addr, ERC20, prov)
  const t1 = new ethers.Contract(t1addr, ERC20, prov)
  const [d0, d1, s0sym, s1sym] = await Promise.all([t0.decimals(), t1.decimals(), t0.symbol(), t1.symbol()])
  const dec0 = Number(d0), dec1 = Number(d1)

  // Slipstream pool address is not stored on the NFT; derive current price from the
  // position's own fee-growth-free view by reading the pool the caller passes, or fall
  // back to the tick range midpoint. We read the pool via the factory-less route: the
  // caller supplies --pool when the position is not full-range-safe.
  // Sweep-only path: no pricing needed, nothing to decrease.
  if (COLLECT_ONLY) {
    log(`\n[collect-only] NFT ${TOKEN_ID} owner=${owner} | pair ${s0sym}/${s1sym}`)
    log(`  liquidity=${liquidity} | owed: ${s0sym} ${(Number(pos[10]) / 10 ** dec0).toFixed(8)} | ${s1sym} ${(Number(pos[11]) / 10 ** dec1).toFixed(6)}`)
    if (pos[10] === 0n && pos[11] === 0n) { log('  nothing owed — already collected.'); return }
    if (!EXECUTE) { log('  DRY RUN — no tx sent.'); return }
    const c0 = await t0.balanceOf(wallet.address), c1 = await t1.balanceOf(wallet.address)
    const cParams = { tokenId: TOKEN_ID, recipient: wallet.address, amount0Max: MAX128, amount1Max: MAX128 }
    try {
      const sim = await npm.collect.staticCall(cParams, { from: wallet.address })
      log(`  pre-send staticCall OK -> would return ${sim[0]} / ${sim[1]}`)
    } catch (e) {
      console.error(`  ⛔ ABORT: collect would revert (${e.shortMessage || e.reason || e.message}). Not broadcasting.`)
      process.exit(1)
    }
    log('  collect(MAX,MAX)...')
    const rc = await (await npm.collect(cParams, { gasLimit: GAS_LIMIT })).wait(1)
    log(`    tx ${rc.hash}`)
    const e0 = await t0.balanceOf(wallet.address), e1 = await t1.balanceOf(wallet.address)
    log(`  VERIFY received: ${s0sym} +${(Number(e0 - c0) / 10 ** dec0).toFixed(8)} | ${s1sym} +${(Number(e1 - c1) / 10 ** dec1).toFixed(6)}`)
    const after = await npm.positions(TOKEN_ID)
    log(`  VERIFY owed now: ${after[10]} / ${after[11]} ${after[10] === 0n && after[11] === 0n ? '✅ fully swept' : '❌ residual'}`)
    return
  }

  const poolArg = args.includes('--pool') ? args[args.indexOf('--pool') + 1] : null
  let sqrtP
  if (poolArg) {
    const pool = new ethers.Contract(poolArg, POOL_FACTORY_ABI, prov)
    const s0 = await pool.slot0()
    sqrtP = Number(s0[0]) / 2 ** 96
    log(`  pool ${poolArg} sqrtPriceX96 ${s0[0]} tick ${s0[1]}`)
  } else {
    console.error('  ⛔ --pool <address> is required to price the exit (slot0 read). Aborting.')
    process.exit(1)
  }

  if (liquidity === 0n) { log('  liquidity is already 0 — nothing to decrease.'); }

  const { a0, a1 } = clAmounts(sqrtP, tickLower, tickUpper, Number(liquidity))
  const a0min = BigInt(Math.floor(a0 * (1 - SLIPPAGE)))
  const a1min = BigInt(Math.floor(a1 * (1 - SLIPPAGE)))

  log(`\n[close] NFT ${TOKEN_ID} owner=${owner}`)
  log(`  pair ${s0sym}/${s1sym} | liquidity=${liquidity} ticks[${tickLower},${tickUpper}]`)
  log(`  est out: ${s0sym} ${(a0 / 10 ** dec0).toFixed(8)} (min ${(Number(a0min) / 10 ** dec0).toFixed(8)}) | ${s1sym} ${(a1 / 10 ** dec1).toFixed(6)} (min ${(Number(a1min) / 10 ** dec1).toFixed(6)})`)
  log(`  WILL: decreaseLiquidity(${TOKEN_ID}, ${liquidity}, ${a0min}, ${a1min}) ; collect(${TOKEN_ID}, EOA, MAX, MAX)`)

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    log(`  ⛔ NFT not owned by EOA (owner=${owner}). Unstake from the gauge first.`)
    if (EXECUTE) process.exit(1)
  }
  if (!EXECUTE) { log('  DRY RUN — no tx sent.'); return }

  const b0 = await t0.balanceOf(wallet.address), b1 = await t1.balanceOf(wallet.address)
  const deadline = Math.floor(Date.now() / 1000) + 600
  const dParams = { tokenId: TOKEN_ID, liquidity, amount0Min: a0min, amount1Min: a1min, deadline }

  try {
    const sim = await npm.decreaseLiquidity.staticCall(dParams, { from: wallet.address })
    log(`  pre-send staticCall OK -> would return ${sim[0]} / ${sim[1]}`)
  } catch (e) {
    console.error(`  ⛔ ABORT: decreaseLiquidity would revert (${e.shortMessage || e.reason || e.message}). Not broadcasting.`)
    process.exit(1)
  }

  log('  1/2 decreaseLiquidity...')
  const r1 = await (await npm.decreaseLiquidity(dParams, { gasLimit: GAS_LIMIT })).wait(2)
  log(`    tx ${r1.hash}`)
  log('  2/2 collect(MAX,MAX)...')
  const r2 = await (await npm.collect({ tokenId: TOKEN_ID, recipient: wallet.address, amount0Max: MAX128, amount1Max: MAX128 }, { gasLimit: GAS_LIMIT })).wait(2)
  log(`    tx ${r2.hash}`)

  const a0after = await t0.balanceOf(wallet.address), a1after = await t1.balanceOf(wallet.address)
  log(`  VERIFY received: ${s0sym} +${(Number(a0after - b0) / 10 ** dec0).toFixed(8)} | ${s1sym} +${(Number(a1after - b1) / 10 ** dec1).toFixed(6)}`)
  log(`  EOA now holds: ${s0sym} ${(Number(a0after) / 10 ** dec0).toFixed(8)} | ${s1sym} ${(Number(a1after) / 10 ** dec1).toFixed(6)}`)
  const posAfter = await npm.positions(TOKEN_ID)
  log(`  VERIFY liquidity now = ${posAfter[7]} ${posAfter[7] === 0n ? '✅ fully exited' : '❌ residual'}`)
}

main().catch(e => { console.error('FATAL:', e.shortMessage || e.message); process.exit(1) })
