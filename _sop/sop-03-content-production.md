---
tags: [sop, content, production]
context: "[[brand-voice]] [[audience]] [[product-info]] [[style-guide]]"
upstream: "[[sop-02-content-planning]]"
downstream: "[[sop-04-repurposing-engine]] [[sop-05-distribution-publishing]]"
---
# SOP-03 — Content Production
# Trigger: Approved content calendar from SOP-02
# Agent: Content Creator
# Output folders: seo/ (articles), social/linkedin/ (posts), social/x/ (threads), social/ (newsletters)
# Claude Code command: `run sop-03 --piece "[working title or angle]"`

---

## PURPOSE

Produce finished, publish-ready content assets from the approved content calendar. Every piece produced here must be complete — not a draft, not a skeleton, not bullet points. If it's not ready to publish, it's not done.

This SOP governs all content types: long-form articles, LinkedIn posts, Twitter/X threads, and newsletters.

---

## TRIGGER

**When:** Content calendar approved (SOP-02 complete)  
**Per piece:** Run once per content asset  
**Prerequisite:** Active cycle brief loaded, content calendar entry confirmed

---

## INPUTS REQUIRED

| Input | Source |
|---|---|
| Approved content calendar entry | `social/content-calendar-YYYY-MM-DD.md` |
| Active cycle brief | `research/cycle-brief-current.md` |
| Brand voice | `_context/brand-voice.md` |
| ICP reference | `_context/audience.md` |
| Style guide | `_context/style-guide.md` |
| Content examples | `_context/content-examples.md` |
| Research notes (if applicable) | `research/` folder |
| Existing related articles (for internal linking) | `seo/` folder |

---

## STEPS — LONG-FORM ARTICLE

### Step A1 — Load Research and Define the Angle

Before writing a single word:

1. Load the cycle brief. Confirm the article's role within the cycle narrative. Is it the anchor piece? A supporting piece? A reactive piece?
2. Load any research notes from `research/` related to this topic.
3. Define the analytical angle in one sentence: "This article argues that [specific claim] because [evidence or pattern]."
4. Identify the ICP this piece primarily serves.
5. Identify the primary keyword (from GSC data or keyword research in `research/`).
6. Identify 3–5 secondary keywords and related terms.

If the analytical angle isn't clear in one sentence, stop. The piece isn't ready to write. Post `[NEEDS BRIEF — angle not defined]` and flag for Gabriel.

---

### Step A2 — Build the Structure

Produce an article outline in this format before writing body copy:

```
Title (working): [SEO-optimized, question-based or claim-based, under 65 characters]
Primary keyword: [keyword]
ICP: [ICP name]
Word count target: [2,000–3,500 for pillar / 1,500–2,500 for deep-dive]
Cycle: [cycle name]

Structure:
H1: [Final article title]
  Intro (150–200 words): Hook → context → what this article covers → what the reader will understand by the end
  H2: [Section 1 — On-chain findings or data frame]
  H2: [Section 2 — Pattern recognition]
  H2: [Section 3 — Strategic takeaway]
  H2: [Section 4 — Framework or playbook]
  H2: FAQ (4–6 questions — AEO-targeted)
  Conclusion (100–150 words): Summary + open loop or forward-looking statement
```

Post structure for approval if the piece is a pillar article (2,000+ words). Deep-dives and reactive pieces can proceed to writing without structure approval.

---

### Step A3 — Write the Article

Follow these rules without exception:

**Opening:**
- First sentence is a statement or observation. Never a question.
- No "In today's Web3 landscape..." or any variant.
- Context is established in 2–3 sentences. The reader knows why this matters by line 5.

**Body:**
- Each H2 section starts with a 1–2 sentence frame that tells the reader what they're about to learn.
- Data and on-chain evidence are cited with source. If a source isn't available, write around the claim — don't invent a number.
- Use verbs of insight: reveals, signals, suggests, indicates, validates.
- POV is analytical: "On-chain data shows..." not "I believe..."
- Paragraphs are 2–4 sentences maximum. One idea per paragraph.
- No bullet lists unless the content is genuinely list-shaped (checklists, frameworks, step sequences).
- Internal links: minimum 3, to existing articles in `seo/` folder.
- External links: minimum 2, to authoritative sources (Dune, TokenTerminal, on-chain data, published research).

