---
name: prd-writer
description: Use when writing a Product Requirements Document (PRD) or feature spec for any product. Triggers include "write a PRD", "write a spec", "product requirements for X", "write requirements for this feature", or any /prd-writer invocation. Handles new whole products and scoped feature additions. Adaptive: interviews when the trigger is vague; drafts immediately when a brief is provided. Renders conditional sections based on product type (SaaS, AI agent, new product).
---

# PRD Writer

## Mission

Produce a complete, decision-ready PRD or feature spec. Never a skeleton. Never a placeholder-heavy template. A document Gabriel can hand to a developer or use to make a build/no-build decision on the same day.

---

## Step 1: Load Context

Before asking anything or writing anything, read these files if they exist in the current project:
- `_context/product-info.md` → extract: product name, product type, core value prop, current features
- `_context/audience.md` → extract: ICP name, key pain points, role/segment

Mark every extracted field as **pre-filled**. You will not ask about pre-filled fields.

If neither file exists, treat the product as new — no pre-filled fields.

**Detect product type** from `product-info.md`:
- `saas-app` → activate SaaS conditional sections
- `ai-agent-persona` → activate AI/Agent conditional sections
- Neither found → default to generic; activate New Product conditional sections if trigger says "new product" or no existing context

---

## Step 2: Detect Input Richness

Read the trigger message. Count sentences of substantive context (problem, user, feature detail — not just the product name).

**≥ 3 sentences of context → Draft-First path (Step 4)**
**< 3 sentences → Interview path (Step 3)**

---

## Step 3: Interview Path

Ask these questions one at a time. Skip any question whose answer is already pre-filled from Step 1.

**Q1 — Problem**
"What specific problem does this solve? Describe the situation where this pain occurs."

**Q2 — User**
"Who specifically experiences this problem? (Role, context, frequency — not just the ICP name.)"
*Skip if ICP is pre-filled and the PRD targets the full ICP with no narrower sub-segment.*

**Q3 — Success**
"What does success look like? Give me a specific metric, its current baseline, and your target."
*If the user gives a metric without a baseline: ask once for the baseline before moving on.*

**Q4 — Out of Scope**
"What is explicitly out of scope for this? Name at least one thing this will NOT do, even if it seems related."
*Do not accept a blank answer. If the user says 'nothing', probe: "Is [obvious adjacent feature] in or out?"*

**Q5 — Capabilities**
"What are the top 3 capabilities this needs? (What must it do, not how it should do it.)"

**Q6 — Constraints**
"Any hard technical constraints or dependencies? (Existing stack, third-party APIs, timeline, budget.)"
*This question is optional — if the user's brief already mentioned constraints, skip.*

After all answers are collected, proceed to Step 5 (Write the PRD). Do not show intermediate summaries.

---

## Step 4: Draft-First Path

Generate the full PRD immediately using the brief provided. Where information was not stated explicitly, make a reasonable inference and mark it with `[INFERRED]` inline.

After writing the complete PRD, append:

```
---
## [GAPS — Needs Your Input]

The following were inferred, not stated. Confirm or correct before this PRD goes to review:

1. [Section name]: [What was inferred] — correct?
2. [Section name]: [What was inferred] — correct?
...
```

List only genuine gaps. Do not list items you are confident about.

---

## Step 5: Write the PRD

Use the structure below. Render every Universal Core section. Render Conditional sections based on product type detected in Step 1.

---

### PRD Structure

#### Header

```
Product: [Product name]
Feature: [Feature name or "Full Product"]
Slug: [kebab-case-slug]
Author: Gabriel Mangabeira
Date: [YYYY-MM-DD]
Status: Draft
Version: 1.0
```

---

#### Problem Statement

One sentence. JTBD format:

> "When [situation], [user] wants to [motivation], so they can [outcome]."

No solution language. No "we will build." Just the problem.

---

#### Target User

- **ICP:** [Name from audience.md or interview]
- **Sub-segment:** [Narrower segment if this PRD targets a slice of the ICP, otherwise "Full ICP"]
- **Key pain point this addresses:** [One sentence]

---

#### Goals & Success Metrics

| Metric | Baseline | Target | How Measured |
|--------|----------|--------|--------------|
| [metric 1] | [current value] | [target value] | [tool / method] |
| [metric 2] | [current value] | [target value] | [tool / method] |

Rules:
- 2-4 metrics only. More than 4 dilutes focus.
- Every row must have a baseline AND a target. A metric without both is not a metric.
- Measurement method must be specific (e.g., "GA4 conversion funnel", "Stripe MRR", "manual review at Day 30").

---

#### Scope

**In scope:**
- [Capability 1]
- [Capability 2]
- [Capability 3]

**Out of scope:**
- [Thing 1 this will NOT do]
- [Thing 2 this will NOT do]

The out-of-scope list is mandatory. It protects the build from scope creep and tells developers what NOT to build.

---

#### Feature Requirements

Write user stories. Each story gets 2-4 acceptance criteria.

