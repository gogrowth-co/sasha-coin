-- Sasha Dashboard — Summary Card
-- Single-row output: one number per metric. Use as the hero stat block.
-- Wallet: 0x783363427f4dd64e97b5ec0cb5c94b2b8cac13b9
-- Token:  0x6fd3dbdd16a9db5d11f859034584270272e557f5

WITH wallet_stats AS (
    SELECT
        COUNT(*)                                         AS total_txs,
        COUNT(DISTINCT "to")                             AS protocols_touched,
        MAX(block_time)                                  AS last_onchain_action,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)         AS successful_txs
    FROM base.transactions
    WHERE "from" = 0x783363427f4dd64e97b5ec0cb5c94b2b8cac13b9
),
holder_stats AS (
    WITH inflows AS (
        SELECT "to" AS address, SUM(CAST(value AS DOUBLE)) AS amount
        FROM erc20_base.evt_Transfer
        WHERE contract_address = 0x6fd3dbdd16a9db5d11f859034584270272e557f5
        GROUP BY 1
    ),
    outflows AS (
        SELECT "from" AS address, -SUM(CAST(value AS DOUBLE)) AS amount
        FROM erc20_base.evt_Transfer
        WHERE contract_address = 0x6fd3dbdd16a9db5d11f859034584270272e557f5
        GROUP BY 1
    ),
    balances AS (
        SELECT address, SUM(amount) AS balance
        FROM (SELECT * FROM inflows UNION ALL SELECT * FROM outflows)
        GROUP BY 1
        HAVING SUM(amount) > 0
            AND address != 0x0000000000000000000000000000000000000000
    )
    SELECT COUNT(*) AS holder_count FROM balances
)
SELECT
    w.total_txs,
    w.protocols_touched,
    w.last_onchain_action,
    w.successful_txs,
    h.holder_count
FROM wallet_stats w, holder_stats h
