# _handoffs/ — Cross-agent handoff packets (Sasha Coin workspace)

The vendor-neutral bridge between agents (Claude Code ↔ Codex ↔ anything
that can read files). Instead of re-explaining context in a kickoff prompt,
the outgoing agent writes one packet here; the incoming agent's entire
kickoff is:

> Read AGENTS.md, then continue from `_handoffs/<file>.md`.

## Rules

1. **One file per handoff.** Name: `YYYY-MM-DD-<slug>.md` (e.g.
   `2026-07-09-cro-widget-frontend.md`). Copy `_TEMPLATE.md`.
2. **Written by the outgoing agent at the moment of handoff**, not
   reconstructed later. Decisions and their WHY are the most valuable part.
3. **Self-contained.** The reader has zero access to the writer's
   conversation. Link files by repo-relative path; never reference "the chat
   above" or a session ID.
4. **Status header stays current.** `OPEN` → `PICKED UP by <agent>` →
   `DONE`. The incoming agent updates it when it starts and finishes.
5. **Append, don't rewrite.** If work bounces back and forth, each agent
   appends a dated section at the bottom. The packet becomes the thread.
6. **No secrets.** Reference env var NAMES only.
7. Done packets older than ~30 days can be moved to `_handoffs/archive/`.
