#!/usr/bin/env node
/**
 * deploy-contract.js — Deploy SashaAgentLog.sol to Mantle
 *
 * Uses ethers.js v6. No Hardhat/Foundry required.
 * Attempts on-the-fly compilation via solc if contracts/out/ doesn't exist.
 *
 * Usage:
 *   npm run deploy:testnet    → Mantle Sepolia (safe to run first)
 *   npm run deploy:mainnet    → Mantle mainnet (PRODUCTION)
 *
 * Prerequisites on VPS:
 *   MANTLE_AGENT_PK in .env + npm install ethers
 *   For compilation: npm install -g solc (or npx solc)
 *
 * Mantle Turing Test Hackathon 2026 — Sasha Coin
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const NETWORK = (() => { const i = args.indexOf('--network'); return i !== -1 ? args[i+1] : 'testnet' })()

const NETWORKS = {
    testnet: {
        name: 'Mantle Sepolia Testnet',
        rpcUrl: process.env.MANTLE_TESTNET_RPC_URL || process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
        chainId: 5003,
        explorer: 'https://explorer.sepolia.mantle.xyz',
    },
    mainnet: {
        name: 'Mantle Mainnet',
        rpcUrl: process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
        chainId: 5000,
        explorer: 'https://explorer.mantle.xyz',
    },
}

// Minimal ABI for deployment and interaction
const CONTRACT_ABI = [
    'constructor(address _owner, uint256 _agentId)',
    'function logTrade(uint256 _agentId, string calldata action, string calldata solanaTx, string calldata rationale) external',
    'function tradeCount() external view returns (uint256)',
    'function agentId() external view returns (uint256)',
    'function agentStatus() external view returns (uint256 _agentId, uint256 _tradeCount)',
    'function owner() external view returns (address)',
    'event TradeLogged(uint256 indexed agentId, string action, string solanaTx, string rationale, uint256 timestamp)',
]

function loadBytecode() {
    // 1. Check pre-compiled output
    const outDir = path.join(WORKSPACE, 'contracts', 'out')
    const binFiles = fs.existsSync(outDir)
        ? fs.readdirSync(outDir).filter(f => f.endsWith('.bin') && f.includes('SashaAgentLog'))
        : []

    if (binFiles.length > 0) {
        const hex = fs.readFileSync(path.join(outDir, binFiles[0]), 'utf8').trim()
        console.log(`[deploy] Using compiled bytecode: ${binFiles[0]}`)
        return hex.startsWith('0x') ? hex : '0x' + hex
    }

    // 2. Attempt on-the-fly compilation
    console.log('[deploy] contracts/out/ not found — attempting solc compilation...')
    try {
        fs.mkdirSync(path.join(WORKSPACE, 'contracts', 'out'), { recursive: true })
        const solFile = path.join(WORKSPACE, 'contracts', 'SashaAgentLog.sol')
        const ozBase  = path.join(WORKSPACE, 'node_modules')
        execSync(
            `npx solc --optimize --bin --abi ` +
            `@openzeppelin/=${ozBase}/@openzeppelin/ ` +
            `${solFile} -o ${path.join(WORKSPACE, 'contracts', 'out')} --overwrite`,
            { cwd: WORKSPACE, stdio: 'inherit', timeout: 60000 }
        )
        const compiled = fs.readdirSync(path.join(WORKSPACE, 'contracts', 'out'))
            .filter(f => f.endsWith('.bin') && f.includes('SashaAgentLog'))
        if (compiled.length > 0) {
            const hex = fs.readFileSync(path.join(WORKSPACE, 'contracts', 'out', compiled[0]), 'utf8').trim()
            console.log(`[deploy] Compiled: ${compiled[0]}`)
            return hex.startsWith('0x') ? hex : '0x' + hex
        }
    } catch (e) {
        console.warn(`[deploy] solc failed: ${e.message}`)
    }

    throw new Error(
        'No compiled bytecode. Run:\n' +
        '  npm install @openzeppelin/contracts\n' +
        '  npx solc --optimize --bin --abi \\\n' +
        '    @openzeppelin/=node_modules/@openzeppelin/ \\\n' +
        '    contracts/SashaAgentLog.sol -o contracts/out/ --overwrite'
    )
}

async function main() {
    const network = NETWORKS[NETWORK]
    if (!network) throw new Error(`Unknown network: ${NETWORK}. Use testnet or mainnet.`)

    console.log(`\n=== Deploy SashaAgentLog to ${network.name} ===\n`)

    const privateKey = process.env.MANTLE_AGENT_PK
    if (!privateKey) throw new Error('MANTLE_AGENT_PK not set')

    // Load agent ID
    const idPath = path.join(WORKSPACE, 'state', 'erc8004-identity.json')
    let agentId = 0n
    if (fs.existsSync(idPath)) {
        const id = JSON.parse(fs.readFileSync(idPath, 'utf8'))
        agentId = BigInt(id.tokenId || id.agentId || 0)
        console.log(`[deploy] Using agentId: ${agentId}`)
    } else {
        console.warn('[deploy] erc8004-identity.json not found — using agentId=0')
    }

    const provider = new ethers.JsonRpcProvider(network.rpcUrl)
    const signer   = new ethers.Wallet(privateKey, provider)
    const address  = await signer.getAddress()
    const balance  = await provider.getBalance(address)

    console.log(`[deploy] From: ${address}`)
    console.log(`[deploy] Balance: ${ethers.formatEther(balance)} MNT`)

    if (balance === 0n) {
        throw new Error('Zero MNT balance. Fund via https://bridge.mantle.xyz')
    }

    const bytecode = loadBytecode()
    console.log('[deploy] Deploying...')

    const factory  = new ethers.ContractFactory(CONTRACT_ABI, bytecode, signer)
    const contract = await factory.deploy(address, agentId)
    const txHash   = contract.deploymentTransaction()?.hash

    console.log(`[deploy] TX: ${txHash}`)
    console.log('[deploy] Waiting for confirmation...')
    await contract.waitForDeployment()

    const deployedAddress = await contract.getAddress()
    console.log(`\n✅ Deployed: ${deployedAddress}`)
    console.log(`   Explorer: ${network.explorer}/address/${deployedAddress}`)

    const state = {
        network: NETWORK,
        networkName: network.name,
        contractAddress: deployedAddress,
        txHash,
        agentId: agentId.toString(),
        owner: address,
        deployedAt: new Date().toISOString(),
        explorerUrl: `${network.explorer}/address/${deployedAddress}`,
    }

    const stateDir = path.join(WORKSPACE, 'state')
    fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(path.join(stateDir, 'contract-deployment.json'), JSON.stringify(state, null, 2))
    console.log('[deploy] Saved to state/contract-deployment.json')

    console.log('\nNext: update README.md with the deployed address.')
}

main().catch(err => {
    console.error('[deploy] Fatal:', err.message)
    process.exit(1)
})
