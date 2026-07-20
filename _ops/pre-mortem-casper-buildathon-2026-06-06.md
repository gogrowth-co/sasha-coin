# Pre-mortem · Casper Agentic Buildathon — "x402 Agent Commerce Kit" (Concept 1 hardened)

**Plan reviewed:** The sharpened chain-agnostic plan (SettlementAdapter core + Casper flagship adapter; spine = identity/attestation + x402-pay + verifiable feed; stretch = live CSPR.trade testnet position; Path A vote / Path B jury) layered on `docs/casper-buildathon-build-spec.md` + `research/casper-agentic-buildathon-brief-2026-06-02.md` + `campaigns/casper-buildathon/research/01-05`.
**Scope:** ~24 days to submission deadline (today 2026-06-06 → June 30, 2026). Final round Jul 6-19 if advancing.
**Reviewer:** Claude (Opus 4.8, 1M) — pre-mortem skill. Plan largely shaped by Claude → per hard rule #5, reviewed MORE adversarially.
**Date:** 2026-06-06

---

## Verified ground-truth (checked live before writing, not assumed)

- **No Rust toolchain exists locally.** `cargo` and `rustup` are NOT on PATH in this workspace. The build environment for the ONLY deliverable language (Rust/WASM) does not exist yet. Phase 0 starts from zero, not from "install one thing."
- **`contracts/` is 100% Solidity** (`LiquidityHelper.sol`, `SashaAgentLog.sol`, `SashaDynamicFeeHook.sol`, `SashaOracle.sol`). Zero Rust/Odra prior art to port from. "Port ERC-8004 → Odra" is a rewrite, not a port.
- **Content engine is verifiably dead AND lossy, not just stalled.** Last `state/posted-log.json` entry is **2026-05-27 (10 days stale)**, and that final entry has `status: deleted`, `delete_reason: "Gemini topic drift ... + trailing quote artifact in generated text."` So even when the engine wakes, it produces drift/artifacts that get deleted. Path A (community votes) rests on this.
- **No credential files are git-tracked** (good), but `state/` holds 20 JSON files with live addresses + position data (`lp-positions.json`, `capital-pool.json`, `xlayer-deployment.json`, `posted-log.json` with full tweet history). A public-repo flip that includes `state/` leaks the wallet map and the agent's full posting history.
- **Competitive field confirmed converging:** 6 BUIDLs + 4-5 GitHub teams all on the x402-agent-payment thesis; Phoenix Zero claims live-since-March + 206K datapoints (a real front-runner on "Working Contracts").
- **Tooling maturity confirmed low:** casper-x402 1★, cspr-trade-mcp 1★, odra 63★, casper-rust-wasm-sdk 4★, odradev/casper-x402-poc 0★ (last push 2026-05-27). The two repos the plan names as starting points are pre-release-grade.

---

## Hidden assumptions (ordered by fragility — most fragile first)

