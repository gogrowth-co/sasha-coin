# Pre-mortem · Sasha X.com Reply Automation

**Plan reviewed:** Full reply automation pipeline — `~/bin/run-sasha-replies.sh` → `scripts/morning-reply-run.js` → `scripts/kol-scraper.js` → `scripts/adb-reply.js` + supporting state files  
**Scope:** Next 6 months of daily autonomous operation  
**Reviewer:** Claude (Sonnet 4.6) — pre-mortem skill  
**Date:** 2026-05-27  
**Context:** Third double-reply incident in 30 days triggered this review. All three traced to the same root cause chain: `adb-reply.js` returning `unconfirmed` + exit 1 → `persistReply` skipped → tweet ID not written to dedup file → next slot posted again. Three separate fixes across three sessions, each believed to be complete.

---

## Hidden assumptions (ordered by fragility)

| # | Assumption | Reality check |
|---|---|---|
| A1 | `~/bin/run-sasha-replies.sh` is the deployed entrypoint and it stays in sync with any fixes | It is NOT in git. If the Mac is replaced, reformatted, or if a new launchd plist is written from the repo's `scripts/run-sasha-replies.sh`, all three rounds of fixes evaporate. The repo version still has the old TOCTOU lockfile. |
| A2 | The X app's accessibility tree (`com.twitter.android:id/tweet_text`, `com.twitter.android:id/tweet_button`) is stable | X ships silent UI updates. These resource IDs have already changed once in this project's history. Zero detection if they change again — adb-reply.js silently returns `unconfirmed` for every run, possibly for days. |
| A3 | The Gemini API endpoint for `gemini-2.5-flash:generateContent` is stable and always available | The endpoint URL is hardcoded in `morning-reply-run.js`. Gemini model deprecations are silent — the model becomes a 404, the run logs an error, no reply is posted, no alert fires. Same issue if Google rotates the endpoint. |
| A4 | The Apify actor `CJdippxWmn9uRfooo` stays active and has the same output schema | This actor changed at least once in this project. If Gabriel's Apify account is paused for billing, or the actor is deprecated, `kol-scraper.js` throws on missing fields silently swallowed by a catch block. |
| A5 | Node `~/.nvm/versions/node/v23.11.0/bin/node` is stable and present | Hardcoded absolute path in `run-sasha-replies.sh`. Running `nvm alias default` to upgrade Node silently breaks the shebang path. The entire pipeline fails at the shell level with no output. |
| A6 | The phone is on the same LAN as the Mac, and the wireless ADB connection persists indefinitely | ADB wireless connections drop on network changes, phone reboots, or 24h idle timeouts. No reconnect logic. If the phone is offline, `adb-reply.js` times out, returns `unconfirmed`, pre-write wrote the tweet ID — the reply is permanently deduped even though it was never sent. |
| A7 | `state/replied-tweets.json` and `state/posted-log.json` represent the ground truth | Both are gitignored local files. A botched `rm -rf state/` wipes the dedup history. All previously-replied tweets become fair game again — dozens of duplicate replies possible on the next run. No backup. |
| A8 | The `getDailyReplyCount()` function correctly counts today's replies | Fixed in this session, but the underlying issue (using object destructuring on a flat array returning Array.prototype.entries) existed for the entire history of the project. The daily cap was never enforced. Unknown how many excess replies were sent. |
| A9 | `adb-reply.js` can reliably confirm a reply was posted via screenshot comparison | The confirmation logic reads a screenshot 3s after posting. If the tweet was deleted by the author in that window, or if the screenshot is taken before the app finishes rendering, the status becomes `unconfirmed`. Pre-write now treats `unconfirmed` as posted — which is correct for dedup, but means silent failures where no reply actually landed. |
| A10 | The political/brand-safety blocklist covers the topics that matter | The blocklist is English-only. 4 of the 16 KOL handles are multi-lingual (some tweet in Portuguese, Spanish, or French). A French-language tweet about immigration politics passes all filters. The Brad Sherman incident (before the 12-term blocklist extension) proves the blocklist always has gaps. |
| A11 | One reply per run per slot is safe under X's current rate limits | X's automation detection looks at behavioural patterns, not just API calls. A blue-check account posting 7 replies/day from the same device fingerprint could still trigger soft shadowbans if the content pattern is too uniform. No monitoring for impression suppression. |
| A12 | The `kol-feed.json` generated at first-slot time is valid for all 6 remaining slots | The feed has a `tweet_age_max_hours: 4` filter applied at scrape time. A tweet that was fresh at slot 1 (e.g., 7am) may be 10 hours old by slot 7 (5pm). The filter is not re-applied at selection time. Slots 5-7 may reply to stale tweets. |
| A13 | The random 0-20 minute delay prevents X from detecting regular posting patterns | The delay is PRNG-based (`RANDOM % 1200`). On launchd reboot-catchup, multiple slots fire near-simultaneously; the DELAY variable is computed from the same seed in near-identical environment — potential clustering. |
| A14 | Gabriel will notice if the pipeline breaks | The only observable signal is: no entries in `state/posted-log.json` and `~/Library/Logs/sasha-replies.log` showing errors. No push notification. No Telegram alert. A Mac sleep without `caffeinate` could silently abort every slot for a week. |
| A15 | The kill switch (`~/.sasha-pause`) is accessible when needed | If Gabriel is travelling without physical Mac access, the only way to pause Sasha is to open a Terminal on the Mac. No remote kill path. |

