# Dune Data Catalog (Distilled)

Practical map of Dune's table taxonomy for writing DuneSQL on-chain queries: the four-layer model, raw EVM tables, the canonical cross-chain curated tables, the multichain pattern, and how to find the right table.

Source: docs.dune.com data-catalog, distilled 2026-06-07. Column names below are taken verbatim from the docs. Where a column is not confirmed in the dump, the text says "see docs" instead of guessing.

---

## 1. The four-layer model

Every on-chain event flows through up to four layers of tables. One swap (for example) writes rows into raw, decoded, and curated tables simultaneously. You do not pick a layer by what data exists. You pick the layer that matches the question: the higher the layer, the more cleaning and cross-protocol normalization Dune has already done, the less SQL you write, and the less control you have over edge cases.

| Layer | Naming convention | Maintained by | What it is | Reach for it when |
|---|---|---|---|---|
| **Raw** | `<chain>.transactions`, `<chain>.traces`, `<chain>.logs`, `<chain>.blocks` | Dune (ingestion) | Direct, undecoded ingest of the chain. One schema per chain. | You need everything, including contracts nobody has decoded, or you are working at the transaction / log / trace level (gas, calldata, native transfers, event topics). |
| **Decoded** | `<project>_<chain>.<Contract>_evt_<EventName>` and `<project>_<chain>.<Contract>_call_<FunctionName>` | Dune + community (ABI submission) | The raw `logs` and `traces` of one contract, parsed via its ABI into human-readable columns. | You want one specific protocol's events or function calls (for example `uniswap_v3_ethereum.Pair_evt_Swap`) and the curated layer does not cover the angle you need. |
| **Curated / Spellbook** | Cross-protocol schemas: `dex.trades`, `nft.trades`, `tokens.erc20`, `tokens.transfers`, `prices.usd`, `prices.day`, `balances_<chain>.*`, `stablecoins_evm.*`, `cex.flows`, `labels.addresses`, `bridges_evms.*`, `lending.*` | Dune data team (open source: github.com/duneanalytics/spellbook) | Pre-built, validated datasets that normalize hundreds of protocols across many chains into one consistent schema. Decimal-adjusted, USD-priced, deduped. | The default for analytics. Volume, prices, trades, transfers, balances, labels, flows. Most questions live here. |
| **Community** | Third-party / project namespaces: `flashbots.*`, `farcaster.*`, `lens.*`, `dune.blockchains`, `dune.polymarket_markets`, uploaded `your_team.*` | Anyone (uploads, transformations) | Third-party datasets, project-specific spellbook models, and your own uploaded tables. | A niche or off-chain dataset that Dune's core team does not maintain. Verify freshness yourself. |

Key facts:

- **Decoded tables read from raw.** `_evt_` tables are decoded from `<chain>.logs` (topics + data). `_call_` tables are decoded from `<chain>.traces` (the calldata `data` field). Read-only / `view` / `constant` calls made locally (web3.js, Etherscan) are NOT on-chain and never appear, unless invoked by another contract inside a transaction.
- **Curated tables are built from decoded.** For example `dex.trades` is a union of protocol base models like `uniswap_v3_ethereum.trades` and `curve_ethereum.trades`, which themselves decode swap events. Amounts are decimal-adjusted and joined to Dune price feeds for USD.
- **Decoding is community-driven.** If a new contract is not yet decoded, its events still exist in raw `logs`/`traces`. Submit it for decoding (dune.com/decode), which takes about 24h. Check `<chain>.contracts` to see if a contract is decoded.
- **Multiple contract instances collapse into one decoded table.** All Uniswap v3 pools share `uniswap_v3_ethereum.Pair_evt_Swap`; use the `contract_address` column to tell instances apart.

---

## 2. Raw EVM tables

One schema per chain. Everything below is the Ethereum schema. It applies to every EVM chain by swapping the schema name: `arbitrum.transactions`, `base.logs`, `polygon.traces`, `optimism.blocks`, and so on. Raw update frequency tracks the chain's block production.

Note: `from` and `to` are SQL reserved words. Always double-quote them: `"from"`, `"to"`.

### `<chain>.transactions`

Every transaction: sender, recipient, value, gas, calldata, receipt status.

