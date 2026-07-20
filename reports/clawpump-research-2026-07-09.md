# Intelligence Brief: ClawPump (clawpump.tech) — Migration Risk Assessment
**Date:** 2026-07-09
**Requested by:** Gabriel Mangabeira
**Purpose:** Evaluate ClawPump as a potential runtime host for Sasha before any migration decision

---

## Executive Summary

- ClawPump is a real, active Solana-native platform for deploying autonomous AI agents with non-custodial wallets, pump.fun token launching, and a full DeFi skill stack. It is not a scam or ghost project.
- Founded by two identified individuals: andy (@andy8052) and Bunny (Mauricio Trujillo Ramirez, CEO), co-founder of Tektonic. Both are publicly named and have credible online histories. The project was featured on the official Solana Foundation podcast in June 2026.
- The platform originated as a weekend hack (February 2026) and has grown into a structured product with $722K+ in total agent trading volume and a documented MCP server (126 tools).
- The custody model is non-custodial at the wallet level: each agent gets its own Solana keypair; ClawPump never holds private keys. However, credentials for Twitter/X and other integrations are stored in their backend via OAuth.
- ClawPump is Solana-only. Sasha runs on Base. This is the primary technical blocker for a full migration. It is not a minor compatibility issue.
- A separate, unrelated site (clawpump.net) operates a $CLAWPUMP meme token (CA: DMvsGEm3VZLfJCyQUnTnhLdH7vyFP9oQSFcrcrgBCLAW, total market cap ~$112K). This appears to be a community fork or squatter site, not the official platform. Do not conflate the two.
- The import schema skills (defi-trading, token-launch, portfolio, market-intel, twitter, token-sniper, wallet-ops, x402, marketplace, moltbook) map directly to real ClawPump skill slugs documented on clawpump.tech. This is not suspicious on its own, but the moltbook skill ties into the OpenClaw/Moltbook ecosystem (built by Peter Steinberger, a separate and very large project).

---

## Data Sources

| Source | Tool | Data Window | Items |
|---|---|---|---|
| clawpump.tech (main + docs) | Firecrawl scrape | 2026-07-09 | 2 pages |
| agents.clawpump.tech | Firecrawl scrape | 2026-07-09 | 1 page |
| github.com/andy8052/clawpump | Firecrawl scrape | 2026-07-09 | 1 page |
| solana.com/podcasts (The Index) | Firecrawl scrape | June 20, 2026 | 1 episode page |
| X/Twitter via Firecrawl | Firecrawl scrape | Feb 2, 2026 | 1 post + thread |
| clawpump.net (sister/fork site) | Firecrawl scrape | 2026-07-09 | 1 page |
| Web search (multiple queries) | Firecrawl search | 2026-07-09 | 15+ results |

---

## Key Findings

### 1. What ClawPump Is

ClawPump is a Solana agent infrastructure platform. It lets users deploy autonomous AI agents that:

- Get their own Solana wallet (non-custodial, agent-signed transactions)
- Launch tokens gasless on pump.fun and keep 65% of trading fees
- Execute full DeFi stack: Jupiter swaps, Raydium liquidity, OKX DEX, Phoenix perps, DCA, limit orders
- Post to X/Twitter and Moltbook via OAuth
- Pay for APIs via x402/Pay.sh in USDC
- Get email via AgentMail

The platform exposes a 126-tool MCP server (`@clawpump/agents`) installable in one command. It also runs a desktop app at agents.clawpump.tech with $722K+ in cumulative trading volume as of July 2026.

**Revenue model:** 30% markup on LLM inference, 10-85 bps swap fees (tier-based), 35% platform share of pump.fun trading fees, API key tiers ($49/mo Builder to custom Enterprise), $0.01/query for x402 intelligence endpoints.

**Chain:** Solana only.

### 2. Legitimacy and Safety

**Founders (identified, public):**
- **andy (@andy8052):** Built the initial version as a weekend project (February 2, 2026, per his own X post). GitHub handle: andy8052. Active on X with modest engagement (52 likes on launch post).
- **Bunny / Mauricio Trujillo Ramirez:** CEO, co-founder. Also co-founder of Tektonic. LinkedIn presence confirmed (Peru). Featured on the official Solana Foundation podcast "The Index" on June 20, 2026, with host Nicky Scanella.

