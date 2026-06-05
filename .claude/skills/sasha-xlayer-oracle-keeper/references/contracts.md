# X Layer contracts

| Contract | Address / env | Notes |
|---|---|---|
| Uniswap v4 PoolManager | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` (`XLAYER_POOL_MANAGER`) | Official X Layer deployment |
| SashaOracle | `XLAYER_ORACLE_ADDRESS` (post-deploy) | Holds `riskLevel` + `updatedAt`; `setFee()` writes the signal |
| SashaDynamicFeeHook | `XLAYER_HOOK_ADDRESS` (post-deploy) | Reads the oracle, sets the swap fee per swap |
| Pool | `XLAYER_POOL_ID` (post-deploy) | The hooked v4 pool |

Source: `contracts/SashaOracle.sol`, `contracts/SashaDynamicFeeHook.sol`. Compiled artifacts in `out/`.

## Fee mapping (observed in logs)
`risk-on → fee 500` (0.05%), `neutral → 3000` (0.3%), `risk-off → higher`. The oracle stores the risk level; the hook maps it to a fee. Verify the exact mapping in the hook source before relying on numbers.

## Deploy / init (run once, gated)
- `node scripts/deploy-xlayer-hook.js --mainnet` → populates oracle/hook addresses.
- `node scripts/init-xlayer-pool.js` → creates the pool, populates `XLAYER_POOL_ID`.
- `node scripts/xlayer-add-liquidity.js` (no v4 PositionManager — uses the helper).