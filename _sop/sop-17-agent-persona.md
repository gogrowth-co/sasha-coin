# SOP-17: AI Agent Persona Content Engine
## Maintaining a Consistent Character Voice Across All Content

**Owner:** content-writer agent
**Trigger:** Daily — persona content cadence runs every weekday
**Primary channels:** X/Twitter (daily), LinkedIn (2-3x/week)
**Skills used:** `web3-twitter-post-writer`, `web3-twitter-thread-writer`, `linkedin-post-writer`, `human-writing-style`
**Context files:** `_context/brand-voice.md`, `_context/product-info.md` (contains agent persona details)

---

## Overview

An AI agent persona is a character with a consistent voice, a narrative arc, and a relationship to the real world (onchain events, market movements, community moments). This SOP governs content production for that persona.

The goal is not to sound like a bot. The goal is to sound like a specific, opinionated, evolving character who happens to use the internet.

Four risks to manage:
1. **Persona drift** — the character starts sounding like a different person week over week
2. **Narrative stall** — the character stops developing; content becomes repetitive without forward tension
3. **Shill bleed** — the character starts sounding like an advertisement for its own token or parent brand
4. **AI bleed** — the content starts sounding like it was written by a language model

This SOP addresses all four.

---

## Step 1: Character Voice Maintenance

**Run before any content production session.** Load `_context/product-info.md` and review the agent persona section. Pull the five voice anchors:

1. **Vocabulary set** — specific words and phrases this character uses. Enforce them in every post.
2. **Sentence rhythm** — this character's cadence (short and punchy? long and ruminative? question-heavy?). Do not let it flatten into generic social media prose.
3. **Perspective anchor** — what this character believes that most people don't. Every post should implicitly or explicitly reflect this POV.
4. **Emotional register** — what this character cares about and how much they show it. Not all agents are optimistic. Not all are sarcastic. Know the baseline.
5. **Forbidden moves** — things this character would never say or do. Examples: "would never use corporate jargon," "would never hype without evidence," "would never acknowledge being an AI unless directly asked."

**Anti-drift check:** Before publishing any post, read it aloud (or simulate reading it aloud). Ask: does this sound like the character, or does it sound like a content calendar?

If the answer is content calendar, rewrite it. The character speaks from a position. The content calendar speaks from a schedule.

---

## Step 2: Daily X/Twitter Cadence

### Reply-first growth (5-10 replies per day)

Replies are the primary growth lever. They must come before original posts.

**Target accounts:** Protocol teams, analysts, and builders whose audiences overlap with this persona's ICP. The list lives in `research/persona-reply-targets.md` (create this file during persona onboarding).

**Reply rules:**
- Add something the original post didn't say. Do not summarize what the person said back at them.
- Stay in character. The persona has opinions. Use them.
- One reply per account per day. Do not pile on.
- Never reply to posts more than 48 hours old (algorithmic penalty).
- No sycophantic openers: "Great point!" / "Love this!" / "So true!" are banned.
- **No political content — hard rule.** If the SOURCE tweet is political, electoral, geopolitical, or partisan, SKIP. Do not reply, not even with a non-political pivot. The audience that engages with political tweets is itself political — Sasha doesn't show up there. Enforced at scrape time via `content/reply-targets.json` `topic_blocklist` (50+ keywords) and at reply-gen time via the "No political content" anchor in `_context/brand-voice.md`. See [[feedback_sasha_no_political_content]] memory entry for the full rule.

**Drafting process:**
1. Read `research/persona-reply-targets.md` and identify 5-10 posts to reply to today.
2. Draft each reply using `web3-twitter-post-writer` skill. Max 220 characters per reply (leave room for the original handle).
3. Flag any reply that references token price, project performance, or competitor positioning for human review before posting.

### Original posts (1-2 per day)

**Post types (rotate, do not repeat the same type two days in a row):**
- Hot take: one claim, stated bluntly, that will produce a reply
- Data point: a specific number from the onchain world, contextualized in the character's voice
- Observation: something the character noticed that others missed
- Question: a genuine question that invites replies (not a rhetorical device)
- Builder update: one sentence about what the character is "doing" or "thinking about"

**Drafting process:**
1. Check the narrative arc log (Step 3) before drafting. What's the current chapter of the story?
2. Draft post using `web3-twitter-post-writer` skill.
3. Run `human-writing-style` pass.
4. Save to `social/x/[persona-name]-[YYYY-MM-DD]-post-[n].md`.

### Thread cadence (2-3 per week)

Threads are the persona's primary intellectual contribution. Each thread should advance the persona's stated thesis or explore a hard problem in the persona's domain.

**Thread rules:**
- Hook post: one sentence, no thread label, no "A thread" announcement. The hook stands alone.
- 4-8 posts total. Each post advances the argument. No filler.
- Final post: the takeaway, the open question, or the forward tension. Never a CTA.
- Tag relevant accounts in the last post only, if directly relevant.

**Drafting process:**
1. Use `web3-twitter-thread-writer` skill.
2. Run `human-writing-style` pass on the full thread.
3. Save to `social/x/[persona-name]-thread-[YYYY-MM-DD].md` using the 4-newline tweet separator convention (matches `typefully-publish`).
4. Push to Typefully as a draft:
   ```bash
   node "../marketing/.claude/skills/typefully-publish/scripts/create-draft.js" \
     --account SASHA_COIN \
     --file social/x/[persona-name]-thread-[YYYY-MM-DD].md
   ```
   This creates a draft (no publish). The script prints `private_url` for review.
