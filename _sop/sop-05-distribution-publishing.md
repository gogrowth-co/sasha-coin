---
tags: [sop, distribution, publishing]
---
# SOP-05 — Distribution & Publishing
# Trigger: Content approved and ready to publish
# Agent: Distribution Manager
# Output: Content live across channels, publication log updated
# Claude Code command: `run sop-05 --file "social/linkedin/[filename].md"` or `social/x/[filename].md`

---

## PURPOSE

Format, finalize, and schedule approved content for each platform. This SOP is the last step before content goes live. It ensures every asset is correctly formatted for its platform, carries the right metadata, and is logged so performance tracking in SOP-07 has clean data.

---

## TRIGGER

**When:** Gabriel approves a content asset (article, post, thread, or newsletter)  
**Prerequisite:** File exists in `social/linkedin/`, `social/x/`, or `seo/` and is marked `[APPROVED]`  
**Prerequisite:** Content calendar entry is confirmed for this piece

---

## INPUTS REQUIRED

| Input | Source |
|---|---|
| Approved content file | `social/linkedin/`, `social/x/`, or `seo/` |
| Content calendar (for publish date/sequence) | `social/content-calendar-YYYY-MM-DD.md` |
| Publication log | `reports/publication-log.md` |
| Style guide (for platform-specific formatting) | `_context/style-guide.md` |

---

## STEPS — BLOG POST / PAGE (mangabeira.net via MCP)

This is the primary publishing path for all content destined for mangabeira.net. The MCP content server (`mangabeira-content`) is the authoritative entry point for programmatic publishing. The Admin UI at `/admin` is for manual edits only.

### Step E1 — Prepare the MCP Payload

Before calling `upsert_page`, confirm every field:

**Required fields:**
- `slug` — English/base slug, kebab-case, keyword-first (e.g., `defi-tokenomics-guide`)
- `status` — Always `"draft"` on first push. Never `"published"` unless Gabriel explicitly approves.
- `category` — One of: `blog`, `services`, `about`, `other` (or omit for system pages)
- `translations` — Array with at minimum one EN object. Include BR and ES when available.

**Each translation object:**
- `language` — `"en"`, `"br"`, or `"es"`
- `title` — Required. Final SEO title.
- `meta_description` — Required. Under 155 characters.
- `content` — HTML body (Tailwind classes, brand palette)
- `localized_slug` — Language-specific URL slug. **Must be translated into the target language** — never leave as the EN slug or null. (see URL structure below)
- `schema` — JSON-LD object (Article + FAQPage types)
- `featured_image_alt` — Alt text for hero image

**URL structure by language:**

| Language | Code | URL pattern | Localized slug example |
|---|---|---|---|
| English | `en` | `/publications/{en_slug}` | `brev-launch-deep-dive` |
| Portuguese | `br` | `/br/artigos/{br_slug}` | `deep-dive-lancamento-brev` |
| Spanish | `es` | `/es/articulos/{es_slug}` | `deep-dive-lanzamiento-brev` |

**Slug translation rule:** Translate each word of the EN slug literally into the target language. Do not translate the article title into a slug. Keep the same general order, no accent marks, kebab-case. Example: `brev-launch-deep-dive` → BR: `deep-dive-lancamento-brev`, ES: `deep-dive-lanzamiento-brev`.

**Critical rules for translations:**
1. `localized_slug` must always be translated into the target language — keyword-first, kebab-case, no accent marks.
2. All translations (EN + BR + ES) must be sent in a **single `upsert_page` call**. Separate calls wipe the previous translations array.
3. Accepted language codes: `en`, `br`, `es`. Codes `pt`, `pt-BR`, `pt-br`, `pt_BR` are invalid and will throw a constraint error.

**`preserve_styles` flag:** Set `true` for landing pages that need full layout control beyond the default prose wrapper. Blog posts leave this at default (`false`).

### Step E2 — Push as Draft

