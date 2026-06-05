#!/usr/bin/env node
/**
 * migrate-lp-mint.js — ONE-OFF: mint the new WETH/USDC Aerodrome Slipstream ts100 position.
 *
 * Recomputes ±10% range from LIVE slot0, sizes amounts from EOA balances, sets min-outs from the
 * ACTUAL consumed amounts (ratio-safe), approves WETH+USDC to the Slipstream NPM, mint(). DOES NOT STAKE.
 *
 * Default DRY RUN — prints ticks, amounts, mins, no tx. Pass --execute to sign.
 * Signs with AGENT_PRIVATE_KEY || MANTLE_AGENT_PK (EOA 0x21AF…). Verifies new NFT + range after.
 *
 * Sasha Coin — LP migration. One-off, delete after migration. DO NOT STAKE (fee-collect mode).
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
  for (const p of cands) { if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i); if (!m) continue; const [, k, rv] = m; if (process.env[k]) continue; let v = rv.trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[k] = v } break }
})()

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const SLIPPAGE = parseFloat(val('--slippage') || '0.02') // 2% on mint mins (absorbs tick drift)
const RANGE = parseFloat(val('--range') || '0.10')       // ±10%

const WETH = '0x4200000000000000000000000000000000000006' // token0 (18)
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // token1 (6)
const POOL = '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59' // WETH/USDC ts100
const NPM = '0x827922686190790b37229fd06084350E74485b72'  // Aerodrome Slipstream NftPositionManager
const TICK_SPACING = 100
const GAS_LIMIT = 700000n // explicit gasLimit — bypasses flaky public-RPC estimateGas

const BASE_RPCS = [process.env.ALCHEMY_BASE_RPC, 'https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.llamarpc.com'].filter(Boolean)
const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)']
const POOL_ABI = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,bool)', 'function tickSpacing() view returns (int24)']
const NPM_ABI = [
  'function mint((address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline,uint160 sqrtPriceX96)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,int24 tickSpacing,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 fg0,uint256 fg1,uint128 owed0,uint128 owed1)',
]
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const log = (...a) => console.log(...a)

async function provider() { for (const url of BASE_RPCS) { try { const p = new ethers.JsonRpcProvider(url, undefined, { batchMaxCount: 1 }); await p.getBlockNumber(); return p } catch {} } throw new Error('all Base RPCs failed') }

async function main() {
  const pk = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
  if (!pk) { console.error('No Base key in env'); process.exit(1) }
  const prov = await provider()
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, prov)
  log(`migrate-lp-mint ${EXECUTE ? '(EXECUTE)' : '(DRY RUN)'} | EOA ${wallet.address} | NO STAKE | slippage ${(SLIPPAGE * 100)}%`)

  const pool = new ethers.Contract(POOL, POOL_ABI, prov)
  const s0 = await pool.slot0(); const tsOnchain = Number(await pool.tickSpacing())
  if (tsOnchain !== TICK_SPACING) { log(`⛔ pool tickSpacing ${tsOnchain} != expected ${TICK_SPACING}`); process.exit(1) }
  const sqrtP = Number(s0[0]) / 2 ** 96
  const P = sqrtP * sqrtP * 1e12 // ETH USD
  const snap = t => Math.round(t / TICK_SPACING) * TICK_SPACING
  const tickLower = snap(Math.log(P * (1 - RANGE) * 1e-12) / Math.log(1.0001))
  const tickUpper = snap(Math.log(P * (1 + RANGE) * 1e-12) / Math.log(1.0001))
  const pL = 1.0001 ** tickLower * 1e12, pU = 1.0001 ** tickUpper * 1e12
  const sqrtA = Math.sqrt(1.0001 ** tickLower), sqrtB = Math.sqrt(1.0001 ** tickUpper)

  const wethC = new ethers.Contract(WETH, ERC20, wallet), usdcC = new ethers.Contract(USDC, ERC20, wallet)
  const [wBal, uBal] = await Promise.all([wethC.balanceOf(wallet.address), usdcC.balanceOf(wallet.address)])
  const amount0Desired = wBal, amount1Desired = uBal // WETH=token0, USDC=token1

  // liquidity from each token, take min; then actual consumed amounts -> mins
  const L0 = Number(amount0Desired) * sqrtP * sqrtB / (sqrtB - sqrtP)
  const L1 = Number(amount1Desired) / (sqrtP - sqrtA)
  const L = Math.min(L0, L1)
  const cons0 = L * (sqrtB - sqrtP) / (sqrtP * sqrtB) // raw WETH consumed
  const cons1 = L * (sqrtP - sqrtA)                   // raw USDC consumed
  const amount0Min = BigInt(Math.floor(cons0 * (1 - SLIPPAGE)))
  const amount1Min = BigInt(Math.floor(cons1 * (1 - SLIPPAGE)))

  log(`\n  spot ETH $${P.toFixed(2)} | tick ${Number(s0[1])} | ts ${tsOnchain}`)
  log(`  range ±${(RANGE * 100)}%: tick[${tickLower},${tickUpper}] = $${pL.toFixed(2)} – $${pU.toFixed(2)}`)
  log(`  in-range check: ${Number(s0[1]) > tickLower && Number(s0[1]) < tickUpper ? '✅ spot inside' : '❌ spot OUTSIDE range'}`)
  log(`  EOA balances: WETH ${(Number(wBal) / 1e18).toFixed(6)} | USDC ${(Number(uBal) / 1e6).toFixed(4)}`)
  log(`  amount0Desired(WETH) ${amount0Desired} | amount1Desired(USDC) ${amount1Desired}`)
  log(`  est consumed: WETH ${(cons0 / 1e18).toFixed(6)} | USDC ${(cons1 / 1e6).toFixed(4)} (binding: ${L0 < L1 ? 'WETH' : 'USDC'})`)
  log(`  amount0Min ${amount0Min} | amount1Min ${amount1Min}`)
  log(`  WILL: approve WETH+USDC to NPM ; mint(token0=WETH,token1=USDC,ts=100,[${tickLower},${tickUpper}],...) recipient=EOA ; NO stake`)
  if (amount0Desired === 0n || amount1Desired === 0n) { log('  ⛔ a token balance is 0 — run the swap step first'); if (EXECUTE) process.exit(1); return }
  if (!EXECUTE) { log('  DRY RUN — no tx sent.'); return }

  const npm = new ethers.Contract(NPM, NPM_ABI, wallet)
  for (const [c, addr, amt, sym] of [[wethC, WETH, amount0Desired, 'WETH'], [usdcC, USDC, amount1Desired, 'USDC']]) {
    const al = await c.allowance(wallet.address, NPM)
    if (al < amt) { log(`  approving ${sym}...`); await (await c.approve(NPM, ethers.MaxUint256, { gasLimit: 120000n })).wait(2) } else log(`  ${sym} already approved`)
  }
  const deadline = Math.floor(Date.now() / 1000) + 600
  const mintParams = { token0: WETH, token1: USDC, tickSpacing: TICK_SPACING, tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min, amount1Min, recipient: wallet.address, deadline, sqrtPriceX96: 0n }
  try { const sim = await npm.mint.staticCall(mintParams, { from: wallet.address }); log(`  pre-send staticCall OK -> tokenId ${sim[0]} liquidity ${sim[1]} (amount0 ${sim[2]} amount1 ${sim[3]})`) }
  catch (e) { console.error(`  ⛔ ABORT: mint would revert (${e.shortMessage || e.reason || e.message}). Not broadcasting.`); process.exit(1) }
  log('  minting (NO stake)...')
  const r = await (await npm.mint(mintParams, { gasLimit: GAS_LIMIT })).wait(2)
  log(`  mint tx ${r.hash}`)
  let tokenId = null
  for (const lg of r.logs) { if (lg.address.toLowerCase() === NPM.toLowerCase() && lg.topics[0] === TRANSFER_TOPIC && BigInt(lg.topics[1]) === 0n) { tokenId = BigInt(lg.topics[3]).toString(); break } }
  log(`  NEW NFT tokenId: ${tokenId || '(parse failed — check tx)'}`)
  if (tokenId) {
    const pos = await npm.positions(tokenId)
    const s1 = await pool.slot0()
    const tl = Number(pos[5]), tu = Number(pos[6]), liq = pos[7]
    log(`  VERIFY: ticks[${tl},${tu}] liquidity ${liq} | current tick ${Number(s1[1])} -> ${Number(s1[1]) > tl && Number(s1[1]) < tu ? '✅ IN RANGE' : '❌ OOR'}`)
    log(`  owner stays EOA (unstaked). Position is in fee-collect mode.`)
  }
}
main().then(() => { if (EXECUTE) refreshDashboard() }).catch(e => { console.error('FATAL:', e.shortMessage || e.message); process.exit(1) })
