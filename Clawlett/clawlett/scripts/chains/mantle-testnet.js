/**
 * Mantle Sepolia testnet configuration (chainId 5003)
 * Use for development and testing before mainnet deployment.
 */

export default {
    id: 'mantle-testnet',
    name: 'Mantle Sepolia',
    chainId: 5003,
    nativeToken: 'MNT',
    wrappedNative: '0x9c8b4b15cb9db82a3c79ba7db19f1a1bb0db01a3',
    rpc: process.env.MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
    explorer: 'https://explorer.sepolia.mantle.xyz',

    contracts: {
        SafeProxyFactory:             '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2',
        SafeSingletonL2:              '0x3E5c63644E683549055b9Be8653de26E0B4CD36E',
        CompatibilityFallbackHandler: '0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4',
        MultiSend:                    '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761',
        RolesSingleton:               '0x9646fDAD06d3e24444381f44362a3B0eB343D337',
        ModuleProxyFactory:           '0x000000000000aDdB49795b0f9bA5BC298cDda236',
        ZodiacHelpers:                null,
        KyberSwapRouter:              null, // Not on testnet
        IdentityRegistry:             null, // May not be on testnet — check before using
        CNS:                          null,
    },

    verifiedTokens: {
        'MNT': '0x0000000000000000000000000000000000000000',
    },

    protectedSymbols: ['MNT'],
    tokenAliases: {},
    kyberswap: null,
    cow: null,
    trenches: null,
    cns: null,
    dexscreener: null,
}