| # | Assumption | Reality check |
|---|---|---|
| A1 | A Rust-novice AI agent can ship a working Odra attestation contract + x402 both-sides + live CSPR.trade testnet position + real external counterparty + demo video + clean public repo in ~22 post-spike days. | Zero local Rust toolchain today. New VM (WASM), new account model (purses/URefs, session-vs-contract), Rust borrow-checker friction, 1★ tooling with sparse Stack Overflow coverage, the "Odra for Solidity devs" tutorial is **404**. This is 5+ net-new subsystems on an unfamiliar non-EVM L1. The single most likely failure is "spike passes, full build doesn't fit." |
| A2 | The "real external counterparty" for the x402 demo will materialize (another team / public endpoint paying Sasha). | Field is 6 BUIDLs, 1 formal team, top-down community with near-zero builder-to-builder chatter (research 04 §4). No coordination channel identified. There is no named partner, no fallback endpoint, no recruitment plan. Default outcome: it silently degrades to Sasha paying herself, which the prior council explicitly forbade. |
| A3 | Path A is a real upside lever: top-3 CSPR.fans votes → skip judging. | CSPR.fans mechanism is **UNCONFIRMED** — research 04 + 01 both flag it: nobody has confirmed "Season 5 fan-points / 1.5M CSPR leaderboard" is the SAME thing as "top-3 votes skip judging." @CSPRfans has 2 followers and is dead. The vote path may not exist as imagined. |
| A4 | We can drive a vote campaign through Sasha's audience. | The posting engine is dead AND lossy (deletes its own output for topic drift). Path A depends on an engine that, last time it ran, posted a drifted reply that had to be deleted. Either fix the engine (out of scope, predates buildathon) or hand-drive from marketing/ (real labor cost, never budgeted). |
| A5 | "Foundation-grade, chain-agnostic SettlementAdapter" is worth building under a 24-day deadline. | The hackathon only ever ships ONE concrete adapter (Casper). A chain-agnostic abstraction with one implementation is pure speculative surface area — it adds an interface, a core/adapter split, and "two-sided x402" framing that balloon the build with zero scoring benefit. Judging criteria reward a working Casper contract, not an architecture diagram. This is the scope-creep vector. |
| A6 | The 48h spike is a sufficient go/no-go gate for the FULL build. | The spike validates "can deploy ONE trivial Odra contract + land one signed tx." It validates ~10% of the surface. It does NOT validate: x402 both-sides, EIP-712 signing on Casper from headless code, cspr-trade-mcp write path with `--signer`, contract storage/events for attestation, demo reproducibility, or counterparty. A green spike creates false confidence. |
| A7 | The hosted `mcp.cspr.trade/mcp` (24 tools) gives us a "live CSPR.trade position" cheaply. | The hosted endpoint is read + build-tx; **signing/submitting** needs local `--signer` mode (key in process) or rust-wasm-sdk. Headless autonomous signing on Casper is the exact gap research 03 §2.4 flags: CSPR.click skill is browser/human-in-loop (WRONG). The "act" leg is harder than the "pay" or "attest" legs and is the stretch — but the plan treats it as nearly-free upside. |
| A8 | Faucet + testnet are reliable enough to iterate against for 3 weeks. | Faucet is **once per account** (drip amount undocumented). Burn the key / corrupt the account / run dry mid-build → new account → new faucet request → new wallet plumbing. Testnet uptime on a low-mindshare chain is unverified. No faucet-exhaustion or testnet-outage contingency in the plan. |
| A9 | Flipping to a clean public repo is a contained task ("secret scan before publishing"). | The working tree co-mingles runtime code (must be public), `state/*.json` (addresses + full posting history — must NOT be public), and the deploy/marketing control surface. The plan says "cannot just flip it" but offers no concrete fresh-repo-with-allowlist procedure. One stray `git add .` or a state file with an address leaks. Secret-guard hook caught me twice just *listing filenames* — the leak surface is real and the tooling is twitchy. |
| A10 | Judging rewards Sasha's "real project with socials" edge enough to offset weaker Casper engineering. | That criterion is 1 of 8 (and "Long-Term Launch Plans" is partly about deployment plans, not just existing socials). The other 7 heavily favor Technical Execution + Working Contracts + Innovation — exactly where Phoenix Zero (claimed-live oracle, 206K datapoints) and AgentPay (full x402 marketplace) out-engineer a minimal entry. The edge is real but over-weighted in our self-assessment. |
| A11 | The 24-day clock is the real clock. | Submission is June 30 but **"all code must be original and newly developed for the Buildathon"** (eligibility, research 01 §Eligibility). Sasha's existing LP/treasury/ERC-8004 stack CANNOT be submitted as-is — it must be reimplemented for Casper. This shrinks reusable surface and raises plagiarism-DQ risk if we lean on existing repos. |
| A12 | x402 "credits" ($100K) are a meaningful part of the prize. | $100K of $150K is x402 ecosystem credits — usable only to pay for x402 transactions on Casper. For an agent with no ongoing Casper product post-hackathon, these are largely unusable. The real cash at stake is $30K split across winners. A "win" that is mostly credits is a hollow win (the (g) failure mode). |
| A13 | Gabriel's approval is not in the critical path because it's testnet. | True for fund movement, but Gabriel must approve: DoraHacks registration, public-repo publication (irreversible disclosure), demo video, and any production-key adjacency. Each is a synchronous human gate. With a 24-day clock and a single operator who writes no code, approval latency on the repo-publish gate alone can eat the final 48h. |
| A14 | A demo video can be produced late, in marketing/, after the build works. | The demo must show a *reproducible* autonomous flow (pay → act → attest → expose) end-to-end. If the flow is flaky on testnet (A8) or self-dealing (A2), the video either can't be shot or misrepresents. Video is downstream of every technical risk and has the least slack. It is treated as a Phase-4 afterthought. |