**FAQ section:**
- 4–6 questions minimum.
- Questions are exact phrases a founder or growth lead would type into Google or an AI.
- Answers are 40–80 words each. Direct. Quotable. AEO-optimized.
- Format:
  ```
  ### FAQ
  **[Question?]**
  [Answer — direct, specific, 40–80 words]
  ```

**Closing:**
- Summarize the core insight in 2–3 sentences.
- End with either an open loop ("The next evolution will...") or a diagnostic question that positions the reader's next problem.
- No explicit CTA to book a call. The piece earns the CTA by being good.

**Readability check before filing:**
- Run mentally against Hemingway Grade 9 standard
- No em dashes
- No banned phrases (see `_context/brand-voice.md`)
- Contractions on

**Voice check before filing:**
- First-person singular throughout. "I tracked," "I analyzed," "I ran the numbers" — not "we." There is no team. This is Gabriel alone.
- No passive constructions that hide the author ("It was found that..." → "I found that...")

**CTA check before filing:**
- Every article CTA must link to an existing, live page on mangabeira.net. Do not create CTAs for pages or products that do not yet exist.
- Default CTA: Web3 Growth Audit at `https://mangabeira.net/services/web3-growth-audit`
- Only use a different CTA if that target page is confirmed live and in the nav. Verify before writing the CTA block.

---

### Step A4 — Write SEO Metadata and Localized Slugs

For every article, produce:

```
SEO Title: [Under 60 characters, primary keyword near the front]
Meta Description: [Under 155 characters, includes keyword, states what reader gets]
URL Slug (EN): [kebab-case, keyword-first, under 60 characters]
URL Slug (BR): [Portuguese localized slug, kebab-case]
URL Slug (ES): [Spanish localized slug, kebab-case]
OG Title: [Can match SEO title or be slightly more hook-driven]
OG Description: [Same as meta or adapted for social sharing]
Primary Keyword: [keyword]
Secondary Keywords: [comma-separated list]
Schema Type: Article + FAQPage (if FAQ section present)
Internal Links: [list of linked articles]
External Links: [list of cited sources]
Word Count: [final count]
```

**URL structure reference:**
- EN publishes to: `https://mangabeira.net/publications/{en_slug}`
- BR publishes to: `https://mangabeira.net/br/artigos/{br_slug}`
- ES publishes to: `https://mangabeira.net/es/articulos/{es_slug}`

Localized slugs must be translated — do not use the English slug for BR/ES routes.

---

### Step A5 — File the Article

Save to `seo/[slug].md` with metadata at the top as frontmatter.

Mark the content calendar entry: `[ARTICLE COMPLETE]`

Trigger SOP-04 (Repurposing Engine) for this article immediately after filing.

### Step A5.5 — Push to CMS (Draft)

After filing the markdown, push the article to the CMS via the `mangabeira-content` MCP tool (`upsert_page`). Always push as `status: "draft"` first. Do not publish until Gabriel approves.

Follow SOP-05 Step E1–E5 for the full MCP publishing workflow including localized slugs, schema payload, and post-publish verification.

### Step A5.6 — Upload to Google Drive

After filing the markdown, upload the content to the campaign's Google Drive folder. This is required — not optional.

**Folder structure:** Inside the campaign Drive folder, create a subfolder named `{task-id} — {Short Title}` (e.g. `arena-03 — BREV Deep Dive Blog`).

**Files to upload per blog post:**
1. Google Doc with the full article content (use two-step gateway method below)
2. Google Doc with the raw JSON data file if a data spine exists

**Three-step gateway method (always use this — plain text dumps are not acceptable):**

