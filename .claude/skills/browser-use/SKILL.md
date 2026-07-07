---
name: browser-use
description: Use when a task requires an autonomous agent to actually operate a real browser — clicking, filling forms, navigating logged-in or JS-heavy sites, or completing a multi-step web workflow — rather than just reading page content. Covers CROO's UI-only service registration/discovery and any other site with no API. Not for simple content extraction (use firecrawl-cli) or static screenshots (use screenshot-taker).
---

# Browser Use (Cloud Agent)

Browser Use Cloud runs an LLM-driven agent that controls a real, remote browser to complete a natural-language task — navigate, click, type, read, extract — then returns a text (or structured) result. Use it when the target site has no API and needs actual interaction, not just HTML fetching.

Key: `BROWSER_USE_API` in this repo's `.env` (also `BROWSER_USE_API_KEY` in `marketing/.env`). Source it before running any script here:
```bash
set -a && source .env && set +a
```

## When to use vs. alternatives

| Need | Tool |
|---|---|
| Fetch/read page content, no interaction | `firecrawl:firecrawl-scrape` |
| Static screenshot | `screenshot-taker` |
| You already wrote deterministic Playwright steps | `playwright-cli` |
| Site requires clicking/typing/logging in, steps aren't known ahead of time, or the flow is UI-only (e.g. CROO service registration at agent.croo.network) | **this skill** |

## Quick reference

```bash
# Run a task, blocks and polls until done (default 300s timeout)
scripts/run-task.sh "Go to agent.croo.network, find service X, report its price" [--model MODEL] [--max-cost USD] [--keep-alive] [--timeout SECONDS]

# Check a long-running task without blocking
scripts/get-task.sh SESSION_ID

# Abort a runaway/expensive task
scripts/stop-task.sh SESSION_ID
```

`run-task.sh` prints the final session JSON on stdout (`status`, `output`, `isTaskSuccessful`, `totalCostUsd`, `liveUrl`, ...). Progress/session-id/live-url go to stderr.

## Models (`--model`)

Default is `claude-opus-4.7` (most capable, most expensive — a trivial 1-step task cost ~$0.18 in testing). Pass explicitly for anything routine:

- `gemini-3-flash` (alias `bu-mini`) — fast, cheap. Form filling, simple extraction.
- `claude-sonnet-4.6` (alias `bu-max`) — balanced. Multi-step workflows needing reasoning.
- `claude-opus-4.6` (alias `bu-ultra`) / `claude-opus-4.7` — most capable. Ambiguous or long-horizon tasks.
- `gpt-5.4-mini` — OpenAI, fast/cheap alternative.

Always pass `--max-cost` for anything you're not actively watching — sessions have a cost cap (API default up to $5) and will self-stop at the limit, but don't rely on the default for cheap tasks.

## API shape (for reference, if scripts don't cover a need)

Base: `https://api.browser-use.com/api/v3`, header `X-Browser-Use-API-Key: <key>`.

- `POST /sessions` — create/dispatch. Body: `{task, model?, maxCostUsd?, keepAlive?, sessionId?, outputSchema?, profileId?, workspaceId?}`. `outputSchema` (raw JSON Schema) constrains `output` to structured JSON instead of prose — use for anything you need to parse programmatically.
- `GET /sessions/{id}` — status/result. `status` starts `running`/`pending`, ends in a terminal state (observed: `stopped`); check `isTaskSuccessful` and `output`.
- `POST /sessions/{id}/stop` — abort.
- `GET /sessions` — list.
- `sessionId` on create dispatches a follow-up task into an existing idle session (set `keepAlive: true` on the first task to keep it alive for this) — preserves cookies/browser state across steps.

Live view of a running session: `liveUrl` in the create/status response.

## Common mistakes

- Forgetting to pass `--model`/`--max-cost` and eating opus-tier pricing on a task a cheap model would've handled.
- Polling status right after create — session starts in `running`/`pending`, give it a few seconds.
- Treating a non-`running` status as success — check `isTaskSuccessful` too; a session can stop without completing the task.