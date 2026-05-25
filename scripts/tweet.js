#!/usr/bin/env node
// Usage: node scripts/tweet.js --text "tweet text" [--reply-to <tweet_id>] [--dry-run]
import { TwitterApi } from 'twitter-api-v2';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const textIndex = args.indexOf('--text');
const replyIndex = args.indexOf('--reply-to');

if (textIndex === -1 || !args[textIndex + 1]) { console.error('ERROR: --text required'); process.exit(1); }
const tweetText = args[textIndex + 1];
const replyToId = replyIndex !== -1 ? args[replyIndex + 1] : null;

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  console.error('ERROR: Missing X credentials (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)');
  process.exit(1);
}

const payload = { text: tweetText };
if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId };

if (DRY_RUN) {
  console.log('DRY_RUN:', JSON.stringify(payload, null, 2));
  process.exit(0);
}

const client = new TwitterApi({
  appKey:      X_API_KEY,
  appSecret:   X_API_SECRET,
  accessToken: X_ACCESS_TOKEN,
  accessSecret: X_ACCESS_SECRET,
});

try {
  const result = await client.v2.tweet(payload);
  console.log('SUCCESS');
  console.log(JSON.stringify({ tweet_id: result.data.id, text: result.data.text }));
  process.exit(0);
} catch (err) {
  console.error('ERROR:', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exit(1);
}
