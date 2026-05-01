# Twitter Reply Gal Skill

## When to use this skill
Triggered by cron with message: [TWITTER_REPLY_GAL]

## Target accounts
CryptoWendyO, MissTeenCrypto, natbrunell, LayahHeilpern, girlgone_crypto

## Steps

### 1 - Scrape tweets via Apify
Make an HTTP POST to:
https://api.apify.com/v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items?token=APIFY_TOKEN

Replace APIFY_TOKEN with the value from your environment.

Body:
{"twitterHandles":["CryptoWendyO","MissTeenCrypto","natbrunell","LayahHeilpern","girlgone_crypto"],"maxTweets":5}

Wait up to 120 seconds. Returns array of tweet objects with: id, text, user.screen_name, created_at, favorite_count.

### 2 - Select up to 2 reply-worthy tweets
ALL criteria must pass:
- Posted within last 6 hours
- Topic: crypto education, DeFi, Bitcoin, women in crypto, blockchain, financial inclusion
- NOT: specific price predictions, token shilling, giveaways
- At least 5 likes OR 2 replies
- Skip if unsure whether already replied

### 3 - Write Sasha reply for each selected tweet
Rules:
- Max 240 characters
- No hashtags, no links, no @mentions
- No emojis unless original tweet uses them
- Do NOT open with a compliment
- Add one concrete angle, question, or data point
- 1-2 sentences, warm and direct, peer not fan

Good example: "The liquidity argument is real. Most newcomers I work with hit this wall in week two — it is where the education gap is sharpest."
Bad example: "Love this post! So true!"

### 4 - Post each reply via tweet.js
Run this command for each reply:
node /data/.openclaw/workspace/scripts/tweet.js --text "REPLY_TEXT" --reply-to TWEET_ID

If SUCCESS: continue to next reply.
If ERROR 429: stop immediately, do not retry.
If ERROR 403: send alert to Telegram owner.

### 5 - Report results to Telegram
Format:
Tweets reviewed: N
Replies posted: N
Then list each: @handle - their tweet snippet - Sasha reply
