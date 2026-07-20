# Casper x402 Kit — Deep Review & Improvement Plan
### 2026-07-05 · Fable 5 · Initiative 4 of 5

## Current state (verified)

| Component | Status |
|---|---|
| Repo | `gogrowth-co/sasha-x402-kit`, public, MIT, CI = secret-scan (gitleaks) ✓ |
| AgentAttest contract | Clean append-only Odra module — no admin, no upgrade hook, checked counter ✓ (audit L-1) |
| Agent loop | `agent/loop.go` — PAY (x402 402→settle) → ACT → ATTEST, bounded timeouts, strict signal validation. Well-built. |
| Track record | 10 live ATTEST cycles on testnet (manual runs; no automation exists) |
| Buildathon | Submitted Jun 30. **Open gate: demo video not on YouTube** — writeup still has `[UPLOAD … → paste URL here]` and two unchecked boxes |
| Repo hygiene | Untracked: `demo/`, `assets/logo-480.jpg`, `.memsearch/` |

**What works well:** this is the cleanest codebase of the five — proper chain-agnostic core, strict input validation, bounded HTTP clients, secret-scan CI, honest testnet-only posture. The clean-room Odra contract passed audit with zero material findings.

## Gaps

1. **The submission is incomplete where it's cheapest to finish.** The demo video exists (`demo_2026-06-16_09-31-12_voiced.mp4`), the DoraHacks writeup is done, but the YouTube URL was never pasted. If judging hasn't closed, this is minutes of work gating weeks of build.
2. **The ACT step is a weather signal.** The loop buys `city/weather/temperature` — a placeholder. Sasha has real signals (LP risk packets, gas checks, THS scores) already productized on CROO. The kit's story ("agent pays for a signal, acts, attests") would be strictly stronger buying one of Sasha's own signals.
3. **No recurring runtime.** The 10 cycles were hand-run. For a "autonomous agent" narrative, one cron on the VPS running a weekly cycle would keep the testnet track record growing at zero marginal effort.
4. **Odra package upgradeability unverified** (audit L-1 note): confirm the deployed package version is locked so "no upgrade backdoor" is provable, not just source-implied.
5. **EVM adapter is roadmap vapor.** `adapters/evm/` (Base Sepolia PROOF) is documented but unbuilt. Either build the thin slice or trim the claim.

## Plan

**P0 — close the submission (30 min, do first)**
- Upload the voiced MP4 to Sasha's YouTube (@SashaCoin, `--profile sasha` auth per memory), paste the URL in the DoraHacks demo field, tick the two writeup checkboxes. Verify BUID pages render (no markdown tables — known DoraHacks issue).
- Commit or gitignore the untracked `demo/` and `assets/` files; the public repo shouldn't have drift.

**P1 — strengthen the artifact (half a day, high leverage for reuse)**
- Swap the weather signal for a Sasha-native one: stand up a tiny x402-paywalled endpoint serving the LP risk packet JSON (the `risk-packet.ts` engine already produces it deterministically). Now the loop demos *Sasha buying Sasha's own risk signal and attesting the decision* — one story that ties the Casper kit to the CROO Risk Desk and the LP book. This is also the natural cross-initiative composability proof.
- Add the weekly attest cron on the VPS (guard: skip if key file absent; always exit 0). Ten manual cycles become a growing autonomous series.
- Verify the deployed Odra package version is locked; state it in README's security section with the query to reproduce.

**P2 — only if the ecosystem bites**
- EVM adapter thin slice on Base Sepolia (the core interface is already chain-neutral; casper_adapter.go is only 162 lines — an EVM twin is ~a day). Do this only if Casper/x402 devrel engagement or CROO cross-chain needs materialize; otherwise trim the roadmap claim to "interface ready, adapter on demand."
- Content: the kit + growing attest series is a strong Sasha thread ("I pay for my own signals with x402 and notarize every decision on Casper"). Route to marketing/ per workspace boundary.

**KPI:** submission 100% complete this week; attest series growing weekly without human touch; README claims all reproducible on-chain.
