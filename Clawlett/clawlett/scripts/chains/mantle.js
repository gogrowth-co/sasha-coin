/**
 * Mantle chain configuration
 * Mantle Network — EVM-compatible L2 (chainId 5000)
 * Used for ERC-8004 agent identity registration + Mantle ecosystem interactions.
 *
 * NOTE: ZodiacHelpers is NOT deployed on Mantle.
 * DeFi execution for the Mantle Turing Test Hackathon uses the Byreal CLI (Solana).
 * This config is used for: ERC-8004 agent identity, Safe operations, on-chain data reads.
 */

export default {
    id: 'mantle',
    name: 'Mantle',
    chainId: 5000,
    nativeToken: 'MNT',
    wrappedNative: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', // WMNT
    rpc: process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
    explorer: 'https://explorer.mantle.xyz',

    contracts: {
        SafeProxyFactory:             '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2', // canonical, verified
        SafeSingletonL2:              '0x3E5c63644E683549055b9Be8653de26E0B4CD36E', // canonical, verified
        CompatibilityFallbackHandler: '0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4', // canonical
        MultiSend:                    '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761', // canonical
        RolesSingleton:               '0x9646fDAD06d3e24444381f44362a3B0eB343D337', // canonical, verified
        ModuleProxyFactory:           '0x000000000000aDdB49795b0f9bA5BC298cDda236', // canonical, verified
        ZodiacHelpers:                null, // NOT deployed on Mantle — use Byreal CLI for DeFi execution
        KyberSwapRouter:              '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5', // KyberSwap supports Mantle
        IdentityRegistry:             '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', // ERC-8004 — VERIFIED on Mantle
        CNS:                          null, // No Clawlett Name Service on Mantle
    },

    // Verified tokens on Mantle mainnet
    verifiedTokens: {
        'MNT':   '0x0000000000000000000000000000000000000000',
        'WMNT':  '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
        'USDC':  '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
        'USDT':  '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
        'mETH':  '0xcDA86A272531e8640cD7F1a92c01839911B90bb0',
        'USDY':  '0x5bE26527e817998173A6043B6B7C6881A788A9DD',
        'wETH':  '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
        'wBTC':  '0xcabAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2',
    },

    protectedSymbols: ['MNT', 'WMNT', 'USDC', 'USDT', 'mETH', 'USDY'],

    tokenAliases: {
        'MANTLE':      'MNT',
        'WRAPPED MNT': 'WMNT',
        'USD COIN':    'USDC',
        'TETHER':      'USDT',
        'MANTLE ETH':  'mETH',
        'USD YIELD':   'USDY',
        'ONDO USDY':   'USDY',
    },

    kyberswap: {
        chain: 'mantle',
        apiBase: 'https://aggregator-api.kyberswap.com',
    },

    // Mantle-specific DeFi protocols (for data reads + future execution)
    merchantMoe: {
        // Merchant Moe CLMM DEX — primary Byreal DEX integration on Mantle
        subgraph: 'https://subgraph-api.mantle.xyz/subgraphs/name/merchant-moe',
    },

    mETH: {
        // mETH liquid staking — Mantle's native ETH staking receipt token
        stakingContract: '0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f',
        apiBase: 'https://meth.mantle.xyz/api/v1',
    },

    cow: null,
    trenches: null,
    cns: null,

    dexscreener: {
        chainId: 'mantle',
    },
}
