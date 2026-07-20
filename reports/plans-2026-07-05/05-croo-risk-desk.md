# CROO Risk Desk — Deep Review & Improvement Plan
### 2026-07-05 · Fable 5 · Initiative 5 of 5 · ⚠️ DEADLINE JUL 12 (7 days)

## Current state (verified live)

| Component | Status |
|---|---|
| Provider process | **Running** (`node /tmp/croo-ws-provider.cjs`, up since Jul 01), WS connected, listening |
| Services | 5 registered (risk packet, LP range, gas check, THS scan, THS lookup), routing code sound |
| Order log (local) | 410 entries: 345 requester attempts, 37 negs sent, 14 rejected — **0 completed, 0 settlement hashes** |
| Recent WS traffic | `order_negotiation_rejected` events — counterparties rejecting Sasha's buy negotiations |
| Win conditions | 10+ CAP orders / 5+ buyers / 3+ agents — **no local evidence any are met** |
| Code quality | provider.ts/services clean; per-service schema routing correct; dashboard-unavailable → reject (good) |

## 🔴 URGENT — found during this review

1. **CROO SDK key leaked into `/var/log/sasha-croo.log`.** The SDK's websocket logging prints the full connection URL including `croo_sk_…`. Anyone with VPS log access has the key, and it's in plaintext history. **Rotate the key today** (CROO dashboard → regenerate; update VPS .env), and silence the SDK's connection logging (wrap or redirect stderr through a `sed 's/key=[^ ]*/key=REDACTED/'` filter in the launcher, or set the SDK's log level if supported).
2. **The provider is a `/tmp` process.** `/tmp/croo-ws-provider.cjs` is not in git, not in the workspace, and has no restart mechanism — a reboot or tmp-cleaner silently kills the Risk Desk mid-hackathon. Move the bundle into the workspace, add a systemd unit (or `@reboot` cron + a `*/5` liveness check that restarts and Telegrams on death).

## Gaps

3. **Zero completed orders, 7 days out.** The A2A strategy (reciprocal deals, 10+ orders) documented in the winning-strategy doc has not converted: 345 requester attempts with no `completedAt`. Known causes from memory: AA wallet USDC empties → silent reversion; acceptance windows ~5 min; providers async. The recent `negotiation_rejected` events say counterparties are actively declining.
4. **Audit H-1 — reputation-proof.ts publishes the phantom EOA** (`0xba3BB320d3…`, 0 txs). One-line fix to `0xba3BB32Fa5cfA…6662`. An anti-sybil check against the current proof hurts rather than helps.
5. **Audit M-4 — no delivery idempotency.** A replayed OrderPaid after WS reconnect double-delivers. Add a delivered-orders set persisted to `croo/data/`.
6. **Order logging doesn't run where the provider runs.** `appendOrder` writes relative paths; the /tmp process has no workspace — provider-side deliveries may not be logged at all (the local 410-entry log is requester-side only). You can't demo win conditions you didn't record.
7. **THS scan handler passes raw requirements to a Supabase Edge Function** with the service-role key. Input is attacker-controlled (any CROO buyer). Verify the edge function validates `token_address`/`chain_id` strictly (hex address + decimal chain) before it touches the DB.

## Plan — ordered for the 7 days remaining

**Day 0 (today):**
1. Rotate the leaked SDK key + redact the log; scrub or logrotate the existing sasha-croo.log.
2. Fix reputation-proof.ts address (one line).
3. Move the provider into the workspace + systemd/cron restart + liveness alert.

**Day 1 — make orders land:**
4. Fund the AA wallet (`0xeBD0…94de`) with $10–15 USDC on Base *first* — every silent-reversion failure mode traces to it being empty.
5. Add idempotency + provider-side order logging (absolute path into the workspace `croo/data/`). Without the log you cannot prove win conditions.
6. Re-run the reciprocal-deal outreach with the 3–5 partner agents from the strategy doc (VERIS/proofMesh, Contractor, DeFi Yield Scout). Sequential payOrder (nonce), 5s-burst acceptance polling for 3 min per the known-good pattern.

**Day 2–3 — buyer diversity (5+ unique buyer wallets):**
7. The requester script can only prove Sasha buying. For unique *buyers* of Sasha's services, the reciprocal deals are the realistic path: each partner buys the $0.10 gas check / LP range signal. Track buyer wallets in the provider log; check the anti-sybil bar (≥3 counterparties, ≥5 buyers) daily.
8. If partners stall by Day 3 (the strategy doc's own pivot trigger), pivot to the CROO Discord/community: the $0.10 price point and a "first 10 buyers get the $0.50 THS scan free" post is cheap demand generation.

**Day 4–6 — evidence pack:**
9. Build the submission evidence from the provider log: order IDs, settlement tx hashes, delivery_hash verification steps, the A2A order graph diagram. The `delivery_hash` verifiability + free-context composition (gas + fear/greed embedded in packets) is the 25% composability score — make it explicit.
10. Update the CROO dashboard (pages.dev/croo) with live order count + buyer graph — judges click links.

**Post-hackathon (independent of result):**
- Keep the two THS services live (they wrap a real product); sunset the rest or fold into a single "Sasha signals" service. Pricing memory says scale to $0.25–0.50 after 50 orders + reputation.
- The provider + x402 + Casper attest triangle: attest each delivered CROO order on-chain (Mantle registry or Casper) — turns every sale into reputation collateral. This is the cross-initiative compounding play.

**KPI:** key rotated Day 0; ≥10 completed orders with settlement hashes logged by Jul 10; ≥5 buyer wallets; evidence pack done Jul 11.
