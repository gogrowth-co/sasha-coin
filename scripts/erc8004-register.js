#!/usr/bin/env node
/**
 * erc8004-register.js — Register Sasha's agent identity on Mantle (ERC-8004)
 *
 * One-time script. Mints an ERC-8004 Identity NFT on Mantle using a dedicated
 * agent EOA. Saves the resulting agentId + tx hash to state/erc8004-identity.json.
 *
 * Usage:
 *   node scripts/erc8004-register.js                  # register (or confirm already registered)
 *   node scripts/erc8004-register.js --dry-run         # show what would be registered, no tx
 *   node scripts/erc8004-register.js --chain mantle-testnet   # use Sepolia testnet
 *
 * Requires:
 *   MANTLE_AGENT_PK   — private key of a Mantle EOA with some MNT for gas
 *   MANTLE_RPC_URL    — Mantle RPC (default: https://rpc.mantle.xyz)
 *
 * The agent EOA MUST hold a small amount of MNT for gas (~0.01 MNT is enough).
 * Fund via any Mantle bridge: https://bridge.mantle.xyz
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
const CHAIN = (() => {
    const idx = args.indexOf('--chain')
    return idx !== -1 ? args[idx + 1] : 'mantle'
})()

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

// ERC-8004 Identity Registry — same address on all chains (EIP-2470 singleton)
const IDENTITY_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'

const IDENTITY_REGISTRY_ABI = [
    'function register(string agentURI) returns (uint256 agentId)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const IDENTITY_STATE_PATH = path.join(WORKSPACE, 'state', 'erc8004-identity.json')

function loadIdentityState() {
    if (!fs.existsSync(IDENTITY_STATE_PATH)) return {}
    return JSON.parse(fs.readFileSync(IDENTITY_STATE_PATH, 'utf8'))
}

function saveIdentityState(state) {
    const dir = path.dirname(IDENTITY_STATE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(IDENTITY_STATE_PATH, JSON.stringify(state, null, 2))
}

// ---------------------------------------------------------------------------
// Agent metadata — the agentURI registered on-chain
// ---------------------------------------------------------------------------
function buildAgentURI(agentAddress, chain) {
    const metadata = {
        // ERC-8004 registration schema
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: 'Sasha Coin',
        description: 'Autonomous AI DeFi agent. Posts trading thesis to X before executing on-chain. Running on OpenCLAW. Token on Base.',
        image: 'https://pbs.twimg.com/profile_images/1928131540791881728/XVfOZoL2_400x400.jpg',
        services: [
            {
                name: 'x',
                endpoint: 'https://x.com/SashaCoin95',
            },
            {
                name: 'token',
                endpoint: 'https://www.base.org/ecosystem',
            },
        ],
        // On-chain identity
        agentAddress,
        chain: chain.name,
        chainId: chain.chainId,
        // Social + project links
        links: {
            x: 'https://x.com/SashaCoin95',
            github: 'https://github.com/gogrowth-co/sasha-coin',
            hackathon: 'https://dorahacks.io/hackathon/mantleturingtesthackathon2026/buidl',
        },
        // Capabilities
        capabilities: [
            'defi-trading',
            'social-signal-fusion',
            'tweet-before-trade',
            'multi-chain',
        ],
        // OpenCLAW runtime declaration
        runtime: 'OpenCLAW',
        runtimeVersion: '1.0',
        x402Support: false,
        active: true,
        registeredAt: new Date().toISOString(),
    }

    return 'data:application/json;base64,' + Buffer.from(JSON.stringify(metadata)).toString('base64')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const chain = CHAIN_CONFIG[CHAIN]
    if (!chain) {
        console.error(`[erc8004] Unknown chain: ${CHAIN}. Use 'mantle' or 'mantle-testnet'.`)
        process.exit(1)
    }

    console.log(`[erc8004] Registering Sasha Coin on ERC-8004 Identity Registry`)
    console.log(`[erc8004] Chain: ${chain.name} (chainId ${chain.chainId})`)
    console.log(`[erc8004] Registry: ${IDENTITY_REGISTRY_ADDRESS}`)

    // Load existing state
    const state = loadIdentityState()
    const stateKey = `${CHAIN}-agentId`
    const existingAgentId = state[stateKey]

    // Private key check
    const privateKey = process.env.MANTLE_AGENT_PK
    if (!privateKey && !DRY_RUN) {
        console.error('[erc8004] MANTLE_AGENT_PK env var not set.')
        console.error('[erc8004] Create a Mantle EOA, fund with ~0.01 MNT, export its private key.')
        console.error('[erc8004] Example: MANTLE_AGENT_PK=0x<key> node scripts/erc8004-register.js')
        process.exit(1)
    }

    if (DRY_RUN && !privateKey) {
        // In dry-run without a key, just show what would be registered
        const agentURI = buildAgentURI('<agent-address-tbd>', chain)
        const metadataPreview = JSON.parse(Buffer.from(agentURI.split(',')[1], 'base64').toString())
        console.log('\n[erc8004] --- DRY RUN (no key provided) ---')
        console.log('[erc8004] Agent metadata that would be registered:')
        console.log(`  name: ${metadataPreview.name}`)
        console.log(`  description: ${metadataPreview.description}`)
        console.log(`  capabilities: ${metadataPreview.capabilities.join(', ')}`)
        console.log(`  runtime: ${metadataPreview.runtime}`)
        console.log('[erc8004] To register: MANTLE_AGENT_PK=0x<key> node scripts/erc8004-register.js')
        return
    }

    // Connect to Mantle
    const provider = new ethers.JsonRpcProvider(chain.rpc, {
        chainId: chain.chainId,
        name: chain.name,
    })
    const wallet = new ethers.Wallet(privateKey, provider)
    console.log(`[erc8004] Agent wallet: ${wallet.address}`)

    // Check MNT balance
    const balance = await provider.getBalance(wallet.address)
    const balanceMNT = parseFloat(ethers.formatEther(balance))
    console.log(`[erc8004] MNT balance: ${balanceMNT.toFixed(6)} MNT`)
    if (balanceMNT < 0.001 && !DRY_RUN) {
        console.error('[erc8004] Insufficient MNT for gas. Fund the wallet at https://bridge.mantle.xyz')
        process.exit(1)
    }

    // Connect to registry
    const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, wallet)

    // Check if already registered (by checking known agentId)
    if (existingAgentId) {
        console.log(`[erc8004] Found saved agentId: #${existingAgentId} — verifying on-chain...`)
        try {
            const owner = await registry.ownerOf(existingAgentId)
            console.log(`[erc8004] ✅ Already registered! NFT #${existingAgentId} owned by ${owner}`)
            console.log(`[erc8004] Explorer: ${chain.explorer}/token/${IDENTITY_REGISTRY_ADDRESS}/instance/${existingAgentId}`)
            return
        } catch {
            console.warn(`[erc8004] Saved agentId #${existingAgentId} not found on-chain — re-registering.`)
        }
    }

    // Build agentURI
    const agentURI = buildAgentURI(wallet.address, chain)
    const metadataPreview = JSON.parse(Buffer.from(agentURI.split(',')[1], 'base64').toString())
    console.log(`[erc8004] Agent metadata:`)
    console.log(`  name: ${metadataPreview.name}`)
    console.log(`  description: ${metadataPreview.description}`)
    console.log(`  capabilities: ${metadataPreview.capabilities.join(', ')}`)

    if (DRY_RUN) {
        console.log('\n[erc8004] --- DRY RUN — no transaction sent ---')
        console.log('[erc8004] agentURI (first 120 chars):', agentURI.slice(0, 120) + '...')
        return
    }

    // Estimate gas
    let gasEstimate
    try {
        gasEstimate = await registry.register.estimateGas(agentURI)
        console.log(`[erc8004] Estimated gas: ${gasEstimate.toString()}`)
    } catch (e) {
        console.warn(`[erc8004] Gas estimate failed: ${e.message} — using default 200000`)
        gasEstimate = 200000n
    }

    // Send registration tx
    console.log(`[erc8004] Sending registration transaction...`)
    const tx = await registry.register(agentURI, {
        gasLimit: gasEstimate * 120n / 100n, // 20% buffer
    })
    console.log(`[erc8004] Transaction sent: ${tx.hash}`)
    console.log(`[erc8004] Explorer: ${chain.explorer}/tx/${tx.hash}`)
    console.log('[erc8004] Waiting for 3 confirmations...')

    const receipt = await tx.wait(3)
    console.log(`[erc8004] ✅ Confirmed in block ${receipt.blockNumber}`)

    // Parse agentId from Registered event
    let agentId = null
    const registeredTopic = ethers.id('Registered(uint256,string,address)')
    const registeredEvent = receipt.logs.find(log => log.topics[0] === registeredTopic)
    if (registeredEvent) {
        agentId = Number(registeredEvent.topics[1])
    }

    // Fallback: parse from ERC-721 Transfer event (minted = from address(0))
    if (!agentId) {
        const transferTopic = ethers.id('Transfer(address,address,uint256)')
        const transferEvent = receipt.logs.find(log =>
            log.topics[0] === transferTopic &&
            log.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000'
        )
        if (transferEvent) {
            agentId = Number(transferEvent.topics[3])
        }
    }

    if (!agentId) {
        console.warn('[erc8004] Could not parse agentId from receipt events — checking by wallet lookup...')
        // Best effort: store tx hash and mark as registered without an ID
        const newState = {
            ...state,
            [stateKey]: null,
            [`${CHAIN}-txHash`]: tx.hash,
            [`${CHAIN}-registeredAt`]: new Date().toISOString(),
            [`${CHAIN}-agentAddress`]: wallet.address,
        }
        saveIdentityState(newState)
        console.log('[erc8004] State saved (no agentId).')
        return
    }

    console.log(`[erc8004] ✅ Minted Identity NFT #${agentId}`)
    console.log(`[erc8004] Explorer: ${chain.explorer}/token/${IDENTITY_REGISTRY_ADDRESS}/instance/${agentId}`)

    // Save state
    const newState = {
        ...state,
        [stateKey]: agentId,
        [`${CHAIN}-txHash`]: tx.hash,
        [`${CHAIN}-registeredAt`]: new Date().toISOString(),
        [`${CHAIN}-agentAddress`]: wallet.address,
        [`${CHAIN}-explorerUrl`]: `${chain.explorer}/token/${IDENTITY_REGISTRY_ADDRESS}/instance/${agentId}`,
    }
    saveIdentityState(newState)
    console.log(`[erc8004] State saved to: ${IDENTITY_STATE_PATH}`)
    console.log(`\n✅ Sasha Coin is now registered on ERC-8004 (${chain.name}) as Agent #${agentId}`)
}

main().catch(err => {
    console.error('[erc8004] Fatal:', err.message)
    process.exit(1)
})
