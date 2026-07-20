# Casper Buildathon — Phase 0 Spike Result

**Date:** 2026-06-08
**Verdict: 🟢 GO** — proceed to Phase 1 (SPINE).
**Plan:** `docs/superpowers/plans/2026-06-07-casper-buildathon-implementation.md` · **Spec:** `docs/superpowers/specs/2026-06-06-casper-buildathon-design.md`

## GO bar (Codex-tightened): TWO live `casper-test` tx hashes — BOTH LANDED ✅

| GO leg | Tx hash | On-chain status |
|---|---|---|
| **0.4b — public contract DEPLOY** (Cep18X402 CEP-18) | `dc2d87a1830942799a7e2408ea3491ba18ca601a198ddc38f07ab96726a509c3` | executed ✅ |
| **0.4c — real x402 `/settle`** (`transfer_with_authorization`) | `32cb5e5f8aae10c32157dcfa00aa3595adba53a06ac495188fa1b2902cf13924` | executed, `error_message: null`, block `f06a1839…`, cost 7 CSPR ✅ |

Explorer: `https://testnet.cspr.live/transaction/<hash>`. Contract package: `166e0ec88a3d1b3caec06edb723c841bac4d1182598d008aabfc0de99c81b9b8`.

## Parallel pre-checks (de-risking, not GO)

- **0.2 OdraVM** (`cargo odra test`): PASS (`flipper::tests::flipping ok`).
- **0.3 CasperVM** (`cargo odra test -b casper`): PASS — WASM executes on the genuine Casper engine (after installing `wasm-opt`/`wasm-strip` + adding wasm32 to the pinned nightly).
- **0.4a x402 `/verify`**: PASS — facilitator returned `valid:true` for a **real headless ed25519 EIP-712 `TransferWithAuthorization`** signature. This was the pre-mortem's #1 footgun (headless EIP-712 on Casper); now eliminated.

## Confirmed headless signing path

`make-software/casper-x402` Go facilitator + resource server + client (built locally; Go 1.25.11 installed prebuilt at `~/.local/go`, Gabriel-approved). The agent signs the EIP-712 digest via the Casper Go SDK keypair (ed25519). Client builds the payload, facilitator verifies + submits a `TransactionV1` calling the CEP-18 `transfer_with_authorization` (facilitator key pays gas; authorization moves CEP-18 from payer to payee).

## What broke and how it was fixed (the load-bearing debugging)

1. **`/tmp` is wiped between sessions** → relocated the whole spike to durable `~/dev/casper-spike` (resume point: `~/dev/casper-spike/SPIKE-STATE.md`).
2. **wasm32 target missing on the pinned `nightly-2026-01-01`** (the scaffolds pin nightly; wasm32 was only on stable) → `rustup target add wasm32-unknown-unknown --toolchain nightly-2026-01-01`.
3. **`wasm-opt`/`wasm-strip` not installed** → prebuilt binaryen 130 (`~/.local/binaryen`) + wabt 1.0.41 (`~/.local/bin`), no sudo.
4. **odra livenet deploy required `ODRA_CASPER_LIVENET_EVENTS_URL`** (SSE wait) → testnet SSE endpoint `https://node.testnet.casper.network/events` (200, `text/event-stream`).
5. **First settle reverted `User error 37003 = cep3009::InvalidSignature`** even though off-chain `/verify` passed. Root cause: the on-chain EIP-712 **domain name is `self.token.name()`** (the token's runtime `name` field = the deployer's init `name` = **"Casper X402 Token"**), NOT the `TOKEN_NAME` constant from a test helper. Off-chain `/verify` passed because client+facilitator both used the (wrong) configured name and agreed with each other. **Fix: set the resource server's `ASSET_NAME = "Casper X402 Token"`.** Re-ran → settle executed. Funding key cost ~11 CSPR across both attempts (settle gas ~7 CSPR each; cheap to iterate).

## EIP-712 compatibility finding (matters for Phase 1)

The `make-software/casper-x402` **Go** facilitator IS wire-compatible end-to-end with the `odradev/casper-x402-poc` **Rust/Odra** CEP-18 contract, once the off-chain `ASSET_NAME` is set to the token's runtime `name`. Domain = `{name, version:"1", chain_name, contract_package_hash(=self_address)}`; struct = `TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)`. `chain_name` must be the full CAIP id `casper:casper-test` on all three sides (client `requirements.Network`, facilitator `GetNetworkConfig`→full id, contract `chain_id` init arg). This is the viable SPINE stack: Go facilitator + poc-derived Odra CEP-18.

## No self-dealing (scope note)

The spike settle was payer→payee on two keys I control — a **mechanism proof** that the live `/settle` path produces a real tx hash. It is NOT the EXPOSE demo. The genuine external counterparty remains a **Phase 2 (STRETCH 1)** requirement per spec §6.

## Toolchain installed this spike (durable, in `$HOME`, no sudo)

Go 1.25.11 (`~/.local/go`) · binaryen `wasm-opt` 130 (`~/.local/binaryen/bin`) · wabt `wasm-strip` 1.0.41 (`~/.local/bin`) · wasm32 on `nightly-2026-01-01`. (Rust 1.96, cargo-odra 0.1.7, casper-client 5.0.1, cmake 4.3.2 already present.)

## Funding

Throwaway testnet key `01f50785…ccd064` (ed25519). Faucet funded Gabriel's wallet account `0203efc6…9c012` with 5000 CSPR; Gabriel transferred 4000 CSPR to the deploy key (the faucet only funds the connected wallet account; a transfer to the on-disk signer was cleaner than exporting the wallet key). ~3542 CSPR remaining.

## Decision

**GO.** All four pre-checks green; both mandatory live `casper-test` tx hashes confirmed executed on-chain. Proceed to **Phase 1 — SPINE** (attestation contract + agent loop + one live `402→settle` in a fresh public repo). The Go-facilitator + Odra-CEP-18 stack and the headless signing path are validated hands-on (the pre-mortem's "don't write code against unvalidated APIs" gate is satisfied).
