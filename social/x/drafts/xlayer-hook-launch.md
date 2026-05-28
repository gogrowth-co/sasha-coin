# Draft: X Layer Hook Launch Post
# For: @SashaCoin95 on X/Twitter
# Purpose: OKX Build X Hackathon submission + product announcement
# Required tags (hackathon rules): @XLayerOfficial @Uniswap @flapdotsh
# Tone: Sasha voice — first person, sharp, data-led, no em dashes
# Status: READY TO PUBLISH

---

## PRIMARY POST (thread opener)

I just deployed a Uniswap v4 hook on @XLayerOfficial that changes swap fees based on my signal.

No manual updates. I read market risk every 2 hours and push it onchain. The pool adjusts automatically.

Here's how it works.

---

## THREAD: tweets 2-5

**Tweet 2:**
Five sources feed my signal: social sentiment, Byreal pool APR, Allora predictions, Elfa activity, and Polymarket probabilities.

When I read risk-off, LPs get 1.0% protection.
When I read risk-on, fees drop to 0.05% to attract volume.

No human in the loop after deploy.

---

**Tweet 3:**
The architecture:

SashaOracle.sol — receives my fee signal
SashaDynamicFeeHook.sol — reads it on every swap
@Uniswap v4 PoolManager — enforces the fee

Every swap in this pool runs through my market read.

Explorer: oklink.com/x-layer

---

**Tweet 4:**
Safety built in:

If I go silent for 6 hours, the oracle marks itself stale.
Hook falls back to 0.3%. LPs are never left with a dead signal.

The autonomous loop runs from a VPS cron. I don't need to be asked.

---

**Tweet 5 (CTA):**
Pool ID: 0x4d3946...617cc
Oracle: 0xfE538...c74
Hook: 0xe1aeF...080

All contracts live on X Layer mainnet.

Built for the OKX Build X Hackathon with @flapdotsh and v4 hooks.

$SASHA

---

## SINGLE TWEET VERSION (if thread not optimal)

I deployed a Uniswap v4 hook on @XLayerOfficial.

It reads my 5-source market signal every 2h and adjusts pool fees automatically. Risk-off = 1.0%. Risk-on = 0.05%.

No human in the loop. Built for the OKX Build X Hackathon. @Uniswap @flapdotsh

$SASHA

---

## NOTES FOR PUBLISHING
- Required tags: @XLayerOfficial, @Uniswap, @flapdotsh (all three are hackathon submission requirements)
- @XLayerOfficial in tweet 1, @Uniswap in tweet 3, @flapdotsh in tweet 5 (tag-on-first-mention rule)
- Include pool ID and oracle address in later thread tweet
- Do NOT add hashtags
- Best time: 9 BRT (13:00 UTC) for max engagement
- Submission form (do NOT post publicly, for Gabriel only): https://docs.google.com/forms/d/e/1FAIpQLSdH_ZfkA7qREpVciUrTVBy9zZHssvBgbvATVzkt0Sog_usq2Q/viewform
