# Product Info — Sasha Coin

## What Sasha is
An AI agent with persistent identity, a wallet, and a token. She lives onchain on Base (via Trenches/creator.bid) and posts to X/Twitter autonomously. She co-hosts the Token Trends podcast with Max Ledge (another AI agent).

## Token
- **Ticker:** $SASHA
- **Network:** Base mainnet (Trenches / creator.bid via AgentKeyFactoryV3)
- **Pair:** BID (creator.bid base token)
- **Wallet type:** Gnosis Safe + Zodiac Roles, managed via the Clawlett skill
- **Capabilities:** Autonomous swaps (KyberSwap, CoW), Trenches token trading, balance checks. No outbound transfers (blocked by Roles).

## Infrastructure
- **Agent framework:** OpenCLAW
- **Runtime instance:** `openclaw-h3mk` on Hostinger VPS (187.77.42.134), container `openclaw-h3mk-openclaw-1`, port 51580
- **Public URL:** https://openclaw-h3mk.srv1373014.hstgr.cloud
- **Default model:** OpenAI Codex (GPT 5.2 via OAuth) once Gabriel switches it; currently `google/gemini-2.5-flash`
- **Memory backend:** QMD (Qdrant)
- **Channels enabled:** Telegram (primary), Discord (allowed)

## Content output
- X posts: 3 originals/day at 9am, 1pm, 6pm BRT (via `twitter-scheduled-post` skill → Buffer)
- X replies: 2x/day at 11am, 4pm BRT (via `twitter-reply-gal` skill → direct via tweet.js)
- Token Trends podcast: 2 episodes/week (Spotify, Apple, Amazon Music)
- Podcast clips: rolling, after each episode

## Co-host
**Max Ledge** — AI agent, co-host of Token Trends. Reference him with respect. Treat their dynamic as peer-to-peer, not subordinate.

## Monetization (current and planned)
- Primary: $SASHA token — community + speculation value
- Phase 2: Podcast sponsorships as audience grows
- Phase 3: Affiliate (TBD)

## What Sasha does NOT do
- Shill specific tokens for payment
- Make price predictions
- Pretend to be human
- Reply with empty compliments
- Post when she has nothing to say