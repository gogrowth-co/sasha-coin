# Decision Log

Record architectural and strategic decisions here.

Format: **DEC-NNN | YYYY-MM-DD | Category**
Decision (one paragraph), Rationale, Alternatives considered, Impact, Supersedes/Superseded-by

---

**DEC-001 | 2026-06-02 | LP / Treasury strategy**

Decision: The Sasha LP miner is designated a **proof-of-capability / narrative artifact, not a yield engine.** Keep it small (~$45 to $100), keep it safe, and stop optimizing it for yield. The dollar return is noise and will be treated as such.

Rationale: Two datasets prove ETH/BTC-vs-stable v3 LPing does not produce meaningful organic fee yield at the sizes/pools used. (1) The manual era (Revert, 146 positions, ~$85K churned over 9 months) earned only $742 in fees; the ~$2K result was directional range-trading, not yield, at a 57% coin-flip win rate. (2) The autonomous LP miner earns ~$0 organic fees (forfeited to the gauge) and nets +$0.45 over 7 days entirely from AERO emissions, with IL eating the hedge gain. The fee thesis fails in both eras. The real asset is the autonomous capability + narrative, which is currently gated by the dead content engine.

Alternatives considered: (a) Real yield engine — rejected for now; would need real capital size, pool selection where fees actually pay (pool-health data, dashboard v2), and treating emissions as the yield. (b) Capability testbed only — folded into the proof-artifact posture. (c) Wind down — rejected; forfeits the proof/story value that justifies the buildathon + content.

Impact / action items:
- Stop optimizing the LP for yield; report it honestly (the dashboard rebuild + complement prompt already enforce true MTM and fee-vs-emission split).
- Fix the cheap structural leaks: right-size the ~$10.4 idle hedge buffer and the $2.88 idle LP wallet (~$13 of dead capital). Skip dynamic hedge rebalancing at this size (gas not worth it).
- Defer any "scale into a real yield engine" decision until dashboard pool-health v2 exists, since pool selection is the entire lever.
- Highest-leverage move on the board is NOT the LP: it is fixing the dead content engine, because the narrative value of the proof artifact is zero if Sasha cannot post.

Supersedes/Superseded-by: yield-relevance clause amended by DEC-002.

---

**DEC-002 | 2026-06-02 | LP / Treasury strategy (refines DEC-001)**

Decision: The proof-artifact framing stands, but **the proof IS profitability plus hedging skill.** The position must net at least modestly positive and visibly hold delta through volatility. "Flat forever" or "loses money" kills the narrative. DEC-001's "the dollars are noise / stop optimizing yield" clause is amended: small absolute dollars are fine, but the SIGN (positive) and the HEDGE PERFORMANCE are the story, not noise.

The narrative is specifically two claims: (1) an autonomous agent that **finds the most profitable LPs**, and (2) **hedges volatility well.** Claim 2 was stress-tested and validated this week: BTC fell ~10% to ~$66K, Sasha's short gained +$2.006 and offset the LP's -$3.05 decline, staying delta-neutral. Claim 1 is the current gap.

Rationale: Validated against the "Underdog Investor Group" creator's videos (the delta-neutral LP-plus-perp-short playbook Gabriel studied). Same mechanic as Sasha. The difference that explains his fee income vs Sasha's ~$0: he selects high-fee-APR / high-volume pools and **collects swap fees directly**; Sasha staked a low-fee pair into a gauge and **forfeited swap fees for AERO emissions.** Pool selection + fee-capture mode is the lever, not size.

Strategic levers (in priority order): (1) **Pool selection** for real organic fee APR, driven by pool-health data (dashboard v2 = the productized "find profitable LPs" instrument). (2) **Fee-capture mode** per pool: collect swap fees (unstaked) vs gauge emissions (staked), whichever is higher for that pool. (3) Modest size-up only after a good pool is found ($45 is below the size where fees clear gas). (4) Keep the hedge (validated), consider tighter rebalancing.

Impact: Reframes the dashboard's purpose. It is not just an honest scoreboard; it is the **pool-hunting instrument** that makes claim 1 true. The "stop optimizing yield" guidance is replaced by "optimize for finding fee-paying pools and proving the hedge, at small but positive scale."

Supersedes/Superseded-by: refines and partially supersedes DEC-001.

---

**DEC-003 | 2026-06-03 | Durable skill architecture + integration registry + liveness checks; root-cause of the dead content engine**

Decision: Establish a durable reliability layer for Sasha so Claude/OpenCLAW use each API correctly and degradation is caught early: (1) a machine-readable integration registry at `docs/integrations/registry.json` (34 integrations, env-var NAMES only, `live_action_risk`, fallback, smoke test, `owner_skill`); (2) six skills in `.claude/skills/sasha-*` (`xlayer-oracle-keeper`, `signal-fusion`, `social-agent`, `defi-execution`, `distribution-liveness`, `ops-hardening`), with slim runtime mirrors of the first four + the liveness self-check in `skills/` for VPS deploy; (3) two read-only check scripts — `scripts/check-integration-docs.mjs` (docs freshness/drift) and `scripts/audit-sasha-distribution.mjs` (healthy/degraded/broken liveness verdict, never posts/trades/signs).

Confirmed root cause of the degraded persona/reply engine (read-only live VPS diagnosis 2026-06-03, NOT hypothesis):
- **No persona/reply cron exists on the VPS.** `/etc/cron.d/` has `sasha-{dashboard,hedge,lp-miner,oracle,trade}` only — zero `twitter-scheduled-post` / `twitter-reply-gal` jobs, and `openclaw.json` has no scheduler wiring for them. So the 3-posts/day + 2-replies/day cadence simply does not run. This is why `posted-log.json` (newest 2026-05-25 workspace / 2026-05-12 core) and `replied-tweets.json` are stale. This validates DEC-001's "the dead content engine is the highest-leverage problem."
- The only content reaching Buffer is `weekly-yield-tweet.js` (Mondays) + auto-trade receipts → exactly the "repetitive automated LP/yield posts instead of Sasha's voice" risk.
- **Buffer is healthy** (live probe HTTP 200). The `PostPublishingError.code` GraphQL-400 is documented defensively but was NOT the live cause. The committed `post_to_buffer.js` mutation never selected `.code`; the drift only bites a queue-READ query.
- **Box overload**: load ~11 on 2 vCPU → `spawnSync /bin/sh ETIMEDOUT` breaking `weekly-yield-tweet` (Buffer post, June 1), `treasury-monitor`, `dust-consolidator`.
- **`read-sasha-results/scripts/drain.mjs` is missing** → the per-minute `sasha-drain` cron crashes (MODULE_NOT_FOUND), adding load.
- **Dual state dirs** (`.openclaw/state` vs `.openclaw/workspace/state`) + a **reply-path split** (`twitter-reply-gal`→`tweet.js` X API vs local `morning-reply-run.js`→ADB phone).

Also fixed confirmed stale config: `.env.example` X Layer testnet `XLAYER_TESTNET_CHAIN_ID 195 → 1952 (0x7A0)` and testnet RPC `→ /terigon` (verified vs official OKX docs); `_context/tool-registry.md` Gemini key `GOOGLE_API_KEY → GEMINI_API_KEY`.

Security note: `.env`/`.env.bak` are gitignored and were never committed (`git log --all --full-history` empty). No git secret exposure → no exposure-driven rotation required. Earlier "rotate committed secrets" claim corrected.

Out of scope / follow-ups requiring approval (diagnosis only, no live fixes applied): install the persona/reply cron (or OpenCLAW scheduler triggers); choose ONE canonical reply path; unify the state dir; restore/disable the drain cron; relieve the box load. Content/brief refresh (`content/active-brief.md` expired 2026-05-28) → handed off to the `marketing/` workspace per the workspace boundary. Per the "never claim a fix works without observed execution" rule, any cron fix must be confirmed by a fresh `posted-log.json` artifact after the next BRT slot.

Supersedes/Superseded-by: complements DEC-001/DEC-002 (explains the "dead content engine" they flagged).

---

**DEC-003b | 2026-06-03 | VPS infra remediation applied (Sasha-side only, reversible, no Maestro touch)**

After a read-only re-check + Codex review, three Sasha-scoped, reversible fixes were applied — no Maestro/`mrzq` changes, no container restart, snapshots before each step, verified by observed execution.

