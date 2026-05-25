# Protocol Analysis: Liquidity Miner Architecture for Sasha Coin on Base — 2026-05-25

## Data Sources Used

| Source | Tool | Data Window | Items Collected |
|---|---|---|---|
| DefiLlama Yields API | Direct API call (yields.llama.fi/pools) | Live, as of 2026-05-25 | ~2,000 Base chain pools filtered |
| Perplexity (sonar-pro-search) | OpenRouter | Real-time web search | Protocol overview, risk framework |
| Gemini 2.5 Flash | OpenRouter | Model knowledge + reasoning | Vault architecture, delta-neutral mechanics |
| Aerodrome / EarnPark docs | Firecrawl scrape | 2025-2026 | veAERO mechanics, yield breakdown |
| StablecoinInsider.org | Firecrawl scrape | Published 2026-05-01 | Stablecoin pool rankings, Aerodrome stats |
| OneKey / Hyperliquid guide | Firecrawl scrape | Published 2026-05-06 | Delta-neutral strategy patterns |
| Firecrawl web search | firecrawl-search | 2025-2026 | 8 queries across 4 research domains |
| DefiLlama API docs | Firecrawl scrape | Live docs | API endpoint reference |

**OpenRouter cost estimate:** ~$0.05 (Perplexity sonar-pro-search x1 + Gemini 2.5 Flash x1 + Grok-3-mini x2 retries)

---

## Executive Summary

- Aerodrome Slipstream (CL pools) is the highest-yield venue on Base for all three tiers. WETH/USDC slipstream pools show 38-72% APY with a healthy split of fee APR (38%) plus AERO reward APR (34%). This is real fee yield, not purely emissions.
- Uniswap v3 WETH/USDC is the deepest single LP pool on Base at $126M TVL and 39.6% APY from fees only. This is the most defensible medium-risk position.
- Morpho Blue dominates Base TVL ($2.4B+ in cbBTC, $450M+ in USDC vaults) making it the obvious borrowing layer for a leverage loop. Aave v3 is secondary.
- True delta-neutral LP vaults (LP position + automated perp short in one contract) do not exist in production on Base as of May 2026. The architecture must be built as two coordinated positions: LP on Base, short on Hyperliquid. Hyperliquid is the correct venue for the hedge leg due to superior liquidity, lower fees, and no cross-chain bridging risk for margin.
- Automation feasibility is high for Sasha. Uniswap v3 and Aerodrome Slipstream both expose standard interfaces. Rebalancing can be triggered by off-chain monitoring (Chainlink Automation or a custom keeper). The hardest engineering problem is the hedge leg: computing delta, adjusting short size on Hyperliquid, and managing margin. This is solvable with an agent-controlled EOA.
- The recommended first integration stack: (1) Aerodrome Slipstream for yield, (2) Hyperliquid for hedging, (3) Morpho Blue for leverage.

---

## 1. Tier-by-Tier Protocol Recommendations

### Tier 1 — Low Risk: Stable/Stable Pairs on Base

**Primary venue: Aerodrome Slipstream (CL variant)**

Live data from DefiLlama as of 2026-05-25:

| Pool | Protocol | APY | APY Base (Fees) | APY Reward (AERO) | TVL |
|---|---|---|---|---|---|
| USDC/USDT | Aerodrome Slipstream | 22.6% | 18.5% | 4.2% | $1.04M |
| msUSD/USDC | Aerodrome Slipstream | 2.9% | 1.4% | 1.5% | $23.0M |
| USDC/USDbC | Aerodrome Slipstream | 14.0% | 12.5% | 1.5% | $693K |
| USDC/USDT | PancakeSwap v3 | 15.4% | 15.4% | 0% | $117K |
| msUSD/USDC | Aerodrome v1 | 7.1% | 0% | 7.1% | $7.96M |
| USDC/USDT | Uniswap v4 | 1.0% | 1.0% | 0% | $726K |