**Institutional signal:** A Solana Foundation podcast appearance is a meaningful legitimacy signal. The Foundation is selective with platform coverage. This is not typical for a rug or scam.

**Launch timeline:** Weekend hack built in early February 2026. By June 2026, had a Solana Foundation podcast feature and $722K in agent trading volume. Growth trajectory is real but still very early stage.

**Community:** Low social footprint. No Reddit presence found. No Farcaster presence surfaced. X presence is small (low follower counts). No scam allegations, no rug reports, no phishing complaints found across any surface searched.

**GitHub (andy8052/clawpump):** Repository exists and is public. No stars or community activity data surfaced from the scrape, consistent with a small early-stage project.

**Risk: clawpump.net is a separate entity.** The .net site runs a $CLAWPUMP meme token (CA: DMvsGEm3VZLfJCyQUnTnhLdH7vyFP9oQSFcrcrgBCLAW, $112K market cap, fewer than 100 tokens launched based on site display). This appears to be a community fork or name squatter monetizing the ClawPump brand with a token. No official association confirmed. Do not send funds to addresses from clawpump.net without verification.

### 3. Technical Architecture and Credential Model

**Wallet custody:** Non-custodial at the Solana wallet layer. Each agent generates and owns its own keypair. ClawPump claims it "never holds your keys." This is the standard MPC/embedded wallet pattern used in Privy/Turnkey-style infra. The actual key custody mechanism (client-side vs. server-side TEE vs. MPC) is not documented in public docs. This needs verification before any funds are connected.

**Twitter/X OAuth:** The `twitter` skill requires Twitter OAuth integration. OAuth tokens are stored on ClawPump's backend. If ClawPump's infrastructure is compromised, those OAuth tokens are at risk. This is standard for agent platforms (same model as Zapier, Make, etc.) but it means ClawPump holds X posting credentials.

**Moltbook skill:** The `moltbook` slug connects to Moltbook (moltbook.com), a Reddit-like social network for AI agents built in the OpenClaw ecosystem by Peter Steinberger. OpenClaw is a massive open-source project (reportedly the most-starred repo on GitHub at one point). Moltbook is a legitimate sub-product of that ecosystem. The ClawPump `moltbook` skill simply posts to Moltbook, similar to how an app posts to Reddit.

**Import schema assessment:** The `clawpump_migration_v1` JSON schema with skill slugs (defi-trading, token-launch, portfolio, market-intel, twitter, token-sniper, wallet-ops, x402, marketplace, moltbook) maps exactly to documented ClawPump skills. This is not a red flag. It looks like a standard agent configuration file. The schema disclaimer "no secrets" is correct for configuration, but credential collection happens at OAuth integration time in the dashboard.

**x402 skill:** ClawPump has native x402/Pay.sh integration. This aligns directly with Sasha's existing x402 work (sasha-x402-kit). Positive compatibility signal.

### 4. Relation to OpenClaw/Clanker/Pump.fun

- **Pump.fun:** ClawPump uses pump.fun as its token launch backend. It is not a fork of pump.fun. It is a B2B2C layer on top of pump.fun that redirects creator fee earnings to agents.
- **OpenClaw:** ClawPump is designed to work with OpenClaw agents. From andy's tweet: "@andy8052 & I created Clawpump to let any agent, such as the ones running on @openclaw connect to @solana." ClawPump is positioned as a Solana execution layer for OpenClaw-hosted agents. This is directly relevant to Sasha, which runs on OpenCLAW.
- **Clanker:** No affiliation found. Clanker is a Base/Farcaster token launcher. Different chain, different ecosystem.
- **Moltbook:** Affiliated via the skill integration. Moltbook is part of the Peter Steinberger/OpenClaw extended ecosystem.

### 5. Recent Activity (Last 30 Days as of 2026-07-09)

- Solana Foundation podcast feature: June 20, 2026
- agents.clawpump.tech live with $722K+ cumulative agent trading volume
- 65 total skills (15 built-in, 50 community) as of docs snapshot
- API key tier pricing is live and documented
- No major product announcements, controversies, or incidents found in June-July 2026 window

