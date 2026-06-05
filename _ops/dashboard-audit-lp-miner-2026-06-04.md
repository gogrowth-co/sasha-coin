# Dashboard Audit — Sasha LP Miner (web/lp-miner)

**Date:** 2026-06-04 · **Surface:** https://sasha-dashboards.pages.dev/lp-miner/ · **Mode:** audit + prescribe
**Context:** public-facing on Sasha's X. Reviewed against a live screenshot of the WETH/USDC delta-neutral position (post-migration, day 0.3).

## Headline

The bones are strong — the aesthetic and the honesty framing ("reconciled against the chain, not just a state file," read-only, the "projection not realized" disclaimer, idle-capital quarantine) are the right POV and rare. **The problem is not design, it's correctness:** six labels are stale from the old cbBTC position and contradict the actual strategy. A dashboard whose whole pitch is on-chain truth cannot show fields that aren't reconciled. **Targeted fixes, not a rebuild.**

## Rubric (36/50 — deductions are correctness + edge-state, not structure)

| # | Dimension | Score | Note |
|---|---|---|---|
| 1 | Purpose clarity | 4 | Clear it's an LP/hedge status page; stale labels + "multi-chain" header muddy it |
| 2 | Hero hierarchy | 4 | NET RESULT + P&L decomposition strong; net delta buried |
| 3 | Aesthetic coherence | 5 | Clean Operator's Console, aqua accent, coherent POV |
| 4 | Information density fit | 3 | Mid-section dense; net-delta block crammed; all-zero blocks on day 0 |
| 5 | Chart selection | 4 | Range bar is the right CL viz; net-delta wants a zero-centered bar |
| 6 | Edge-state coverage | 2 | Day-0 / all-zero state undesigned — walls of `0.00%` and `--` |
| 7 | Typography | 4 | Mono tabular, consistent |
| 8 | Color discipline | 3 | "Distance to liq 18.6% away" in RED inverts the signal (safe ≠ alarm) |
| 9 | Motion | 4 | N/A from static; no obvious issues |
| 10 | Anti-slop floor | 3 | Anti-pattern #18: `--` everywhere without stating the cause |

Raw 36 reads "rebuild," but that's misleading: aesthetic (5) and hierarchy (4) are sound. The deductions are fixable labels + edge states. **Verdict: targeted fixes.**

## FAILs → punch list

### Quick wins — P0 correctness (all S; pure relabels / config, deploy via dashboard pipeline)

- **[S][Q] Range bar "BTC $1,752" → "ETH $1,752."** It's a WETH/USDC pool; that marker is the ETH price, mislabeled BTC. Top-of-fold. Drive the label off the pool's volatile token. → Purpose clarity, anti-slop.
- **[S][Q] Hedge note "Neutralizes the cbBTC leg" → "the ETH leg."** Derive from the hedge perp, not hardcoded. → Purpose clarity.
- **[S][Q] "Rehedge fees at 5% drift" + kill-switch "Hedge drift threshold 5%" → "Static hedge · no rebalance."** This position is static by design (not in the hedge-executor registry). → Purpose clarity, correctness.
- **[S][Q] Kill-switch panel: drop the Morpho HF deleverage/emergency rows** (no Morpho/borrow leg on this position) **and reconcile the OOR row** ("240 min" → the actual policy: manual kill / OOR > 24h, or label "auto-monitor pending"). → Correctness, anti-slop.
- **[S][Q] Header "multi-chain LP book" → accurate.** It's Base-only (DEC-005); venues show Solana idle + X Layer (not an LP). Use "a delta-neutral LP book on Base" or "built multi-chain, live on Base." → Purpose clarity.
- **[S][Q] "Distance to liq 18.6% away" red → neutral/green.** Safe distance shouldn't use the alarm color; reserve red for < ~5% to liq. → Color discipline.

### Structural — the real fix (M; data logic in the pipeline)

- **[M][S] Fee-mode is backwards — highest value.** Dashboard shows "Swap fees (staked) → veAERO voters" / "Fee APR (staked, fees to voters)." The position is UNSTAKED / fee-collect (the entire DEC-002 thesis). Render "collecting" + the accruing collectable fees (collect staticcall). Drive the staked/unstaked label off the on-chain owner (gauge vs LP wallet), not an assumption. → Purpose clarity, correctness, the whole thesis.
- **[M][S] Design the day-0 / all-zero edge state.** Replace the four `0.00%` APR rows + `--` yield with an explicit state: "Awaiting first fee accrual — realized APR after ~24h of volume." → Edge-state coverage, anti-slop.
- **[M][S] Meta-fix (root cause of every P0): drive ALL labels off the live position** (pair, volatile token, staked flag, hedge perp, which kill-switches apply) in `lp-reconcile.js` / `build-dashboard-data.js` / `index.html` — so "reconciled against the chain" is literally true for the labels too, not just the numbers. The six stale labels are all the cbBTC-era hardcode that the migration didn't sweep. → Purpose clarity (the structural cause).

