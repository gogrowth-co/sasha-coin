# Casper Developer Documentation — Intelligence Sweep (Domain 03: Docs / DevEx)

**Prepared for:** Sasha Coin entry, Casper Agentic Buildathon (deadline 2026-06-30)
**Date:** 2026-06-06
**Requirement under assessment:** build an agentic app with a transaction-producing on-chain component on Casper Testnet.
**Method:** Firecrawl was OUT OF CREDITS for the entire session ("Insufficient credits"). Fell back to `curl` (raw sitemap.xml, llms.txt, SKILL.md) + WebFetch (rendered doc pages). All findings below are from live docs as of this date. Anything missing/404 is flagged.

---

## 1. docs.casper.network — site map & dev path

### 1.1 Structure (from live sitemap.xml — 947 URLs)

The docs are **version-namespaced**:
- **Default / current** (`/developers/...`, `/concepts/...`, `/resources/...`, `/operators/...`, `/users/...`) — current production (Casper 1.5.x era content, being migrated).
- **`/1.5.X/...`** — explicitly pinned Casper 1.5 (legacy).
- **`/next/...`** — **Casper 2.0** docs (mirror of the dev tree under `next/developers/...`). This is the version a 2026 builder should target.
- **`/condor/...` and `/pages/condor/...`** — **Condor = the Casper 2.0 upgrade codename.** 316 of the 947 URLs are `condor/jsonrpc-comp/*` (JSON-RPC 1.x→2.0 comparison reference). Condor docs cover: `block-lanes`, `transactions` (new TransactionV1 model), `zug` (new consensus), `validator-rewards`, `setting-up-condor-local`, `rpc-changes`. **Casper 2.0 / Condor is confirmed and heavily documented.**

Top doc clusters by volume: `next/developers` (55), `next/concepts` (52), `1.5.X/developers` (52), `developers/dapps` (15), `developers/cli` (14), `resources/tutorials` (13), `developers/writing-onchain-code` (12).

### 1.2 Developer onboarding path (step-by-step)

Verified from `/developers/prerequisites`:

1. **OS:** Linux Ubuntu 20.04 or macOS recommended. *"Developing on Windows is not advised."*
2. **System deps:** `curl`, `build-essential`, `pkg-config`, `openssl`, `libssl-dev`, `cmake`.
3. **Rust:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` → verify `rustup --version`.
4. **Casper tooling:**
   - `cargo install cargo-casper` (contract scaffolder)
   - `cargo install casper-client` (CLI for deploys/queries) → verify `casper-client --version`
5. **WASM target** (implied for on-chain code): `rustup target add wasm32-unknown-unknown`.
6. **Account/keys:** generate via the casper-client CLI **or** the cspr.live block explorer (browser). Account hash via `casper-client account-address --public-key <path>`.
7. **Testnet faucet:** request once per account (see 1.6).
8. **RPC:** connect to `http://<node-ip>:7777`; peer IPs from `https://testnet.cspr.live/tools/peers`. (For production-grade access, CSPR.cloud node proxy is the managed alternative — see Section 3.)

### 1.3 Smart-contract docs

Two native tracks plus the Odra framework (Odra covered in Section 4):
- **`/developers/writing-onchain-code/*`** — native Rust contract authoring: `getting-started` (200 OK), `simple-contract`, `contract-vs-session`, `calling-contracts`, `contract-hash-vs-package-hash`, `emitting-contract-events`, `factory-pattern`, `testing-contracts`, `upgrading-contracts`, `writing-session-code`, `best-practices`. Audience stated as *"smart contract developers ... who work exclusively in Rust."*
- **`/developers/cli/*`** — deploy & interact via `casper-client`: `installing-contracts`, `calling-contracts`, `sending-transactions`, `querying-global-state`, `verifying-contracts`, `transfers/*`, `delegate`/`undelegate`/`redelegate`, `opcode-costs`, `execution-error-codes`.
- **`/developers/essential-crates`** — the Rust crate set (`casper-contract`, `casper-types`, `casper-engine-test-support`, etc.).

**Note:** `/resources/build-on-casper/simple-contract` is a landing/nav page, not a tutorial (confirmed — no contract walkthrough there). The real native walkthrough is `/developers/writing-onchain-code/simple-contract`.

### 1.4 SDK / client-library support