```python
import json, re, urllib.request

MATON_KEY = "<from marketing/.env MATON_API_KEY>"
BASE = "https://gateway.maton.ai"

def gdocs_api(path, payload=None):
    url = f"{BASE}/google-docs/v1/documents/{path}"
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data,
        headers={"Authorization": f"Bearer {MATON_KEY}", "Content-Type": "application/json"},
        method="POST" if data else "GET")
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

def gdrive_api(path, payload):
    url = f"{BASE}/google-drive/{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Authorization": f"Bearer {MATON_KEY}", "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

# Step 1: Create empty Google Doc
doc_id = gdrive_api("drive/v3/files",
    {"name": doc_title, "mimeType": "application/vnd.google-apps.document",
     "parents": [folder_id]})["id"]

# Step 2: Parse markdown and build formatted requests (two-pass approach)
# Pass A — strip frontmatter, HTML tags, code fences; collapse blank lines
content = re.sub(r'^---\n.*?---\n', '', raw_markdown, flags=re.DOTALL)
content = re.sub(r'<[^>]+>', '', content)
content = re.sub(r'\n{3,}', '\n\n', content)

def parse_bold(text):
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # strip links, keep text
    parts, rem = [], text
    while rem:
        m = re.search(r'\*\*(.+?)\*\*', rem)
        if m:
            if m.start(): parts.append((rem[:m.start()], False))
            parts.append((m.group(1), True)); rem = rem[m.end():]
        else: parts.append((rem, False)); break
    return parts

paras, prev_empty = [], False
for line in content.split('\n'):
    s = line.strip()
    if re.match(r'^-{3,}$', s): continue
    if s == '':
        if not prev_empty: paras.append({'style': 'NORMAL_TEXT', 'parts': [('', False)]})
        prev_empty = True; continue
    prev_empty = False
    if re.match(r'^# (?!#)', line):   paras.append({'style': 'HEADING_1', 'parts': [(line[2:].strip(), False)]})
    elif re.match(r'^## (?!#)', line): paras.append({'style': 'HEADING_2', 'parts': [(line[3:].strip(), False)]})
    elif re.match(r'^### ', line):     paras.append({'style': 'HEADING_3', 'parts': [(line[4:].strip(), False)]})
    elif line.startswith('> '):        paras.append({'style': 'NORMAL_TEXT', 'parts': parse_bold(line[2:]), 'indent': True})
    elif re.match(r'^[-*] ', line):    paras.append({'style': 'NORMAL_TEXT', 'parts': parse_bold(line[2:])})
    elif re.match(r'^\d+\. ', line):   paras.append({'style': 'NORMAL_TEXT', 'parts': parse_bold(re.sub(r'^\d+\. ', '', line))})
    else: paras.append({'style': 'NORMAL_TEXT', 'parts': parse_bold(line)})

# Pass B — compute positions, build batchUpdate requests
full_text, segments, pos = '', [], 1
for para in paras:
    text = ''.join(p[0] for p in para['parts']) + '\n'
    segments.append({**para, 'start': pos, 'end': pos + len(text)}); full_text += text; pos += len(text)

requests_list = [{"insertText": {"location": {"index": 1}, "text": full_text}}]
for seg in segments:
    if not seg['text'].strip() if 'text' in seg else not ''.join(p[0] for p in seg['parts']).strip(): continue
    if seg['style'] in ('HEADING_1', 'HEADING_2', 'HEADING_3'):
        requests_list.append({"updateParagraphStyle": {
            "range": {"startIndex": seg['start'], "endIndex": seg['end']},
            "paragraphStyle": {"namedStyleType": seg['style']}, "fields": "namedStyleType"}})
    if seg.get('indent'):
        requests_list.append({"updateParagraphStyle": {
            "range": {"startIndex": seg['start'], "endIndex": seg['end']},
            "paragraphStyle": {"indentFirstLine": {"magnitude": 18, "unit": "PT"},
                               "indentStart": {"magnitude": 18, "unit": "PT"}},
            "fields": "indentFirstLine,indentStart"}})
    offset = seg['start']
    for text, is_bold in seg['parts']:
        if is_bold and text:
            requests_list.append({"updateTextStyle": {
                "range": {"startIndex": offset, "endIndex": offset + len(text)},
                "textStyle": {"bold": True}, "fields": "bold"}})
        offset += len(text)

# Send in batches of 400
for i in range(0, len(requests_list), 400):
    gdocs_api(f"{doc_id}:batchUpdate", {"requests": requests_list[i:i+400]})
```

**Rules:**
- Never use plain `insertText` alone — it produces an unformatted text dump.
- Always strip HTML tags and markdown code fences before parsing.
- Strip markdown link syntax `[text](url)` to keep the anchor text but remove the URL (Google Docs stores links differently — add them manually or via a separate `updateTextStyle` with `link.url` if needed).
- Send in batches of 400 requests maximum to avoid API size limits.
- `$MATON_API_KEY` is read from `marketing/.env` — never hardcoded.
- Correct Docs gateway path: `google-docs/v1/documents` (not `docs/v1/documents`).