| Column | Type | Description |
|---|---|---|
| `block_time` | timestamp | Block timestamp |
| `block_number` | bigint | Block number |
| `block_date` | date | Block date (UTC) |
| `block_hash` | varbinary | Hash of the containing block |
| `hash` | varbinary | Transaction hash |
| `index` | bigint | Position of the tx within the block |
| `nonce` | bigint | Sender's tx count before this tx |
| `from` | varbinary | Sender address |
| `to` | varbinary | Recipient address |
| `value` | decimal | Native token transferred (wei) |
| `gas_limit` | bigint | Max gas sender will use |
| `gas_price` | bigint | Price per gas unit (wei) |
| `gas_used` | bigint | Actual gas consumed |
| `max_fee_per_gas` | bigint | EIP-1559 max total fee per gas |
| `max_priority_fee_per_gas` | bigint | EIP-1559 max tip per gas |
| `priority_fee_per_gas` | bigint | Actual tip per gas paid |
| `success` | boolean | Whether the tx succeeded |
| `data` | varbinary | Calldata |
| `type` | varchar | legacy, EIP-2930, EIP-1559, EIP-4844 |
| `access_list` | array(row) | EIP-2930 access list |
| `blob_versioned_hashes` | array(varbinary) | EIP-4844 blob hashes |
| `max_fee_per_blob_gas` | bigint | EIP-4844 max blob gas fee |
| `authorization_list` | array(row) | EIP-7702 authorization list |

### `<chain>.logs`

Smart contract event logs. The raw substrate of all decoded `_evt_` tables.

| Column | Type | Description |
|---|---|---|
| `block_time` | timestamp | Block timestamp |
| `block_number` | bigint | Block number |
| `block_date` | date | Block date (UTC) |
| `block_hash` | varbinary | Containing block hash |
| `contract_address` | varbinary | Contract that emitted the log |
| `topic0` | varbinary | Event signature hash (first indexed topic) |
| `topic1` | varbinary | First indexed parameter |
| `topic2` | varbinary | Second indexed parameter |
| `topic3` | varbinary | Third indexed parameter |
| `data` | varbinary | Non-indexed event data |
| `tx_hash` | varbinary | Transaction that produced the log |
| `index` | integer | Position of the log within the block |
| `tx_index` | integer | Position of the tx within the block |
| `tx_from` | varbinary | Tx sender |
| `tx_to` | varbinary | Tx recipient |
| `blob_gas_price` | bigint | EIP-4844 blob gas price |
| `blob_gas_used` | bigint | EIP-4844 blob gas used |

`topic0` identifies the event. The canonical ERC20 Transfer signature hash is `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`.

### `<chain>.traces`

Internal transactions: cross-contract calls, delegatecalls, native value transfers, contract creations. The substrate of decoded `_call_` tables.

| Column | Type | Description |
|---|---|---|
| `block_time` | timestamp | Block timestamp |
| `block_number` | bigint | Block number |
| `block_date` | date | Block date (UTC) |
| `block_hash` | varbinary | Containing block hash |
| `value` | uint256 | Native token transferred (wei) |
| `gas` | bigint | Gas provided for this trace |
| `gas_used` | bigint | Gas consumed by this trace |
| `success` | boolean | Whether this trace succeeded |
| `tx_success` | boolean | Whether the parent tx succeeded |
| `tx_hash` | varbinary | Parent transaction hash |
| `tx_index` | integer | Tx position within the block |
| `from` | varbinary | Address that initiated this trace |
| `to` | varbinary | Address the trace was sent to |
| `trace_address` | array(bigint) | Path of this trace in the call tree |
| `sub_traces` | bigint | Child traces spawned |
| `type` | varchar | call, create, suicide, reward |
| `call_type` | varchar | call, delegatecall, staticcall |
| `address` | varbinary | Created contract address (create traces) |
| `code` | varbinary | Created contract bytecode |
| `input` | varbinary | Trace input data |
| `output` | varbinary | Trace output data |
| `error` | varchar | Error message if the trace failed |
| `refund_address` | varbinary | Refund recipient (selfdestruct) |

### `<chain>.blocks`

Block headers.

| Column | Type | Description |
|---|---|---|
| `time` | timestamp | When the block was mined |
| `number` | bigint | Block number (height) |
| `date` | date | Block date (UTC) |
| `hash` | varbinary | Block hash |
| `parent_hash` | varbinary | Parent block hash |
| `miner` | varbinary | Miner / validator address |
| `gas_limit` | decimal | Max gas allowed in the block |
| `gas_used` | decimal | Total gas used by all txs |
| `base_fee_per_gas` | bigint | EIP-1559 base fee per gas |
| `size` | bigint | Block size in bytes |
| `difficulty` | bigint | Mining difficulty |
| `total_difficulty` | decimal | Cumulative chain difficulty |
| `nonce` | varbinary | Mining nonce |
| `blob_gas_used` | bigint | EIP-4844 blob gas used |
| `excess_blob_gas` | bigint | EIP-4844 excess blob gas |
| `parent_beacon_block_root` | varbinary | Parent beacon block root |

