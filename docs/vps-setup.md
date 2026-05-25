# VPS Setup — Mantle Turing Test Hackathon 2026

Exact steps to configure the Hostinger VPS for the hackathon. Run in order.

---

## Step 1: Generate Sasha's Mantle EOA

SSH into the VPS:

```bash
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134
cd /docker/openclaw-h3mk/data/.openclaw/workspace
```

Generate a new Mantle-compatible EOA:

```bash
node -e "
const { ethers } = require('ethers');
const w = ethers.Wallet.createRandom();
console.log('Address:', w.address);
console.log('Private key:', w.privateKey);
console.log('Mnemonic:', w.mnemonic.phrase);
console.log('--- SAVE THESE SECURELY. Never commit the private key. ---');
"
```

Write down: `Address` (safe to share) and `Private key` (→ .env only).

---

## Step 2: Fund EOA with MNT

Sasha needs ~0.05 MNT:
- ERC-8004 registration: ~0.001 MNT
- SashaAgentLog deployment: ~0.01–0.02 MNT
- Per-trade attestations: ~0.0001 MNT × 200+ trades
- Gas reserve: 0.005 MNT

**Bridge:** https://bridge.mantle.xyz — connect funded ETH wallet, bridge to Sasha's address.

**Exchange:** Buy MNT on Bybit/OKX, withdraw directly to Sasha's Mantle address.

---

## Step 3: Fund Sasha's Solana wallet

```bash
byreal-cli wallet balance  # check current Solana wallet
```

Fund with: ~0.5 SOL + 20 USDC on Solana. This is demo capital for Byreal trades.

---

## Step 4: Add environment variables

```bash
nano /docker/openclaw-h3mk/data/.openclaw/.env
```

Add:

```bash
# Mantle
MANTLE_AGENT_PK=0x<private-key-from-step-1>
MANTLE_RPC_URL=https://rpc.mantle.xyz
MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz

# Signal sources
OPENROUTER_API_KEY=<from openrouter.ai>
ALLORA_API_KEY=<from developer.allora.network — free>
ELFA_API_KEY=<from elfa.ai — free tier>

# Notifications
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_CHAT_ID=<Gabriel's chat ID>

# Treasury
MANTLE_COMPOUND_THRESHOLD_WEI=10000000000000000
```

Save (`Ctrl+X`, `Y`, `Enter`).

---

## Step 5: Configure Byreal wallet (if not already done)

```bash
byreal-cli wallet set --private-key "<base58-solana-private-key>"
byreal-cli wallet balance  # confirm
```

---

## Step 6: Register ERC-8004 agent identity

```bash
cd /docker/openclaw-h3mk/data/.openclaw/workspace
source /docker/openclaw-h3mk/data/.openclaw/.env 2>/dev/null || export $(grep -v '^#' /docker/openclaw-h3mk/data/.openclaw/.env | xargs)

npm run erc8004:register
# → writes state/erc8004-identity.json
npm run erc8004:status   # confirm
```

---

## Step 7: Deploy SashaAgentLog.sol

Install dependencies:

```bash
npm install @openzeppelin/contracts  # needed for compilation
```

Deploy to testnet first:

```bash
npm run deploy:testnet
# → check Mantle Sepolia explorer URL in output
```

If testnet confirms, deploy to mainnet:

```bash
npm run deploy:mainnet
# → saves state/contract-deployment.json
# → update README.md with deployed address
```

---

## Step 8: Test mETH treasury status

```bash
npm run treasury
# → should show MNT balance and mETH balance
# → stakingAllowed: true means yield loop is ready
```

---

## Step 9: Sync to VPS

From your local machine:

```bash
./deploy.sh --execute
# → rsyncs runtime layer to /docker/openclaw-h3mk/data/.openclaw/workspace/
```

---

## Step 10: Restart container

```bash
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 \
  "cd /docker/openclaw-h3mk && docker-compose restart"
```

Wait 10 seconds for container to be healthy.

---

## Step 11: Get API keys for Allora and Elfa

**Allora (free):**
1. Go to https://app.allora.network — log in, look for "API Keys" or "Developer" in the dashboard
2. Fallback: https://developer.upshot.xyz (Upshot runs the consumer API)
3. Create account → get API key
4. Add to .env as `ALLORA_API_KEY`

Note: `ALLORA_API_KEY` is non-blocking. If not set, Allora returns neutral (confidence 0.3) and the other 4 sources run normally.

**Elfa (free tier):**
1. Go to https://elfa.ai
2. Sign up → developer portal → get API key
3. Add to .env as `ELFA_API_KEY`

Both are non-blocking — if keys aren't set, signals default to neutral.

---

## Step 12: End-to-end test

Send `[BYREAL_TRADE]` via Telegram to OpenClaw. Expected sequence:

1. OpenClaw loads `byreal-mantle` skill
2. `mantle-signal.js` runs all five sources in parallel (~15s)
3. Signal output logged
4. If action != HOLD: `byreal-trade.js` posts pre-trade tweet, waits 60s, executes, attests on Mantle, compounds treasury
5. Telegram response with trade result

**If signal is HOLD:** Telegram confirms HOLD + rationale. This is correct behavior.

To force non-HOLD for testing: temporarily lower the APR threshold in `mantle-signal.js` line containing `apr24h > 50` to `apr24h > 5`.

---

## Troubleshooting

```bash
# Container logs
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 \
  "docker logs openclaw-h3mk --tail 100 -f"

# Check current signal
cat /docker/openclaw-h3mk/data/.openclaw/workspace/content/mantle-signal.json | jq .recommendation

# Check trade log
cat /docker/openclaw-h3mk/data/.openclaw/workspace/state/mantle-trade-log.json | jq '.[-3:]'

# Check ERC-8004 identity
cat /docker/openclaw-h3mk/data/.openclaw/workspace/state/erc8004-identity.json

# Check contract deployment
cat /docker/openclaw-h3mk/data/.openclaw/workspace/state/contract-deployment.json

# Check treasury
node /docker/openclaw-h3mk/data/.openclaw/workspace/scripts/mantle-treasury.js --action status
```