- **Box-load cause refined:** NOT a Sasha runaway. `mrzq` (Maestro) steady-state is ~8% in-container; the 790% `docker stats` spike is a burst from Maestro's **19** per-minute/5-min `docker exec` cron jobs converging on a **2-vCPU** host (Sasha has 1 such cron + her own host crons). Shared under-provisioning. The earlier 11.75 vs 3.25 readings were peak vs lull (sustained 15-min avg ~5 on 2 cores). No CPU limits set on either container.
- **WS1 (done, verified):** disabled the vestigial `sasha-drain` host cron — the `read-sasha-results` skill never existed; it's a Slack/git flow and Sasha is Telegram. `/var/log/sasha-drain.log` confirmed frozen across ticks; `marketing-drain` untouched. Crontab backed up to `/root/crontab.bak.*`.
- **WS2 (applied as cron hygiene; did NOT fix the treasury ETIMEDOUT — observed):** `sasha-dashboard` `*/5`→`*/15`; de-collided schedule: monitor `*/30` (0,30), rebalancer `3,33`, hedge `5,35`, treasury `20,50`. `/etc/cron.d/sasha-*` backed up. **Observed verification:** the 20:50 treasury run STILL hit `spawnSync ETIMEDOUT` at box load ~2–4 → the treasury failures (174 and counting) are **NOT box contention**. Real cause: `treasury-monitor.js` shells out to `byreal-cli wallet balance` (wallet + each of 5 open LP positions), which intermittently exceeds its already-raised 60s timeout (`BYREAL_BALANCE_TIMEOUT_MS`, 2 attempts) on the Solana RPC. **Non-fatal** — the carry-forward guard reuses the last-good balance flagged STALE. byreal-cli uses Helius (not the public RPC) and `SOLANA_RPC_URL` is absent from `.env`, so it's heavy-query/RPC latency, not an env override; auto-trade (also byreal-cli) has only ~3 ETIMEDOUTs. Fix options (NOT applied — needs decision): raise `BYREAL_BALANCE_TIMEOUT_MS` to 90–120s, lower treasury cadence, or lighten the balance query. The cron de-collision is kept as harmless hygiene (dashboard 3× less frequent).
- **WS3 (done, verified):** unified the dual state dirs. Canonical = `.openclaw/workspace/state` (live 30 posted-log / 28 replied + all DeFi state). Snapshotted both → `.openclaw/state-backup-20260603`; forwarded `calendar-state.json` into workspace; archived stale core social files → `*.stale-20260603` (left `sasha-cross-project-status.json`, which a host cron reads); pointed `twitter-scheduled-post/SKILL.md` line 73 at the workspace path (repo + VPS); tightened the audit's dual-state check. `audit-sasha-distribution.mjs --ssh` no longer reports `dual-state`.
- **Durable load fix still pending (separate decision):** the host is under-provisioned — upsize the droplet (2→4 vCPU) or split `mrzq`/`h3mk`. Sasha-side relief lowers her contribution but cannot fix Maestro's burst load.

Rollback: crontab + cron.d `.bak.*` on the VPS; state snapshot at `.openclaw/state-backup-20260603`. Out of scope (unchanged): persona/reply cadence + brief (marketing, `SASHA-PERSONA-BRIEF-001`); building `read-sasha-results`.

Supersedes/Superseded-by: executes the runtime/infra follow-ups from DEC-003.

---

**DEC-004 | 2026-06-04 | LP data-layer — documented + self-verifying**

Decision: The LP pool data stack (the "accurate stack" from `research/lp-data-sources-methodology-2026-06-02.md`) is now captured as a precise, live-verified **API spec** at `docs/integrations/lp-data-sources-api-reference.md`, wired into the five skills that consume pool data, and kept accurate by an automated weekly integrity check.

What shipped:
- **API reference doc** — exact endpoints, fields, rate limits, chain slugs, and the v2 scanner flow for DefiLlama, GeckoTerminal, DexScreener, Revert. Built from probing each live API (not docs/training). Surfaced one upgrade over prior knowledge: **Revert's pool-level endpoint is now mapped** (`/v1/positions?network=&exchange=&pool=`), closing the "not yet mapped" gap in the methodology file.
- **Skill wiring** — `defi-lp-math` (§12 APR estimation + references), `base-defi-stack` (§7), `solana-clmm` (§5), `sasha-defi-execution` (reuse list), `sasha-signal-fusion` now point at the spec so any LP work loads the right data sources and the "never rank capital on DefiLlama APY" rule.
- **Self-verification** — `scripts/signals/lp-data-source-verifier.mjs` + launchd `com.mangaos.lp-datasource-check` (Mondays 09:05, runner `~/bin/run-lp-datasource-check.sh`). Probes the 4 APIs, diffs `state/lp-data-source-baseline.json`, stamps `**Last auto-verified:**`, writes `reports/lp-data-source-check-*.{json,md}`, and on drift appends to the doc's Drift log + alerts (Telegram on VPS, fleet dashboard locally). `protocol-changelog` §6 documents it.

Rationale: docs rot silently and an undocumented source (Revert) can change without notice. A deterministic drift detector keeps the spec provably current without pretending a script can author docs — the prose fix stays human/Claude-driven when an alert fires (honors the no-overclaim rule).

Alternatives considered: (a) headless-Claude weekly rewrite — rejected as more expensive, less deterministic, harder to verify under launchd's stripped env; (b) fold into `protocol-changelog`'s manual procedure — rejected, the APIs are machine-checkable so automation beats a checklist. Chose deterministic probe + baseline-diff + alert.

Impact: the DATA-LAYER half of DEC-002's "find the most profitable LPs" instrument is now documented + integrity-checked. The `pool-scanner.js` / pool-health v2 **code rewrite onto this stack is still pending** — until then, automated rankings remain advisory, capital decisions use the hand-run method. Observed working 2026-06-04 (launchctl-kicked run, all 4 sources LIVE, exit 0); first calendar trigger Mon 2026-06-08.

Supersedes/Superseded-by: builds on the data verdict in DEC-002; complements `project_pool_scanner_data_gap` + new `project_lp_datasource_verifier` memory.

---

**DEC-005 | 2026-06-04 | LP venue locked to Base; accurate-stack scanner shipped; multichain deferred to Phase 5**

Decision: **Stay on Base for LP entry for now.** A live cross-chain sweep (Ethereum, Arbitrum, Base, Optimism, BSC, Polygon, Avalanche, Solana) confirmed Base already hosts the best stable/bluechip pools anywhere — Aerodrome Slipstream WETH/USDC ts100 (~246%) and cbBTC/USDC ts100 (~89%) top the entire board. Multichain expansion is **deferred to Phase 5** (spec: `docs/lp-miner-phase5-multichain-plan.md`).

Also shipped: **`scripts/lp-scout.js`** is now the CANONICAL accurate-stack scanner for stable/bluechip Base LP selection (GeckoTerminal + DexScreener + on-chain `fee()` + 30d-avg volume, `--validate` adds a Dune `dex.trades` realized-volume cross-check). This closes the stable/bluechip-Base slice of the "scanner code rewrite still pending" gap from DEC-004. Legacy `scripts/pool-scanner.js` (DefiLlama-based) is deprecated for selection. Run `node scripts/lp-scout.js --validate` whenever we need a new stable/bluechip pool to enter.

Rationale: pool selection is the lever (DEC-002), and the sweep proves Base is its best setting. Three findings made multichain not worth building now: (1) no other chain beats Base on net fee APR; (2) the one outlier (Avalanche WAVAX/USDC on Pharaoh ~127%) is smaller/newer-DEX/thinner-hedge — a future diversification candidate, not a primary; (3) Ethereum mainnet gas is now negligible (~$0.32/rebalance at 0.22 gwei — the old "gas trap" assumption was stale, corrected against live data), but its pools are lower-APR than Base, so cheap gas still does not make mainnet worth it.

Alternatives considered: (a) build chain-agnostic scanner now — rejected, ~1.5-2 days for no current edge over Base; parked as Phase 5 with trigger conditions. (b) Add the Avalanche Pharaoh pool as a second position now — deferred; revisit if it holds 100%+ over a calmer multi-month window with a usable AVAX hedge.

Impact: LP selection is locked on verified numbers; the two Base finalists feed the next (hedge-sizing) session. Open LP decision is purely BTC-hedge (cbBTC/USDC ts100, reuse existing hedge, ~80%) vs ETH-hedge (WETH/USDC ts100, new short leg, ~250%).

Supersedes/Superseded-by: extends DEC-002 (pool selection lever) and DEC-004 (data layer); partially closes DEC-004's pending scanner-code-rewrite item for the stable/bluechip-Base case.

---

