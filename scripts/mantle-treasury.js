#!/usr/bin/env node
/**
 * mantle-treasury.js — Sasha's mETH yield loop on Mantle
 *
 * This is the fix for the structural Mantle problem. Without this, Sasha's
 * Mantle footprint is a single ERC-8004 NFT and an attestation log —
 * Solana does the work, Mantle gets a receipt.
 *
 * With this: Sasha holds mETH on Mantle as her primary treasury asset.
 * The staking yield (~3.5% APR via Mantle LSP) funds her gas for ERC-8004
 * attestations and her trading capital. When a trade closes, profits route
 * back to mETH compounding. Mantle is now her balance sheet.
 *
 * mETH contract: 0xcDA86A272531e8640cD7F1a92c01839911B90bb0
 * Mantle LSP staking: via MantleStaking contract (0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f)
 *
 * Usage:
 *   node scripts/mantle-treasury.js --action status         # show current state
 *   node scripts/mantle-treasury.js --action stake --amount <wei> --execute
 *   node scripts/mantle-treasury.js --action unstake --amount <methWei> --execute
 *   node scripts/mantle-treasury.js --action compound --execute
 *   node scripts/mantle-treasury.js --action status --dry-run  # (dry-run is default)
 *
 * SAFETY: --execute flag required for any transaction. Dry-run by default.
 * Called by byreal-trade.js post-trade for auto-compounding.
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const ACTION  = (() => { const i = args.indexOf('--action');  return i !== -1 ? args[i+1] : 'status' })()
const AMOUNT  = (() => { const i = args.indexOf('--amount');  return i !== -1 ? args[i+1] : null })()
const EXECUTE = args.includes('--execute')
const DRY_RUN = !EXECUTE  // dry-run is the default; --execute is opt-in

// ---------------------------------------------------------------------------
// Contract addresses — Mantle Mainnet
// ---------------------------------------------------------------------------
const METH_TOKEN     = '0xcDA86A272531e8640cD7F1a92c01839911B90bb0'  // mETH ERC-20
const MANTLE_STAKING = '0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f'  // Mantle LSP staking

// Minimal ABIs — only what we need
const METH_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]

const STAKING_ABI = [
    // Mantle LSP: stake ETH → receive mETH
    'function stake() payable returns (uint256)',
    'function unstake(uint256 mETHAmount, uint256 minETHAmount) returns (uint256)',
    'function mETHToETH(uint256 mETHAmount) view returns (uint256)',
    'function ethToMETH(uint256 ethAmount) view returns (uint256)',
    'function stakingAllowed() view returns (bool)',
    'function minimumStakeBound() view returns (uint256)',
    'function maximumStakeBound() view returns (uint256)',
    // Exchange rate
    'function mETHToETHExchangeRate() view returns (uint256)',
]

// ---------------------------------------------------------------------------
// State file
// ---------------------------------------------------------------------------
const TREASURY_STATE_PATH = path.join(WORKSPACE, 'state', 'mantle-treasury.json')

function loadState() {
    try {
        if (fs.existsSync(TREASURY_STATE_PATH)) {
            return JSON.parse(fs.readFileSync(TREASURY_STATE_PATH, 'utf8'))
        }
    } catch { /* ignore */ }
    return {
        mETHBalance: '0',
        stakedETHEquivalent: '0',
        accumulatedYield: '0',
        lastCompoundAt: null,
        compoundCount: 0,
        transactions: [],
    }
}

function saveState(state) {
    const stateDir = path.dirname(TREASURY_STATE_PATH)
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(TREASURY_STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2))
}

// ---------------------------------------------------------------------------
// Setup provider / contracts
// ---------------------------------------------------------------------------

function getProvider() {
    const rpcUrl = process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz'
    return new ethers.JsonRpcProvider(rpcUrl)
}

