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

## DEC-009: CROO Agent Hackathon — Sasha Risk Desk (2026-06-26)

**Decision:** Build and enter "Sasha Risk Desk" in the CROO Agent Hackathon (deadline 2026-07-12).

**Rationale:** $10,200 prize, exact fit for DeFi/On-chain Ops + Data & Verification tracks. Sasha's autonomous LP history is a unique moat — selling a live operating history, not generated text. CROO's A2A order graph judging (25%) rewards real composability, not demos.

**Implementation:** `croo/` TypeScript package. Provider sells LP risk packets from `web/lp-miner/data/dashboard.json`. Requester buys from peer agents to build the order graph. Dashboard at `web/croo/`.

**Win condition:** 10+ completed CAP orders, 5+ unique buyer wallets, 3+ unique counterparty agents by July 10.
