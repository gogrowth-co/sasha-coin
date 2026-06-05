# Kickoff Prompt — Build the OOR Monitor (paste into a fresh sasha-coin session)

```
Build the new OOR / kill-switch monitor for the live WETH/USDC LP position, per the spec at docs/lp-oor-policy-update-spec.md. This is the build that turns the position from "watch it manually" into "it alerts itself" — the first earned step toward hands-off. It MONITORS and ALERTS only; it does NOT auto-execute any capital action. Earn autonomy: dry-run → deploy → observe a real run → only then trust.

== LOAD ==
- docs/lp-oor-policy-update-spec.md — the brief (exact code block, config, three-tier policy).
- CLAUDE.md — "never claim a fix works without observed execution", one-writer rule (diff local↔VPS before deploy), on-chain/capital actions require my confirmation.
- Memory: project_lp_miner_stack, project_lp_selection_validated, the WETH/USDC-migration DEC-007 line, feedback_autonomy_design_principles (earn autonomy + circuit breaker), project_lp_reentry_policy.
- Skills: sasha-defi-execution, defi-lp-math (range/tick for the distance guard), hyperliquid-perps (mark vs liq for the liq-proximity guard).
- Code: scripts/position-monitor.js (the file to change), scripts/lp-rebalancer.js (the signal consumer).

== WHAT TO BUILD (per the spec) ==
Three-tier OOR response, replacing the current 240min → auto CLOSE_REOPEN:
1. Soft (time): OOR >= 720 min continuous → emit OOR_ALERT (Telegram + dashboard + signal, informational, killSwitch:false). NO auto-close, NO recenter.
2. Hard (distance): price >= 5% beyond the breached band → emit KILL (killSwitch:true). Fires regardless of the timer (a deep excursion is a trend). This naturally gives the downside a shorter fuse.
3. Hard (hedge): hedge mark within 3% of its liquidation → emit KILL regardless of timer.
- REMOVE CLOSE_REOPEN from the OOR auto-path (it stays available only for a deliberate manual recenter).
- Config: global KILL.oorTimeoutMinutes 240→720, add oorDistanceKillPct=5, hedgeLiqProximityPct=3; per-position overrides in state/lp-positions.json (set oorTimeoutMinutes:720, oorDistanceKillPct:5 on the WETH/USDC position).
- lp-rebalancer.js: add OOR_ALERT as a notify-only/no-op type. KILL already exists and STAYS gated on my confirmation — the monitor only writes the signal/alert, it never closes on its own.
- Sanity: for this position (bands ~$1591–$1943) the 5% distance guard fires at ETH <~$1511 or >~$2040 — confirm that matches the current manual KILL thresholds. If it doesn't, stop and tell me.

== HARD RULES ==
- This monitor ALERTS only. It must NOT auto-execute any close/rebalance/on-chain tx. KILL execution stays a separate, my-confirmation-gated step via lp-rebalancer.
- DRY-RUN every branch before deploy. One-writer: diff local↔VPS, deploy via deploy.sh, confirm md5 match.
- Do not touch the existing drift / HF / funding kill switches — only the OOR + hedge-liq blocks.

== EARN-AUTONOMY VERIFICATION (this is the point — do not skip) ==
1. Dry-run with forced inputs (mock price / temporarily tight range) and confirm ALL branches: <12h + <5% beyond → no action; >=12h + <5% → OOR_ALERT only; >=5% beyond a band → KILL signal (NOT CLOSE_REOPEN); hedge within 3% of liq → KILL. Show the dry-run output for each.
2. Deploy local→VPS. Identify which cron runs position-monitor.js (sasha-lp-miner or a monitor cron) and confirm the deployed file is what runs.
3. OBSERVE a real cron run on the live in-range position: read the log, confirm it now logs the 720-min threshold, takes the in-range no-op path, and does NOT emit CLOSE_REOPEN or any spurious alert. Do not claim it works until that real-run log is in hand.

== POST ==
- Update the dashboard kill-switch panel to reflect the REAL policy (720min timer + 5% distance guard + 3% liq guard; drop the inapplicable Morpho rows) so the public page matches reality — coordinate with / hand to the designer if it's a visual change.
- Append a decision-log entry (what shipped, the observed-run proof). Update project_lp_miner_stack memory.
- This stays observe-only: the monitor alerts, I still confirm any KILL. The auto-close + auto-re-enter (full autonomous loop, with the bounded mandate + circuit breaker from feedback_autonomy_design_principles) is a LATER phase — do NOT build it here.

Report each step with its observed artifact (dry-run output, deploy md5, the real-run log line). Nothing capital-moving without my approval.
```