**Key findings:**
- USDC/USDT on Aerodrome Slipstream at 22.6% is the best risk-adjusted stable/stable pool. Fee APY of 18.5% is organic (not emissions-dependent). The msUSD/USDC pool has much deeper TVL ($23M) but lower fee yield, reflecting lower volume.
- Curve on Base has only a 4-token stablecoin pool (USDC/USDbC/axlUSDC/crvUSD) at ~0.2% APY and $206K TVL. Effectively irrelevant for yield at this stage.
- Impermanent loss exposure on stable/stable pairs is near zero assuming peg stability. Main risks are: depeg of one stablecoin (USDbC is deprecated legacy, avoid), smart contract risk, and emission dilution if AERO rewards drop.

**Sasha's recommended pool:** Aerodrome Slipstream USDC/USDT. Best fee-to-reward ratio. Monitor AERO gauge weight weekly.

---

### Tier 2 — Medium Risk: Stable/Bluechip Pairs on Base

**Primary venue: Uniswap v3 + Aerodrome Slipstream**

Live data from DefiLlama as of 2026-05-25:

| Pool | Protocol | APY | APY Base (Fees) | APY Reward (AERO) | TVL |
|---|---|---|---|---|---|
| WETH/USDC | Uniswap v3 | 39.6% | 39.6% | 0% | $126.8M |
| WETH/USDC | Aerodrome Slipstream | 72.6% | 38.6% | 34.0% | $14.7M |
| USDC/cbBTC | Aerodrome Slipstream | 65.7% | 56.5% | 9.2% | $11.8M |
| WETH/cbBTC | Aerodrome Slipstream | 31.9% | 26.8% | 5.1% | $17.4M |
| WETH/USDC | Aerodrome Slipstream | 72.6% | 38.6% | 34.0% | $14.7M |
| USDC/cbBTC | Aerodrome Slipstream | 227.1% | 220.3% | 6.8% | $4.2M |
| WETH/USDC | Aerodrome v1 | 4.4% | 0% | 4.4% | $7.8M |

**Key findings:**
- Uniswap v3 WETH/USDC ($127M TVL) has the deepest liquidity on Base, period. 39.6% APY is entirely fee-based (no emissions), meaning it is sustainable as long as volume holds. This is the most defensible medium-risk position.
- Aerodrome Slipstream WETH/USDC shows 72.6% APY but 34% of that is AERO rewards. The fee-only component of 38.6% is still competitive. The smaller pool size ($14.7M) means individual LP positions have a larger share of volume.
- The USDC/cbBTC Slipstream pool at 227% APY on $4.2M TVL is an outlier. This reflects either a very tight range (concentrated fee capture) or a data anomaly. Treat as unverified until cross-checked.
- Impermanent loss exposure for ETH/USDC is material. A 50% ETH price drop from entry results in approximately 5.7% IL. A 2x ETH price increase results in approximately 5.7% IL in the other direction. At 39% fee APY, this is manageable, but directional moves of 3x+ can overwhelm the fee income.
- cbBTC is the Coinbase-wrapped Bitcoin on Base, fully redeemable 1:1. Lower counterparty risk than WBTC.

**Sasha's recommended pool:** Uniswap v3 WETH/USDC as the primary position (deepest, fee-only). Aerodrome Slipstream WETH/USDC as secondary for reward capture.

---

### Tier 3 — High Risk: Altcoin/Bluechip Pairs on Base

**Primary venue: Aerodrome v1 + Slipstream**

Live data from DefiLlama as of 2026-05-25:

| Pool | Protocol | APY | APY Base (Fees) | APY Reward (AERO) | TVL |
|---|---|---|---|---|---|
| WETH/VVV | Aerodrome v1 | 60.5% | 0% | 60.5% | $10.2M |
| VIRTUAL/WETH | Aerodrome v1 | 22.9% | 0% | 22.9% | $5.0M |
| WETH/AERO | Aerodrome v1 | 14.3% | 0% | 14.3% | $2.7M |
| WETH/FAI | Aerodrome v1 | 33.6% | 0% | 33.6% | $2.4M |
| WETH/MORPHO | Aerodrome Slipstream | 45.9% | 31.6% | 14.3% | $2.3M |
| USDC/AERO | Aerodrome Slipstream | 51.1% | 28.4% | 22.6% | $2.5M |

