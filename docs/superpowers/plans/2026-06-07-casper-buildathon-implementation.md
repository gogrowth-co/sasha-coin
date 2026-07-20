# Casper Agentic Buildathon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an autonomous agent that makes its real DeFi book verifiable and payable on Casper over x402 — a chain-agnostic core with a Casper flagship adapter — and submit it to the Casper Agentic Buildathon by **Jun 28, 2026**.

**Architecture:** A chain-agnostic `x402 Agent Commerce Kit` core (x402 pay-client + paywalled MCP server + synthesis engine + a `SettlementAdapter` interface that imports no chain SDK), with a `CasperAdapter` (flagship, Odra attestation contract + casper-x402 + EIP-712) that lands first and an `EvmAdapter` (proof, Base Sepolia) added after. Agent loop: PAY (buy signals over x402) → ACT (manage a position) → ATTEST (write on-chain) → EXPOSE (sell verified yield over x402).

**Tech Stack:** Rust 1.96 + Odra v2.7.x (CasperVM/WASM contracts) · casper-client · casper-js-sdk / casper-rust-wasm-sdk (headless TransactionV1 signing) · `make-software/casper-x402` (Go facilitator + EIP-712, CEP-18, `transfer_with_authorization`) · `cspr-trade-mcp` (hosted, 24 DEX/LP tools) · CSPR.cloud RPC + x402 facilitator (`https://x402-facilitator.cspr.cloud`).

**Source spec:** `docs/superpowers/specs/2026-06-06-casper-buildathon-design.md` · **Pre-mortem:** `_ops/pre-mortem-casper-buildathon-2026-06-06.md`

> **Rev 2 (2026-06-07, post-Codex adversarial review):** the prior draft deferred the live-network/x402-`/settle` proof — the *mandatory* DoraHacks deliverable — past the gates, risking a polished local demo that misses the real requirement with no recovery time. Fixed: **funding is now Task 0.0** (critical path, starts Day 0); the **Phase 0 GO bar requires a funded `casper-test` account + a public deploy/call tx hash + a real x402 `/settle` tx hash on `casper:casper-test`**; local CasperVM + facilitator `/verify` are parallel pre-checks only and are **not** sufficient for GO; all stretch work is blocked until live `/settle` succeeds; Phase 5 is now packaging-only.

---

## Hard rules carried from the spec/pre-mortem (non-negotiable)

- **SPINE is always shippable.** Build top-down, cut bottom-up. A working Odra contract on a real Casper network + one agent-signed tx + public repo + demo video clears the submission floor on its own.
- **No self-dealing.** The x402 EXPOSE demo must have a genuine external counterparty (recruit a BUIDL team, public endpoint, or a *disclosed* second agent). Never present a self-call as external demand.
- **Fresh public repo from an allowlist.** NEVER flip this private tree (it holds `state/` — live addresses + posting history). Pre-commit secret scan before any push. Testnet only; no production keys in the dev harness.
- **Gates are binary AND map to the DoraHacks deliverable.** Every GO criterion must correspond to a submission requirement (working prototype on Casper **Testnet** with a transaction-producing on-chain component). Day-0 spike GO = **live on `casper-test`**: funded account + public deploy/call tx hash + a real x402 `/settle` tx hash. CasperVM tests and facilitator `/verify` are pre-checks, not GO. → Day-7 (Jun 13) SPINE complete (incl. one live `402→settle`) → Day-14 (Jun 20) stretch + counterparty → submit Jun 28.
- **Funding is the pacing risk, so it starts first (Task 0.0).** The public-testnet tx is mandatory and the faucet is captcha/wallet-gated, so funding is pursued Day 0 in parallel via every route. No stretch work (Phases 2–4) begins until a live `/settle` tx hash exists.
- **Fall back, don't grind.** If a gate fails, cut to the next-smaller shippable scope (ultimately the June-2 "minimal-real" entry), don't burn runway.

---

## Toolchain reality (verified 2026-06-07 on this machine)