Under `/developers/dapps/sdk/`:
- `python-sdk` ✅
- `go-sdk` ✅
- `csharp-sdk` ✅ (C#/.NET)
- `script-sdk` ✅ (**JS/TS** — the casper-js-sdk; "script" = TypeScript/Node)
- `client-library-usage` (generic client lib usage)

**Rust:** not a "dapp SDK" page — Rust is the *on-chain* language (covered under writing-onchain-code + essential-crates) and the CLI (`casper-client`). So Rust is first-class but documented as the contract/CLI layer, not the dapp-client layer.

| Language | dApp-client SDK | Doc path | On-chain role |
|---|---|---|---|
| Rust | (CLI + crates, not a "dapp SDK") | `/developers/essential-crates`, `/developers/cli` | **Primary on-chain language** |
| JS/TS | ✅ casper-js-sdk ("script-sdk") | `/developers/dapps/sdk/script-sdk` | client/signing |
| Python | ✅ | `/developers/dapps/sdk/python-sdk` | client |
| Go | ✅ | `/developers/dapps/sdk/go-sdk` | client |
| C#/.NET | ✅ | `/developers/dapps/sdk/csharp-sdk` | client |

dApp docs also cover: `signing-a-transaction`, `monitor-and-consume-events`, `speculative-exec`, `nctl-test` / `setup-nctl` (local test network), `template-frontend`, `technology-stack`, `uref-security`.

### 1.5 Account model / account abstraction (`/concepts/accounts-and-keys`)

- Account = **`AccountHash`** (32-byte blake2b hash derived from any supported PublicKey variant).
- **Key algorithms:** **Ed25519** (`01` prefix, 33 bytes) and **Secp256k1** (`02` prefix, 33-byte compressed — *Ethereum-compatible keys*).
- **Native multisig / "account abstraction":** Accounts hold **associated keys**, each with a **weight**. Two **action thresholds**:
  - **Deployment threshold** (authorize tx execution)
  - **Key-management threshold** (modify account permissions)
  - Cumulative key weight must meet the threshold. This is built-in multisig at the protocol level — no contract wallet needed.
- **Main purse:** each account has a main-purse URef; **the account does not exist on-chain until its main purse is funded** (i.e. faucet/transfer creates the account).

### 1.6 Testnet faucet + wallet (`/users/testnet-faucet`)

- **Faucet URL:** `https://testnet.cspr.live/tools/faucet`
- **Wallet:** **Casper Wallet** browser extension required; log into testnet with it.
- **Limit:** **once per account.** Repeat requests fail. Workaround: create a new account.
- **Steps:** log in with Casper Wallet → Tools → Faucet → "Request tokens" → account credited.
- Faucet drip amount not stated in docs.

### 1.7 Gas model (`/concepts/economics/gas-concepts`)

- Base: *"gas is priced at a fixed price of 1 mote ... per 1 unit of gas"* (1 CSPR = 10^9 motes), BUT modified by a dynamic **`current_gas_price` multiplier** that adjusts at switch blocks with network utilization (up when busy, down when idle). So: **deterministic WASM metering × dynamic price multiplier** (a Casper 2.0 elasticity feature; full block-lanes detail lives in the `/condor/*` pages, not this page).
- **No-refund model by default:** *"Gas fees are consumed ... irrespective of whether a transaction was successful or not."* Conditional: *"Depending on how the network was configured, the transaction fee may or may not be refunded."*
- Opcode-cost table at `/developers/cli/opcode-costs`.

### 1.8 WASM-native L1

Confirmed implicitly throughout: contracts compile to **`wasm32-unknown-unknown`**, gas is metered per WASM opcode (opcode-costs table), and the runtime is a CasperVM/WASM engine. This is a WASM-native L1 (not EVM). EVM-familiar devs get Secp256k1 key compatibility but a different VM, account model (purses/URefs), and a session-vs-contract execution distinction.

---

## 2. CSPR.click AI Agent Skill (docs.cspr.click/documentation/ai-agent-skills + raw SKILL.md)

**This is real, live, and installable into Claude Code today.** It is an **Agent Skill** (the same skill format this workspace uses), not just an SDK.

### 2.1 Install methods (verbatim from docs)

- **Direct (any agent):** tell the agent → `"Install this skill: https://cspr.click/SKILL.md"`
- **CLI:** `npx skills add https://github.com/make-software/csprclick-examples/tree/master/csprclick-skill`
- **Manual:** clone the repo, copy the `csprclick-skill/` folder into the agent skills dir (`.claude/skills/`, `.opencode/skills/`, `.agents/skills/`, …).

**Supported agents (verbatim):** *"Augment, Claude Code, Cursor, Windsurf, GitHub Copilot, Cline, and many more."*

### 2.2 What the skill actually is

- **Skill name (from raw frontmatter):** `csprclick-sdk-integration` — *"Skills for integrating the CSPR.click Web SDK into dApps on the Casper blockchain. Covers wallet connection, transaction signing, event handling, theming, and CSPR.cloud API proxy."*
- **`user-invocable: true`**, `allowed-tools: Read, Grep, Glob, Edit, Write, Bash`.
- Ships its own **`references/llms.txt`** (63 KB, 1,737 lines — full API reference + code examples; HTTP 200 verified). The SKILL.md is 25 KB.
- It is a **frontend Web-SDK integration skill** — it teaches an agent to wire `@make-software/csprclick-ui` / `csprclick-core-client` into a React (<19 / 19+), Next.js, or Vanilla-JS dApp.

### 2.3 Capabilities (verbatim from SKILL.md)

- **Wallet aggregation:** single API for Casper Wallet, Ledger, WalletConnect, MetaMask Snap. Social logins (Google/Apple OIDC) backed by an **MPC wallet**.
- **Account mgmt:** `signIn()`, `connect(provider)`, `signInWithAccount()`, `switchAccount()`, `signOut()`, `disconnect()`, `getActiveAccount()`, `getActivePublicKey()`, etc.
- **Transaction signing & sending:**
  - `send(transactionJSON, publicKey, onStatusUpdate?, timeout?)` — **sign + submit to Casper** (works with `casper-js-sdk` **TransactionV1**).
  - `sign(transactionJSON, publicKey)` — sign only, submit yourself.
  - `signMessage()`, `encryptMessage()`, `decryptMessage()`.
- **CSPR.cloud API proxy** (no backend needed): `getCsprCloudProxy()` → `proxy.fetch(endpoint)` (REST), `proxy.newWebSocket(endpoint)` (streaming), `proxy.RpcURL` + `proxy.RpcDigestToken` (Node RPC via casper-js-sdk).
- **Fiat on-ramp:** `showBuyCsprUi()` (Topper by Uphold).
- **appId:** `'csprclick-template'` for localhost; production ID self-registered at `https://console.cspr.build`.

### 2.4 Important gaps for the buildathon

The skill is **client-side / wallet-integration focused.** It does **NOT**:
- create wallets from scratch / manage raw private keys headlessly (it brokers signing through user wallets / MPC, isolated in a cross-origin iframe on `accounts.cspr.click`),
- deploy contracts via Odra (that's Odra's job — Section 4),
- run server-side/headless tx signing (it's a browser SDK).

**Implication:** for an *autonomous agent* that signs its own txs headlessly, the CSPR.click skill is the wrong layer — it assumes a human-in-the-loop wallet. The headless-agent path is **casper-js-sdk directly** (build + sign TransactionV1 with an in-process key) or **Odra livenet env** (key from PEM file). The CSPR.click skill is best for a *frontend* where Sasha-the-dApp asks a connected user to sign.

---

## 3. CSPR.cloud APIs + x402 Facilitator (docs.cspr.cloud)

### 3.1 What CSPR.cloud is

Enterprise middleware = the primary interface for dApps to reach Casper. Indexed/normalized chain data, real-time subscriptions, managed nodes. Token-standard support: CEP-18, CEP-47, CEP-95 + Casper Event Standard.

**Products / nav:**
1. **REST API** — indexed network data with querying.
2. **Streaming API** — real-time WebSocket subscriptions.
3. **Casper Node API** — private managed-node RPC via middleware.
4. **x402 Facilitator API** — verify & settle HTTP micropayments on Casper.
   Nav: Overview · Getting Started · Highlights · REST API Reference · Streaming API Reference · Casper Node API · x402 Facilitator API · Developer Community.
   (Access-token issuance + base URLs live in the Getting Started page, not the landing page.)

### 3.2 x402 Facilitator API (docs.cspr.cloud/x402-facilitator-api/reference)

**Flow (HTTP 402 → sign → retry with proof):**
1. **Challenge:** client hits a protected resource → server returns **`402 Payment Required`** + a `PaymentRequirements` object (network, scheme, asset, amount).
2. **Sign:** client builds a signed **`PaymentPayload`**. For CSPR.cloud this is **CEP-18 token authorization via EIP-712 typed-data signatures.**
3. **Retry w/ proof:** client resends the request carrying a **`PAYMENT-SIGNATURE`** header with the signed payload.
4. **Facilitator verify + settle:** server forwards to the facilitator, which (a) **verifies** (checks payload meets requirements, no on-chain submission) then (b) **settles** (submits to Casper, monitors to confirmation). Facilitator is a **non-custodial** layer — it never holds funds, only executes signed authorizations.
5. **Deliver:** on confirmation, server returns the resource.

**Endpoint base:** `https://x402-facilitator.cspr.cloud`

| Path | Method | Purpose |
|---|---|---|
| `/supported` | GET | List supported schemes + networks |
| `/verify` | POST | Validate payload (no on-chain submit) |
| `/settle` | POST | Validate + settle on Casper |
*(all require an access token)*

- **Networks (CAIP-2):** `casper:casper` (mainnet), `casper:casper-test` (**testnet**).
- **Scheme:** `exact` (CEP-18 tokens).

**Buildathon relevance:** x402 is the cleanest "agent-pays-for-resource" primitive on Casper — an autonomous agent (Sasha) hitting a 402, signing a CEP-18 payment, and getting it settled is itself a transaction-producing on-chain action on testnet. Strong fit for an "agentic" narrative.

---

## 4. Odra framework + llms.txt (odra.dev)

### 4.1 llms.txt — CONFIRMED EXISTS

`https://odra.dev/llms.txt` → **HTTP 200, 3,874 bytes.** It is a clean, structured index of the entire Odra doc tree (90 lines) grouped into: Getting started, Basics, Advanced, Backends, Examples, Tutorials, Migrations. An AI agent can read this single file and navigate to any API/tutorial page to generate + deploy a Casper contract from a prompt. Key entries it exposes:
- **Getting started:** Flipper example, Installation.
- **Basics:** cargo-odra, Odra.toml, storage-interaction, host communication, testing, errors, events, cross-calls, modules, native-token, **Casper Contract Schema**.
- **Advanced:** advanced-storage, attributes, storage-layout, signatures, **wasm-client**, factory, delegating-cspr.
- **Backends:** what-is-a-backend, **OdraVM** (in-memory test VM), **Casper** (real CasperVM), **Livenet** (deploy to real testnet/mainnet).
- **Tutorials:** access-control, **build-deploy-read**, CEP-18, **deploying-on-casper**, ERC-20, NFT/ticketing, **odra-cli**, ownable, owned-token, pausable, upgrades, using-proxy-caller.
- **Migrations:** up to **v2.6.0** (current; docs last updated Apr 15 2026).

⚠️ **Broken link in llms.txt:** `Odra for Solidity developers` → `https://odra.dev/docs/tutorials/odra-sol` returns **404** (live-verified). The EVM-migration tutorial it advertises is dead. Note for any "coming from EVM" framing — the page is gone even though llms.txt still lists it.

### 4.2 Odra install + scaffold (odra.dev/docs/getting-started/installation, v2.6.0)

```
rustup target add wasm32-unknown-unknown
cargo install cargo-odra --locked
cargo odra --help              # verify
cargo odra new --name my-project && cd my_project
cargo odra test                # OdraVM (fast, in-memory)
cargo odra test -b casper      # against real CasperVM
```
Extra tooling: `wasmstrip` (wabt), `wasm-opt` (binaryen).

### 4.3 Odra → Casper Testnet deploy (odra.dev/docs/tutorials/deploying-on-casper)

Backend: **`odra-casper-livenet-env`**. `.env`:
```
ODRA_CASPER_LIVENET_SECRET_KEY_PATH=folder_with_your_secret_key/secret_key.pem   # PEM from Casper Wallet
ODRA_CASPER_LIVENET_NODE_ADDRESS=<rpc>      # e.g. https://node.cspr.cloud (CSPR.cloud) — testnet/mainnet
ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test  # 'casper' = mainnet, 'casper-test' = TESTNET
# optional: events URL
```
Deploy:
```
cargo run --bin our_token_livenet --features livenet
```
Code pattern (caller auto-resolved from the secret key — no explicit account in code):
```rust
let env = odra_casper_livenet_env::env();
let owner = env.caller();
OurToken::deploy(env, init_args)
```
On success it **prints a tx hash + `https://testnet.cspr.live/transaction/[hash]`** — i.e. a real on-chain testnet transaction. This is the most direct route to the buildathon's "transaction-producing on-chain component."

---

## 5. Developer-experience verdict — how reachable is "one agentic testnet tx"?

**Reachable, with a clear winning path, but with EVM-mismatch friction.**

**Easiest path to a testnet tx (recommended for an autonomous agent):**
1. `cargo install cargo-odra` → `cargo odra new` → write/borrow a CEP-18 or flipper contract.
2. Casper Wallet → export PEM → request testnet faucet (once).
3. Set the 3 `.env` vars (key path, CSPR.cloud node RPC, `casper-test`) → `cargo run --features livenet`.
4. Get a `testnet.cspr.live/transaction/<hash>` link = the deliverable. Odra's **llms.txt** means an AI agent can self-serve this whole flow from docs.

**Agentic-narrative paths layered on top:**
- **x402 facilitator** — agent hits 402, signs CEP-18 payment (EIP-712), settles on `casper:casper-test`. Clean "agent transacts to pay for a resource" story.
- **CSPR.click skill** — drop-in for a *frontend* where a connected user signs (TransactionV1 via casper-js-sdk), with CSPR.cloud proxy for data. Installs straight into Claude Code (`npx skills add ...`). Not for headless self-signing.

**Friction for an EVM builder:**
- **Different VM (WASM, not EVM)** and a **purse/URef + session-vs-contract** account model — conceptually new. Account-level native multisig (associated keys + weights + thresholds) is *nicer* than EVM but unfamiliar.
- **Rust-only on-chain.** No Solidity. The advertised "Odra for Solidity developers" bridge tutorial is **404** — a real onboarding gap.
- **Toolchain weight:** Rust + wasm target + wasmstrip + wasm-opt + cmake; "Windows not advised."
- **Gas model** is mostly deterministic (good for agents — predictable cost) but has a dynamic multiplier and a default no-refund rule.
- **Versioning split** (default vs `/1.5.X/` vs `/next/` vs `/condor/`) can confuse — target **`/next/`** (Casper 2.0).
- **Secp256k1 key compatibility** is the one easy on-ramp for EVM devs.

**Bottom line:** A capable AI agent can go from zero to a real Casper testnet transaction in a single session using Odra + its llms.txt + the faucet, with CSPR.cloud as the node/data layer and x402 or the CSPR.click skill as the "agentic" flavor. The biggest tax is the Rust/WASM learning curve and the dead Solidity-migration doc, not tooling availability.

---

## Key URLs

**Casper core docs**
- Docs home: https://docs.casper.network/
- Prerequisites/onboarding: https://docs.casper.network/developers/prerequisites
- Native on-chain code: https://docs.casper.network/developers/writing-onchain-code/getting-started
- CLI deploy/interact: https://docs.casper.network/developers/cli
- SDK index: https://docs.casper.network/developers/dapps/sdk/ (python-sdk, go-sdk, csharp-sdk, script-sdk, client-library-usage)
- Accounts & keys: https://docs.casper.network/concepts/accounts-and-keys
- Gas concepts: https://docs.casper.network/concepts/economics/gas-concepts
- Testnet faucet: https://docs.casper.network/users/testnet-faucet  |  faucet: https://testnet.cspr.live/tools/faucet
- Casper 2.0 / Condor: https://docs.casper.network/pages/condor  + https://docs.casper.network/next/developers
- Testnet peers/RPC: https://testnet.cspr.live/tools/peers

**CSPR.click AI Agent Skill**
- Skill docs: https://docs.cspr.click/documentation/ai-agent-skills
- Raw SKILL.md: https://raw.githubusercontent.com/make-software/csprclick-examples/master/csprclick-skill/SKILL.md
- Skill llms.txt: https://raw.githubusercontent.com/make-software/csprclick-examples/master/csprclick-skill/references/llms.txt
- Install via CLI: `npx skills add https://github.com/make-software/csprclick-examples/tree/master/csprclick-skill`
- Console (appId): https://console.cspr.build

**CSPR.cloud**
- Docs home: https://docs.cspr.cloud/
- x402 facilitator reference: https://docs.cspr.cloud/x402-facilitator-api/reference
- x402 endpoint base: https://x402-facilitator.cspr.cloud  (/supported, /verify, /settle)

**Odra**
- Site: https://odra.dev/  |  Intro: https://odra.dev/docs/intro
- **llms.txt: https://odra.dev/llms.txt** (confirmed, 200, 3.8 KB)
- Install: https://odra.dev/docs/getting-started/installation
- Deploy to Casper testnet: https://odra.dev/docs/tutorials/deploying-on-casper
- Build/deploy/read: https://odra.dev/docs/tutorials/build-deploy-read
- ⚠️ 404: https://odra.dev/docs/tutorials/odra-sol (listed in llms.txt, dead)
