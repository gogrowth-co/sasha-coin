---
name: book-wisdom
description: Use when starting strategy work, writing PRDs, planning a sprint or campaign, drafting a new offer, doing a quarterly review, building a content pillar, designing an OKR set, briefing an agent on positioning, or anytime a proven business / strategy / craft framework would sharpen the output. Pulls the relevant distilled framework from Gabriel's library of book summaries into the brief. Triggers — "what does Tribes say about this", "apply OKRs", "use the Sprint method", "run a pre-mortem with Klein's frame", "book wisdom", "library", "what framework fits", "apply Marketing Rebellion", "scrum for agents", "creative greenhousing", any task where the agent should think like a real strategist before producing.
---

# Book Wisdom

## MANDATORY INVOCATION — READ FIRST

> **You MUST invoke this skill before producing any of the following — no exceptions:**
> - PRDs, product specs, feature briefs
> - Quarterly OKRs, monthly strategy resets (SOP-08), strategy reviews
> - Cycle briefs, content pillar plans, campaign briefs (SOP-02)
> - Sprint plans or validation tests for new ideas
> - Positioning artifacts, brand voice resets, community strategy
> - Multi-agent system design, agent role definitions, new agent files
> - New offer / new service / new SaaS plans
>
> "Invoke" means: run Mode 1 (inject), read the matched book(s), and embed the **"Framework in play"** block at the top of the deliverable. Citing a book without applying it doesn't count.
>
> If you catch yourself drafting any of the artifacts above without having invoked this skill first, STOP, invoke it, and restart with the framework in place.

## What this skill does

Surfaces distilled frameworks from Gabriel's library of business / strategy / craft book summaries (`~/Documents/Gabriel Mangabeira/shared/library/`) and pulls them into the current task brief.

The library is the source of truth. This skill is the retrieval + injection layer.

## When to invoke

**Invoke before producing:**
- Any PRD, spec, or new product/offer plan
- Quarterly OKRs, strategy resets, monthly reviews (SOP-08)
- Cycle briefs, campaign briefs, content pillar plans (SOP-02)
- Sprint plans or validation tests for new ideas
- Positioning, brand voice, or community strategy work
- Multi-agent system design or agent role definitions
- Anything where Gabriel says "what's the right framework for this"

**Skip when:**
- Producing tactical content from an already-approved brief (the framework was applied upstream)
- Pure execution tasks (formatting, publishing, scraping)
- Single-metric data lookups

## Library location

`~/Documents/Gabriel Mangabeira/shared/library/`

- One markdown file per book, named `NN-slug-author.md`
- Each file has YAML frontmatter with `title`, `author`, `tags`, `applies_to`
- Index in `shared/library/README.md`

Files are small enough to load directly. No DB, no API, no separate index file beyond the README.

## Modes

### Mode 1 — Inject (default)

Goal: take the current task description, identify 1 or 2 relevant books, and pull the relevant framework into the brief.

Steps:
1. Read `shared/library/README.md` for the index.
2. Match task keywords against book `tags` and `applies_to` in each frontmatter.
3. Read the matched book files (max 2 — pick the strongest match if more would fit).
4. In the response, surface a short **"Framework in play"** block at the top of the brief:
   - Book + author
   - 1–3 line distilled principle most relevant to the task
   - 1 actionable rule pulled from the file's "Application" section if available
5. Continue producing the task output with the framework embedded in the thinking, not just cited.

### Mode 2 — List

Goal: return the full library inventory for browsing.

Steps:
1. Read `shared/library/README.md`.
2. Return the index table verbatim.
3. Add a one-line summary of each book's core thesis pulled from the file.

### Mode 3 — Lookup

Goal: return the full content of a specific book by title, slug, or filename.

Steps:
1. Match input against `title` field in frontmatter (case-insensitive) or filename.
2. Read the file.
3. Return the full content.

### Mode 4 — Search by tag

Goal: return all books matching a tag.

Steps:
1. Read every file's frontmatter.
2. Filter by `tags` array (case-insensitive).
3. Return matched titles + one-line distilled thesis per match.

## How to embed a framework into a brief

When in Mode 1 (inject), surface the framework explicitly at the top of the working document. Format:

```markdown
> **Framework in play:** [Book Title] ([Author]) — [1-line principle most relevant to this task].
> **Applied rule:** [1 concrete rule or constraint pulled from the book's Application section, rewritten in second person if it makes sense].

---
```

Then write the actual deliverable. The reader should be able to see *why* the deliverable looks the way it does without reading the source book.

If two books apply, stack two framework blocks. Three or more is too many — pick the strongest two.

## Tag → typical match heuristics

Use these to speed up Mode 1 retrieval. These are conventions, not hard rules.

| Task signal | Likely book |
|---|---|
| "quarterly plan", "set goals", "what should we ship this quarter" | Measure What Matters (OKRs) |
| "new project", "new offer", "validate idea", "should we build X" | Sprint (Knapp) |
| "agent C-suite", "sprint cadence", "how do agents work together", "weekly review" | Scrum (Sutherland) |
| "build a community", "Discord strategy", "positioning for a niche", "who is my tribe" | Tribes (Godin) |
| "earned vs paid", "is our marketing too pushy", "authenticity", "founder voice" | Marketing Rebellion (Schaefer) |
| "brainstorm", "we're stuck", "kill the idea too fast", "prototype faster" | Sticky Wisdom (?What If!) |

## When the library is missing the framework

If the task clearly needs a framework but no book in the library covers it cleanly:
1. State that explicitly in the response (one line: *"No book in the library covers [topic] tightly. Closest match is [book] but it's a partial fit."*).
2. Use general knowledge to apply the closest framework anyway.
3. Flag the gap so Gabriel can decide whether to add a book.

Do not fabricate a book or attribute frameworks to books the library doesn't contain.

## Adding a new book

When a new book summary is added:
1. New file at `shared/library/NN-slug-author.md` (next sequential number).
2. Update the table in `shared/library/README.md`.
3. No skill change needed — `book-wisdom` reads the README dynamically.

If the new book changes how the skill should be invoked (new mode, new heuristic), update this SKILL.md.

## Quick reference

| Mode | Trigger phrasing | Output |
|---|---|---|
| Inject | "use the right framework", "what framework fits", or no explicit mode + a strategy task | Framework block at top of deliverable |
| List | "list the library", "show me the books", "what books do we have" | Full index table + one-line theses |
| Lookup | "pull up Tribes", "read me Sprint", `book-wisdom Tribes` | Full file content |
| Search | "books about community", "what's on OKRs", "tag: agile" | Matching books + theses |

## Common mistakes

- **Citing a book without applying it.** The point is to think with the framework, not to drop a name. The deliverable must visibly reflect the framework.
- **Stacking 3+ books.** Two max. One usually wins.
- **Hallucinating a book.** If it's not in `shared/library/`, the skill doesn't know it. Say so.
- **Using this skill for tactical execution.** A formatting task doesn't need a framework.
- **Forgetting the Application section.** Every book file has one — that's where the concrete, Gabriel-specific rules live. Pull from there before pulling from the abstract theory section.
