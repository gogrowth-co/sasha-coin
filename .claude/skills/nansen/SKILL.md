---
name: nansen
description: |
  On-chain wallet intelligence via the Nansen MCP server: Smart Money flows/holdings,
  token holder/flow analytics, wallet PnL and portfolio data, address labels, and
  Hyperliquid perp trading data. Auth: $NANSEN_API_KEY from .env, connected as an MCP
  server (no curl needed once registered).
  Use when: tracking Smart Money buy/sell flows on a token, checking who holds a token
  and how concentrated it is, pulling a wallet's PnL or transaction history, finding
  wallet labels/entity tags, screening tokens by on-chain quant score, or researching
  Hyperliquid perp trader activity.
  Triggers: "smart money", "wallet flows", "who's buying/selling", "token holders",
  "wallet PnL", "on-chain wallet intelligence", "Nansen", "address labels",
  "Hyperliquid leaderboard", "wallet portfolio", "counterparty analysis".
metadata:
  author: mangabeira
  version: "1.0.0"
---

# Nansen

Nansen layers wallet-level intelligence on top of raw on-chain data: who is holding a
token, which "Smart Money" wallets are buying or selling it right now, what a specific
address's PnL and portfolio look like, and how wallets are connected to each other. This
is the tool for "who is actually behind this on-chain move," not just "what happened
on-chain" (that's Dune) or "what's the price/market data" (that's CoinGecko).

Accessed as an MCP server — tools are called directly once connected, no curl/API-key
plumbing needed in the conversation itself.

## When to Use vs Alternatives

| Task | Use |
|---|---|
| Smart Money buy/sell flow on a token | Nansen `smart_traders_and_funds_token_balances` |
| Who holds a token, how concentrated | Nansen `token_current_top_holders` |
| Raw on-chain SQL / custom queries | Dune Analytics |
| Token price / market cap | CoinGecko or CoinMarketCap |
| Social sentiment | LunarCrush (currently 402'd on our plan) or Elfa |
| Protocol TVL / revenue | Messari or DefiLlama |
| Wallet PnL / transaction history for one address | Nansen `wallet_pnl_summary`, `address_transactions` |
| Wallet labels / entity identification | Nansen `address_labels` (via `general_search`, cost varies) |
| Hyperliquid perp trader leaderboard | Nansen `hyperliquid_leaderboard` |
| Swap-level trade data with wash-trade filtering | Bitquery MCP |

## Auth

`$NANSEN_API_KEY` from `.env` (also propagated to Token Health Scan's `.env` via
`scripts/sync-env.mjs` — `NANSEN_API_KEY` is in `SHARED_KEYS`).

Registered as an MCP server in `.mcp.json` (both `marketing/` and `token-health-scan/`):

```json
"nansen": {
  "type": "streamable-http",
  "url": "https://mcp.nansen.ai/ra/mcp/",
  "headers": { "NANSEN-API-KEY": "$NANSEN_API_KEY" }
}
```

**Note the header name is `NANSEN-API-KEY` for the MCP server specifically** — the
separate Nansen REST API (not used by this skill) uses a different, lowercase `apikey`
header. Don't conflate the two if debugging auth failures.

Project-scope `.mcp.json` changes require a new Claude Code session to take effect — if
`nansen` tools don't show up via `ToolSearch`, that's why; start a fresh conversation.

## Credits & Cost Caution

Nansen bills per-call in credits, tiered by endpoint (see full table in
[references/tools.md](references/tools.md)). Most Profiler/Token God Mode calls are
1 credit. A few are expensive and need a deliberate check before calling:

- **`general_search`**: 0-500 credits, highly variable — check what it's about to search
  before firing it broadly.
- **`agent/fast`** (200 credits) and **`agent/expert`** (750 credits) — natural-language
  query tools that internally chain multiple lookups. Reserve for genuinely complex
  questions a single targeted tool call can't answer; don't reach for these as a first
  resort when a specific tool (e.g. `token_current_top_holders`) does the job for 1-5
  credits.
- **`address_labels`** (100-500 credits) and the `*_leaderboard`/`historical-*` family
  (5-25 credits) are mid-tier — fine to use, just not reflexively in a loop.

If a task would call a 100+ credit tool more than a handful of times, flag the estimated
cost to Gabriel before proceeding, same standard as the `apify-mcp` skill's cost-check rule.

## Key Tools Summary

Full list (24 tools) with descriptions and credit costs in
[references/tools.md](references/tools.md). Most-used:

| Tool | Purpose | Credits |
|---|---|---|
| `smart_traders_and_funds_token_balances` | Smart Money holdings & 24h changes for a token | 5 |
| `token_current_top_holders` | Top holders with labels | 5 |
| `token_dex_trades` | DEX trading activity for a token | 1 |
| `token_recent_flows_summary` | Flow summary by segment (Smart Money, Whales, etc.) | 1 |
| `token_discovery_screener` | Multi-chain token screening with filters | 1 |
| `wallet_pnl_summary` | Overall realized PnL for a wallet | 1 |
| `address_transactions` | Recent transactions for an address | 1 |
| `address_portfolio` | Full portfolio overview & DeFi positions | 1 |
| `address_related_addresses` | First funders, signers, deployed contracts | 1 |
| `hyperliquid_leaderboard` | Top Hyperliquid traders leaderboard | 9 |

## Chain Coverage

Multi-chain (25+ per Nansen's own marketing), with Solana and Hyperliquid perps given
first-class tool support (Jupiter DCA tracking, Hyperliquid-specific leaderboards and
positions) beyond standard EVM coverage.
