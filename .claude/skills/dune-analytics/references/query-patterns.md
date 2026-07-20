# Dune Query Patterns for On-Chain Token Analysis

Reusable DuneSQL patterns for the metrics that matter in on-chain token analysis and research. Copy a pattern, adapt the conventions below, run it.

Source: built on the tables in `data-catalog.md` and the dialect in `dunesql-cheatsheet.md`, distilled 2026-06-07.

## Conventions for every pattern

- Replace `0xTOKEN` with the token's contract address. It is a **varbinary literal: no quotes, no lower-casing.** Writing `'0xabc...'` (quoted) makes it a varchar that never matches.
- Set `blockchain = 'ethereum'` to the target chain. Curated tables (`dex.trades`, `tokens.transfers`, `prices.*`) carry a `blockchain` column, so the same query spans chains by changing this filter or removing it.
- **Filter on time first.** Every pattern bounds `block_time` with `now() - interval 'N' day`. It is the cheapest way to keep a blockchain query fast and cheap.
- During development, add `LIMIT 100` and a short window. Failed and timed-out executions still cost credits (see `execution-and-cost.md`).

---

## 1. Weekly active wallets (Adoption)

The single most common on-chain health metric. Counts unique addresses that sent or received a token each week.

```sql
with activity as (
    select date_trunc('week', block_time) as week, "from" as wallet
    from tokens.transfers
    where blockchain = 'ethereum'
      and contract_address = 0xTOKEN
      and block_time > now() - interval '180' day
    union all
    select date_trunc('week', block_time) as week, "to" as wallet
    from tokens.transfers
    where blockchain = 'ethereum'
      and contract_address = 0xTOKEN
      and block_time > now() - interval '180' day
)
select week, count(distinct wallet) as active_wallets
from activity
group by 1
order by 1
```

Adapt: count only senders (drop the `union all`) for "active spenders". Use `approx_distinct(wallet)` at very high volume.

---

## 2. DEX volume trend with 7-day moving average (Usage and Liquidity)

Daily traded volume in USD for a token, smoothed. The moving average is a window function over the daily series.

```sql
with daily as (
    select date_trunc('day', block_time) as day,
           sum(amount_usd)              as volume_usd,
           count(*)                     as trades,
           count(distinct taker)        as traders
    from dex.trades
    where blockchain = 'ethereum'
      and (token_bought_address = 0xTOKEN or token_sold_address = 0xTOKEN)
      and block_time > now() - interval '90' day
    group by 1
)
select day, volume_usd, trades, traders,
       avg(volume_usd) over (order by day rows between 6 preceding and current row) as vol_7d_avg
from daily
order by day
```

Adapt: `project_contract_address = 0xPOOL` to scope to one pool. Group by `project` to compare DEXes (Uniswap vs Curve vs others).

---

## 3. New vs returning wallets per week (Growth quality)

Separates first-time wallets from repeat users. Growth that is all new wallets and no returning ones is a churn problem, and that distinction is exactly what most protocols cannot show about themselves.

```sql
with moves as (
    select date_trunc('week', block_time) as week, "from" as wallet
    from tokens.transfers
    where blockchain = 'ethereum'
      and contract_address = 0xTOKEN
      and block_time > now() - interval '180' day
),
first_seen as (
    select wallet, min(week) as cohort_week
    from moves
    group by 1
)
select m.week,
       count(distinct case when m.week = f.cohort_week then m.wallet end) as new_wallets,
       count(distinct case when m.week > f.cohort_week then m.wallet end) as returning_wallets
from moves m
join first_seen f on m.wallet = f.wallet
group by 1
order by 1
```

Note: `first_seen` here uses only the 180-day window, so a wallet active before that looks "new". Widen the inner window for a true first-ever cohort.

---

## 4. Holder concentration by decile (Concentration risk)

Reconstructs balances from net transfers, then buckets holders into deciles with `ntile`. Surfaces whale concentration without needing a balances snapshot table.

```sql
with net as (
    select wallet, sum(amt) as balance
    from (
        select "to"   as wallet,  amount as amt
        from tokens.transfers
        where blockchain = 'ethereum' and contract_address = 0xTOKEN
        union all
        select "from" as wallet, -amount as amt
        from tokens.transfers
        where blockchain = 'ethereum' and contract_address = 0xTOKEN
    ) t
    group by 1
    having sum(amt) > 0
)
select ntile(10) over (order by balance desc) as decile,
       count(*)    as holders,
       sum(balance) as tokens_held,
       sum(balance) / sum(sum(balance)) over () as share_of_supply
from net
group by 1
order by 1
```

The top decile's `share_of_supply` is the headline concentration number. For a faster exact snapshot, see the `balances_<chain>.latest` table in `data-catalog.md`.

---

## 5. Top traders leaderboard (Whale and influencer mapping)

Ranks the addresses moving the most volume in a token. Feeds whale-watching and KOL-wallet identification. Join `labels.addresses` to put names to the wallets.

```sql
select t.taker as trader,
       sum(t.amount_usd) as volume_usd,
       count(*)          as trades,
       rank() over (order by sum(t.amount_usd) desc) as rnk,
       max(l.name)       as label
from dex.trades t
left join labels.addresses l
       on l.blockchain = t.blockchain and l.address = t.taker
where t.blockchain = 'ethereum'
  and (t.token_bought_address = 0xTOKEN or t.token_sold_address = 0xTOKEN)
  and t.block_time > now() - interval '30' day
group by 1
order by volume_usd desc
limit 50
```

---

## 6. Transfers enriched with USD value (reusable enrichment pattern)

`tokens.transfers` already carries `amount` and `amount_usd`, so prefer it. This pattern is for when you only have a raw decoded event and must add decimals and price yourself. It is the canonical "scale by decimals, join price" join.

```sql
select tr.evt_block_time,
       tr."from", tr."to",
       tr.value / pow(10, e.decimals)                     as amount,
       (tr.value / pow(10, e.decimals)) * p.price          as amount_usd
from erc20_ethereum.evt_Transfer tr
join tokens.erc20 e
  on e.blockchain = 'ethereum' and e.contract_address = tr.contract_address
left join prices.minute p
  on p.blockchain = 'ethereum'
  and p.contract_address = tr.contract_address
  and p.timestamp = date_trunc('minute', tr.evt_block_time)
where tr.contract_address = 0xTOKEN
  and tr.evt_block_time > now() - interval '7' day
order by amount_usd desc
limit 100
```

Use `coalesce(e.decimals, 18)` if a token is missing from `tokens.erc20`, and guard the division with `nullif`/`try` per `dunesql-cheatsheet.md`.

---

## Extensions

These follow the same shape. See `data-catalog.md` for the tables.

- **Retention cohort matrix:** build a weekly first-seen cohort (pattern 3), then count survivors in each later week per cohort. A heatmap of cohort week by weeks-since-join.
- **Stablecoin and CEX flows:** `cex.flows` for exchange in/out, `stablecoins_evm.activity_enriched` for stablecoin movement. Confirm the `flow_type` enum values against the live table before bucketing.
- **Protocol revenue and fees:** chain-level `gas-fees` and curated `lending` / `dex` economics tables.