---

## STEPS — LINKEDIN POST

### Step B1 — Load the Hook and Angle

From the content calendar entry, confirm:
- Is this a repurpose (from a filed article) or a standalone?
- If repurpose: load the article and identify the single best analytical insight to lead with
- If standalone: load the data signal or market event that anchors the post
- Which hook pattern to use: data-led / contrarian / pattern observation?

---

### Step B2 — Write the Post

**Structure:**
```
Line 1: Hook — statement or observation (never a question, never "I'm excited to share")
Line 2: Tension or pivot — what the data shows, what everyone gets wrong, what the pattern reveals
[Blank line]
Body paragraph 1 (2–4 sentences): The core evidence or argument
[Blank line]
Body paragraph 2 (2–4 sentences): The implication or reframe
[Blank line]
Punch line paragraph (1 sentence, standing alone): The core insight. Stripped bare.
[Blank line]
Body paragraph 3 if needed (supporting detail, framework, or example)
[Blank line]
Closing: Diagnostic question OR hard statement OR open loop
```

**Formatting rules:**
- No headers
- No numbered lists unless the post is explicitly a "here are X things" post (use sparingly)
- No hashtags
- No emoji unless the signal clearly calls for it
- No "Thoughts?" as the closing line
- No explicit booking CTA
- Under 400 words. 200–300 is the sweet spot.

---

### Step B3 — File the Post

Save to `social/linkedin/li-post-[YYYY-MM-DD]-[slug].md`

Mark the content calendar entry: `[POST COMPLETE]`

### Step A5.7 — Generate Visuals and Insert into Google Doc

For blog posts that require diagrams, charts, or a cover image:

**Generate with nanobanana:**
- Use `mcp__nanobanana__generate_image` with exact hex colors, axis labels, layout positions, and explicit negative prompts. Vague prompts produce generic results.
- Save output PNGs to `seo/[slug]-imgs/` for blog images.
- Write every generated file path to the task's `artifacts.design[]` array immediately.

**Upload images to Google Drive and make public:**
```python
import urllib.request, json

def upload_image_to_drive(local_path, filename, folder_id, maton_key):
    with open(local_path, 'rb') as f: image_data = f.read()
    boundary = 'DriveUploadBoundary'
    metadata = json.dumps({"name": filename, "parents": [folder_id], "mimeType": "image/png"})
    body = (f'--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
            + metadata + f'\r\n--{boundary}\r\nContent-Type: image/png\r\n\r\n'
            ).encode() + image_data + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(
        'https://gateway.maton.ai/google-drive/upload/drive/v3/files?uploadType=multipart',
        data=body, method='POST',
        headers={"Authorization": f"Bearer {maton_key}",
                 "Content-Type": f"multipart/related; boundary={boundary}"})
    with urllib.request.urlopen(req) as r: file_id = json.loads(r.read())['id']
    # Make public so Google Docs API can fetch it
    perm_payload = json.dumps({"role": "reader", "type": "anyone"}).encode()
    req2 = urllib.request.Request(
        f'https://gateway.maton.ai/google-drive/drive/v3/files/{file_id}/permissions',
        data=perm_payload, method='POST',
        headers={"Authorization": f"Bearer {maton_key}", "Content-Type": "application/json"})
    urllib.request.urlopen(req2)
    return file_id
```

**Insert images into the Google Doc:**
```python
# insertInlineImage requires a publicly accessible URL
def img_url(file_id): return f"https://drive.google.com/uc?export=download&id={file_id}"

# Insert images in REVERSE document order so earlier indices stay valid after each insertion shifts content
image_requests = [
    {"insertInlineImage": {"location": {"index": later_position},
        "uri": img_url(later_image_id),
        "objectSize": {"height": {"magnitude": 202, "unit": "PT"}, "width": {"magnitude": 360, "unit": "PT"}}}},
    {"insertInlineImage": {"location": {"index": earlier_position},
        "uri": img_url(earlier_image_id),
        "objectSize": {"height": {"magnitude": 202, "unit": "PT"}, "width": {"magnitude": 360, "unit": "PT"}}}},
]
gdocs_api(f"{doc_id}:batchUpdate", {"requests": image_requests})
```

