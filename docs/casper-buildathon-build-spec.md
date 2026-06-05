# Casper Agentic Buildathon — Build Spec (dev handoff)

**Created:** 2026-06-02
**Workspace:** `sasha-coin/` (code/runtime — this is where the build executes)
**Decision support:** [`research/casper-agentic-buildathon-brief-2026-06-02.md`](../research/casper-agentic-buildathon-brief-2026-06-02.md) (+ `.html`)
**Status:** SPEC / NOT STARTED. Awaiting Gabriel's go on the path before any build begins.
**Prior art in this workspace:** `docs/dorahacks-submission.md`, `docs/okx-buildx-hackathon-submission.md`

---

## Goal

Ship a **minimal-but-real** entry to the Casper Agentic Buildathon (Qualification Round, deadline **June 30, 2026**) that satisfies the hard submission bar and leans on Sasha's structural advantage: she is already a live agent with socials, a treasury, and a dashboard. Win on **narrative + community vote**, not on out-engineering Rust natives.

This spec scopes the **recommended path** from the brief. The full-dApp path is explicitly out of scope unless Gabriel upgrades the decision.

---

## The hard requirements (non-negotiable submission bar)

1. **Working prototype on Casper Testnet with a transaction-producing on-chain component.**
2. **Open-source GitHub repo** with a README (documentation + usage). → must be **PUBLIC** (secret-hygiene scan required before publishing).
3. **Public demo video** (project, features, walkthrough).

---

## Build plan (the dev side)

### Phase 0 — Setup gate
- [ ] Gabriel confirms the minimal-real path (this spec) and that we're entering.
- [ ] Register the project on DoraHacks (solo / "Sasha" team). *(Submission action — Gabriel's nod.)*
- [ ] Casper Testnet onboarding: testnet faucet + wallet. Use the **CSPR.click AI Agent Skill** (`claude skill install cspr-click`) for wallet creation + key management inside a dev harness.

### Phase 1 — Toolkit integration (read path)
- [ ] Install/whitelist `cspr-click` in Sasha's skill set (or a sandboxed dev harness first — do NOT point it at production keys).
- [ ] Wire the **Casper MCP Server** (balance / tx / staking queries) and optionally **CSPR.trade MCP** (quotes/swaps).
- [ ] Prove the read loop: agent holds a Casper Testnet wallet, queries its balance via MCP, reads the SSE event feed.

### Phase 2 — The transaction-producing component (this is the requirement)
Pick the smallest flow that is genuinely agentic, not a scripted demo. Recommended:
- [ ] Generate a minimal **Odra** contract via Odra's `llms.txt` (`curl https://odra.dev/llms.txt` → agent writes `*.rs`). Candidate: a **"Sasha decision/treasury attestation log"** contract — one entry per agent decision cycle.
- [ ] Have Sasha's agent loop **call the contract on Testnet each cycle** (the transaction-producing on-chain component). Sign autonomously via cspr-click.
- [ ] Stretch (optional, strong x402 story): one **x402-paid API call** — agent hits a data endpoint, gets `402 Payment Required`, signs + retries with payment proof, uses the data to drive the attestation it writes on-chain. Ties the $100K-x402-credits theme directly to Sasha's "I pay for the data I act on" identity.

Keep it minimal. One contract, one recurring autonomous tx, optionally one x402 call. Resist scope creep into a real DeFi protocol.

### Phase 3 — Surface + proof
- [ ] Add a **Casper panel** to Sasha's existing dashboard (`sasha-dashboards.pages.dev`) showing live Testnet activity: contract address, recent tx hashes, last decision logged.
- [ ] **Public GitHub repo** with README. Casper code lives under `contracts/` + a new `casper/` module. Run the `github-repo-ops` secret-hygiene scan before going public.
- [ ] The "real project with socials in place" criterion is satisfied by linking Sasha's live X (@SashaCoin95), YouTube, token, and dashboard from the README + submission.

### Phase 4 — Content + submission (HANDOFF BACK TO `marketing/`)
Per the workspace boundary, these are **not** built here:
- [ ] Demo video (script + production) → `marketing/` (Sasha account manager → content-writer/designer).
- [ ] Community-vote campaign on **CSPR.fans** → `marketing/`. **Blocked by the content-engine issue below.**
- [ ] Submission writeup (persuasive copy) → `marketing/`; the technical README + this spec stay here.

---

## Deliverable → judging-criteria map

| Judging criterion | Satisfied by |
|---|---|
| Working smart contracts (deployed) | Phase 2 Odra contract on Testnet |
| Meaningful use of AI / agentic systems | Sasha autonomously signs + calls the contract each decision cycle |
| Real-world applicability (DeFi/RWA) | Treasury/decision attestation tied to her live delta-neutral book; x402 paid-data story |
| Technical execution | cspr-click + MCP + Odra integration, clean repo |
| UX / design | Casper panel on the existing dashboard |
| **Long-term launch plans — real project w/ socials** | **Sasha already is this** (token, treasury, X, YouTube, prior Mantle hackathon) — the unfair-advantage criterion |
| Innovation / originality | An autonomous persona-agent operating on Casper, not a static dApp |
| Long-term ecosystem impact | Sasha as a recurring Casper-native agent |

---

## Dependencies & blockers (size before committing)

1. **Content engine is dead.** h3mk cron wakes but gemini-2.5-flash doesn't complete the post/reply skills. The CSPR.fans community-vote path is worthless if Sasha can't post. **This predates the buildathon and should be fixed/sized regardless** — it's the single highest-leverage runtime fix on the board. (See ops runbook.)
2. **Public repo + secrets.** Sasha's tree holds keys/state; the hackathon requires open source. Need a clean public repo with a secret scan, not a flip of the existing private one.
3. **Non-EVM Rust toolchain.** New for this stack. Mitigated by Odra `llms.txt` + cspr-click, but budget real ramp time. Sandbox the cspr-click skill away from production keys during Phase 0–1.

---

## Scope guardrails
- Minimal-real only. No real DeFi protocol on Casper unless Gabriel upgrades the decision.
- Testnet only. No production capital touches Casper.
- All content/scheduling/vote-campaign work routes to `marketing/`. This workspace ships the code, the contract, the repo, and the dashboard panel.
- No build action starts until Phase 0 gate is cleared by Gabriel.
