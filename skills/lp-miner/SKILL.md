# LP Miner Skill

## When to use
Triggered by cron system events:
- `[LP_POSITION_MONITOR]` — every 30 min
- `[LP_REBALANCER]` — 3 min after monitor (`:03` and `:33` each hour)
- `[LP_POOL_SCAN]` — weekly Monday 07:00 BRT

---

## Autonomy Policy

**ALL actions in this skill execute without waiting for Gabriel's confirmation.**

Sasha manages LP positions autonomously. Gabriel is informed via Telegram on every action but never blocks execution. The kill-switch conditions inside the scripts are the safety net — they fire Telegram alerts immediately if anything critical fires.

One exception: if agent EOA balance is insufficient to open a new position, Telegram-alert Gabriel with the exact amount needed and the wallet address. Do not wait — just report and move on.

---

## [LP_POSITION_MONITOR] — Every 30 min

### Step 1 — Run monitor
```
cd /data/.openclaw/workspace && node scripts/position-monitor.js
```

### Step 2 — Parse output
- Log the price, in-range status, and OOR duration for each position.
- If output includes `All positions healthy`, report to Telegram (brief, one line, only if something changed from last run — avoid noise).

### Step 3 — Check for rebalance signal
If `content/lp-rebalance-signal.json` exists after the monitor run:
- **Immediately run the [LP_REBALANCER] flow** (do not wait for the next cron tick).

### Step 4 — Check for pending positions
If `state/lp-positions.json` contains any entry with `status: "pending_open"`:
- Run: `node scripts/lp-opener.js --dry-run` to preview.
- If dry-run succeeds and agent has sufficient balance:
  - Run: `node scripts/lp-opener.js --execute`
- If insufficient balance: Telegram Gabriel with wallet address + exact amounts needed.

### Step 5 — No positions at all
If `positions` array is empty AND `content/lp-candidates.json` exists:
- Telegram Gabriel: "No open positions. Pool scan ran. Best candidate: [pool] at [APR]%. Add to state/lp-positions.json to open."
- Do NOT auto-create a new position entry without an existing `pending_open` entry.

---

## [LP_REBALANCER] — :03 and :33 each hour

### Step 1 — Check signal
If `content/lp-rebalance-signal.json` does NOT exist:
- Exit silently. Do not Telegram.

### Step 2 — Preview
```
cd /data/.openclaw/workspace && node scripts/lp-rebalancer.js --dry-run
```
Log the dry-run output.

### Step 3 — Execute (autonomous)
```
cd /data/.openclaw/workspace && node scripts/lp-rebalancer.js --execute
```

**All action types execute automatically:**
- `CLAIM_FEES` — collect fees, Telegram: "Claimed $X from [pool]"
- `CLOSE_REOPEN` — close OOR position, reopen at current price ±12%. Telegram: "Reopened [pool] at new range [X-Y]"
- `ADJUST_HEDGE` — adjust Hyperliquid short. Telegram: "Hedge adjusted: [old] → [new] ETH"
- `DELEVERAGE` — reduce Morpho borrow. Telegram: "Deleveraged: repaid $X USDC. HF now [Y]"
- `KILL` (killSwitch) — close position immediately. Telegram with 🚨 prefix.

### Step 4 — Confirm completion
After execute:
- Telegram a summary: action types executed, chains, any failures.
- If all actions succeeded and signal was cleared: log "LP rebalancer cycle complete".

---

## [LP_POOL_SCAN] — Weekly Monday 07:00 BRT

### Step 1 — Scan
```
cd /data/.openclaw/workspace && node scripts/pool-scanner.js --top 5
```

### Step 2 — Compare to current positions
Read `state/lp-positions.json`. For each open position, check if the scanner found a significantly better pool (score > current pool score by 20%+ AND EmDep < 25%).

### Step 3 — Report
Telegram weekly scan summary:
- Best Tier 1/2/3 pools with APR, EmDep, TVL
- Whether any current position should be rotated
- "No rotation needed" if current positions are still top-tier

Do NOT rotate positions automatically on a scan. Just report. Position rotation (if ever needed) requires a new `pending_open` entry to be created.

---

## State Files

| File | Purpose |
|------|---------|
| `state/lp-positions.json` | Live position registry. Monitor writes OOR tracking. Opener writes tokenId + status. Rebalancer writes lastClaimAt. |
| `content/lp-candidates.json` | Latest pool scan output. Written by pool-scanner.js. |
| `content/lp-rebalance-signal.json` | Written by monitor when action needed. Consumed + deleted by rebalancer after execute. |
| `state/lp-monitor-report.json` | Last monitor run output. |
| `state/lp-rebalance-log.json` | Full rebalance action history. |

---

## Reporting Format

**Healthy (no action):** Silent, or one-line Telegram if something changed.

**Action taken:**
```
🔄 [LP] [action_type] — [position_symbol]
[chain] | Range: $X–$Y | Current: $Z (in range: ✅/❌)
[specifics: fees claimed / new range / HF after deleverage]
```

**Kill switch:**
```
🚨 [LP KILL] [position_symbol] closed
Reason: [reason]
Chain: [chain] | Tx: [hash]
```

**Insufficient balance:**
```
⚠️ [LP_OPENER] Need funds to open [position_symbol]
Wallet: [address]
Need: [amount0] [token0] + [amount1] [token1]
```
