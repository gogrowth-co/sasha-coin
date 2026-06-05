#!/usr/bin/env node
/**
 * migrate-lp-exit.js — ONE-OFF migration helper: exit the current cbBTC/USDC ts2000 LP.
 *
 * Two gated sub-steps (each its own --execute gate):
 *   --claim-unstake : gauge.getReward(tokenId) + gauge.withdraw(tokenId) -> NFT back to EOA 0x21AF
 *   --close         : NPM.decreaseLiquidity(ALL) + NPM.collect(MAX,MAX)  -> USDC + cbBTC to EOA
 *
 * Default = DRY RUN (read-only, prints planned calls + amounts + min-outs). Pass --execute to sign.
 * Signs with AGENT_PRIVATE_KEY || MANTLE_AGENT_PK (EOA 0x21AF…). Base public-RPC failover.
 *
 * Sasha Coin — LP migration (cbBTC/USDC ts2000 -> WETH/USDC ts100). One-off, delete after migration.
 */
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// Event-driven dashboard refresh after a successful capital move (non-fatal).
function refreshDashboard() {
  try { execSync(`bash ${path.join(__dirname, 'refresh-dashboard.sh')}`, { stdio: 'inherit', timeout: 200000 }) }
  catch (e) { console.error('[refresh-dashboard non-fatal]', e.message) }
}

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
const CLAIM_UNSTAKE = args.includes('--claim-unstake')
const CLOSE = args.includes('--close')

// ── Fixed migration targets (current position) ──
const TOKEN_ID = 71397771n
const POOL = '0x3e66e55e97ce60096f74b7c475e8249f2d31a9fb' // USDC/cbBTC CL2000
const NPM = '0x827922686190790b37229fd06084350E74485b72'  // Aerodrome Slipstream NftPositionManager
const GAUGE = '0x9B55cb6cAe1e303B5EDce6F9fcf90246D382809c'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // token0 (6)
const cbBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' // token1 (8)
const AERO = '0x940181a94A35A4569E4529A3CDfB74e38FD98631'
const SLIPPAGE = 0.03 // 3% tolerance on decreaseLiquidity mins (full exit on a deep pool; absorbs estimate-window price blips)
const GAS_LIMIT = 600000n // explicit gasLimit — bypasses flaky public-RPC estimateGas (gas ~free at 0.006 gwei)

const BASE_RPCS = [process.env.ALCHEMY_BASE_RPC, 'https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.llamarpc.com'].filter(Boolean)

const NPM_ABI = [
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 fg0,uint256 fg1,uint128 owed0,uint128 owed1)',
  'function ownerOf(uint256) view returns (address)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) returns (uint256 amount0,uint256 amount1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) returns (uint256 amount0,uint256 amount1)',
]
const GAUGE_ABI = [
  'function getReward(uint256 tokenId) external',
  'function withdraw(uint256 tokenId) external',
  'function earned(address account,uint256 tokenId) view returns (uint256)',
]
const POOL_ABI = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,bool)']
const ERC20 = ['function balanceOf(address) view returns (uint256)']

const log = (...a) => console.log(...a)
const MAX128 = (1n << 128n) - 1n

async function provider() {
  for (const url of BASE_RPCS) {
    try { const p = new ethers.JsonRpcProvider(url, undefined, { batchMaxCount: 1 }); await p.getBlockNumber(); return p } catch {}
  }
  throw new Error('all Base RPCs failed')
}

function clAmounts(sqrtP, tickLower, tickUpper, L) {
  const sqrtA = Math.sqrt(1.0001 ** tickLower), sqrtB = Math.sqrt(1.0001 ** tickUpper)
  let a0, a1
  if (sqrtP <= sqrtA) { a0 = L * (sqrtB - sqrtA) / (sqrtA * sqrtB); a1 = 0 }
  else if (sqrtP >= sqrtB) { a0 = 0; a1 = L * (sqrtB - sqrtA) }
  else { a0 = L * (sqrtB - sqrtP) / (sqrtP * sqrtB); a1 = L * (sqrtP - sqrtA) }
  return { a0, a1 }
}