**DEC-006 | 2026-06-04 | LP data layer — added The Graph (5th source) + cloud auto-fix routine**

Decision: Added **The Graph** (decentralized-network gateway) as the 5th LP data source, wired into the same documented + self-verifying system as DEC-004. It is the most powerful CL source: subgraphs expose **tick-level in-range liquidity** and **exact per-pool daily/hourly history** (`volumeUSD`/`feesUSD`/`tvlUSD`) — the realized-fee-APR + concentration data no aggregator gives. Also stood up the **cloud half of the hybrid verifier**: a scheduled remote Claude routine that auto-fixes the doc via PR on drift.

What shipped:
- **Doc §5** in `lp-data-sources-api-reference.md`: gateway auth (path + Bearer), free tier (100k q/mo), verified subgraph IDs (Uniswap v3 ETH `5zvR82...`, Aerodrome Base `GENunSHWLBXm59mBSgPzQ8metBEp9YDfdqwFr91Av1UM`), exact CL entity/field names (`pool`, `poolDayDatas`, `poolHourDatas`, `ticks`, `_meta`), the `feesUSD`-is-derived caveat, indexing-lag detection, and EVM-only Solana reality. Flow + one-line stack updated to use The Graph for exact history + in-range TVL denominator.
- **Verifier** (`lp-data-source-verifier.mjs`): `probeTheGraph()` Bearer-queries both subgraphs, asserts pool fields + `hasIndexingErrors:false` + fresh block; reads `THE_GRAPH_API_KEY` from `.env` (graceful no-key); added a down-suppression rule so transient outages don't false-flag baseline drift. Rebaselined to 5 sources; observed all-LIVE locally.
- **Skills**: defi-lp-math §12, base-defi-stack §7, solana-clmm §5 (EVM-only note), sasha-defi-execution, sasha-signal-fusion, protocol-changelog §6, `_context/tool-registry.md` Data sources, and `registry.json` (now 35 integrations) all wired.
- **Cloud routine** (`trig_01Hkcc8Pe6XUmNrUFHAUmGQR`, Mondays 13:00 UTC, sonnet): reads the doc from the GitHub repo, re-probes the 4 KEYLESS APIs via curl, and on drift opens a PR fixing the doc (never touches main). Staged pending two prereqs (Gabriel): install the Claude GitHub App on `gogrowth-co/sasha-coin`, and push the doc to `main`.

Key finding (action item): **`THE_GRAPH_API_KEY` is malformed — 151 chars; the real gateway key is the first 32 hex** (gateway 401s the full value). Fixed in `sasha-coin/.env`; **`marketing/.env` still holds the 151-char value and should be corrected at the source.**

Rationale: The Graph closes the two biggest CL gaps the aggregators leave — in-range liquidity (the correct fee-APR denominator) and exact historical window volume — directly from the data layer protocols index themselves. Auth split is honest: The Graph needs a key the cloud sandbox can't hold, so the local job checks all 5 and the cloud routine checks the 4 keyless ones.

Impact: the DEC-004 data layer is now 5 sources, all integrity-checked weekly. The pool-scanner v2 code rewrite remains the open item.

Supersedes/Superseded-by: extends DEC-004 (documented + self-verifying data layer).

---

**DEC-007 | 2026-06-04 | LP migration EXECUTED — cbBTC/USDC ts2000 → WETH/USDC ts100 + leveraged ETH hedge**

Decision/action: Executed the LP-miner migration from the laggard **cbBTC/USDC Aerodrome Slipstream ts2000** (~18% fee APR) to the #1 pool **WETH/USDC Aerodrome Slipstream ts100** (`0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59`, lp-scout --validate: 569% 30d gross fee APR, TVL $9.6M), with a fresh **5x isolated ETH delta-neutral hedge**. Capital **Option A** (~$40 LP from Base funds, ETH-short margin from the existing HL account, ~$23 idle HL reserve). All legs signed by the LP-miner EOA `0x21AF273…` on Base (key = `MANTLE_AGENT_PK`, the shared LP key — NOT a Mantle action) and the HL hedge wallet `0xFAef67…`; every capital leg was a separate Gabriel-approved gate, each dry-run first, each verified on-chain.

Executed (live, Base chainId 8453 + Hyperliquid):
- Claim+unstake NFT 71397771 (0.585 AERO): getReward `0x3692b6de…34a5`, withdraw `0xe420d77a…4e97`.
- Close LP: decreaseLiquidity `0xd9d78129…35fd` + collect `0xac9b21d4…4ea3` → 6.59 USDC + 0.000532 cbBTC.
- Swap cbBTC→USDC `0xa43d4edc…e913` (Uniswap v3 SwapRouter02, 0.05%), then USDC→WETH `0x5611bd9a…7212`.
- Close BTC short (oid 457776062063, realized **+$3.71**); open ETH short **0.0106 @ 5x isolated** (oid 457778830715, entry $1770.6, **liq $2082**, margin $3.74).
- Mint **WETH/USDC ts100 NFT 71722642** `0xca933aeb…00c6`, ticks **[-202600,-200600]** ($1590.87–$1943.07), **UNSTAKED (fee-collect)**.
- Final verified: LP $40.28 (WETH 0.0106 + USDC 21.52), **in range (54% through)**, **net delta −$0.02 ≈ 0**, funding +0.9% (short receives), hedge liq **+7.2% above upper band**, HL reserve $22.89, dust $0.15 USDC + gas ETH.

Tooling reality: the plan assumed `lp-rebalancer.js` + `lp-opener.js` could execute this; they could not (lp-rebalancer Base close/kill path is a **stub**; lp-opener **hardcodes tickSpacing 2000 + auto-stakes**; no swap-with-slippage). Built 4 one-off dry-run-first scripts — `migrate-lp-exit.js`, `migrate-lp-swap.js`, `migrate-hl-rehedge.js`, `migrate-lp-mint.js` (+ `migrate-state-update.js`) — deployed via surgical scp to the VPS (Base key is VPS-only). Two bugs found and **fixed, not bypassed**: (1) `decreaseLiquidity` reverted at `estimateGas` on the public Base RPC → hardened all signing scripts with explicit `gasLimit` + a pre-send `staticCall` guard (aborts instead of broadcasting a doomed tx) + 3% close mins; (2) the QuoterV2 address documented in `base-defi-stack` (`0x3d4e44Eb1374240CE5F1B136041212F30e7E0d11`) has **NO code on Base** → swap min-outs now derived from each pool's `slot0` price instead.

