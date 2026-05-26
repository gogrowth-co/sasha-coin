---
name: mantle-agent
description: Expert reference for Sasha's on-chain identity on Mantle L2 — ERC-8004 Agent registration, SashaAgentLog.sol attestation pattern, trade attestation data structure, cross-chain identity linking (Solana tx -> Mantle record), and env/config requirements. Use whenever writing to the Mantle reputation layer or debugging erc8004-write.js / deploy-contract.js.
---

# Mantle Agent Identity — Expert Reference
*Last verified: 2026-05-25 | Mantle Mainnet chainId 5000*

---

## 1. Mantle L2 Chain Config

```
Mainnet RPC:      https://rpc.mantle.xyz          (env: MANTLE_RPC_URL)
Testnet RPC:      https://rpc.sepolia.mantle.xyz   (env: MANTLE_TESTNET_RPC_URL)
Mainnet chainId:  5000
Testnet chainId:  5003
Explorer:         https://explorer.mantle.xyz
Testnet Explorer: https://explorer.sepolia.mantle.xyz
Bridge:           https://bridge.mantle.xyz
Native token:     MNT (used for gas)
Block time:       ~2s
```

### ethers.js Provider Setup
```js
import { ethers } from 'ethers'
const provider = new ethers.JsonRpcProvider(process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz')
const wallet = new ethers.Wallet(process.env.MANTLE_AGENT_PK, provider)
```

---

## 2. ERC-8004 Agent Identity Registry

### Contract
```
Registry Address: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
Standard:         ERC-8004 (AI Agent Identity NFT, ERC-721 extension)
```

### ABI (minimal)
```js
const IDENTITY_REGISTRY_ABI = [
  'function register(string agentURI) returns (uint256 agentId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]
```

### Registration Flow
```js
const registry = new ethers.Contract(REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, wallet)

const metadata = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: 'Sasha Coin',
  description: 'Autonomous AI DeFi agent. Posts trading thesis to X before executing on-chain.',
  agentAddress: wallet.address,
  chain: 'Mantle',
  chainId: 5000,
  capabilities: ['defi-trading', 'social-signal-fusion', 'tweet-before-trade', 'multi-chain'],
  runtime: 'OpenCLAW',
  services: [
    { name: 'x', endpoint: 'https://x.com/SashaCoin95' },
    { name: 'token', endpoint: 'https://www.base.org/ecosystem' },
  ],
}
const agentURI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(metadata)).toString('base64')

const tx = await registry.register(agentURI, { gasLimit: 300_000 })
const receipt = await tx.wait()

// Parse agentId from Registered event
const registeredTopic = ethers.id('Registered(uint256,string,address)')
const log = receipt.logs.find(l => l.topics[0] === registeredTopic)
const agentId = Number(log.topics[1])   // Sasha = Agent #100
```

### State File: state/erc8004-identity.json
```json
{
  "mantle-agentId": 100,
  "mantle-txHash": "0x...",
  "mantle-registeredAt": "2026-...",
  "mantle-testnet-agentId": 42
}
```

### CLI
```bash
node scripts/erc8004-register.js --dry-run
node scripts/erc8004-register.js
node scripts/erc8004-register.js --chain mantle-testnet
```

---

## 3. Trade Attestation Pattern (self-transfer)

```js
// 0-MNT self-transfer with structured JSON as tx.data
const attestation = {
  v: 1,
  type: 'trade-attestation',
  agentId,
  action,                         // OPEN_LP_POSITION | CLOSE_LP_POSITION | CLAIM_FEES | SWAP
  pool:       pool || null,
  apr:        apr || null,
  solanaTx:   solanaTxSig || null,
  solscanUrl: solanaTxSig ? `https://solscan.io/tx/${solanaTxSig}` : null,
  executedAt: new Date().toISOString(),
  agent: 'Sasha Coin',
  agentX: '@SashaCoin95',
  hackathon: 'Mantle Turing Test 2026',
  track: 'Agentic Wallets & Economy',
}

const data = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(attestation)))
const tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, data, gasLimit: 100_000 })
```

### CLI
```bash
node scripts/erc8004-write.js --action OPEN_LP_POSITION --pool SOL/USDC --apr 73.1 --tx <sig>
node scripts/erc8004-write.js --dry-run
```

---

## 4. SashaAgentLog.sol

Thin event-log contract deployed by Sasha's EOA. Deploy before Phase 1.

```bash
node scripts/deploy-contract.js --testnet   # deploy to Mantle Sepolia
node scripts/deploy-contract.js             # deploy to mainnet
```

Saves to state/agent-contract.json: `{ contractAddress, owner, agentId, deployedAt, explorerUrl }`

---

## 5. Cross-Chain Identity Linking

| Chain | Identity | Link |
|---|---|---|
| Mantle | ERC-8004 NFT #100 | state/erc8004-identity.json |
| Solana | Agent wallet (via Byreal) | solanaTx field in attestation |
| Base | EOA 0xba3BB32... | baseTx field in attestation |

---

## 6. Required Env Variables

```
MANTLE_AGENT_PK         — private key for Mantle EOA
MANTLE_RPC_URL          — Mantle mainnet RPC
MANTLE_TESTNET_RPC_URL  — Mantle Sepolia RPC (optional)
```

---

## 7. Phase 0 Setup Checklist

- [ ] Fund Mantle EOA with MNT (bridge.mantle.xyz, ~0.01 MNT)
- [ ] node scripts/erc8004-register.js --chain mantle-testnet --dry-run
- [ ] node scripts/erc8004-register.js --chain mantle-testnet
- [ ] node scripts/deploy-contract.js --testnet
- [ ] node scripts/erc8004-write.js --dry-run --chain mantle-testnet
- [ ] Repeat all above on mainnet

---

## 8. Gotchas

1. **MNT for gas, not ETH.** Keep at least 0.005 MNT in the agent EOA.
2. **Self-transfer data limit.** Keep attestation JSON under 8KB (~400 bytes current).
3. **agentId from state, not hardcoded.** Always read from state/erc8004-identity.json.
4. **Non-blocking always.** erc8004-write.js exits 0 on all errors.
5. **Testnet before mainnet** for all new attestation schema changes.
6. **chainId 1337 for HL signing** (different from Mantle's 5000). Don't confuse them.