async function main() {
  if (!CLAIM_UNSTAKE && !CLOSE) { log('Pass --claim-unstake or --close (add --execute to sign). Default dry-run.'); process.exit(0) }
  const pk = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
  if (!pk) { console.error('No Base key (AGENT_PRIVATE_KEY|MANTLE_AGENT_PK) in env'); process.exit(1) }
  const prov = await provider()
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, prov)
  log(`migrate-lp-exit ${EXECUTE ? '(EXECUTE)' : '(DRY RUN)'} | EOA ${wallet.address}`)

  const npm = new ethers.Contract(NPM, NPM_ABI, wallet)
  const gauge = new ethers.Contract(GAUGE, GAUGE_ABI, wallet)
  const pool = new ethers.Contract(POOL, POOL_ABI, prov)
  const usdc = new ethers.Contract(USDC, ERC20, prov)
  const cbbtc = new ethers.Contract(cbBTC, ERC20, prov)
  const aero = new ethers.Contract(AERO, ERC20, prov)

  if (CLAIM_UNSTAKE) {
    const owner = await npm.ownerOf(TOKEN_ID)
    let earned = 0n; try { earned = await gauge.earned(wallet.address, TOKEN_ID) } catch {}
    log(`\n[claim-unstake] NFT ${TOKEN_ID} owner=${owner} (gauge=${GAUGE})`)
    log(`  pending AERO (earned): ${ethers.formatUnits(earned, 18)}`)
    log(`  WILL: gauge.getReward(${TOKEN_ID}) ; gauge.withdraw(${TOKEN_ID}) -> NFT to ${wallet.address}`)
    if (owner.toLowerCase() !== GAUGE.toLowerCase()) { log('  ⚠ NFT not in gauge (already unstaked?). ownerOf != gauge — verify before forcing.') }
    if (!EXECUTE) { log('  DRY RUN — no tx sent.'); return }
    const aBefore = await aero.balanceOf(wallet.address)
    log('  1/2 getReward...'); const r1 = await (await gauge.getReward(TOKEN_ID)).wait(2); log(`    tx ${r1.hash}`)
    log('  2/2 withdraw...'); const r2 = await (await gauge.withdraw(TOKEN_ID)).wait(2); log(`    tx ${r2.hash}`)
    const owner2 = await npm.ownerOf(TOKEN_ID)
    const aAfter = await aero.balanceOf(wallet.address)
    log(`  VERIFY ownerOf now = ${owner2} ${owner2.toLowerCase() === wallet.address.toLowerCase() ? '✅ EOA' : '❌ NOT EOA'}`)
    log(`  AERO claimed: ${ethers.formatUnits(aAfter - aBefore, 18)}`)
    return
  }

  if (CLOSE) {
    const owner = await npm.ownerOf(TOKEN_ID)
    const pos = await npm.positions(TOKEN_ID)
    const tickLower = Number(pos[5]), tickUpper = Number(pos[6]), liquidity = pos[7]
    const s0 = await pool.slot0()
    const sqrtP = Number(s0[0]) / 2 ** 96
    const { a0, a1 } = clAmounts(sqrtP, tickLower, tickUpper, Number(liquidity))
    const a0min = BigInt(Math.floor(a0 * (1 - SLIPPAGE)))
    const a1min = BigInt(Math.floor(a1 * (1 - SLIPPAGE)))
    log(`\n[close] NFT ${TOKEN_ID} owner=${owner}`)
    log(`  liquidity=${liquidity} ticks[${tickLower},${tickUpper}]`)
    log(`  est out: USDC ${(a0 / 1e6).toFixed(4)} (min ${(Number(a0min) / 1e6).toFixed(4)}) | cbBTC ${(a1 / 1e8).toFixed(8)} (min ${(Number(a1min) / 1e8).toFixed(8)})`)
    log(`  WILL: decreaseLiquidity(${TOKEN_ID}, ${liquidity}, ${a0min}, ${a1min}) ; collect(${TOKEN_ID}, EOA, MAX, MAX)`)
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) { log(`  ⛔ NFT not owned by EOA (owner=${owner}). Run --claim-unstake first.`); if (EXECUTE) process.exit(1) }
    if (!EXECUTE) { log('  DRY RUN — no tx sent.'); return }
    const uB = await usdc.balanceOf(wallet.address), cB = await cbbtc.balanceOf(wallet.address)
    const deadline = Math.floor(Date.now() / 1000) + 600
    const dParams = { tokenId: TOKEN_ID, liquidity, amount0Min: a0min, amount1Min: a1min, deadline }
    // pre-send guard: simulate; abort (no broadcast) if it would revert
    try { const sim = await npm.decreaseLiquidity.staticCall(dParams, { from: wallet.address }); log(`  pre-send staticCall OK -> would return ${sim[0]} / ${sim[1]}`) }
    catch (e) { console.error(`  ⛔ ABORT: decreaseLiquidity would revert (${e.shortMessage || e.reason || e.message}). Not broadcasting.`); process.exit(1) }
    log('  1/2 decreaseLiquidity...')
    const r1 = await (await npm.decreaseLiquidity(dParams, { gasLimit: GAS_LIMIT })).wait(2)
    log(`    tx ${r1.hash}`)
    log('  2/2 collect(MAX,MAX)...')
    const r2 = await (await npm.collect({ tokenId: TOKEN_ID, recipient: wallet.address, amount0Max: MAX128, amount1Max: MAX128 }, { gasLimit: GAS_LIMIT })).wait(2)
    log(`    tx ${r2.hash}`)
    const uA = await usdc.balanceOf(wallet.address), cA = await cbbtc.balanceOf(wallet.address)
    log(`  VERIFY received: USDC +${(Number(uA - uB) / 1e6).toFixed(4)} | cbBTC +${(Number(cA - cB) / 1e8).toFixed(8)}`)
    log(`  EOA now holds: USDC ${(Number(uA) / 1e6).toFixed(4)} | cbBTC ${(Number(cA) / 1e8).toFixed(8)}`)
    return
  }
}
main().then(() => { if (EXECUTE) refreshDashboard() }).catch(e => { console.error('FATAL:', e.shortMessage || e.message); process.exit(1) })
