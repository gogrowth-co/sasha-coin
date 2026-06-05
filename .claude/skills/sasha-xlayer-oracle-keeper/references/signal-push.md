# Signal push — push-signal-to-xlayer.js

Pushes Sasha's fused risk signal to `SashaOracle.setFee()` on X Layer.

## Input
Reads `content/mantle-signal.json` (produced by `sasha-signal-fusion`). The signal carries the risk level the oracle should store.

## Invocation
```
node scripts/push-signal-to-xlayer.js            # push if risk changed
node scripts/push-signal-to-xlayer.js --force    # re-push even if unchanged (liveness)
node scripts/push-signal-to-xlayer.js --dry-run  # preview, no tx
```

## Cron (VPS)
`/etc/cron.d/sasha-oracle` runs `--force` every 2h so `updatedAt` never goes stale. The hook treats a stale oracle (> 6h) as a fallback — keeping it fresh is the whole point of the keeper. This job IS firing (sasha-oracle.log is current).

## Output / verification
On success, logs `{txHash, fee, riskLevel, pushedAt, explorer}`. Verify on `https://www.oklink.com/x-layer/tx/<txHash>`.

## Failure modes
- **Gas too low** → estimate runs low on X Layer; apply 50% buffer on `gasLimit`.
- **`CurrencyNotSettled`** → decode the revert and re-quote; do not blind-retry.
- **spawnSync ETIMEDOUT** (if shelling out under box load) → not an X Layer error; see `sasha-ops-hardening`.
- **Empty 0.3% pool** → route via the 0.01% pool.