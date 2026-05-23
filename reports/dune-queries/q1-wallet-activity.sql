-- Sasha's Wallet Activity on Base
-- Agent EOA: 0xba3BB32Fa5cfA2edCFc1401c76292FB102f86662
-- This is the signing wallet that sends execTransaction calls to the Gnosis Safe

SELECT
    DATE_TRUNC('week', block_time)           AS week,
    COUNT(*)                                 AS tx_count,
    COUNT(DISTINCT "to")                     AS protocols_touched,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_txs,
    MAX(block_time)                          AS last_activity
FROM base.transactions
WHERE "from" = 0xba3BB32Fa5cfA2edCFc1401c76292FB102f86662
GROUP BY 1
ORDER BY 1 DESC