---

## Most-likely failure cascades

| Rank | Failure | Probability | Impact | Why it'll happen | First-warning signal |
|---|---|---|---|---|---|
| 1 | X app UI update breaks ADB resource IDs → every slot returns `unconfirmed` → pre-write marks all as replied → Sasha goes silent for N days without anyone noticing | High | High | X ships UI updates silently; happened before. No detection layer. No alerting. | Gap in `state/posted-log.json` + log shows `status: unconfirmed` every slot |
| 2 | Mac replaced / reformatted → repo `scripts/run-sasha-replies.sh` (old TOCTOU version) deployed → concurrent slots run again → duplicate replies resume | Medium | High | `~/bin/run-sasha-replies.sh` is NOT in git. Whoever deploys from the repo gets the buggy version. | Duplicate entries in `state/posted-log.json` |
| 3 | Gemini 2.5 Flash deprecation → `morning-reply-run.js` returns 404 on every reply generation → 0 replies posted per day | Medium | Medium | Google deprecated Gemini 1.5 Pro without announcement in this project's history; 2.5 Flash will be deprecated eventually. | Log: `Gemini API error 404` or `model not found` |
| 4 | Phone offline / ADB disconnect → pre-write marks tweet as replied → tweet permanently skipped even though reply was never sent → cumulative silent reply losses | Medium | Medium | ADB wireless drops routinely on network changes. Happens without any alert. | `state/replied-tweets.json` growing faster than `state/posted-log.json` |
| 5 | `state/replied-tweets.json` deleted (accidental `rm -rf state/`) → dedup history wiped → every KOL handle becomes a fresh reply target → mass duplicate replies on next run | Low | High | Gabriel runs cleanup commands; state/ is not backed up anywhere. | 8 replies in `state/posted-log.json` within a single slot window, all flagged as new |
| 6 | Apify actor deprecated / account billing lapse → `kol-scraper.js` throws → feed not updated → slots 2-7 use yesterday's stale feed indefinitely | Medium | Medium | Apify actor changed once before. Billing is per-project and can lapse silently. | `kol-feed.json` `generatedAt` date stays fixed at the last successful scrape day |
| 7 | nvm Node upgrade → `~/.nvm/versions/node/v23.11.0/bin/node` path missing → shell `set -e` halts entire script at the skip-scrape check → 0 replies posted, no meaningful log entry | Low | Medium | Developers upgrade Node regularly; absolute path in shell script doesn't track aliases. | `run-sasha-replies.sh` exits before `=== starting run ===` log line |
| 8 | Political tweet from a non-English KOL bypasses blocklist → Sasha posts a politically-flavored reply → brand damage / X report | Low | High | Blocklist is English-only. @DefiIgnas (multi-lingual) and @rleshner (English, but proven to tweet on edge topics) are in the list. Brad Sherman incident was close. | Reply in `state/posted-log.json` with topic matching a blocked category |
| 9 | Daily cap never properly enforced across runs (race: two slots each believe cap is at 7) → 9-10 replies posted in a day → X detects spam pattern | Low | Medium | `getDailyReplyCount()` reads `posted-log.json` at slot start. If two slots start within milliseconds of each other on reboots, both read count=7 and both post. | `state/posted-log.json` showing >8 entries with the same `posted_at` date |
| 10 | Reply text truncated mid-word at 238 chars → grammatically broken reply published under Sasha's name → character inconsistency | Low | Low | Gemini sometimes generates replies close to the X character limit. The truncation guard uses `slice(0, 238)` with no word-boundary check. | Reply in posted-log where `reply_text` ends with a partial word |