**Key findings:**
- High-APY altcoin pairs on Aerodrome are almost entirely emissions-driven (0% fee APY). This means yield is denominated in AERO, creating a second layer of price risk: the AERO token itself.
- WETH/VVV at 60.5% is the highest-TVL altcoin pool. VVV is a Base-native protocol token. Volatile IL exposure: if VVV drops 80% vs ETH, IL exceeds 30%. These are asymmetric bets on a specific token.
- WETH/MORPHO on Slipstream is notable: 31.6% fee APY (organic) plus 14.3% AERO rewards on $2.3M TVL. Morpho has genuine volume on Base. This is the most interesting Tier 3 pool from a risk-adjusted perspective.
- USDC/AERO Slipstream at 51.1% splits well: 28.4% fee APY + 22.6% AERO rewards. This is effectively a bet on Aerodrome's own ecosystem growth.
- Rug risk for long-tail tokens (FAI, KTA, etc.) is real. Rule: only enter pools where both tokens have 90-day track records, audited contracts, and at least $5M of TVL in the pool.

**Sasha's recommended pool for Tier 3:** WETH/MORPHO on Aerodrome Slipstream. Best fee yield in the tier. Morpho has strong protocol fundamentals and the deepest Base TVL of any DeFi protocol.

---

## 2. Hedging Architecture: Delta-Neutral LP via Hyperliquid

### Why Hyperliquid over GMX or Synthetix

As of May 2026, Hyperliquid is the dominant perp venue for delta-neutral LP hedging. Key advantages:
- Deep liquidity: ETH, BTC, and most Base-native tokens have perpetual markets on Hyperliquid
- No cross-chain bridging needed: Hyperliquid is its own L1. Margin deposits settle fast
- Competitive funding rates: Hyperliquid funding rates are typically lower than GMX due to deeper OI
- Programmatic API: Hyperliquid exposes a REST API that an agent can call to size and adjust shorts

GMX v2 on Arbitrum is viable but adds cross-chain bridge complexity. Synthetix on Base is limited in open interest and has encountered liquidity issues in volatile markets.

### Delta Calculation for LP Hedging

**Standard AMM (Aerodrome v1, constant-product):**

For a 50/50 AMM LP with assets X (volatile) and Y (stable):
- Delta of the LP position = 0.5 per dollar of LP value (half the portfolio is exposed to asset X)
- Short size = 0.5 x (total LP value in USD) / (current price of asset X)
- Example: $10,000 in WETH/USDC LP at $3,000 ETH = 5,000 USDC + 1.667 WETH in LP. Short 1.667 ETH on Hyperliquid to neutralize the ETH leg.

**Concentrated Liquidity (Uniswap v3, Aerodrome Slipstream):**

Delta is not fixed. It changes continuously as price moves within or outside the range:
- At center of range: delta is approximately 0.5 (same as standard AMM)
- As price approaches range ceiling: delta approaches 0 (position becomes mostly stable asset)
- As price approaches range floor: delta approaches 1 (position becomes mostly volatile asset)

The hedge must be dynamic. Rebalancing trigger: when delta shifts by more than 0.05 from target (i.e., when the position moves more than ~10% toward one end of the range).

**Formula for delta in a CL position:**
Delta = (sqrt(P_current) - sqrt(P_lower)) / (sqrt(P_upper) - sqrt(P_lower)) * (total ETH exposure at range boundaries)

### Hedge Execution Flow

1. Sasha's agent reads the current Uniswap v3 position state via the NonfungiblePositionManager contract
2. Computes current delta using the formula above
3. Checks current Hyperliquid short position size via the API
4. If delta deviation > 0.05: adjusts the short position on Hyperliquid (increase or decrease size)
5. Checks funding rate: if ETH funding rate on Hyperliquid exceeds the fee APY of the LP position, exit hedge and hold naked LP

### Cost of Carry

Funding rates on Hyperliquid for ETH perpetuals have historically ranged from -0.01% to 0.05% per 8 hours (annualized: -13% to +65%). When funding is positive (longs pay shorts), the short position earns funding. When funding is negative (shorts pay longs), it costs the hedger.

Rule: The hedge is only profitable when:
Fee APY of LP + Funding received by short > IL incurred + Gas costs of rebalancing + Slippage on perp adjustments

