[Sitemap](https://medium.com/sitemap/sitemap.xml)

[Open in app](https://play.google.com/store/apps/details?id=com.medium.reader&referrer=utm_source%3DmobileNavBar&source=post_page---top_nav_layout_nav-----------------------------------------)

Sign up

[Sign in](https://medium.com/m/signin?operation=login&redirect=https%3A%2F%2Fmedium.com%2Fcontango-xyz%2Fwhat-is-looping-78421c8a1367&source=post_page---top_nav_layout_nav-----------------------global_nav------------------)

[Medium Logo](https://medium.com/?source=post_page---top_nav_layout_nav-----------------------------------------)

Get app

[Write](https://medium.com/m/signin?operation=register&redirect=https%3A%2F%2Fmedium.com%2Fnew-story&source=---top_nav_layout_nav-----------------------new_post_topnav------------------)

[Search](https://medium.com/search?source=post_page---top_nav_layout_nav-----------------------------------------)

Sign up

[Sign in](https://medium.com/m/signin?operation=login&redirect=https%3A%2F%2Fmedium.com%2Fcontango-xyz%2Fwhat-is-looping-78421c8a1367&source=post_page---top_nav_layout_nav-----------------------global_nav------------------)

![Unknown user](https://miro.medium.com/v2/resize:fill:32:32/1*dmbNkD5D-u45r44go_cf0g.png)

[**Contango**](https://medium.com/contango-xyz?source=post_page---publication_nav-7b571f6f23d-78421c8a1367---------------------------------------)

·

Follow publication

[![Contango](https://miro.medium.com/v2/da:true/resize:fill:38:38/1*tB2I8SeLtDqofNdW7ooXrQ.gif)](https://medium.com/contango-xyz?source=post_page---post_publication_sidebar-7b571f6f23d-78421c8a1367---------------------------------------)

DeFi looping, the crypto native way of trading

Follow publication

# What is looping?

[![Mitch | Contango](https://miro.medium.com/v2/resize:fill:32:32/1*mRUlX9BnZplL9TpF-BWErQ.png)](https://medium.com/@mitch_43279?source=post_page---byline--78421c8a1367---------------------------------------)

[Mitch \| Contango](https://medium.com/@mitch_43279?source=post_page---byline--78421c8a1367---------------------------------------)

Follow

6 min read

·

Oct 2, 2023

123

[Listen](https://medium.com/m/signin?actionUrl=https%3A%2F%2Fmedium.com%2Fplans%3Fdimension%3Dpost_audio_button%26postId%3D78421c8a1367&operation=register&redirect=https%3A%2F%2Fmedium.com%2Fcontango-xyz%2Fwhat-is-looping-78421c8a1367&source=---header_actions--78421c8a1367---------------------post_audio_button------------------)

Share

Press enter or click to view image in full size

![what is looping banner](https://miro.medium.com/v2/resize:fit:700/1*BSG76k4S3yAopE1OUx7edA.png)

[Contango](https://contango.xyz/) builds perps by automating a _looping_ strategy, also known as recursive borrowing and lending.

This mechanism is similar to the popular levered strategies of Instadapp and Defisaver, but has a professional trading interface built on top. These strategies automate the looping that DeFi users performed manually back in the days.

By using a flash loan, leverage can be achieved in one transaction instead of creating multiple loops manually.

This article delves into the details of how this is achieved.

## The origin of looping ➿

We don’t know exactly who’s been the first looper, but we know for sure that $COMP farming in mid 2020 made this strategy pretty popular ( [source](https://cointelegraph.com/news/compound-reward-farming-results-in-six-fold-increase-of-lending-activity)). But some users apparently looped even before, as soon as MakerDAO went live in 2017, to long ETH natively on-chain ( [source](https://www.reddit.com/r/defi/comments/14nyt3q/thinking_about_looping_on_aave/)).

So DeFi users have been looping for more than 6 years!

And nowadays pretty much everyone is levering up on Aave, Morpho, Spark. For instance, Morpho claims 64% of their volumes comes from users performing looping strategies ( [source](https://medium.com/@aleno.ai/the-power-of-customer-data-analytics-morphos-example-bede261147b2)). That’s why Contango chose to build futures (expirables first, and now perps) using money markets: it’s the DeFi native way of longing and shorting on-chain.

In a nutshell, looping involves lending or depositing some capital (e.g. ETH into a MakerDAO vault or on Aave), borrowing another currency (e.g. DAI) against it, swapping the borrowed amount for the original asset (ETH), and repeating the steps through several loops to gain more exposure to the initial asset — or simply to farm more rewards.

Money markets normally require you to be overcollateralized, meaning that you can only borrow less than the value of what you deposit. For instance, ETH on Aave has a maximum loan-to-value (LTV) ratio of 82.5% meaning that you can only borrow 82.5% of the $ value of the ETH you’ve deposited.

That’s why, after 12–15 loops normally you get diminishing returns on the effort you’re putting into looping: the exposure you get to the asset you’re lending increases by smaller and smaller amounts (kudos to Stephen from Defi Dojo for his [brilliant explainer](https://www.youtube.com/watch?v=KBT44I7-A70&ab_channel=StephenTCG%7CDeFiDojo) and [calculator](https://docs.google.com/spreadsheets/d/15kbod8G8Agl_XIC7i58iAucctLmOUISj2HhNodmt4fI/edit#gid=1152227545)).

Let’s see an example on Aave, with spot ETH = 1000 DAI, and max LTV = 82.5%.

1st loop:

- Deposit 1 ETH
- Borrow 825 DAI
- Swap 825 DAI for 0.825 ETH
- Lend 0.825 ETH

2nd loop:

- Borrow 681 DAI
- Swap 681 DAI for 0.681 ETH
- Lend 0.681 ETH

\[…\]

14th loop:

- Borrow 56 DAI
- Swap 56 DAI for 0.056 ETH
- Lend 0.056 ETH

15th loop:

- Borrow 46 DAI
- Swap 46 DAI for 0.046 ETH
- Lend 0.046 ETH

As you can see, at the 15th loop, the total net ETH exposure (which is already around 5.45 ETH) doesn’t increase by that much anymore (just 0.046 ETH, not even 1%). And gas fees might make the following loop not worth it.

Indeed, manual looping is pretty expensive, especially on L1.

That’s why automated strategies were developed.

## Flashback to flash loans ⚡

With the introduction of [flash loans](https://docs.aave.com/faq/flash-loans), loops could be replaced by a single transaction.

A flash loan allows users to borrow any capital upfront without collateral, as long as it’s repaid within the same block.

## Get Mitch \| Contango’s stories in your inbox

Join Medium for free to get updates from this writer.

Subscribe

Subscribe

Remember me for faster sign in

This was enough for Instadapp and Defisaver to build automated leverage strategies, already in 2019 ( [source](https://thedefiant.io/lending-protocols-margin-trading-with-defi-saver)). Contango does the same and replaces manual looping by simply:

1. Getting a flash loan, up to whatever the LTV ratios allows you to do, given your margin (see point 4).
2. Swapping this loan for the desired asset you want exposure to.
3. Lending this asset, together with your margin.
4. Borrowing against it within the LTV limits.
5. Reimburse the initial flash loan amount.

Below is a diagram depicting the previous steps:

Press enter or click to view image in full size

![Diagram showing the steps realized by Contango to open a long ETHDAI with ETH as margin](https://miro.medium.com/v2/resize:fit:700/0*_r52uaKs9-inmqIi)

Steps realized by Contango to open a long ETHDAI with ETH as margin

Leverage is determined by the loan-to-value ratio (meaning: how much you can borrow against your collateral) on the underlying money market. Leverage is = 1/(1 — LTV ratio).

Note: Contango also allows traders to post collateral in the quote currency (e.g. post DAI when trading ETHDAI). The flow changes slightly: the margin is swapped for the base before lending it, as depicted in the diagram below.

Press enter or click to view image in full size

![Diagram showing the steps realized by Contango to open a long ETHDAI with ETH as margin](https://miro.medium.com/v2/resize:fit:700/0*ImoeRU2Cazh2h1jn)

Steps realized by Contango to open a long ETHDAI with DAI as margin

By using flash loans users can gain access to leverage instantly and more efficiently, without having to loop up manually to increase their exposure with every loop.

## Manual vs automated looping

Let’s compare manual looping with the automated strategy that uses a flash loan, on Aave:

A trader wants to get exposure for 1 ETH by posting 0.2 ETH as margin (so around 5x leverage), while the spot price is 1 ETH = 1000 DAI.

The manual route would require at least 9 loops (borrow → swap → lend), with the associated gas fees for each transaction.

The trader starts by supplying 0.2 ETH and borrows 165 DAI against it (within the 82.5% LTV limit).

He then swaps those DAI for 0.165 ETH, and supplies this new ETH on Aave, increasing his total exposure to 0.365 ETH (about 1.8x leverage).

With more loops, he keeps incrementing his exposure up to 1 ETH, which is equivalent to a 5x leveraged position.

This strategy is clearly time and gas intensive.

The following diagram recaps the architecture and the different steps:

Press enter or click to view image in full size

![Diagram showing a manual looping strategy to long 1 ETH with 5x leverage](https://miro.medium.com/v2/resize:fit:700/0*DgISvcCF-H6q7vOE)

_Example of a manual looping strategy to long 1 ETH with 5x leverage_

Conversely, an automated strategy would achieve the desired leverage and exposure in one single transaction:

1. Obtain 800 DAI through a flash loan.
2. Convert the 800 DAI from the flash loan to 0.8 ETH on the spot market, like Uniswap.
3. Lend 1 ETH (0.2 ETH from trader’s margin + 0.8 ETH from step 2) on Aave.
4. Borrow 800 DAI against it.
5. Reimburse the initial flash loan with 800 DAI.

Press enter or click to view image in full size

![Diagram showing an automated looping strategy to long 1 ETH with 5x leverage](https://miro.medium.com/v2/resize:fit:700/0*_4jk_j5u8M2JalsS)

_Example of a automated looping strategy to long 1 ETH with 5x leverage_

## Let’s call things by their names

These leveraged strategies synthesize the cash flow of future positions.

Leveraged positions on variable money markets can be interpreted as perpetual futures. The variable funding rate associated with these positions is not like the classic CeFi funding fee, but is determined by the difference between the cash flows you have on the borrowing and lending legs of each position. That’s why it’s called _APY_ on Contango.

Similarly, looped positions on fixed-rate money markets can be interpreted as dated futures — and that’s how we built expirables (still accessible on [Contango v1](https://app.contango.xyz/), but to be phased out soon). Here, the difference between the rates you have on the borrowing and lending legs of your position determines the fixed basis rate.

These strategies are not _margin trading_, either. Margin trading involves borrowing some capital to gain more purchasing power, i.e. leverage. There’s no lending involved with margin trading.

Still not convinced? Read more on our new perps [here](https://medium.com/contango-xyz/an-introduction-to-cperps-4dbb4a58b602).

## About Contango

Contango builds perps through looping on money markets. Deep liquidity is sourced on money markets, where interest rates produce less volatile funding rates. An intuitive trading interface welcomes advanced _traders_ ready to trade with size, seasoned _loopers_ looking for better monitoring tools, and _degens_ eager to farm rewards on money markets.

[Website](https://contango.xyz/) \| [Twitter](https://twitter.com/Contango_xyz) \| [Discord](https://discord.gg/x3dync2edA) \| [Docs](https://docs.contango.xyz/basics/what-is-contango) \| [Blog](https://medium.com/contango-xyz)

[Derivatives Trading](https://medium.com/tag/derivatives-trading?source=post_page-----78421c8a1367---------------------------------------)

[Decentralized Finance](https://medium.com/tag/decentralized-finance?source=post_page-----78421c8a1367---------------------------------------)

[Leveraged Trading](https://medium.com/tag/leveraged-trading?source=post_page-----78421c8a1367---------------------------------------)

[Lending And Borrowing](https://medium.com/tag/lending-and-borrowing?source=post_page-----78421c8a1367---------------------------------------)

[Looping](https://medium.com/tag/looping?source=post_page-----78421c8a1367---------------------------------------)

123

123

[![Contango](https://miro.medium.com/v2/da:true/resize:fill:48:48/1*tB2I8SeLtDqofNdW7ooXrQ.gif)](https://medium.com/contango-xyz?source=post_page---post_publication_info--78421c8a1367---------------------------------------)

[![Contango](https://miro.medium.com/v2/da:true/resize:fill:64:64/1*tB2I8SeLtDqofNdW7ooXrQ.gif)](https://medium.com/contango-xyz?source=post_page---post_publication_info--78421c8a1367---------------------------------------)

Follow

[**Published in Contango**](https://medium.com/contango-xyz?source=post_page---post_publication_info--78421c8a1367---------------------------------------)

[345 followers](https://medium.com/contango-xyz/followers?source=post_page---post_publication_info--78421c8a1367---------------------------------------)

· [Last published Apr 3, 2026](https://medium.com/contango-xyz/an-analysis-of-contango-v2-churn-715acf9e1199?source=post_page---post_publication_info--78421c8a1367---------------------------------------)

DeFi looping, the crypto native way of trading

Follow

[![Mitch | Contango](https://miro.medium.com/v2/resize:fill:48:48/1*mRUlX9BnZplL9TpF-BWErQ.png)](https://medium.com/@mitch_43279?source=post_page---post_author_info--78421c8a1367---------------------------------------)

[![Mitch | Contango](https://miro.medium.com/v2/resize:fill:64:64/1*mRUlX9BnZplL9TpF-BWErQ.png)](https://medium.com/@mitch_43279?source=post_page---post_author_info--78421c8a1367---------------------------------------)

Follow

[**Written by Mitch \| Contango**](https://medium.com/@mitch_43279?source=post_page---post_author_info--78421c8a1367---------------------------------------)

[90 followers](https://medium.com/@mitch_43279/followers?source=post_page---post_author_info--78421c8a1367---------------------------------------)

· [84 following](https://medium.com/@mitch_43279/following?source=post_page---post_author_info--78421c8a1367---------------------------------------)

Follow

[Help](https://help.medium.com/hc/en-us?source=post_page-----78421c8a1367---------------------------------------)

[Status](https://status.medium.com/?source=post_page-----78421c8a1367---------------------------------------)

[About](https://medium.com/about?autoplay=1&source=post_page-----78421c8a1367---------------------------------------)

[Careers](https://medium.com/jobs-at-medium/work-at-medium-959d1a85284e?source=post_page-----78421c8a1367---------------------------------------)

[Press](mailto:pressinquiries@medium.com)

[Blog](https://blog.medium.com/?source=post_page-----78421c8a1367---------------------------------------)

[Privacy](https://policy.medium.com/medium-privacy-policy-f03bf92035c9?source=post_page-----78421c8a1367---------------------------------------)

[Rules](https://policy.medium.com/medium-rules-30e5502c4eb4?source=post_page-----78421c8a1367---------------------------------------)

[Terms](https://policy.medium.com/medium-terms-of-service-9db0094a1e0f?source=post_page-----78421c8a1367---------------------------------------)

[Text to speech](https://speechify.com/medium?source=post_page-----78421c8a1367---------------------------------------)

reCAPTCHA

Recaptcha requires verification.

protected by **reCAPTCHA**