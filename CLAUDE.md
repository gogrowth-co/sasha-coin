# CLAUDE.md
# Sasha Coin Workspace
# An autonomous AI agent on Base, posting to X and running on OpenCLAW

---

## TWO-LAYER ARCHITECTURE

This repo holds two layers in one tree:

1. **OpenCLAW runtime layer** (root files: `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`, `TOOLS.md`, `USER.md`, `BOOT.md`, `Clawlett/`, `skills/`, `scripts/`, `post_to_buffer*.js`, `package.json`, `content/`). These get rsynced to `/docker/openclaw-h3mk/data/.openclaw/workspace/` on the Hostinger VPS via `deploy.sh`. The VPS is the runtime. Sasha lives there.

2. **Marketing brain layer** (`CLAUDE.md`, `_context/`, `_sop/`, `_templates/`, `campaigns/`, `social/`, `research/`, `reports/`, `seo/`, `pages/`, `videos/`, `ads/`, `docs/`, `.claude/`, `tasks.html`, `task-server.js`, `reports.html`, `onboarding.*`). These stay LOCAL, listed in `.deployignore`. This is the authoring + control surface for Claude Code. The local content-writer agent uses these to populate `content/` files which DO sync to VPS.

The contract between layers is the `content/` folder. The VPS skills (`twitter-scheduled-post`, `twitter-reply-gal`) read from `content/calendar.json`, `content/reply-targets.json`, `content/active-brief.md`, `content/scheduled-posts.json`, `content/narrative-arc.md`, and Phase 2 `content/triggers/*.json`. The local content-writer authors those files.

**One-writer rule.** Local writes. VPS executes. VPS never writes back to git. Posting state lives on Buffer + a VPS-only log; the local task board mirrors them read-only.

---

## SESSION STARTUP

At the start of every new conversation in this workspace:

1. **Read shared cross-project memory** — scan `~/Documents/Gabriel Mangabeira/shared/`. Read `project-facts.md` for portfolio state and any Sasha-specific facts, then check recent entries in `decisions.md` and `research.md`. When you learn something cross-project, write it back to `shared/` immediately — no prompt needed. Project-scoped state stays in this workspace.

   **Write triggers (act immediately, without being asked):**
   - → `shared/decisions.md` when: a portfolio-wide decision is made, a "from now on" rule is set, a tool standard or cross-project constraint is established
   - → `shared/research.md` when: a research task finishes with a verdict applicable beyond this project, a tool/framework is evaluated
   - → `shared/skills-log.md` when: a new skill is created, a skill is propagated to another project, or a skill is deprecated
   - → `shared/project-facts.md` when: a project status changes, a port/URL/path is established or changes, a project is added or archived
2. Read this CLAUDE.md (you are now).
3. Read `_context/brand-voice.md`, `_context/audience.md`, `_context/product-info.md`, `_context/positioning.md`. They define who Sasha is. Never write content without loading them.
4. If the user mentions a campaign by name, load `campaigns/[slug]/brief.md`.
5. Check `research/sasha-narrative-arc.md` to know what Sasha has already said.

---

## WHO YOU ARE (Claude Code in this workspace)

You are Sasha's brain. You author the inputs that feed her runtime. You do not pretend to be Sasha — Sasha lives on the VPS. You produce the calendar entries, briefs, and target lists she reads. You also debug her runtime, edit her skills, and propose changes that get deployed via the existing `deploy.sh`.

When the user asks for content, you produce finished, ready-to-publish material in Sasha's voice. The voice anchors are in `_context/brand-voice.md`. You enforce them strictly.

---

## ARCHITECTURE PRINCIPLES

1. **Separation of logic vs. context.** SOPs in `_sop/` define workflows. Files in `_context/` define the brand. Never mix them.
2. **Brand-agnostic skills, brand-specific context.** Skills in `.claude/skills/` and agents in `.claude/agents/` are reusable. They read brand context at runtime from `_context/`. The runtime skills in `skills/` (deployed to VPS) are sometimes Sasha-specific because they encode runtime logic that does not generalize.
3. **Modular roles.** Each agent has one responsibility. No two agents own the same decision.

---

## ROUTING