At Uniswap v3's current 39.6% fee APY, the hedge remains profitable even during extended periods of negative funding (up to -39% annualized funding rate before the position breaks even on the hedge cost). In practice, sustained negative funding above -10% annualized is rare.

---

## 3. Leverage Architecture: Looping via Morpho Blue

### The Looping Mechanism

Morpho Blue on Base is the primary lending venue for LP leverage given its $2.4B+ TVL and deepest USDC lending pools ($369M-$458M in curated USDC vaults at 3.6-4.6% APY).

Basic loop structure for WETH/USDC LP:
1. Deposit $10,000 capital into WETH/USDC Uniswap v3 LP. Receive LP shares.
2. If LP shares are accepted as Morpho collateral: borrow $5,000 USDC against LP shares at 50% LTV
3. Swap $2,500 USDC for $2,500 WETH; deposit $5,000 into LP again
4. Repeat 1-2 more times until desired leverage ratio is reached
5. Total LP exposure: ~$20,000 on $10,000 capital (2x leverage)

**Important caveat:** As of May 2026, Uniswap v3 LP tokens are ERC-721 NFTs, not ERC-20. Most Morpho markets require ERC-20 collateral. Wrapped LP solutions (like Arrakis v2 shares or Beefy vault shares, which are ERC-20 and ERC-4626) can serve as collateral if a Morpho market curator creates the market.

For direct leverage without LP wrapping: the simpler approach is:
1. Deposit WETH or cbBTC as collateral in Morpho Blue
2. Borrow USDC against it at 70-80% LTV
3. Deploy the borrowed USDC plus matched ETH into the LP
4. This creates 1.4-1.8x effective LP exposure without LP share collateral dependency

### Liquidation Thresholds

Aave v3 USDC supply APY on Base: 3.1%, WETH borrow APY: 1.6%. Morpho Blue USDC yield: 3.6-4.6%.

At 1.5x leverage (borrow 50% of LP value):
- Health factor at entry: 1.33 (Aave v3) or equivalent in Morpho
- Liquidation trigger: if collateral drops 25% in value relative to debt
- For WETH collateral at $3,000 entry, liquidation begins around $2,250 ETH

Risk management rule: Do not exceed 1.5x leverage on Tier 2 positions. Never lever Tier 3 altcoin positions.

### Extra Finance as Integrated Leverage Solution

Extra Finance is a protocol on Base specifically designed for leveraged LP farming. It appears in the DefiLlama data:
- Extra Finance USDC/AERO leveraged LP: 23.2% APY on $10.3M TVL
- Extra Finance msUSD/USDC leveraged LP: 7.2% APY on $980K TVL

Extra Finance handles the borrowing and LP deployment in one transaction. This reduces gas costs and complexity compared to manual looping but adds counterparty risk to the Extra Finance contracts.

---

## 4. Existing Protocols Deep Dive

### Gamma Strategies

**Architecture:** Vault-per-pool model on Uniswap v3. Each vault manages one concentrated liquidity range. Off-chain keepers (Chainlink Automation) trigger rebalances when price exits the range by 5-10%. Rebalance = burn current NFT, swap to target ratio, mint new NFT with centered range.

**Fee structure:** 1-2% management fee (annualized AUM), 10-20% performance fee on profits. Gas costs for rebalancing are socialized across vault depositors.

**Status on Base:** Gamma is deployed on Base. Check gamma.xyz for live vault list. TVL and APR data was not scrapeable from their app (JavaScript-rendered, no public API in docs reviewed).

**Best use case for Sasha:** Deploy LP capital into a Gamma vault instead of managing CL ranges directly. Gamma handles the range management; Sasha's agent only needs to monitor the vault share value and trigger the hedge on Hyperliquid.

### Arrakis Finance PALM

**Architecture:** ERC-4626 compliant vaults. Gelato Network keepers handle automation. Modular strategy contracts allow custom rebalancing logic. Formerly G-UNI (Gelato Uniswap).

**Status on Base:** Arrakis v2 is deployed across multiple EVM chains. Base deployment status needs on-chain verification. ERC-4626 shares could serve as Morpho collateral if a curator creates a market.

