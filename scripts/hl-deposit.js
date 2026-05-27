#!/usr/bin/env node
/**
 * hl-deposit.js — Fund Sasha's Hyperliquid account from her Arbitrum wallet.
 *
 * Hyperliquid mainnet deposits are Arbitrum-only: a plain native-USDC ERC20
 * transfer to the Bridge2 contract credits the SENDER's HL account in <1 min.
 * So Sasha's own wallet (HL_WALLET_ADDRESS) must send the USDC — funding it
 * from Gabriel first, then bridging from it, keeps her HL account self-custodial.
 *
 * HARD GUARDRAILS:
 *   - Minimum 5 USDC enforced (HL burns anything less — "lost forever").
 *   - Dry-run by default; only sends with --execute AND HEDGE_LIVE_OK=1.
 *   - Verifies USDC + ETH balance before sending; refuses if short.
 *
 * Usage:
 *   node scripts/hl-deposit.js                      # dry-run: show balances + planned bridge tx
 *   node scripts/hl-deposit.js --amount 20          # plan a 20 USDC bridge deposit
 *   node scripts/hl-deposit.js --amount 20 --execute # LIVE bridge deposit (needs HEDGE_LIVE_OK=1)
 *
 * Sasha Coin — Liquidity Miner Phase 3
 */
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve(__dirname, '..')

function loadEnv() {
  const p = path.join(WORKSPACE, '.env')
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnv()

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const AMOUNT = (() => { const i = args.indexOf('--amount'); return i >= 0 ? parseFloat(args[i + 1]) : null })()

const ARB_RPCS = ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.llamarpc.com']
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' // native Arbitrum USDC (NOT USDC.e)
const BRIDGE2 = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7' // Hyperliquid Bridge2 (Arbitrum mainnet)
const MIN_DEPOSIT = 5
const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)', 'function decimals() view returns (uint8)']

async function provider() {
  for (const u of ARB_RPCS) { try { const p = new ethers.JsonRpcProvider(u); await p.getBlockNumber(); return p } catch { /* next */ } }
  throw new Error('all Arbitrum RPCs failed')
}

async function main() {
  const addr = process.env.HL_WALLET_ADDRESS
  const pk = process.env.HL_PRIVATE_KEY
  if (!addr || !pk) throw new Error('HL_WALLET_ADDRESS / HL_PRIVATE_KEY missing in .env')
  const p = await provider()
  const usdc = new ethers.Contract(USDC, ERC20, p)
  const [usdcRaw, ethRaw] = await Promise.all([usdc.balanceOf(addr), p.getBalance(addr)])
  const usdcBal = Number(usdcRaw) / 1e6
  const ethBal = Number(ethRaw) / 1e18
  console.log(`HL wallet (Arbitrum): ${addr}`)
  console.log(`  USDC: ${usdcBal}  |  ETH(gas): ${ethBal.toFixed(6)}`)
  console.log(`  Bridge2: ${BRIDGE2}  (min deposit ${MIN_DEPOSIT} USDC — less is BURNED)`)

  const amount = AMOUNT ?? usdcBal
  if (amount < MIN_DEPOSIT) { console.log(`\n⛔ amount ${amount} < ${MIN_DEPOSIT} USDC minimum — refusing (would be lost forever)`); return }
  if (amount > usdcBal) { console.log(`\n⏳ wallet holds ${usdcBal} USDC, need ${amount}. Fund 0xFAef… on Arbitrum first.`); return }
  if (ethBal < 0.00005) { console.log(`\n⏳ ETH gas too low (${ethBal}). Send a little ETH to ${addr} on Arbitrum.`); return }

  console.log(`\nPLAN: transfer ${amount} USDC -> Bridge2 (credits HL account ${addr})`)
  if (!EXECUTE) { console.log('  (dry-run — add --execute + HEDGE_LIVE_OK=1 to send)'); return }
  if (process.env.HEDGE_LIVE_OK !== '1') { console.log('  ⛔ HEDGE_LIVE_OK != 1 — refusing live send'); return }

  const wallet = new ethers.Wallet(pk, p)
  const usdcW = new ethers.Contract(USDC, ERC20, wallet)
  const tx = await usdcW.transfer(BRIDGE2, BigInt(Math.round(amount * 1e6)))
  console.log(`  sent: ${tx.hash}`)
  const rc = await tx.wait()
  console.log(`  confirmed in block ${rc.blockNumber}. HL account credits in <1 min.`)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
