# Nansen MCP — Full Tool Reference

Source: docs.nansen.ai/mcp/tools.md (fetched 2026-08-06). All 24 tools exposed by the
`nansen` MCP server. Most tools wrap arguments in `{"request": {...}}`; `general_search`
and `transaction_lookup` use flat arguments instead — check the tool's own input schema
via ToolSearch before calling if unsure.

## Smart Money (5 credits each)

| Tool | Description |
|---|---|
| `smart_traders_and_funds_token_balances` | Smart money holdings & 24h changes for a token |
| `smart_traders_and_funds_perp_trades` | Smart money perpetual trades (Hyperliquid) |

## Token (mostly 1 credit)

| Tool | Description | Credits |
|---|---|---|
| `token_current_top_holders` | Top token holders with labels | 5 |
| `token_dex_trades` | DEX trading activity for a token | 1 |
| `token_transfers` | Token transfer history | 1 |
| `token_flows` | Hourly aggregated token flows by segment | 1 |
| `token_pnl_leaderboard` | Trader PnL rankings for a token | 5 |
| `token_who_bought_sold` | Total bought/sold by address (DEX) | 1 |
| `token_recent_flows_summary` | Flow summary by segment (Smart Money, Whales, etc.) | 1 |
| `token_discovery_screener` | Multi-chain token screening with filters | 1 |
| `token_ohlcv` | OHLCV price data with auto interval | 1 |
| `token_quant_scores` | Quantitative scores for a token | 2 |
| `nansen_score_top_tokens` | Top tokens ranked by Nansen score | 1 |

## Address / Wallet (mostly 1 credit)

| Tool | Description | Credits |
|---|---|---|
| `address_historical_balances` | Historical token & native coin balances | 1 |
| `address_related_addresses` | First funders, signers, deployed contracts | 1 |
| `address_counterparties` | Most interacted addresses/entities | 5 |
| `address_transactions` | Recent transactions for an address | 1 |
| `wallet_pnl_for_token` | PnL for a specific token by wallet | 1 |
| `wallet_pnl_summary` | Overall realized PnL for a wallet | 1 |
| `address_portfolio` | Full portfolio overview & DeFi positions | 1 |

## Search & Lookup

| Tool | Description | Credits |
|---|---|---|
| `general_search` | Search tokens/addresses — cost varies by what's searched | 0-500 |
| `transaction_lookup` | Transaction details with transfers (EVM) | 1 |

## Chain / Market Level

| Tool | Description | Credits |
|---|---|---|
| `growth_chain_rank` | Chain growth rankings by key metrics | 1 |
| `hyperliquid_leaderboard` | Top Hyperliquid traders leaderboard | 9 |

## Agent (natural-language, chains multiple lookups internally)

| Tool | Description | Credits |
|---|---|---|
| `agent/fast` | Query Nansen Agent in fast mode | 200 |
| `agent/expert` | Query Nansen Agent in expert mode | 750 |

Both accept natural-language questions. Expensive relative to a single targeted tool
call — reserve for genuinely multi-step questions, not routine lookups.

## Notes

- **`address_labels`** appears in Nansen's REST API docs (100-500 credits, common vs.
  premium labels) but is reached through `general_search` in the MCP tool set, not as
  its own named MCP tool — cost varies accordingly.
- Auth header for the MCP server specifically is `NANSEN-API-KEY` (uppercase, hyphenated)
  — do not confuse with the REST API's separate lowercase `apikey` header.
- Full REST API endpoint reference (broader than the 24 MCP tools, useful if a future
  task needs raw HTTP calls instead of MCP): docs.nansen.ai/api/overview.md
