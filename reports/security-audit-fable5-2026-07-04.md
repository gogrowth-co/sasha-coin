# Sasha Coin — Security Audit Report
## Fable 5 · 2026-07-04 · against `docs/pre-audit-handover-fable5-2026-07-04.md`

**Scope covered:** All 4 Solidity contracts (source), Casper AgentAttest (source), the flagged execution scripts (hedge-executor, lp-rebalancer, position-monitor, push-signal-to-xlayer, byreal-trade, auto-trade, dust-consolidator, treasury-monitor), CROO `provider.ts`, VPS cron environment, and live on-chain verification of contract owners/agents and wallet inventory on Base, X Layer, and Mantle. Read-only throughout; no state was changed.

**Verdict:** No path to fund theft was found in the contracts, and the confirm-gates for position kills work as designed. But the handover document itself contains two materially wrong claims (the Base agent EOA address and the "Gnosis Safe" security model), one of the wrong addresses is shipped in CROO production code, and two automated paths execute fund-moving closes with no human gate despite the doc's claim of a universal confirmation gate.

---

## HIGH severity

### H-1. The documented Base agent EOA is a phantom lookalike; the wrong address ships in CROO code
Doc §3 lists the LP-miner/Clawlett EOA as `0xba3BB320d35773ae0C44843BC5D7e5B3B0B08601`. Verified on-chain: that address has **0 transactions** on Base and its mixed-case form **fails EIP-55 checksum** (ethers rejects it). The real Clawlett EOA is `0xba3BB32Fa5cfA2edCFc1401c76292FB102f86662` (15 txs, verified) — same 7-hex-char prefix, different tail. The actual LP-miner signing wallet is `0x21AF273dA03e695ead9d72B221Bd394f04D8A9A9` (22 txs on Base, key stored as `MANTLE_AGENT_PK`; `AGENT_PRIVATE_KEY` does not exist in the local or VPS `.env` — confirmed by name-only grep).

The phantom address is hardcoded in **`croo/src/reputation-proof.ts:7`** — Sasha's CROO reputation proof publishes a wallet with zero history. A judge or counterparty who verifies it finds an empty wallet, which undermines exactly the anti-sybil credibility the proof exists to establish.