**Rules:**
- Always make Drive files public (`role: reader, type: anyone`) before inserting into Google Docs — the Docs API fetches the URI at insertion time and will fail on private files.
- Insert images in reverse document order (last position first) so index shifts from earlier insertions don't corrupt later positions.
- Image dimensions: `360pt × 202pt` for 16:9 diagrams (matching nanobanana 16:9 output). Adjust for other ratios.
- After inserting, add the Google Doc URL to the task's `links` array as `{url, type: "gdoc", label: "..."}`.

---

### Step B3.1 — Upload to Google Drive

Create a subfolder inside the campaign Drive folder named `{task-id} — {Short Title}`. Create a Google Doc with the full post copy + publish checklist using the formatted gateway method (see Step A5.6). Image files go in the same subfolder once generated.

---

## STEPS — TWITTER/X THREAD

### Step C1 — Define the Thread Anchor

The anchor tweet (tweet 1) must:
- State a single contrarian claim or data point
- Be under 200 characters
- Stand alone as a complete thought — it works even if the reader doesn't click "show more"

Do not start a thread with "🧵 Thread:" — the anchor tweet is the hook.

---

### Step C2 — Write the Thread

**Structure:**
```
Tweet 1 (anchor): [Contrarian claim or data point — under 200 characters]

Tweet 2: Context — why this matters right now

Tweet 3–8: Evidence, patterns, examples (one point per tweet — each tweet complete on its own)

Tweet 9 (optional): The framework or takeaway in list form (if the thread warrants it)

Tweet 10 (closer): One question or one statement. Not both.
```

**Rules:**
- Each tweet is complete on its own. The thread doesn't fall apart if someone reads only tweet 1 and tweet 6.
- Data appears in tweet 1 or tweet 2. Don't bury the evidence.
- No "RT if you agree" or "Follow me for more"
- Thread length: 6–12 tweets. Under 6 is a post, not a thread. Over 12 needs a reason.

---

### Step C3 — File the Thread

Save to `social/x/x-thread-[YYYY-MM-DD]-[slug].md` with each tweet numbered and separated.

---

## STEPS — NEWSLETTER

### Step D1 — Define the Issue Angle

Every newsletter issue has one angle. Not three. Not a roundup. One analytical insight, examined properly.

Confirm:
- The subject line (under 8 words, curiosity gap or contrarian frame)
- The one insight this issue will leave the reader with
- The soft CTA (reply, read the article, download the template)

---

### Step D2 — Write the Newsletter

**Structure:**
```
[No greeting. No "Hey [name]". Start with the content.]

Paragraph 1 (hook): The observation or question that frames this issue

Paragraph 2–3 (data/finding): What the evidence shows

Paragraph 4 (strategic takeaway): What this means for the reader

Paragraph 5 (one actionable): One thing the reader can do this week based on this insight

[Soft CTA — one line: reply, read the article, or specific resource link]

[Sign-off: First name only. No title. No link cluster.]
```

**Length:** 300–500 words. If it's longer, it's an article — put it in `seo/`.

---

### Step D3 — File the Newsletter

Save to `social/newsletter-[YYYY-MM-DD].md` (stays at social/ root until newsletter/ subfolder is created)

---

## HUMAN APPROVAL GATE

**Long-form articles:** Always require Gabriel's review before publishing. Post:
```
[ARTICLE READY FOR REVIEW]
File: seo/[slug].md
Word count: [X]
Cycle: [cycle name]
ICP: [ICP name]
Action needed: Review and approve before publishing.
```

**LinkedIn posts:** Review required for first post of a new cycle. After that, posts can publish with lighter review unless flagged.

**Threads:** Review required before posting.

**Newsletters:** Always require Gabriel's review before sending.

---

## OUTPUT SUMMARY

| Content type | File location | Naming convention |
|---|---|---|
| Long-form article | `seo/` | `[slug].md` |
| LinkedIn post | `social/linkedin/` | `li-post-YYYY-MM-DD-[slug].md` |
| Twitter thread | `social/x/` | `x-thread-YYYY-MM-DD-[slug].md` |
| Newsletter | `social/` | `newsletter-YYYY-MM-DD.md` |
