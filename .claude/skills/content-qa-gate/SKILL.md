---
name: content-qa-gate
description: Project-agnostic content QA for ANY project producing web articles (EkkoGreen, mangabeira.net, Token Health Scan, future sites). One contract per project, four gates with the same code - plan (before any prose), draft (before QA Passed), live (after publishing, sets QA), weekly sweep. Use when producing, reviewing, publishing or auditing articles/product pages, when setting up content production for a new project, or when a card says "QA Passed" and you need proof.
---

# Content QA Gate (all projects)

**Rule (Gabriel, 2026-10-07):** content quality is decided by deterministic checks against the project's contract, at every
stage, with the same code. "QA Passed" is a result of the gate on the LIVE page, never a producer's claim. Born from an audit
that found 35 "Passed" EkkoGreen posts failing: zero links, "perfil descrito no briefing" in the copy, a 404 image, metas at
112 chars, four documents disagreeing on the rules, AI renders with fake logos and one stock photo on three product pages.

## 1. The contract (one per project, the only place numbers live)
- Location: `<workspace>/_context/content-contract.json`. EkkoGreen keeps `/root/skeletond/skeletond/pipeline/article-contract.json`.
- New project: copy `contracts/contract-template.json`, set `site`, `language`, `audit.type_rules`, `audit.body_selector`,
  `audit.render_js` (true for client-rendered SPAs), and translate the project's `publishing-standards.md` into the numbers.
- Never declare a threshold in a skill, prompt, desk file or script. If a document disagrees with the contract, the contract
  wins; fix the document.
- Current contracts: EkkoGreen (v1.4, enforced by the publisher), mangabeira.net and Token Health Scan (v1.0 drafts from their
  publishing standards: calibrate with each project's owner before making them blocking in their publish flow).

## 2. The four gates
| Gate | When | Command | Pass means |
|---|---|---|---|
| plan | before writing a paragraph | `qa_gate.py --contract C plan plan.json` | skeleton mapped, links/sources verified (200, no redirect), visuals planned, FAQ planned, product: promise + real alternative + official cover |
| draft | before QA=Passed | `qa_gate.py --contract C draft --html body.html --title T --meta M --type X --url U` | the written piece meets the contract |
| live | after publishing | `qa_gate.py --contract C live <url>` | the page readers and crawlers get meets it; this result sets the card's QA |
| sweep | weekly | `qa_gate.py --contract C sweep --sitemap <url> --limit 40` | batch checks: template boilerplate on programmatic pages, one cover shared by product pages |

Scripts: `scripts/qa_core.py` (engine, class `Gate`), `scripts/qa_gate.py` (CLI), `scripts/render.cjs` (SPA rendering).
Project adapters add CMS specifics and call the same engine (EkkoGreen: `ekkogreen-ce-publish/scripts/content_audit.py`,
publisher `server_publish.py`, sweep `content_sweep.py`).

## 3. What the gate checks
Headline and meta length; words per type (declared exceptions only where the contract allows); unique internal links that
resolve 200 without redirect; clickable external evidence (only 404/410 count as dead); broken images; alt text; visuals by type
and length (tables count); FAQ count + FAQPage on the live page; production text that leaked into the copy (briefing, TODO,
"[insert", "before final publication"...); em dashes; template paragraphs repeated across pages; product pages: official cover
(never an AI render file, never the same cover as another product page). Plan gate also needs, for product types, the number
the headline promises and a real alternative with its source.

## 4. Wiring a project (checklist)
1. Contract in `_context/content-contract.json`, numbers from the project's publishing standards.
2. Producer: plan gate before prose; draft gate before QA=Passed; attach both outputs to the QA record.
3. Publisher: draft gate on the built payload (FAIL = do not publish); live gate after publish sets QA (Passed/Hold) and
   supersedes older reports.
4. Weekly sweep: failing pages become repair work items for human approval (never silent edits of live copy).
5. Product pages: images via the `product-imagery` skill.
In V4, `routines/_shared.md` carries these rules into every client's routines automatically.
