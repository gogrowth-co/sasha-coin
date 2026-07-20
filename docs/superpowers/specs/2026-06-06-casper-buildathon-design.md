# Design Spec — Sasha's x402 Agent Commerce Kit (Casper Agentic Buildathon)

**Date:** 2026-06-06
**Workspace:** `sasha-coin/` (code/runtime — the build executes here; content/vote campaign → `marketing/`)
**Author:** Claude (Opus 4.8) via brainstorming → council → research → pre-mortem
**Status:** DESIGN — awaiting Gabriel's review before writing-plans.
**Decision inputs:** council (5 advisors), research sweep (`campaigns/casper-buildathon/research/01–05`), pre-mortem (`_ops/pre-mortem-casper-buildathon-2026-06-06.md`), hackathon spec (`campaigns/casper-buildathon/hackathon-spec.md`).
**Deadline:** Submit **Jun 28, 2026** (2-day buffer before the Jun 30 hard deadline). Today: 2026-06-06 (~22 working days).

---

## 1. Goal & definition of success

Win the Casper Agentic Buildathon ($150K). Gabriel's mandate: **go for the win**, build **foundation-grade, chain-agnostic** so the artifact outlives the hackathon and reuses on any chain.

**Three advancement vectors (we build for all three, weighted):**
1. **Path B — jury merit (THE SPINE).** Working Odra contract on Casper Testnet + a real transaction-producing on-chain component + clean public repo + demo video. We build to win here regardless of anything else.
2. **Association discretion (HIGH-VALUE, reachable).** Rules let the Casper Association advance "high-impact teams whose ideas contribute to long-term growth." Sasha — the only AI-agent *persona* in the field, a live project embodying Casper's "trust layer for the agent economy" thesis — is exactly the entry an association champions. Goal: earn the @Casper_Network feature, not farm votes.
3. **Path A — CSPR.fans community vote (LOW-PROBABILITY UPSIDE).** Top-3 by vote skip judging, BUT voting requires the CSPR.fans Telegram app + a connected Casper Wallet + fan points — high friction for Sasha's Base/Solana audience. Treated as a bonus, never depended on.

**Definition of "win-ready submission" (the floor we will not miss):** a deployed Casper Testnet contract with a real agent-signed transaction, an open-source repo, and a demo video — by Jun 28.

---

## 2. The product

**Sasha's x402 Agent Commerce Kit** (persona-facing: *Sasha's Alpha Desk*) — an autonomous agent that makes its **real DeFi book verifiable and payable** across chains. Not a generic "agent that resells data over x402" (the field has 5+ of those — AgentPay, the cspr-agentpay-guard pack, Phoenix Zero). The differentiator is **real positions + verifiable on-chain agent identity**, which the firewall/oracle pack structurally lacks, and which only Sasha (a live agent with a track record) can credibly claim.

The agent loop, four verbs:
- **PAY** — consumes its signal data over x402 (HTTP 402 → sign → settle). *"I pay for the data I act on."* Ref: `make-software/casper-x402` client.
- **ACT** — manages a real **testnet** yield/LP position via the hosted `cspr-trade-mcp` (24 tools). *The moat: real DeFi nobody else in the field is doing.* (STRETCH — see §4.)
- **ATTEST** — writes every decision/position to a Casper **agent-identity + attestation** contract (ERC-8004 pattern → Odra; rewritten fresh per the originality rule; starting point `odradev/casper-x402-poc`).
- **EXPOSE** — serves its verified yield as an x402-payable feed. The RWA referent is a **real position**, not a synthetic label. A genuine external agent pays this endpoint (see §6).

---

## 3. Architecture (full chain-agnostic — Gabriel's decision, 2026-06-06)

Gabriel chose full chain-agnostic over the pre-mortem's "cut it" recommendation. De-risked by making the **second adapter EVM/Base** (cheapest possible: x402 is EVM-native, Sasha's stack is strongest there) — so "chain-agnostic" is provable in code, not just claimed, while Casper stays the flagship and lands first.

