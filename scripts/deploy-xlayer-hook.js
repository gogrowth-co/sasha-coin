#!/usr/bin/env node
/**
 * deploy-xlayer-hook.js — Deploy Sasha's Dynamic Fee Hook to X Layer
 *
 * Deployment sequence:
 *   1. Compile SashaOracle.sol + SashaDynamicFeeHook.sol via solc
 *   2. Deploy SashaOracle (standard deployment, no address constraints)
 *   3. Mine CREATE2 salt for SashaDynamicFeeHook
 *      (address must have bits 12 + 7 set for afterInitialize + beforeSwap)
 *   4. Deploy SashaDynamicFeeHook via CREATE2 deployer at mined address
 *   5. Initialize a WOKB/USDC v4 pool with DYNAMIC_FEE_FLAG + the hook
 *   6. Save all addresses to state/xlayer-deployment.json
 *   7. Update .env with XLAYER_ORACLE_ADDRESS + XLAYER_HOOK_ADDRESS
 *
 * Usage:
 *   node scripts/deploy-xlayer-hook.js                    # testnet (Chain 195)
 *   node scripts/deploy-xlayer-hook.js --mainnet          # mainnet (Chain 196)
 *   node scripts/deploy-xlayer-hook.js --dry-run          # compile only, no tx
 *   node scripts/deploy-xlayer-hook.js --skip-pool        # deploy contracts only
 *
 * Requires (in .env):
 *   XLAYER_AGENT_PK    — Sasha's agent EOA private key for X Layer
 *   XLAYER_RPC_URL     — X Layer mainnet RPC (optional, uses default)
 *
 * Sasha Coin — OKX Build X Hackathon 2026
 * PoolManager on X Layer: 0x360e68faccca8ca495c1b759fd9eee466db9fb32
 */

import { ethers }      from 'ethers'
import fs              from 'fs'
import path            from 'path'
import { execSync }    from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..')

// ─── CLI args ────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2)
const DRY_RUN      = args.includes('--dry-run')
const MAINNET      = args.includes('--mainnet')
const SKIP_POOL    = args.includes('--skip-pool')
const SKIP_COMPILE = args.includes('--skip-compile')

// ─── Networks ────────────────────────────────────────────────────────────────

const NETWORKS = {
    testnet: {
        name:        'X Layer Testnet',
        rpc:         process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
        chainId:     195,
        explorer:    'https://www.oklink.com/x-layer-test',
        nativeToken: 'OKB',
        poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32', // same address, deploy will verify
    },
    mainnet: {
        name:        'X Layer Mainnet',
        rpc:         process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
        chainId:     196,
        explorer:    'https://www.oklink.com/x-layer',
        nativeToken: 'OKB',
        poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32', // confirmed from Uniswap official docs
    },
}

// ─── X Layer token addresses (mainnet) ───────────────────────────────────────
// WOKB = wrapped native gas token
// USDC.e = bridged USDC on X Layer
const TOKENS = {
    WOKB:   '0xe538905cf8410324e03A5A23C1c177a474D59b2b',
    USDC_E: '0x74b7F16337b8972027F6196A17a631aC6dE26d22', // USDC.e on X Layer
}

// ─── Uniswap v4 constants ─────────────────────────────────────────────────────

const DYNAMIC_FEE_FLAG  = 0x800000   // Pool fee parameter for dynamic-fee pools
const OVERRIDE_FEE_FLAG = 0x400000   // OR'd with fee in beforeSwap return

// Hook permission bits (from Hooks.sol) — 14 bits total (bits 0-13)
// afterInitialize = bit 12 = 0x1000
// beforeSwap      = bit 7  = 0x0080
// BaseOverrideFee sets ONLY these two. validateHookAddress does an EXACT match
// of all 14 bits, so the address lower 14 bits must be exactly 0x1080.
const HOOK_PERMISSIONS_MASK  = BigInt(0x1080)  // exact target value
const HOOK_PERMISSIONS_BITS  = BigInt(0x3FFF)  // mask for 14 permission bits

