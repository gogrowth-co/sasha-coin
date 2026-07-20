# Casper Network — GitHub / Open-Source Intelligence Sweep

**Domain:** GitHub + developer/open-source surface
**For:** Casper Agentic Buildathon (deadline 2026-06-30)
**Date:** 2026-06-06
**Method:** `gh` CLI (`gh api`, `gh search repos`) for hard numbers; READMEs fetched via gh API. All figures are live from the GitHub API on the date above.

---

## 1. casper-network org (the core)

| Field | Value |
|---|---|
| Org login | `casper-network` |
| Display name | Casper Association |
| URL | https://github.com/casper-network |
| Public repos | **77** |
| Followers | 288 |
| Created | 2021-02-25 |
| Blog | https://casper.network |

**Note on org structure:** The codebase is split across FOUR orgs, not one. `casper-network` (protocol/node), `casper-ecosystem` (SDKs + contract standards, 79 repos), `make-software`/MAKE (tooling, wallet, CSPR.click/cloud, x402, MCP — 38 repos), and `odradev` (Odra Rust contract framework, 30 repos). For a builder, `casper-ecosystem` and `make-software` matter MORE than `casper-network` itself.

### Top casper-network repos by stars

| Stars | Forks | Lang | Last push | Repo |
|---|---|---|---|---|
| 402 | 226 | Rust | 2026-05-26 | **casper-node** (the protocol) |
| 36 | 13 | TeX | 2021-01-16 | highway (consensus paper) — stale |
| 31 | 29 | — | 2026-05-26 | ceps (Casper Enhancement Proposals) |
| 19 | 13 | Rust | 2024-01-10 | datasize-rs |
| 17 | 16 | Python | 2024-12-12 | **casper-python-sdk** |
| 12 | 2 | — | 2021-04-19 | roadmap — stale |
| 10 | 25 | Java | 2025-11-14 | casper-java-sdk |
| 9 | 16 | Rust | 2025-07-30 | casper-node-launcher |
| 9 | 8 | JS | 2022-07-31 | casper-integrations |
| 8 | 8 | — | 2025-04-30 | casper-protocol-release |
| 8 | 7 | TS | 2023-08-31 | casper-contracts-js-clients |
| 8 | 11 | Rust | 2024-03-14 | juliet (networking) |
| 4 | 12 | Rust | 2026-05-13 | casper-sidecar (RPC/event sidecar — ACTIVE) |
| 2 | 6 | Rust | 2025-06-03 | casper-wasmi (WASM interpreter) |
| 1 | 0 | SCSS | 2026-06-05 | docs-redux (docs site — ACTIVE) |
| 1 | 0 | Rust | 2025-02-03 | casper-rust-sdk (NOTE: stale; real Rust SDK lives in casper-ecosystem) |

The long tail (50+ repos) is largely 2021-era hackathon/demo cruft (casper-qr, Picaswap, WCSPR, casper-atomic-algorand) at 0–1 stars and many `[ARCHIVED]`.

### Flagship repo activity (maintenance health)

- **casper-node** — 402★, last commit 2026-05-26. Latest release **v2.2.1 (2026-05-26)**, prior v2.2.0 (2026-03-10), v2.1.2 (2026-01-29). Active, regular cadence.
- **casper-python-sdk** — 17★, last push 2024-12-12. Maintained but slower.
- **casper-java-sdk** — 10★, last push 2025-11-14.
- **casper-rust-sdk** (in casper-network) — 1★, last push 2025-02-03. **Effectively abandoned** — do not use; the live Rust SDK is `casper-ecosystem/casper-rust-wasm-sdk`.

---

## 2. casper-ecosystem org (SDKs + contract standards)

URL: https://github.com/casper-ecosystem · **79 public repos** · 57 followers. This is where the **JS SDK and contract templates** live.

| Stars | Forks | Lang | Last push | Repo | Notes |
|---|---|---|---|---|---|
| 86 | 57 | Rust | 2023-05-26 | casper-nft-cep47 | NFT standard (older) |
| 73 | 59 | TS | 2026-04-29 | **casper-js-sdk** | Most-starred SDK; latest release **5.0.12 (2026-04-29)**. ACTIVE. |
| 27 | 45 | TS | 2025-08-25 | cep18 | Fungible token (ERC-20 equiv) |
| 27 | 29 | TS | 2024-07-24 | signer | Browser signing plugin |
| 11 | 25 | Rust | 2026-01-01 | cep-78-enhanced-nft | Modern NFT standard |
| 9 | 18 | Go | 2024-06-06 | casper-golang-sdk [ARCHIVED] | superseded by make-software/casper-go-sdk |
| 7 | 16 | Rust | 2025-06-30 | counter | Tutorial contract |
| 5 | 24 | Rust | 2026-03-16 | **casper-client-rs** | Rust CLI client. ACTIVE. |
| 4 | 1 | Rust | 2026-06-01 | **casper-rust-wasm-sdk** | Rust/Wasm SDK 2.0 — Rust + TS bindings. The real Rust path. ACTIVE. |
| 4 | 0 | Rust | 2026-04-16 | liquid-staking-contracts | StakedCSPR liquid staking |
| 3 | 9 | Rust | 2025-07-17 | hello-world | Dev onboarding |

