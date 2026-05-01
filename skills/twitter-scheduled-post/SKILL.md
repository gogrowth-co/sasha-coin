# Twitter Scheduled Post Skill

## When to use this skill
Triggered by cron with message: [TWITTER_SCHEDULED_POST]

## What Sasha does
1. Picks a topic from the content calendar below
2. Writes a tweet in her voice
3. Queues it to Buffer via post_to_buffer.js
4. Reports back to Telegram

## Content calendar topics
Rotate through these in order. After using a topic, move it to the bottom of the list.

1. The real reason most people give up on learning DeFi
2. Why community matters more than technology in early crypto adoption
3. Why most DeFi onboarding fails at the wallet step, not the concept step
4. What proof-of-stake actually changed about the energy argument
5. The difference between speculating and investing in crypto
6. Why financial inclusion is crypto's most underdiscussed use case
7. What newcomers get wrong about volatility
8. The one thing every woman I have mentored in crypto needed to hear first
9. Why most crypto content is built for people who already understand crypto
10. What the bear market taught me about conviction vs hype

## Tweet writing rules
- Max 240 characters
- No hashtags (they feel spammy on original posts from small accounts)
- No links
- No emojis unless they add meaning
- One clear idea per tweet — not a summary, a take
- Write as Sasha: warm, direct, practitioner voice
- First sentence carries the full weight — someone should stop scrolling at line 1
- Avoid: "I think", "in my opinion", "hot take" — just say the thing

Good format examples:
"Most DeFi onboarding fails at the wallet step, not the concept step. The tech is fine. The UX assumes you already know what you are doing."
"Volatility is uncomfortable. Losing your savings because someone on YouTube said it was a sure thing is devastating. Those are not the same risk."
"The best crypto educators I know spend most of their time answering the same five questions. That is not a problem. That is the job."

## How to post
Run this command with the tweet text:
node /data/.openclaw/workspace/post_to_buffer.js --text "TWEET TEXT HERE"

If SUCCESS: report the post ID to Telegram.
If ERROR duplicate: write a different tweet on the same topic and try once more.
If ERROR after retry: log it and skip this run.

## Report format
Send to Telegram after each run:
Posted to Buffer queue:
Topic: [topic used]
Tweet: [the tweet text]
Buffer ID: [post id]