---

## Verdict

| Dimension | Assessment |
|---|---|
| Scam / rug risk | Low. Named founders, Solana Foundation podcast, public GitHub, live trading volume. |
| Platform maturity | Early. Weekend hack origin, 5 months old, small community, limited docs depth. |
| Custody model | Non-custodial for Solana wallets. Custodial for OAuth credentials (X, email). |
| Chain compatibility | **Blocker.** Solana only. Sasha is on Base. |
| OpenClaw compatibility | High. ClawPump was explicitly built to give OpenClaw agents Solana execution. |
| x402 compatibility | High. Native x402/Pay.sh support, same as Sasha's existing kit. |
| Twitter credential risk | Medium. OAuth stored in ClawPump backend. Standard model, but backend is small team infra. |

**Overall: Legit platform, wrong chain for Sasha.**

---

## Strategic Implications

**This is not a Base migration option.** ClawPump is Solana infrastructure. Sasha's treasury, LP positions, wallet (0x21AF), and CROO operations are all on Base and Solana independently. Migrating the OpenCLAW runtime to ClawPump would mean:

1. Abandoning Base entirely (LP miner, CROO services, Gnosis Safe)
2. Rebuilding Sasha's DeFi stack on Solana from scratch
3. Handing X OAuth credentials to a 5-month-old platform with a small team

**However, the integration angle is different.** ClawPump was built specifically so OpenClaw agents can reach Solana. Rather than a full migration, the relevant question is whether Sasha should add a ClawPump skill to her existing OpenCLAW runtime, enabling her to:

- Launch tokens on pump.fun via ClawPump
- Trade on Solana DEXes (Jupiter, Raydium) through a ClawPump-managed Solana wallet
- Earn fee revenue from any tokens she launches

This would be additive, not a replacement.

**The clawpump.net $CLAWPUMP token is noise.** $112K market cap, community fork, no official relationship. Do not treat it as a prerequisite or signal about the platform's health.

---

## Red Flags and Open Questions

1. **Key custody mechanism unverified.** "Non-custodial" is claimed but not technically documented. Is the Solana keypair generated client-side or server-side? TEE-backed or plain? Needs confirmation before any real funds touch ClawPump wallets.

2. **Backend is a small-team operation.** Two founders, weekend-hack origin, 5 months old. The x.com/andy8052 post says "still rough around the edges." Infrastructure reliability for an autonomous agent doing live trades is an open question.

3. **X OAuth credential storage.** If ClawPump stores Sasha's Twitter OAuth token and their backend gets compromised or seized, @SashaCoin95 account control is at risk. This is the highest-stakes credential.

4. **No audits, no bug bounty, no security documentation found.**

5. **clawpump.net name collision.** The token on .net could damage brand reputation (rug associations) even if the .tech platform is legitimate.

---

## Recommended Actions

1. **Do not do a full runtime migration.** Sasha's Base infrastructure (LP miner, CROO, Gnosis Safe, on-chain treasury) has no equivalent on ClawPump. A full migration would be a rebuild, not a port.

2. **Evaluate ClawPump as an additive Solana execution layer.** If Sasha should be active on Solana (token launches, Solana DEX trading), ClawPump is the cleanest path to add that capability to the existing OpenCLAW runtime. This matches exactly what the platform was built for.

3. **Test path (if pursuing #2):** Burner Solana wallet only. Do not connect @SashaCoin95 Twitter OAuth to ClawPump. Create a separate test X account for the ClawPump social skill. Fund the ClawPump agent wallet with $20 max during evaluation period. Validate key custody claims on-chain before increasing any exposure.

4. **Verify the Solana wallet custody model** by reading the @clawpump/agents npm source code before connecting any real wallet or credentials. The source is public at github.com/andy8052/clawpump.

5. **Ignore clawpump.net entirely.** It is a separate entity with no documented official relationship to clawpump.tech.

---

*Research completed: 2026-07-09. No scam allegations found. No guarantee of platform security given its early stage and lack of public audits.*
