---
summary: "Workspace template for HEARTBEAT.md"
read_when:
  - Bootstrapping a workspace manually
---

# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## Scheduled tasks

### Every 6 hours — Five-source signal check + X Layer oracle push
```
node scripts/mantle-signal.js
node scripts/push-signal-to-xlayer.js
```
After running:
- If `recommendation.action !== "HOLD"`, send Telegram alert with the recommended
  action and full rationale. The `byreal-mantle` skill handles the trade loop.
- `push-signal-to-xlayer.js` reads the output of `mantle-signal.js` and autonomously
  pushes the new fee to `SashaOracle` on X Layer (non-blocking, exits 0 always).
  The `SashaDynamicFeeHook` then applies Sasha's risk reading to every pool swap.

Add to `cron/jobs.json`:
```json
{ "trigger": "[MANTLE_SIGNAL]", "interval": "6h", "skill": "byreal-mantle" },
{ "trigger": "[XLAYER_ORACLE]", "interval": "6h", "script": "scripts/push-signal-to-xlayer.js" }
```

### Daily — Trade log health check + treasury status
```bash
# Trade log summary
node -e "
const fs=require('fs');
const log=JSON.parse(fs.readFileSync('state/mantle-trade-log.json','utf8'));
const recent=log.slice(-5);
const last=recent[recent.length-1];
const errors=recent.filter(t=>t.status==='error').length;
console.log(JSON.stringify({total:log.length,last_action:last?.action,last_status:last?.status,errors_in_5:errors}));
"

# Treasury status (read-only, no PK needed for status)
node scripts/mantle-treasury.js --action status
```

Send summary to Telegram at 08:00 BRT daily.
Alert if `errors_in_5 >= 3` or MNT balance < 0.002 MNT (gas reserve warning).

### Weekly — mETH compound (if threshold not met automatically)
```
npm run treasury:compound
```
Manual compound run if auto-compound hasn't triggered in 7 days.
Ensures yield accumulates and Mantle remains economically active.