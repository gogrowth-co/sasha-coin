# Tool Registry — Sasha Coin

External tools and APIs Sasha depends on. Updated when wiring or rotating credentials.

## Runtime infrastructure

| Tool | Purpose | Auth | Where used |
|---|---|---|---|
| Hostinger VPS | Container host | SSH key `~/.ssh/hostinger_vps` to `root@187.77.42.134` | All runtime |
| Docker | Container runtime | n/a | `openclaw-h3mk-openclaw-1` |
| OpenCLAW | Agent framework | n/a | `/docker/openclaw-h3mk/` |
| Qdrant (QMD) | Vector memory | local | `skills/qmd/`, `skills/openclaw-memory-qdrant/` |

## Channels

| Tool | Purpose | Auth env | Skill/script |
|---|---|---|---|
| Twitter API v2 | Direct posts + replies | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | `scripts/tweet.js`, `twitter-reply-gal` |
| Buffer | Autoscheduled queue | `BUFFER_ACCESS_TOKEN`, `BUFFER_CHANNEL_ID`, optional `BUFFER_ORGANIZATION_ID` | `post_to_buffer.js`, `twitter-scheduled-post` |
| Telegram | Sasha ↔ Gabriel chat | bot token in `openclaw.json` (VPS-only, never synced) | OpenCLAW core |
| Discord | Allowed (not active) | n/a | OpenCLAW core |

## Data sources

| Tool | Purpose | Auth env | Skill |
|---|---|---|---|
| Apify | Twitter scraping for replies | `APIFY_TOKEN` | `twitter-reply-gal` |
| Trenches API | $SASHA price + trending tokens | none (public) | `Clawlett/clawlett/scripts/trenches.js`, future `price-monitor` |
| Basescan | Wallet activity scan | optional API key | future `wallet-monitor` |
| Base RPC | Onchain reads | public RPC | `Clawlett/clawlett/scripts/balance.js` |
| The Graph | CL subgraph data: tick-level depth + exact daily volume/fees/TVL (Base/Ethereum) | `THE_GRAPH_API_KEY` (32 hex, Bearer) | `scripts/signals/lp-data-source-verifier.mjs`, future pool-scanner v2 |

**LP pool data stack (DefiLlama, GeckoTerminal, DexScreener, Revert, The Graph):** full endpoint/field spec + what to trust is in `docs/integrations/lp-data-sources-api-reference.md`, auto-verified weekly by `scripts/signals/lp-data-source-verifier.mjs` (launchd `com.mangaos.lp-datasource-check`). The Graph is authed so only the local verifier checks it; the other four are also re-checked by the cloud routine.

## Image generation

| Tool | Purpose | Auth env | Skill |
|---|---|---|---|
| Gemini API | Image generation + reply generation | `GEMINI_API_KEY` (`GEMINI_REPLY_MODEL`) | `gemini-image-gen`, `gemini-image-simple`, `gemini-nano-banana`, `scripts/morning-reply-run.js` |
| Nanobanana | Higher-quality images | (TBD) | `nano-banana-pro` (pending) |

## Onchain

| Tool | Purpose | Where |
|---|---|---|
| Gnosis Safe | Sasha's wallet | Base mainnet, owner address in `Clawlett/config/base/wallet.json` (VPS-only) |
| Zodiac Roles | Wallet permission gating | Base mainnet, deployed via `Clawlett/clawlett/scripts/initialize.js` |
| AgentKeyFactoryV3 | Trenches token creation/trade | `0x2EA0010c18fa7239CAD047eb2596F8d8B7Cf2988` on Base |
| KyberSwap Router | DEX aggregator swaps | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` on Base |
| CoW Settlement | MEV-protected swaps | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` on Base |
| ZodiacHelpers | Approvals + factory wrappers | `0x38441B5bd6370b000747c97a12877c83c0A32eaF` on Base |
| CNS (Clawlett Name Service) | Unique agent name NFT | `0x299319e0BC8d67e11AD8b17D4d5002033874De3a` on Base |

## Cron schedules (current)

| Job | Schedule | Skill | Status |
|---|---|---|---|
| `twitter-scheduled-post` | `0 9,13,18 * * *` BRT | `twitter-scheduled-post` | active |
| `twitter-reply-gal` | `0 11,16 * * *` BRT | `twitter-reply-gal` | planned |
| `wallet-monitor` | hourly | `wallet-monitor` | planned (Phase 2) |
| `price-monitor` | every 30 min | `price-monitor` | planned (Phase 2) |

## Integration registry (machine-readable)
`docs/integrations/registry.json` is the source of truth for every external integration (env-var NAMES only, `live_action_risk`, fallback, smoke test, `owner_skill`). Maintained by the `sasha-ops-hardening` skill. Verify freshness with `node scripts/check-integration-docs.mjs`.

## Reliability / API skills (.claude/skills/sasha-*)
| Skill | Owns |
|---|---|
| `sasha-xlayer-oracle-keeper` | X Layer RPC, Uniswap v4 oracle/hook, signal push |
| `sasha-signal-fusion` | Allora/Elfa/Polymarket/OpenRouter/Gemini/CoinGecko/DefiLlama signal pipeline |
| `sasha-social-agent` | Buffer, X API, Apify, ADB, Typefully — daily post + reply plumbing |
| `sasha-defi-execution` | Byreal, Hyperliquid, LiFi, Clawlett, Mantle/Base/Solana/Arbitrum RPC, treasury |
| `sasha-distribution-liveness` | read-only liveness audit (`scripts/audit-sasha-distribution.mjs`) |
| `sasha-ops-hardening` | registry upkeep, docs watchdog, secret hygiene, VPS reliability triage |

Runtime mirrors of the first four (slim) live in `skills/sasha-*` for VPS deploy.

## Secrets storage
All real values live in `/docker/openclaw-h3mk/data/.openclaw/.env` on VPS. The local `.env.example` documents required keys with empty values. `.env`/`.env.bak` are gitignored and were never committed (verified 2026-06-03). Registry/skills/reports reference env-var NAMES only, never values. Never commit `.env` itself.