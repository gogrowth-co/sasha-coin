# Dune Analytics: Execution, Cost, and Best Practices

Practical reference for an AI agent that runs DuneSQL queries programmatically: which execution path to use, how credits are spent, and how to write queries that do not waste them.

Source: docs.dune.com, distilled 2026-06-07. Endpoint-by-endpoint detail lives in `references/endpoints.md` in this same folder. This file covers the execution model, cost, and practices, not the individual endpoints.

---

## 1. Execution paths: when to use each

There are four ways to run DuneSQL. They all hit the same engine and the same data, and they all consume credits the same way. The difference is the interface and the workflow it fits.

| Path | What it is | Best for | Notes |
|---|---|---|---|
| **Dune MCP** (`mcp__dune__*`, already wired here) | Dune's official remote MCP server at `https://api.dune.com/mcp/v1`. Tools for table discovery, query create/run, result fetch, visualizations, dashboards, usage. | Agent-driven ad-hoc on-chain questions and exploration. Discover the right table, write SQL, run it, read results, all in one conversation. | Preferred for the research-agent's typical work. Tools include `searchTables`, `searchTablesByContractAddress`, `getTableSize`, `createDuneQuery`, `executeQueryById`, `getExecutionResults`, `getUsage`. |
| **Data API (REST)** | `https://api.dune.com/api/v1`, auth via `X-Dune-API-Key` header (or `?api_key=`). Execute ad-hoc SQL, execute a saved query by id, poll status, fetch JSON/CSV. | Repeatable pipelines, scheduled jobs, embedding results in apps, anything scripted outside a chat. | Endpoints documented in `references/endpoints.md`. Has SDKs: `pip install dune-client`, `npm install @duneanalytics/client-sdk`. |
| **Dune CLI + Skills** | Terminal-native `dune` CLI (install: `curl -sSfL https://dune.com/cli/install.sh | sh`). Every command supports `-o json`. | Quick terminal runs, CI/CD scripting, when you want JSON output piped into other tools without writing HTTP calls. | `dune query run-sql --sql "..." -o json`. Auth stored at `~/.config/dune/config.yaml` or `$DUNE_API_KEY`. |
| **Trino connector** | Standard Trino/Presto/Starburst client against `trino.api.dune.com:443`, catalog `delta_prod`, user `dune`, password = API key. | Connecting BI tools (Hex, Metabase, DBeaver) or treating Dune like a database from any Trino SDK. | All connector queries run on the **Large** engine. Limited `SHOW TABLES` support. |
| **dbt / Data Transformations** | dbt models materialized into your Dune namespace via the Trino connector. | Heavy, scheduled, materialized transformation pipelines (Enterprise-only). | Each run costs credits (compute + write + storage). CI/CD triggers ship disabled by default. Not for ad-hoc reads. |
| **MPP** (Machine Payment Protocol) | Pay-per-request via crypto micropayments (HTTP 402), no account or API key. | Niche: agents with no Dune account that pay per call. | Always close the session to refund unspent deposit. Not the default here, since we have a key. |

**Recommendation for this workspace:**
- For a one-off on-chain question ("what was DEX volume on Base last week"), use the **Dune MCP**. It discovers the table, writes the SQL, runs it, and returns rows in one turn.
- For anything that repeats (a daily report, a monitor, a dashboard feed), save the query once and hit the **Data API** by query id on a schedule. Re-running a saved query is cheaper to maintain and lets you fetch the latest result without re-executing.

---

## 2. Credit and cost model

You pay only for what you use. There is no flat platform fee. Credits are spent along several dimensions.

**Executions (compute).** Credits scale with the actual compute resources a query consumes, which is driven by how much data it scans and how complex it is (joins, aggregations, execution time). The performance tier you pick multiplies this.

**Performance tiers** (set per execution via the `performance` field, default `medium`):

| Tier | Compute | Use for |
|---|---|---|
| `medium` | 1x | Most queries. The default. |
| `large` | 2x | Complex queries: joins across large tables, heavy aggregations that time out on medium. |