```
        ┌──────────────────────────────────────────────────────┐
        │   x402 Agent Commerce Kit  (chain-agnostic core)       │
        │   - x402 pay-client      - x402 paywalled MCP server   │
        │   - synthesis engine (the product being sold)          │
        │   - SettlementAdapter (interface): quote/sign/settle/  │
        │     attest/readReceipt — chain-neutral types only      │
        └───────────────┬───────────────────────┬───────────────┘
                        │                       │
            ┌───────────▼────────────┐  ┌───────▼─────────────────┐
            │ CasperAdapter (FLAGSHIP)│  │ EvmAdapter (PROOF)       │
            │ Odra attestation contract│  │ fresh EVM x402 + EAS-   │
            │ + casper-x402 + EIP-712  │  │ style attestation (Base │
            │ + cspr-trade-mcp         │  │ Sepolia testnet)         │
            │ → casper:casper-test     │  │ → proves the seam real   │
            └─────────────────────────┘  └─────────────────────────┘
              LANDS FIRST (the submission)   ADDED AFTER Casper proven
```

**Rule:** the core never imports a chain SDK; all chain specifics live behind `SettlementAdapter`. Casper adapter is built and proven end-to-end BEFORE the EVM adapter starts. If a gate slips, we ship Casper-only and the EVM adapter becomes README "future work" — the submission is still valid.

---

## 4. Scope: SPINE / STRETCH / DROPPABLE (locked Day 0)

Per pre-mortem mitigation — written down, not discovered later.

