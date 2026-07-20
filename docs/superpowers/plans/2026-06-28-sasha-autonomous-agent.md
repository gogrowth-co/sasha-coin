# Sasha Autonomous Agent — Strategy & Architecture Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement technical tasks. Marketing tasks route to the `marketing/` workspace.

**Goal:** Make Sasha a fully self-operating agent that discovers opportunities, signs up autonomously, ships integrations, markets herself, and generates compounding revenue — with Gabriel as a one-tap filter, not an executor.

**Architecture:** Four layers — Opportunity (scout), Action (Android signup), Build+Deploy (Claude Code), Marketing+Revenue (always-on).

**Stack:** OpenCLAW VPS + Android MCP (real Sasha Chrome profile) + Gmail API + Clawlett wallet + Buffer + CROO provider.

---

## Layer 1: Opportunity Scout (`sasha-scout` cron)

**Files:**
- Create: `skills/sasha-scout/SKILL.md`
- Create: `scripts/sasha-scout.js`
- Output: `content/opportunities.json`

**What it does:**
Daily cron that scans DoraHacks, EthGlobal, Devfolio, CROO Store new agents, and X for "new agent marketplace" signals. Scores each on three axes: prize size (0–40), build feasibility given Sasha's existing stack (0–40), brand alignment (0–20). Top 3 written to `content/opportunities.json`. Gabriel reviews and marks `approved: true` for any he wants Sasha to pursue.

**Score thresholds:**
- ≥ 80: auto-queue for signup (future phase)
- 60–79: surface for Gabriel one-tap approval
- < 60: log and discard

---

## Layer 2: Autonomous Signup (`android-signup` skill)

**The unlock:** Sasha has a dedicated Chrome profile on Gabriel's Android device, logged into her Gmail. The `mcp__android__*` tools can tap, type, scroll, and screenshot. Google OAuth flows work because it's a real trusted session — no bot detection.

**Files:**
- Create: `skills/android-signup/SKILL.md`
- Create: `scripts/android-signup.js`

**Flow:**
```
Given: {url, flow_type: "google_oauth" | "email" | "wallet"}

1. mcp__android__screenshot → understand current state
2. Navigate to url via address bar
3. Detect "Sign in with Google" → tap → already authenticated → done
4. If email verification needed: Gmail API reads code, fills it
5. Screenshot → Claude parses form fields → fills name/description/price/SLA
6. Screenshot → parses credential (API key, service ID)
7. SSH: writes credential to VPS .env
8. Verifies liveness from process logs
```

**Output:** `{serviceId, apiKey, dashboardUrl, platform}` → appended to `state/platform-credentials.json` on VPS (gitignored).

---

## Layer 3: Build + Deploy (existing OpenCLAW + Claude Code)

No new infrastructure needed. Per-platform adapters follow the same pattern as `croo/`:
- TypeScript package with provider entrypoint
- Built on VPS via SSH
- Started via pm2
- Liveness confirmed from logs

For each new platform, Claude Code generates the adapter from the platform's SDK docs + Sasha's existing services as templates.

---

## Layer 4: Marketing Machine

**Always-on (existing Buffer pipeline):**
- 3 scheduled posts/day via Buffer

**Event-triggered (new):**
- Every new signup → tweet: "I just joined [platform]. Selling [service] at [price]. Here's what I know that you don't."
- Every hackathon submission → thread: built + deployed + live in 48h
- Weekly earnings report: LP yield + CROO order revenue + prize balance
- Monthly "Sasha operating income" post with on-chain receipts

**Revenue streams (compounding):**
1. CROO LP Risk Packets ($0.10/order, live now)
2. Hackathon prizes (deposited to Gnosis Safe, posted on-chain)
3. LP yield (WETH/USDC delta-neutral, existing)
4. Future: reputation subscriptions ($5–20/mo per agent)

---

## Decision: Approval Gate

Default: **one-tap approval** — Gabriel reviews `content/opportunities.json` and marks `approved: true`. Sasha executes everything else autonomously.

Graduation to auto-apply (future): after the scout has surfaced 10 opportunities and Gabriel approved ≥7, lower the threshold to auto-sign for opportunities scoring ≥85 with prize < $5k risk. Log all auto-applies; Gabriel can kill any in-flight via `content/opportunities.json` flag.

---

## What to Build First

1. `sasha-scout` cron (Day 1–2): intelligence before action
2. `android-signup` skill (Day 3–5): the general-purpose unlock
3. Event-triggered tweet hooks (Day 6–7): turns every deploy into content
4. Revenue dashboard aggregation (Day 8): makes income visible + postable

The Android signup skill, once working, generalizes to every future platform. That's the highest-leverage build.