---

## Most-likely failure cascades

| Rank | Failure | Probability | Impact | Why it'll happen | First-warning signal |
|---|---|---|---|---|---|
| 1 | **Spike passes, full build doesn't fit in 22 days** → submit a thin entry or miss the bar. | High | High | A1 + A6. 5+ net-new subsystems on a non-EVM chain by a Rust-novice agent with no toolchain today; spike validates ~10%. | Day-7 (Jun 13) checkpoint: if the attestation contract isn't deploying autonomously each cycle yet, the full scope is already at risk. |
| 2 | **Real external counterparty never materializes; demo silently self-deals.** | High | High | A2. No partner named, no fallback, no recruitment channel, top-down community. Path of least resistance = Sasha pays Sasha. | No counterparty confirmed by Day-10 (Jun 16); demo script starts saying "Sasha's buyer agent." |
| 3 | **Scope creep from "foundation-grade chain-agnostic" eats the runway.** | High | High | A5. Adapter interface + core/adapter split + two-sided x402 = speculative surface with zero scoring benefit, built under deadline pressure. | First commit that adds `SettlementAdapter` abstraction before a single Casper tx lands. |
| 4 | **24 days spent and we don't place** because Phoenix Zero / AgentPay out-engineer us on the converged theme. | Med-High | High | A10 + research 01/02: field already on this exact thesis, one front-runner claims live since March. We'd be the 5th-best x402 agent. | Casper amplifies a competitor (it already featured Phoenix Zero, Jun 3); our entry reads as "me too." |
| 5 | **Path A is a mirage** (CSPR.fans mechanism ≠ "votes skip judging") AND/OR no vote turnout (dead engine). | Med-High | Med-High | A3 + A4. Mechanism unconfirmed; @CSPRfans dead (2 followers); posting engine 10 days stale and deletes its own output. | We can't find a single doc confirming the vote→finals link; or the engine still won't complete a post in a test run. |
| 6 | **Secret/state leak on public-repo flip.** | Medium | Very High | A9. Tree co-mingles `state/*.json` (addresses, posting history) with code-to-publish; no concrete allowlist procedure; deadline-rushed publish. | A `git status` on the new public repo shows any `state/` file, address, or `.pem` staged. (Irreversible once pushed — assume scraped instantly.) |
| 7 | **Testnet/tooling instability eats days** (faucet exhausted, 1★ SDK bug, MCP write path broken, EIP-712-on-Casper signing fails headless). | Medium | High | A7 + A8 + low star counts = rough edges + sparse support. Headless signing is the documented gap. | First multi-hour block on a tooling bug with no Stack Overflow hit; faucet returns "already claimed." |
| 8 | **Hollow win:** place but prize is mostly unusable x402 credits, content engine still dead, no durable Casper presence. | Medium | Medium | A12. $100K of $150K = credits; "Long-Term Impact" criterion implies ongoing Casper presence we have no plan to maintain. | Post-submission, no answer to "what runs on Casper after June 30?" |
| 9 | **Plagiarism/originality DQ** for reusing existing Sasha stack code. | Low-Med | Very High | A11. Eligibility requires original-new code; tempting to lift ERC-8004 module / LP logic. | Any Casper file is a copy-paste of an existing `.sol`/`.js` with renamed symbols. |
| 10 | **Approval-gate latency** (repo publish, video, registration) compresses the final 48h to zero. | Medium | Med-High | A13. Single non-coding operator; irreversible publish gate; no pre-agreed approval SLA. | Submission-ready build sitting unpublished waiting on a Gabriel decision within 48h of deadline. |
| 11 | **The spike itself fails** (Odra install / faucet / first tx) and the fallback ("June-2 minimal-real") is the SAME Rust build we couldn't do. | Low-Med | High | The stated fallback is not actually lower-risk — minimal-real ALSO needs an Odra contract + testnet tx. There is no true non-Rust fallback. | 48h spike clock expires with no `testnet.cspr.live/transaction/<hash>` link. |
| 12 | **Compound:** flaky testnet (7) forces last-minute self-dealing demo (2) on a thin build (1), shot in a rushed video (A14), published from a tree that leaks state (6). | Medium | Very High | All the above correlate under deadline pressure — they don't fail independently, they fail together in the final week. | Two or more of the Day-7/Day-10 warning signals fire at once. |

