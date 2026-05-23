---
name: dune-analytics
description: >
  On-chain data for content creation, client audits, and protocol research using the
  Dune CLI (primary) and Dune MCP tools (secondary). Use when a task needs blockchain
  metrics: TVL, DEX volume, token flows, wallet activity, protocol revenue, stablecoin
  supply, or any on-chain data needed for blog posts, research briefs, client audits,
  or social content. Triggers: "on-chain data", "Dune query", "protocol on-chain",
  "wallet activity", "DEX volume", "TVL", "token transfers", "blockchain analytics",
  "run a Dune query", "pull on-chain data for [protocol]".
compatibility: Requires Dune CLI v0.1.16+ installed at ~/.local/bin/dune. Authenticated as gmangabeira.
allowed-tools: Bash(dune:*) Bash(curl:*) Read
metadata:
  author: mangabeira
  version: "1.0.0"
  cli_version: "0.1.16"
---

# Dune Analytics — Workspace Skill

This skill wraps the official `dune` skill with workspace-specific context:
multi-account key management, content production patterns, client audit workflows,
and agent routing rules.

**For DuneSQL syntax, CLI command reference, and error recovery →** read the
[official `dune` skill](../dune/SKILL.md) and its `references/` folder.

---

## Quick Start

The CLI is installed and authenticated. Auth is saved to `~/.config/dune/config.yaml`.
Just run queries:

```bash
# Raw SQL (no saved query needed)
dune query run-sql --sql "SELECT blockchain, sum(amount_usd) AS volume FROM dex.trades WHERE block_date > now() - interval '7 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 10" -o json

# Run a saved public query by ID
dune query run 3576664 -o json   # Uniswap v3 daily volume

# Search datasets before writing SQL
dune dataset search "uniswap trades" -o json | head -40

# Search documentation
dune docs search --query "how to query stablecoin supply"
```

---

## Multi-Account Key Management

Three keys are available in the marketing workspace `.env`:

| Env Var | Dune Handle | Use for |
|---|---|---|
| `DUNE_API_KEY_GMANGABEIRA` | `gmangabeira` | **Default.** Personal brand, all projects, client research |
| `DUNE_API_KEY` | `manga82` | Fallback / secondary |
| `DUNE_API_KEY_SASHA_COIN` | sasha-coin persona | Sasha Coin content only |

**Always use `DUNE_API_KEY_GMANGABEIRA` unless the task is Sasha Coin.**

Override inline with `--api-key $DUNE_API_KEY_GMANGABEIRA` or `export DUNE_API_KEY=$(grep DUNE_API_KEY_GMANGABEIRA .env | cut -d= -f2)`.

The CLI is already configured with gmangabeira via `dune auth`. No export needed for default use.

---

## Two Execution Paths

### Path 1: Dune CLI (preferred for new queries + content production)

Use the CLI (`dune query run-sql`, `dune query run`, `dune dataset search`) when:
- Writing fresh SQL for a specific protocol or metric
- Producing charts/tables to embed in blog posts or research briefs
- Running multi-step analysis with iterative SQL refinement
- Creating and saving reusable queries for recurring content

CLI outputs clean text tables or JSON. Use `-o json` always for downstream parsing.

### Path 2: Dune MCP Tools (preferred for existing saved queries)

Use `mcp__dune__*` tools when:
- Executing a known public query by ID (faster, less SQL needed)
- Searching for existing public queries before writing new SQL
- Managing dashboards programmatically
- Checking credit usage mid-session

See [endpoints.md](references/endpoints.md) for the full MCP tool reference.

---

## Content Production Patterns

### Pattern 1 — Protocol TVL / Revenue Chart for Blog Post

```bash
# 1. Find the best existing query
dune query search "aave tvl daily" -o json | head -60

# 2. Run it (or write custom SQL)
dune query run-sql --sql "
SELECT
  date_trunc('day', block_time) AS day,
  sum(amount_usd) AS tvl_usd
FROM aave_v3_ethereum.borrow_evt
WHERE block_time > now() - interval '90 days'
GROUP BY 1 ORDER BY 1
" -o json > /tmp/aave_tvl.json

# 3. Render as markdown table for embedding in article
dune query run-sql --sql "..." -o text
```

### Pattern 2 — DEX Volume Snapshot for Social Post

```bash
dune query run-sql --sql "
SELECT
  project,
  sum(amount_usd) AS volume_7d
FROM dex.trades
WHERE block_date >= current_date - interval '7' day
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10
" -o text
```

### Pattern 3 — Token Flow for Client Audit

