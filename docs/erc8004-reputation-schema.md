# ERC-8004 Reputation Feed Schema v1.0.0

## Overview

This schema defines a portable reputation feed for ERC-8004 AI agents. It is exposed at `/api/sasha-reputation` on any agent running the SashaAgentLog smart contract and OpenClaw runtime.

Sasha is the reference implementation. Any ERC-8004 agent can publish this schema.

---

## Design Principles

1. **Verifiable, not self-reported.** Every trade record links to an on-chain attestation (Mantle) and a Solana transaction signature. Consumers can verify independently.

2. **Pre-trade disclosure enforced.** The `accountability` section records that every trade was preceded by a public X post with a 60-second delay. This is not a claim — it is verifiable via tweet timestamps.

3. **Consumer-ready.** CORS headers are open (`Access-Control-Allow-Origin: *`). Any protocol can query this endpoint without authentication.

4. **Portable.** The `schemaVersion` field allows consumers to handle schema evolution. The `schemaSpec` field points to this document.

---

## Schema Reference

```json
{
  "schemaVersion": "1.0.0",
  "schemaSpec": "<URL to this document>",
  "agent": {
    "name": "string",
    "handle": "string — X/Twitter handle",
    "agentId": "uint256 — ERC-8004 token ID",
    "agentAddress": "0x... — Mantle EOA",
    "chain": "string — identity chain (Mantle)",
    "registeredAt": "ISO 8601",
    "contractAddress": "0x... — SashaAgentLog on Mantle",
    "contractExplorer": "URL"
  },
  "tradeRecord": {
    "totalTrades": "integer",
    "executedTrades": "integer — non-dry-run only",
    "confirmedOnChain": "integer — trades with Solana txSignature",
    "errorCount": "integer",
    "winRate": "float 0..1 — confirmed/executed",
    "signalAccuracy": "float 0..1 — signal direction vs action alignment",
    "actionDistribution": {
      "OPEN_LP_POSITION": "integer",
      "SWAP_TO_SOL": "integer",
      "MOVE_TO_STABLE": "integer"
    },
    "firstTradeAt": "ISO 8601 | null",
    "lastTradeAt": "ISO 8601 | null"
  },
  "recentTrades": [
    {
      "id": "string",
      "executedAt": "ISO 8601",
      "action": "OPEN_LP_POSITION | SWAP_TO_SOL | MOVE_TO_STABLE",
      "pool": "string | null",
      "txSignature": "base58 Solana TX | null",
      "solscanUrl": "URL | null",
      "mantleTx": "0x Mantle attestation TX | null",
      "preTweetId": "string tweet ID | null",
      "rationale": "string (max 200 chars)",
      "status": "executed | dry-run | error"
    }
  ],
  "attestation": {
    "method": "string — ERC-8004 self-transfer + SashaAgentLog event",
    "chain": "Mantle",
    "verifiable": "boolean",
    "lastAttestation": "0x TX hash | null"
  },
  "accountability": {
    "preTradeDisclosure": "boolean — always true for Sasha",
    "disclosureMethod": "X post timestamped before trade execution",
    "disclosureDelay": "60 seconds minimum between post and trade",
    "disclosureHandle": "@SashaCoin95"
  },
  "generatedAt": "ISO 8601"
}
```

---

## Use Cases for Protocol Consumers

### Credit extension
A lending protocol can query `/api/sasha-reputation`, verify `tradeRecord.confirmedOnChain > 10` and `tradeRecord.winRate > 0.6`, and extend Sasha a credit line without human underwriting.

### Copy trading
A copy-trading platform reads `recentTrades` and monitors the Mantle `TradeLogged` event for real-time execution mirroring. The `preTweetId` link provides the reasoning behind each trade.

### Reputation aggregation
A multi-agent reputation registry queries this endpoint alongside other ERC-8004 agent feeds to build a cross-agent leaderboard. The `schemaVersion` ensures backward compatibility.

### Risk gating
A DeFi protocol checks `accountability.preTradeDisclosure === true` and `attestation.verifiable === true` before allowing an agent to interact with its contracts.

---

## Verification Steps

1. Fetch `/api/sasha-reputation` → note `agent.agentId` and `agent.contractAddress`
2. Query `SashaAgentLog.agentStatus()` on Mantle → verify `tradeCount` matches `tradeRecord.executedTrades`
3. For any trade: verify `txSignature` on Solscan and `mantleTx` on Mantle Explorer
4. For pre-trade disclosure: check `preTweetId` on X — timestamp must precede the Solana TX block time
5. Verify `agent.agentAddress` owns the ERC-8004 NFT at `agent.agentId` on Mantle

All five steps can be automated. Sasha's track record cannot be fabricated.

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-05-23 | Initial release — Mantle Turing Test Hackathon |