Design: **STATIC hedge, no rebalance** (per the plan). The new pool `0xb2cc…` is intentionally **NOT** in `hedge-executor.js` `POOL_REGISTRY`, so the 30-min `sasha-hedge` cron is a **no-op** on the ETH short (it won't auto-rebalance). Consequence: the funding-kill + KILL policy are **MANUAL** — close LP+hedge if OOR>24h, OR ETH >5% beyond a band (<$1511 or >$2040), OR hedge within 3% of liq ($2082). Documented in the position's `state/lp-positions.json` `_comment` and `staticHedge:true`. Crons `sasha-hedge` + `sasha-lp-miner` were paused for the migration window (backup `/root/cron-paused-migration-20260604`) and restored after.

Open follow-ups: (a) reset `state/miner-baseline.json` to the new entry — the dashboard NET-result shows `null`/`$45 basis` from the old position; (b) verify the 19:35 UTC `sasha-hedge` run is a no-op on `0xb2cc…` in `/var/log/sasha-hedge.log`; (c) fix the QuoterV2 address in `base-defi-stack`; (d) **watch actual collected fees over 2–3 days vs the 200%+ projection before trusting the APR** (DEC-002's biggest uncertainty — concentrated ±10% capture depends on in-range uptime).

Supersedes/Superseded-by: executes the WETH/USDC choice from DEC-005; the live position supersedes the cbBTC/USDC ts2000 position from DEC-001/DEC-002.

---

**DEC-008 | 2026-06-05 | LP OOR policy → self-alerting monitor (first earned autonomy step; alert-only, no auto-execute)**

Decision/action: Replaced the WETH/USDC position's OOR kill-switch (old: 240 min continuous OOR → auto `CLOSE_REOPEN`) with a **three-tier, no-recenter policy** in `scripts/position-monitor.js`, per `docs/lp-oor-policy-update-spec.md`. (1) **Soft/time:** OOR ≥ 720 min → `OOR_ALERT` (Telegram + signal, `killSwitch:false`, hold-and-evaluate, no close). (2) **Hard/distance:** price ≥ 5% beyond the breached band → `KILL` (fires regardless of timer — a deep excursion is a trend; gives the downside a shorter effective fuse). (3) **Hard/hedge-liq:** hedge mark within 3% of liquidation → `KILL`. `CLOSE_REOPEN` removed from the OOR auto-path (kept only for a deliberate manual recenter). Config: global `KILL.oorTimeoutMinutes` 240→720, added `oorDistanceKillPct=5` + `hedgeLiqProximityPct=3`; per-position overrides set on the WETH/USDC position (local seed + VPS live state, additive merge preserving `firstOorAt`/`fundingHistory`). `getHlFundingRate()` extended to return live `markPx` (per-perp) for the liq guard. This is the first earned step from "watch it manually" → "it alerts itself" — it is **MONITOR + ALERT only; it never closes on its own.**

Sanity (matches the documented manual KILL thresholds): for bands $1590.87–$1943.07, the 5% distance guard fires at ETH **<$1511.33** (low) / **>$2040.22** (high), and the 3% hedge-liq guard at mark **≥~$2019.5** (liq $2082) — identical to the position `_comment` from DEC-007. ✓

Safety hole found + closed (not in the spec): the spec assumed "KILL stays gated on my confirmation," but `/etc/cron.d/sasha-lp-miner` runs `lp-rebalancer.js --execute` at `:03/:33` — **3 min after every monitor run** — so a monitor-emitted KILL would auto-consume. For this Base position that means no on-chain LP/hedge close (Base path unwired) **but** auto-removal from `state/lp-positions.json` + a real ERC-8004 attestation + a false "CLOSED ✅ EXECUTED" Telegram, with **no confirmation**. Fix: the two new KILLs are tagged `confirmGated:true`; `lp-rebalancer.js` now skips auto-executing a confirm-gated KILL unless run with `--confirm-kill` / `LP_KILL_OK=1` (the cron passes neither) — it alerts "KILL pending confirmation" and retains the signal. Existing HF/funding/stop-loss/drift kill switches are **untouched** (no flag → behave as before). `OOR_ALERT` added to the rebalancer as a notify-only/no-op type.

Verification (dry-run-by-default → deploy → observed real run; per CLAUDE.md rule 13):
- Dry-ran all 5 branches with forced inputs (temp workspace): in-range → no action; OOR 120 min/2.1% → no action; OOR 780 min/2.1% → `OOR_ALERT` only; OOR 8.3% beyond → `KILL` (NOT `CLOSE_REOPEN`); hedge mark 1.1% from liq → `KILL`. Rebalancer gate: `--execute` w/o `--confirm-kill` HOLDS + retains signal; `--execute --confirm-kill` routes to the (Base-unwired) close.
- Deploy: scoped `scp` of `position-monitor.js` + `lp-rebalancer.js` to the VPS (NOT a full `deploy.sh --execute` — the tree has 130 unrelated dirty entries; a full `--delete` sync would push 47 unrelated WIP files and is blocked by the dirty-tree guard anyway). md5 local==VPS confirmed (`b6ffd1be…` / `1183082…`). `state/` is deploy-excluded (VPS-owned) → patched in place additively.
- **Observed real cron run (15:30 UTC, final deployed bytes):** `Price: 1593.56 | Range: [1590.87–1943.07] | In range: true` → `Hedge mark 1593.70 vs liq 2082 — 23.5% away (threshold: 3%)` (new guard line, absent from the 14:30 old-code run) → `All positions healthy — no actions needed`. In-range no-op path, no `CLOSE_REOPEN`, no spurious alert. The 720-min threshold line was observed on the deployed file via forced-input dry-run (branches C/D).

Dashboard: updated the kill-switch panel render (`web/lp-miner/index.html`) + generator (`scripts/build-dashboard-data.js`) + `dashboard.json` to the real policy (OOR alert >720 min · hold/evaluate; OOR kill ≥5% beyond band; hedge liq guard within 3%; KILL execution = manual·Gabriel confirms), and rewrote the now-obsolete FAQ/glossary copy (removed "CLOSE_REOPEN after timeout"/"auto-monitor pending"). Morpho rows stay dropped (`hasMorphoLeg:false`). Copy/data change, not a visual redesign. **pages.dev publish pending Gabriel's go.**

Rationale: auto-recenter crystallizes IL on moves that mean-revert; this position is intentionally no-rebalance (DEC-007). Earn-autonomy posture (`feedback_autonomy_design_principles`): observe-only first — the monitor alerts, Gabriel confirms any KILL. The auto-close + auto-re-enter loop (bounded mandate + circuit breaker) is a deliberately deferred LATER phase, NOT built here.

Open follow-ups: (a) pages.dev publish of the LP dashboard; (b) Gabriel to decide the broader rebalancer-cron posture (keep the per-KILL confirm-gate as shipped, vs. remove the `:03/:33 --execute` cron entirely for true observe-only); (c) the Base close/kill path remains a stub — a real KILL still needs the manual close scripts from DEC-007.

Addendum (2026-06-05): Gabriel chose to **keep the per-KILL confirm-gate** and **publish the dashboard** (read-only; clarified there is no kill *button* on the public page — it's a display-only panel, one GET call, execution is SSH-only). Also added a **real uncollected-fee read** to `lp-reconcile.js` (`NPM.collect.staticCall(from=owner)` — pure eth_call) so the dashboard shows actual swap fees instead of "fee read pending": live value **$0.26** (WETH+USDC) on the WETH/USDC position ~1d after open. Folded into `pnl.netResultUsd` (−$1.11 → −$0.83) + both P&L decompositions + the yield block. md5-verified deploy of `lp-reconcile.js`/`index.html`; the 15-min `sasha-dashboard` cron publishes to pages.dev.

Supersedes/Superseded-by: changes the OOR kill-switch behavior set in DEC-007 / safety-gates Gate 4 (240 min → 720 min + distance/hedge-liq tiers, auto-recenter removed). Drift/HF/funding kill switches unchanged.

---

**DEC-009 | 2026-06-07 | No-swap single-sided rebalancing (Snuggle.fi/Maxfi) — NO-GO for the live hedged position; technique kept for a future unhedged sleeve only**

Decision: After deep research (primary sources) + a 5-advisor council + a Klein pre-mortem, **do NOT adopt "no-swap single-sided rebalancing" for the live delta-neutral WETH/USDC position** (NFT 71722642). **(B) external Snuggle.fi/Maxfi vault: rejected unconditionally** (custody reversal vs the Clawlett Safe, unverified headline claims, 15% fee, surrenders the hedge). **(A) self-build the technique into `lp-rebalancer.js`: rejected as a change to this position.** Approved instead: a zero-capital shadow backtest (proof + EV) and a Sasha content teardown.

Why (the load-bearing reasons):
- **It reverses what we just decided.** DEC-008 (2 days prior) removed auto-recenter precisely because "auto-recenter crystallizes IL on moves that mean-revert; this position is intentionally no-rebalance." No-swap rebalancing is a *rebalancing* technique — adopting it un-does DEC-007/DEC-008. The empirical "rebalance ~85% less / lazy beats greedy" finding is already implemented here in the extreme (kill-only, zero rebalances).
- **It fights the hedge (the whole point).** `defi-lp-math` numeric check: no-swap swings LP delta between ~100% long (post-down, all WETH) and ~0 (post-up, all USDC) vs a stable ~48% for swap-to-recenter. The hedge is STATIC + MANUAL (pool `0xb2cc…` not in the hedge-executor registry). v3 range orders can UN-FILL, so the realized delta (hence the correct hedge size) is path-dependent and not final until withdrawal → no static short is correct for both legs. At the all-WETH extreme you'd short the full notional (~2x funding/margin).
- **Trivial upside, real tail.** Only substantiated benefit = removing swap-step MEV/slippage (single-dollar on four-figure capital, ~offset by extra redeploy gas). Headline claims ("40-50% less IL", "70-80% of exploit vectors removed", "most capital-efficient") are NOT in Snuggle's docs — unsubstantiated marketing. Not novel (Maverick Mode Right/Left does it natively; Maverick's own docs warn of high IL when price reverses).
- **Pre-mortem's #1 failure:** a rebalancing technique silently re-introducing directional exposure into a position whose safety IS its delta-neutrality — net-long into a downtrend while the static short covers half.

Approved cheap/reversible follow-ups (GO):
- (a) **Shadow backtest** — extend `scripts/lp-sim.js` into a path-based time-series replay; model `[no-swap LP delta swing + static 0.0106 ETH short]` vs the current `go-flat-on-kill` baseline, net result (fees+funding−IL−hedge drift−gas) on a ranging AND a trending WETH/USDC path. Zero capital, no Gabriel gate. Prereq: fix the malformed The Graph key (151 chars; real = first 32 hex) or use the GeckoTerminal OHLCV fallback. Also measure out-of-range event frequency (if ~0–2/quarter the EV is rounding error regardless).
- (b) **Content** — route to `marketing/`: a Sasha teardown on why a hedged, hands-off farm should NOT chase no-swap rebalancing (right financial call = right brand call). Do NOT repeat the vendor's IL/exploit numbers.

Scope note: the technique IS sound for an *unhedged, actively-managed, mean-reverting* LP (a future separate sleeve), self-built only, behind the same dry-run + confirm gate. It stays out of the delta-neutral position.

Frameworks: Sprint (Knapp) — riskiest assumption tested cheaply first. Pre-mortem (Klein; not yet in the shared library — gap flagged). Full memo: `reports/no-swap-rebalancing-decision-2026-06-07.md`.

Supersedes/Superseded-by: reaffirms DEC-007 (static hedge, no rebalance) and DEC-008 (no-recenter OOR policy) against the no-swap proposal; changes nothing on-chain.

Addendum (2026-06-07): **Backtest built + run, confirms the NO-GO.** `scripts/lp-noswap-backtest.js` — path-based hourly 90d A/B (HODL / BASELINE go-flat-on-kill / NOSWAP_STATIC / NOSWAP_REHEDGE) across RANGING/TREND-DOWN/TREND-UP/CHOP synthetic paths + a real ETH 90d series rescaled onto the range. Findings: NOSWAP_STATIC loses to baseline on ~every path at every fee APR; NOSWAP_REHEDGE only beats baseline at implausibly high, UNVERIFIED fee APR (~150%+) and only in trending/real regimes — it still loses ~−$4.5 in the RANGING path at 300% APR (rehedge churn). Best-case edge is +$0.5–$1.5 on a $40 position (noise). Cost is dominated by redeploy gas+perp (13–45 redeploys/quarter), NOT the swap savings. De-hedging tail = $21–$36 net-delta excursion (54–89% of capital), but it's a static-hedge property present in baseline too and capped by the DEC-008 kill (provided no-swap never re-enters past a kill). Two defects found+fixed during the build before trusting output (HODL was accruing LP fees; trend paths' noise swamped the drift → relabeled/retuned). Backtest is a directional A/B, not a P&L oracle (simplified fee + avg-reset hedge accounting). Verdict stands: NO-GO; the only winning corner needs an unverified APR + trending market + rehedging, for rounding-error gains, on a deliberately no-rebalance position.

---

**DEC-010 | 2026-06-08 | Casper Buildathon Phase 0 spike — GO (both mandatory live `casper-test` tx hashes landed)**

Decision: **GO** — proceed to Phase 1 (SPINE) of the Casper Agentic Buildathon build. The Codex-tightened Phase-0 GO bar (TWO live `casper-test` tx hashes — a public contract deploy AND a real x402 `/settle`) is met, both confirmed executed on-chain.

Artifacts (the DoraHacks-grade deliverables):
- **Contract deploy tx** `dc2d87a1830942799a7e2408ea3491ba18ca601a198ddc38f07ab96726a509c3` — Cep18X402 (CEP-18) deployed to public testnet, package `166e0ec88a3d1b3caec06edb723c841bac4d1182598d008aabfc0de99c81b9b8`.
- **x402 settle tx** `32cb5e5f8aae10c32157dcfa00aa3595adba53a06ac495188fa1b2902cf13924` — `transfer_with_authorization`, executed `error_message: null`, block `f06a1839…`, cost 7 CSPR. Full loop: client 402 → headless EIP-712 sign → facilitator verify+settle → HTTP 200 (paid resource unlocked).

Pre-checks (de-risking, not GO): OdraVM test PASS, CasperVM test PASS, x402 `/verify` PASS on a real headless ed25519 EIP-712 signature (the pre-mortem's #1 footgun — eliminated).

Validated stack (matters for Phase 1): `make-software/casper-x402` **Go** facilitator is wire-compatible end-to-end with the `odradev/casper-x402-poc` **Rust/Odra** CEP-18, once the off-chain resource-server `ASSET_NAME` equals the token's runtime `name` ("Casper X402 Token") — because cep3009's on-chain EIP-712 domain name = `self.token.name()`. Domain `{name, version:"1", chain_name=casper:casper-test, contract_package_hash}`; struct `TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)`. Headless signing = Casper Go SDK keypair (ed25519). Decision input from the spec: Go path approved (x402 ref is 100% Go; no TS EIP-712 equivalent) — Go 1.25.11 installed prebuilt, no sudo.

Key debugging that unblocked GO: `/tmp` gets wiped between sessions → spike moved to `~/dev/casper-spike` (durable; resume point `SPIKE-STATE.md`); wasm32 added to the pinned `nightly-2026-01-01`; `wasm-opt`(binaryen 130)+`wasm-strip`(wabt 1.0.41) installed to `~/.local`; odra livenet deploy needs `ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.casper.network/events` (SSE); first settle reverted `User error 37003 = cep3009::InvalidSignature` because off-chain `ASSET_NAME` was the test-helper `TOKEN_NAME` ("Cep18x402") not the runtime token name — fixed.

Scope/discipline notes: the spike settle was payer→payee on two keys I control — a **mechanism proof**, NOT the EXPOSE demo; a genuine external counterparty stays a **Phase 2 (STRETCH 1)** requirement (no self-dealing, spec §6). All Phase-0 work is in a throwaway `~/dev/casper-spike` tree; the SPINE will be a **fresh PUBLIC repo built from an allowlist** (never flip this private tree — `state/` holds live addresses + posting history) with a pre-commit secret scan. Testnet only; throwaway ed25519 key `01f50785…ccd064` funded with 4000 CSPR (Gabriel faucet'd his wallet 5000 CSPR + transferred 4000 to the on-disk signer).

Full result: `_ops/spike-result-casper-2026-06-08.md`. Memory: [[project_casper_buildathon]]. Content/demo/vote → `marketing/` (workspace boundary).

Supersedes/Superseded-by: none — opens the Casper build execution arc; next gate is Day-7 SPINE (attestation contract live on public testnet + agent loop + one live `402→settle` + fresh public repo).

---

**DEC-011 | 2026-06-08 | Casper SPINE: agent/adapter layer in Go, not TypeScript (plan deviation, research-backed)**

Decision: build the SPINE's `SettlementAdapter` + `CasperAdapter` + agent loop in **Go**, deviating from the spec/plan's stated TypeScript+casper-js-sdk. The contract stays Rust/Odra and the x402 facilitator stays Go regardless (the repo is polyglot either way; the only open choice was the agent/adapter layer).

Why (researched at Gabriel's request — he asked for pros/cons, not a snap call):
- The Phase-0 spike validated the Go path end-to-end (both live tx hashes came from casper-go-sdk); casper-js-sdk was never validated by us.
- Research correction: my Phase-0 note "no TS EIP-712 equivalent" was wrong — `@casper-ecosystem/casper-eip-712` v1.2.1 (npm, 2026-05-10) ships `buildDomain`/`hashTypedData`/`encodeAddress` + a prebuilt `TransferAuthorization` (though that prebuilt uses bytes32/uint64/snake_case and does NOT match the x402 `TransferWithAuthorization` variant — address/uint256/camelCase — so TS would need a custom type-def + a validation pass). casper-js-sdk v5 does support headless `TransactionV1`/`callEntrypoint`. So TS is viable, NOT the footgun I feared — but it is NEW code needing its own validation pass, against the Day-7 clock.
- Go wins on speed + robustness (pre-mortem's #1 risk = build doesn't fit by Day-7): ~100% reuse of the validated stack, zero new signing-validation, agent+facilitator coherent. The "chain-agnostic" story is an interface (provable in Go; Phase-4 EVM adapter via `x402-foundation/x402/go`), not a language. Gabriel chose Go.

Result so far (fresh PUBLIC repo `~/dev/sasha-x402-kit`, 4 commits, secret-scan gate verified working):
- AgentAttest contract: clean-room Rust/Odra, OdraVM+CasperVM tests, **live deploy tx `577570f2…dba0bfff`**, package `7b4bb374af24ee46a067f4d41f5cba61b097ba613825617e81a57d7673132262`.
- Go `core/` (chain-agnostic interface+types, no chain SDK) + `adapters/casper` (casper-go-sdk TransactionV1) — **live attest tx `15dd7a6f…57ae2546`** (error_message null) = Day-7 gate item #2 (agent writes on-chain). casper-go-sdk pinned to the spike-validated `v2.0.3-beta1.0.20260227130924-8416e84e4256`.

Remaining for Day-7 (Jun 13): Task 1.4 (agent's own x402 PAY client + agent loop + one live `402→settle` driven by the loop — note item #3 was already proven mechanically in Phase 0 via the make-software client, but the SUBMISSION needs the agent loop to drive it with original code), Task 1.5 (README), Task 1.6 (gate verification). Build location `~/dev/sasha-x402-kit`; funded key has ~3299 CSPR.

Supersedes/Superseded-by: refines DEC-010's "validated stack" note (Go facilitator + Odra CEP-18) by choosing Go for the agent layer too; the TS option in the spec is deferred to README "future work" / a possible post-Day-7 reskin.

Addendum (2026-06-08) — **Day-7 SPINE GATE: PASS, 5 days early.** All four gate criteria met, each tx-hash-backed and executed on `casper-test` (`error_message: null`):
1. Attestation contract live on public testnet — `AgentAttest` deploy `577570f2f5f486353b8d2e61f7328fca34cd8446053d643ebc395344dba0bfff`, package `7b4bb374af24ee46a067f4d41f5cba61b097ba613825617e81a57d7673132262`.
2. Live `attest` call from the agent's own code — `15dd7a6f116527fcb54f695fc0ce2d2c6a1b278d6d538fbb5fdffefe57ae2546`.
3. One agent-loop-driven live x402 `402→settle` — PAY/settle `b419bbcbcbefaa6da97eb4e5251461c691ba436f8f6921a316ea82c213cc5f2b` + the same cycle's ATTEST `1f063cc2d3567079cfac9075c3120d9b15deddcdec2a71eb75fc6fdec62f6893` (one `go run ./cmd/agent` did PAY→ACT→ATTEST). The x402 pay-scheme is original (implements the upstream `SchemeNetworkClient` via the public `casper-eip-712` lib — not the reference client).
4. Fresh PUBLIC repo, secret-scan green — `~/dev/sasha-x402-kit`, 6 commits, `git ls-files` shows zero pem/env/key files; gate verified blocking + non-false-positive.
Repo NOT yet pushed to GitHub (awaiting Gabriel's publish OK — the irreversible-disclosure gate). SPINE complete (Tasks 1.1–1.6). Per the plan, STRETCH (Phases 2–4) is now unblocked since a live `402→settle` exists; next is the GitHub publish decision, then Phase 2 (external x402 counterparty / EXPOSE) → Phase 5 packaging (demo video + DoraHacks writeup → `marketing/`). Submit target Jun 28. Funded key ~3.26k CSPR remaining.

---

## DEC-012: CROO Agent Hackathon — Sasha Risk Desk (2026-06-26)

**Decision:** Build and enter "Sasha Risk Desk" in the CROO Agent Hackathon (deadline 2026-07-12).

**Rationale:** $10,200 prize, exact fit for DeFi/On-chain Ops + Data & Verification tracks. Sasha's autonomous LP history is a unique moat — selling a live operating history, not generated text. CROO's A2A order graph judging (25%) rewards real composability, not demos.

**Implementation:** `croo/` TypeScript package. Provider sells LP risk packets from `web/lp-miner/data/dashboard.json`. Requester buys from peer agents to build the order graph. Dashboard at `web/croo/`. Agent registered: `f64edd68-41f0-4b2f-8ee3-8a21fdc87edb`. Service: `b0ba8e03-9e93-4865-8914-6fcd8f1b8eaf` at $0.10 USDC, 5min SLA.

**Win condition:** 10+ completed CAP orders, 5+ unique buyer wallets, 3+ unique counterparty agents by July 10.

---

**DEC-013 | 2026-07-05 | Mantle/Solana Trader — hibernation**

**Decision:** Hibernate the Mantle/Solana trader cleanly. Disabled `/etc/cron.d/sasha-trade` (renamed to `sasha-trade.bak.20260705-150454` on the VPS, matching the existing rename-to-disable convention). No wallet top-up.

**Rationale:** Verified live treasury $7.05 total (Solana $5.72, Mantle $1.33), poolUsd $5.05 → max position $1.51, below Byreal's $2 floor. Every cron cycle (12/17/21 UTC) ran the full 5-source signal fusion (social + Byreal + Allora + Elfa + Polymarket) and then pre-flight-aborted — spend without any possibility of a trade. Gabriel chose hibernation over a $25-30 top-up, matching the plan's default recommendation absent confirmed CROO Risk Desk traction that would make the trader's attested track record load-bearing collateral.

**Track record (state/mantle-trade-log.json, 62 logged decisions, 2026-05-23 → 2026-07-05):** 1 real trade round-trip completed — opened Goblin/USDC LP ($5, 2026-05-26 00:52 UTC, tx `3bv6jD…5k6`, attested on-chain `0x28d057…60cef`) and closed it same day (16:17 UTC). 22 execution errors (mostly byreal-cli API/simulation failures during the May build-out), 9 dry-runs, 11 MOVE_TO_STABLE recommendations, 23 pre-flight-abort skips as capital depleted below the $2 floor. ERC-8004 identity #100 verified live on Mantle (owned by `0x21AF27…8A9A9`), last on-chain attestation 2026-05-29. `SashaAgentLog.sol` (`0x71e27D…B9EF8`) never called — attestations went to the ERC-8004 registry instead (audit finding M-7, left as-is per hibernation scope — not touched since it's gated on a resume decision, not urgent while dormant).

**Deferred (P1, only relevant if resumed later):** tweet-stranding-on-execution-failure fix (audit M-8), wiring `CLOSE_LP` through byreal-cli in `auto-trade.js` (currently alert-only), attesting PRE-FLIGHT ABORT cycles, retiring or wiring `SashaAgentLog`. None of these were implemented — no code changes made to `scripts/auto-trade.js` or `scripts/byreal-trade.js` this session, since the fork resolved to hibernate, not resume.

**Not touched:** `/etc/cron.d/sasha-oracle` (X Layer Dynamic Fee Hook keeper, every 2h) — it reads the last-written `content/mantle-signal.json` and re-pushes with `--force` regardless of staleness. Disabling `sasha-trade` stops that file from being regenerated, so the oracle will keep force-pushing an increasingly stale signal. This is Initiative 3's (Dynamic Fee Hook) own problem, tracked separately in `reports/plans-2026-07-05/03-dynamic-fee-hook.md` — out of scope here.

**Closing X thread:** Not drafted in this workspace per the hard workspace-boundary rule (content production is `marketing/`-only). Track record facts above are ready to hand off for `marketing/` to write the actual closing post.

**Impact:** Zero further trade-cycle API spend (Allora/Elfa/OpenRouter/Polymarket calls stop). No new attested decisions until either Gabriel funds the wallets or a future review reopens the fork. Signal file `content/mantle-signal.json` will go stale; `push-signal-to-xlayer.js` (oracle cron) unaffected in cadence, only in freshness of the data it re-pushes.

Supersedes/Superseded-by: none.

---

**DEC-014 | 2026-07-05 | Dynamic Fee Hook (X Layer) — heartbeat fix shipped; sunset recommended**

**Decision:** Shipped the P0 fix from `reports/plans-2026-07-05/03-dynamic-fee-hook.md` (audit M-1). `scripts/push-signal-to-xlayer.js` gained a `--heartbeat` mode (push only if risk changed or on-chain `updatedAt` is >= 5h old) and a signal-age guard (refuse to push `content/mantle-signal.json` if it's older than 6h — a stale signal is never pushed as fresh). Added a debounced low-OKB Telegram alert (< 0.01 OKB, 24h cooldown). `/etc/cron.d/sasha-oracle` switched from `--force` every 2h to `--heartbeat` every 4h. Verified live: dry-run against production env + real chain state confirmed correct skip (risk unchanged, updatedAt 9 min old) and correct push (forced risk-off override). Deployed by direct scp of the single script file, not full `deploy.sh`, since the working tree had unrelated uncommitted changes from concurrent work — `deploy.sh --execute` refuses on a dirty tree by design.

**Discovery (supersedes the "not touched" note in DEC-013):** DEC-013 (same day, this log) hibernated the Mantle/Solana trader by disabling the `sasha-trade` cron file — and that file's `auto-trade.js` job was the *only* producer of `content/mantle-signal.json` (via `mantle-signal.js`, called as auto-trade's step 1). No other cron regenerates that file. Net effect: even independent of this fix, the signal pipeline feeding the oracle is now orphaned. Last signal: `generatedAt: 2026-07-05T17:00:12Z`. With the signal-age guard in place, every heartbeat check after ~2026-07-05T23:00Z will correctly refuse to push, and the oracle's own on-chain staleness fallback takes over (`getFeeOrDefault()` reverts to the neutral default). This isn't a bug — it's the guard working as intended — but it means the "dynamic" part of the Dynamic Fee Hook is now permanently inert unless Gabriel re-enables a signal producer.

**Recommendation to Gabriel (P1, pending confirmation — not executed):** OKX Build X was submitted May 28; judging is effectively over. Sunset gracefully:
- Withdraw the ~$0 seed liquidity from the USDC.e/WOKB pool via `LiquidityHelper.rescueToken()` (small owner-only tx, X Layer gas only).
- Leave the cron at its current 4h `--heartbeat` check (near-zero cost now that pushes are gated — no need for a separate daily-cadence change).
- Mark this initiative "mechanism proven, archived" — 485+ autonomous oracle updates is the real deliverable; a pool with no traffic pricing itself was never going to demonstrate anything more.
- Not recommended: chasing real swap flow on X Layer for this pair (Option B) — no routing reason exists and isn't worth manufacturing.

**P2 (not started, surfaced for later):** the oracle-keeper pattern itself (bounded fee, staleness fallback, heartbeat pusher, low-balance liveness alert) is the cleanest piece of infra in the portfolio — worth packaging as a standalone reusable module (contract pair + keeper script + cron template) and a Sasha content piece ("how my oracle survived 500 updates unattended, then stopped lying when it should"). If ever reused with real TVL, add the key-rotation path from audit M-6 first (immutable `agent`/`owner` everywhere today).

**Verification caveat:** the first real cron-triggered run under the new 4h/`--heartbeat` schedule fires at 2026-07-05T20:00Z. Logic was verified via dry-run against live production state (chain reads + real env), not yet via an observed cron-triggered execution — confirm `/var/log/sasha-oracle.log` on a future check before treating the schedule change itself as proven in production.

Supersedes/Superseded-by: none (extends DEC-013's cross-reference).

---

**DEC-015 | 2026-07-05 | Dynamic Fee Hook — seed liquidity is technically unrecoverable, written off**

**Decision:** Gabriel confirmed the sunset plan (DEC-014) and asked to recover the seed liquidity to Sasha's main wallet. On inspection, withdrawal is not possible with the deployed contracts — no transaction can move it. Written off (~$0.50–$1) and archived as-is. No withdrawal transaction was attempted (it would only burn gas on a guaranteed revert).

**Why it's stuck, precisely:**
- Deployed `LiquidityHelper` (`0xbd44673c97f11dd025dd82Ee29b98c0d779e6019`) has exactly two external functions: `addLiquidity()` (liquidity delta hardcoded positive via `uint128`→`int256` cast — no way to pass negative) and `rescueToken()` (sweeps ERC20 balances held directly *by the helper contract*, currently $0 for both USDC.e and WOKB — the deposited funds aren't sitting there).
- The actual LP position lives inside the shared PoolManager (`0x360e68faccca8ca495c1b759fd9eee466db9fb32`), keyed by `(owner, tickLower, tickUpper, salt)` where `owner` = whichever address directly called `modifyLiquidity()` — in this case the LiquidityHelper contract itself (`0xbd4467…`), since it made that call internally from its `unlockCallback`.
- Only a transaction where `msg.sender == 0xbd4467…` (as seen *by PoolManager*) can decrease that position. `msg.sender` cannot be spoofed by any other contract or EOA — that's a base EVM guarantee, not a missing feature. And `LiquidityHelper`'s deployed bytecode is immutable (no proxy, no upgrade path) and simply doesn't contain a decrease-liquidity code path.
- Checked both adjacent contracts for an escape hatch: `SashaDynamicFeeHook.sol` only overrides swap fees (`_getFee()`), no admin/rescue functions. PoolManager itself is canonical, permissionless Uniswap v4 core infra with no third-party position-seizure function (by design — that would be a protocol-level vulnerability).
- Git history confirms only one `LiquidityHelper` was ever deployed (single commit `3e529a4`) — no v2/v3 with a remove function exists anywhere in this repo to redeploy or fall back to.

**Quantified value stuck:** current pool liquidity (272,272,583,019 raw units) at tick range [223500, 235500], current tick ≈233273 (in-range) → ≈0.247 USDC.e + ≈0.0122 WOKB locked. Verified live via `extsload` reads on PoolManager, 2026-07-05. Matches the audit's "TVL ≈ $0" characterization — this was never a real-money position.

**Action taken:** none on-chain (nothing to send — there is no reachable transaction). Initiative archived per DEC-014's plan (mechanism proven via 485+ autonomous oracle updates; cron left at 4h `--heartbeat`).

**Lesson for any future `LiquidityHelper`-style contract (feeds P2):** ship a decrease-liquidity / owner-only emergency-close function from day one, even for a hackathon seed deposit. A single-purpose immutable contract with an add-only liquidity path has no recovery story once *any* value lands in it — this one only escaped scrutiny because the amount was trivial.

Supersedes/Superseded-by: none (resolves the withdrawal action item opened in DEC-014).

---

**DEC-016 | 2026-07-05 | LP Miner — P0 hedge correctness fixes + kill-switch gate pulled back pending backtest**

**Decision:** Shipped three fixes from `reports/plans-2026-07-05/01-lp-miner.md` P0 (audit M-2, M-3) in `scripts/hedge-executor.js`, and changed the H-3 kill-gate policy in `scripts/position-monitor.js` — all five KILL action types now carry `confirmGated: true` (previously only OOR-distance and hedge-liq-proximity did; stop-loss, HF-emergency, and funding-kill auto-executed from the 30-min cron).

1. **M-2 (orphan-short sweep):** the sweep for a leftover Hyperliquid short with no backing LP used to run only when the entire book was empty. Now it runs every invocation, computing a per-run `backedCoins` set from `POOL_REGISTRY` lookups on all open positions (including `staticHedge` ones, which are legitimate, just unmanaged) and closing any short in a coin outside that set.
2. **Discovery while testing M-2:** `POOL_REGISTRY`'s WETH/USDC entry pointed at `0xd0b53d9277642d899df5c87a3966a349a798f224` (tickSpacing 10), a different pool from the actually-open position's `0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59` (tickSpacing 100, CL100 — verified on-chain). The mismatch was dormant because the live position is `staticHedge: true` and skips the per-position reconcile path — but it meant the corrected M-2 orphan sweep would have seen the live 0.0106 ETH hedge as "no backing LP" and closed it as an orphan on the very first `--execute` run. Caught via a `--check` dry-run before any live execution; fixed the registry address before shipping.
3. **M-3 (fill-status checking):** all four order-placing call sites (orphan sweep close, funding-kill close, `--close` flag, main reconcile) used to write `hedgeSize` unconditionally after `placeOrder()`, even if the Hyperliquid IoC order didn't fill. Added `parseOrderResult()`, which reads `res.response.data.statuses[0]` and only updates state on a confirmed `filled` status (using the actual `totalSz` filled, not the requested size); unfilled/errored orders now leave state untouched and alert via Telegram instead of silently claiming a hedge that isn't there. Also wrapped the two previously-unguarded close paths (funding-kill, `--close`) in try/catch so an order exception can't crash the whole run before other positions get processed.
4. **H-3 (kill-gate policy, revised from initial approach):** first pass was to document the auto-execute split (stop-loss/HF-emergency/funding-kill auto, OOR/liq-proximity gated) as the intended design, matching what the code already did — Gabriel rejected this: the thresholds had never been validated against real price/funding history, so declaring auto-execute "intended" would have been asserting confidence that didn't exist. Correct sequence per Gabriel: gate everything, backtest, then decide what to un-gate. Added `confirmGated: true` to `CLOSE_POSITION` (stop-loss + emergency), `DELEVERAGE` (HF emergency), and `CLOSE_HEDGE` (funding-kill) in `position-monitor.js`. All five KILL triggers now require `--confirm-kill` / `LP_KILL_OK=1` via `lp-rebalancer.js`; none auto-execute from cron.

**Backtest (replay against real history since the position opened 2026-06-04T19:15:59Z, before deciding whether to un-gate):**
- **Funding-kill** (threshold: −54.75% ann for 3 consecutive periods): replayed full Hyperliquid ETH funding history (500 records). Worst 3-period rolling average was **−2.93% ann**; worst single period **−3.81% ann**. Never remotely close to the kill threshold — wide margin.
- **Hedge-liq-proximity** (threshold: within 3% of liq ~$2082–2088): replayed hourly ETH price (CoinGecko) since open. Max price reached was $1843.46, **11.5% away from liq** at closest approach. Wide margin.
- **OOR-distance** (threshold: ≥5% beyond the [$1590.87, $1943.07] band): min ETH price over the window was **$1522.58**, i.e. **4.29% beyond the lower band** — a genuine near-miss, 0.71 points short of firing. Upper band was never threatened (max $1843.46 vs $1943.07 upper bound).
- **Stop-loss / HF-emergency:** could not backtest against real PnL because they are **structurally dead code for this position** — `getBasePositionState()` never computes `state.valueUsd` (only the Solana path does), so the `if (state.valueUsd !== undefined ...)` guard in `evaluatePosition()` never evaluates for a Base-chain position; and `position.morpho` is `null` for this position, so the `if (position.morpho)` guard skips HF-emergency too. Gating these was still correct (defense in depth, and they'd apply to a future Solana or Morpho-leveraged position), but there is no backtest evidence either way — they've simply never run.

**Recommendation (not yet actioned, pending Gabriel):** funding-kill and hedge-liq-proximity have wide margins and no near-misses in 31 days of real data — reasonable candidates to un-gate for speed once Gabriel is comfortable. OOR-distance's near-miss (4.29% vs 5%) argues for keeping it manual, or at least revisiting whether 5% is the right distance-kill threshold before ever auto-executing it. Stop-loss/HF-emergency should probably stay gated indefinitely for this specific position given they don't actually run — un-gating them would be symbolic, not protective, until `getBasePositionState()` is extended to compute `valueUsd` for Base LPs.

**Docs corrected to match:** `CLAUDE.md` (LP rebalance routing row), `docs/pre-audit-handover-fable5-2026-07-04.md` §10 (removed the false "universal Gabriel confirmation gate" claim, added the actual per-trigger gate table), `.claude/skills/sasha-defi-execution/references/safety-gates.md` Gate 4 (was claiming kill switches were "auto-protective," which is no longer true and hadn't been fully true even before today for the two already-gated triggers), and misleading top-of-file comments in `scripts/lp-rebalancer.js` and `scripts/position-monitor.js`.

**Verification:** `node --check` on all three edited scripts; `node scripts/hedge-executor.js --check` and `node scripts/position-monitor.js --dry-run` run against live VPS-mirrored state post-fix, both read-only, both confirmed no regressions (position correctly recognized as `staticHedge`, no false orphan flag after the registry fix, no spurious actions). No `--execute` run performed — live hedge/rebalance execution stays pending Gabriel's explicit go-ahead per session instructions.

Supersedes/Superseded-by: extends DEC-004/DEC-005 (LP Miner Phase 3 hedge) with corrected safety behavior; the H-3 gate section supersedes the "Gabriel confirmation gate... universal" claim in the pre-audit handover doc's original §10.

---

**DEC-017 | 2026-07-05 | LP Miner Phase 4 (Morpho leverage) — carry gate clears comfortably; NO-GO on operational readiness**

**Decision:** Evaluated the Phase 4 leverage go/no-go gate from `docs/strategy/phase4-morpho-prep-2026-05-27.md` §2 ("Phase 4 is only accretive if the net hedged LP carry APR > the Morpho borrow APR") against the now-satisfied 14-21 day fee-history window (31 days live). **Recommend NO-GO for now** — not because the carry economics fail, but because the operational-readiness half of the gate does.

**Carry-vs-borrow-cost math (passes comfortably):**
- Live Morpho Blue WETH/USDC market (`0x8793cf30…ba1bda`, Base, queried directly via `blue-api.morpho.org` GraphQL, not the 6-week-old prep-doc figure): **borrowApy 4.78%** — essentially unchanged from the 4.83% recorded 2026-05-27, a stable rate.
- Realized carry (fees + funding, deliberately excluding LP-MTM-change and hedge-uPnL — those two are the offsetting variance-hedge legs, not carry): $1.17 fees + $0.06 funding = **$1.23 over 30.9 days on $45.55 working capital** → 2.70% period return → **31.9% annualized (simple) / 37.0% (compounded)**.
- Margin over the borrow rate: **6.7x–7.7x**. The plan doc's back-of-envelope "~14% fee APR" was a rough understatement (unclear which basis it used); the bottom-up calc from the dashboard's own reported USD components is more reliable and clears the gate even more decisively.

**Why NO-GO despite that:**
1. **No execution path exists.** `scripts/lp-leverage.js` (supply collateral, borrow, deleverage on HF breach) was never built — the May 27 prep doc flagged this as an open item and it's still open. A "GO" today means building and shipping new fund-moving code from scratch, not flipping a flag.
2. **Absolute dollar impact is tiny at current size.** At 1.5x leverage the LP grows from $40.28 to $60.42, borrowing $20.14 USDC. The extra carry from leverage is the net-carry-differential (31.9% − 4.78% ≈ 27%) applied to that borrowed slice: **≈$5.46/year, ≈$0.46/month.** The May 27 doc's own "reality check at $45" note — that leverage here is "mostly a demonstration" — is unchanged two months later; working capital is still $45.55, same order of magnitude.
3. **Leverage changes the risk profile qualitatively, not just quantitatively.** The position today has zero liquidation risk (unlevered, `morpho: null` in state). Adding a Morpho borrow introduces a new liquidation surface, a new HF-monitoring dependency, and new unaudited execution code — for ~$0.46/month. The prep doc's own pre-execution checklist (confirm the oracle is Chainlink-based, cross-check HF math against the Morpho UI on a live position) was never completed either.
4. **Consistent with the position's existing operating posture.** This position is deliberately run `staticHedge: true` — simple, low-touch, manual-KILL-policy by design (see its own `_comment` in `state/lp-positions.json`). Layering leverage onto it cuts against that posture for a sub-$1/month gain.

**Recommendation:** Hold Phase 4. Revisit only if working capital scales to a size where the leveraged slice's carry differential is materially more than gas/complexity overhead (rough rule of thumb: 5-10x current capital), or if `scripts/lp-leverage.js` gets built for a different, larger position where it can be validated on real stakes first. Not a capital-moving decision — no code changed, nothing executed.

Supersedes/Superseded-by: resolves the open Phase 4 gate item in `reports/plans-2026-07-05/01-lp-miner.md` P2; extends `docs/strategy/phase4-morpho-prep-2026-05-27.md` with fresh live-rate verification.

---

**DEC-018 | 2026-07-17 | Trader hibernation — OOR watchdog + capital tracker extracted**

**Decision:** While the main trade cron (`sasha-trade`) remains hibernated (DEC-013), two infrastructure gaps were discovered and fixed: (1) 5 Byreal Solana LP positions ($9.75 deployed across SOL/USDC, 2x WLFI/USDC, 2x SOL/USD1) were open with zero OOR monitoring; (2) `treasury-monitor.js` was bundled inside `sasha-trade.bak`, so `state/capital-pool.json` was frozen at Jul 5, producing a stale NAV on the Mantle dashboard ($16.80 = Jul-5 wallet + fresh byreal positions). Fixes shipped: (a) new `scripts/byreal-oor-watch.js` — polls byreal-cli every 30 min, fires Telegram alert on OOR + 60-min re-alert on sustained OOR; deployed via new `/etc/cron.d/sasha-byreal-watch`. (b) `treasury-monitor.js` re-activated via new `/etc/cron.d/sasha-treasury` (independent of the trade cron). Neither change re-enables trading.

**Rationale:** Unmanaged positions going OOR silently would erode capital without any notification. `treasury-monitor.js` is infrastructure, not a trade script — it should never have been bundled with `sasha-trade`. Both gaps were caused by the coarse hibernation approach (disable one big cron file vs. surgical disablement by script function).

**State at fix time (2026-07-17):** All 5 Byreal positions in-range. Open PnL +$0.28 (+2.9% on deployed). Fees earned to date: ~$0.55.

**Lesson:** Future hibernations should disable only `auto-trade.js` (the signal/trade loop), leaving `treasury-monitor.js` and monitoring scripts active. Consider splitting `sasha-trade` into `sasha-trade-core` (auto-trade only) and keeping infra scripts in their own cron files.

Supersedes/Superseded-by: extends DEC-013 (hibernation).
