# Spec — OOR Policy Update for position-monitor.js (no-rebalance stance)

**Status:** SPEC for a follow-up code change. Do NOT implement until the new WETH/USDC position is live (this only matters for that position). Edit local → deploy to VPS (one-writer rule); test in `--dry-run` first.

**Why:** The current OOR policy auto-recenters every 4h of out-of-range, which crystallizes IL on moves that would have reverted. The WETH/USDC ts100 position is intentionally **no-rebalance**: wait for mean-reversion, only act on a real trend or a hedge-liq threat. This changes both *when* and *what* the OOR trigger does.

---

## Current behavior (verified)

`scripts/position-monitor.js`:
- L47: `oorTimeoutMinutes: 240` (4h) — comment "OOR for 4h -> close+reopen".
- L255–266: when OOR, sets `firstOorAt` (resets to null the moment price is back in range), and at `oorMinutes >= 240` pushes `{ type: 'CLOSE_REOPEN', killSwitch: false }`.

So: 4h continuous OOR → auto-recenter signal. The "resets when back in range" part is good (a wick that reverts cancels the timer) — keep that. The auto-recenter is what we change.

---

## Target behavior

Three-tier OOR response. The timer no longer recenters; it alerts. Only a real trend (distance) or a hedge-liq threat triggers a (gated) close.

1. **Soft — sustained OOR (time):** OOR ≥ **720 min (12h)** continuous → emit **`OOR_ALERT`** (Telegram + dashboard + signal, informational only, `killSwitch:false`). NO auto-close, NO recenter. Default action = hold and wait for reversion; Claude/Gabriel evaluate.
2. **Hard — trend (distance):** price ≥ **5% beyond the breached band** → emit **`KILL`** (`killSwitch:true`): close LP + close hedge to stables, alert urgently, reassess re-entry manually. This fires *regardless of the 12h timer* — a deep excursion is a trend, not a wick. It naturally gives the downside a shorter effective fuse (a downtrend pushes price past the band fast), which is what we want while ETH is falling.
3. **Hard — hedge protection (liq proximity):** hedge mark within **3% of its liquidation price** → emit `KILL` (or at minimum close the hedge leg) regardless of timer. Protects the margin before liquidation.

`CLOSE_REOPEN` is **removed from the OOR auto-path.** It remains available only for a deliberate, manually-invoked recenter. Execution of any `KILL` stays **gated on Gabriel's confirmation** via `lp-rebalancer.js` (monitor only writes the signal/alert; it never closes on its own) — consistent with the existing architecture and CLAUDE.md.

---

## Implementation notes

**Config (make per-position with global defaults so different pools can differ):**
- Global `KILL.oorTimeoutMinutes`: 240 → **720**.
- Add `KILL.oorDistanceKillPct`: **5**.
- Add `KILL.hedgeLiqProximityPct`: **3**.
- Per-position overrides in `state/lp-positions.json` (read with `?? KILL.<default>`): for the new WETH/USDC position set `oorTimeoutMinutes: 720`, `oorDistanceKillPct: 5`.

**Rewrite the OOR block (L255–266) along these lines:**
```js
if (!state.inRange) {
    if (!position.firstOorAt) position.firstOorAt = new Date().toISOString()
    const oorMinutes = (Date.now() - new Date(position.firstOorAt).getTime()) / 60_000
    state.oorMinutes = oorMinutes
    const oorSide = currentPrice < lower ? 'low' : 'high'
    const beyondPct = oorSide === 'low'
        ? (lower - currentPrice) / lower * 100
        : (currentPrice - upper) / upper * 100
    const distKill = position.oorDistanceKillPct ?? KILL.oorDistanceKillPct
    const timeout  = position.oorTimeoutMinutes ?? KILL.oorTimeoutMinutes
    if (beyondPct >= distKill) {
        actions.push({ type: 'KILL', reason: `OOR-${oorSide} ${beyondPct.toFixed(1)}% beyond band (trend)`, killSwitch: true })
    } else if (oorMinutes >= timeout) {
        actions.push({ type: 'OOR_ALERT', reason: `OOR ${oorMinutes.toFixed(0)}min, ${beyondPct.toFixed(1)}% beyond (${oorSide}) — evaluate hold vs close`, killSwitch: false })
    }
} else {
    position.firstOorAt = null
}
```

**Hedge-liq guard:** in the hedge section, add — if `markPx` within `hedgeLiqProximityPct`% of `liquidationPx`, push `KILL` (or close-hedge) with `killSwitch:true`.

**Signal handler:** `lp-rebalancer.js` — add `OOR_ALERT` as a no-op/notify type (no on-chain action). `KILL` already exists and already requires confirmation; leave that gating intact.

**Telegram:** `OOR_ALERT` = informational ("position OOR 12h, evaluate"). `KILL` = urgent ("trend/liq breach, recommend close").

---

## Verify before trusting (per the no-overclaim rule)
1. `node scripts/position-monitor.js --dry-run` against a position forced OOR (temporarily set a tight range or mock price) and confirm: <12h OOR + <5% beyond = no action; ≥12h + <5% = `OOR_ALERT` only; ≥5% beyond = `KILL`. No `CLOSE_REOPEN` from the OOR path.
2. Deploy local→VPS via `deploy.sh`, then confirm on the next real monitor run (read the log) that the new thresholds are in effect. Do not claim it works until observed in a live run.

---

## Scope note
Only the OOR + hedge-liq blocks change. Leave the existing drift / HF / funding kill switches untouched. This is additive/behavioral, reversible (revert the config + block).
