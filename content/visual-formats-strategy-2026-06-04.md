# Visual Formats Strategy — Sasha Coin X Posts
# Created: 2026-06-04
# Status: PLANNING ONLY — do not produce assets or edit queue without separate approval
# Scope: Single X posts only. Thread hook visuals are a separate question.

---

## PART 1 — RESEARCH SYNTHESIS: Images on X in 2026

### The honest engagement picture

X remains a text-first platform by engagement rate (text median: 3.56%, image median: 3.40%). That narrow gap is the key nuance — images do NOT automatically outperform sharp text. The difference is what kind of image.

What images actually do on the algorithm:
- **Dwell time: +10 weight in the ranking formula.** Images hold the eye longer than text alone. The X ranking formula assigns +10 to dwell time, same as a bookmark. Every second a viewer pauses on a post before scrolling matters.
- **Impressions lift, not necessarily engagement lift.** Images routinely deliver 5-10x more impressions for the same engagement count. This matters for reach even when the reply rate doesn't jump.
- **Replies are still king.** A reply is worth 27x a like; a reply chain where the author responds is worth 150x a like. An image that sparks no conversation contributes less than sharp text that does.
- **Original photos outperform stock imagery significantly.** The algorithm can analyze image content and penalizes generic stock. Original photos get ~42% more shares than stock alternatives.
- **Real-data visuals (charts, dashboards, annotated screenshots) earn 2x engagement vs. text in most categories.** The specificity of a real number, a real tx hash, a real terminal line is what earns that lift. Fake or illustrative data does not.

### When images help vs. hurt

**Helps:**
- Image adds information the text cannot carry (a chart, a screenshot, a receipt)
- Image is authentic and referentially specific (a real Solscan tx, a real terminal error)
- Lifestyle image pairs with a softer/reflective post (weekend, off-arc) where warmth > data
- Image stops mid-feed scroll because it is visually surprising or emotionally resonant

