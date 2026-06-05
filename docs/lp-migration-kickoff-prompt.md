# Kickoff Prompt — LP Migration Execution Session (cbBTC/USDC → WETH/USDC ts100)

Paste the block below into a FRESH Claude Code session in the `sasha-coin` workspace. Capital-moving, gated, precision-first.

---

```
You are Claude Code in the sasha-coin workspace. This is a DEDICATED, capital-moving execution session: exit Sasha's current delta-neutral LP position and open a new one in WETH/USDC Aerodrome Slipstream ts100, with a fresh leveraged ETH hedge. A full plan was written and double-checked last night; ETH has since moved (~$1,812 → ~$1,767), so EVERY number in that plan is stale and must be recomputed live. The mission is to do this correctly and verifiably, not quickly. "Successful this time" means: precise math, no unverified assumptions, every on-chain action confirmed by me before signing, and observed verification after each step.

== STEP 0: LOAD CONTEXT (do this before anything else) ==
1. Read CLAUDE.md (esp. CORE OPERATING RULES: no invented data + fact-check, no execution without my explicit confirmation, never claim a fix works without observed execution, one-writer rule, on-chain actions require my confirmation).
2. Read the full plan: docs/lp-migration-weth-usdc-plan-2026-06-04.md  (treat its numbers as STALE references, its structure/logic as current).
3. Read the decision log: docs/decision-log.md — DEC-001, DEC-002 (proof artifact = profitability + hedge skill; pool selection is the lever; fee-collect unstaked), DEC-005 (Base locked, lp-scout.js canonical, WETH/USDC chosen).
4. Read project memory: project_lp_selection_validated, project_lp_miner_stack, project_pool_scanner_data_gap, project_wallet_architecture, project_byreal_execution_path, feedback_dont_assume_container_runtime, feedback_verify_runtime_location_before_declaring_loss, feedback_verify_external_ground_truth, feedback_first_class_position_views.
5. Invoke skills: sasha-defi-execution, defi-lp-math, base-defi-stack, hyperliquid-perps. (book-wisdom is NOT needed — this is execution, not strategy.)
6. Read state/lp-positions.json and web/lp-miner/data/dashboard.json for the current recorded position.

== HARD RULES (non-negotiable) ==
- DO NOT sign or broadcast ANY transaction, or place ANY Hyperliquid order, without my explicit "yes, execute" for that specific step. Each capital-moving action is a separate [NEEDS APPROVAL] gate. Show me the exact action, amounts, min-outs, and expected result, then WAIT.
- DRY-RUN / simulate every capital-moving action before the real one. The new pool is ts100 — tighter than anything we have run (current is ts2000). Prove the open/mint path handles ts100 in sim before real funds.
- NO invented numbers. Read every price, balance, tick, fee, funding rate, gas figure from a live source immediately before using it. State files (lp-positions.json, capital-pool.json) use assumed prices — never treat them as fact.
- Determine and PROVE the signing path FIRST (see Step 1). Do not assume where keys live. There is a recent on-chain history, so the path exists — find it (env, scripts, VPS host) before declaring anything missing or impossible.
- Observed verification after every step: read the tx receipt / HL fill / on-chain state and confirm the expected change before moving on. Never say "done" without the artifact.
- One-writer rule: local writes, VPS executes. If anything must run on the VPS, diff local↔VPS first.
- If ANY step fails or a number looks off, STOP and tell me. Do not improvise mid-migration.

== STEP 1: PROVE THE EXECUTION + SIGNING PATH (read-only) ==
Before any capital plan, establish exactly HOW each action gets signed and by whom:
- Base LP txs (unstake, decrease, collect, swap, mint) — which EOA signs (LP-miner EOA 0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9), where its key is read from, and which script/path executes (scripts/lp-rebalancer.js, scripts/lp-opener.js, sasha-defi-execution skill — inspect them).
- Swaps (cbBTC→WETH/USDC) — which router/aggregator the code uses, slippage controls.
- Hyperliquid orders (close BTC short, open ETH short) — scripts/hedge-executor.js, hedge wallet 0xFAef67C0ee18dD89eaAA91a3d485e48949F7Ed04, EIP-712 chainId 1337, reduce_only semantics.
Report the exact signing path for each leg. If any key/path is unclear, surface it as a blocker — do NOT proceed to capital steps.

== STEP 2: RE-VERIFY EVERYTHING LIVE (read-only) ==
Run and report (these scripts already exist from last night; re-run them):
- node /tmp/poolread.mjs  → live WETH/USDC ts100 slot0, current tick, dynamic fee(), token0/1, and the recomputed ±10% range ticks at the NEW spot.
- node /tmp/hl.mjs        → live ETH mark, funding (annualized, who pays), maintenance margin, leverage→liq table, and the CURRENT BTC hedge state (size/entry/uPnL/liq/margin/account value).
- node scripts/lp-scout.js --validate  → confirm WETH/USDC ts100 is STILL the top stable/bluechip Base pool and its fee APR still holds. If a different pool now leads materially, STOP and tell me — do not migrate to a stale pick.
- Read the live cbBTC/USDC position to mark the exact exit amounts (lp-reconcile or on-chain): current LP value, token composition (USDC + cbBTC), pending AERO, NFT #71397771, gauge 0x9B55cb6cAe1e303B5EDce6F9fcf90246D382809c.
- Read live cbBTC and ETH prices from an independent source (GeckoTerminal/DexScreener) and cross-check against on-chain. Read live Base gas.

== STEP 3: RECOMPUTE THE FULL PLAN AT LIVE PRICE ==
Using defi-lp-math, recompute (show the math):
- Range ±10% around the LIVE ETH spot → tickLower/tickUpper snapped to ts100, and the resulting price band. Confirm spot is comfortably inside (if ETH is already near a band, flag it — a fresh position should be centered).
- Token split by value at that range (was 47.7% WETH / 52.3% USDC at $1,812 — recompute).
- Capital census: cbBTC/USDC LP value + idle LP wallet + HL account after closing the BTC short. Net of gas/swap slippage.
- Hedge: size = WETH in the new LP at entry (delta-neutral at entry). Leverage→liq table at the live entry; pick the leverage that puts liq ~+15–20% (≈ +6–9% above the upper band). Margin = notional / leverage (ISOLATED). Confirm funding sign.
- IL at the band edges; expected net-vs-HODL framing.
Present a single recomputed parameter table.

== STEP 4: GO / NO-GO REVIEW (gate before any tx) ==
Explicitly check and report PASS/FAIL on each, then ask me to approve GO:
- Pool still #1 and fee APR still high (real, dynamic-fee aware).
- Spot well inside the proposed range (not about to be OOR on entry).
- Funding not deeply negative (short should receive, or at least not bleed).
- Hedge liq lands ~+15–20% (above the upper band with room).
- Capital math closes (LP + margin + small reserve = available).
- Signing path proven for every leg; ts100 mint dry-run succeeded.
- Decide WITH me: (a) Capital Option A (simple, ~$44 LP, idle HL reserve) vs B (bridge HL→Base for ~$62 LP); (b) leverage 4.5x vs 5x.
If any FAIL → STOP, explain, propose a fix. Do not proceed on a FAIL.

== STEP 5: EXECUTE (each sub-step is a separate [NEEDS APPROVAL] gate; reordered to minimize the unhedged window) ==
For EACH: show the exact call + amounts + min-outs + expected result, run the dry-run, then WAIT for my "execute", then run it, then verify the on-chain/HL artifact before the next.
1. Claim + unstake current LP: gauge.getReward(71397771) then gauge.withdraw(71397771) → NFT to 0x21AF…A9A9. Verify NFT ownership + AERO received.
2. Close LP: decreaseLiquidity(all) + collect(max,max) on the Slipstream NPM (verify NPM address on-chain). Verify USDC+cbBTC+fees received. (BTC hedge still ON.)
3. Swap to target ratio: cbBTC→WETH and cbBTC→USDC to hit the recomputed WETH/USDC amounts, with min-outs. Verify resulting balances. (This is the transition moment — BTC short now naked.)
4. Re-hedge back-to-back: (4a) close BTC short on HL (market BUY 0.00043, reduce_only=true); (4b) set ETH leverage isolated to the chosen value, open ETH short of the recomputed size (market SELL, reduce_only=false). Verify both fills, the new ETH position, margin, and liq price.
5. Open the new LP: approve WETH+USDC to the NPM, mint(tickSpacing 100, recomputed ticks + amounts + min). DO NOT stake (fee-collect mode). Verify the new NFT, range, and that it is in range.
6. Final verification: net delta ≈ 0, hedge liq where intended, funding positive, LP in range. 

== STEP 6: POST-EXECUTION ==
- Update state/lp-positions.json with the new position + hedge (close out the old).
- Re-run lp-reconcile + build-dashboard-data so the live dashboard reflects the new position; verify on pages.dev/lp-miner.
- Append a decision-log entry recording what was executed (tx hashes, fills, final params).
- Update memory (project_lp_selection_validated / project_lp_miner_stack) with the live position.
- Set a watch: confirm ACTUAL collected fees over the next 2–3 days vs the ~200% projection before trusting the APR. Note the OOR/kill policy from the plan (OOR>24h, or price >5% beyond a band, or hedge within 3% of liq → close + reassess; no constant rebalance).
- Log status to ~/claude-fleet/dashboard.log at start and finish.

== ABORT / FAILURE HANDLING ==
- If a step fails mid-migration leaving an unhedged or half-migrated state, STOP and tell me immediately with the exact current exposure (what we hold, what's hedged). The risky window is between step 5.3 (swap) and 5.4b (ETH short) — keep it tight; if it stalls there, prioritize restoring a hedge.
- If live data contradicts the plan (pool no longer best, spot at a band edge, funding deeply negative, signing path unproven), do NOT force the migration — report and wait.

Success = the new WETH/USDC ts100 position is live, in range, delta-neutral at entry, hedge liq ~+15–20%, every tx verified on-chain, dashboard + state + decision log updated, and nothing was signed without my approval.
```