Other raw tables exist per chain: `<chain>.creation_traces`, `<chain>.withdrawals`, plus decoded helpers `<chain>.contracts`, `<chain>.logs_decoded`, `<chain>.traces_decoded`. Non-EVM raw schemas differ (Bitcoin has `inputs`/`outputs`, Aptos has `move_modules`/`events`, Solana has its own).

---

## 3. Key curated tables

These are the cross-chain, cleaned tables you will use most. All are decimal-adjusted and most carry USD pricing and a `blockchain` column.

### `dex.trades` (the most important table)

All raw DEX trade events across protocols and EVM chains (Uniswap, Curve, etc.). A multi-hop swap (USDC to WETH to PEPE) is recorded as one row per hop. For Solana use `dex_solana.trades`. For intent / aggregator-routed trades use `dex_aggregator.trades` (one aggregator row maps to one or more `dex.trades` rows).

| Column | Type | Description |
|---|---|---|
| `blockchain` | varchar | Chain the trade occurred on |
| `project` | varchar | DEX name (uniswap, curve, ...) |
| `version` | varchar | DEX protocol version |
| `block_month` | date | Block month (partition key) |
| `block_date` | date | Block date (UTC) |
| `block_time` | timestamp | Block timestamp |
| `block_number` | bigint | Block number |
| `token_bought_symbol` | varchar | Symbol of token bought |
| `token_sold_symbol` | varchar | Symbol of token sold |
| `token_pair` | varchar | Symbol pair, alphabetical order |
| `token_bought_amount` | double | Bought amount, display units |
| `token_sold_amount` | double | Sold amount, display units |
| `token_bought_amount_raw` | uint256 | Bought amount before decimals |
| `token_sold_amount_raw` | uint256 | Sold amount before decimals |
| `amount_usd` | double | USD value of the trade at execution |
| `token_bought_address` | varbinary | Bought token contract address |
| `token_sold_address` | varbinary | Sold token contract address |
| `taker` | varbinary | Address that bought (contract or EOA) |
| `maker` | varbinary | Address that sold (contract or EOA) |
| `project_contract_address` | varbinary | Contract that emitted the event (pool/router) |
| `tx_hash` | varbinary | Transaction hash |
| `tx_from` | varbinary | EOA that sent the trade tx |
| `tx_to` | varbinary | Address called in the tx's first call |
| `evt_index` | bigint | Event index within the tx |

```sql
-- 24h DEX volume by chain (amount_usd is precomputed, no price join needed)
SELECT blockchain, SUM(amount_usd) AS volume_usd, COUNT(*) AS trades
FROM dex.trades
WHERE block_time > NOW() - INTERVAL '24' HOUR  -- DuneSQL: interval literal is quoted
GROUP BY 1
ORDER BY 2 DESC
```

Related EVM tables: `dex_aggregator.trades`, plus `dex.sandwiches` / `dex.sandwiched` for MEV. Solana: `dex_solana.trades`, `jupiter_solana.aggregator_trades`.

### `nft.trades`

NFT sales, bids, listings across EVM marketplaces (Seaport, Blur, LooksRare, etc.) with pricing, buyer/seller, fees, royalties. Solana metadata/transfers live under separate `_solana` tables.

