# Dune Analytics API Reference
**Last scraped:** 2026-05-13
**Docs source:** https://docs.dune.com/api-reference/overview/introduction
**Auth:** `X-Dune-API-Key` header (preferred) or `?api_key=` query param

## Base URL
`https://api.dune.com/api/v1`

## Authentication

```bash
# Header method (preferred):
curl -H "X-Dune-API-Key: $DUNE_API_KEY" "https://api.dune.com/api/v1/..."

# Query param method:
curl "https://api.dune.com/api/v1/...?api_key=$DUNE_API_KEY"
```

API key from `.env`: `DUNE_API_KEY`. Get from https://dune.com/apis?tab=keys.

**Pricing note:** Execution endpoints consume credits (cost depends on compute). Metadata + status endpoints are free.

---

## MCP Tools (mcp__dune__*)

All Dune MCP tools available in this workspace, sourced from the system deferred tool list:

### Execution

| MCP Tool | Underlying Endpoint | Purpose |
|----------|--------------------|---------| 
| `mcp__dune__executeQueryById` | POST `/query/{id}/execute` | Run an existing saved query by ID |
| `mcp__dune__getExecutionResults` | GET `/execution/{id}/results` | Fetch results of a completed execution |

### Query Management

| MCP Tool | Underlying Endpoint | Purpose |
|----------|--------------------|---------| 
| `mcp__dune__getDuneQuery` | GET `/query/{id}` | Get a saved query's SQL and metadata |
| `mcp__dune__createDuneQuery` | POST `/query` | Create a new saved query |
| `mcp__dune__updateDuneQuery` | PATCH `/query/{id}` | Edit an existing query's SQL or metadata |
| `mcp__dune__searchDuneQueries` | GET `/queries` (filtered) | Search for existing public queries |
| `mcp__dune__listDuneFolders` | GET folders endpoint | List query folders |

### Visualizations

| MCP Tool | Underlying Endpoint | Purpose |
|----------|--------------------|---------| 
| `mcp__dune__generateVisualization` | POST visualization endpoint | Create a visualization from query results |
| `mcp__dune__getVisualization` | GET visualization endpoint | Retrieve a specific visualization |
| `mcp__dune__listQueryVisualizations` | GET `/query/{id}/visualizations` | List all visualizations for a query |
| `mcp__dune__updateVisualization` | PATCH visualization endpoint | Update visualization config |
| `mcp__dune__deleteVisualization` | DELETE visualization endpoint | Remove a visualization |

### Dashboards

| MCP Tool | Underlying Endpoint | Purpose |
|----------|--------------------|---------| 
| `mcp__dune__createDashboard` | POST dashboard endpoint | Create a new dashboard |
| `mcp__dune__getDashboard` | GET dashboard endpoint | Retrieve dashboard content |
| `mcp__dune__updateDashboard` | PATCH dashboard endpoint | Update dashboard layout/title |
| `mcp__dune__archiveDashboard` | PATCH archive endpoint | Archive a dashboard |
| `mcp__dune__searchDuneDashboards` | GET dashboards (filtered) | Search public dashboards |

### Data Discovery

| MCP Tool | Underlying Endpoint | Purpose |
|----------|--------------------|---------| 
| `mcp__dune__searchTables` | GET tables search | Find available blockchain data tables |
| `mcp__dune__searchTablesByContractAddress` | GET tables by contract | Find tables for a specific contract |
| `mcp__dune__listBlockchains` | GET blockchains | List all supported blockchains |
| `mcp__dune__getTableSize` | GET table metadata | Get row count and size for a table |

### Account / Docs

| MCP Tool | Underlying Endpoint | Purpose |
|----------|--------------------|---------| 
| `mcp__dune__getUsage` | GET `/usage` | Check credit usage and billing info |
| `mcp__dune__searchDocs` | Docs search | Search Dune documentation |

---

## Key Endpoints (Underlying REST API)

### Execution Workflow

The standard workflow for running a query:
1. **Execute** → get `execution_id`
2. **Poll status** until `is_execution_finished: true`
3. **Fetch results** with the `execution_id`

#### POST /query/{query_id}/execute
**Purpose:** Trigger execution of a saved Dune query.
**Cost:** Consumes credits (compute-based).

**Path param:** `query_id` (integer) — found in the Dune app URL

**Optional query params:**
- `performance`: `small`, `medium`, or `large` (engine tier, affects cost + speed)

**Optional body:**
```json
{
  "query_parameters": {
    "token_address": "0x...",
    "start_date": "2026-01-01"
  }
}
```

**Response:**
```json
{
  "execution_id": "01JXXXXXXXXXXXXXXX",
  "state": "QUERY_STATE_PENDING"
}
```

```bash
curl -X POST \
  -H "X-Dune-API-Key: $DUNE_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.dune.com/api/v1/query/123456/execute" \
  -d '{"query_parameters": {"token": "AAVE"}}'
```

---

#### POST /sql/execute
**Purpose:** Execute arbitrary SQL directly (no saved query needed).
**Cost:** Consumes credits.

**Body:**
```json
{
  "query_sql": "SELECT * FROM ethereum.transactions LIMIT 10",
  "performance": "medium"
}
```