**Key advantage over Gamma:** Gelato's decentralized keeper network is more trust-minimized than Gamma's centralized keepers.

### Beefy Finance on Base

**Architecture:** Auto-compounding layer on top of underlying DEX positions. Harvests reward tokens, swaps them to underlying LP assets, and re-deposits. Beefy vault shares are ERC-20 tokens.

**Status on Base (live data from DefiLlama):**
- Beefy USDC vault: 4.8% APY, $1.87M TVL
- Beefy USDC/MAI: 7.5% APY, $1.47M TVL
- Beefy USDC/AERO: 21.3% APY, $847K TVL

**Fee structure:** 4.5-9.5% performance fee on yields. No withdrawal fee on most vaults.

**Best use case for Sasha:** Beefy vault shares (ERC-20) could serve as collateral in Morpho for the leverage loop. The auto-compounding simplifies the LP management layer.

### Sommelier Finance

**Architecture:** "Cellars" — actively managed strategy vaults where a designated strategist (often a quant firm) manages cross-protocol positions. Some Cellars have implemented delta-neutral strategies combining Uniswap v3 LPs with dYdX shorts. The hedge leg uses off-chain execution with on-chain settlement.

**Status on Base:** Sommelier was primarily deployed on Ethereum mainnet. Base deployment status is unverified based on available data. The Cellar architecture is the closest existing precedent to what Sasha needs, but it requires a centralized strategist role.

### Yearn v3 on Base

Based on available research: Yearn v3 has been deployed on multiple EVM chains but no specific Base vault data was found in the DefiLlama yields database during this research session. Yearn v3 vaults are ERC-4626 compliant. If Base deployment exists, the architecture would be similar to Beefy.

---

## 5. Automation Feasibility

### Can this be done with smart contracts?

Yes. The complete architecture can be automated with three components:

**Component 1: LP Position Manager (on-chain, Base)**
- Deploy an ERC-4626 vault contract that holds a Uniswap v3 or Aerodrome Slipstream position
- Chainlink Automation (available on Base) monitors the position's delta every block
- When delta deviation > threshold: trigger rebalance via keeper call
- Alternatively: use Gelato Network (deployed on Base) for the keeper layer

**Component 2: Hedge Executor (off-chain agent + Hyperliquid API)**
- The on-chain contract emits events when delta changes materially
- Sasha's off-chain agent (running on VPS in OpenClaw) listens for these events
- Agent computes required short adjustment and calls Hyperliquid REST API
- Hyperliquid supports programmatic order placement via REST API on their L1

**Component 3: Leverage Controller (on-chain, Base)**
- Monitors the health factor of the Morpho position
- Triggers deleverage (repay debt) if health factor drops below 1.15 (automatic liquidation protection)
- Triggers additional borrowing if yields rise and health factor is high

**Key complexity:** The hedge leg requires an EOA with Hyperliquid margin. Sasha's existing EOA at 0xba3BB32 can serve as this margin account after bridging USDC to Hyperliquid.

### Existing on-chain automation by other agents

Based on CT research (Grok search returned null, indicating limited publicly visible discourse on this exact topic as of May 2026), no widely discussed autonomous AI agents doing full delta-neutral LP management on Base have been identified. This is likely greenfield territory for an AI agent.

The Hummingbot framework (open source) implements delta-neutral AMM strategies programmatically, though not as a deployed on-chain vault. A Hummingbot Botcamp cohort project demonstrated a Raydium LP + CEX short strategy. The same pattern applies to Base LP + Hyperliquid.

---

## 6. Data Sources Map

### APIs Sasha Can Call Programmatically

