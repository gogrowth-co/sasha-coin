# Sasha Coin — Pre-Audit Handover Document
## Prepared for Fable 5 Security Audit · July 4, 2026

> **Audit scope:** All on-chain contracts, execution scripts, hackathon submissions, treasury infrastructure, and agentic A2A services built for Sasha Coin between May–July 2026.
>
> **Maintainer:** Gabriel Mangabeira ([@gmangabeira](https://x.com/gmangabeira))
> **Agent:** Sasha ([@SashaCoin95](https://x.com/SashaCoin95))
> **Repo:** [github.com/gogrowth-co/sasha-coin](https://github.com/gogrowth-co/sasha-coin) (private) + [github.com/gogrowth-co/sasha-x402-kit](https://github.com/gogrowth-co/sasha-x402-kit) (public)

---

## 1. Executive Summary

Sasha is an autonomous AI agent running on OpenCLAW (a custom VPS runtime). Over 8 weeks (May–July 2026), Sasha entered **5 hackathons** and built **4 on-chain contracts** across **5 chains** (X Layer, Mantle, Base, Solana, Casper Testnet), plus a CROO CAP A2A service. This document inventories every contract, script, wallet, and execution gate for the auditor.

### Hackathon Timeline

| # | Hackathon | Status | Deadline | Chains |
|---|---|---|---|---|
| 1 | Mantle Turing Test | ✅ Submitted | May 26, 2026 | Mantle, Solana, Base |
| 2 | OKX Build X (Uniswap v4 Hook) | ✅ Submitted | May 28, 2026 | X Layer |
| 3 | Casper Agentic Buildathon | ✅ Submitted | Jun 30, 2026 | Casper Testnet |
| 4 | CROO Agent Hackathon | 🔄 In Progress | Jul 12, 2026 | Base (CAP) |
| 5 | Sasha Goes Live (campaign) | ✅ Active | Apr 28–May 28 | Base, X |

---

## 2. On-Chain Contracts — Full Inventory

### 2.1 SashaOracle.sol
| Field | Value |
|---|---|
| **Chain** | X Layer mainnet (chainId 196) |
| **Address** | `0xfE538FF6ec697B32ADBd215d690b1949d7Ed5c74` |
| **Source verified** | ✅ Yes (OKLink) |
| **Language** | Solidity ^0.8.26 |
| **Lines** | ~130 |
| **Purpose** | AI signal oracle — stores Sasha's market-risk fee |
| **Access control** | Only agent EOA (`0xe451...1d1f`) can call `setFee()` |
| **Bounds** | Fee clamped to [50, 10000] bips (0.005%–1.0%) |
| **Staleness** | 6h threshold; hook falls back to 3000 (0.3%) |
| **Events** | `FeeUpdated(oldFee, newFee, riskLevel, timestamp, updateCount)` |
| **Hackathon** | OKX Build X |

### 2.2 SashaDynamicFeeHook.sol
| Field | Value |
|---|---|
| **Chain** | X Layer mainnet (chainId 196) |
| **Address** | `0xe1aeF51eF6B801De34AA4a70FCf2027c0a6d9080` |
| **Source verified** | ✅ Yes (OKLink) |
| **Language** | Solidity ^0.8.26 |
| **Lines** | ~120 |
| **Extends** | OpenZeppelin `BaseOverrideFee` |
| **Permissions** | `0x1080` (afterInitialize + beforeSwap) |
| **Purpose** | Uniswap v4 hook — overrides swap fee from oracle on every swap |
| **Pool** | USDC.e/WOKB, dynamic fee flag, tickSpacing 60 |
| **PoolManager** | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| **Hackathon** | OKX Build X |

### 2.3 LiquidityHelper.sol
| Field | Value |
|---|---|
| **Chain** | X Layer mainnet (chainId 196) |
| **Address** | `0xbd44673c97f11dd025dd82Ee29b98c0d779e6019` |
| **Source verified** | ✅ Yes (OKLink) |
| **Language** | Solidity ^0.8.26 |
| **Lines** | ~130 |
| **Purpose** | Custom v4 liquidity adder via unlock/unlockCallback pattern |
| **Access control** | Owner-only `addLiquidity()` |
| **Safety** | Emergency `rescueToken()` for stuck funds |
| **Hackathon** | OKX Build X |

### 2.4 SashaAgentLog.sol
| Field | Value |
|---|---|
| **Chain** | Mantle mainnet (chainId 5000) |
| **Address** | `0x71e27D792ADF726eD5C55f74052E8A8f063B9EF8` |
| **Source verified** | ✅ Yes |
| **Language** | Solidity ^0.8.20 |
| **Lines** | ~90 |
| **Extends** | OpenZeppelin `Ownable` |
| **Purpose** | Trade attestation log — immutable on-chain record of every trade |
| **Access control** | Only owner (agent EOA) can call `logTrade()` |
| **Gas** | ~21k + event encoding (no storage writes except counter) |
| **Events** | `TradeLogged(agentId, action, solanaTx, rationale, timestamp)` |
| **Hackathon** | Mantle Turing Test |

### 2.5 ERC-8004 Agent Identity
| Field | Value |
|---|---|
| **Chain** | Mantle mainnet (chainId 5000) |
| **Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| **Agent ID** | #100 |
| **Purpose** | On-chain agent identity NFT per ERC-8004 standard |
| **Hackathon** | Mantle Turing Test |

### 2.6 AgentAttest (Casper — Odra/Rust)
| Field | Value |
|---|---|
| **Chain** | Casper Testnet |
| **Package hash** | `7b4bb374af24ee46a067f4d41f5cba61b097ba613825617e81a57d7673132262` |
| **Deploy tx** | [`577570f2…dba0bfff`](https://testnet.cspr.live/transaction/577570f2f5f486353b8d2e61f7328fca34cd8446053d643ebc395344dba0bfff) |
| **Language** | Rust (Odra v2.7 → CasperVM/WASM) |
| **Purpose** | Clean-room ERC-8004 pattern — agent decision attestation log |
| **Repo** | [github.com/gogrowth-co/sasha-x402-kit](https://github.com/gogrowth-co/sasha-x402-kit) |
| **Hackathon** | Casper Agentic Buildathon |

---

## 3. Agent EOAs & Wallets

| Address | Chain | Role | Key Env Var |
|---|---|---|---|
| `0xe451278F3ce3f80d2F18ab292Ad2C3dAfE461d1f` | X Layer | Oracle keeper (setFee) | `XLAYER_AGENT_PK` |
| `0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9` | Mantle | ERC-8004 agent, SashaAgentLog owner | `MANTLE_AGENT_PK` |
| `0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04` | Arbitrum/HL | Hyperliquid hedge wallet | `HL_PRIVATE_KEY` |
| `0xba3BB320d35773ae0C44843BC5D7e5B3B0B08601` | Base | LP-miner EOA | `AGENT_PRIVATE_KEY` |
| `647TT6SWA48yrmH8Csb2QakeYMnCNh2oSFijLQpRksJw` | Solana | Byreal CLMM LP wallet | (byreal-cli managed) |

---

## 4. Execution Scripts — Full Inventory

### 4.1 Signal & Oracle Scripts

| Script | Chain | Writes? | Key | Safety |
|---|---|---|---|---|
| `push-signal-to-xlayer.js` | X Layer | ✅ `setFee()` | `XLAYER_AGENT_PK` | Dry-run default, `--force` to re-push, always exits 0 |
| `mantle-signal.js` | — | ❌ Read-only | `OPENROUTER_API_KEY` | Pure computation, no on-chain writes |

### 4.2 LP & Hedge Scripts

| Script | Chain | Writes? | Key | Safety |
|---|---|---|---|---|
| `lp-opener.js` | Base | ✅ `mint()` | `AGENT_PRIVATE_KEY` | Dry-run default, `--execute` required |
| `lp-rebalancer.js` | Solana/Base | ✅ Close/reopen | `AGENT_PRIVATE_KEY` | Dry-run default, `--confirm-kill` or `LP_KILL_OK=1` for KILL |
| `lp-harvest.js` | Base | ✅ 5-tx harvest | `AGENT_PRIVATE_KEY` | Dry-run default, `--execute` required |
| `hedge-executor.js` | Hyperliquid | ✅ Perp orders | `HL_PRIVATE_KEY` | `--execute` + `HEDGE_LIVE_OK=1`, reduce_only on closes, funding kill switch |
| `hl-deposit.js` | Arbitrum | ✅ USDC deposit | `HL_PRIVATE_KEY` | Min 5 USDC, `--execute` + `HEDGE_LIVE_OK=1` |
| `position-monitor.js` | Base/Solana | ❌ Read-only | — | Alert-only, no auto-execute |

### 4.3 Mantle Scripts

| Script | Chain | Writes? | Key | Safety |
|---|---|---|---|---|
| `deploy-contract.js` | Mantle | ✅ Deploy | `MANTLE_AGENT_PK` | One-time |
| `erc8004-register.js` | Mantle | ✅ Register | `MANTLE_AGENT_PK` | One-time |
| `erc8004-write.js` | Mantle | ✅ Attest | `MANTLE_AGENT_PK` | Non-blocking, always exits 0 |
| `mantle-treasury.js` | Mantle | ✅ Stake/unstake | `MANTLE_AGENT_PK` | Dry-run default, `--execute` required |

### 4.4 Trade Scripts

| Script | Chain | Writes? | Key | Safety |
|---|---|---|---|---|
| `auto-trade.js` | Solana | ✅ Delegates | — | Rate-limit 23h, max signal age 4h, always exits 0 |
| `byreal-trade.js` | Solana | ✅ Trade | (byreal-cli) | Aborts if tweet fails, 60s accountability window, dry-run default |
| `dust-consolidator.js` | Solana | ✅ Swap | (byreal-cli) | Dry-run default, `--execute` required |

### 4.5 Treasury & Monitoring

| Script | Chain | Writes? | Key | Safety |
|---|---|---|---|---|
| `treasury-monitor.js` | Solana/Mantle | ❌ Read-only | — | Carry-forward guard prevents zeroing on RPC timeout |
| `bridge-to-mantle.js` | Solana→Mantle | ❌ Quote-only | — | Execution NOT YET IMPLEMENTED |
| `snapshot-state.js` | Multi | ❌ Read-only | — | State snapshot |
| `build-dashboard-data.js` | Multi | ❌ Read-only | — | Dashboard data aggregation |

### 4.6 Deploy Scripts

| Script | Chain | Writes? | Key | Safety |
|---|---|---|---|---|
| `deploy-xlayer-hook.js` | X Layer | ✅ Deploy | `XLAYER_AGENT_PK` | CREATE2 mining via Nick's Factory, saves to state file |
| `init-xlayer-pool.js` | X Layer | ✅ Init pool | `XLAYER_AGENT_PK` | One-time pool initialization |
| `xlayer-add-liquidity.js` | X Layer | ✅ Add liquidity | `XLAYER_AGENT_PK` | Uses LiquidityHelper contract |

---

## 5. Clawlett Safe Infrastructure

### Safe Configuration (Base Mainnet)

| Component | Address |
|---|---|
| Safe Singleton | `0x3E5c63644E683549055b9Be8653de26E0B4CD36E` |
| ZodiacHelpers | `0x38441B5bd6370b000747c97a12877c83c0A32eaF` |
| Roles Singleton | `0x9646fDAD06d3e24444381f44362a3B0eB343D337` |
| Module Factory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` |
| Safe Factory | `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2` |
| AgentKeyFactoryV3 | `0x2EA0010c18fa7239CAD047eb2596F8d8B7Cf2988` |

### Trading Infrastructure

| Component | Address |
|---|---|
| CoW Settlement | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` |
| CoW Vault Relayer | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` |
| KyberSwap Router | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |
| CNS (Contract Name Service) | `0x299319e0BC8d67e11AD8b17D4d5002033874De3a` |

### Security Model
- **Safe holds all funds** — Agent wallet only has gas
- **Zodiac Roles restricts operations** — Can only interact with ZodiacHelpers
- **No transfer/withdraw** — Agent cannot move funds out of Safe
- **Scam protection** — Common tokens resolve to verified addresses only
- **MEV protection** — CoW Protocol batches orders

### Clawlett Scripts
| Script | Purpose |
|---|---|
| `initialize.js` | Deploy Safe + Roles + ERC-8004 + CNS registration |
| `swap.js` | KyberSwap Aggregator swaps via Safe + Zodiac Roles |
| `cow.js` | CoW Protocol MEV-protected swaps |
| `balance.js` | Read Safe balances (read-only) |
| `trenches.js` | Trenches token creation + bonding curve trading |
| `tokens.js` | Token resolution with DexScreener fallback |

---

## 6. CROO A2A Infrastructure

### Agent & Service Registration

| Field | Value |
|---|---|
| **Agent ID** | `f64edd68-41f0-4b2f-8ee3-8a21fdc87edb` |
| **Service ID** | `b0ba8e03-9e93-4865-8914-6fcd8f1b8eaf` |
| **Service name** | Sasha Risk Desk — LP Risk Packet |
| **Schema** | `sasha.risk_packet.v1` |
| **Price** | $0.10 USDC |
| **SLA** | 5 minutes |
| **Store** | [agent.croo.network](https://agent.croo.network) |

### Additional Services (registered, lower priority)

| Service | Schema |
|---|---|
| LP Range Signal | `sasha.lp_range_signal.v1` |
| Gas Check | `sasha.gas_check.v1` |
| Token Health Score | `sasha.ths_scan.v1` |
| Token Health Lookup | `sasha.ths_lookup.v1` |

### Architecture

```
croo/src/
├── provider.ts              WebSocket listener → acceptNegotiation → deliverOrder
├── requester.ts             Full requester: negotiate → poll → pay → getDelivery
├── risk-packet.ts           Deterministic LP risk scoring from dashboard.json
├── a2a-buyer.ts             Buy from up to 3 external CROO agents concurrently
├── croo-client.ts           AgentClient factory from env vars
├── free-data.ts             Free context: gas price + Fear & Greed Index
├── reputation-proof.ts      Build reputation proof from order history
└── services/
    ├── gas-check.ts         Live Base gas price + LP rebalance cost estimate
    ├── lp-range-signal.ts   LP range status from dashboard
    ├── ths-scan.ts          Token Health Score fresh scan via Supabase Edge Function
    └── ths-lookup.ts        Cached token health score lookup
```

### SDK Methods Used
- `AgentClient` — client initialization
- `connectWebSocket` — real-time event stream for provider
- `acceptNegotiation` / `rejectNegotiation` — provider negotiation
- `deliverOrder` — deliver signed payload after payment
- `createNegotiation` — requester: initiate order
- `payOrder` — requester: settle via CAPVault escrow
- `getDelivery` — requester: retrieve completed delivery

### Win Conditions (for hackathon judging)
- 10+ completed CAP orders
- 5+ unique buyer wallets
- 3+ unique counterparty agents
- Anti-sybil: fewer than 3 counterparties or 5 buyers = flagged

---

## 7. Casper x402 Kit

### Repository
- **URL:** [github.com/gogrowth-co/sasha-x402-kit](https://github.com/gogrowth-co/sasha-x402-kit)
- **License:** MIT
- **Status:** Public, submitted to Casper Agentic Buildathon

### Architecture

```
core/                         chain-agnostic — imports NO chain SDK
  settlement_adapter.go        SettlementAdapter interface
  types.go                     chain-neutral types

adapters/
  casper/                      FLAGSHIP (shipped)
    contract/                  Odra (Rust) AgentAttest contract
    casper_adapter.go          headless TransactionV1 signing via casper-go-sdk
    x402_scheme.go             EIP-712 typed-data x402 pay scheme
  evm/                         PROOF adapter (Base Sepolia) — roadmap

agent/loop.go                  PAY → ACT → ATTEST → EXPOSE orchestrator
cmd/{attest,agent}/            runnable entrypoints
```

### Stack
- Rust + Odra v2.7 (CasperVM/WASM)
- casper-go-sdk
- casper-eip-712
- make-software/casper-x402 facilitator
- CSPR.cloud testnet RPC

### Live Testnet Transactions

| What | Transaction |
|---|---|
| AgentAttest deploy | [`577570f2…dba0bfff`](https://testnet.cspr.live/transaction/577570f2f5f486353b8d2e61f7328fca34cd8446053d643ebc395344dba0bfff) |
| PAY (x402 402→settle) | [`b419bbcb…13cc5f2b`](https://testnet.cspr.live/transaction/b419bbcbcbefaa6da97eb4e5251461c691ba436f8f6921a316ea82c213cc5f2b) |
| ATTEST (decision on-chain) | [`1f063cc2…dec62f6893`](https://testnet.cspr.live/transaction/1f063cc2d3567079cfac9075c3120d9b15deddcdec2a71eb75fc6fdec62f6893) |

### Security
- Testnet only — no production keys in repo
- `scripts/secret-scan.sh` pre-commit hook + CI
- `.env`, `*.pem`, `keys/`, `state/` gitignored

---

## 8. Signal Pipeline Architecture

Sasha's market-risk signal fuses 5 sources:

| Source | Weight | Data |
|---|---|---|
| Social sentiment (Sasha's X posts) | 25% | LLM analysis via OpenRouter/Gemini |
| Byreal pool data | 20% | On-chain pool APR, TVL, volume |
| Allora inference | 25% | ML predictions |
| Elfa AI | 15% | Smart mentions, social intelligence |
| Polymarket | 15% | Prediction market odds |

**Output:** `content/mantle-signal.json` → consumed by `push-signal-to-xlayer.js` (X Layer) and `auto-trade.js` (Solana).

**Fee mapping (X Layer):**
- risk-off → 10000 (1.0%) — protect LPs
- neutral → 3000 (0.3%) — standard
- risk-on → 500 (0.05%) — attract volume

---

## 9. Key Env Vars (names only — no values)

| Env Var | Chain | Used By |
|---|---|---|
| `XLAYER_AGENT_PK` | X Layer | Oracle setFee, hook deploy, pool init |
| `MANTLE_AGENT_PK` | Mantle | ERC-8004, SashaAgentLog, mETH staking, LP fallback |
| `AGENT_PRIVATE_KEY` | Base | LP opener, lp-harvest |
| `HL_PRIVATE_KEY` | Arbitrum/HL | Hedge executor, HL deposits |
| `HL_WALLET_ADDRESS` | Hyperliquid | `0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04` |
| `OPENROUTER_API_KEY` | — | LLM signal analysis |
| `ALLORA_API_KEY` | — | Allora predictions |
| `ELFA_API_KEY` | — | Elfa smart mentions |
| `CROO_SDK_KEY` | Base | CROO CAP agent authentication |
| `THS_SERVICE_KEY` | — | Token Health Score Supabase |

---

## 10. Execution Safety Gates

All on-chain execution scripts follow a consistent pattern:

1. **Dry-run by default** — `--execute` flag required for any state change
2. **Non-blocking signal scripts** — `push-signal-to-xlayer.js`, `erc8004-write.js`, `auto-trade.js` always exit 0
3. **Telegram alerts** — All execution scripts report to Telegram
4. **Rate limiting** — `auto-trade.js` enforces 23h window between trades

**There is no universal Gabriel-confirmation gate on fund-moving operations, and as of
2026-07-05 every KILL action is confirm-gated pending backtest.** An earlier version of
this document claimed a universal gate; it did not match the code (H-3,
`reports/security-audit-fable5-2026-07-04.md` — stop-loss, HF-emergency, and funding-kill
auto-executed from the 30-min cron with thresholds that had never been validated against
price history). All five KILL triggers now carry `confirmGated: true`:

| Trigger | `killSwitch` | `confirmGated` | Auto-executes from 30-min cron? |
| --- | --- | --- | --- |
| Stop-loss (PnL ≤ threshold) | ✅ | ✅ | **No** — held, needs `--confirm-kill` or `LP_KILL_OK=1` |
| HF emergency (Morpho) | ✅ | ✅ | **No** — held, same gate |
| Funding kill (hedge) | ✅ | ✅ | **No** — held, same gate |
| OOR-distance drift beyond band | ✅ | ✅ | **No** — held, same gate |
| Hedge within 3% of liquidation | ✅ | ✅ | **No** — held, same gate |

This is a deliberately temporary, more conservative state, not the final design — see
`reports/plans-2026-07-05/01-lp-miner.md` for the plan to backtest stop-loss/HF-emergency/
funding-kill against ETH price and funding history since the position opened, then decide
whether to un-gate those three for speed (OOR-distance/hedge-liq-proximity likely stay
manual regardless, since they were already correctly gated).

`HEDGE_LIVE_OK=1` is a separate gate scoping live Hyperliquid *order placement* (not kills)
to the `sasha-hedge` cron; it is hardcoded `1` in that cron's env, so it protects against
accidental ad-hoc runs, not against cron autonomy. Same pattern for `LP_KILL_OK` — it is
absent from the VPS cron env, so every KILL row above requires a manual `--confirm-kill` run.

---

## 11. Live Dashboards

| Dashboard | URL | Hackathon |
|---|---|---|
| OKX Build X | https://sasha-dashboards.pages.dev/okx/ | OKX |
| Mantle Turing Test | https://sasha-dashboards.pages.dev/mantle/ | Mantle |
| LP Miner | https://sasha-dashboards.pages.dev/lp-miner/ | General |
| CROO Risk Desk | https://sasha-dashboards.pages.dev/croo/ | CROO |

---

## 12. Demo Videos

| Video | URL | Hackathon |
|---|---|---|
| OKX Build X demo | https://youtu.be/MiDu7zSgQYI | OKX |
| Mantle Turing Test demo | https://youtu.be/BirU_Z57Z3A | Mantle |

---

## 13. Known Risk Areas for Auditor Focus

### High Priority
1. **`SashaOracle.setFee()`** — Single EOA access control. If agent key is compromised, attacker can set arbitrary fees. Consider multisig or time-lock.
2. **`SashaDynamicFeeHook._getFee()`** — Oracle staleness fallback is 0.3%. If oracle is permanently down, all swaps use default fee with no override possible.
3. **`LiquidityHelper.rescueToken()`** — Emergency withdrawal function. Owner can drain all tokens. Verify owner is the intended EOA.
4. **`SashaAgentLog.logTrade()`** — `onlyOwner` modifier. Same EOA risk as oracle.
5. **Hyperliquid hedge wallet** (`0xFAef67...`) — Holds perp positions. `HL_PRIVATE_KEY` compromise = full position control.
6. **Clawlett Safe** — Verify Zodiac Roles modifier actually prevents transfers. Test that agent EOA cannot call `execTransaction` directly.

### Medium Priority
7. **`hedge-executor.js`** — Static hedge positions (`staticHedge:true`) are skipped by cron. Verify no stale hedge accumulates.
8. **`lp-rebalancer.js`** — `LP_KILL_OK=1` env var gate. Verify it cannot be set accidentally in cron environment.
9. **`bridge-to-mantle.js`** — Quote-only, execution not implemented. No risk currently, but flag for when execution is added.
10. **CROO `provider.ts`** — WebSocket reconnection logic. Verify it handles dropped connections without double-delivering orders.
11. **Casper `AgentAttest`** — Odra/WASM contract. Verify no upgradeability backdoor (proxy pattern or mutable state).

### Low Priority
12. **`treasury-monitor.js`** — Carry-forward guard on RPC timeout. Verify stale data doesn't feed into execution decisions.
13. **`dust-consolidator.js`** — Swaps all dust tokens. Verify no token approval lingering.
14. **`mantle-signal.js`** — Shells out to `byreal-cli`. Verify CLI output parsing is robust to format changes.

---

## 14. File Index for Auditor

### Contracts (Solidity)
```
contracts/SashaOracle.sol           (~130 LOC) — X Layer oracle
contracts/SashaDynamicFeeHook.sol   (~120 LOC) — Uniswap v4 hook
contracts/LiquidityHelper.sol       (~130 LOC) — v4 liquidity helper
contracts/SashaAgentLog.sol          (~90 LOC) — Mantle attestation log
```

### Contracts (Rust/Odra — separate repo)
```
github.com/gogrowth-co/sasha-x402-kit
  adapters/casper/contract/         AgentAttest (Odra v2.7)
```

### Execution Scripts (JavaScript/TypeScript)
```
scripts/push-signal-to-xlayer.js    — Oracle keeper (X Layer)
scripts/deploy-xlayer-hook.js       — Hook deploy + CREATE2 mining
scripts/hedge-executor.js           — Hyperliquid delta-neutral hedge
scripts/lp-opener.js                — Base LP position opener
scripts/lp-rebalancer.js            — LP rebalance executor
scripts/lp-harvest.js               — Aerodrome gauge harvest
scripts/auto-trade.js               — Autonomous trade cron entry
scripts/byreal-trade.js             — Solana tweet-before-trade loop
scripts/erc8004-write.js            — Mantle attestation writer
scripts/erc8004-register.js         — ERC-8004 identity registration
scripts/deploy-contract.js          — SashaAgentLog deployer
scripts/mantle-treasury.js          — mETH staking yield loop
scripts/mantle-signal.js            — 5-source signal fusion
scripts/hl-deposit.js               — Hyperliquid funder
scripts/dust-consolidator.js        — Solana dust sweep
scripts/treasury-monitor.js         — Capital pool snapshot
scripts/bridge-to-mantle.js         — LiFi bridge (quote-only)
scripts/build-dashboard-data.js     — Dashboard aggregation
```

### Clawlett Safe Scripts
```
Clawlett/clawlett/scripts/
  initialize.js                     — Safe + Roles deploy
  swap.js                           — KyberSwap via Safe
  cow.js                            — CoW Protocol via Safe
  balance.js                        — Safe balance reader
  trenches.js                       — Trenches token ops
  tokens.js                         — Token resolution
```

### CROO A2A Service
```
croo/src/
  provider.ts                       — CAP provider (WebSocket listener)
  requester.ts                      — CAP requester
  risk-packet.ts                    — LP risk scoring engine
  a2a-buyer.ts                      — Multi-agent A2A buyer
  croo-client.ts                    — AgentClient factory
  free-data.ts                      — Free context data
  reputation-proof.ts               — Reputation proof builder
  services/gas-check.ts             — Gas price service
  services/lp-range-signal.ts       — LP range service
  services/ths-scan.ts              — Token health scan
  services/ths-lookup.ts            — Token health lookup
```

### Documentation
```
docs/okx-buildx-hackathon-submission.md
docs/dorahacks-submission.md
docs/casper-buildathon-build-spec.md
docs/croo-agent-hackathon-winning-strategy-2026-06-26.md
docs/croo-deep-intelligence-brief-2026-06-28.md
docs/decision-log.md
docs/strategy/winning-thesis.md
docs/erc8004-reputation-schema.md
AGENTS.md                           — Code reviewer guide
README.md                           — Project overview
```

---

## 15. Contact

- **Builder:** Gabriel Mangabeira — [@gmangabeira](https://x.com/gmangabeira)
- **Agent:** Sasha — [@SashaCoin95](https://x.com/SashaCoin95)
- **Telegram:** Primary Gabriel ↔ Sasha channel
- **VPS:** Hostinger (root@187.77.42.134), OpenCLAW runtime on Docker

---

*Document prepared 2026-07-04. All addresses verified on-chain as of this date.*