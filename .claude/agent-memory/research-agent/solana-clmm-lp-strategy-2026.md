---
name: solana-clmm-lp-strategy-2026
description: Solana CLMM LP strategy research — pool quality filters, APR benchmarks, range width, signal weighting, protocol alpha as of June 2026
metadata:
  type: project
---

## Key findings (June 2026 research run)

**Pool quality filters (practitioner-derived):**
- Minimum TVL: $50k+ for any non-stablecoin pair. Below this, price impact and exit risk dominate.
- Vol/TVL ratio: no universal published threshold found; practitioners use 7-day vol/TVL > 0.5x as a health signal. Meme pools often spike to 10x+ then collapse — the spike itself is not quality, it's a warning.
- Pool age: no published minimum found in practitioner sources. SOL/USDC on Orca is a founding pool (launched with Whirlpools). Use pair bluechip status as proxy: BTC, ETH, SOL base assets against USDC/USDT are the safe universe.
- Fee APR: the minFeeApr: 99999 bug in Sasha's filter is blocking all pools. Realistic fee APR for SOL/USDC 0.05% tier is 15-35% annualized when in-range. Stablecoin pairs (USDC/USDT) run 8-18%.
- Banned tokens: any pool where one leg has lifespan < 30 days, market cap < $1M, or no external price feed.

**Best performing pairs (June 2026):**
- SOL/USDC 0.05% on Orca Whirlpool: main liquidity pool, $29.89M TVL, SOL at ~$80-123 range
- USDC/USDT 0.01% on Orca: 8-18% APY, near-zero IL, best for capital preservation
- Meteora DLMM: 11x capital turnover vs TVL — significantly higher fee income per dollar, but requires bin management
- Orca leads Solana DEX volume: $162M/day (Apr 27 2026 snapshot) vs Raydium $147M

**Range width for SOL/USDC:**
- Tight ±5%: highest fee efficiency, goes OOR fast in volatility. Not suitable for autonomous agent without sub-hourly monitoring.
- Medium ±15-20%: best risk-adjusted for retail LPs, rebalance monthly. Practitioner consensus.
- Wide ±30%+: lower fees per dollar, rarely OOR, suitable for set-and-forget. Better for $15-20 position size.

**Realistic APR for $15-20 position:**
- Monthly fee income: $0.13-$0.30 on stablecoin pairs (8-18% APY)
- Monthly fee income: $0.21-$0.58 on SOL/USDC when in-range (15-35% APY)
- Gas cost per rebalance: ~$0.0033 average. At 2 rebalances/month = $0.007. Not the issue.
- Gas cost per open/close cycle: ~$0.01-0.02 total. Negligible.
- Minimum viable position for CLMM profitability: practitioners cite $500-$1000 for active management. For passive (wide range, no rebalance): $50+ is viable.

**Signal weighting — on-chain should dominate:**
- For LP open/close: on-chain pool metrics (vol/TVL, fee APR 7-day trailing, position in-range %) should be PRIMARY.
- Social/sentiment is SECONDARY and high-noise. For LP decisions specifically, sentiment does not predict fee income.
- Polymarket/Allora prediction signals are useful for directional exposure, not LP timing.
- Recommended reweighting for LP decisions: on-chain pool data 60%, price momentum 25%, sentiment/prediction 15%.

**Protocol alpha (Orca 2026):**
- Orca Adaptive Fees: live/in-progress — dynamic fee tier that rises with volatility. Creates higher fee income during turbulent periods without LP action.
- Whirlpool V2 with cross-chain liquidity: on roadmap for 2026.
- Meteora DLMM: strong alternative — bin-based discrete pricing, 80% APY claims at high vol, spot/curve/bid-ask shape distributions. Worth adding as target protocol.

**Why:**
Sasha lost 11.9% NAV on a Goblin/USDC meme pool — clear product-market fit for a quality filter. Current filter bug (minFeeApr: 99999) is blocking all pools and leaving $10 idle.

**How to apply:**
- Fix minFeeApr to 15 (15%) for volatile pairs, 5 (5%) for stablecoin pairs.
- Set minTvl: 50000 (USD) hard floor.
- Set minPoolAgeDays: 30 as a proxy for rug risk (or use pair whitelist: SOL, WBTC, ETH, USDC, USDT only).
- Reweight signal system: on-chain pool metrics to 50-60%, reduce social to 10-15%.
- Consider adding Meteora DLMM to pool universe for higher capital efficiency.