**Fix:** correct doc §3 and §9 (three distinct EOAs: Clawlett `0xba3BB32F…6662`, LP-miner/Mantle `0x21AF…A9A9`, plus HL `0xFAef67…`), replace the address in `reputation-proof.ts`, and delete the `AGENT_PRIVATE_KEY` row (that env var doesn't exist; scripts fall back to `MANTLE_AGENT_PK`).

### H-2. The "Gnosis Safe" at `0x7833…13b9` is not a Safe; the §5 security model is unverifiable
On-chain, `0x783363427f4dd64e97b5ec0cb5c94b2b8cac13b9` is an **EIP-1167 minimal proxy** delegating to implementation `0x819cd026f180d019ab186cc9451840f633d55d4a`. It does not expose the Safe ABI — `getOwners()`, `getThreshold()`, `owner()` all revert. Safe proxies are not ERC-1167 clones, so this is structurally not a Gnosis Safe; it is most likely an AgentKeyFactoryV3 clone. Every §5 security claim ("Safe holds all funds", "Zodiac Roles restricts operations", "agent cannot call execTransaction") is asserted against a contract that cannot be checked with the Safe interface, and I could not verify any of them. Risk area #6 therefore **fails verification as stated**. Current balance is small (~0.0054 ETH), which limits present exposure.

**Fix:** document what the wallet actually is (implementation address, verified source for `0x819c…d54a`, its authorization model) or point §5 at the real Safe address if one exists elsewhere. Until then, treat "Safe + Zodiac protection" claims in public materials as unsubstantiated.

### H-3. Stop-loss, emergency deleverage, and funding-kill closes auto-execute from cron with no human gate
Doc §10 claims a universal "Gabriel confirmation gate … for any fund-moving operation." In practice the gate in `lp-rebalancer.js:262` only holds actions flagged **both** `killSwitch && confirmGated`. `position-monitor.js` emits three fund-moving actions with `killSwitch: true` but **no** `confirmGated`:
- `CLOSE_POSITION` on stop-loss (lines 257, 259)
- `DELEVERAGE` on HF emergency (line 314)
- `CLOSE_HEDGE` on funding kill (line 332)

The VPS cron (`/etc/cron.d/sasha-lp-miner`) runs `lp-rebalancer.js --execute` every 30 minutes, so these close positions autonomously. That may be the right call for a stop-loss (speed matters), but it directly contradicts the documented safety model — decide which is intended and make doc and code agree. Related: `/etc/cron.d/sasha-hedge` hardcodes `HEDGE_LIVE_OK=1` inline, so that "gate" is permanently open on the automated path and only gates ad-hoc manual runs. The doc should describe both env gates as protecting against *accidental manual* execution, not as autonomy limits.

**Verified good on the same surface:** `LP_KILL_OK` is absent from the VPS `.env` and from every cron entry (risk area #8 passes), and OOR/hedge-liq KILLs are correctly `confirmGated` and held with a Telegram alert.

---

## MEDIUM severity

### M-1. `push-signal-to-xlayer.js` never enforces signal freshness, defeating the oracle's staleness fallback
The script computes `signalAge` (line 141) and only logs it. A dead signal pipeline leaves a stale `mantle-signal.json` that the 6-hourly cron keeps re-pushing, refreshing `updatedAt` on-chain, so `SashaOracle.isStale()` never trips and swaps price off data that could be weeks old. Compare `lp-rebalancer.js`, which correctly rejects signals older than 30 minutes. **Fix:** exit 0 without pushing when the signal is older than ~6h.

### M-2. `hedge-executor.js` orphan-short sweep only runs when the LP book is completely empty
Lines 272–287: leftover shorts are detected and closed only in the `!open.length` branch. With a mixed book — e.g. one open WETH LP plus a leftover BTC short from a closed cbBTC LP — the stale BTC short is never swept: the open-positions loop only reconciles each position's own perp. Naked directional exposure persists indefinitely. This sharpens risk area #7: static-hedge skipping is fine (correctly placed before any order path), but the orphan logic needs to run per-coin against the set of coins no open LP maps to, not only when the whole book is empty.

### M-3. `hedge-executor.js` marks state as hedged without checking order fill status
Line 359–361: after `placeOrder()`, `pos.hedgeSize = target` is written unconditionally. Hyperliquid returns per-order statuses inside an HTTP-200 response; an unfilled IoC or rejected order still records the target as achieved, so dashboard and monitor report delta-neutral when the book isn't. Mitigation: the next 30-min run re-reads the observed short (line 309) and self-corrects — the wrong state lives at most one cycle. **Fix:** parse `res.response.data.statuses` and only update state on a fill.

### M-4. CROO provider has no delivery idempotency (risk area #10 confirmed open)
`provider.ts` handles `OrderPaid` with no local record of already-delivered order IDs. A WebSocket reconnect that replays the event (EventStream reconnects internally, per the code comment) triggers a second `deliverOrder()`; the code relies entirely on the server rejecting duplicates. **Fix:** keep an in-memory (or `croo/data/`) set of delivered order IDs and skip repeats; also check order status before delivering.

### M-5. `LiquidityHelper` ignores ERC-20 return values (no SafeERC20)
`transferFrom` (lines 82–84) and `transfer` (124, 130, 141–142) are called without checking the returned bool. For USDC.e/WOKB this is safe today, and settlement failures fail closed (the PoolManager reverts on unpaid deltas), but tokens that return `false` instead of reverting, return nothing, or take fees on transfer will misbehave. Since this contract is presented as reusable infrastructure, use SafeERC20 or check returns before any redeploy. Also note it cannot handle native-currency pools (calls IERC20 on `address(0)`). `rescueToken()` owner drain is confirmed by design; owner verified on-chain as the X Layer agent EOA (risk area #3 passes).

### M-6. No key-rotation path on any contract; compromised X Layer key requires full redeploy
`SashaOracle.agent`, `LiquidityHelper.owner`, and `SashaDynamicFeeHook.oracle` are all `immutable`, and the hook address is baked into the PoolKey forever. Key compromise means: attacker controls fees (bounded 50–10000 — griefing at max 1%, not theft) until the pool itself is abandoned and re-created with a new hook. Accepted risk for a hackathon; flag it in any production write-up. (Risk areas #1/#2 otherwise verify: bounds enforced on-chain, staleness fallback correct, and the oracle is live — fee 3000, updated 2026-07-04T18:00Z, not stale.)

### M-7. `SashaAgentLog` has never been used; doc §2.4 describes a pipeline that doesn't exist
On-chain: `tradeCount() == 0` and `agentId() == 0` (doc claims agent ID #100). `erc8004-write.js` writes attestations to the ERC-8004 Identity Registry (`0x8004A169…`), not to this contract, and nothing in `scripts/` calls `logTrade()`. Owner does verify as `0x21AF…` (risk area #4's EOA check passes). Not a vulnerability — a dead contract plus a doc claim ("immutable on-chain record of every trade") that an auditor or judge will falsify in one RPC call.

### M-8. Pre-announce tweet still stranded on trade failure (known, still open)
`byreal-trade.js` correctly aborts before tweeting on the pre-flight funds check (line 556+) and aborts the trade if the tweet fails. But when the trade fails *after* the tweet posts (line 614), the tweet stays up — the failure path only sends a Telegram alert containing the tweet ID. The accountability loop publishes a promise with no position behind it.

---

## LOW severity

- **L-1. Casper `AgentAttest` (risk area #11): clean.** No admin, no proxy, no mutable-code path in the Odra module; append-only with checked counter increment. One note: `attest()` is permissionless — anyone can append noise records to the package (each is stamped with `author`, so forgery is attributable and impact is cosmetic). Package-level upgradeability (Odra deploy mode) wasn't verifiable from here; confirm the package version is locked.
- **L-2.** `lp-rebalancer.js:296` deletes the signal file when *any* action succeeded, so failed sibling actions silently wait for the next monitor cycle instead of retrying.
- **L-3.** Cron entries load secrets via `export $(grep -v '^#' .env | xargs)` — breaks on values containing spaces and puts all secrets in the process environment of every child. Works, but fragile.
- **L-4.** `hedge-executor.js` testnet `--open` path crashes with a null `exchange` if `HL_PRIVATE_KEY` is unset (no guard before use).
- **L-5.** Doc §13.13 (dust-consolidator token approvals) is a non-issue as written: it's a Solana/byreal-cli flow; ERC-20-style lingering approvals don't apply. It does skip <$0.01 tokens and gates on `--execute` correctly.

## Verified-good (claims that held up)

| Check | Result |
|---|---|
| `SashaOracle.agent()` on X Layer | `0xe451…1d1f` — matches doc and local `XLAYER_AGENT_PK` (address derived locally, key never displayed) |
| `LiquidityHelper.owner()` | `0xe451…1d1f` ✅ |
| `Hook.oracle()` | `0xfE53…5c74` ✅ — wiring correct |
| Oracle liveness | fee 3000, updated 2026-07-04T18:00:17Z, not stale |
| `SashaAgentLog.owner()` on Mantle | `0x21AF…A9A9` ✅ (but see M-7) |
| `HL_PRIVATE_KEY` → `0xFAef67…Ed04` | matches doc ✅ |
| `LP_KILL_OK` in VPS env/cron | absent ✅ (risk area #8 passes) |
| OOR-distance / hedge-liq KILLs | `confirmGated` + Telegram alert, held from cron ✅ |
| `treasury-monitor.js` carry-forward (risk area #12) | present — stale data marked with `staleSince`/`lastGoodAt`, never zeroed ✅ |
| `auto-trade.js` 23h rate limit + signal-age gate | present ✅ |
| `byreal-trade.js` pre-flight capital check before tweeting | present ✅ |
| Secrets in contracts/scripts | all keys read from env; none hardcoded in reviewed files ✅ |

## Recommended fix order
1. **H-1** — one-line code fix in `reputation-proof.ts` + doc correction (CROO judging is live; deadline Jul 12).
2. **H-3 / M-1** — decide the intended autonomy boundary, add the signal-age guard to the oracle pusher (both are small diffs).
3. **M-2 / M-3** — hedge executor correctness (real money exposure).
4. **M-4** — provider idempotency before scaling CROO order volume.
5. **H-2, M-7** — documentation truthing before any external audit or judge sees the doc.

*All on-chain reads performed 2026-07-04 via public RPCs (Base, X Layer, Mantle). No transactions sent, no state modified, no secret values displayed.*