**For Sasha (Rust agent):** `casper-ecosystem/casper-rust-wasm-sdk` (Rust/Wasm SDK 2.0, last push 2026-06-01) wraps `casper-client-rs` and exposes typed methods + TS bindings WITHOUT the CLI. This is the canonical SDK for embedding wallet/sign/query/deploy logic into an app. Note its README carries a testnet-only safety warning.

---

## 3. odradev — Odra Rust smart-contract framework

URL: https://github.com/odradev · **30 public repos** · 28 followers · blog https://odra.dev

| Stars | Forks | Lang | Last push | Repo | Notes |
|---|---|---|---|---|---|
| 359 | 51 | — | 2025-09-02 | awesome-zero-knowledge | Curated list, not Casper code (top star count is misleading) |
| **63** | 4 | Rust | 2026-06-03 | **odra** | The framework. MIT. Latest release **2.7.0 (2026-05-26)**, HEAD at v2.7.2 (commit 2026-06-03). 61 open issues. VERY ACTIVE. |
| 18 | 2 | Rust | 2023-02-13 | evm-at-risc0 | ZK experiment |
| 4 | 1 | Rust | 2026-04-03 | cargo-odra | Odra CLI tool. ACTIVE. |
| 4 | 0 | Rust | 2024-02-27 | nysa | Solidity→Casper transpiler |
| 3 | 1 | Rust | 2025-12-09 | casper-contract-schema | Contract ABI/schema |
| 1 | 1 | Rust | 2026-03-19 | casper-trade | Uniswap-V2-style DEX built in Odra (reference dApp) |
| 1 | 1 | JS | 2026-06-03 | styks | Active, undescribed |
| 0 | 0 | Rust | 2026-05-27 | **casper-x402-poc** | Odra-based x402 proof-of-concept (Rust). See §5. |

**llms.txt — CONFIRMED.** `https://odra.dev/llms.txt` returns HTTP 200 with a clean, AI-readable doc index (Getting Started, Basics, Cargo Odra, Odra.toml, Flipper example, etc.). It is auto-generated by a custom Docusaurus plugin (`odradev/odradev.github.io: docusaurus/plugins/llms-txt/index.js`). Odra is the most agent-friendly part of the Casper stack — an LLM coding agent can ingest the full framework docs from one URL.

---

## 4. make-software / MAKE — the buildathon tooling org

URL: https://github.com/make-software · **38 public repos** · 48 followers. Builders of **CSPR.click, CSPR.cloud, Casper Wallet, CSPR.trade**. This org owns the AI-agent tooling that the buildathon expects entrants to use.

| Stars | Lang | Last push | Repo | Notes |
|---|---|---|---|---|
| 29 | Shell | 2026-05-14 | how-to-casper-network | Node operator docs |
| 27 | TS | 2026-06-05 | casper-wallet | The official wallet extension. ACTIVE. |
| 17 | Go | 2026-06-04 | casper-go-sdk | Go SDK (supersedes archived ecosystem one). ACTIVE. |
| 16 | TS | 2024-12-18 | lottery-demo-dapp | CSPR.click demo dApp |
| 14 | C# | 2026-05-11 | casper-net-sdk | .NET SDK |
| 14 | Shell | 2025-05-18 | casper-nctl-docker | Local testnet in Docker |
| 12 | TS | 2026-05-25 | cspr-design | UI component toolkit |
| 10 | PHP | 2025-12-23 | casper-php-sdk | PHP SDK |
| 7 | — | 2026-06-04 | casper-wallet-sdk | Wallet dApp-integration SDK. ACTIVE. |
| 6 | TS | 2026-06-05 | casper-wallet-playground | Wallet integration sandbox. ACTIVE. |
| 3 | — | 2026-06-04 | casper-wallet-core | Wallet business logic. ACTIVE. |
| 2 | Rust | 2026-03-19 | cspr-name-contracts | CSPR.name domains |
| 1 | TS | 2026-04-28 | **cspr-trade-mcp** | THE official MCP server. See §5. |
| 1 | TS | 2026-05-14 | csprclick-nextjs-template | CSPR.click + Next.js SSR starter |
| 1 | TS | 2026-05-13 | csprclick-examples | CSPR.click integration examples |