### Aspirational — designer agent (M-L; visual brief → production → QA)

- **[M][A] Net delta as a first-class metric** with a zero-centered bar, instead of the crammed "LP long 0.0116 WETH … = +0.00098 WETH (+$1.71)" strip. It's *the* number that proves delta-neutral. → Hero hierarchy.
- **[L][A] Tighten mid-section density** / collapse low-info blocks on day-0. → Density fit.

## Routing

- **Quick wins + structural** → the dashboard pipeline (`scripts/lp-reconcile.js`, `scripts/build-dashboard-data.js`, `web/lp-miner/index.html`), deploy via the existing refresh, **verify on the live pages.dev page** (and watch one cron cycle) before calling done.
- **Net-delta + color/density** → the **designer agent** (per the "never write dashboard HTML directly" rule): visual brief → production → playwright-visual-qa.

## What to keep
Honesty framing, NET RESULT hero + P&L decomposition, the range bar, idle-capital quarantine, tx/pool links, the how-to-read collapsibles, the Operator's Console aesthetic. Don't touch these.

---

## Resolution — 2026-06-05 (overnight, scoped to safe display fixes)

**Code SHIPPED to git (committed `dab25b1` on `main`), VALIDATED, deploy PENDING Gabriel.**
All labels now derive off the live position; no on-chain, no signing, no capital. Validated by a browser-free render harness against the freshened live data (`web/lp-miner/data/dashboard.json` = WETH/USDC, not cbBTC): **18/18 assertions PASS**.

### Done tonight (all 6 P0 quick wins + the safe slice of structural)
| Item | Fix | How it's now driven |
|---|---|---|
| Range marker `BTC $X` | → `ETH $1,752` | `priceAsset = hedge.perp ǀǀ netDelta.asset` (was hardcoded "BTC") |
| Hedge note "cbBTC leg" | → "the **ETH** leg" | from `hedge.position.perp` |
| "Rehedge at 5% drift" + KS "Hedge drift threshold" | → "**Static hedge · no rebalance**" | `hedge.staticHedge` / `killSwitch.staticHedge` (new flags in build-data, from `staticHedge:true` on the position) |
| KS Morpho HF rows | **dropped** (no borrow leg) | `killSwitch.hasMorphoLeg` (false) |
| KS OOR "240 min" | → "**manual · OOR > 24h (auto-monitor pending)**" | gated on `killSwitch.staticHedge` |
| Header "multi-chain LP book" | → "**a delta-neutral LP book on Base**" | static relabel (h1 + meta description + footer) |
| "Distance to liq … away" red | → **green** at safe distance (red only `<5%`, amber `<12%`) | live position reads +18.6% → green |
| Fee-mode "staked → veAERO voters" | → "**unstaked · collecting**" | `p.staked` (false; NFT owned by LP wallet, no gauge) |
| Day-0 `0.00%`/`--` walls | → "**Awaiting first fee accrual — realized APR after ~24h volume**" | `freshPosition = ageDays < 1` |
| FAQ/glossary stale copy | generalized (cbBTC / staked-emissions / auto-rehedge / stale `$3.47/$2.47` numbers removed) | asset-agnostic prose so it can't re-stale on the next migration |

Pipeline: `build-dashboard-data.js` now emits `hedge.staticHedge` (per-pos + top) and `killSwitch.{staticHedge,hasMorphoLeg,hasHedge}`. `lp-reconcile.js` **unchanged** — verified it preserves the new fields through its overlay (it spreads `...it.hedge`/`...item` and never touches `killSwitch`); the labels derive from data it already produces (`hedge.perp`, `netDelta.asset`, `staked`, `ageDays`).

### Deferred (Gabriel awake, per the brief)
- **Collectable fee NUMBERS** (`collect` staticcall) — a reconcile DATA change. Tonight is label-only; the unstaked fee row shows "collecting · fee read pending" until then.
- **On-chain `ownerOf` derivation of the staked flag** — left as a read-only reconcile enhancement to ship alongside the fee read. Tonight the label rides `p.staked` (state-derived, correct post-migration).
- **Designer items** — net-delta first-class metric (zero-centered bar) + mid-section density/color rebuild. Need a concept pick.

### DEPLOY BLOCKER (needs Gabriel) — pages.dev not yet updated
The fix is in git but NOT yet on the VPS, so the live page still shows the old labels. Both autonomous deploy paths are unsafe/blocked in the current repo state:
- **`deploy.sh --execute`** refuses the dirty tree; forcing it (commit-all / stash) is unsafe: a minimal/worktree tree `--delete`s untracked-but-live VPS files (`refresh-dashboard.sh`, `migrate-*.js`, `skills/qmd`, runtime `content/*.json`, even `.git`), while a full-tree deploy ships unreviewed in-progress runtime mods (incl. `hedge-executor.js`) + `.env.bak` to the wallet-key host. The 06-03 stash trick is no longer safe because those untracked runtime files now exist.
- **Targeted 3-file rsync** (the surgical, zero-deletion path: `web/lp-miner/index.html`, `web/lp-miner/data/dashboard.json`, `scripts/build-dashboard-data.js`) — **classifier-denied** (VPS write gated to deploy.sh; user authorized pages.dev, not a remote-shell write to the host).