---

## Detection / Mitigation / Recovery (top 10)

| Failure | Detection (how we know first) | Mitigation (makes it less likely) | Recovery (after it happens) |
|---|---|---|---|
| 1. Full build doesn't fit | Hard Day-7 (Jun 13) + Day-14 (Jun 20) gates with binary pass criteria (see Plan v2). | De-scope to the SPINE only on Day 0: attestation contract + ONE x402-pay leg. Make stretch (CSPR.trade position) explicitly droppable. Timebox each subsystem. | Drop stretch + chain-agnostic abstraction; ship spine-only with honest README. Spine alone clears the Builder Merit bar (working testnet tx). |
| 2. No external counterparty / self-deal | No named counterparty by Day-10. | Recruit a counterparty in week 1: post the paid endpoint publicly + DM 1-2 other BUIDL teams (AiFinPay, credmesh) for a reciprocal x402 call; or stand up a 2nd independent agent on a separate key/host with its own funded account as a documented "second party." | If none, REFRAME honestly: demo is "Sasha's data desk + an independent buyer agent I run" and disclose it. Do NOT claim external. A disclosed two-agent demo beats a faked external one. |
| 3. Chain-agnostic scope creep | First abstraction commit before first Casper tx. | DELETE "foundation-grade chain-agnostic" from the hackathon scope. Build Casper-direct. Keep the adapter as a 1-paragraph "future work" note in the README only. | Rip out the interface; inline the Casper calls. Architecture is a finals/post-hackathon concern, not a qualification one. |
| 4. Out-engineered, don't place | Casper amplifies a competitor; our angle reads me-too. | Differentiate on the ONE thing competitors lack: a **real, persona-owned, publicly-verifiable position** + an autonomous agent with a live audience — not another payment-firewall. Lead the README/demo with the verifiable-yield-feed + identity story, not "x402 agent." | Pivot the pitch (not the code) toward the persona/RWA-referent angle in the writeup; lean Path A only if A3 confirms it's real. |
| 5. Path A mirage / no turnout | Can't find a doc linking CSPR.fans votes→finals by Day-3; engine fails a test post. | **Day-1 action: confirm the CSPR.fans mechanism** (ask Casper TG/Discord directly; read DoraHacks rules). Treat Path B (jury merit) as the ONLY plan; Path A is a free option only if confirmed. Hand-drive any vote content from marketing/ — do NOT depend on the dead engine. | Build entirely to Path B. If votes turn out to matter and are confirmed, run a manual marketing/ campaign; never gate the entry on the engine. |
| 6. Secret/state leak | Pre-push hook + `git status` review showing any `state/`, address, or key file staged. | **Fresh, empty public repo** built by COPYING an explicit allowlist (code + README + Casper module ONLY), never by flipping the existing tree. Add `state/`, `.env*`, `*.pem`, `Clawlett/` to that repo's `.gitignore` first. Run `gitleaks`/secret scan on the staged tree BEFORE first commit. | Assume any leaked key is compromised → rotate immediately (agent EOA, any exposed API key). Delete repo, recreate clean. (Disclosure is irreversible; rotation is the only recovery.) |
| 7. Testnet/tooling eats days | First multi-hour block with no community answer; faucet "already claimed." | Phase 0 spike de-risks the riskiest path (headless EIP-712 signing) FIRST, not last. Pin SDK versions. Pre-fund 2-3 testnet accounts in week 1 (faucet is once-per-account → create spares early). Keep a local NCTL Docker testnet (`make-software/casper-nctl-docker`) as a fallback to public-testnet outages. | Switch to the spare funded account; fall back to NCTL local net for iteration, deploy to public testnet only for the final captured tx hashes. |
| 8. Hollow win | No answer to "what runs on Casper after June 30?" | Define a 1-line durable plan: Sasha keeps the attestation contract live + posts her Casper verified-yield feed weekly. Make the x402 credits useful by committing to keep paying for one real feed. | Accept it as a narrative/credibility win + content; don't over-invest expecting usable cash beyond the $30K cash split. |
| 9. Plagiarism DQ | Any Casper file is a renamed copy of existing `.sol`/`.js`. | Write all Casper code fresh in Rust/Odra. Cite inspiration (ERC-8004, the LP logic) as design references in the README, implement clean-room. | If flagged, point to commit history showing original authorship during the build window; remove any lifted snippet. |
| 10. Approval-gate latency | Build ready but unpublished, waiting on Gabriel within 48h of deadline. | Pre-agree the approval gates + SLA NOW: (a) DoraHacks registration, (b) repo-publish go, (c) video go. Get the repo-publish allowlist pre-approved so the final push is mechanical. | Submit the build + repo at the earliest viable point (aim Jun 26, not Jun 30); use slack for fixes. Never let publish be the last action. |