CSPR.click SDK itself appears distributed via npm/starter templates (csprclick-nextjs-template, csprclick-examples) rather than a single starred core repo. The wallet stack (wallet, wallet-sdk, wallet-core, wallet-playground) is all actively pushed within the last 2 days.

---

## 5. AI-agent-specific tooling (what Sasha would actually integrate)

This is the live, mission-critical layer. Found via `gh search repos`.

### Official MAKE agentic stack

- **`make-software/casper-x402`** — https://github.com/make-software/casper-x402
  Go · Apache-2.0 · 1★ · created 2026-05-12 · last commit 2026-06-04. **The official x402 payment-protocol facilitator for Casper.** Adds Casper as a supported network to the x402 ecosystem so HTTP APIs can require micropayments settled on-chain via **CEP-18 tokens authorized with EIP-712 signatures**. Ships 3 components: Facilitator server (port 4022), demo Resource Server (4021, paid `GET /weather`), and a headless Client. Implements the `exact` scheme on the `casper:*` CAIP-2 family; submits `transfer_with_authorization` deploys. Backed by `casper-ecosystem/casper-eip-712`. **This is the canonical machine-to-machine payment rail for the buildathon.**

- **`make-software/cspr-trade-mcp`** — https://github.com/make-software/cspr-trade-mcp
  TypeScript · 1★ · last push 2026-04-28 (v0.7.0). **The official MCP server for CSPR.trade** (leading Casper DEX). **Public hosted endpoint: `https://mcp.cspr.trade/mcp`** — connect any MCP client (Claude Desktop, Cursor), zero setup. Exposes **24 public tools**: market data (`get_tokens`, `get_quote`, price history), trading (`build_swap`, `build_approve_token`, `submit_transaction`), liquidity (`build_add_liquidity`/`remove`), trade analysis (`estimate_price_impact`, `analyze_trade`), and account/portfolio queries (`get_token_balance`, `get_liquidity_positions`, `get_impermanent_loss`, `get_portfolio_value`). Optional local `--signer` mode adds wallet signing. **This is the single highest-value integration for Sasha — an agent gets full DEX trading + LP + portfolio on Casper through one MCP URL.**

- **`odradev/casper-x402-poc`** — https://github.com/odradev/casper-x402-poc
  Rust · 0★ · last push 2026-05-27. Odra-framework proof-of-concept of the x402 settlement contract path. The on-chain Rust counterpart to MAKE's Go facilitator.

### Community / third-party MCP servers

- **`msanlisavas/casper-mcp`** — https://github.com/msanlisavas/casper-mcp
  C# · 1★ · last push 2026-06-05. MCP server exposing **on-chain READ data** (accounts, blocks, deploys, validators, contracts, tokens, NFTs, transfers, network status). Built on `CSPR.Cloud.Net` + the official ModelContextProtocol SDK. Supports stdio (local) and Streamable HTTP (remote, multi-tenant). Distributed as a .NET global tool (`dotnet tool install -g CasperMcp`) AND a prebuilt Docker image (`ghcr.io/msanlisavas/casper-mcp:latest`). v3.0.0. **Best read-only data MCP** — pairs well with cspr-trade-mcp's write tools.
- **`ASHUTOSH-SWAIN-GIT/casper-mcp`** — Go · 5★ · 2026-05-25. "MCP which helps agents adapt your infra workflow."
- **`Jiu-hong/casper-mcp-python`** — Python · 0★ · 2026-03-02. Adds Casper blockchain knowledge to an MCP server.

### Supporting CSPR.cloud client

- **`msanlisavas/CSPR.Cloud.Net`** — C# · 3★ · 2026-05-26. REST client for CSPR.cloud; the data layer under the C# MCP.

### Agent-wallet / sign / deploy capability summary (for Sasha)

| Capability | Best repo | How |
|---|---|---|
| Create wallet / hold keys | `casper-ecosystem/casper-rust-wasm-sdk` (Rust/TS) or `make-software/casper-wallet-sdk` | SDK keypair + sign |
| Sign + submit a transaction | `cspr-trade-mcp` `submit_transaction` (inline signed JSON) + local `--signer`, or rust-wasm-sdk | MCP tool or SDK deploy |
| Query balances / portfolio | `cspr-trade-mcp` (`get_token_balance`, `get_portfolio_value`) or `msanlisavas/casper-mcp` | MCP read tools |
| Deploy / call a contract | `odradev/odra` + `cargo-odra`, or `casper-client-rs` | Odra build → SDK deploy |
| Machine-to-machine payments | `make-software/casper-x402` (Go facilitator) + `odradev/casper-x402-poc` (Rust contract) | x402 / HTTP 402 + CEP-18 + EIP-712 |
| Pull on-chain data into an agent | `msanlisavas/casper-mcp` (Docker/global tool) | MCP over stdio/HTTP |

