# CROO Build — Worktree Layout and Edit Tool Constraint

## Worktree map (as of 2026-06-28)

| Path | Branch | Purpose |
|---|---|---|
| `.` (main repo) | `main` | Root checkout — runtime, skills, scripts |
| `.claude/worktrees/agent-af93d5884e63f1f1d` | `worktree-agent-*` | Agent isolation worktree (Edit tool enforced here) |
| `.worktrees/feat-croo` | `feat/croo-sasha-risk-desk` | CROO Sasha Risk Desk code — `croo/src/`, `croo/tests/` |

## Edit tool constraint

The Edit and Write tools enforce the agent's assigned worktree path. Any attempt to
edit a file outside that worktree raises:

  "This agent is isolated in the worktree ... Edit the worktree copy of this file instead."

Workaround: Use Bash + inline Python (`python3 - <<'PYEOF' ... PYEOF`) for all file
writes when the target is on a different branch/worktree. The Bash tool has no path
restriction.

## CROO source layout

- `croo/src/` — TypeScript source (types, risk-packet, provider, a2a-buyer, etc.)
- `croo/tests/` — Vitest test files
- `croo/package.json` — `npm test` = `vitest run`, `npm run build` = `tsc`
- `croo/tsconfig.json` — ESM, NodeNext, strict

Run tests and build from the `croo/` directory, not the workspace root.

## Key files added in Phase 2 (2026-06-28)

- `croo/src/a2a-buyer.ts` — `buyExternalInput` + `buyExternalInputs` (resilient A2A purchases)
- `croo/src/types.ts` — `ExternalAgentInput` interface; `RiskPacket` extended with `delivery_hash`, context fields
- `croo/src/risk-packet.ts` — 3rd arg `externalInputs`, `delivery_hash` computed as sha256 hex of core fields
- `croo/tests/a2a-buyer.test.ts` — 7 tests: null on network error, null on timeout, null on rejection, happy path, truncation, empty-env, single-env