Both tiers get an extended timeout and priority queue. Pick `large` only when `medium` is too slow or times out, because it costs roughly double the compute.

**Data export (fetching results).** Credits are charged per MB of result data exported via API or CSV, and the rate depends on plan:

| Plan | Credits per MB exported |
|---|---|
| Free | 20 |
| Analyst | 10 |
| Plus | 2 |
| Enterprise | Custom |

This is why fetching only the columns and rows you need matters: export cost is proportional to data volume returned (datapoints).

**Data writes** (table creation, inserts, uploads): ~3 credits per GB written, minimum 1 credit per write operation. Only relevant if the agent uploads tables or runs dbt.

**Storage:** per-plan caps (Free 100 MB, Analyst 1 GB, Plus 15 GB), not charged per credit on lower plans. dbt/Enterprise storage is billed at ~4 credits per GB per month.

**Free vs. paid operations:**
- **Free / metadata:** checking execution status, fetching an already-computed result you have not pulled before is charged on export, but status polling and usage checks (`getUsage`) are not compute. Table discovery and `getTableSize` estimates are cheap metadata calls.
- **Paid:** executing a query (compute), exporting results (per MB), writing data, materialized-view refreshes.

**Two cost traps to know:**
- **Failed executions are still charged.** If a query runs and fails, you pay for the compute it used before failing. A query that runs 30 minutes then times out still bills for that compute.
- **Execute-but-never-fetch:** if you execute and never pull results, you are charged only for the execution (compute), not for export. So a wasted execution still costs compute.

**Rate limits** (requests per minute, not credits): Free 40/min, Plus 200/min, Enterprise custom.

**How to minimize spend:** filter on time and partition columns so the engine scans less, develop with `LIMIT`, default to `medium`, select only needed columns on export, sample large result sets for charts, and fetch the latest stored result instead of re-executing when the data has not changed.

---

## 3. Best practices for efficient queries

1. **Filter on time first.** Always put a `block_time` (or equivalent partition) bound in the `WHERE` clause. This is the single biggest lever on scan cost. Partition pruning means the engine reads far less data.
   ```sql
   -- good: scans a bounded window
   WHERE block_time > now() - interval '7' day
   -- bad: scans all history
   WHERE amount_usd > 1000
   ```
2. **Use `LIMIT` during development.** Iterate on a `LIMIT 100` version, confirm shape and correctness, then remove the limit for the real run. Do not burn compute re-running full scans while debugging SQL.
3. **Prefer curated tables over raw.** Curated/decoded tables (`dex.trades`, decoded event tables) are pre-joined and pre-cleaned, so they scan less and are faster than assembling the same view from raw `*.logs` or `*.transactions`. Use `searchTablesByContractAddress` to find decoded tables for a contract.
4. **Select only the columns you need.** Both in SQL and in the result fetch (`columns=` param). Export cost scales with returned data, so do not pull 50 columns when you need 5.
5. **Estimate before you run.** Use `getTableSize` (MCP) to gauge how much data a query will scan before committing to a `large`-tier run.
6. **Materialize repeated reads.** If the same expensive query feeds a dashboard or runs on a schedule, save it as a query (or a materialized view on Enterprise) and read its stored result instead of re-executing each time.
7. **Fetch the latest result instead of re-executing.** If the underlying data has not changed since the last run, call the latest-result path. In the Python SDK: `dune.get_latest_result(query_id)` returns the most recent stored result with zero compute cost (you still pay export). Re-execute only when you need fresh data.
8. **Default to `medium`, escalate to `large` only on need.** Reach for `large` (2x compute) only when `medium` times out or is genuinely too slow.
9. **Sample for visualization.** A chart with 4000 px does not need 1M rows. Use `sample_count` to pull a uniform subset and cut latency and export cost.

---

## 4. Result filtering, pagination, sorting, sampling