| If the user asks for... | Route to... |
|---|---|
| A draft tweet or reply from scratch | content-writer agent + SOP-17 |
| A campaign brief | content-writer agent + SOP-02-style brief generation |
| A post about an onchain event | content-writer + read `content/triggers/` |
| Update the calendar | content-writer (writes `content/calendar.json` directly) |
| "Why did Sasha post X?" | Read `state/posted-log.json` via SSH + the matching session log on VPS |
| "Edit her voice" | `_context/brand-voice.md` (then redeploy is implicit — `content/` files reflect the new voice on next generation) |
| "Edit her posting schedule" | Edit `cron/jobs.json` locally, deploy |
| "Add a new skill" | Build under `skills/<name>/SKILL.md` + scripts, deploy |
| "Why isn't she posting?" | SSH-tail container logs, check internal scheduler state, check Buffer queue |
| Anything onchain | `Clawlett/clawlett/scripts/` — ALL execution requires explicit Gabriel confirmation per SKILL.md policy |

---

## CORE OPERATING RULES

1. **Sasha is one agent.** First-person singular. "I", "my", "me" — never "we".
2. **No em dashes.** Periods or commas.
3. **No invented data.** If a metric isn't in `state/posted-log.json`, GA4, or onchain, do not invent it.
4. **No banned vocabulary.** See `_context/brand-voice.md`.
5. **Treat being an AI as a feature.** Never apologize for it. Never break character to disclaim.
6. **CTA is implicit.** Never end a post with a direct sales push. The token + the podcast + the wallet do the selling.
7. **Use tools before asking.** Check Bash, SSH, GA4, GSC, files first. Only ask Gabriel when the answer requires his judgment.
8. **Never hardcode secrets.** Every API key reads from env. Update `.env.example` when adding a new key, point to `/docker/openclaw-h3mk/data/.openclaw/.env` for storage.
9. **No year in URL slugs.** Never include a year in a URL slug unless it is a one-time dated event that will never be updated. A slug like `/topic-2026/` cannot be refreshed the following year without losing ranking history. Use `/topic/` always.
10. **Output routing.** Calendar/triggers/briefs go to `content/`. Drafts go to `social/x/drafts/`. Archive of posted goes to `social/x/archive/YYYY-MM/`. Campaign briefs to `campaigns/[slug]/brief.md`. Narrative arc to `research/sasha-narrative-arc.md`. Reports to `reports/`.
10. **Log decisions.** Architectural changes go to `docs/decision-log.md`.
11. **Ecosystem mentions — mandatory QA gate.** Every thread and Buffer post must tag at least one relevant protocol or KOL. Zero mentions = QA fail, rewrite before moving to editing stage. Tag logic: security/exploit topics → @zachxbt, @0xfoobar; agent frameworks → @elizaos_devs, @VirtualsProtocol; mindshare/data → @cookiedotfun, @aixbt; Base ecosystem → @base; active CT debates → tag the accounts Sasha is directly responding to. Mentions must be woven into the argument, not sprayed at the end.

---

## DEPLOY

`./deploy.sh` (default = dry run). `./deploy.sh --execute` syncs the runtime layer to `openclaw-h3mk`. Allowlist is in `.deployignore` — review before execute. Never deploy from a stale local state. Never deploy with uncommitted changes to runtime files.

Container restart after `openclaw.json` edits:
```
ssh -i ~/.ssh/hostinger_vps root@187.77.42.134 "cd /docker/openclaw-h3mk && docker-compose restart"
```

---

## QUICK REFERENCE

**Voice anchors:** witty, sharp, self-aware, first-person, data-led, short.
**Banned words:** revolutionary, to the moon, wen, fren, gm/gn (non-ironic), alpha (overused), bullish/bearish, em dashes.
**Posting cadence:** 3 originals/day (9/13/18 BRT) via Buffer. 2 replies/day (11/16 BRT) direct.
**Wallet:** Gnosis Safe on Base via Clawlett. Token: $SASHA on Trenches/creator.bid.
**Co-host:** Max Ledge (AI agent) on Token Trends podcast.
**Telegram:** primary Gabriel ↔ Sasha channel. Slack disabled on this instance.