```bash
# Find all decoded tables for a contract address
dune dataset search-by-contract 0x... -o json

# Then query relevant event tables
dune query run-sql --sql "
SELECT evt_block_time, amount, receiver
FROM protocol_ethereum.Token_evt_Transfer
WHERE evt_block_time > now() - interval '30 days'
ORDER BY 1 DESC LIMIT 100
" -o json
```

### Pattern 4 — Stablecoin Supply for Research Brief

```bash
dune query run-sql --sql "
SELECT
  symbol,
  sum(amount) AS circulating_supply
FROM tokens.erc20_stablecoins
WHERE block_date = current_date - interval '1' day
GROUP BY 1
ORDER BY 2 DESC
" -o text
```

---

## Content Use Case Reference

| Content Need | SQL Target | Key Tables |
|---|---|---|
| DeFi protocol TVL | Historical locked value | `dex.trades`, `lending.borrow`, `lending.repay` |
| DEX volume (weekly/monthly) | Trading volume by protocol | `dex.trades` |
| Token distribution/wallets | Top holders, whale activity | `erc20_ethereum.evt_Transfer` |
| Stablecoin supply | Circulating supply by chain | `tokens.erc20_stablecoins` |
| Gas trends | Avg gas price over time | `ethereum.transactions` |
| NFT market volume | Sales by marketplace | `nft.trades` |
| Protocol revenue | Fee revenue | protocol-specific event tables |
| L2 activity | Tx count, unique users | chain-specific tx tables |
| Bridge flows | Cross-chain volume | bridge protocol tables |

---

## Client Audit Workflow

For Gabriel's 6-pillar token audits, on-chain layer:

1. **Discover tables** for the client's contract:
   ```bash
   dune dataset search-by-contract <CONTRACT_ADDRESS> -o json
   ```

2. **Pull token metrics** (volume, holders, transfers):
   ```bash
   dune query run-sql --sql "SELECT ..." -o json
   ```

3. **Save reusable query** for the client:
   ```bash
   dune query create --name "ClientName Token Analysis" --sql "..." --private
   ```

4. **Export results** to `/tmp/[client-slug]-onchain-[date].json` then format for the audit report.

---

## Credit Cost Awareness

| Operation | Credit Cost |
|---|---|
| `dune query run-sql` simple query | 1-5 credits |
| `dune query run-sql` complex join/aggregation | 10-50 credits |
| `dune query run <saved-id>` (cached result) | 0 (free if cached) |
| `dune dataset search` | 0 (free) |
| `dune docs search` | 0 (free) |

**Always check credit balance before bulk runs:**
```bash
dune usage -o json
```

**Cost discipline:**
- Search for existing public queries first (`dune query run` on a public ID reuses cached results = free)
- Add `LIMIT` clauses; avoid full-table scans on ethereum.transactions
- Use partition filters: `WHERE block_date >= date '2026-01-01'` not `WHERE block_time > ...`

---

## Agent Routing

| Task | Owner |
|---|---|
| Protocol metrics for a research brief | research-agent (uses this skill) |
| TVL/volume chart for blog post | content-writer (uses this skill) |
| On-chain layer of client token audit | research-agent (uses this skill) |
| Single metric lookup (known query ID) | Direct CLI invocation (no agent needed) |
| Recurring on-chain monitoring | data-analyst via MCP tools |

**Agents that use this skill:**
- `research-agent` — primary owner for market intelligence and protocol analysis
- `content-writer` — on-chain data points for blog posts, social content
- `data-analyst` — cross-reference with GA4/GSC for combined performance + on-chain reports
- `token-health-scan-am` — token metrics for THS audit workflows
- `sasha-coin-am` — crypto narrative data for Sasha Coin content (use `DUNE_API_KEY_SASHA_COIN`)

---

## Sim API (Real-Time Wallet Data)

The `sim` skill (also installed) provides real-time wallet/token lookups without SQL:

```bash
dune sim balance <WALLET_ADDRESS>     # token balances
dune sim tokens <TOKEN_ADDRESS>       # token metadata + price
dune sim nfts <WALLET_ADDRESS>        # NFT holdings
```

Use `sim` for live wallet snapshots. Use the main `dune query` path for historical analytics.

---

## Key Rules

1. **Use `DUNE_API_KEY_GMANGABEIRA` by default** — it's already saved in `~/.config/dune/config.yaml`
2. **`-o json` always** — text output drops fields; JSON is complete
3. **Search before writing SQL** — `dune dataset search` + public query reuse = zero credits
4. **Always filter on partition columns** — `block_date` not `block_time` for cost control
5. **Save useful queries** — `dune query create --private` for client-specific analysis
6. **Read the official `dune` skill** for DuneSQL cheatsheet, error recovery, and advanced CLI patterns
