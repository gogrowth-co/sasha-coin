#!/usr/bin/env node
/**
 * lp-stake-gauge.js — One-off NFT gauge staker
 *
 * Stakes an existing Aerodrome Slipstream NFT in the pool's gauge so the
 * position earns AERO emissions in addition to trading fees.
 *
 * Reads first open position from state/lp-positions.json that has
 * project=aerodrome-slipstream and a non-null nftTokenId.
 *
 * Idempotent: if the NFT is already deposited in the gauge, this will fail
 * gracefully with the error printed.
 *
 * Sasha Coin — Liquidity Miner v1
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// Load .env (same as lp-opener.js)
;(() => {
    const candidates = ['/data/.openclaw/.env', path.resolve(WORKSPACE, '..', '.env'), path.resolve(WORKSPACE, '.env')]
    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
            if (!m) continue
            const [, key, rawVal] = m
            if (process.env[key]) continue
            let val = rawVal.trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
            process.env[key] = val
        }
        break
    }
})()

const AERO_NFT_MGR = '0x827922686190790b37229fd06084350E74485b72'
const AERO_VOTER   = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5'

const NFT_MGR_ABI = ['function approve(address to, uint256 tokenId)']
const VOTER_ABI   = ['function gauges(address pool) view returns (address)']
const GAUGE_ABI   = ['function deposit(uint256 tokenId) external']

async function main() {
    const store = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'state', 'lp-positions.json'), 'utf8'))
    const position = store.positions.find(p => p.project === 'aerodrome-slipstream' && p.nftTokenId && p.status === 'open')
    if (!position) {
        console.log('No open Aerodrome position with tokenId found')
        process.exit(0)
    }
    console.log(`Position: ${position.id} | tokenId: ${position.nftTokenId} | pool: ${position.poolAddress}`)

    const rpc = process.env.ALCHEMY_BASE_RPC || 'https://mainnet.base.org'
    const pk  = process.env.AGENT_PRIVATE_KEY || process.env.MANTLE_AGENT_PK
    if (!pk) { console.error('No private key in env'); process.exit(1) }

    const provider = new ethers.JsonRpcProvider(rpc, undefined, { batchMaxCount: 1 })
    const wallet   = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider)
    console.log(`Agent EOA: ${wallet.address}`)

    const voter = new ethers.Contract(AERO_VOTER, VOTER_ABI, provider)
    const gaugeAddr = await voter.gauges(position.poolAddress)
    if (!gaugeAddr || gaugeAddr === ethers.ZeroAddress) {
        console.log('No active gauge for this pool — nothing to do')
        process.exit(0)
    }
    console.log(`Gauge: ${gaugeAddr}`)

    const nftMgr = new ethers.Contract(AERO_NFT_MGR, NFT_MGR_ABI, wallet)
    const gauge  = new ethers.Contract(gaugeAddr,   GAUGE_ABI,   wallet)

    console.log('Approving NFT for gauge...')
    await (await nftMgr.approve(gaugeAddr, position.nftTokenId)).wait(2)

    console.log('Depositing NFT into gauge...')
    const tx = await gauge.deposit(position.nftTokenId)
    const receipt = await tx.wait(2)
    console.log(`✅ Staked! Tx: ${receipt.hash}`)

    // Update state
    position.gaugeAddress = gaugeAddr
    position.stakedAt = new Date().toISOString()
    position.stakeTxHash = receipt.hash
    fs.writeFileSync(path.join(WORKSPACE, 'state', 'lp-positions.json'), JSON.stringify(store, null, 2))
    console.log('State updated with gauge info')
}

main().catch(e => {
    console.error('Fatal:', e.shortMessage || e.message)
    process.exit(1)
})