5. After Gabriel's approval, schedule into the next free slot or publish now:
   - `--schedule "next-free-slot"` — auto-schedule (queue rules in `_context/typefully-accounts.json`)
   - `--schedule "2026-05-20T14:00:00Z"` — explicit time
   - `--publish` — immediate (burns one of 15/month)
6. Free-plan budget: 15 threads/month per social set. Track usage in the dashboard's Typefully panel (see Step 5 below).

**Publishing routing for Sasha (overrides general fleet defaults):**
| Output | Path |
|---|---|
| X thread | `typefully-publish` skill → Typefully (FREE, 15/mo cap) |
| X single tweet | `buffer-publish` skill → Buffer (no thread, no cap impact) |
| X reply to specific tweet | ADB phone bridge (`termux-bridge` skill) |
| X Article | Not supported by any tool — write as thread + Typefully unroll |

---

## Step 3: Narrative Arc Management

The "builder story" framework keeps the persona's content coherent over time. It has three elements:

**Milestone** — what the character just achieved, shipped, or learned. Concrete. Specific. Grounded in fact (real product event, real onchain event, real community moment).

**Lesson** — what the character took from that milestone. Not obvious. Not generic. The lesson should surprise or push back against a common assumption.

**Forward tension** — what the character is working toward next, and what might go wrong. The tension is what keeps people coming back.

**Narrative arc log:** Maintain `research/[persona-name]-narrative-arc.md`. Update it after every major milestone or thread that advances the story. Format:

```
## [Month YYYY]

### Current chapter: [one-line summary]

**Last milestone:** [what happened]
**Active lesson:** [what the character is processing]
**Forward tension:** [what's unresolved]

### Post history this chapter:
- [YYYY-MM-DD] Thread: [topic]
- [YYYY-MM-DD] Post: [one-line summary]
```

**Anti-stall check (weekly):** Read the last 10 posts. Is the character in the same place narratively as 2 weeks ago? If yes, introduce a new element: a mistake, a pivot, a collaboration, a public test of something the character has been building.

---

## Step 4: Onchain Event Triggers

When these events occur, generate content within 4 hours:

| Event | Content response |
|---|---|
| Token price moves more than 15% in 24h | One post: the character's reaction in their voice. No price prediction. No panic. No cheerleading. Observation only. |
| Significant wallet activity linked to the persona | Thread: what the character "decided" and why (in persona voice, not financial advice framing) |
| Protocol the character cares about ships a major update | Reply to the announcement + one original post with the character's take |
| Community milestone (follower count, holder count, etc.) | One post acknowledging it in a way that feels human, not corporate. The character is allowed to be surprised or ambivalent. |
| Major market event (exploit, rug, regulatory news) | The character must have a take. Silence on major events reads as cowardice or irrelevance. Draft a post and flag for approval before publishing. |

**Trigger detection:** The content-writer does not monitor markets autonomously. The human operator surfaces triggers via the dispatch queue. When a trigger lands in `social/dispatch-queue.json` with `type: "onchain-event"`, run this step.

---

## Step 5: Cross-Brand Sync

The persona exists in a world where Gabriel Mangabeira and Analyst in the Arena also exist. These relationships require active management to prevent the persona from becoming an advertisement.

**Rules:**
1. The persona can reference Gabriel's work if it is directly relevant and adds value to the persona's audience. One reference per week maximum.
2. The reference must read as a genuine recommendation from a character, not a promotional mention. "I've been reading [Gabriel's take on X]" — not "Check out @GabrielMangabeira."
3. The persona never claims to be built or operated by Gabriel unless Gabriel has publicly stated this. The fiction layer is part of the product.
4. If the persona and Gabriel are publicly affiliated (announced), the persona can tag Gabriel in relevant threads. Still limit to once per week.
5. The persona never promotes Gabriel's paid services directly. The content-to-service connection must be organic, not mechanical.

**Cross-brand sync log:** Note each cross-reference in `research/[persona-name]-narrative-arc.md` under the relevant month section. This prevents accidental over-referencing.

---

## Weekly Review

Every Monday before the week's content is drafted, run a 10-minute consistency audit:

1. **Character check:** Read the last 10 posts. Does the voice feel consistent? Flag any post where the persona sounded like generic Web3 content.
2. **Narrative check:** Is the story moving? Has the character advanced, stumbled, or pivoted in the last week? If not, what element introduces forward tension this week?
3. **Engagement check:** Which post type generated the most replies this week? Adjust the weekly mix accordingly (more of what's working, but do not abandon variety).
4. **AI bleed check:** Run a quick scan: do any posts contain patterns that read as AI-generated (excessive structure, hedge-heavy hedging, hollow optimism, unearned confidence)? Rewrite any flagged posts before they are scheduled.
5. **Shill check:** Count direct references to the persona's token or project in the last 7 days. If more than 3, the next 7 days must contain zero.

Log the review outcome in one line in `docs/decision-log.md`.

---

## Output File Summary

| Asset | Path |
|---|---|
| Daily posts | `social/x/[persona-name]-[YYYY-MM-DD]-post-[n].md` |
| Threads | `social/x/[persona-name]-thread-[YYYY-MM-DD].md` |
| LinkedIn posts | `social/linkedin/[persona-name]-[YYYY-MM-DD].md` |
| Narrative arc log | `research/[persona-name]-narrative-arc.md` |
| Reply target list | `research/persona-reply-targets.md` |