---

## Big architectural questions (must answer BEFORE proceeding)

1. **Is the CSPR.fans vote path real and equal to "top-3 skip judging"?** (A3) — Until confirmed via Casper TG/Discord + DoraHacks rules, Path A does not exist for planning purposes and we build 100% to Path B. This is a Day-1 blocker, answerable by a question, not a build.
2. **What is the SPINE we are certain we can ship, and what is explicitly droppable?** Decide on Day 0: is the guaranteed deliverable (a) attestation contract + x402-pay only, or (b) does it include the CSPR.trade position? The plan calls the position "stretch" but the framing still leans on it. Lock the minimal winnable scope and put a line through everything else.
3. **Where does the demo's second party come from, concretely?** (A2) — Named external team, a public endpoint, or a disclosed self-run second agent on a separate key/host? This must be a decision now, not a Phase-4 discovery. There is no acceptable "TBD."
4. **Do we build chain-agnostic at all?** (A5) — Recommend NO for the qualification round. Confirm we are cutting the SettlementAdapter abstraction from the build and keeping it as README "future work" only.
5. **What is the exact public-repo procedure?** (A9/#6) — Fresh repo + allowlist copy, or sanitized flip? Define the allowlist and the secret-scan step before any Casper code is written, so it's a rail, not a scramble.
6. **What is the headless signing path we commit to?** (A7) — casper-js-sdk TransactionV1 in-process key, rust-wasm-sdk, or cspr-trade-mcp `--signer`? The spike must validate the chosen one specifically (CSPR.click skill is out — browser/human-in-loop).

---

## What the plan should have but doesn't

| Add | Where | Why |
|---|---|---|
| Day-1 CSPR.fans mechanism confirmation (a question, not code) | Phase 0, before spike | Closes #5; decides whether Path A exists at all. |
| Hard Day-7 (Jun 13) and Day-14 (Jun 20) go/no-go gates with binary criteria | New Phase 1.5 / 2.5 | Closes #1; spike-only gating gives false confidence (A6). |
| Explicit "SPINE vs droppable" scope lock on Day 0 | Phase 0 | Closes #1/#3; prevents stretch + abstraction from eating runway. |
| Counterparty decision + recruitment in week 1 | Phase 1 | Closes #2; no "real external" appears by accident. |
| Fresh-repo allowlist + pre-commit secret scan defined before coding | Phase 0 | Closes #6; the leak surface is real (state/ + history) and the publish is irreversible. |
| Spare funded testnet accounts (faucet is once-per-account) + NCTL local fallback | Phase 0 | Closes #7/#8; faucet exhaustion has no current contingency. |
| Spike validates the HARDEST leg (headless EIP-712 signing) first | Phase 0 | Closes #7; current spike validates the trivial leg and over-credits feasibility. |
| Cut the chain-agnostic abstraction from qualification scope | Phase 0 | Closes #3; one-implementation abstraction = pure cost under a deadline. |
| Pre-agreed approval SLA for registration / publish / video | Phase 0 | Closes #10; single non-coding operator is the silent critical-path risk. |
| Originality discipline: clean-room Rust, cite-don't-copy | All phases | Closes #9; eligibility requires new code; existing stack is `.sol`/`.js`. |
| "What runs on Casper after June 30" one-liner | Phase 3 | Closes #8; "Long-Term Impact" criterion + avoids a credits-only hollow win. |
| Earliest-viable submission target (aim Jun 26) | Phase 4 | Closes #10/#14; demo + publish need slack, not the deadline. |

---

## Plan v2 outline (mitigations as first-class steps)

**Decision frame:** Build ONLY to **Path B (jury merit)**. Treat Path A as a free option that activates only if Q1 confirms the vote→finals link. Cut chain-agnostic from scope. Ship the **SPINE**; make everything else explicitly droppable.

**Phase 0 — De-risk gate (48-72h, Jun 6-9). Answers questions + validates the HARDEST leg.**
- Q1: Confirm CSPR.fans mechanism via Casper TG/Discord + DoraHacks rules. Record verdict. (Question, not code.)
- Decide SPINE = attestation contract + ONE x402-pay leg. Mark CSPR.trade position + chain-agnostic abstraction as CUT/optional, in writing.
- Decide the headless signing path (Q6) and the counterparty source (Q3).
- Stand up Rust toolchain in a sandbox (rustup + cargo-odra + wasm target). Create 2-3 testnet accounts; faucet each (once-per-account); stand up NCTL local net.
- Define the fresh-public-repo allowlist + secret-scan step (no code published yet).
- **Spike:** deploy ONE trivial Odra contract AND land one headless-signed x402-style tx on testnet via the chosen signing path. Capture address + hashes.
- **GATE:** spike green AND signing path proven → proceed. Spike red → do NOT fall back to "minimal-real" (same Rust build); reassess go/no-go with Gabriel — possibly narrative-only entry.

**Phase 1 — Spine, the pay + attest legs (Jun 9-13).**
- Odra attestation contract: one entry per Sasha decision cycle (clean-room, original). Autonomous headless call each cycle on testnet.
- x402-pay leg: Sasha hits a 402, signs CEP-18/EIP-712 payment, settles on `casper:casper-test`, uses the data to drive the attestation.
- Recruit/commit the counterparty (public endpoint + DM 1-2 BUIDL teams, or stand up the disclosed second agent).
- **DAY-7 GATE (Jun 13):** attestation contract deploying + called autonomously each cycle? If NO → freeze scope to spine, drop everything stretch.

**Phase 2 — Verifiable feed + (optional) position (Jun 13-20).**
- Expose Sasha's attested state as an x402-payable feed (the verifiable-yield-feed differentiator).
- ONLY IF Day-7 gate green AND time allows: the CSPR.trade testnet position (the "act" leg) via cspr-trade-mcp `--signer`.
- **DAY-14 GATE (Jun 20):** spine end-to-end reproducible? If shaky → cut position, lock spine, move to hardening.

**Phase 3 — Surface, repo, durability (Jun 20-25).**
- Casper panel on the dashboard (testnet address, tx hashes, last attestation).
- **Build the FRESH public repo from the allowlist** (not a flip). Run secret scan on staged tree BEFORE first commit. Gabriel pre-approved publish go.
- Write the "what runs on Casper after June 30" one-liner.

**Phase 4 — Submission (Jun 25-28, NOT Jun 30). Handoff to marketing/.**
- Demo video: shoot the reproducible flow (pay → act/attest → expose). Disclose the counterparty honestly. → marketing/.
- Submission writeup leading with verifiable-feed + persona-RWA angle, not "another x402 agent." → marketing/.
- Path A vote campaign ONLY if Q1 confirmed it's real; hand-driven from marketing/, never gated on the dead engine.
- Submit by Jun 28; keep Jun 28-30 as fix slack.

---

## Recommended sequence

1. **Pause** any build past Phase 0. Do not write Casper code or build the chain-agnostic abstraction yet.
2. **Answer the 6 architectural questions** — especially Q1 (CSPR.fans), Q2 (SPINE lock), Q3 (counterparty), Q4 (cut chain-agnostic). Most are decisions/questions, not builds; they cost hours, not days.
3. **Land the Phase 0 mitigations as the spike's actual content:** validate the HARDEST leg (headless signing), create spare faucet accounts + NCTL fallback, define the fresh-repo allowlist + secret scan.
4. **Run the de-risk gate.** Green only if the hard signing leg is proven AND the spine scope is locked AND a counterparty source is decided.
5. **Resume against v2** with the Day-7 and Day-14 binary gates enforced and the chain-agnostic abstraction cut.
6. **Submit early (Jun 28)** with slack for the demo + irreversible publish, never on the deadline.