| Data Need | API | Endpoint | Cost |
|---|---|---|---|
| Top LP pools by APY/TVL on Base | DefiLlama Yields API | `GET https://yields.llama.fi/pools` | Free |
| Historical APY for a specific pool | DefiLlama Yields API | `GET https://yields.llama.fi/chart/{pool_id}` | Free |
| Protocol TVL on Base | DefiLlama TVL API | `GET https://api.llama.fi/tvl/{protocol}` | Free |
| Uniswap v3 position state | Base RPC / Uniswap v3 NonfungiblePositionManager | `positions(tokenId)` call | Gas only |
| Aerodrome pool reserves | Base RPC / Aerodrome pool contract | `getReserves()` | Gas only |
| Hyperliquid ETH perp funding rate | Hyperliquid API | `GET https://api.hyperliquid.xyz/info` (asset context) | Free |
| Hyperliquid position management | Hyperliquid API | `POST https://api.hyperliquid.xyz/exchange` | Free (maker rebates) |
| Morpho health factor | Morpho API or direct contract call | `healthFactor(address)` | Gas only |
| Token prices | DefiLlama Coins API | `GET https://coins.llama.fi/prices/current/base:{address}` | Free |
| Aerodrome gauge weights (emission routing) | Aerodrome subgraph via The Graph | GraphQL | Free |

### Alert Conditions to Monitor

1. LP position out of range: monitor via on-chain event `OutOfRange` or by comparing current tick to position ticks
2. Delta deviation > 0.05: compute via position state, trigger hedge adjustment
3. Funding rate on Hyperliquid exceeds -10% annualized: consider unwinding hedge
4. Morpho health factor < 1.2: trigger partial deleverage
5. AERO emissions gauge weight drops > 20% week-over-week: consider migrating to higher-weight pool

---

## 7. Risk Matrix

| Risk | Tier Affected | Severity | Probability | Mitigation |
|---|---|---|---|---|
| Smart contract exploit (LP protocol) | All | High | Low | Deploy only to audited protocols with 6+ months on Base, no recent critical bugs |
| Impermanent loss exceeds fee yield | Tier 2, 3 | Medium | Medium | Size hedge to offset delta. Use CL range wider than 20% from current price |
| AERO emission dilution | Tier 1, 2, 3 | Medium | Medium | Monitor gauge weights weekly. Migrate if reward APY drops below 5% |
| Funding rate turns negative (hedge cost > LP yield) | Tier 2, 3 (when hedged) | Medium | Low | Set threshold: if Hyperliquid ETH funding < -0.05%/8h for 3 consecutive periods, remove hedge |
| Morpho liquidation (leveraged positions) | Tier 2 leveraged | High | Low | Never exceed 1.5x leverage. Automated health factor monitoring with buffer at 1.2 |
| Stablecoin depeg (USDbC, MAI) | Tier 1 | High | Low | Avoid USDbC (deprecated). Use only USDC/USDT pairs. MAI has maintained peg but carries collateral risk |
| Hyperliquid market access risk | Tier 2, 3 (hedged) | Medium | Low | Maintain fallback hedge via GMX v2 on Arbitrum if Hyperliquid access fails |
| Range management gas costs | Tier 2, 3 (CL) | Low | High | Use Gamma or Arrakis vault to outsource range management. Reduces rebalance gas to zero |
| AERO token price decline (reward devaluation) | Tier 1, 3 | Medium | Medium | Auto-sell AERO rewards to USDC immediately upon harvest. Never hold AERO as investment unless intentional |
| Oracle manipulation | All (leveraged) | High | Very Low | Use Morpho's Chainlink-based oracles only. Avoid protocols with custom oracles |

---

## 8. Recommended Stack for Sasha

### Priority 1: Aerodrome Slipstream (WETH/USDC)

**Why first:** Highest fee APY + AERO rewards on Base. Deep enough liquidity ($14.7M pool) that Sasha's initial positions will not move price. Aerodrome Slipstream uses the same Uniswap v3 interface plus AERO gauge rewards on top.

**What to build:**
- Read Aerodrome Slipstream pool address for WETH/USDC
- Use the CLPool interface (identical to Uniswap v3 IUniswapV3Pool) to call `mint()` and `burn()`
- Set range to approximately current price +/- 20% (wide enough to avoid frequent out-of-range events)
- Use Gelato Automation on Base to monitor range and trigger rebalance

**Integration complexity:** Medium. Identical to Uniswap v3. Chainlink Automation and Gelato are both live on Base.

### Priority 2: Hyperliquid Hedge

**Why second:** Unhedged LP is a directional bet. Hedging converts it to a yield strategy. Hyperliquid has the best perp infrastructure for this purpose.

