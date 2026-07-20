# DoraHacks BUIDL Submission — sasha-x402-kit

**Submission deadline:** June 30, 2026 · **Track:** Casper Innovation Track
**Repo:** https://github.com/gogrowth-co/sasha-x402-kit
**Demo video:** https://youtu.be/z3LX7MbsC5o
**Live submission:** https://dorahacks.io/buidl/45337

---

## BUIDL Title
sasha-x402-kit

## Short Description (tagline — paste into the "Short intro" field)
An autonomous AI agent that makes its real DeFi book verifiable and payable on Casper over the x402 payment protocol. Every decision is attested on-chain. Anyone can verify it.

---

## Full Description (paste into the main description field)

### The problem with AI agents in DeFi

Most DeFi agents make claims. They post "I bought X" and "I earned Y." But the proof lives in a database the agent controls. That's a diary, not a proof. Any agent can write anything there.

The credibility gap is the core problem: there is no native way for an autonomous agent to make its decisions **cryptographically verifiable** by outsiders, and no standard mechanism for other agents to pay for verified data without a human intermediary.

---

### What sasha-x402-kit does

This kit closes both gaps in a four-verb autonomous loop:

| Verb | What it does | Status |
|---|---|---|
| **PAY** | Buys the signals it acts on over x402 (HTTP 402 → EIP-712 sign → settle on Casper) | ✅ Shipped |
| **ACT** | Manages a real testnet position using the paid signals | Roadmap |
| **ATTEST** | Writes every decision to an on-chain `AgentAttest` contract — immutable, public, verifiable | ✅ Shipped |
| **EXPOSE** | Serves the agent's verified yield as an x402-payable feed other agents can buy | Roadmap |

PAY and ATTEST are live on `casper-test` today. Every claim below is a real transaction — click to verify.

---

### Live on Casper Testnet

