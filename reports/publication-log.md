# Publication Log — Sasha Coin


## 2026-05-19 · X thread (Sasha Coin)
- **Topic:** Where autonomy actually breaks onchain — wallet layer, not the model
- **Arc:** Opens Arc 3 "Testing Autonomy"
- **Channel:** X (@SashaCoin95)
- **Pipeline:** typefully-publish skill → Typefully MCP → live publish
- **Live URL:** https://x.com/SashaCoin95/status/2056571487205900620
- **Typefully draft id:** 9156929
- **Source file:** social/x/sasha-thread-2026-05-19-autonomy-breaks-at-wallet.md
- **Cap usage:** 1/15 this month (14 remaining)

## 2026-07-05 · Board reconciliation — retroactive log of already-live content (2026-05-20 to 2026-05-28)

Found during the 2026-07-05 deep-dive board cleanup: five pieces of content
were already live on X but the board (`social/tasks.json`) still showed them
as "scheduled" or "in-progress." Verified against the live Typefully API, not
assumed. Logging retroactively for a complete record.

- **CE-S-001** (Virtuals Protocol Dissection, 2026-05-20): https://x.com/SashaCoin95/status/2057068940724199678 — Typefully draft 9163796
- **CE-S-002** (Builder Log Week 1, 2026-05-22): https://x.com/SashaCoin95/status/2057793716782592228 — Typefully draft 9163798
- **CE-S-003** (7 Questions — Agent Autonomy, 2026-05-24): https://x.com/SashaCoin95/status/2058518491100320161 — Typefully draft 9163800
- **SASHA-CE-006** ($420k exploit + receipts, 2026-05-21): https://x.com/SashaCoin95/status/2057476594181210571 — Typefully draft 9191939
- **SASHA-CE-007** (Autonomous vs Automated, 2026-05-22): https://x.com/SashaCoin95/status/2057794450060112044 — Typefully draft 9191942

## 2026-07-05 · Casper Buildathon promo — Launch Announcement thread (Sasha Coin)
- **Topic:** sasha-x402-kit build recap — PAY/ATTEST loop, live testnet tx hashes, DoraHacks submission
- **Campaign:** casper-buildathon-promotion (CE-S-004)
- **Channel:** X (@SashaCoin95)
- **Pipeline:** Typefully MCP → scheduled (fires 2026-07-06T19:00 BRT, opening day of voting finals window)
- **Scheduled, not yet live:** https://typefully.com/?d=9779939&a=255726 (will resolve to a public URL once it fires)
- **Typefully draft id:** 9779939
- **Fact-check:** tx hashes verified against docs/decision-log.md DEC-011; DoraHacks/repo/demo URLs verified against campaigns/casper-buildathon/dorahacks-writeup.md
- **Cap usage:** 2/15 this month (13 remaining)

## 2026-07-05 · Casper Buildathon promo — Builder Log, Sasha's POV (Sasha Coin)
- **Topic:** Real DEC-010 debugging incident (ASSET_NAME / InvalidSignature mismatch)
- **Campaign:** casper-buildathon-promotion (CE-S-006)
- **Channel:** X (@SashaCoin95)
- **Pipeline:** buffer-publish skill → Buffer API → scheduled (fires 2026-07-06T09:00 BRT)
- **Scheduled, not yet live — Buffer post id:** 6a4ab1f1c109183ee85a63c0
- **Fact-check:** sourced from docs/decision-log.md DEC-010, not invented

## 2026-07-05 · BLOCKED — CE-S-005 (Vote CTA) and CE-S-007 (Final Vote Push)

Not published, not scheduled. `_ops/pre-mortem-casper-buildathon-2026-06-06.md`
(risk A3) found the CSPR.fans "top-3 vote skips judging" mechanism was never
confirmed real — the @CSPRfans account is dead (2 followers) and no source
document links a CSPR.fans vote to buildathon finals. Publishing a vote CTA
to an unconfirmed mechanism would violate the fact-check hard rule. Needs
Gabriel to confirm the mechanism (or explicitly drop it) before these can be
written. Board cards marked `status: blocked` with this reason.

## 2026-07-05 · Cadence restart — Typefully threads loaded (Mon/Wed/Fri, thru Jul 10)
- **SASHA-CE-002** (AI agent wallets thread) — scheduled 2026-07-08T19:00 BRT, Typefully draft 9780017
- **SASHA-CE-003** (DeFAI sector thread) — scheduled 2026-07-10T19:00 BRT, Typefully draft 9780022
- Verified live via `typefully_get_queue` (2026-07-05 to 2026-07-13 range): all 3 threads (Casper + these two) confirmed present in the queue.
- **Cap usage:** 4/15 this month (11 remaining)

## 2026-07-05 · Cadence restart — Buffer originals loaded (Mon 9am thru Thu 9am BRT)

Buffer Free plan caps at 10 scheduled posts/channel. Loaded 10/10: Mon 2026-07-06
09:00 (Casper builder log, logged above) through Thu 2026-07-09 09:00 BRT.
Verified live via `read-queue.js` — all 10 confirmed `status: scheduled` with
correct `dueAt` timestamps. Remaining week (Thu-PM 2026-07-09 through Mon-AM
2026-07-13) could NOT be preloaded — cap reached. Tracked as board card
SASHA-CE-009 (Thu-load reminder, matches the existing twice-weekly Buffer
ritual: Mon-load covers thru Thu-AM, Thu-load covers thru next Mon-AM).

Topics loaded (all fact-checked against docs/decision-log.md DEC-012/013/016/017,
no invented numbers): LP rebalancer safety-audit findings, CROO Agent
Hackathon entry, Morpho leverage NO-GO decision, Mantle/Solana trader
hibernation, Dune dashboard pointer, agent-wallet custody design.
