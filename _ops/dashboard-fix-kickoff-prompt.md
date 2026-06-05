# Kickoff Prompt — LP Dashboard Fixes (paste into a fresh sasha-coin session)

```
Fix the Sasha LP-miner public dashboard per the audit at _ops/dashboard-audit-lp-miner-2026-06-04.md. The position is live and healthy (WETH/USDC ts100, unstaked, delta-neutral, NFT 71722642); this is display correctness, NOT capital. No on-chain txs, no signing.

== LOAD ==
- Read _ops/dashboard-audit-lp-miner-2026-06-04.md (the punch list).
- Read CLAUDE.md (esp. "never claim a fix works without observed execution", one-writer rule, dashboards stay code/runtime).
- Read memory: project_lp_miner_stack, project_lp_selection_validated, the WETH/USDC-migration-executed line (DEC-007), project_lp_dashboard_rebuild, feedback_dashboard_design_skills ("never write dashboard HTML directly — route through designer + dashboard-design").
- Read the pipeline: scripts/lp-reconcile.js, scripts/build-dashboard-data.js, web/lp-miner/index.html.

== ROOT-CAUSE FRAMING ==
All six P0 bugs are cbBTC-era hardcode the migration didn't sweep. Fix the CAUSE: drive every label off the live position (pair, volatile token, staked flag from on-chain owner = gauge vs LP wallet, hedge perp, which kill-switches apply) — so "reconciled against the chain" is literally true for labels, not just numbers. Don't just string-replace BTC→ETH; make it derive.

== P0 QUICK WINS (pipeline; deploy; verify on pages.dev) ==
1. Range-bar price marker "BTC $X" → label the pool's volatile token (ETH for WETH/USDC).
2. Hedge note "Neutralizes the cbBTC leg" → derive from hedge perp ("the ETH leg").
3. "Rehedge fees at 5% drift" + kill-switch "Hedge drift threshold 5%" → "Static hedge · no rebalance" for this position.
4. Kill-switch panel: drop Morpho HF rows (no borrow leg here); set the OOR row to the real policy (manual kill / OOR>24h, or "auto-monitor pending") not "240 min".
5. Header "multi-chain LP book" → accurate ("a delta-neutral LP book on Base").
6. "Distance to liq … away" red → neutral/green; red only < ~5% to liq.

== STRUCTURAL (pipeline; HIGHEST VALUE) ==
7. Fee-mode is backwards: shows "staked → veAERO voters". Position is UNSTAKED/fee-collect. Render "collecting" + accruing collectable fees (collect staticcall on the NFT). Drive staked/unstaked off the on-chain NFT owner. VERIFY it reads the unstaked fees correctly — this is the thesis on the public page; do not ship it unverified.
8. Day-0 edge state: replace the 0.00% APR rows + "--" yield with "Awaiting first fee accrual — realized APR after ~24h of volume."

== AESPIRATIONAL → DESIGNER AGENT (visual brief → production → playwright-visual-qa) ==
9. Net delta as a first-class metric with a zero-centered bar (replace the crammed "LP long … = +0.00098 WETH" strip).
10. Tighten mid-section density / collapse low-info day-0 blocks.

== VERIFY (no claim without proof) ==
After deploy: fetch the live pages.dev/lp-miner JSON + render the page; confirm each P0 label is correct, fee-mode reads "collecting" with real fee data, color on liq-distance fixed, and watch ONE sasha-dashboard cron cycle pick it up. Report each fix with the live artifact. Update _ops/dashboard-audit with what shipped.
```
