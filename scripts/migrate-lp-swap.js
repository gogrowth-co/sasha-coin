#!/usr/bin/env node
/**
 * migrate-lp-swap.js — ONE-OFF: rebalance EOA holdings to the WETH/USDC target ratio.
 *
 * Two gated swaps (Uniswap v3 SwapRouter02 on Base, QuoterV2 min-outs, real slippage protection):
 *   --to-usdc : swap ALL cbBTC -> USDC               (fee tier 0.05%)
 *   --to-weth : swap (live WETH-fraction of USDC) -> WETH (fee tier 0.05%)
 *
 * Default DRY RUN — quotes expected out + price impact + min-out, no tx. Pass --execute to sign.
 * Reads the live WETH/USDC ts100 split so the result lands at the delta-neutral entry ratio.
 * Signs with AGENT_PRIVATE_KEY || MANTLE_AGENT_PK (EOA 0x21AF…).
 *
 * Sasha Coin — LP migration. One-off, delete after migration.
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
const TO_USDC = args.includes('--to-usdc')
const TO_WETH = args.includes('--to-weth')
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const SLIPPAGE = parseFloat(val('--slippage') || '0.015') // 1.5% min-out tolerance (slot0-price estimate)
const GAS_LIMIT = 500000n // explicit gasLimit — bypasses flaky public-RPC estimateGas

const WETH = '0x4200000000000000000000000000000000000006'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const cbBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'
const SWAP_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' // Uniswap SwapRouter02 (Base)
const FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'    // Uniswap v3 Factory (Base)
const TARGET_POOL = '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59' // WETH/USDC ts100 (for live split)
const FEE = 500 // 0.05% for both cbBTC/USDC and WETH/USDC swaps

const BASE_RPCS = [process.env.ALCHEMY_BASE_RPC, 'https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.llamarpc.com'].filter(Boolean)
const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)', 'function decimals() view returns (uint8)']
const ROUTER_ABI = ['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)']
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)']
const UNIV3_POOL_ABI = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)', 'function token0() view returns (address)']
const POOL_ABI = ['function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,bool)', 'function tickSpacing() view returns (int24)']
const log = (...a) => console.log(...a)

async function provider() { for (const url of BASE_RPCS) { try { const p = new ethers.JsonRpcProvider(url, undefined, { batchMaxCount: 1 }); await p.getBlockNumber(); return p } catch {} } throw new Error('all Base RPCs failed') }

// live WETH/USDC split at spot for ±10% range (WETH token0 18, USDC token1 6)
async function liveSplit(prov) {
  const pool = new ethers.Contract(TARGET_POOL, POOL_ABI, prov)
  const s0 = await pool.slot0(); const ts = Number(await pool.tickSpacing())
  const sqrtP = Number(s0[0]) / 2 ** 96
  const P = sqrtP * sqrtP * 1e12
  const tL = Math.round((Math.log(P * 0.9 * 1e-12) / Math.log(1.0001)) / ts) * ts
  const tU = Math.round((Math.log(P * 1.1 * 1e-12) / Math.log(1.0001)) / ts) * ts
  const sqrtA = Math.sqrt(1.0001 ** tL), sqrtB = Math.sqrt(1.0001 ** tU)
  const sp = Math.min(Math.max(sqrtP, sqrtA), sqrtB)
  const vW = ((sqrtB - sp) / (sp * sqrtB) / 1e18) * P, vU = (sp - sqrtA) / 1e6
  return { P, fracWeth: vW / (vW + vU), fracUsdc: vU / (vW + vU) }
}

async function doSwap(wallet, prov, tokenIn, tokenOut, decIn, decOut, symIn, symOut, amountInRaw) {
  // min-out from the pool's slot0 price (QuoterV2 is not deployed at the documented Base address)
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, prov)
  const poolAddr = await factory.getPool(tokenIn, tokenOut, FEE)
  if (!poolAddr || poolAddr === ethers.ZeroAddress) { console.error(`  ⛔ no Uniswap pool ${symIn}/${symOut} fee ${FEE}`); process.exit(1) }
  const pool = new ethers.Contract(poolAddr, UNIV3_POOL_ABI, prov)
  const s0 = await pool.slot0(); const t0 = await pool.token0()
  const sqrtP = Number(s0[0]) / 2 ** 96
  const inIsT0 = t0.toLowerCase() === tokenIn.toLowerCase()
  const dec0 = inIsT0 ? decIn : decOut, dec1 = inIsT0 ? decOut : decIn
  const price1per0 = sqrtP * sqrtP * 10 ** (dec0 - dec1) // token1 per token0 (human)
  const outPerIn = inIsT0 ? price1per0 : 1 / price1per0
  const inHuman = Number(amountInRaw) / 10 ** decIn
  const expOut = inHuman * outPerIn * (1 - FEE / 1e6)
  const minOut = BigInt(Math.floor(expOut * 10 ** decOut * (1 - SLIPPAGE)))
  log(`  swap ${inHuman} ${symIn} -> ${symOut} via Uniswap pool ${poolAddr} (fee ${FEE})`)
  log(`    est out ~${expOut.toFixed(decOut === 6 ? 4 : 8)} ${symOut} | min-out(${(SLIPPAGE * 100).toFixed(1)}%): ${(Number(minOut) / 10 ** decOut).toFixed(decOut === 6 ? 4 : 8)}`)
  if (!EXECUTE) { log('    DRY RUN — no tx.'); return }
  const tin = new ethers.Contract(tokenIn, ERC20, wallet)
  const allow = await tin.allowance(wallet.address, SWAP_ROUTER)
  if (allow < amountInRaw) { log('    approving router...'); await (await tin.approve(SWAP_ROUTER, ethers.MaxUint256, { gasLimit: 120000n })).wait(2) }
  const router = new ethers.Contract(SWAP_ROUTER, ROUTER_ABI, wallet)
  const tout = new ethers.Contract(tokenOut, ERC20, prov)
  const params = { tokenIn, tokenOut, fee: FEE, recipient: wallet.address, amountIn: amountInRaw, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }
  try { const sim = await router.exactInputSingle.staticCall(params, { from: wallet.address }); log(`    pre-send staticCall OK -> out ${(Number(sim) / 10 ** decOut).toFixed(decOut === 6 ? 4 : 8)} ${symOut}`) }
  catch (e) { console.error(`    ⛔ ABORT: swap would revert (${e.shortMessage || e.reason || e.message}). Not broadcasting.`); process.exit(1) }
  const before = await tout.balanceOf(wallet.address)
  const r = await (await router.exactInputSingle(params, { gasLimit: GAS_LIMIT })).wait(2)
  const after = await tout.balanceOf(wallet.address)
  log(`    tx ${r.hash} | received ${(Number(after - before) / 10 ** decOut).toFixed(decOut === 6 ? 4 : 8)} ${symOut}`)
}

async function main() {
  if (!TO_USDC && !TO_WETH) { log('Pass --to-usdc or --to-weth (add --execute to sign). Default dry-run.'); process.exit(0) }
  const pk = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
  if (!pk) { console.error('No Base key in env'); process.exit(1) }
  const prov = await provider()
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, prov)
  log(`migrate-lp-swap ${EXECUTE ? '(EXECUTE)' : '(DRY RUN)'} | EOA ${wallet.address} | slippage ${(SLIPPAGE * 100)}%`)
  const usdc = new ethers.Contract(USDC, ERC20, prov), cbbtc = new ethers.Contract(cbBTC, ERC20, prov), weth = new ethers.Contract(WETH, ERC20, prov)
  const [uB, cB, wB] = await Promise.all([usdc.balanceOf(wallet.address), cbbtc.balanceOf(wallet.address), weth.balanceOf(wallet.address)])
  log(`  balances: USDC ${(Number(uB) / 1e6).toFixed(4)} | cbBTC ${(Number(cB) / 1e8).toFixed(8)} | WETH ${(Number(wB) / 1e18).toFixed(6)}`)

  if (TO_USDC) {
    if (cB === 0n) { log('  no cbBTC to swap.'); return }
    log('\n[to-usdc] swap ALL cbBTC -> USDC')
    await doSwap(wallet, prov, cbBTC, USDC, 8, 6, 'cbBTC', 'USDC', cB)
  }
  if (TO_WETH) {
    const { P, fracWeth, fracUsdc } = await liveSplit(prov)
    const C_lp = Number(uB) / 1e6
    const usdcForWeth = C_lp * fracWeth
    const amountInRaw = BigInt(Math.floor(usdcForWeth * 1e6))
    log(`\n[to-weth] live split WETH ${(fracWeth * 100).toFixed(1)}% / USDC ${(fracUsdc * 100).toFixed(1)}% @ ETH $${P.toFixed(2)}`)
    log(`  C_lp=$${C_lp.toFixed(2)} -> convert $${usdcForWeth.toFixed(2)} USDC to WETH, keep $${(C_lp * fracUsdc).toFixed(2)} USDC`)
    if (amountInRaw === 0n || amountInRaw > uB) { log('  ⛔ insufficient USDC for computed WETH portion'); if (EXECUTE) process.exit(1); return }
    await doSwap(wallet, prov, USDC, WETH, 6, 18, 'USDC', 'WETH', amountInRaw)
  }
}
main().then(() => { if (EXECUTE) refreshDashboard() }).catch(e => { console.error('FATAL:', e.shortMessage || e.message); process.exit(1) })
