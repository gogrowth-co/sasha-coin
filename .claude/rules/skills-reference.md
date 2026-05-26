# Skill-to-Task Routing Table

This workspace integrates with installed Claude Code skills. Use these when they match the task:

| Skill | Use when... |
|---|---|
| `linkedin-writer` | Writing LinkedIn posts, building content strategy, drafting hooks |
| `running-marketing` | Building the ongoing marketing engine, content strategy, social publishing |
| `collecting-intelligence` | Competitor research, customer interviews, market research |
| `crafting-positioning` | Market positioning, messaging, UVP/USP, visual identity |
| `validating-customers` | Validating ICP, testing assumptions, customer personas |
| `setting-pricing` | Pricing strategy, willingness-to-pay research |
| `building-product` | MVP definition, product roadmap, JTBD analysis |
| `building-communication-engine` | Channel strategy, launch newsletter, GTM budget, social proof |
| `preparing-launch-assets` | Website, pitch deck, press release, media kit |
| `executing-launch` | Launch war room, launch day activities, support network |
| `building-gtm-system` | CRM setup, SOPs, growth experiments, GTM motions |
| `executing-sales` | Sales deck, case studies, outbound campaigns, ABM |
| `gtm-foundations` | SWOT, value proposition canvas, 90-day GTM plan |
| `gtm-personal-brand` | Full GTM methodology for personal brand service businesses (consultants, fractional executives). Four-phase sprint roadmap (Foundation → Activation → Active Outreach → Paid/Events), exchange-rate pricing for LATAM/emerging market practitioners, season/episode content architecture, lead magnet sequencing, conference window strategy, discovery call funnel. Use when starting or executing personal brand GTM. |
| `apify-mcp` | Scraping social media data, web data for research |
| `firecrawl:firecrawl` | Web scraping, searching, crawling for research |
| `pptx` | Reading, creating, or editing any .pptx file (official document skill) |
| `branded-deck` | Creating branded strategy/campaign decks in the Analyst in the Arena visual identity. Extends the `pptx` skill with brand-specific layouts, colors, and fonts. |
| `visual-references` | Build a vision board of design references before generating concept directions. Scrapes Godly, Land-Book, Screenlane, Dribbble, and other curated sources based on asset type (landing page, social graphic, dashboard, form, ad). Captures screenshots, assembles an HTML grid board saved to `/tmp/vision-board-[slug].html`, and returns `style_anchors` + `patterns.avoid` for nanobanana prompts. Use when a brief lacks specific visual direction or user asks for a vision board / inspiration. |
| `video-analysis` | Analyzing, transcribing, or extracting content from a YouTube URL or local video file via Gemini API. Returns summary, timestamped transcript, scene breakdown, key moments, and repurpose angles. Routes to content-writer for downstream production. |
| `screenshot-taker` | Capture above-the-fold screenshots of any web page via ScreenshotOne API (`$SCREENSHOTONE_ACCESS_KEY`). Default: above-fold only (1440×900). Full page only on explicit request. Scroll video (GIF/MP4) when asked. Two use cases: (1) visual intelligence — give Claude eyes on a page before designing or writing about it; (2) content asset — embed real screenshots in blog heroes, article above-fold, landing page sections, social graphics. Use proactively whenever a task references an external URL. |
| `social-graphics` | Generating branded social media carousels and single-post visuals via nanobanana MCP. Supports LinkedIn, Twitter/X, Instagram. |
| `canvas-design` | Creating beautiful visual art and design artifacts (illustrations, infographics, icons, abstract compositions). Part of document-skills plugin. Use for artistic/illustrative visual needs outside social media post formats. |
| `frontend-design` | Creating distinctive, production-ready frontend UI and web components. Part of document-skills/firecrawl plugins. Use when building interactive web artifacts, landing page mockups, or UI components that need real HTML/CSS. |
| `mangabeira-content` MCP | Push and publish content to mangabeira.net via `upsert_page` (draft-first), `list_pages`, `get_page`, `delete_page`. URL: Supabase edge function `mcp-content`. Auth: `X-MCP-Secret` header. Triggers sitemap/RSS/IndexNow on publish. |
| `ga4-analytics` | GA4 traffic reports, realtime users, page performance, custom dimensions, date comparisons (property 421513615) |
| `gsc-analytics` | Search Console: search performance, top queries/pages, URL inspection, indexing audits, sitemaps, keyword cannibalization |
| `maton-google-drive` MCP | List, find, create, get, delete files and folders in Google Drive. Use `mcp__maton-google-drive__google-drive_*` tools. See `_context/maton-integration.md` for gateway fallback. |
| `maton-google-docs` MCP | Create, find, get, append text to Google Docs. Use `mcp__maton-google-docs__google-docs_*` tools. |
| `maton-google-sheet` MCP | Full Google Sheets CRUD (cells, rows, worksheets, values). Use `mcp__maton-google-sheet__google-sheet_*` tools. |
| `maton-google-mail` MCP | Read-only Gmail: find emails, list labels. No send/draft/modify. Use `mcp__maton-google-mail__google-mail_*` tools. |
| `maton-google-calendar` MCP | Create, list, update, delete events and calendars. Use `mcp__maton-google-calendar__google-calendar_*` tools. |
| `deep-search-ad-copy` | Research-first ad copy writing. Scrapes Reddit + X/CT for real ICP language BEFORE writing copy. Produces platform-specific variants (X, Reddit, LinkedIn) paired to a specific visual. Use when copy must sound like the ICP wrote it, not a marketer. Wraps `ad-creative` format rules with a research layer. **Owner: paid-media-agent.** |
| `ad-creative` | Produce paid social ad creatives for consultant/professional services brands. Handles audience temperature, campaign phase (cold/warm, evergreen/conference), hook selection (Exposé/Result/Practitioner/Contrarian), platform copy rules (LinkedIn TLA, LinkedIn Sponsored, X, Reddit), budget-to-platform allocation, geo-targeting setup notes, and designer brief generation. **Owner: paid-media-agent.** Use whenever producing any paid ad — copy, creative brief, and platform specs together. Conference-specific: three-phase campaign structure (pre-event/during/post-event), LinkedIn Recent Location targeting, X radius setup, Reddit subreddit layering. |
| `ad-variation-engine` | Generates structured variation batches from an approved `ad-creative-[date].md`. Produces 3 hook variants × 2 copy angles × all target platforms. Outputs `ads/active/[slug]/variations-[date].md` with variant IDs ready for performance log mapping. **Owner: paid-media-agent.** Use after `ad-creative` strategy is approved and before uploading to the ad platform. |
| `ad-fatigue-detector` | Reads `ads/active/[slug]/performance-log.md` and computes CTR decay at Day 7/14/30 windows against each variant's Day 1 baseline. Outputs `ads/reviews/fatigue-report-[date].md` with retire/refresh/test-next recommendations. No external API — runs on manually populated logs. **Owner: paid-media-agent.** Use weekly or whenever Gabriel asks "which ads are wearing out?" |
| `qa-content` | Pre-publish QA gate. Run on any content piece at `pipelineStage: editing`. Two passes: (1) fact-check every claim against source files, (2) voice and channel audit against brand standards. Sets `qaStatus` on the task (`passed` / `hold` / `blocked`). Required before editing gate can close. |
| `human-writing-style` | Any content writing task where tone, voice, and readability matter. Anti-AI detection. |
| `linkedin-post-writer` | Writing, formatting, critiquing full LinkedIn posts (Lara Acosta hooks + Jasmin Alic formatting) |
| `linkedin-hook-writer` | Writing, critiquing, and scoring LinkedIn hooks. Three modes: (1) Full post — always generates 3 hook variants (A/B/C) before writing the body; (2) Hook only — always 3 variants with char counts; (3) Hook Booster — scores an existing hook on 5 dimensions (Clarity, Scroll-stopping, Polarizing, Originality, Brevity) out of 100, produces 3 targeted improvement suggestions, generates 3 rewrite variants per suggestion |
| `linkedin-post-to-article` | Expanding a LinkedIn post into a full LinkedIn Article (800-2,500 words, SEO + AEO optimized) |
| `web3-twitter-post-writer` | Writing single X/Twitter posts (hot takes, data points, polls, quote tweets, replies) for Web3/CT |
| `web3-twitter-thread-writer` | Writing X/Twitter threads for Web3/CT, optimized for 2026 algorithm and reply-first growth |
| `web3-twitter-video-editor` | Scripting and structuring short (<60s) product launch and demo videos for X/Twitter in Web3/CT |
| `remotion-best-practices` | Programmatic video creation in React with Remotion. Animations, compositions, captions, audio, 3D, transitions, text effects, voiceover. Use alongside `web3-twitter-video-editor` to produce the actual video files. |
| `mangabeira-blog-writer` | Writing publication-ready blog posts for mangabeira.net (7-section structure, ICP targeting, SEO/AEO, HTML elements) |
| `seo-aeo-geo` | Keyword research, content pillar mapping, content briefs, post-write SEO/AEO/GEO audit, schema generation, AI citation monitoring. Four modes: research, brief, audit, monitor. Bookend model: run before writing (brief) and after writing (audit). **Owned by the SEO agent** — for full workflows, launch the seo-agent instead of invoking this skill directly. Direct invocation is appropriate only for single-mode, no-synthesis tasks (e.g., quick audit of a known file path with no brief context). |
| `seo-aeo-onboarding` | Full SEO/AEO onboarding baseline for a new site or strategy reset. Four sequential phases: (1) Technical audit (crawlability, CWV, AI crawler access, LLMs.txt), (2) Content/E-E-A-T audit (AEO structure scoring per article), (3) Keyword research + topical authority mapping, (4) AEO baseline + AI Share of Voice establishment. Produces 5 output files plus a prioritized plan with publish frequency recommendation. **Owned by the SEO agent.** Trigger: "SEO onboarding", "baseline audit", "start SEO from scratch", "full site audit", "SEO kickoff", "AEO baseline", "quarterly strategy reset". SOP-14. **Next step after onboarding: `keyword-calendar`.** |
| `keyword-calendar` | Expands onboarding baseline into full keyword + AEO prompt universe (200-400 keywords) and produces a 3-6 month sprint-based content calendar. Enforces the 5-article cluster threshold (binary AI citation rate jump from 12% to 41% at cluster depth, per Digital Applied's 6.8M-citation analysis). Produces 4 outputs: `seo/research/keyword-universe-YYYY-MM-DD.md`, `seo/research/prompt-universe-YYYY-MM-DD.md`, `seo/content-calendar-YYYY-MM-DD.md`, `seo/monitoring/aeo-baseline-prompts-YYYY-MM-DD.md`. **Owned by the SEO agent.** Runs automatically after `seo-aeo-onboarding` completes or on triggers: "build a content calendar", "keyword universe", "expand our keyword map", "AEO prompts for [pillar]", "what should we write for the next N months", "content roadmap". Calendar rows feed `seo-aeo-geo` Brief mode. |
| `audience-intelligence-brief` | Full-stack audience intelligence: multi-model ICP research (Grok + Perplexity + Gemini), structured brief in `research/audience-insights.md`, HTML client presentation with nanobanana ICP portraits, branded PPTX, and PDF. Use for campaign kickoffs, quarterly ICP reviews, audience deep dives. Triggers: "audience research", "ICP research", "audience intelligence", "who is my audience", "campaign kickoff research". Owned by: research-agent. |
| `reddit-fetch` | Fetch raw Reddit data (posts, threads, subreddit scans, search) with no API key. Uses Reddit's public `.json` endpoint via curl. Two methods: Gemini CLI (primary) and curl+jq fallback. Use for structured Reddit data when `openrouter-research` qualitative synthesis isn't enough. |
| `openrouter-research` | Route research sub-queries to Perplexity (Reddit), Grok (X/Twitter), Gemini (YouTube/Google) via OpenRouter for channel-native analysis |
| `linkedin-monitor` | Scrape and process LinkedIn posts for four use cases: (1) **audience-pulse** — weekly trending topics from 10 Web3 voices; (2) **reply-action** — daily reply targets ranked by engagement; (3) **second-brain** — save and distill a single post to knowledgebase; (4) **competitor-research** — profile scan and competitive brief. Uses custom Apify actor `gmangabeira2/linkedin-post-scraper` (cookieless, ~13–20 posts per profile). Profile registry at `research/linkedin-monitor/profiles.json`. Dashboard tab: LinkedIn Monitor. Triggers: "run audience pulse", "find reply targets", "save this post", "scan competitors", "add [name] to monitor". |
| `linkedin-competitor-analysis` | Full-pipeline LinkedIn personal brand competitor analysis — discovers, scores, and maps Web3 fractional CMO competitors using a 10-dimension framework. Trigger: "competitor analysis", "competitive scan", "LinkedIn competitors", "who competes with Gabriel", "competitive landscape", "competitor refresh". Output: `research/competitor-analysis-linkedin-YYYY-MM-DD.html`. Run proactively before SOP-08 if last report >60 days old. |
| `cloudflare` | Manage Cloudflare infrastructure: DNS records (CRUD for A/AAAA/CNAME/MX/TXT/etc.), cache purge (URL/tag/prefix/everything), cache rules (Rulesets API), zone performance settings (Rocket Loader, HTTP/2, Brotli, WebP, Polish, Early Hints), Workers (wrangler deploy/dev/tail/secrets/KV/R2), and Pages (projects, deployments). Three execution paths: Cloudflare MCP server (if wired), Wrangler v4 CLI, or curl REST API. Reference files in `.claude/skills/cloudflare/references/`. |
| `changelog-monitor` | Weekly changelog scraping for external APIs/MCPs. Detects changes, assesses impact on skills/agents, produces actionable report. Cross-referenced by SOP-01 Step 0. |
| `marketing-project-manager` | Active campaigns, approval queue, ships-this-week, blocked tasks, quick health stats. Trigger: `/ops`, "what's blocked", "what needs my review", "what ships this week", "campaign status", "create a campaign", "triage the board". Reads `social/tasks.json` + `campaigns/campaigns.json`. |
| `campaign-report` | Generate structured campaign performance reports from GA4/GSC/owned-channel data. Outputs executive summary, key metrics table with period-over-period deltas, top 3 insights, and next actions. Filename: `reports/campaign-report-[slug]-YYYY-MM-DD.md`. Use when data-analyst needs a post-mortem, weekly summary, or end-of-cycle report. |
| `data-visualization` | Transform raw analytics data into text-based visualizations: ranked tables, period comparison blocks, trend summaries, and performance heatmaps. No image output. Inline markdown only. Use before writing narrative sections of any data-analyst report. |

## Infrastructure / Ops (Marketing Systems Engineer)

| Skill | Use when... |
|---|---|
| `ops-daily-preflight` | Daily MCP connection checks, pending-approvals staleness check, cycle brief verification, broken file reference scan. Output: `_ops/preflight-report.md`. Loaded by marketing-systems-engineer on `RUN_DAILY_PREFLIGHT` trigger. |
| `ops-weekly-maintenance` | Weekly audit: orphaned skills, context file staleness, agent memory review, inter-agent gap scan (fleet dashboard BLOCKED entries), SOP reference check. Autonomous fixes logged to infra-log. Output: `_ops/weekly-report.md`. Loaded by marketing-systems-engineer on `RUN_WEEKLY_MAINTENANCE` trigger. |
| `ops-monthly-infra-review` | Full monthly audit: agent definitions vs. CLAUDE.md, skills vs. SOPs coverage matrix, MCP inventory, pending-approvals backlog, changelog cross-reference, infra-log health signal. Read-only run. Output: `_ops/monthly-report.md`. Loaded by marketing-systems-engineer on `RUN_MONTHLY_INFRA_REVIEW` trigger. |

## Project Template

The MangaOS master project template lives at `_templates/project-template/`. It is the skeleton that any new project workspace (Sasha Coin, Token Trends, Token Health Scan, Web3 Roast, EkkoGreen, Salto Financeiro) inherits when cloned. New projects are sibling folders at `~/Documents/Gabriel Mangabeira/[project-slug]/`.

**Template contents:**
- `onboarding.md` — project questionnaire to fill before running `/init-project`
- `CLAUDE.md` — brand-agnostic workspace instructions (reads `_context/` at runtime)
- `_context/` — 5 placeholder files (brand-voice, audience, product-info, style-guide, tool-registry) auto-generated by `/init-project`
- `campaigns/campaigns.json`, `social/tasks.json`, `social/dispatch-queue.json` — empty registries
- `social/engagement-log.md`, `docs/decision-log.md` — empty logs
- `.env.example`, `.gitignore`, `.claude/settings.json` — standard config

**SOP-to-project-type routing (baked into template CLAUDE.md):**
- `saas-app`: sop-02, sop-03, sop-05, sop-07, sop-09, sop-13
- `publisher`: sop-02, sop-03, sop-05, sop-12, sop-07
- `personal-brand`: all SOPs
- `ai-agent-persona`: sop-03, sop-05, sop-09, sop-17
- `media-brand`: sop-03, sop-05, sop-11, sop-16

**New SOPs added to the library alongside the template:**
- `sop-16-podcast-engine.md` — podcast episode to 4-asset content pipeline (blog, social clips, newsletter)
- `sop-17-agent-persona.md` — AI agent persona content engine (voice maintenance, daily cadence, narrative arc, onchain triggers)

## Agent Routing

The **designer agent** (`.claude/agents/designer.md`) orchestrates `social-graphics`, `branded-deck`, `frontend-design`, and `canvas-design` for standalone visual production. Use the designer agent when the primary deliverable is a visual asset. Use the content-writer when the primary deliverable is written content that happens to need an image.

**Design System v2.0:** All visual production through the designer agent now follows a three-phase workflow: (1) Visual Brief with 3 concept directions and concept images, user picks one; (2) Production via the appropriate skill, locked to the selected brief; (3) Design Critic scoring against 5 dimensions (Brand Compliance, Readability, Anti-AI-Slop, Composition, Brief Alignment) before delivery. See `_context/design-system-version.md` for the current version and upgrade backlog.

The **research agent** (`.claude/agents/research-agent.md`) orchestrates `apify-mcp`, `firecrawl:firecrawl`, `openrouter-research`, and Dune Analytics MCP for market intelligence. Use the research agent when you need external market data, competitive scans, protocol analysis, or social sentiment monitoring. It routes channel-specific analysis to specialist models: Perplexity for Reddit, Grok for X/Twitter, Gemini for YouTube/Google.

The **SEO agent** (`.claude/agents/seo-agent.md`) orchestrates `seo-aeo-geo`, `gsc-analytics`, `ga4-analytics`, and `openrouter-research` (for SERP competitive research) for search visibility operations. Use the SEO agent when you need keyword research, content briefs, post-write SEO/AEO/GEO audits, schema generation, GSC monitoring, AI citation tracking, or content refresh recommendations. It owns the full search pipeline for mangabeira.net from keyword strategy to AI citation monitoring.

**SEO agent context files:** The SEO agent loads `_context/seo-content-inventory.md` (published content registry) and `seo/keyword-map.md` (pillar strategy) at runtime. These are the primary context sources for all SEO operations.

**SEO agent routing quick reference:**

| Trigger | Route to |
|---|---|
| "Keyword research", "what should we write next", "content gaps" | seo-agent (keyword research mode) |
| "SEO brief for [topic]", "generate a brief before writing" | seo-agent (brief generation) |
| "Audit this article for SEO", "check AEO compliance" | seo-agent (post-write audit) |
| "Generate schema for [slug]" | seo-agent (schema generation via audit mode) |
| "Which articles need a refresh", "SOP-12 refresh" | seo-agent (monitoring + refresh prioritization) |
| "Are our articles being cited by AI?" | seo-agent (monitor mode) |
| "Check if [URL] is indexed in GSC" | `gsc-analytics` skill directly (single lookup) |
| Single GSC metric pull (no analysis) | `gsc-analytics` skill directly |
| `book-wisdom` | **Retrieval + injection layer over Gabriel's distilled business / strategy / craft book library** at `~/Documents/Gabriel Mangabeira/shared/library/`. Surfaces relevant frameworks before strategy work, PRDs, OKRs, sprint plans, campaign briefs, positioning, or any task that benefits from a tested mental model. Four modes: **inject** (default, find 1-2 relevant books, embed a "Framework in play" block at the top of the deliverable), **list**, **lookup**, **search by tag**. Library is the source of truth; skill reads markdown directly, no DB. Current books: Tribes, Sticky Wisdom, Measure What Matters (OKRs), Marketing Rebellion, Scrum, Sprint. Triggers: "what does Tribes say", "apply OKRs", "use the Sprint method", "what framework fits", "book wisdom", "library". |

## Account Manager Agents (Multi-Project Routing)

Account managers bridge the `marketing/` workspace and each project's sibling folder. They are agents, not skills — they load project-specific `_context/` files and inject brand context into every executive agent delegation.

**Rule:** Activate the project's AM before any production task that belongs to that project. The AM handles context loading and output routing. Executive agents (content-writer, designer, etc.) stay brand-agnostic and receive context via explicit prompt injection from the AM.

| Agent file | Project | Activates when... |
|---|---|---|
| `token-health-scan-am.md` | Token Health Scan | User mentions Token Health Scan by name in any production context |

**To add a new project:** Create `[project-slug]-am.md` in `.claude/agents/`, add a row to this table, and add a routing rule in CLAUDE.md under "Account Manager agents".

## Landing Page Architecture

mangabeira.net pages are stored as HTML content in Supabase (`page_translations.content`) and rendered by the Lovable React frontend (`DynamicPage.tsx`). The designer agent produces inner HTML content with Tailwind classes, not standalone apps. Landing pages use `preserve_styles: true` for full layout control beyond the default prose wrapper. Available interactive HTML components are documented in `_context/html-elements.md`. Agents push content directly to the CMS via the `mangabeira-content` MCP server (`upsert_page`) — always as draft first, publish only on explicit approval.

**URL structure:**
- EN: `/publications/{en_slug}`
- BR: `/br/artigos/{br_slug}`
- ES: `/es/articulos/{es_slug}`

**Publishing triggers on status → published:** `generate-sitemap`, `generate-rss`, `submit-indexnow`


---

## Liquidity Miner Skills

| Skill | Use when... |
|---|---|
| `defi-lp-math` | Computing LP position values, sqrtPriceX96 decoding, tick math, 3-case amount formulas (cl_amounts), IL computation, delta-neutral hedge sizing (positionDelta), liquidity from amounts, fee accumulation (Q128), pool scoring formula. Use before any LP math calculation. |
| `base-defi-stack` | Building or debugging Base L2 LP positions: Uniswap v3 contracts, Aerodrome Slipstream gauge integration, Morpho Blue health factor, token addresses (WETH/USDC/cbBTC), tick math utilities, NftPositionManager ABI. |
| `solana-clmm` | Building or debugging Solana CLMM positions via Orca Whirlpools or Raydium CLMM: Byreal CLI commands, SDK functions, fee tiers, tick spacing, position PDA handling. |
| `hyperliquid-perps` | Hyperliquid REST API, delta-neutral hedge sizing and adjustment logic, funding rate mechanics and kill switch (< -54.75% annualized), EIP-712 signing (chainId 1337), margin management. Use whenever building or debugging the hedge executor. |
| `mantle-agent` | ERC-8004 Identity Registry on Mantle (0x8004...), agent registration flow, self-transfer attestation pattern, state/erc8004-identity.json schema. Use for Sasha's on-chain identity and attestation after any LP action. |
| `protocol-changelog` | Weekly check procedure for protocol updates (Orca, Raydium, Uniswap, Aerodrome, Morpho, Hyperliquid, Byreal). Breaking change assessment, automated changelog script. Run weekly or before any deployment. |

## Liquidity Miner Scripts

| Script | Purpose |
|---|---|
| `node scripts/pool-scanner.js --chain <solana\|base\|all> --top 5` | Scan DefiLlama yields API, score and rank LP candidates, write content/lp-candidates.json + patch mantle-signal.json |
| `node scripts/position-monitor.js` | Check all open positions in state/lp-positions.json for kill-switch conditions (OOR, hedge drift, HF breach, funding kill). Write content/lp-rebalance-signal.json + send Telegram alert. |
| `node scripts/lp-rebalancer.js --execute` | Execute actions from content/lp-rebalance-signal.json (CLOSE_REOPEN, CLAIM_FEES, DELEVERAGE, KILL). Requires explicit Gabriel confirmation for any on-chain action. |
| `node scripts/pool-scanner.js --dry-run` | Dry run pool scan (no signal write) |
| `node scripts/position-monitor.js --dry-run` | Dry run monitor (no writes, no alerts) |
| `node scripts/lp-rebalancer.js --dry-run` | Dry run rebalancer (validate signal, no execution) |