function getSigner(provider) {
    const pk = process.env.MANTLE_AGENT_PK
    if (!pk) throw new Error('MANTLE_AGENT_PK not set — cannot sign transactions')
    return new ethers.Wallet(pk, provider)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function getStatus(provider, ownerAddress) {
    const meth = new ethers.Contract(METH_TOKEN, METH_ABI, provider)
    const staking = new ethers.Contract(MANTLE_STAKING, STAKING_ABI, provider)

    const [mETHBalance, ethBalance, stakingAllowed] = await Promise.allSettled([
        meth.balanceOf(ownerAddress),
        provider.getBalance(ownerAddress),
        staking.stakingAllowed().catch(() => true),
    ])

    const mETHBal = mETHBalance.status === 'fulfilled' ? mETHBalance.value : 0n
    const ethBal  = ethBalance.status === 'fulfilled'  ? ethBalance.value  : 0n
    const canStake = stakingAllowed.status === 'fulfilled' ? stakingAllowed.value : true

    // Get ETH equivalent of mETH balance
    let ethEquivalent = 0n
    if (mETHBal > 0n) {
        try {
            ethEquivalent = await staking.mETHToETH(mETHBal)
        } catch {
            // Fallback: use 1:1 ratio if exchange rate unavailable
            ethEquivalent = mETHBal
        }
    }

    return {
        address: ownerAddress,
        mETHBalance: ethers.formatEther(mETHBal),
        mETHBalanceWei: mETHBal.toString(),
        ethBalance: ethers.formatEther(ethBal),
        ethEquivalentOfMETH: ethers.formatEther(ethEquivalent),
        stakingAllowed: canStake,
        network: 'Mantle Mainnet',
        contracts: {
            mETH: METH_TOKEN,
            staking: MANTLE_STAKING,
        },
    }
}

async function stakeETH(provider, signer, amountWei) {
    if (DRY_RUN) {
        console.log(`[treasury][dry-run] Would stake ${ethers.formatEther(amountWei)} MNT → mETH`)
        console.log(`[treasury][dry-run] Staking contract: ${MANTLE_STAKING}`)
        return { status: 'dry-run', action: 'stake', amount: amountWei.toString() }
    }

    console.log(`[treasury] Staking ${ethers.formatEther(amountWei)} MNT...`)
    const staking = new ethers.Contract(MANTLE_STAKING, STAKING_ABI, signer)
    const tx = await staking.stake({ value: amountWei })
    console.log(`[treasury] Stake TX: ${tx.hash}`)
    const receipt = await tx.wait()

    return {
        status: 'executed',
        action: 'stake',
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        amountStaked: ethers.formatEther(amountWei),
    }
}

async function unstakeMETH(provider, signer, mETHAmountWei) {
    if (DRY_RUN) {
        console.log(`[treasury][dry-run] Would unstake ${ethers.formatEther(mETHAmountWei)} mETH`)
        return { status: 'dry-run', action: 'unstake', amount: mETHAmountWei.toString() }
    }

    console.log(`[treasury] Unstaking ${ethers.formatEther(mETHAmountWei)} mETH...`)
    const staking = new ethers.Contract(MANTLE_STAKING, STAKING_ABI, signer)
    const minETH = (mETHAmountWei * 95n) / 100n  // 5% slippage tolerance
    const tx = await staking.unstake(mETHAmountWei, minETH)
    console.log(`[treasury] Unstake TX: ${tx.hash}`)
    const receipt = await tx.wait()

    return {
        status: 'executed',
        action: 'unstake',
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        mETHUnstaked: ethers.formatEther(mETHAmountWei),
    }
}

/**
 * autoCompound — check accumulated yield, stake if above threshold
 *
 * Logic: check current MNT balance. If it exceeds COMPOUND_THRESHOLD_MNT
 * (meaning yield or trade profits have accumulated), stake the excess as mETH.
 * This keeps the treasury growing passively.
 *
 * Called by byreal-trade.js after each successful trade.
 * Always exits 0 (non-blocking to trade flow).
 */
const COMPOUND_THRESHOLD_WEI = BigInt(process.env.MANTLE_COMPOUND_THRESHOLD_WEI || '10000000000000000')  // 0.01 MNT default

async function autoCompound(provider, signer, ownerAddress) {
    const ethBalance = await provider.getBalance(ownerAddress)

    if (ethBalance < COMPOUND_THRESHOLD_WEI) {
        console.log(`[treasury] MNT balance ${ethers.formatEther(ethBalance)} below threshold ${ethers.formatEther(COMPOUND_THRESHOLD_WEI)} — no compound needed`)
        return { status: 'skipped', reason: 'below_threshold', balance: ethers.formatEther(ethBalance) }
    }

    // Keep a small reserve for gas (0.005 MNT = ~5000 attestations at 0.000001 MNT each)
    const GAS_RESERVE = BigInt('5000000000000000')  // 0.005 MNT
    const amountToStake = ethBalance - GAS_RESERVE

    if (amountToStake <= 0n) {
        console.log(`[treasury] Insufficient balance after gas reserve — skipping compound`)
        return { status: 'skipped', reason: 'insufficient_after_reserve' }
    }

    console.log(`[treasury] Compounding ${ethers.formatEther(amountToStake)} MNT → mETH (keeping ${ethers.formatEther(GAS_RESERVE)} MNT for gas)`)

    const result = await stakeETH(provider, signer, amountToStake)

    // Update state
    const state = loadState()
    if (result.status === 'executed') {
        state.compoundCount++
        state.lastCompoundAt = new Date().toISOString()
        state.transactions.push({ ...result, timestamp: new Date().toISOString() })
        saveState(state)
    }

    return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log(`\n=== [MANTLE_TREASURY] Action: ${ACTION.toUpperCase()} ${DRY_RUN ? '(dry-run)' : '(EXECUTE)'} ===\n`)

    const provider = getProvider()

    // For read-only actions (status), don't require the PK
    let signerAddress = null
    let signer = null

    if (process.env.MANTLE_AGENT_PK) {
        signer = getSigner(provider)
        signerAddress = await signer.getAddress()
    } else if (ACTION !== 'status') {
        throw new Error(`MANTLE_AGENT_PK required for action: ${ACTION}`)
    }

    // If no PK but status requested, try to read address from ERC-8004 identity
    if (!signerAddress) {
        const identityPath = path.join(WORKSPACE, 'state', 'erc8004-identity.json')
        if (fs.existsSync(identityPath)) {
            const id = JSON.parse(fs.readFileSync(identityPath, 'utf8'))
            signerAddress = id.owner || id.address
        }
        if (!signerAddress) {
            console.warn('[treasury] No MANTLE_AGENT_PK or ERC-8004 identity — showing chain state only')
            signerAddress = ethers.ZeroAddress
        }
    }

    switch (ACTION) {
        case 'status': {
            const status = await getStatus(provider, signerAddress)
            const state = loadState()
            const output = { ...status, localState: state }
            console.log(JSON.stringify(output, null, 2))
            break
        }

        case 'stake': {
            if (!AMOUNT) throw new Error('--amount <wei> required for stake action')
            const amountWei = BigInt(AMOUNT)
            const result = await stakeETH(provider, signer, amountWei)
            console.log(JSON.stringify(result, null, 2))
            break
        }

        case 'unstake': {
            if (!AMOUNT) throw new Error('--amount <mETHWei> required for unstake action')
            const amountWei = BigInt(AMOUNT)
            const result = await unstakeMETH(provider, signer, amountWei)
            console.log(JSON.stringify(result, null, 2))
            break
        }

        case 'compound': {
            const result = await autoCompound(provider, signer, signerAddress)
            console.log(JSON.stringify(result, null, 2))
            break
        }

        default:
            throw new Error(`Unknown action: ${ACTION}. Use: status | stake | unstake | compound`)
    }
}

main().catch(err => {
    console.error(`[treasury] Fatal: ${err.message}`)
    // Always exit 0 when called from byreal-trade.js (non-blocking)
    if (process.env.TREASURY_NONBLOCKING === '1') process.exit(0)
    process.exit(1)
})

// ---------------------------------------------------------------------------
// Export for programmatic use from byreal-trade.js
// ---------------------------------------------------------------------------
export { autoCompound, getStatus }