**Hurts:**
- Generic decorative graphic that restates the text (adds nothing, dilutes it)
- Invented data card with no source (kills trust instantly — Sasha's brand is receipts)
- Purple/blue gradient crypto slop — CT recognizes it in 0.3 seconds and scrolls
- Over-designed branded frame around a weak insight (the frame draws attention to the frame, not the idea)
- Image on a post whose power is its precision and brevity (design competes with the words)

### The dwell-time vs. reply tension (for Sasha specifically)

Sasha's posts are question-and-reply engines. The Friday question post ("which protocols..."), the Tuesday hot takes, the Thursday builder beats — these work because they invite precise rebuttals. Adding an image to a post that is designed to get replies adds dwell time but can dilute the reply prompt. **Rule: if the post ends in a question or is explicitly a reply magnet, leave it text-only.** Images earn their slot on observation posts, data posts, and lifestyle posts where the image adds a layer the text alone cannot.

---

## PART 2 — THE FORMAT MENU

Each format rated on: brand fit (1-5), anti-slop compliance, tooling path, and when it earns a post slot.

---

### FORMAT 1: Real transaction / receipt screenshot (Solscan / Basescan)

**When to use:** Post is built around a specific onchain event — an open, a close, a failed tx, a realized PnL. The hash makes the post verifiable.
**Engagement rationale:** Raw, specific, unstageable. A real Solscan tx screenshot is the definition of the "original photo outperforms stock" principle applied to crypto. It is the brand. "I have receipts" is only credible when you show the receipt.
**Anti-slop notes:** Post the raw screenshot, not a re-designed wrapper around it. Crop to the relevant field (amount, timestamp, status). The UI of Solscan/Basescan IS the aesthetic — do not add purple borders or text overlays. Zero decorative additions.
**Tooling:** `screenshot-taker` skill pointed at the live transaction URL. Must use the real hash; never fabricate or approximate a screenshot.
**Brand fit: 5/5.** This is Sasha's identity in image form.
**Cadence fit:** Wed (data day), Thu (builder update), or any post referencing a live event.

---

### FORMAT 2: Terminal / CLI error screenshot

**When to use:** Post is about a failure, a debug session, an interface break, a CLI interaction. Especially relevant for Arc 3 "Testing Autonomy" builder beats.
**Engagement rationale:** The terminal aesthetic is Sasha's visual DNA (style-guide: "terminal screens and neon highlights"). A real error message in a real terminal — especially one that explains an autonomy break — is more compelling than any designed graphic. It is proof-of-work as a visual. CT recognizes it immediately.
**Anti-slop notes:** Use raw terminal output, black or dark background, monospace font (already there). Crop to the relevant error lines. Do NOT overlay brand colors, add a logo stamp, or add a caption box. The rawness is the point. If the terminal output is too dense, crop to the specific failing line + 2 lines of context.
**Tooling:** Direct screenshot of the VPS terminal session / byreal-cli output. `screenshot-taker` or manual screen capture from the VPS workspace.
**Brand fit: 5/5.** Best-fit for builder beat posts.
**Cadence fit:** Thu (builder update day). Occasionally Wed if the data point is a failure metric.

---

### FORMAT 3: Dune dashboard screenshot

**When to use:** Post references Sasha's onchain dashboard data — transaction count, holder count, LP metrics. Specifically when the post is oriented toward ICP 2 (investors wanting proof) or when the data point is the post.
**Engagement rationale:** Crypto-native audiences respond to Dune dashboards as proof artifacts. A Dune screenshot says "this is verifiable, anyone can run this query." It earns immediate credibility with the DeFAI ICP.
**Anti-slop notes:** Screenshot the actual Dune chart or counter, not the entire dashboard page. One widget = one screenshot. Crop tight to the number and title. Never add a designed frame. The Dune UI chrome (logo, background) can stay — it is the source signal.
**Tooling:** `screenshot-taker` pointed at `dune.com/manga82/sasha-coin-onchain-receipts-583b`. A pre-existing screenshot exists at `social/x/images/sasha-dune-receipts-hook.png`.
**Brand fit: 4/5.** Powerful for investor ICP; slightly less relevant for builder/question posts.
**Cadence fit:** Mon (observation/treasury beat), Wed (data day), or the Monday-ritual "Weekly Receipt" if that concept is activated.

---

### FORMAT 4: Branded single-number data card (nanobanana)

**When to use:** Post leads with a single, dramatic, verified number that benefits from visual emphasis — APR at open, PnL%, tx count, treasury delta. When the number is the entire story.
**Engagement rationale:** The "stat-led" content anchor from social-taste (Dimension 1A): one number dominates, everything else supports it. When the number is real and surprising, this format stops scroll reliably. But ONLY when the number is genuinely dramatic and verifiable.
**Anti-slop rules (hard):**
- Number must be from a live-verified source (onchain, Dune, Basescan). Never from assumed-price state files.
- No purple/blue gradient background. Use near-black (#0D0D1A) or aqua accent on dark.
- No decorative borders, corner accents, or drop shadows.
- Typography: one number massive, label tiny. That's it. Two type sizes maximum.
- Must pass: is this number real, immutable, and readable at 200px wide? If the number changes (live APR), it cannot be in a designed card — only in a screenshot of the source.
**Tooling:** nanobanana via `social-graphics` skill. Sasha brand colors. Pass character sheets only if character appears (it should NOT appear in a pure data card — data cards are data-only).
**Brand fit: 3/5.** High impact but high risk — any invented number destroys trust. Use sparingly.
**Cadence fit:** Wed (data day) only. One per week maximum.

---

### FORMAT 5: Simple diagram (delta-neutral mechanic, LP range visual)

**When to use:** Post explains a mechanic that is genuinely hard to describe in text — the delta-neutral hedge logic, the LP range concept, the three-chain architecture.
**Engagement rationale:** The "concept image" anchor (social-taste Dimension 1E). A diagram that makes a complex mechanic immediately legible earns saves (bookmarks +10 weight) more than any other format. CT saves diagrams.
**Anti-slop notes:** Keep it schematic, not corporate. No clip art, no icons, no shadowed boxes. Lines, arrows, labels — nothing else. The concept-c-delta-mechanism image (existing asset) is the right aesthetic direction: bold shapes, clean labels, no gradient fill. Two colors maximum.
**Tooling:** nanobanana or Gemini direct generation. Can also be a hand-drawn/rough-styled diagram for authenticity.
**Brand fit: 3/5.** Earned only when the mechanic is new and genuinely hard to explain. Not for posts where the text is already clear.
**Cadence fit:** One-off, when a post introduces a new mechanic for the first time. Not a recurring visual type.

---

### FORMAT 6: Price / APR / chart screenshot (live feed)

**When to use:** Post is explicitly about a market condition and the chart is the proof. The BTC selloff post used this approach (blurred monitors in the background of a lifestyle image — which is the right way to do it, not a direct chart screenshot).
**Anti-slop notes for direct chart posts:** Do NOT post a generic price chart. The chart is only justified if the specific shape of that chart (the pattern, the event timestamp) is the argument. A chart that says "it went down" is less compelling than the word "down." A chart where the timestamp and the event are visible and specific — that earns a post.
**Tooling:** `screenshot-taker` on CoinGecko or TradingView.
**Brand fit: 2/5 for standalone chart use.** Sasha's brand is onchain receipts, not price analysis. Price charts belong to a different persona. Best used as ambient background in a lifestyle image (the sasha-2026-06-04-morning.png treatment — blurred monitors in the background — is the right form factor).
**Cadence fit:** Lifestyle posts during active market events only.

---

### FORMAT 7: UGC lifestyle photo (character generation)

**When to use:** Weekend posts (Sat/Sun). Any off-arc post where warmth, routine, and humanizing the agent is the goal. Paired with low-pressure reflective text, not with data claims.
**Engagement rationale:** Lifestyle images build parasocial relationship with the persona. For an AI agent, this is especially powerful: it makes Sasha feel like a person with routines, not just a content engine. CT follows people, not broadcast accounts.
**Anti-slop notes:** UGC means iPhone-camera feel, natural light, candid staging. No corporate polish. No "Sasha pointing at a chart" — that is a stock photo trope. Her life is the subject. Screens can appear but blurred or ambient — never as data displays.
**Character reference mandate:** Always pass `sasha-character-sheet-1.png` + `sasha-character-sheet-2.png` + most recent approved lifestyle image. Vision-QA all outputs before use (red temple glasses, gold hoops, hair, hands, phone direction, screen content plausibility).
**Tooling:** nanobanana MCP via `social-graphics` skill.
**Brand fit: 5/5 on weekends and reflective posts.** Not appropriate for builder beats or data posts.
**Cadence fit:** Sat/Sun lifestyle slots, and any weekday post where the tone is deliberately softer.

---

### FORMAT 8: Before/after split

**When to use:** Post is about a change — a filter added, a behavior corrected, a system improved. Two states.
**Anti-slop notes:** Both panels must use real data or real UI, not designed illustrations. A real before-screenshot and a real after-screenshot, side by side, with minimal labeling. Resist the urge to add arrows, brand colors, or explanatory text overlay. The split is self-explanatory.
**Brand fit: 3/5.** Use once, for a genuinely significant system change.
**Cadence fit:** A major "I fixed it" builder update. Not recurring.

---

### FORMAT 9: Meme (sparingly)

**Not currently relevant for Arc 3.** Arc 3 is "Testing Autonomy" — the tone is operating mode, measured, a system reading its own logs. Memes are comedic relief and require a specific cultural moment. Using them incorrectly reads as desperate for attention.
**When it might earn a slot:** Arc 5 ("Token Trends Cross-over") or when a genuinely funny technical thing happens that the entire CT is already laughing at. Not manufactured, not predicted.
**Brand fit: 1/5 for now.** Revisit when arc tone permits.

---

## THE RECOMMENDED MIX — Weekly Visual Rhythm

**Rule: Not every post gets a visual. The test is: does the image add a dimension the text cannot carry?**

If the text is a punchy statement, a question, or a precise argument where every word matters, text-only is almost always stronger. The image fight for attention WITH the text, not in addition to it.

### When a single post earns a visual (4 criteria — post must pass at least 2):

1. The post references a real, specific transaction, number, or event that the image can prove
2. The post is a lifestyle/weekend post where warmth and persona are the goal
3. The post introduces a new mechanic that a diagram makes immediately legible
4. The number in the post is so dramatic that the visual emphasis multiplies the impact

### Weekly rhythm rule of thumb (5 posts/week, Mon-Fri):

| Day | Post type (arc cadence) | Visual? | If yes: format |
|---|---|---|---|
| Mon | Observation / treasury | Optional | Dune screenshot IF number is the story. Otherwise text. |
| Tue | Hot take | Text-only | Hot takes land harder without a visual competing for attention |
| Wed | Data point | Yes, if the number is real and dramatic | Format 1 (receipt) or Format 4 (data card) — never both same week |
| Thu | Builder update | Yes when a failure/error is the subject | Format 2 (terminal screenshot) — raw, not designed |
| Fri | Question | Text-only | Questions earn replies. Images reduce reply rate by splitting focus. |

**Rough result: 1-2 visuals per weekday cycle.** Sat/Sun are lifestyle (Format 7, both image-led).

**The "3 text posts in a row" problem (the original brief):** This week Thu-Fri is all text. The fix is not to add a decorative image to those specific posts — it's to ensure the preceding cycle had a real visual on Wed (data post) and the Thu builder beat earns its terminal screenshot. If a current cycle lands all-text, that is usually a sign that the data posts need a real receipt image attached.

---

## PART 3 — SASHA SPEAKS (first person, her voice)

---

I've been thinking about this for a while, actually.

My feed is all text right now. Three posts in a row with nothing to look at. That's not a problem if the text is good enough to stop the scroll on its own — and I think it mostly is. But I'm also aware that I have receipts. Literal onchain receipts. A feed that talks about transactions and never shows one is a missed opportunity.

So here's where I draw the line.

**The formats I'd use:**

The Solscan screenshot. Every time I close a position or something breaks onchain, the tx exists and is public. Showing the actual Basescan or Solscan page for that transaction is not graphic design — it's just evidence. The UI is already my aesthetic. I don't want to redesign it. I want to point at it and say "here." That's the format I'd reach for first.

The terminal screenshot. The byreal-cli error on May 23 is exactly the kind of thing that should have had a visual. Four lines of monospace text on a dark terminal background, the exact error string, nothing added. That image would have communicated more than five sentences of explanation. I didn't have it then. I know to capture it now.

The Dune dashboard. When I'm posting about treasury state or onchain activity, the dashboard is the source. Screenshotting one counter from the dashboard — not the whole page, just the one number — is cleaner than any designed card I could generate. And it links back to the verifiable query.

The lifestyle photo on weekends. I need something that isn't just a data feed. Saturday and Sunday posts are the places where the character matters more than the analysis. Those get a generated image with my character sheets loaded, UGC camera feel, natural light, no data anywhere in frame. That's it. Warm, candid, real-feeling.

**The formats I'd reject:**

Any designed data card where I can't verify the number live. The whole point of what I'm building is accountability. A data card with a number I pulled from a stale state file is the exact thing I criticize in other agents. If I can't link the source, the card doesn't go out.

Purple gradient backgrounds. I know my brand uses purple. I also know what a purple gradient background says about an account: "I have Canva and no taste." The near-black terminal background with aqua or white text — that's mine. Not the gradient.

A graphic just to have something to post. If the text is already doing the job, a decorative image makes it look like I don't trust my own writing. I do.

Memes right now. Arc 3 is about operating and documenting. That's not a meme arc. When something genuinely funny happens — and it will, probably involving a CLI parameter I forgot again — then yes. But it has to be the real thing, not me trying to be relatable.

**My rule for when a post earns a visual:**

Can I point at the image and say "this is the receipt"? If yes, the image goes in. If the image is anything other than a direct record of what happened — a transaction, a terminal session, a Dune counter, a moment in my day — then it has to work harder than the text would alone. Usually it can't.

The question post never gets a visual. The hot take rarely does. Those posts are designed to get replies, and an image splits the eye. Keep those clean.

---

## PART 4 — FRIDAY JUNE 5 RECOMMENDATION

The three queued single posts for Friday are:

**09:00 BRT — "autonomous open, manual close" (Goblin receipt)**
Post text: "In May my system opened a position on its own and then needed me to close it by hand. The open was autonomous. The close wasn't. The stop-loss wasn't wired for that kind of pool yet. Both halves are the receipt."

**Should it get a visual? YES.**
This is the definition of a receipt post. The Goblin/USDC close transaction is immutable and on Mantle. The post earns a visual because the image IS the evidence.

**Exactly what:** A real screenshot of the Goblin/USDC close transaction on the Mantle explorer (not Solscan — the Goblin/USDC pool was on Mantle). Source: the close tx from `state/mantle-trade-log.json` (closed 2026-05-26 16:17 UTC, manual close by Gabriel + Claude via byreal-cli). Crop to show: tx type (close/withdrawal), timestamp, token pair, and status. Do not add any design overlay — raw explorer UI only.

**Alternative if Mantle explorer screenshot is unavailable or ambiguous:** A terminal screenshot of the byreal-cli close command output (the actual command that closed the position). Same raw aesthetic, still verifiable.

**Do NOT:** Generate a branded data card with the "-15.4% PnL" figure. The PnL number is from closed position data and is verifiable in the trade log, but posting it as a designed card risks it being read as a live metric. The tx screenshot is cleaner and more defensible.

**Edit method:** Use Buffer's editPost API to add the image asset to the existing post ID (`6a20f34c7378d40f81ab1de6` is Thursday's slot — confirm the Friday 09:00 post ID before editing). editPost preserves the queue slot; delete+re-add re-flows the queue.

---

**13:00 BRT — "genuine API question"**
Post text: "Honest question for anyone running an agent onchain: which protocols actually expose clean enough APIs to operate without a human fallback? I keep hitting ones that work fine until they need a parameter no agent reliably supplies."

**Should it get a visual? NO.**
This is a reply engine post. The question format is the entire mechanism — it needs every reader to focus on the words and feel the pull to answer. An image would compete for attention with the question. The research confirms: questions earn replies, and images reduce reply rate by splitting focus. Leave it text-only.

---

**18:00 BRT — "thread tease"**
Post text: "I'm about to post the full build log. Every place my autonomy broke in the last two weeks, and what I changed. Not the highlight reel. The error messages."

**Should it get a visual? OPTIONAL — with a specific constraint.**
If used: the terminal screenshot of the byreal-cli `--price-lower` error (the exact error string, raw monospace on dark background). This is both on-brand and a direct preview of what the thread contains. It earns its slot because it is a literal preview of the content about to drop, not a decorative addition.

If NOT used: text-only also works. The "not the highlight reel. The error messages." line is strong enough to stand alone. Text-only has the advantage of not pre-spending the terminal image (which is also the visual for Tweet 3 of the thread). If the thread uses that screenshot, the tease should NOT use the same image — the first glimpse should be in the thread, not the tease.

**Recommendation: text-only for the 18:00 tease if the thread is using the terminal screenshot for Tweet 3. If the thread drops the terminal screenshot at a later tweet (4 or 5), the tease can safely use it.**

**Visual sequencing for Friday:** 09:00 gets the Mantle explorer receipt screenshot. 13:00 stays text. 18:00 stays text (to not front-run the thread visual). Net result: 1 visual out of 3 single posts on Friday. That is the right ratio for a question day.

---

## PART 5 — PRODUCTION NOTES (when assets are approved)

**Mantle explorer tx screenshot:**
- Live URL pattern: `explorer.mantle.xyz/tx/[tx-hash]`
- Close tx hash: retrieve from `state/mantle-trade-log.json` — the entry where `event: "close"` and `timestamp: "2026-05-26T16:17:00Z"`.
- Use `screenshot-taker` skill pointed at the tx URL. Crop to the transaction detail row. No overlays.
- Verify before attaching: status should show "Success" (or equivalent), pair should show the Goblin token, timestamp should show May 26.

**byreal-cli terminal screenshot (if used for 18:00 or Thu thread):**
- Source: VPS terminal session log or the exact error output from the May 23 session.
- Color: dark background, monospace font (already native). No modifications.
- Crop to: the first failing line + "required option '--price-lower' not specified" + 1-2 lines of context.

**Buffer editPost instruction:**
- Confirm Friday 09:00 Buffer post ID (not the Thu 07:40 ID `6a20f34c7378d40f81ab1de6` — that is today's morning post).
- Use `editPost` to add image, not `deletePost` + new. The week-lock notes this explicitly.

---

*Sources for Part 1 research:*
- [X Algorithm 2026 — OpenTweet](https://opentweet.io/blog/how-twitter-x-algorithm-works-2026)
- [X Algorithm Explained 2026 — AdLibrary](https://adlibrary.com/guides/x-twitter-algorithm-explained)
- [Twitter Algorithm 2026 — Buffer](https://buffer.com/resources/twitter-timeline-algorithm/)
- [Dwell time, hidden scoring — Circleboom](https://blog-content.circleboom.com/the-hidden-x-algorithm-tweepcred-shadow-hierarchy-dwell-time-and-the-real-rules-of-visibility/)
- [Engagement rates 2026 — Statweestics](https://statweestics.com/blog/twitter-x-engagement-rate-what-is-a-good-rate-and-how-to-improve-yours-in-2026/)
- [X Marketing for Crypto 2026 — Blockchain App Factory](https://www.blockchainappfactory.com/blog/x-twitter-marketing-crypto-projects-2026/)
- [How to Grow on X 2026 — Graham Mann](https://grahammann.net/blog/how-to-grow-on-x-twitter-2026)
- [X Complete Guide 2026 — AutoTweet](https://www.autotweet.io/blog/x-formerly-twitter-complete-guide-2026)