| Column | Type | Description |
|---|---|---|
| `blockchain` | varchar | Chain |
| `project` | varchar | Marketplace name |
| `version` | varchar | Marketplace contract version |
| `block_date` / `block_month` / `block_time` | date / date / timestamp | Block date, partition month, timestamp |
| `block_number` | bigint | Block number |
| `token_id` | double | NFT token ID |
| `collection` | varchar | Collection name |
| `amount_usd` | double | USD value at execution |
| `token_standard` | varchar | ERC721 or ERC1155 |
| `trade_type` | varchar | Single or multiple NFTs |
| `number_of_items` | uint256 | Items traded |
| `trade_category` | varchar | Direct buy, auction, etc. |
| `evt_type` | varchar | Trade, Mint, Burn |
| `seller` | varbinary | Seller wallet |
| `buyer` | varbinary | Buyer wallet |
| `amount_original` | double | Amount in original currency |
| `amount_raw` | uint256 | Amount before decimals |
| `currency_symbol` | varchar | Payment token symbol |
| `currency_contract` | varbinary | Payment token contract |
| `nft_contract_address` | varbinary | NFT contract |
| `project_contract_address` | varbinary | Marketplace contract |
| `aggregator_name` / `aggregator_address` | varchar / varbinary | Aggregator if routed |
| `tx_hash` | varbinary | Transaction hash |
| `tx_from` / `tx_to` | varbinary | Tx sender / receiver |
| `platform_fee_amount` / `_raw` / `_usd` / `_percentage` | double / uint256 / double / double | Platform fee |
| `royalty_fee_amount` / `_raw` / `_usd` / `_percentage` | double / uint256 / double / double | Royalty fee |
| `royalty_fee_receive_address` | varbinary | Royalty recipient |
| `royalty_fee_currency_symbol` | varchar | Royalty currency symbol |
| `unique_trade_id` | varchar | Unique trade identifier |

Related: `nft.mints`, `nft.transfers`, `nft.wash_trades`, `tokens.nft` (collection metadata).

### `tokens.erc20`: token metadata (the decimals/symbol lookup)

Symbol, name, decimals, contract address per EVM chain. This is how you turn a raw amount into a display amount and a hex address into a symbol. Solana equivalent: `tokens_solana.fungible`.

| Column | Type | Description |
|---|---|---|
| `blockchain` | varchar | Chain |
| `contract_address` | varbinary | Token contract address |
| `symbol` | varchar | Ticker symbol |
| `name` | varchar | Full token name |
| `decimals` | integer | Decimal places |
| `_updated_at` | timestamp | Last updated |

```sql
-- Enrich a raw log amount with symbol + decimals. Join on contract_address + blockchain, never symbol.
SELECT
  t.symbol,
  l.value_raw / POWER(10, t.decimals) AS amount  -- normalize raw -> display
FROM some_raw_source l
JOIN tokens.erc20 t
  ON t.contract_address = l.token
 AND t.blockchain = 'ethereum'
```

### `prices.day` / `prices.hour` / `prices.minute` / `prices.latest`: modern price tables

Hybrid pricing (Coinpaprika for ~2,000 majors, DEX-derived for the long tail), 900,000+ tokens across 70+ chains, refreshed about every 30 min. All four share one schema. This is the recommended way to attach USD value. Join key is always `(blockchain, contract_address)` plus a time match.

| Column | Type | Description |
|---|---|---|
| `blockchain` | varchar | Chain identifier |
| `contract_address` | varbinary | Token contract (fixed address for native tokens) |
| `symbol` | varchar | Token symbol |
| `price` | double | USD price (volume-weighted) |
| `timestamp` | timestamp | Start of minute / hour / day |
| `decimals` | int | Token decimals |
| `volume` | double | USD trading volume from price source |
| `source` | varchar | 'coinpaprika' or 'dex.trades' |

`prices.latest` swaps `timestamp` for a recorded-at `timestamp` and is built for "current price" lookups (no time filter needed). Source-only variants: `prices_external.*` (Coinpaprika only, stable) and `prices_dex.*` (DEX only).

```sql
-- Value an hourly transfer flow. Join on contract_address + blockchain + truncated hour.
SELECT
  tr.block_time,
  tr.symbol,
  tr.amount,
  tr.amount * p.price AS amount_usd
FROM tokens.transfers tr
JOIN prices.hour p
  ON p.contract_address = tr.contract_address
 AND p.blockchain = tr.blockchain
 AND p.timestamp = DATE_TRUNC('hour', tr.block_time)
WHERE tr.blockchain = 'ethereum'
  AND tr.block_time > NOW() - INTERVAL '7' DAY
```

Notes:
- Token identity requires BOTH `contract_address` AND `blockchain`. Symbols are not unique.
- Native tokens (ETH, BNB) use standardized addresses from `dune.blockchains` (mostly `0x000...`).
- Solana addresses are base58 mints stored as varbinary: filter with `from_base58('So111...112')`.
- `prices.minute` is interpolated from hourly anchors and can be noisy/expensive for broad history. Prefer `prices.hour` or `prices.day`.

### `prices.usd` / `prices.usd_latest` / `prices.usd_daily`: legacy price tables

Coinpaprika-only, ~2,800 tokens. Still updating and reliable, but lower coverage than the modern tables. Note the time column is `minute`, not `timestamp`, and the price column is `price`.