---

## 6. Competitive field (other buildathon entrants already on GitHub)

The agentic-payment theme is crowded and moving fast. Repos created since late 2025, mostly pushed in the last 3 days:

| Created | Lang | Repo | Angle |
|---|---|---|---|
| 2026-06-05 | TS | memeshee/agent-pay-guard | Casper agentic app for paid AI-agent tool access |
| 2026-06-05 | C# | msanlisavas/chainleash | "Controlled autonomy the chain enforces" — bonded agent |
| 2026-06-03 | TS | alsaecas/cspr-agentpay-guard | Policy-controlled payment firewall for autonomous agents (budgets, allowlists, escrow, audit) |
| 2026-06-03 | Rust | AiFinPay/aifinpay-casper | AI agent settlement layer |
| 2026-06-02 | JS | qanzhi111/x402-api-casper | Casper x402 crypto API for AI-agent payments |
| 2025-12-16 | Rust | Adarsh-Dhar/casper-x402 | Early independent x402 impl |

**Read:** The dominant entry pattern is "x402 / HTTP 402 payment-firewall for autonomous agents" (policy + escrow + budget + Casper settlement). At least 4–5 teams are already on this exact thesis. The `cspr-agentpay-guard` README explicitly names the buildathon's expected stack: **Odra smart contracts + CSPR.click + CSPR.cloud + AI agents + MCPs**, per the kickoff workshop. Sasha should either differentiate from the payment-firewall pack or execute it visibly better (real testnet tx, polished demo) — a generic x402 guard will blend into the field.

---

## 7. Tech-stack summary

- **Core language: Rust** (casper-node, Odra, client-rs, rust-wasm-sdk). Contracts compile to **WASM**. This aligns directly with Sasha's existing Rust/WASM-adjacent on-chain tooling.
- **Smart contracts:** Odra framework (Rust, MIT, v2.7.2, llms.txt-documented) is the recommended path; raw Casper contracts also Rust→WASM. Token standards CEP-18 (fungible) and CEP-78 (NFT).
- **SDKs (multi-language):** JS/TS (`casper-js-sdk` 5.0.12, most active), Rust/Wasm (`casper-rust-wasm-sdk`), Go (`make-software/casper-go-sdk`), Python, Java, .NET, PHP.
- **Payments:** x402 protocol (CEP-18 + EIP-712 signatures, `transfer_with_authorization`), official Go facilitator + Odra Rust contract PoC.
- **Agent interface:** MCP is first-class — official hosted `cspr-trade-mcp` (24 tools) plus community read-data MCPs. CSPR.click (auth/wallet UX) + CSPR.cloud (data API) round out the front-end/data layers.

---

## 8. Verdict — developer activity health

**HEALTHY and actively building, with a fresh, fast-moving agentic layer.**

- **Protocol:** Maintained. casper-node 402★, release v2.2.1 on 2026-05-26, commits within the last 2 weeks. Not abandoned, steady cadence.
- **Tooling/SDKs:** The make-software and casper-ecosystem orgs are the live centers of gravity — wallet, wallet-sdk, casper-go-sdk, cspr-design, casper-js-sdk, casper-rust-wasm-sdk all pushed within the last week. This is real, ongoing engineering.
- **Odra:** Genuinely active (v2.7.2 commit 2026-06-03, 61 open issues = engaged dev loop) and uniquely agent-friendly via llms.txt.
- **Agentic stack:** Brand new (most repos created/updated May–June 2026) but officially backed — MAKE shipped both an x402 facilitator and a hosted MCP server. The infrastructure Sasha needs to create a wallet, sign, query, and pay on Casper EXISTS and is current.
- **Caveats:** (1) Star counts are LOW across the board — casper-x402 1★, cspr-trade-mcp 1★, Odra 63★ — meaning small mindshare and thin community testing; expect rough edges and sparse Stack Overflow coverage. (2) The org sprawl (4 orgs) and stale lookalikes (casper-network/casper-rust-sdk is dead; use casper-ecosystem's rust-wasm-sdk) are real footguns. (3) The buildathon's headline theme (x402 agent payment firewalls) is already crowded with 4–5 competitors.

**Bottom line for Sasha:** The integration surface is ready and Rust/WASM-native (matches her stack). The single best entry point is the hosted **`https://mcp.cspr.trade/mcp`** MCP server (24 DEX/LP/portfolio tools, zero setup) plus the **casper-x402** rail for autonomous payments. Differentiation, not feasibility, is the risk.
