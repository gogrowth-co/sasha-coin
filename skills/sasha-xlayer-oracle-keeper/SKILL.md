---
name: sasha-xlayer-oracle-keeper
description: Runtime reference for using X Layer correctly — chain IDs, oracle/hook contracts, and the signal push. Mirror of the dev skill; the full version + references live in the dev workspace.
---

# Sasha X Layer Oracle Keeper (runtime mirror)

Sasha's risk signal lives in `SashaOracle` on X Layer and drives `SashaDynamicFeeHook` on a Uniswap v4 pool. `/etc/cron.d/sasha-oracle` re-pushes every 2h.

## Chain config (verified vs official OKX docs 2026-06)
- Mainnet: chainId **196** (`0xC4`), RPC `https://rpc.xlayer.tech`.
- Testnet: chainId **1952** (`0x7A0`), RPC `https://testrpc.xlayer.tech/terigon`. (Legacy `195` is dead.)
- Sign with `XLAYER_AGENT_PK`. PoolManager `0x360e68faccca8ca495c1b759fd9eee466db9fb32`.

## Run
- Read: `node scripts/xlayer-pool-state.js`
- Push: `node scripts/push-signal-to-xlayer.js [--force] [--dry-run]` (reads `content/mantle-signal.json`)
- Explorer: `https://www.oklink.com/x-layer/tx/<txHash>`

## Gotchas
- Gas estimates run low → +50% buffer on `gasLimit`.
- No v4 PositionManager on X Layer; the 0.3% pool is empty (use 0.01%).
- `CurrencyNotSettled` → decode + re-quote, don't blind-retry.

Full version + chain-config/contracts/signal-push references: dev workspace `.claude/skills/sasha-xlayer-oracle-keeper/`.