**Story 1:** As a [user], I want [action], so that [benefit].
- AC1: [Plain-language criterion — observable, testable]
- AC2: [Plain-language criterion]
- AC3: [Plain-language criterion]

**Story 2:** ...

Depth calibration:
- **Single feature** (one verb, <3 stories, "feature" in trigger): write ≤3 stories, each with 2-3 ACs. Total section: tight.
- **Whole product** (no existing context, or "product"/"platform" in trigger): write as many stories as needed to cover the full scope. No artificial cap.

No implementation details. "The system should store user preferences" — yes. "Use Redis to cache user preferences in a hash with TTL=3600" — no.

---

#### Open Questions

Numbered list. Every item must have an owner and a decision-needed-by date. No orphan questions.

1. [Question] — **Owner:** [name/role] — **Decide by:** [date or milestone]
2. [Question] — **Owner:** [name/role] — **Decide by:** [date or milestone]

If there are no open questions, write: "None. All decisions resolved."

---

### Conditional Section: AI / Agent Products

*Render when: `product-type: ai-agent-persona` in product-info.md, OR feature description contains "LLM", "agent", "AI model", "prompt", "inference".*

#### Model & Inference Requirements

- **Model:** [Recommended model + rationale. E.g., "Claude Sonnet 4.6 — balance of reasoning and cost at expected volume"]
- **Latency budget:** [Acceptable response time. E.g., "< 3s for first token, < 10s for full response"]
- **Context window needs:** [Estimated tokens per turn and why]
- **Expected volume:** [Calls/day or calls/month estimate]

#### Prompt Architecture Notes

- **System prompt role:** [What the system prompt establishes — persona, constraints, output format]
- **Tool use:** [Yes/No. If yes, which tools and why]
- **Memory approach:** [Session only / persistent / RAG / none — and why]
- **Output format:** [Structured JSON / freeform text / markdown / etc.]

#### Guardrails & Fallback Behavior

- **Uncertainty handling:** [What the agent does when it doesn't know — e.g., "surfaces confidence level, defers to human"]
- **Refusal triggers:** [What the agent will not do — e.g., "will not execute transactions without explicit confirmation"]
- **Failure modes:** [What happens if model call fails — e.g., "returns cached last response + error message"]
- **Escalation path:** [When and how the agent hands off to a human]

---

### Conditional Section: SaaS Products

*Render when: `product-type: saas-app` in product-info.md.*

#### Pricing & Packaging Impact

- **Tier affected:** [Free / Starter / Pro / Elite — or "No tier impact"]
- **Gate change:** [Does this move a feature behind a paywall or unlock one? Describe.]
- **Trial impact:** [Does this affect trial conversion? How?]

#### Activation / Retention Hook

- **Lifecycle stage:** [Onboarding / Activation / Habit / Expansion / Reactivation]
- **Trigger:** [What user action or system event fires this feature?]
- **Behavior reinforced:** [What habit does this build? E.g., "Daily check-in on token health scores"]
- **Drop-off risk:** [What happens if user doesn't engage with this feature in first 7 days?]

---

### Conditional Section: New Whole Product

*Render when: no existing product context found in `_context/`, OR "new product" / "new platform" appears in trigger.*

#### Press Release Test

Write this BEFORE the Feature Requirements section. One paragraph, written as if the product already shipped and is being announced.

Format:
> "[Product name] launches today, giving [target user] the ability to [core value prop]. Unlike [alternative], [product name] [key differentiator]. [One sentence on the outcome users achieve.] Available at [hypothetical URL]."

If this paragraph sounds vague or generic, the problem statement needs sharpening. Fix the problem statement first.

#### Competitive Differentiation

- **What alternatives exist:** [2-3 alternatives users have today — tools, workarounds, doing nothing]
- **What they miss:** [The specific gap that makes this worth building]
- **Why this approach:** [The insight or constraint that makes this approach different — not just "better"]

---

## Step 6: Save & Report

Save the PRD to: `docs/prd-[feature-slug]-YYYY-MM-DD.md` in the current project folder.

Report:

```
PRD written → docs/prd-[slug]-[date].md
Status: Draft
Sections: [list which conditional sections were rendered]

[If Draft-First path was used:]
GAPS (need your input before review):
1. [gap]
2. [gap]

Ready for review. Update Status to "Review" when you share it.
```

---

## Common Mistakes

- Writing a problem statement that describes the solution ("Users need a dashboard that shows X") — the problem statement describes the situation and motivation, not the solution
- Leaving a metric without a baseline ("Increase activation rate" is not a metric)
- Accepting an empty out-of-scope list — always probe for at least one explicit exclusion
- Adding implementation details in Feature Requirements — "how" belongs in a technical spec, not a PRD
- Rendering AI conditional sections for products that merely mention "AI" in marketing copy — only render if the feature being specified IS an AI/model capability
- Writing Open Questions without owners — a question without an owner is a question that never gets answered