| What | Transaction |
|---|---|
| `AgentAttest` contract deploy | [`577570f2…dba0bfff`](https://testnet.cspr.live/transaction/577570f2f5f486353b8d2e61f7328fca34cd8446053d643ebc395344dba0bfff) |
| Agent loop — PAY (x402 `402→settle`) | [`b419bbcb…13cc5f2b`](https://testnet.cspr.live/transaction/b419bbcbcbefaa6da97eb4e5251461c691ba436f8f6921a316ea82c213cc5f2b) |
| Agent loop — ATTEST (decision written on-chain) | [`1f063cc2…dec62f6893`](https://testnet.cspr.live/transaction/1f063cc2d3567079cfac9075c3120d9b15deddcdec2a71eb75fc6fdec62f6893) |

`AgentAttest` package hash: `7b4bb374af24ee46a067f4d41f5cba61b097ba613825617e81a57d7673132262`

---

### Why this is different

**A real book, not a demo agent.** The agent behind this kit — [Sasha](https://x.com/SashaCoin95) — runs a live delta-neutral LP/treasury book on Base and Solana and posts it publicly. She can attest a book because she actually runs one. This isn't a demo moving fake tokens around.

**Verifiable, not claimable.** Every decision cycle writes to `AgentAttest` on Casper. The chain doesn't trust the agent's word. It stores a cryptographic proof. That's a different category of trustworthiness than agents that log to a database they control.

**Chain-agnostic architecture.** The core imports no chain SDK. All chain specifics live behind a `SettlementAdapter` interface. The Casper adapter is built first and proven end-to-end before any EVM adapter starts, so "chain-agnostic" is proven in code, not just claimed.

---

### Architecture

```
core/                         chain-agnostic — imports NO chain SDK
  settlement_adapter.go        SettlementAdapter interface
  types.go                     chain-neutral types

adapters/
  casper/                      FLAGSHIP (shipped)
    contract/                  Odra (Rust) AgentAttest contract — clean-room ERC-8004 pattern
    casper_adapter.go          headless TransactionV1 signing via casper-go-sdk
    x402_scheme.go             EIP-712 typed-data x402 pay scheme (casper-eip-712)
  evm/                         PROOF adapter (Base Sepolia) — roadmap

agent/loop.go                  PAY → ACT → ATTEST → EXPOSE orchestrator
cmd/{attest,agent}/            runnable entrypoints
```

**Stack:** Rust + [Odra](https://github.com/odradev/odra) v2.7 (CasperVM/WASM) · [casper-go-sdk](https://github.com/make-software/casper-go-sdk) · [`casper-eip-712`](https://github.com/casper-ecosystem/casper-eip-712) · [`make-software/casper-x402`](https://github.com/make-software/casper-x402) facilitator · CSPR.cloud testnet RPC

The `AgentAttest` contract is **clean-room original**. CEP-18 for x402 settlement and the facilitator come from Apache-2.0 projects (`odradev/casper-x402-poc`, `make-software/casper-x402`) used as dependencies, not vendored. Full attribution in [`THIRD_PARTY_NOTICES.md`](https://github.com/gogrowth-co/sasha-x402-kit/blob/main/THIRD_PARTY_NOTICES.md).

---

### Security

- Testnet only. No production keys in the repo.
- `scripts/secret-scan.sh` runs as a pre-commit hook and in CI on every push — blocks PEM/env/credential material across full git history.
- `.env`, `*.pem`, `keys/`, and `state/` are gitignored.

---

### Real project — what runs after the buildathon

This is not a throwaway hackathon entry. It's a new on-chain capability for a live agent.

**Who Sasha is:** An autonomous AI agent on Base — X [@SashaCoin95](https://x.com/SashaCoin95), YouTube [@SashaCoin](https://youtube.com/@SashaCoin), $SASHA token on creator.bid. She runs a real delta-neutral LP/treasury book and posts it publicly. Her co-host Max Ledge runs the Token Trends podcast. She operates on OpenCLAW, a custom autonomous runtime on a VPS.

**What this adds:** Her book becomes verifiable on Casper (every decision attested on-chain) and payable over x402 — a verified-yield feed other agents can buy.

**Post-buildathon roadmap:**
- Keep `AgentAttest` live on Casper mainnet (post-testnet) — attesting every decision cycle
- Stand up the x402-payable verified-yield feed using ecosystem credits as the bootstrap subsidy
- Ship the EVM proof adapter (Base Sepolia) to demonstrate the chain-agnostic seam
- ACT leg (live testnet position management) as Phase 2 once the feed has a real buyer

**Why Casper:** WebAssembly-native L1 with the x402 facilitator already in production, EIP-712 support in the CEP-18 standard, and the Odra framework with AI-accessible `llms.txt`. The trust layer for the agent economy.

---

## Tags to select on DoraHacks
- Agentic AI
- DeFi
- Casper Network
- x402
- Smart Contracts
- Open Source

## GitHub URL
https://github.com/gogrowth-co/sasha-x402-kit

## Demo Video
https://youtu.be/z3LX7MbsC5o
Source file: /Users/gabrielmangabeira/dev/sasha-x402-kit/demo/renders/demo_2026-06-16_09-31-12_voiced.mp4

---

## Checklist before submitting

- [x] Demo video uploaded to YouTube (voiced MP4, ~75s) — https://youtu.be/z3LX7MbsC5o
- [x] YouTube URL pasted into DoraHacks demo video field — confirmed live on https://dorahacks.io/buidl/45337
- [x] GitHub URL confirmed: https://github.com/gogrowth-co/sasha-x402-kit
- [x] All 3 tx hashes clickable on testnet.cspr.live
- [x] Short description (tagline) filled in
- [x] Full description pasted
- [x] Tags selected
- [x] Hero image: sasha-hero.png (in repo assets/)
- [x] Submission status set to "submitted" before June 30 21:00 UTC — verified live 2026-07-05

**Known issue on the live page:** the published description has stray internal editing notes leaked in ("The lead paragraph is the critical change — ... Everything else is existing content restructured...") between the roadmap table and the closing "Agent behind this kit" paragraph. Needs a manual edit via the DoraHacks editor (requires Gabriel's login) to remove.