| Tool | State | Notes |
|---|---|---|
| rustup + Rust 1.96 + `wasm32-unknown-unknown` | ✅ installed | this session |
| cmake 4.3.2 | ✅ installed via `pip --user --break-system-packages` | brew is **unusable** — `/opt/homebrew` owned by `gabrieldev`, needs sudo chown (don't) |
| clang 17 / CLT | ✅ present | native crate compilation OK |
| `cargo-odra` + `casper-client` | ⏳ compiling (background) | `cargo install cargo-odra --locked; cargo install casper-client` |
| Go 1.25+ | ❌ not installed | needed for `casper-x402` facilitator; prebuilt tarball → `~/.local/go` (no sudo). **Gabriel paused installs** — confirm before installing. |
| Docker | ❌ not installed | **Not on the critical path** — the live `/settle` uses public-testnet CSPR.cloud RPC, not a local node. NCTL (needs Docker) is optional; CasperVM (`cargo odra test -b casper`) is a local pre-check only, NOT a substitute for the live deploy. |
| binaryen (`wasm-opt`) / wabt (`wasm-strip`) | ❌ not installed | Odra build optimizers; prebuilt GitHub binaries → `~/.local/bin` if `cargo odra build` needs them. |

**Funding constraint (now Task 0.0 — the critical path):** the public testnet faucet (`testnet.cspr.live/tools/faucet`) is **Google-captcha + Casper-Wallet gated** — no programmatic API. A *public-testnet* tx is the **mandatory submission deliverable**, so funding is started **Day 0, in parallel, via every route at once**: (1) buildathon dev-support (Discord/Telegram) the moment we register; (2) email `casper-testnet@make.services` with the public key; (3) one-time Gabriel installs Casper Wallet + solves the captcha for the throwaway account (a single GUI step, the fastest deterministic route). Local CasperVM work proceeds in parallel so no time is idle, but **GO is gated on funded-account + live tx**, not on the local work. Note: a public-testnet `/settle` uses CSPR.cloud node RPC, so it needs **no Docker** (NCTL local node is not on the critical path).

---

## Phase roadmap (the full arc)

| Phase | Output | Tier | Gate |
|---|---|---|---|
| **0 — Spike (live-network)** | Funded `casper-test` account + public Odra deploy/call **tx hash** + a real x402 `/settle` **tx hash** on `casper-test`. (CasperVM tests + `/verify` are parallel pre-checks, not GO.) | gate | Day 0–2 |
| **1 — SPINE** | Attestation contract live on **public testnet** + agent loop writes on-chain (real tx hash) + one live x402 **`402→settle`** leg + fresh public repo | SPINE | Day 7 (Jun 13) |
| **2 — Counterparty** | x402 EXPOSE endpoint + a real external payer (live `/settle` between two parties) | STRETCH 1 | Day 14 (Jun 20) |
| **3 — Live position** | Real testnet position via `cspr-trade-mcp`, attested | STRETCH 2 | Day 14 |
| **4 — EVM proof adapter** | Fresh EVM x402 + attestation on Base Sepolia (proves the seam) | STRETCH 3 | Day 14 |
| **5 — Package & submit** | Demo video + DoraHacks submission writeup (public deploy already proven by Day-7) | ship | Jun 26–28 |

**Stretch gate:** no Phase 2–4 work starts until Phase 1's live `402→settle` tx hash exists. If funding stalls, the whole project holds at the funded-account blocker — that is the signal to escalate the funding route (or fall back to the June-2 minimal-real entry), not to proceed building stretch on top of an unproven live path.

**This document fully details Phases 0 and 1** (concrete and executable now). **Phases 2–5 are task-level roadmaps** — their bite-sized TDD steps are authored *after* the Phase 0 gate confirms the real Odra/x402/SDK APIs hands-on (the pre-mortem's "don't write code against unvalidated APIs" rule). Each subsequent phase gets appended to this file or a sibling plan once Phase 0 is green.

---

## File structure (locked decomposition)

Built in a **fresh public repo** (working name `sasha-x402-kit`), NOT in this tree. Layout:

```
sasha-x402-kit/
  core/                         # chain-agnostic — imports NO chain SDK
    settlement_adapter.ts       # SettlementAdapter interface (quote/sign/settle/attest/readReceipt)
    x402_client.ts              # pay-side: 402 → sign → retry-with-proof
    x402_server.ts              # earn-side: paywalled MCP endpoint
    synthesis.ts                # the product being sold (signal synth; fresh impl)
    types.ts                    # chain-neutral types
  adapters/
    casper/
      contract/                 # Odra (Rust) attestation contract
        src/lib.rs
        Cargo.toml  Odra.toml
        tests/                  # OdraVM unit tests
      casper_adapter.ts         # implements SettlementAdapter via casper-js-sdk + x402
      x402/                     # casper-x402 (Go) facilitator+server+client config
    evm/
      casper_evm_adapter.ts     # Base Sepolia x402 + EAS-style attestation (Phase 4)
  agent/
    loop.ts                     # PAY → ACT → ATTEST → EXPOSE orchestrator
  scripts/
    spike/                      # Phase 0 throwaway harness (gitignored secrets)
  README.md                     # docs + the "real project / socials / launch plan" section
  .gitignore  .env.example
  scripts/secret-scan.sh        # pre-commit gate
```

(Language: TypeScript for core/adapters/agent via `casper-js-sdk`; Rust only for the Odra contract. Rationale: headless TransactionV1 signing is first-class in `casper-js-sdk`; CSPR.click is browser-only and excluded.)

---

## Phase 0 — Spike (Day 0–2) — FULLY DETAILED, EXECUTABLE NOW

**Goal:** prove the **mandatory live path end-to-end** — *can the agent deploy a contract to public `casper-test` and complete a real x402 `/settle` there?* — because that is the DoraHacks deliverable. CasperVM tests + facilitator `/verify` run in parallel as fast pre-checks (they de-risk the code while funding lands), but **GO requires two live `casper-test` tx hashes** (a contract deploy/call + an x402 settle). Throwaway harness in `/tmp/casper-spike`; the funded keypair PEM stays gitignored, nothing committed.

**Critical-path ordering:** Task 0.0 (funding) starts at minute zero and runs in parallel with Tasks 0.1–0.4. Tasks 0.1–0.3 (CasperVM) and 0.4a (`/verify`) need no funding and run immediately. Tasks 0.4b (live deploy) and 0.4c (live `/settle`) unblock the moment the account is funded. The spike is **GO only when 0.4b + 0.4c produce live tx hashes**.

### Task 0.0: Acquire `casper-test` funding (START DAY 0, PARALLEL, BLOCKS GO)

**Files:** Create `/tmp/casper-spike/keys/` (throwaway PEM; gitignored)

- [ ] **Step 1: Generate the throwaway testnet keypair (headless)**

Run:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
mkdir -p /tmp/casper-spike/keys
casper-client keygen /tmp/casper-spike/keys      # writes secret_key.pem, public_key.pem, public_key_hex
cat /tmp/casper-spike/keys/public_key_hex        # the public key to fund (safe to share — NOT a secret)
```
Expected: a `public_key_hex` (and derive the account-hash via `casper-client account-address --public-key /tmp/casper-spike/keys/public_key.pem`). NEVER print or share `secret_key.pem`.

- [ ] **Step 2: Fire all three funding routes in parallel (the public key is public; the secret never leaves the machine)**

   1. **Buildathon dev-support** — once registered on DoraHacks, request testnet CSPR for `<public_key_hex>` in the Casper buildathon Discord/Telegram. (Distribution-channel action → coordinate via `marketing/` if posting is gated, but a dev-support funding ask is a dev task.)
   2. **Email** `casper-testnet@make.services` with the public key, stating buildathon participation.
   3. **One-time GUI (fastest deterministic):** Gabriel installs Casper Wallet, imports `<public_key_hex>`'s account (or creates one we then fund), and solves the faucet captcha at `https://testnet.cspr.live/tools/faucet` → 1000 testnet CSPR. **This is the one human step in the whole plan;** flag it to Gabriel on Day 0 so it isn't on the critical path at the end.

- [ ] **Step 3: Confirm receipt**

Run: `casper-client get-balance` via a CSPR.cloud testnet RPC for the account, or check `https://testnet.cspr.live/account/<public_key_hex>`.
Expected: non-zero CSPR. **Until this is non-zero, the spike cannot reach GO** — that is the intended gate, not a failure to route around.

### Task 0.1: Confirm the toolchain compile finished

**Files:** none (verification only)

- [ ] **Step 1: Check the background compile flag**

Run: `cat /tmp/casper-toolchain-done.flag 2>/dev/null; tail -1 /tmp/cargo-odra-install.log; tail -1 /tmp/casper-client-install.log`
Expected: `ALL_DONE`, and `CARGO_ODRA_EXIT=0` / `CASPER_CLIENT_EXIT=0` in the logs.

- [ ] **Step 2: Verify binaries on PATH**

Run: `export PATH="$HOME/.cargo/bin:$HOME/Library/Python/3.13/bin:$PATH"; cargo odra --version; casper-client --version; cmake --version | head -1`
Expected: cargo-odra prints a version; casper-client prints a version; cmake 4.3.2.
If `cargo odra` fails → re-run `cargo install cargo-odra --locked` and read the error (likely a missing C dep → install via pip/prebuilt, never brew).

### Task 0.2: Scaffold and unit-test a trivial Odra contract on OdraVM

**Files:** Create `/tmp/casper-spike/flipper/` (via cargo-odra scaffolder)

- [ ] **Step 1: Scaffold**

Run:
```bash
export PATH="$HOME/.cargo/bin:$HOME/Library/Python/3.13/bin:$PATH"
mkdir -p /tmp/casper-spike && cd /tmp/casper-spike
cargo odra new --name flipper && cd flipper
```
Expected: a project tree with `src/`, `Odra.toml`, a sample `Flipper` module.

- [ ] **Step 2: Run the bundled tests on OdraVM (fast, in-memory)**

Run: `cargo odra test`
Expected: PASS. This proves the Odra dev loop works without a node.

### Task 0.3: Run the contract on the real CasperVM backend (the key proof)

- [ ] **Step 1: Test against CasperVM**

Run: `cargo odra test -b casper`
Expected: PASS. This executes the WASM on the genuine Casper execution engine in-process — proving the contract code is correct before we spend funded CSPR deploying it. **Pre-check only — NOT the GO signal** (GO is the live deploy in 0.4b). If it fails on a missing `wasm-opt`/`wasm-strip` → fetch binaryen + wabt prebuilt arm64 binaries into `~/.local/bin`, add to PATH, retry.

### Task 0.4: Prove the x402 path — `/verify` first (no funding), then the live `/settle` (GO)

**Files:** Create `/tmp/casper-spike/x402/` (clone of the reference)

The reference splits cleanly: facilitator `/verify` validates a signed payload with **no** on-chain submission (provable instantly, no funding); `/settle` submits a real `transfer_with_authorization` deploy (needs a funded account — this is the GO leg). We prove `/verify` while funding lands, then `/settle` the moment it does.

- [ ] **Step 1: Clone the reference and read the signing path**

Run:
```bash
cd /tmp/casper-spike && git clone https://github.com/make-software/casper-x402.git x402 && cd x402
```
Read: `examples/client/main.go` (EIP-712 authorization construction + signing) and `apps/facilitator` (`/verify` vs `/settle`).

- [ ] **Step 2 (0.4a — no funding): get the x402 runtime working and prove `/verify`**

The Go facilitator/client is the canonical path. Since host installs were paused, default to the **TypeScript route**: reproduce the EIP-712 `transfer_with_authorization` payload with `casper-js-sdk` typed-data signing and POST it to the facilitator `/verify` (`https://x402-facilitator.cspr.cloud/verify`, or a local facilitator). If Gabriel approves a Go install, use the reference client directly instead (`~/.local/go/bin/go` from a prebuilt tarball — no sudo).
Expected: `/verify` returns valid=true for a correctly signed payload. **Pre-check only — proves cryptographic correctness, NOT GO.**

- [ ] **Step 3 (0.4b — needs Task 0.0 funding): live deploy on `casper-test`**

With the funded key, deploy the trivial Odra contract (or a CEP-18) to public testnet via Odra livenet env (`ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test`, `ODRA_CASPER_LIVENET_NODE_ADDRESS=<CSPR.cloud testnet RPC>`, `ODRA_CASPER_LIVENET_SECRET_KEY_PATH=/tmp/casper-spike/keys/secret_key.pem`) → `cargo run --features livenet`.
Expected: a real `https://testnet.cspr.live/transaction/<hash>`. **This is the contract-leg GO signal.**

- [ ] **Step 4 (0.4c — needs Task 0.0 funding): live x402 `/settle` on `casper-test`**

Run the full client → resource-server → facilitator `/settle` flow against `casper:casper-test` with the funded key + a deployed CEP-18 token, submitting a real `transfer_with_authorization`.
Expected: facilitator returns settled + a `casper-test` tx hash. **This is the x402-leg GO signal and the spike's hardest, most decisive proof.**

### Task 0.5: Spike verdict

**Files:** Create `_ops/spike-result-casper-2026-06-XX.md` (in this tree, notes only — no secrets)

- [ ] **Step 1: Write the go/no-go (GO requires BOTH live tx hashes)**

Record: 0.4b live deploy tx hash ✔/✗ · 0.4c live `/settle` tx hash ✔/✗ · plus the pre-checks (CasperVM pass, `/verify` pass) and the confirmed headless signing path. **GO only if 0.4b AND 0.4c produced live `casper-test` tx hashes.** `/verify` + CasperVM passing while `/settle` fails = **NO-GO / blocked-on-live-path** — escalate funding or the failing live step, do NOT proceed to SPINE. If the live path is fundamentally broken, fall back to the June-2 minimal-real entry. Record the decision in `docs/decision-log.md`.

Record: did `cargo odra test -b casper` pass? did x402 `/verify` accept a real signed payload? what's the confirmed headless signing path? what broke and how it was fixed? Decision: **GO** (proceed to Phase 1) or **NO-GO** (fall back to the June-2 minimal-real entry). Update `docs/decision-log.md`.

---

## Phase 1 — SPINE (target Day 7, Jun 13) — DETAILED

**Goal:** the minimum shippable, submittable artifact: an Odra **attestation contract** that the agent calls each cycle, plus one x402 PAY leg, in a fresh public repo. Built TDD on OdraVM (fast), validated on CasperVM, deployed to a real network in Phase 5.

> **API caveat:** the Odra contract code below is a first cut written against the v2.7 docs. Validate exact macro/attribute names (`#[odra::module]`, `#[odra::odra_type]`, `Mapping`, `List`, `env().caller()`, `env().get_block_time()`) against the scaffolded sample from Task 0.2 before relying on it; adjust to match the version actually installed. This is the one place the plan defers to hands-on API truth.

### Task 1.1: Initialize the fresh public repo with secret hygiene FIRST

**Files:** Create `sasha-x402-kit/.gitignore`, `scripts/secret-scan.sh`, `.env.example`, `README.md`

- [ ] **Step 1: Create the repo skeleton from an allowlist (never copy from the private tree wholesale)**

```bash
mkdir -p ~/dev/sasha-x402-kit && cd ~/dev/sasha-x402-kit && git init
printf '%s\n' '.env' '*.pem' 'keys/' 'state/' 'node_modules/' 'target/' '/tmp/' '*.log' > .gitignore
```

- [ ] **Step 2: Write the pre-commit secret scan**

```bash
#!/usr/bin/env bash
# scripts/secret-scan.sh — fail commit if a secret-shaped string is staged
set -euo pipefail
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --redact --no-banner
else
  # fallback: block obvious key material + pem + .env
  if git diff --cached --name-only | grep -E '\.(pem|env)$'; then echo "BLOCK: pem/env staged"; exit 1; fi
  if git diff --cached -U0 | grep -E '(-----BEGIN [A-Z ]*PRIVATE KEY|[A-Za-z0-9_-]{40,})'; then echo "WARN: possible secret — review"; exit 1; fi
fi
```

- [ ] **Step 3: Wire it as the repo pre-commit hook + commit the skeleton**

```bash
chmod +x scripts/secret-scan.sh
mkdir -p .git/hooks && printf '#!/usr/bin/env bash\nexec ./scripts/secret-scan.sh\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
git add -A && git commit -m "chore: repo skeleton + secret-scan pre-commit gate"
```
Expected: commit succeeds; a deliberately-staged dummy `.pem` is blocked (test it once, then remove).

### Task 1.2: The attestation contract — TDD on OdraVM

**Files:** Create `adapters/casper/contract/src/lib.rs`, `adapters/casper/contract/tests/attest.rs`, `Cargo.toml`, `Odra.toml` (scaffold via `cargo odra new --name agent_attest`, then replace the module)

- [ ] **Step 1: Write the failing test (OdraVM)**

```rust
// tests/attest.rs
use odra::host::{Deployer, HostEnv};
use agent_attest::{AgentAttest, AgentAttestInitArgs};

fn setup() -> (HostEnv, AgentAttestHostRef) {
    let env = odra_test::env();
    let c = AgentAttest::deploy(&env, AgentAttestInitArgs {});
    (env, c)
}

#[test]
fn records_a_decision_and_reads_it_back() {
    let (env, mut c) = setup();
    let id = c.attest("WETH/USDC LP open".to_string(), 1850u64); // (summary, metric)
    assert_eq!(c.count(), 1u32);
    let rec = c.get(id);
    assert_eq!(rec.summary, "WETH/USDC LP open");
    assert_eq!(rec.author, env.get_account(0)); // caller is the deployer
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cargo odra test -- records_a_decision_and_reads_it_back`
Expected: FAIL to compile (`AgentAttest` not defined).

- [ ] **Step 3: Implement the minimal contract**

```rust
// src/lib.rs
use odra::prelude::*;

#[odra::odra_type]
pub struct Record { pub author: Address, pub summary: String, pub metric: u64, pub ts: u64 }

#[odra::module]
pub struct AgentAttest {
    records: Mapping<u32, Record>,
    count: Var<u32>,
}

#[odra::module]
impl AgentAttest {
    pub fn init(&mut self) { self.count.set(0); }

    pub fn attest(&mut self, summary: String, metric: u64) -> u32 {
        let id = self.count.get_or_default();
        self.records.set(&id, Record {
            author: self.env().caller(),
            summary, metric,
            ts: self.env().get_block_time(),
        });
        self.count.set(id + 1);
        id
    }

    pub fn count(&self) -> u32 { self.count.get_or_default() }
    pub fn get(&self, id: u32) -> Record { self.records.get(&id).unwrap() }
}
```

- [ ] **Step 4: Run on OdraVM, verify pass**

Run: `cargo odra test -- records_a_decision_and_reads_it_back`
Expected: PASS.

- [ ] **Step 5: Run on CasperVM, verify pass**

Run: `cargo odra test -b casper -- records_a_decision_and_reads_it_back`
Expected: PASS (proves it executes on the real engine).

- [ ] **Step 6: Commit**

```bash
git add adapters/casper/contract && git commit -m "feat(casper): agent attestation contract + OdraVM/CasperVM tests"
```

- [ ] **Step 7: Deploy to PUBLIC `casper-test` (uses the funded key from Task 0.0)**

Set the Odra livenet env (`ODRA_CASPER_LIVENET_SECRET_KEY_PATH=/tmp/casper-spike/keys/secret_key.pem`, `ODRA_CASPER_LIVENET_NODE_ADDRESS=<CSPR.cloud testnet RPC>`, `ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test`) → `cargo run --bin agent_attest_livenet --features livenet`.
Expected: a real `https://testnet.cspr.live/transaction/<hash>` + the deployed contract hash. **The SPINE is not complete until the contract is live on public testnet** — CasperVM passing is not enough. Record the contract hash for Tasks 1.3/1.4.

### Task 1.3: SettlementAdapter interface + CasperAdapter.attest()

**Files:** Create `core/settlement_adapter.ts`, `core/types.ts`, `adapters/casper/casper_adapter.ts`, `adapters/casper/casper_adapter.test.ts`

- [ ] **Step 1: Define the chain-neutral interface (no chain imports)**

```typescript
// core/settlement_adapter.ts
import type { Attestation, Receipt, PaymentReq } from "./types";
export interface SettlementAdapter {
  attest(a: Attestation): Promise<{ txHash: string; id: number }>;
  readReceipt(id: number): Promise<Receipt>;
  // x402 — part of the SPINE (Task 1.4), proven live in Phase 0:
  sign(req: PaymentReq): Promise<string>;
  settle(signed: string): Promise<{ txHash: string }>;
}
```

- [ ] **Step 2–5:** Write a failing test for `CasperAdapter.attest()` (mock the RPC), implement it via `casper-js-sdk` TransactionV1 calling the **live** contract's `attest` entrypoint (contract hash from Task 1.2 Step 7) with the **Phase-0-confirmed headless signing path**, run red→green, commit. Then confirm a real `attest` call lands a `casper-test` tx hash. *(Exact casper-js-sdk call shape filled from the Phase-0-validated snippet.)*

### Task 1.4: x402 PAY leg + agent loop + one LIVE `402→settle` (PAY → ATTEST)

**Files:** Create `core/x402_client.ts`, `core/settlement_adapter.ts` (`sign`/`settle` impls in `casper_adapter.ts`), `agent/loop.ts`, tests alongside

- [ ] **Step 1–5:** TDD the x402 pay-client (402 → sign → retry-with-`PAYMENT-SIGNATURE`), implement `CasperAdapter.sign/settle` reusing the Phase-0 `/settle` path, and wire `agent/loop.ts` to: pay a data endpoint over x402 → synthesize → call the live `attest` → emit tx hashes. Commit each green step.
- [ ] **Step 6: Prove one LIVE `402→settle` on `casper-test`** (not just the demo server / `/verify`): the agent pays a paywalled endpoint and the facilitator settles on public testnet. Capture the settle tx hash. **This is the SPINE's mandatory transaction-producing on-chain component** — the DoraHacks deliverable.

### Task 1.5: README with the "real project / launch plan" section

**Files:** Create `README.md`

- [ ] **Step 1:** Write docs + usage + the judging-criterion section linking Sasha's live socials (@SashaCoin95), token, podcast, dashboard, and the chain-agnostic roadmap. Commit.

### Task 1.6: Day-7 GATE (every criterion = a DoraHacks submission requirement)

- [ ] **Step 1:** Verify, with artifacts: (1) attestation contract **deployed on public `casper-test`** — contract hash + `testnet.cspr.live` deploy tx hash ✔; (2) a live `attest` call from the agent loop — tx hash ✔; (3) one live x402 **`402→settle`** on `casper-test` — settle tx hash ✔; (4) repo public-ready + secret-scan green ✔. **All four are tx-hash-or-artifact-backed; "runs on CasperVM" is not a substitute.** If any live item is missing → do NOT start stretch; escalate the failing live step (funding/RPC/signing) or fall back to the June-2 minimal-real entry. Record the gate decision + the tx hashes in `docs/decision-log.md`.

---

## Phase 2 — External counterparty / x402 EXPOSE (STRETCH 1, target Day 14) — ROADMAP

*(`/settle` itself is already proven live in the SPINE; Phase 2 adds the* external *payer and the EXPOSE side.)*
- T2.1 Implement `core/x402_server.ts` — Sasha's paywalled MCP endpoint serving the synthesized/verified yield.
- T2.2 Counterparty: stand up a public endpoint + DM 1–2 BUIDL teams in Discord; build a *disclosed* second-agent caller as guaranteed fallback (no self-dealing).
- T2.3 End-to-end: a genuine external agent pays Sasha's endpoint → live `/settle` on `casper-test` → server returns data → attestation records the sale. Capture the tx hash.
- *Detailed TDD steps authored after the SPINE confirms the live `/settle` + signing path.*

## Phase 3 — Live position via cspr-trade-mcp (STRETCH 2, Day 14) — ROADMAP

- T3.1 Connect `https://mcp.cspr.trade/mcp`; read tools (`get_portfolio_value`, `get_quote`, `build_swap`, `build_add_liquidity`).
- T3.2 Agent ACT verb: open/track a small **testnet** position; feed its real yield into the EXPOSE feed (the RWA referent).
- T3.3 Attest each position change. *(Gated on cspr-trade-mcp testnet maturity — if read-only on testnet, attest a position snapshot instead.)*

## Phase 4 — EVM proof adapter (STRETCH 3, Day 14) — ROADMAP

- T4.1 `adapters/evm/casper_evm_adapter.ts` implementing `SettlementAdapter` against Base Sepolia (fresh EVM x402 + EAS-style attestation).
- T4.2 Adapter-parity test: the same core commerce flow runs through Casper and EVM adapters (proves the seam is real). This is what makes "chain-agnostic" demonstrable, not claimed.

## Phase 5 — Package & submit (Jun 26–28) — ROADMAP

*(Public-testnet deploy + the live `402→settle` are already DONE in the SPINE/Phase 0 — Phase 5 is packaging only, so the live path can never be a last-minute surprise.)*
- T5.1 Run one full agent cycle on public testnet for the demo; capture fresh tx hashes + the `testnet.cspr.live` links.
- T5.2 Final secret-scan + push the public repo.
- T5.3 Demo video + DoraHacks submission writeup → **route to `marketing/`** per the workspace boundary.
- T5.4 Submit on DoraHacks **Jun 28** (2-day buffer).

---

## Self-review

**Spec coverage:** product 4-verbs (Phase 1 PAY/ATTEST + live settle; Phase 2 EXPOSE + external payer; Phase 3 ACT) ✔ · chain-agnostic core + Casper flagship + EVM proof (file structure + Phases 1/4) ✔ · SPINE/STRETCH/DROP tiers (phase roadmap) ✔ · gates Day-0/7/14 + submit Jun28, **each mapped to a DoraHacks deliverable** (Codex Rev-2 fix) ✔ · counterparty no-self-deal (Phase 2 T2.2) ✔ · public-repo-from-allowlist + secret scan (Task 1.1, first) ✔ · 3-vector advancement = a marketing/submission concern, noted in T5.3 ✔.

**Codex Rev-2 (live-path gating) — resolved:** funding is Task 0.0 (Day-0, critical path) ✔ · Phase-0 GO requires live `casper-test` deploy + live `/settle` tx hashes, `/verify`+CasperVM are pre-checks only ✔ · SPINE deploys to public testnet (Task 1.2 Step 7) and includes one live `402→settle` (Task 1.4 Step 6) ✔ · Day-7 gate is artifact/tx-hash-backed (Task 1.6) ✔ · stretch blocked until live settle ✔ · Phase 5 reduced to packaging ✔.

**Placeholder scan:** Phase 0 + Phase 1 carry exact commands/code. The one flagged deferral (Odra macro names in Task 1.2, the casper-js-sdk call shape in 1.3/1.4) is explicitly gated on Phase-0 hands-on validation — not a lazy TODO but the correct response to unvalidated third-party APIs (pre-mortem rule). Phases 2–5 are intentionally roadmap-level per the staged-plan structure.

**Type consistency:** `attest(summary,metric)→id`, `count()→u32`, `get(id)→Record{author,summary,metric,ts}` used consistently across the contract, its tests, and the `SettlementAdapter` interface. `SettlementAdapter.sign/settle` are declared in the interface and implemented in the SPINE (Task 1.4) — same names, proven live in Phase 0.
