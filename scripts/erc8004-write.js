#!/usr/bin/env node
/**
 * erc8004-write.js — Write trade feedback to ERC-8004 reputation layer
 *
 * Called by byreal-trade.js after each trade execution (best-effort, non-blocking).
 * Verifies Sasha's on-chain agent identity is still live, then records the trade
 * action as a structured event on Mantle.
 *
 * How reputation works:
 *   ERC-8004 Identity NFTs are on-chain permanent records. We extend the pattern
 *   by calling the registry to verify ownership and logging a structured "trade
 *   attestation" event. This creates a timestamped Mantle tx for every trade —
 *   the on-chain audit trail that judges can verify.
 *
 *   If a ReputationRegistry is later available on Mantle, swap the call below.
 *
 * Usage:
 *   node scripts/erc8004-write.js --action OPEN_LP_POSITION --pool SOL/USDC --apr 73.1 --tx <solana-sig>
 *   node scripts/erc8004-write.js --dry-run [--action ...] [--pool ...] [--apr ...] [--tx ...]
 *
 * Exits 0 always (non-blocking). Failures are logged as warnings.
 *
 * Requires:
 *   MANTLE_AGENT_PK   — private key for the registered Mantle EOA
 *   MANTLE_RPC_URL    — Mantle RPC endpoint
 *
 * state/erc8004-identity.json must contain 'mantle-agentId' (set by erc8004-register.js)
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ACTION = (() => { const i = args.indexOf('--action'); return i !== -1 ? args[i + 1] : 'UNKNOWN' })()
const POOL = (() => { const i = args.indexOf('--pool'); return i !== -1 ? args[i + 1] : '' })()
const APR = (() => { const i = args.indexOf('--apr'); return i !== -1 ? parseFloat(args[i + 1]) : null })()
const TX_SIG = (() => { const i = args.indexOf('--tx'); return i !== -1 ? args[i + 1] : '' })()
const CHAIN = (() => { const i = args.indexOf('--chain'); return i !== -1 ? args[i + 1] : 'mantle' })()

// ---------------------------------------------------------------------------
// Chain config
// ---------------------------------------------------------------------------
const CHAIN_CONFIG = {
    mantle: {
        rpc: process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
        chainId: 5000,
        name: 'Mantle',
        explorer: 'https://explorer.mantle.xyz',
    },
    'mantle-testnet': {
        rpc: process.env.MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
        chainId: 5003,
        name: 'Mantle Sepolia',
        explorer: 'https://explorer.sepolia.mantle.xyz',
    },
}

const IDENTITY_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'

const IDENTITY_REGISTRY_ABI = [
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    // TradeAttestation: emitted by calling a no-op read while indexers watch for the extra data
    // We use eth_call with a custom data field for gas-free "events" on Mantle
]

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------
const IDENTITY_STATE_PATH = path.join(WORKSPACE, 'state', 'erc8004-identity.json')

function loadIdentityState() {
    try {
        if (!fs.existsSync(IDENTITY_STATE_PATH)) return {}
        return JSON.parse(fs.readFileSync(IDENTITY_STATE_PATH, 'utf8'))
    } catch {
        return {}
    }
}

function saveIdentityState(state) {
    try {
        fs.writeFileSync(IDENTITY_STATE_PATH, JSON.stringify(state, null, 2))
    } catch (e) {
        console.warn(`[erc8004-write] Could not save state: ${e.message}`)
    }
}

// ---------------------------------------------------------------------------
// Build trade attestation data
// The attestation is a structured JSON payload included as tx.data in a
// self-transfer (0 MNT to self). This creates an immutable Mantle record.
// ---------------------------------------------------------------------------
function buildAttestationData(agentId, action, pool, apr, solanaTxSig) {
    const attestation = {
        v: 1,
        type: 'trade-attestation',
        agentId,
        action,
        pool: pool || null,
        apr: apr || null,
        solanaTx: solanaTxSig || null,
        solscanUrl: solanaTxSig ? `https://solscan.io/tx/${solanaTxSig}` : null,
        executedAt: new Date().toISOString(),
        agent: 'Sasha Coin',
        agentX: '@SashaCoin95',
        hackathon: 'Mantle Turing Test 2026',
        track: 'Agentic Wallets & Economy',
    }
    // Encode as hex data field: 0x + utf8 bytes of JSON
    const jsonBytes = Buffer.from(JSON.stringify(attestation), 'utf8')
    return '0x' + jsonBytes.toString('hex')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const chain = CHAIN_CONFIG[CHAIN]
    if (!chain) {
        console.warn(`[erc8004-write] Unknown chain: ${CHAIN} — skipping`)
        process.exit(0)
    }

    const identityState = loadIdentityState()
    const agentId = identityState[`${CHAIN}-agentId`]

    // In dry-run mode, use a placeholder agentId so we can test the encoding
    if (DRY_RUN) {
        const testAgentId = agentId || 999
        const data = buildAttestationData(testAgentId, ACTION, POOL, APR, TX_SIG)
        console.log('[erc8004-write] --- DRY RUN ---')
        console.log(`[erc8004-write] agentId: ${testAgentId}${!agentId ? ' (placeholder — run erc8004-register.js first)' : ''}`)
        console.log('[erc8004-write] Attestation data (hex preview):', data.slice(0, 80) + '...')
        try {
            const decoded = JSON.parse(Buffer.from(data.slice(2), 'hex').toString('utf8'))
            console.log('[erc8004-write] Decoded attestation:', JSON.stringify(decoded, null, 2))
        } catch { /* ignore */ }
        process.exit(0)
    }

    if (!agentId) {
        console.warn(`[erc8004-write] No agentId found in state for chain ${CHAIN}.`)
        console.warn('[erc8004-write] Run: node scripts/erc8004-register.js first')
        console.warn('[erc8004-write] Skipping reputation write (non-blocking).')
        process.exit(0)
    }

    const privateKey = process.env.MANTLE_AGENT_PK
    if (!privateKey) {
        console.warn('[erc8004-write] MANTLE_AGENT_PK not set — skipping Mantle attestation.')
        process.exit(0)
    }

    console.log(`[erc8004-write] Writing trade attestation for Agent #${agentId} on ${chain.name}`)
    console.log(`[erc8004-write] Action: ${ACTION} | Pool: ${POOL || 'N/A'} | APR: ${APR || 'N/A'}%`)

    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc, {
            chainId: chain.chainId,
            name: chain.name,
        })
        const wallet = new ethers.Wallet(privateKey, provider)

        // Verify identity still owned by our wallet
        const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, provider)
        let owner
        try {
            owner = await registry.ownerOf(agentId)
        } catch (e) {
            console.warn(`[erc8004-write] ownerOf(${agentId}) failed: ${e.message}`)
            console.warn('[erc8004-write] Registry may not support this call — continuing with attestation tx')
        }

        if (owner && owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.warn(`[erc8004-write] Agent NFT #${agentId} owned by ${owner}, not ${wallet.address}`)
            console.warn('[erc8004-write] Still sending attestation tx as the agent wallet.')
        }

        // Check MNT balance (need a tiny amount for gas)
        const balance = await provider.getBalance(wallet.address)
        const balanceMNT = parseFloat(ethers.formatEther(balance))
        if (balanceMNT < 0.0001) {
            console.warn(`[erc8004-write] Low MNT balance (${balanceMNT}) — skipping attestation tx to avoid failure.`)
            process.exit(0)
        }

        // Build attestation data
        const attestationData = buildAttestationData(agentId, ACTION, POOL, APR, TX_SIG)

        // Send a 0-value tx to self with attestation as data
        // This is gas-efficient and creates an immutable on-chain record on Mantle
        const tx = await wallet.sendTransaction({
            to: wallet.address,      // self-transfer
            value: 0n,
            data: attestationData,
            gasLimit: 50000n,        // minimal gas for data storage
        })

        console.log(`[erc8004-write] ✅ Attestation tx: ${tx.hash}`)
        console.log(`[erc8004-write] Explorer: ${chain.explorer}/tx/${tx.hash}`)

        // Don't wait for confirmation — we're non-blocking
        // Update state with the last attestation tx
        const updatedState = {
            ...identityState,
            [`${CHAIN}-lastAttestationTx`]: tx.hash,
            [`${CHAIN}-lastAttestationAt`]: new Date().toISOString(),
            [`${CHAIN}-lastAction`]: ACTION,
        }
        saveIdentityState(updatedState)

        // Return the tx hash so byreal-trade.js can include it in the trade log
        process.stdout.write(JSON.stringify({ txHash: tx.hash, explorerUrl: `${chain.explorer}/tx/${tx.hash}` }) + '\n')

    } catch (e) {
        console.warn(`[erc8004-write] Non-fatal error: ${e.message}`)
        console.warn('[erc8004-write] Skipping Mantle attestation — trade was already executed on Solana.')
    }

    process.exit(0) // always exit 0 — non-blocking
}

main().catch(err => {
    console.warn(`[erc8004-write] Caught fatal error: ${err.message}`)
    process.exit(0) // still exit 0 — non-blocking
})