Call `upsert_page` with `status: "draft"`. Confirm the response shows:

```json
{
  "success": true,
  "action": "created",
  "status": "draft",
  "triggers_fired": []
}
```

No triggers should fire on draft. If `triggers_fired` is non-empty on a draft push, something is wrong — stop and investigate.

### Step E3 — Request Approval

Post the draft confirmation:

```
[DRAFT LIVE — NEEDS APPROVAL TO PUBLISH]
Slug: [slug]
Preview: https://mangabeira.net/admin/edit/[page_id]
Languages: [list of translation languages pushed]
Action needed: Confirm OK to publish.
```

### Step E4 — Publish

Once approved, call `upsert_page` again with the same full payload but `status: "published"`. Confirm triggers fired:

```json
{
  "status": "published",
  "triggers_fired": ["sitemap", "rss", "indexnow"]
}
```

If any trigger is missing from the array, log it but don't block publishing — triggers can be re-fired manually.

### Step E5 — Verify and Log

1. Call `list_pages` with `status: "published"` and confirm the slug appears.
2. Add entry to `reports/publication-log.md`:

```
| [YYYY-MM-DD] | Article | [Title] | mangabeira.net/publications/[slug] | [Primary keyword] | [ICP] | [Cycle] |
```

---

## STEPS — LONG-FORM ARTICLE (mangabeira.net)

### Step A1 — Final Pre-Publish Check

Before publishing, confirm:

- [ ] SEO title under 60 characters
- [ ] Meta description under 155 characters, includes primary keyword
- [ ] URL slug is clean (kebab-case, keyword-first, no stop words)
- [ ] H1 matches or closely matches SEO title
- [ ] Primary keyword appears in: H1, first 100 words, at least 2 H2s, meta
- [ ] Keyword density is natural (0.5–1.5% range — don't count, just read it)
- [ ] 3+ internal links to related articles in `seo/`
- [ ] 2+ external links to authoritative sources (open in new tab)
- [ ] All images have descriptive alt text (no "image1.jpg")
- [ ] FAQ section present with schema-ready format
- [ ] Article schema JSON-LD prepared (Article + FAQPage types)
- [ ] OG image specified (1200×630, Navy/Aqua/Gold palette)
- [ ] "Last updated" date accurate
- [ ] No em dashes in final copy
- [ ] Hemingway Grade 9 or below confirmed

### Step A2 — Schema Markup

Produce the Article + FAQPage schema JSON-LD for the article.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[SEO title]",
  "description": "[Meta description]",
  "author": {
    "@type": "Person",
    "name": "Gabriel Mangabeira",
    "url": "https://mangabeira.net/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Mangabeira.net",
    "logo": {
      "@type": "ImageObject",
      "url": "https://mangabeira.net/logo.png"
    }
  },
  "datePublished": "[YYYY-MM-DD]",
  "dateModified": "[YYYY-MM-DD]",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://mangabeira.net/[slug]"
  }
}
```

Append FAQPage schema separately for the FAQ section.

### Step A3 — Log the Publication

Add entry to `reports/publication-log.md`:

```
| [YYYY-MM-DD] | Article | [Title] | mangabeira.net/[slug] | [Primary keyword] | [ICP] | [Cycle] |
```

---

## STEPS — LINKEDIN POST

### Step B1 — Format for LinkedIn

LinkedIn-specific formatting checklist:
- [ ] No markdown formatting (no **bold**, no *italic*, no headers — LinkedIn ignores them)
- [ ] Line breaks are single returns between paragraphs (LinkedIn renders these correctly)
- [ ] No hashtags (brand decision)
- [ ] If linking to article: URL on its own line at the end, after the closing line
- [ ] Under 400 words (posts over 400 words get clipped heavily)
- [ ] First line is the hook — confirm it's under 140 characters (this is what shows before "see more")
- [ ] No em dashes in final copy

### Step B2 — Prepare the Post Block

Format the final post as a clean copy block:

```
[LINKEDIN POST — READY TO PUBLISH]
Date: [YYYY-MM-DD]
File: social/linkedin/li-post-[date]-[slug].md
Cycle: [cycle name]
ICP: [ICP name]
Pillar: [content pillar]

