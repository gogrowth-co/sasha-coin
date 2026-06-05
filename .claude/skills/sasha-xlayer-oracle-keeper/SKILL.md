---
name: sasha-xlayer-oracle-keeper
description: Correct usage of Sasha's X Layer (OKX zkEVM L2) integration — chain config, the SashaOracle + SashaDynamicFeeHook Uniswap v4 contracts, and the every-2h signal push that keeps the on-chain fee fresh. Use whenever reading or writing X Layer state, debugging the oracle, deploying the hook, or touching push-signal-to-xlayer.js.
---

# Sasha X Layer Oracle Keeper

Sasha's market-risk signal lives on-chain in `SashaOracle` on OKX X Layer and drives a dynamic swap fee through `SashaDynamicFeeHook` on a Uniswap v4 pool. A VPS cron (`/etc/cron.d/sasha-oracle`) re-pushes the signal every 2h so `updatedAt` never goes stale.

## When to use
- Reading pool/oracle state, pushing a fresh signal, deploying/initializing the hook or pool, or debugging X Layer gas/settlement errors.
- Before editing any `scripts/*xlayer*` or `push-signal-to-xlayer.js`.

## Correct-usage workflow
1. **Confirm the network.** Mainnet chainId **196** (`0xC4`), RPC `https://rpc.xlayer.tech`. Testnet chainId **1952** (`0x7A0`), RPC `https://testrpc.xlayer.tech/terigon`. The legacy `195` testnet id is dead — see `references/chain-config.md`.
2. **Read before write.** `node scripts/xlayer-pool-state.js` to fetch live pool/oracle state. Never push blind.
3. **Push the signal.** `node scripts/push-signal-to-xlayer.js` (add `--force` to re-push unchanged risk for liveness; add `--dry-run` to preview). Reads `content/mantle-signal.json` (produced by `sasha-signal-fusion`).
4. **Gas.** Estimate then add a **50% buffer** (X Layer estimates run low). See `references/signal-push.md`.
5. **Attest (optional).** After a material on-chain action, trigger the ERC-8004 self-transfer attestation via `sasha-defi-execution` / `mantle-agent`.

## Gotchas
- The 0.3% pool is empty on X Layer — route via the 0.01% pool.
- There is **no Uniswap v4 PositionManager** on X Layer; liquidity is added through the helper, not a PM.
- `CurrencyNotSettled` → decode and re-quote; do not retry verbatim.
- All signing uses `XLAYER_AGENT_PK` (env, VPS-only). Never hardcode.

## Files & registry
- Scripts: `push-signal-to-xlayer.js`, `xlayer-pool-state.js`, `init-xlayer-pool.js`, `deploy-xlayer-hook.js`, `xlayer-add-liquidity.js`. Contracts: `contracts/SashaOracle.sol`, `contracts/SashaDynamicFeeHook.sol`.
- Registry: owns the "X Layer RPC" and "Uniswap v4 (PoolManager + Hook + Oracle)" rows in `docs/integrations/registry.json`.
- References: `references/chain-config.md`, `references/contracts.md`, `references/signal-push.md`.
- Deeper LP/tick math: `.claude/skills/defi-lp-math`.