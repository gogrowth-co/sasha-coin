-- $SASHA Token — Holder Count + 7-Day Volume
-- Token contract: 0x6fd3dbdd16a9db5d11f859034584270272e557f5

-- Part A: Current holder count (addresses with positive balance)
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
SELECT
    COUNT(*)                                                    AS holder_count,
    (SELECT COUNT(*) FROM erc20_base.evt_Transfer
     WHERE contract_address = 0x6fd3dbdd16a9db5d11f859034584270272e557f5)
                                                                AS total_transfers_alltime,
    (SELECT COUNT(*) FROM erc20_base.evt_Transfer
     WHERE contract_address = 0x6fd3dbdd16a9db5d11f859034584270272e557f5
       AND evt_block_time >= NOW() - INTERVAL '7' DAY)         AS transfers_7d
FROM balances