---
[Full post text, formatted exactly as it will appear on LinkedIn]
---

Link: [article URL if applicable]
Image: [filename or "none"]
```

### Step B3 — Log the Publication

Add to `reports/publication-log.md`:

```
| [YYYY-MM-DD] | LinkedIn | [First line of post] | [URL if linked] | [ICP] | [Cycle] | [Pillar] |
```

---

## STEPS — TWITTER/X THREAD

### Step C1 — Format for Twitter/X

- [ ] Each tweet under 280 characters (including spaces and link if present)
- [ ] Tweet 1 (anchor) is complete as a standalone — no "thread below" or "🧵"
- [ ] Each tweet numbered in the file: `[1/10]`, `[2/10]`, etc.
- [ ] Final tweet includes article link if applicable
- [ ] No em dashes
- [ ] No hashtags unless a specific hashtag is being used deliberately for this thread

### Step C2 — Prepare the Thread Block

```
[TWITTER THREAD — READY TO PUBLISH]
Date: [YYYY-MM-DD]
File: social/x/x-thread-[date]-[slug].md
Tweet count: [X]

---
[1/X] [Tweet text]

[2/X] [Tweet text]

[3/X] [Tweet text]
...
---
```

### Step C3 — Log the Publication

```
| [YYYY-MM-DD] | Twitter | [First tweet text] | [URL if linked] | [ICP] | [Cycle] |
```

---

## STEPS — NEWSLETTER

### Step D1 — Final Pre-Send Check

- [ ] Subject line under 8 words, no "Issue #N"
- [ ] No greeting / salutation at the top
- [ ] Sign-off is first name only — no title, no link cluster
- [ ] Soft CTA is present and is "reply" or "read the article" — not a calendar booking link
- [ ] Plain text renders cleanly (no broken markdown)
- [ ] Word count 300–500
- [ ] Links are correct and not broken
- [ ] No em dashes

### Step D2 — Prepare the Send Block

```
[NEWSLETTER — READY TO SEND]
Date: [YYYY-MM-DD]
Subject: [Subject line]
File: social/newsletter-[date].md
List: [List name / segment]

---
[Full newsletter body, plain text, exactly as it will send]
---
```

### Step D3 — Log the Publication

```
| [YYYY-MM-DD] | Newsletter | [Subject line] | [List/segment] | [Cycle] |
```

---

## PUBLICATION LOG FORMAT

File: `reports/publication-log.md`

Maintain as a running table:

```markdown
# Publication Log

| Date | Channel | Title / First Line | URL | ICP | Cycle | Pillar | Notes |
|---|---|---|---|---|---|---|---|
| 2026-04-10 | Article | How Protocol Growth Lost Its Owner | mangabeira.net/protocol-growth | VP Mktg | Aave-ACI | Protocol Teardown | |
| 2026-04-10 | LinkedIn | Protocol growth used to have an owner... | — | Founders | Aave-ACI | Protocol Teardown | |
```

---

## HUMAN APPROVAL GATE

This SOP executes on already-approved content. If Gabriel approved the content in SOP-03, publishing can proceed without a second approval gate.

**Exception:** Any content that has been edited since the original approval — even minor changes — must be flagged before publishing:

```
[EDIT DETECTED — NEEDS RE-APPROVAL]
File: [filename]
Change: [brief description of what changed]
Action needed: Confirm OK to publish with this edit.
```

---

## OUTPUT

- Content live on correct channels
- Publication log updated in `reports/publication-log.md`
- Content calendar entry marked `[PUBLISHED]`
- SOP-07 (Weekly Report) will use the publication log as its primary data input