The Data API can refine results **server-side without re-running the query**, on all `/results` endpoints (execution results, query results, and their CSV variants). This saves bandwidth and export credits versus pulling everything and filtering client-side.

- **`filters`**: SQL-like `WHERE` clause on the stored result. Format `<column> <operator> <value>`, combine with `AND` / `OR` and parentheses, `IN (...)` allowed. Example: `block_time >= '2024-03-05' AND (project = 'uniswap' OR project = 'balancer')`.
- **`columns`**: comma-separated list, no spaces (`tx_from,tx_to,amount_usd`). Reduces export cost.
- **`sort_by`**: e.g. `amount_usd desc, block_time`.
- **Pagination**: `limit` + `offset` on the low-level calls; the SDK's high-level functions (`get_latest_result_dataframe`, `run_query`) paginate automatically and return the full set. Use `batch_size` to tune rows per page.
- **Sampling**: `sample_count=N` returns a uniform random subset. Ideal for charting large results.

**The relative-time gotcha (important):** result filters do **not** support SQL expressions. `now() - interval '1' day` is rejected in a `filters=` string. Filter values must be plain strings or numbers. Compute the date **client-side** and pass an absolute timestamp:
```python
# wrong: relative expression in an API result filter -> error
filters = "block_time > now() - interval '1' day"

# right: compute the cutoff in code, pass an absolute string
from datetime import datetime, timedelta
cutoff = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d %H:%M')
filters = f"block_time > '{cutoff}'"
```
Note this applies only to API **result filters**. Inside the SQL body itself (in `/sql/execute` or a saved query), `now() - interval '1' day` is fine.

---

## 5. Execution lifecycle (for polling)

Async model: execute returns an `execution_id`, then poll status until terminal, then fetch results. States:

- `QUERY_STATE_PENDING`: waiting for a slot.
- `QUERY_STATE_EXECUTING`: running.
- `QUERY_STATE_COMPLETED`: done, results available.
- `QUERY_STATE_FAILED`: terminal, response carries an `error` object (type, message, line, column).
- `QUERY_STATE_CANCELED`: canceled by user.
- `QUERY_STATE_EXPIRED`: result no longer available (results are retained ~90 days).
- `QUERY_STATE_COMPLETED_PARTIAL`: succeeded but truncated because too large; pass `allow_partial_results: true` to fetch the truncated set.

The Python SDK's `run_sql()` / `run_query()` handle execute-and-poll for you. Raw cURL must poll the status endpoint manually.

---

## 6. Key gotchas

- **Relative time is banned in API result filters.** `now() - interval ...` errors out in a `filters=` string. Compute absolute timestamps client-side. (Inside the SQL body it is fine.)
- **Failed executions are still billed.** A query that runs and then fails or times out costs the compute it used. Bound queries with time filters and `LIMIT` while developing.
- **`large` tier is roughly 2x compute.** Do not default to it. Use `medium` unless the query times out.
- **Export is charged per MB, and the per-MB rate is steep on Free (20 credits/MB).** Always select only needed columns and sample large results, or export cost dominates.
- **The `NOT` operator is not supported in result filters.** `NOT IN` and `NOT LIKE` error. Rewrite as positive conditions.
- **Re-executing wastes credits when data has not changed.** Use `get_latest_result(query_id)` or the latest-result endpoint to read the stored result with no compute cost.
- **Results expire after ~90 days.** An old `execution_id` may return `QUERY_STATE_EXPIRED`. Re-execute if you need it again.
- **All Trino-connector queries run on the Large engine.** Pulling Dune through a BI tool or Trino SDK costs 2x compute by default, with no `medium` option.
- **Codex MCP clients time out at 60s on long polls.** Not our default client, but if used, raise `tool_timeout_sec`. Generic warning for any MCP client with a short tool timeout running long queries.
- **dbt / Data Transformations is Enterprise-only and bills compute + writes + storage.** Not a path for ad-hoc reads. Keep its CI/CD triggers disabled unless deliberately enabled.