// Standard CREATE2 factory (deployed on all EVM chains)
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920ca78fbf26c0b4956c'

// Pool configuration
const TICK_SPACING = 60       // Standard for ~0.3% fee pools

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[deploy-hook] ${msg}`) }
function warn(msg) { console.warn(`[deploy-hook] ⚠  ${msg}`) }

function compile() {
    log('Compiling contracts...')
    const outDir     = path.join(WORKSPACE, 'contracts', 'out')
    const oracleFile = path.join(WORKSPACE, 'contracts', 'SashaOracle.sol')
    const hookFile   = path.join(WORKSPACE, 'contracts', 'SashaDynamicFeeHook.sol')

    fs.mkdirSync(outDir, { recursive: true })

    const q = p => `"${p}"`  // quote a path for shell

    // Compile SashaOracle (no external imports)
    execSync(
        `npx solc --optimize --bin --abi -o ${q(outDir)} ${q(oracleFile)}`,
        { cwd: WORKSPACE, stdio: 'inherit', timeout: 120000 }
    )

    // Compile SashaDynamicFeeHook (needs v4-core + OZ hooks)
    // solc resolves @-prefixed imports via --include-path pointing to node_modules
    execSync(
        `npx solc --optimize --bin --abi ` +
        `--base-path ${q(WORKSPACE)} ` +
        `--include-path ${q(path.join(WORKSPACE, 'node_modules'))} ` +
        `-o ${q(outDir)} ${q(hookFile)}`,
        { cwd: WORKSPACE, stdio: 'inherit', timeout: 120000 }
    )

    log('Compilation complete.')
    return outDir
}

function loadArtifact(outDir, name) {
    // solc names output files like: contracts_SashaOracle_sol_SashaOracle.bin
    // Match the contract name at the END of the filename (after last underscore)
    const files   = fs.readdirSync(outDir)
    const binFile = files.find(f => f.endsWith('.bin') && f.endsWith(`_${name}.bin`))
    const abiFile = files.find(f => f.endsWith('.abi') && f.endsWith(`_${name}.abi`))
    if (!binFile || !abiFile) {
        const available = files.filter(f => f.endsWith('.bin')).join(', ')
        throw new Error(`Compiled artifact for ${name} not found. Available: ${available}`)
    }
    const bin = fs.readFileSync(path.join(outDir, binFile), 'utf8').trim()
    const abi = JSON.parse(fs.readFileSync(path.join(outDir, abiFile), 'utf8'))
    return { bytecode: bin.startsWith('0x') ? bin : '0x' + bin, abi }
}

/**
 * Mine a CREATE2 salt such that the resulting hook address has
 * the required permission bits set (afterInitialize + beforeSwap = 0x1080).
 *
 * CREATE2 address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[-20 bytes]
 *
 * We iterate salts until the address ends with the right bits.
 */
function mineHookSalt(deployerAddress, initCode, permissionsMask) {
    log(`Mining CREATE2 salt for hook permissions 0x${permissionsMask.toString(16)}...`)
    const initCodeHash = ethers.keccak256(initCode)
    const prefix       = '0xff' + deployerAddress.slice(2).toLowerCase() // 0xff + deployer

    let salt = 0n
    const MAX_ATTEMPTS = 100_000_000n

    while (salt < MAX_ATTEMPTS) {
        const saltHex    = ethers.zeroPadValue(ethers.toBeHex(salt), 32)
        const combined   = ethers.concat([
            '0xff',
            ethers.getBytes(deployerAddress),
            ethers.getBytes(saltHex),
            ethers.getBytes(initCodeHash),
        ])
        const addrHash   = ethers.keccak256(combined)
        const candidate  = '0x' + addrHash.slice(-40)
        const addrBigInt = BigInt(candidate)

        // Exact match: lower 14 bits must equal permissionsMask exactly.
        // validateHookAddress() in BaseHook constructor checks all 14 bits.
        if ((addrBigInt & HOOK_PERMISSIONS_BITS) === permissionsMask) {
            log(`✅ Salt found: ${salt} after ${salt + 1n} attempts`)
            log(`   Hook address: ${ethers.getAddress(candidate)}`)
            return { salt: saltHex, hookAddress: ethers.getAddress(candidate) }
        }

        salt++
        if (salt % 100000n === 0n) process.stdout.write('.')
    }

    throw new Error(`Could not find valid CREATE2 salt in ${MAX_ATTEMPTS} attempts`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const network = MAINNET ? NETWORKS.mainnet : NETWORKS.testnet
    log(`\n=== Deploy Sasha Dynamic Fee Hook — ${network.name} ===\n`)
    log(`PoolManager: ${network.poolManager}`)

    // 1. Compile (skip if artifacts already exist and --skip-compile passed)
    const outDir = SKIP_COMPILE ? path.join(WORKSPACE, 'contracts', 'out') : compile()
    if (DRY_RUN) {
        log('--- DRY RUN: compilation complete. No transactions sent. ---')
        process.exit(0)
    }

    // 2. Connect
    const pk = process.env.XLAYER_AGENT_PK
    if (!pk) throw new Error('XLAYER_AGENT_PK not set')

    const provider  = new ethers.JsonRpcProvider(network.rpc, {
        chainId: network.chainId,
        name:    network.name,
    })
    const signer    = new ethers.Wallet(pk, provider)
    const agentAddr = await signer.getAddress()
    const balance   = await provider.getBalance(agentAddr)

    log(`Agent:   ${agentAddr}`)
    log(`Balance: ${ethers.formatEther(balance)} ${network.nativeToken}`)

    if (balance === 0n) {
        throw new Error(`Zero ${network.nativeToken} balance. Fund via https://www.okx.com/xlayer/bridge`)
    }

    // 3. Deploy SashaOracle
    log('\n[1/4] Deploying SashaOracle...')
    const { bytecode: oracleBin, abi: oracleAbi } = loadArtifact(outDir, 'SashaOracle')
    const oracleFactory  = new ethers.ContractFactory(oracleAbi, oracleBin, signer)
    const oracleContract = await oracleFactory.deploy(agentAddr)
    await oracleContract.waitForDeployment()
    const oracleAddress  = await oracleContract.getAddress()
    log(`✅ SashaOracle deployed: ${oracleAddress}`)
    log(`   Explorer: ${network.explorer}/address/${oracleAddress}`)

    // 4. Mine CREATE2 salt for hook
    log('\n[2/4] Mining CREATE2 salt for hook address...')
    const { bytecode: hookBin, abi: hookAbi } = loadArtifact(outDir, 'SashaDynamicFeeHook')

    // Constructor args: (poolManager, oracleAddress)
    const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address'],
        [network.poolManager, oracleAddress]
    )
    const initCode = hookBin + constructorArgs.slice(2) // concat bytecode + encoded args

    const { salt, hookAddress } = mineHookSalt(CREATE2_DEPLOYER, initCode, HOOK_PERMISSIONS_MASK)

    // 5. Deploy hook via CREATE2 (Nick's Factory — raw calldata: salt ++ initCode)
    // Nick's Factory (0x4e59b...) does NOT use ABI encoding — raw calldata only.
    // Format: first 32 bytes = salt, remaining bytes = initCode.
    log('\n[3/4] Deploying SashaDynamicFeeHook via CREATE2 (Nick\'s Factory)...')
    const deployData = ethers.concat([salt, ethers.getBytes(initCode)])
    const hookTx = await signer.sendTransaction({
        to:       CREATE2_DEPLOYER,
        data:     deployData,
        gasLimit: 3000000n,
    })
    log(`TX submitted: ${hookTx.hash}`)
    await hookTx.wait(1)
    log(`✅ SashaDynamicFeeHook deployed: ${hookAddress}`)
    log(`   Explorer: ${network.explorer}/address/${hookAddress}`)

    // Verify the hook code is deployed at the expected address
    const code = await provider.getCode(hookAddress)
    if (code === '0x') {
        throw new Error(`Hook deployment failed — no code at ${hookAddress}`)
    }
    log(`   Code verified ✓`)

    // 6. Initialize pool (unless --skip-pool)
    let poolId = null
    if (!SKIP_POOL) {
        log('\n[4/4] Initializing WOKB/USDC v4 pool with Sasha hook...')

        // Sort tokens (v4 requires currency0 < currency1)
        const [currency0, currency1] = BigInt(TOKENS.WOKB) < BigInt(TOKENS.USDC_E)
            ? [TOKENS.WOKB,   TOKENS.USDC_E]
            : [TOKENS.USDC_E, TOKENS.WOKB]

        // Initial sqrtPriceX96 for ~1 WOKB = 50 USDC
        // sqrtPriceX96 = sqrt(price) * 2^96
        // price = 50 (USDC per OKB), assuming 18/6 decimals adjustment
        // Adjusted price = 50 * 10^6 / 10^18 = 50 * 10^-12
        // sqrtPrice = sqrt(50e-12) * 2^96
        const INITIAL_SQRT_PRICE = 7922816251426433759354395033n // sqrt(1) * 2^96 ≈ 1:1 (adjust post-deploy)

        const poolManagerAbi = [
            'function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)',
        ]
        const poolManager = new ethers.Contract(network.poolManager, poolManagerAbi, signer)

        const poolKey = {
            currency0,
            currency1,
            fee:         DYNAMIC_FEE_FLAG,  // 0x800000 — enables dynamic fees
            tickSpacing: TICK_SPACING,
            hooks:       hookAddress,
        }

        const initTx = await poolManager.initialize(poolKey, INITIAL_SQRT_PRICE, { gasLimit: 500000n })
        log(`Pool init TX: ${initTx.hash}`)
        const initReceipt = await initTx.wait(1)
        log(`✅ Pool initialized`)

        // Pool ID = keccak256(abi.encode(poolKey))
        poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint24', 'int24', 'address'],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        ))
        log(`   Pool ID: ${poolId}`)
    }

    // 7. Save state
    const state = {
        network:        MAINNET ? 'mainnet' : 'testnet',
        networkName:    network.name,
        chainId:        network.chainId,
        deployedAt:     new Date().toISOString(),
        agentAddress:   agentAddr,
        oracleAddress,
        hookAddress,
        poolManager:    network.poolManager,
        poolId:         poolId || 'not-initialized',
        tokens: {
            WOKB:   TOKENS.WOKB,
            USDC_E: TOKENS.USDC_E,
        },
        explorer: {
            oracle: `${network.explorer}/address/${oracleAddress}`,
            hook:   `${network.explorer}/address/${hookAddress}`,
        },
    }

    const statePath = path.join(WORKSPACE, 'state', 'xlayer-deployment.json')
    fs.mkdirSync(path.join(WORKSPACE, 'state'), { recursive: true })
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
    log(`\n✅ Deployment state saved to state/xlayer-deployment.json`)

    console.log('\n' + '='.repeat(60))
    console.log('DEPLOYMENT COMPLETE — add these to your .env:')
    console.log('='.repeat(60))
    console.log(`XLAYER_ORACLE_ADDRESS=${oracleAddress}`)
    console.log(`XLAYER_HOOK_ADDRESS=${hookAddress}`)
    if (poolId) console.log(`XLAYER_POOL_ID=${poolId}`)
    console.log('='.repeat(60))
    console.log('\nNext: node scripts/push-signal-to-xlayer.js --dry-run')
}

main().catch(err => {
    console.error('[deploy-hook] Fatal:', err.message)
    process.exit(1)
})