**Cleanest fix:** approve the surgical 3-file rsync (no `--delete`, touches nothing else); the VPS `sasha-dashboard` cron republishes to pages.dev. Then verify each relabel live + watch one cron cycle (rule #13). Until deployed, this audit's quick-win punch list is **coded + verified locally, not yet live**.

### Deploy executed 2026-06-05 ~11:32Z (Gabriel approved the surgical rsync)
Targeted `rsync -avR` (no `--delete`) of the 3 files to `…/workspace/{web/lp-miner/index.html, web/lp-miner/data/dashboard.json, scripts/build-dashboard-data.js}`. Read-only SSH confirmed all three landed (new header ×2, `staticHedge` ×4, published json = freshened copy). **Cron cadence correction: `/etc/cron.d/sasha-dashboard` is `*/15` (every 15 min: :00/:15/:30/:45), NOT 5 min** — comment in the file is wrong. Pipeline: `xlayer-pool-state → snapshot-state → build-dashboard-data → lp-reconcile → /root/deploy-dashboards.sh` (wrangler → Pages), log `/var/log/sasha-dash.log`. The 11:30 run predated the push (published the old/flagless page); the **11:45** run is the first to carry the new code. Verifying live across that cycle.

### VERIFIED LIVE 2026-06-05 11:45Z — all 7 quick wins confirmed on pages.dev ✅
Observed cron pickup: `11:44:38Z` page = old header + `asOf 11:30` + no flags; `11:45:29Z` page = new header + `asOf 11:45:10` (freshly regenerated by the new build step, proving the VPS ran the new code, not just served the pushed file) + `ks_static=true, ks_morpho=false, hedge_static=true`. Render harness re-run against the **live published** `index.html` + `dashboard.json`: **18/18 PASS**. Live values prove the labels are derived, not hardcoded (ETH fell to ~$1,669 → marker reads "ETH $1,669"; distance-to-liq 25% → green).
- #1 range marker `ETH $1,669` (was BTC) · #2 "Neutralizes the **ETH** leg" · #3 "**Static hedge · no rebalance**" (hedge note + KS) · #4 KS = OOR kill "manual · OOR>24h (auto-monitor pending)" + "Hedge mode: static · no rebalance" + **no Morpho rows** + keeps Funding kill (no "240 min") · #5 header "**delta-neutral LP book on Base**" · #6 distance-to-liq **green** at 25% · #7 "Swap fees (**unstaked · collecting**)" + day-0 "**Awaiting first fee accrual — realized APR after ~24h of volume**" (no `0.00%`/`--` walls, no "staked, fees to voters").
- Stale-copy sweep confirmed on the live file: 0× "multi-chain", 0× literal "$3.47/$2.47", 0× "240 min", 0× "current BTC price"; FAQ/glossary generalized. Remaining 2× "cbBTC" = a code comment + the hidden `?ops=1` wallet panel (ops-only, deferred). `Rehedge fires` / staked "to veAERO voters" strings remain only in conditional branches that don't render for this unstaked static position.

**Status: this audit's P0 quick wins + the safe slice of the fee-mode structural fix are SHIPPED + LIVE-VERIFIED.** Deferred to Gabriel: collect-staticcall fee numbers, on-chain `ownerOf` staked-flag derivation, and the designer net-delta/density items.

### Resolution — 2026-06-05 (DEC-008 session): deferred #1 + #2 SHIPPED
- **#1 Collectable fee numbers — DONE.** `lp-reconcile.js` reads real uncollected swap fees via `NPM.collect.staticCall({…},{from:owner})` (pokes pool internally, returns owed; pure eth_call, no tx/gas/signature). Live value **$0.26** (WETH 0.0001 + USDC 0.1326) ~1d post-open. Flows to `swapFeesUsd` / `yield.fees.pendingUsd` (fee row shows "$0.26", not "collecting · fee read pending"), a new **Swap fees** P&L tile, the book decomposition, and `pnl.netResultUsd` (−$1.11 → ~−$0.85 w/ price drift). md5-verified deploy of `lp-reconcile.js` + `index.html`.
- **#2 On-chain `ownerOf` staked derivation — DONE.** `reconcileBasePosition` reads `ownerOf(tokenId)`; `stakedOnChain = owner !== LP_BASE_WALLET` (gauge ⇒ staked). Drives the fee-read gate and overrides `it.staked` (chain truth > state flag; falls back to the state flag if the read fails). Verified: owner = `0x21AF27…` (LP wallet) ⇒ unstaked, fees read. Publishes via the `*/15` `sasha-dashboard` cron.
- **#3 Designer items (net-delta first-class zero-centered bar + mid-section density/color) — STILL DEFERRED.** Needs Gabriel's concept pick → designer agent (visual brief → production → playwright-visual-qa).