| Tier | Item | Rationale |
|---|---|---|
| **SPINE** (must ship) | Odra attestation contract on Testnet; one real agent-signed tx; x402 PAY leg (one real 402→settle); public repo; demo video | This alone clears Path B + the submission floor |
| **STRETCH 1** | x402 EXPOSE leg + real external counterparty paying it | Turns the demo into genuine M2M interop (kills self-dealing) |
| **STRETCH 2** | Live CSPR.trade position via cspr-trade-mcp (ACT) | The real-DeFi moat; gated on MCP testnet maturity |
| **STRETCH 3** | EVM/Base proof adapter | Makes chain-agnostic provable in code (Gabriel's priority) |
| **DROPPABLE** | Dashboard panel polish; multi-position; reputation/escrow beyond a counter | Nice-to-have, cut first if gates slip |

Build order: SPINE → STRETCH 1 → STRETCH 2 → STRETCH 3. Each gated (see §5).

---

## 5. Timeline & gates (the pre-mortem's core fix)

The 48h spike alone gives false confidence (validates ~10% of surface). Add hard binary gates.

| When | Milestone | Go/No-Go criterion |
|---|---|---|
| **Day 0–2 (Jun 6–8)** | **Spike — HARDEST leg first.** Install rustup+Odra; throwaway Testnet wallet + faucet; deploy one Odra contract; **AND prove headless EIP-712 signing → x402 settle on `casper:casper-test`** | If headless signing or settle fails → fall back to June-2 "minimal-real" entry, re-scope immediately |
| **Day 7 (Jun 13)** | SPINE feature-complete (attestation contract + 1 x402 PAY leg + agent loop writing on-chain) | If SPINE not working on Testnet → cut all stretch, harden SPINE only |
| **Day 14 (Jun 20)** | STRETCH 1 + (2 or 3) done; counterparty live; repo public + secret-scanned | If counterparty absent → ship disclosed second-agent demo (no faking) |
| **Day ~20 (Jun 26)** | Demo video recorded; submission writeup (marketing/) drafted; dry-run submission | — |
| **Day 22 (Jun 28)** | **SUBMIT** (2-day buffer) | — |

---

## 6. Counterparty plan (no accidental self-dealing)

The prior council's hard requirement. Recruit in **week 1**, three tiers, in order:
1. **Public endpoint** — Sasha's x402 EXPOSE endpoint is publicly callable; document it so any agent can pay.
2. **Recruit** — DM 1–2 other BUIDL teams (e.g. AgentPay #43705) for a reciprocal agent-to-agent call; Discord (~34K) + the buildathon channels are the venue.
3. **Disclosed fallback** — a second, independently-keyed agent we run, **explicitly disclosed in the demo + README** as a test counterparty. Honest, not theater. Never present a self-call as external demand.

---

## 7. Repo & secrets (irreversible-action discipline)

- **Fresh PUBLIC repo built from an allowlist** — copy in only the Casper module + core + EVM adapter. **Never flip the existing private tree** (it holds `state/` — 20 JSON files with live addresses + full posting history — and runtime config).
- **Pre-commit secret scan** defined BEFORE any code is written (reuse `marketing/.claude/skills/github-repo-ops` scanner pattern). Recovery if a key ever leaks: rotate immediately (per global secret rule).
- Testnet-only throughout. No production capital. No mainnet keys in the dev harness.

---

## 8. Tooling decisions & footguns (from research 02/03)

- **Headless signing** (autonomous agent): `casper-js-sdk` (TransactionV1) or `casper-ecosystem/casper-rust-wasm-sdk`, or `cspr-trade-mcp --signer`. **NOT CSPR.click** (browser/human-in-loop).
- Use `casper-ecosystem/casper-rust-wasm-sdk` — `casper-network/casper-rust-sdk` is **dead**.
- Target **`/next/`** (Casper 2.0 / Condor) docs. Odra **v2.7.x**, `llms.txt` confirmed live (the "Odra for Solidity devs" tutorial is 404 — don't rely on it).
- **Testnet faucet = once per account** → pre-create 2–3 spare faucet'd accounts. **NCTL local-net** (`make-software/casper-nctl-docker`) as a testnet-outage fallback.
- x402 = CEP-18 tokens + EIP-712 typed-data sigs, `transfer_with_authorization`, net `casper:casper-test`, facilitator base `https://x402-facilitator.cspr.cloud`. Reference: `make-software/casper-x402` (Go facilitator + paid demo server + headless client) + `odradev/casper-x402-poc` (Rust contract).
- Low star counts across tooling (1–63★) → budget debugging time for rough edges.

---

## 9. Testing approach

- **OdraVM** (`cargo odra test`) for fast in-memory contract unit tests; then `cargo odra test -b casper` against CasperVM before livenet deploy.
- x402 loop tested against the `casper-x402` demo resource server first, then Sasha's own endpoint.
- Adapter parity test: the same core-level commerce flow runs through CasperAdapter and EvmAdapter (proves the seam).
- End-to-end on Testnet: agent loop runs ≥1 full PAY→ATTEST cycle and emits a `testnet.cspr.live/transaction/<hash>` link = the deliverable artifact.

---

## 10. Risk register

Full analysis: [`_ops/pre-mortem-casper-buildathon-2026-06-06.md`](../../../_ops/pre-mortem-casper-buildathon-2026-06-06.md). Top cascades + their mitigations in this spec:

| Failure | Mitigation in this spec |
|---|---|
| Spike passes, full build doesn't fit | SPINE/STRETCH tiers (§4) + Day-7/14 gates (§5) — SPINE is always shippable |
| Counterparty never shows → self-dealing | §6 three-tier plan, disclosed fallback |
| Chain-agnostic scope creep eats runway | EVM-as-cheap-second-adapter; Casper lands first; adapter #2 is STRETCH 3 (cut-first) |
| 24 days spent, don't place | Differentiate on real-DeFi + persona (not generic x402); aim Association-discretion vector |
| Path A mirage + dead engine | Path B is the spine; Path A treated as bonus (§1); content engine fix is a separate marketing/ workstream, not a dependency |
| Secret/state leak on public flip | Fresh repo from allowlist + pre-commit scan (§7) |
| **ACCEPTED RISK:** full chain-agnostic | Gabriel's explicit call; mitigated by EVM-second-adapter + cut-first ordering, not eliminated |

---

## 11. Workspace boundary

- **Here (sasha-coin):** all code — Odra contract, core kit, adapters, agent loop, spike, repo, dashboard panel.
- **marketing/:** demo video, submission persuasive copy, the @Casper_Network feature push, any CSPR.fans/vote activity, Discord presence. The content engine being dead is a marketing/runtime issue tracked separately; this submission does NOT depend on it.

---

## 12. Open decisions (resolve before/within writing-plans)

1. **Counterparty primary choice** — public endpoint + recruit, or commit to the disclosed second-agent now? (Default: build public endpoint; attempt recruit week 2; second-agent guaranteed fallback.)
2. **Attestation contract surface** — minimal (append-only decision log) vs. + reputation counter vs. + escrow. (Default: append-only log for SPINE; reputation counter only if Day-7 gate is green.)
3. **Does the live CSPR.trade position use real testnet value or a simulated position the contract attests?** (Default: real testnet swap/LP via cspr-trade-mcp if STRETCH 2 reached; else attest a read-only position snapshot.)
