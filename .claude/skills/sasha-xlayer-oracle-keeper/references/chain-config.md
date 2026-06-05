# X Layer chain config (verified 2026-06 vs official OKX docs)

| Network | Chain ID (dec) | Chain ID (hex) | RPC URL |
|---|---|---|---|
| X Layer mainnet | **196** | `0xC4` | `https://rpc.xlayer.tech` (alt `https://xlayerrpc.okx.com`) |
| X Layer testnet | **1952** | `0x7A0` | `https://testrpc.xlayer.tech/terigon` (alt `https://xlayertestrpc.okx.com/terigon`) |

Source: OKX X Layer docs → Build on X Layer → Network information; corroborated by Alchemy. **The old testnet id `195` is legacy** (ChainList still lists it) and must not be used. `.env.example` was corrected from `195` → `1952` and the testnet RPC given the `/terigon` suffix on 2026-06-03.

## Env vars (names only)
- `XLAYER_RPC_URL`, `XLAYER_TESTNET_RPC_URL`
- `XLAYER_CHAIN_ID` (196), `XLAYER_TESTNET_CHAIN_ID` (1952)
- `XLAYER_AGENT_PK` — agent EOA private key (VPS-only)

## Explorer
`https://www.oklink.com/x-layer/tx/<txHash>`

## Gas
- Fund the agent EOA with OKB for gas: `https://www.okx.com/xlayer/bridge`.
- Estimates run low; apply a **50% buffer** on `gasLimit`.