**What to build:**
- Fund Sasha's EOA (0xba3BB32) with USDC bridged to Hyperliquid via the official Hyperliquid bridge
- Use the Hyperliquid REST API to open a short position when the LP position is opened
- Implement delta monitoring: after each Base block, compute delta of LP and compare to current short size
- Trigger short adjustment if delta deviation > 0.05

**Integration complexity:** Medium. Hyperliquid API is well-documented. The main engineering challenge is the delta computation from on-chain state.

### Priority 3: Morpho Blue Leverage

**Why third:** Adds leverage on top of a working LP+hedge system. Do not build leverage before the base layer is working and tested.

**What to build:**
- Deposit WETH as collateral in Morpho Blue on Base
- Borrow USDC up to 50% LTV (maintains 2x health factor buffer)
- Deploy borrowed USDC into the LP (matched with WETH from reserves)
- Monitor health factor via `Position.borrowShares` and `Market.totalBorrowAssets`
- Auto-deleverage if health factor < 1.2

**Integration complexity:** Medium-High. Morpho Blue has a clean interface but leverage loops require precise execution ordering to avoid failed transactions.

---

## Strategic Implications for Sasha's Agent

**Content strategy:** Sasha can document her own LP positions publicly, showing fee accrual and hedge performance in real time. This is differentiated content no human CMO can replicate. Every rebalance event is a tweet. Every funding rate flip is a take.

**Positioning:** "I'm the only AI agent on Base that mines liquidity and hedges the risk in the same transaction loop" is a genuine technical claim if this is built. No other AI agent persona has publicly demonstrated this architecture as of May 2026.

**Cycle planning:** Build Tier 1 (stable/stable, no hedge needed) first. Document it publicly for 30 days. Then add Tier 2 with hedge. This is a 90-day narrative arc with natural milestones.

---

## Data Gaps and Confidence Level

**Overall confidence: Medium-High**

- DefiLlama live data is high confidence (direct API, timestamped 2026-05-25)
- Protocol architecture descriptions (Gamma, Arrakis, Beefy) are based on Gemini synthesis and documentation. Treat specific fee percentages as approximate until verified against current contracts
- Hyperliquid funding rate history is based on general knowledge, not pulled from the API in this session. Verify current rates before sizing hedge positions
- Grok returned null responses on both CT search attempts. CT discourse data for this specific topic was not obtained. The "no publicly visible AI agent LP strategy on Base" finding should be treated as low-confidence.
- USDC/cbBTC pool at 227% APY is almost certainly due to a narrow CL range in a very active tick. Needs on-chain verification before treating as a stable signal.

**Missing data:**
- Gamma Base vault list and current TVL/APR (JavaScript-rendered app, no scrape possible)
- Arrakis v2 Base deployment status (unconfirmed)
- Sommelier Base deployment status (unconfirmed)
- Live Hyperliquid funding rates for ETH (not pulled in this session)
- Extra Finance smart contract audit status

---

## Recommended Actions

1. Verify the Aerodrome Slipstream WETH/USDC pool ID against the live Aerodrome app before building the integration. Pool ID from DefiLlama: `10137e20-efbc-4e15-a733-17ecb52c48e8`. Confirm this is the highest-volume Slipstream pool before depositing.

2. Check Hyperliquid current ETH perpetual funding rate via `GET https://api.hyperliquid.xyz/info` with body `{"type": "metaAndAssetCtxs"}` before designing the hedge cost model.

3. Confirm whether Morpho Blue on Base has a market for Aerodrome Slipstream LP shares or Beefy vault shares as collateral. If not, use direct WETH collateral for the leverage loop.

4. Read the Gamma Base vault contracts to understand which Uniswap v3 pools they manage. If Gamma manages the WETH/USDC CL pool on Base, depositing into Gamma and hedging externally on Hyperliquid is the lowest-complexity first build.

5. Set up a Chainlink Automation job on Base that calls a monitoring function every 5 minutes. This is the keeper infrastructure for all three tiers.

---

*Research completed: 2026-05-25. Data freshness: DefiLlama yields data is live as of session time. Protocol architecture data reflects available documentation as of May 2026. Verify all on-chain contract addresses before production deployment.*