| Column | Type | Description |
|---|---|---|
| `contract_address` | varbinary | Token contract address |
| `symbol` | varchar | Token symbol |
| `price` | double | USD price |
| `minute` | timestamp | Price timestamp (`prices.usd_latest` excludes this) |
| `blockchain` | varchar | Chain identifier |

```sql
-- Legacy join: note the column is `minute`, not `timestamp`.
SELECT price, minute
FROM prices.usd
WHERE contract_address = 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2  -- WETH
  AND blockchain = 'ethereum'
```

Migration: `prices.usd` -> `prices.minute`, `prices.usd_daily` -> `prices.day`, `prices.usd_latest` -> `prices.latest`.

### `tokens.transfers`: curated fungible token transfers

ERC20 + native transfers across all EVM chains, decimal-adjusted. Includes ERC4626 vault mint/burn, WETH deposit/withdraw, and native value (tx value, trace value, gas). USD uses `prices_external.hour` (Coinpaprika only), so tokens without Coinpaprika coverage have null `amount_usd`.

| Column | Type | Description |
|---|---|---|
| `unique_key` | varchar | Surrogate row key |
| `blockchain` | varchar | Chain |
| `block_month` | date | Partition key |
| `block_date` / `block_time` / `block_number` | date / timestamp / bigint | Block date, timestamp, number |
| `tx_hash` | varbinary | Transaction hash |
| `evt_index` | bigint | Log event index |
| `trace_address` | array(bigint) | Trace address |
| `token_standard` | varchar | ERC20 or native |
| `tx_from` / `tx_to` / `tx_index` | varbinary / varbinary / bigint | Tx sender, receiver, index |
| `from` | varbinary | Transfer sender |
| `to` | varbinary | Transfer receiver |
| `contract_address` | varbinary | Token contract |
| `symbol` | varchar | Token symbol |
| `amount_raw` | uint256 | Amount before decimals |
| `amount` | double | Amount in display units |
| `price_usd` | double | Coinpaprika price used |
| `amount_usd` | double | USD value (null if no Coinpaprika coverage) |

NFT transfer equivalent: `tokens.nft_transfers` / `nft.transfers`.

### Balances: `balances_<chain>.latest`, `.daily_updates`, `.updates`

Per-chain fungible (native + ERC20) balances. Refreshed hourly. NFT balances are NOT included.

| Question | Table |
|---|---|
| What does this wallet hold right now? | `balances_<chain>.latest` (USD from `prices.latest`) |
| What did it hold on day X / over N days? | `balances_<chain>.daily_updates` (sparse: one row per change with a `[valid_from, valid_to)` interval; `balance_usd` precomputed from `prices.day`) |
| Exactly when did the balance change? | `balances_<chain>.updates` (block-level, intentionally unpriced) |

`daily_updates` is the default for history. For a cross-chain portfolio, `UNION ALL` per-chain `latest` tables.

### Stablecoins: `stablecoins_evm.*`, `stablecoins_solana.*`, `stablecoins_multichain.*`

Stablecoin transfers, balances, and per-transfer activity classification. `stablecoins_evm.activity_enriched` tags each transfer with a `category` (DEX, CEX, bridge, lending, issuer, payment, ...) and `activity` label, with `amount`, `amount_usd`, `from_address`, `to_address`, `token_address`, `token_symbol`, `tx_hash`, `evt_index`. Balances live in `stablecoins_evm.balances` / `.balances_enriched`; cross-chain aggregate in `stablecoins_multichain.balances`. (Premium dataset.)

### Labels: `labels.addresses`, `labels.ens`, `labels.owner_addresses`, `labels.owner_details`

Maps addresses to entities and categories. `labels.addresses` is the superset: filter by `category` (cex, dex, dao, bridge, ...). Columns: `blockchain`, `address`, `name`, `category`, `contributor`, `source`, `created_at`, `updated_at`, `model_name`, `label_type`. `labels.ens` resolves `.eth` names to addresses. `labels.owner_addresses` maps addresses to a `custody_owner` / `account_owner` (join to `labels.owner_details` via `owner_key`).

### CEX flows: `cex.flows`, `cex.addresses`, `cex.deposit_addresses`

Token in/out-flows for known centralized-exchange addresses across EVM chains, with entity attribution and USD. Key columns: `blockchain`, `block_time`, `cex_name`, `distinct_name`, `token_address`, `token_symbol`, `flow_type` (deposit / withdrawal), `amount`, `amount_usd`, `from`, `to`, `tx_hash`. `cex.addresses` is the known-CEX-wallet cohort table (useful for "stablecoin held at exchanges over time").