**Response:** Same as `/query/{id}/execute` — returns `execution_id` + `state`.

```bash
curl -X POST \
  -H "X-Dune-API-Key: $DUNE_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.dune.com/api/v1/sql/execute" \
  -d '{"query_sql": "SELECT block_date, count(*) as txns FROM ethereum.transactions WHERE block_date > now() - interval '\''7 days'\'' GROUP BY 1 ORDER BY 1"}'
```

---

#### GET /execution/{execution_id}/status
**Purpose:** Check if a query execution has finished. Free — no credits consumed.
**Use:** Poll this until `is_execution_finished: true`, then fetch results.

**Response:**
```json
{
  "execution_id": "01JXXX",
  "query_id": 123456,
  "state": "QUERY_STATE_COMPLETED",
  "is_execution_finished": true,
  "submitted_at": "2026-05-13T10:00:00Z",
  "execution_started_at": "2026-05-13T10:00:01Z",
  "execution_ended_at": "2026-05-13T10:00:05Z",
  "expires_at": "2026-05-20T10:00:05Z",
  "execution_cost_credits": 10,
  "result_metadata": {...}
}
```

**Execution states:**
| State | Meaning |
|-------|---------|
| `QUERY_STATE_PENDING` | Queued, awaiting execution slot |
| `QUERY_STATE_EXECUTING` | Currently running |
| `QUERY_STATE_COMPLETED` | Done, results available |
| `QUERY_STATE_FAILED` | Failed — check `error` field |
| `QUERY_STATE_CANCELED` | Canceled by user |
| `QUERY_STATE_EXPIRED` | Results expired (no longer available) |
| `QUERY_STATE_COMPLETED_PARTIAL` | Results truncated (too large) |

```bash
curl -H "X-Dune-API-Key: $DUNE_API_KEY" \
  "https://api.dune.com/api/v1/execution/01JXXX/status"
```

---

#### GET /execution/{execution_id}/results
**Purpose:** Fetch results for a completed execution in JSON format.
**Free if results already cached.** Re-running costs credits.

**Optional query params:**
- `limit`: rows per page
- `offset`: pagination start

**Response includes:** `state`, `result.rows[]`, `result.metadata` (column types, row count)

```bash
curl -H "X-Dune-API-Key: $DUNE_API_KEY" \
  "https://api.dune.com/api/v1/execution/01JXXX/results"
```

---

#### GET /execution/{execution_id}/results/csv
**Purpose:** Same as above but returns CSV format instead of JSON.

---

#### GET /query/{query_id}/results
**Purpose:** Get the most recent cached results for a query directly (no execution needed). Returns JSON. Free if results exist.

```bash
curl -H "X-Dune-API-Key: $DUNE_API_KEY" \
  "https://api.dune.com/api/v1/query/123456/results"
```

---

#### GET /query/{query_id}/results/csv
**Purpose:** Most recent results for a query in CSV format.

---

#### POST /execution/{execution_id}/cancel
**Purpose:** Cancel an in-progress execution.

---

### Query Management

#### GET /query/{query_id}
**Purpose:** Retrieve a saved query's SQL, parameters, and metadata.

#### POST /query
**Purpose:** Create a new saved query.
**Body:** `{name, query_sql, description, parameters[], is_private, tags[]}`

#### PATCH /query/{query_id}
**Purpose:** Update query SQL, name, or description.

#### PATCH /query/{query_id}/archive
**Purpose:** Archive a query (prevents execution or editing).

#### PATCH /query/{query_id}/unarchive
**Purpose:** Restore an archived query.

#### PATCH /query/{query_id}/private
**Purpose:** Make a query private (owner-only).

#### PATCH /query/{query_id}/unprivate
**Purpose:** Make a private query public.

#### GET /queries
**Purpose:** List queries (filterable, paginated).

---

## Common Marketing Use Cases

### Get TVL data for a protocol
1. Search for existing Dune query: `mcp__dune__searchDuneQueries` with keyword "aave tvl"
2. If found: `mcp__dune__executeQueryById` with that query_id
3. Poll status, then `mcp__dune__getExecutionResults`

### Run a custom on-chain SQL query
1. `mcp__dune__createDuneQuery` with the SQL
2. `mcp__dune__executeQueryById` to run it
3. Poll `status`, fetch `results`

### Check credit usage before a batch run
1. `mcp__dune__getUsage` — returns current credit balance and consumption

### Discover available data tables for a blockchain
1. `mcp__dune__listBlockchains` — see all supported chains
2. `mcp__dune__searchTables` with keyword — find relevant tables (e.g., "solana transfers")

---

## Key Rules

1. **Execution costs credits** — status and metadata calls are free; re-check budget with `getUsage` before bulk runs
2. **Always poll status before fetching results** — never assume execution is instant; complex queries can take minutes
3. **Use existing public queries first** — `searchDuneQueries` before writing new SQL saves credits
4. **`query_parameters` are partial** — unspecified params use their query defaults automatically
5. **Results expire** — `expires_at` in status response; expired results require re-execution
6. **`COMPLETED_PARTIAL` state** — result was truncated; add LIMIT to SQL or paginate results
7. **Research-agent owns Dune** — all on-chain data queries route through the research-agent; direct invocation only for single-metric lookups where SQL is already known
