# Sasha Distribution Liveness Audit — 2026-06-03T20:29:43.140Z

**Status: 🔴 BROKEN**

- Log source: `local`
- Newest artifact age: 171.8h
- Content mix (last 14d): persona 0, reply 27, receipts 0 (voice share 1)
- VPS cron: post=false reply=false

## Findings

### 🔴 No persona/reply cron on the VPS `[cron-missing]`
Neither twitter-scheduled-post nor twitter-reply-gal is scheduled in /etc/cron.d or the host crontab. The only content-bound jobs are LP/yield automation, so the feed degrades to automated receipts.

**Fix:** Install host cron entries (or OpenCLAW scheduler triggers) for the persona-post and reply cadence, then verify the next slot writes a fresh posted-log entry.

### 🟡 VPS is oversubscribed / spawnSync timeouts present `[box-overload]`
1-min load 5.38 on 2 vCPU(s) (> 2x cores). spawnSync /bin/sh ETIMEDOUT breaks scripts that shell out (Buffer post, balance fetches). Logs with ETIMEDOUT: /var/log/sasha-dust.log /var/log/sasha-trade.log /var/log/sasha-treasury.log /var/log/sasha-yield-tweet.log

**Fix:** Reduce concurrent crons / move one OpenCLAW instance off the box, or raise spawnSync timeouts + serialize the */30 jobs.

### 🔴 Posted-log is stale (engine silent) `[stale-artifacts]`
Newest entry is 171.8h old (source=local); cadence expects 5/day.

**Fix:** Cron likely fires but writes no artifact (or no cron). Check the slot logs and engine path.


---
_Read-only audit. This script never posts, replies, deletes, archives, signs, or trades._