### Bridges: `bridges_evms.deposits`, `.withdrawals`, `.flows`

Cross-chain bridge activity across 41 EVM chains. `deposits` decodes source-chain deposit events; `withdrawals` decodes destination-chain events; `flows` joins them on `bridge_transfer_id` into matched complete transfers. Enriched with token metadata + USD.

### Other curated families (one line each)

- **Lending** (`lending.borrow`, `lending.supply`, `lending.flashloans`, `lending.info`): DeFi lending events across 15+ chains, decimal-adjusted and USD-priced.
- **Gas & fees** (`gas.fees`, `gas_solana.fees`): transaction-level fee data across 55+ EVM chains and Solana.
- **Rollup economics** (`rollup_economics.l1_fees`, `.l2_revenue`): L2 profitability (revenue vs L1 posting cost).
- **Prediction markets** (`polymarket.*`, `kalshi.*`, `prediction_markets.*`): market details, trades, hourly OHLCV, positions.
- **Payments** (`payments.commerce_flows`, `payments.card_transactions`, agentic payments): stablecoin payment flows; feed back into stablecoin activity.
- **Token metadata** (`tokens.erc20`, `tokens.nft`, `tokens_solana.fungible`): names, symbols, decimals, addresses.
- **Utilities**: time-series scaffolding tables for continuous date/hour series.

---

## 4. Multichain pattern

Most curated tables carry a `blockchain` column, so one query spans chains with no `UNION`. Filter or group on `blockchain`:

```sql
-- One query, all chains. Drop the WHERE to span everything; filter to scope down.
SELECT blockchain, SUM(amount_usd) AS volume_usd
FROM dex.trades
WHERE block_time > NOW() - INTERVAL '7' DAY
  AND blockchain IN ('ethereum', 'arbitrum', 'base', 'optimism', 'polygon')
GROUP BY 1
ORDER BY 2 DESC
```

Raw tables (`<chain>.transactions`, etc.) are per-chain and have NO `blockchain` column. To go cross-chain on raw data you `UNION ALL` per chain (and add a literal `'ethereum' AS blockchain` if you need the label).

Supported chains exist as a long list, not reproduced in full here. EVM includes ethereum, arbitrum (and arbitrum-nova), base, optimism, polygon, bnb (and opbnb), avalanche, gnosis, fantom, celo, linea, scroll, zksync, mantle, blast, zora, sei, unichain, berachain, sonic, ronin, worldchain, plus many more (60+ total). Non-EVM includes solana, bitcoin, aptos, sui, ton, tron, near, stellar. Coverage per dataset varies: confirm a chain is in a given curated table before assuming. Use `listBlockchains` (MCP) or the data explorer for the authoritative list.

---

## 5. Finding the right table

- **By contract address (best for one protocol):** use the MCP tool `searchTablesByContractAddress` to discover all decoded `_evt_` and `_call_` tables for a contract automatically. Or query `<chain>.contracts` to see if/what is decoded.
- **By protocol / chain / category / schema keyword:** MCP `searchTables`. For docs and query examples, `searchDocs`. To estimate scan cost before running, `getTableSize`.
- **In the app:** the Data Explorer / Data Hub in the Dune query editor lets you search tables, preview schemas, and see sample rows.
- **If a contract is not decoded:** the events still live in raw `<chain>.logs` (filter by `contract_address` and `topic0`) and `<chain>.traces`. Submit the contract at dune.com/decode (~24h) to get human-readable tables.
- **Curated source code:** every Spellbook model is open source at github.com/duneanalytics/spellbook. Read the model to understand exactly how a curated column is built.

### The hard rule: join on identifiers, never on symbol

Symbols are not unique. Many tokens share a ticker across and within chains, and a hex address can carry a fake symbol. Always join and filter on `contract_address` (plus `blockchain` for multichain tables) and link events with `tx_hash` (plus `evt_index` / `trace_address` when you need a specific event within a tx). Use `symbol` for display output only, never as a join or filter key when correctness matters.

```sql
-- Right: identity-based join (price <- transfer)
JOIN prices.day p
  ON p.contract_address = t.contract_address
 AND p.blockchain = t.blockchain
 AND p.timestamp = DATE_TRUNC('day', t.block_time)

-- Wrong: JOIN ... ON p.symbol = t.symbol   -- collides across tokens/chains, silently wrong
```