---

## Detection / Mitigation / Recovery table

| Failure | Detection (how we'll know first) | Mitigation (what makes it less likely) | Recovery (steps after it happens) |
|---|---|---|---|
| **#1 — ADB resource ID drift** | After every slot: count entries where `posted_at` is today. If 3 consecutive slots show `status: unconfirmed`, fire a Telegram alert. | Add post-ADB screenshot visual diff: if the tweet thread is visible in screenshot, status = `confirmed`. Fail loudly, not silently. | Update resource ID constants in `adb-reply.js`. Restart with new IDs. Manually replay skipped tweet IDs (remove from `replied-tweets.json`). |
| **#2 — Mac replaced / old script deployed** | Deploy checklist (not automated yet): verify `run-sasha-replies.sh` SHA matches known-good. | **Move `~/bin/run-sasha-replies.sh` into git as `scripts/run-sasha-replies.sh`**, update plist to point to `$ROOT/scripts/`. This closes the gap completely. | Redeploy from known-good `~/bin/` backup or from the correct git path after merge. |
| **#3 — Gemini deprecation** | Log line `Gemini API error` or no `=== starting run ===` after lock acquired | Pin to model + version in env var: `GEMINI_MODEL=gemini-2.5-flash-latest`. Run monthly check against Google's model deprecation calendar. | Update model constant in `morning-reply-run.js`. Test with `--dry-run`. Deploy. |
| **#4 — Phone offline / ADB drop** | `adb devices` returns empty → `adb-reply.js` exits early → log shows `ADB: no device`. Telegram alert if no `status:ok` for >2 consecutive slots. | Add `adb connect $PHONE_IP:5555` retry at top of `morning-reply-run.js` before any posting attempt. 3 retries × 5s. | Reconnect ADB: `adb connect $PHONE_IP:5555`. Remove the silently-skipped tweet IDs from `replied-tweets.json` to allow retry. |
| **#5 — state/ deleted** | posted-log.json missing on startup → next run creates a blank log → 8 replies to the same handles on day 1. No prevention currently. | Daily cron backup: `cp state/replied-tweets.json ~/.sasha-state-backup/replied-tweets-$(date +%Y%m%d).json`. Keep 30 days rolling. | Restore from backup. Remove duplicate entries from `posted-log.json`. Count duplicates and skip affected handles for 24h. |
| **#6 — Apify actor deprecated** | `kol-feed.json` `generatedAt` older than 25h → alarm. Or `kol-scraper.js` throws `Error: actor not found`. | Subscribe to Apify actor update notifications. Track actor ID in a comment alongside actor version fallback list. | Switch to backup actor (test `gmangabeira2/twitter-scraper-v2` as candidate). Update actor constant. |
| **#7 — Node path broken** | Script exits before `=== starting run ===` in log. No `caffeinate` PID spawned. | Replace hardcoded path with `$(which node)` evaluated at runtime, with fallback to nvm default: `NODE=$(~/.nvm/nvm-exec which node 2>/dev/null \|\| which node)`. | Update NODE var in `~/bin/run-sasha-replies.sh`. Test manually. |
| **#8 — Non-English political tweet** | No automated detection. Post-hoc: Gabriel sees reply in X notifications. | Add language detection step in `morning-reply-run.js`: if tweet body is non-English, run blocklist check against a translated version via Gemini (one call, cheap). Mark as `language_checked: true` in feed. | Delete reply via X UI. Add tweet ID to a `banned-tweet-ids.json`. Review KOL's recent language patterns — consider dropping from list if >20% non-English. |
| **#9 — Daily cap race** | `posted-log.json` shows 9-10 entries on a single day. | Cap is enforced inside the atomic mutex lock (only one process runs at a time). Verified by new `acquire_lock()`. This is already mitigated by the current lockfile fix — but add explicit daily cap assertion inside `morning-reply-run.js` as belt-and-suspenders. | Nothing to do post-fact; X won't penalise for 9 vs. 8 replies in a day once. Watch for this pattern repeating. |
| **#10 — Truncated reply text** | Visual inspection of `state/posted-log.json` `reply_text` field. | Word-boundary truncation: `text.slice(0, 238).replace(/\s\S*$/, '')` if last char is mid-word. | Nothing to do post-fact for a single occurrence. Apply the code fix. |

---

## Big architectural questions (must answer BEFORE proceeding)

1. **Where does `run-sasha-replies.sh` live?** It must be in git or it will be lost. Decision: move to `scripts/run-sasha-replies.sh`, point the launchd plist to `$ROOT/scripts/run-sasha-replies.sh`, remove `~/bin/run-sasha-replies.sh`. This is the single highest-priority fix.

2. **What is the Telegram notification path?** The pipeline already sends Telegram messages from OpenClaw for other events. Does `morning-reply-run.js` have access to the Telegram bot token and chat ID? If so, adding a 3-line failure alert is trivial. If not, what's the simplest path — environment variable + `curl`?

3. **Is there an ops runbook?** Task `onb-15` (`docs/sasha-ops-runbook.md`) is still TODO. Without it, every incident requires reconstructing context from scratch. The three double-reply incidents each wasted 45+ minutes of investigation time that could be 5 minutes with a runbook.

4. **Backup or redundancy for state files?** `state/replied-tweets.json` is the crown jewel — losing it causes mass duplicate replies. It must be backed up daily. Decision: add a daily `cp` to a `~/.sasha-state-backup/` directory (not in the project repo, but on the local machine and ideally also pushed to a private gist or the VPS).

---

## What the plan should have but doesn't

| Add | Where | Why |
|---|---|---|
| Telegram alert: "3+ consecutive `unconfirmed` slots" | `morning-reply-run.js` end-of-run check | Closes failure #1 — silent ADB drift goes undetected for days |
| Telegram alert: "0 candidates after scoring" | `morning-reply-run.js` after candidate scoring | Flags when blocklist is over-aggressive or when KOL accounts go quiet |
| Telegram alert: slot completed with metrics | `morning-reply-run.js` on success | Gives passive visibility without log-digging: "✅ Replied @rleshner (42 likes) — 3/8 today" |
| Move `run-sasha-replies.sh` into git | `scripts/run-sasha-replies.sh` → update launchd plist | Closes failure #2 — the deployed-vs-repo divergence gap |
| ADB reconnect retry at startup | `morning-reply-run.js` first 10 lines | Closes failure #4 — ADB wireless drops without retry currently silent |
| Daily state backup cron | New launchd plist or piggyback on existing slot 1 | Closes failure #5 — `state/` is currently unprotected |
| Word-boundary truncation for reply text | `morning-reply-run.js` just before `spawnSync` | Closes failure #10 — mid-word truncation is a character voice issue |
| `GEMINI_MODEL` env var instead of hardcoded URL | `morning-reply-run.js` + `.env` | Closes failure #3 — model changes become a config change, not a code change |
| Post-reply confirmation: screenshot diff check | `adb-reply.js` | Improves `unconfirmed` accuracy — reduces false `unconfirmed` that eat dedup slots |
| Language detection for non-English tweets | `morning-reply-run.js` scoring step | Closes failure #8 — political content in PT/FR/ES bypasses English-only blocklist |
| Write `docs/sasha-ops-runbook.md` | `docs/sasha-ops-runbook.md` | Task `onb-15` — without it, every incident takes 45 min to reconstruct. 3 incidents × 45 min = 2.25 hours already wasted. |

---

## Plan v2 outline

### Phase 0 — Git sync (do now, 30 min)
0.1 Copy `~/bin/run-sasha-replies.sh` into `scripts/run-sasha-replies.sh` in the repo.  
0.2 Update the launchd plist `StartProgramArguments` to point to `$ROOT/scripts/run-sasha-replies.sh`.  
0.3 Reload plist: `launchctl unload ~/Library/LaunchAgents/com.sasha.replies.plist && launchctl load ...`  
0.4 Delete `~/bin/run-sasha-replies.sh` (or make it a symlink to the repo path).  
0.5 Commit and push.  
**Exit criteria:** `scripts/run-sasha-replies.sh` in git, no divergence possible on redeploy.

### Phase 1 — Alerting (do this week, 2 hrs)
1.1 Add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` to `.env` (use the OpenClaw Sasha bot or a dedicated one).  
1.2 Add `notify(msg)` helper to `morning-reply-run.js`: `curl` POST to Telegram.  
1.3 Fire alert on: (a) `status: unconfirmed` for 3+ consecutive entries today, (b) 0 candidates after scoring, (c) Gemini API error, (d) success summary "✅ Replied @handle (N likes) — M/8 today".  
1.4 Test via `--dry-run` slot.  
**Exit criteria:** Telegram message received on each alert condition in dry-run test.

### Phase 2 — Hardening (do this week, 2 hrs)
2.1 `GEMINI_MODEL` env var — replace hardcoded endpoint in `morning-reply-run.js`.  
2.2 ADB reconnect retry at startup (3× with 5s delay).  
2.3 Word-boundary truncation for reply text.  
2.4 Daily state backup: piggyback on slot-1 run, copy `state/replied-tweets.json` to `~/.sasha-state-backup/replied-$(date +%Y%m%d).json`, keep last 30 days.  
2.5 Replace `NODE=` hardcoded path in `run-sasha-replies.sh` with dynamic nvm-aware resolution.  
**Exit criteria:** All 5 hardening items committed and deployed.

### Phase 3 — Ops runbook (do this week, 1 hr)
3.1 Write `docs/sasha-ops-runbook.md`. Sections: daily health check (what to look at), incident playbook (duplicate reply, silent failure, ADB down, Gemini down, Apify down), recovery procedures for each, configuration reference (env vars, plist paths, state file paths), kill switch options.  
3.2 Close task `onb-15`.  
**Exit criteria:** Runbook covers all 5 known failure modes from this pre-mortem.

### Phase 4 — Language filter (optional, 3 hrs)
4.1 In `morning-reply-run.js` scoring step, if `tweet.lang !== 'en'`, send tweet body to Gemini for a translate-and-blocklist-check pass (single call, ~0.001 credits).  
4.2 If blocklist match after translation, log `SKIP: blocked_language_topic` and exclude from candidates.  
4.3 Update `reply-targets.json` with a `lang` field for KOLs known to tweet in non-English.  
**Exit criteria:** Test with a manually-crafted Portuguese political tweet — it should be skipped.

---

## Recommended sequence

1. **Stop the current pipeline** — touch `~/.sasha-pause` until Phase 0 and Phase 2 are deployed. The current `~/bin/run-sasha-replies.sh` works, but it diverges from the repo; running it during a refactor risks confusion.
2. **Land Phase 0 first** — Git sync is the highest-leverage 30-minute task. All subsequent fixes should be committed against the repo version, not `~/bin/`.
3. **Land Phase 1 (alerting) before re-enabling** — Without alerting, the next ADB resource-ID drift or Gemini deprecation will go undetected for days again.
4. **Land Phase 2 hardening in the same batch as Phase 1** — These are defensive code changes (env var, retry, truncation, backup). Package them in one PR.
5. **Write runbook (Phase 3) before the next incident, not after** — Three incidents have already cost ~3 hours of triage. The runbook pays for itself after the fourth incident.
6. **Phase 4 (language filter) is optional** — Sasha's KOL list is currently 90%+ English. Add when a non-English incident actually occurs, not preemptively.

---

*Pre-mortem complete. The core finding: the pipeline has been fixed three times at the symptom level (duplicate replies) without addressing the structural root causes (no alerting, no git-tracked entrypoint, no ops runbook). Phase 0 + Phase 1 together reduce the probability of a fourth double-reply incident from "inevitable" to "very unlikely." Phases 2-3 reduce silent failures and ops overhead. Phase 4 is a future-state enhancement.*
