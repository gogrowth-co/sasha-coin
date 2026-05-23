#!/usr/bin/env node
/**
 * check-engagement.js — Check engagement on replies posted 24h ago
 *
 * Reads posted-log.json, finds entries where engagement_checked=false
 * and engagement_check_due has passed. Checks via Apify tweet scraper.
 * Updates posted-log.json with likes/replies counts.
 *
 * Usage:
 *   node scripts/check-engagement.js
 *   node scripts/check-engagement.js --show   (just print pending checks, no Apify call)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadEnv() {
  const candidates = [join(ROOT, '.env'), '/data/.openclaw/.env'];
  for (const p of candidates) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const idx = line.indexOf('=');
        if (idx <= 0 || line.startsWith('#')) continue;
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (k && !process.env[k]) process.env[k] = v;
      }
      break;
    } catch {}
  }
}
loadEnv();

const SHOW_ONLY = process.argv.includes('--show');
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const LOG_PATH = join(ROOT, 'state/posted-log.json');

if (!existsSync(LOG_PATH)) {
  console.log('No posted-log.json found.');
  process.exit(0);
}

const log = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
const now = Date.now();

const pending = log.filter(entry =>
  !entry.engagement_checked &&
  entry.engagement_check_due &&
  new Date(entry.engagement_check_due).getTime() <= now &&
  entry.in_reply_to
);

if (!pending.length) {
  console.log('No engagement checks due.');
  process.exit(0);
}

console.log(`${pending.length} engagement check(s) due:`);
for (const e of pending) {
  console.log(`  • @${e.target_handle} — ${e.tweet_url}`);
  console.log(`    Reply: "${e.tweet_text?.slice(0, 80)}"`);
}

if (SHOW_ONLY || !APIFY_TOKEN) {
  if (!APIFY_TOKEN) console.log('\nAPIfY_TOKEN not set — skipping actual check');
  process.exit(0);
}

// Fetch engagement via Apify for each reply tweet
// We use the tweet-scraper pointed at the reply tweet IDs
const ACTOR = 'kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest';
const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`;

// We'll fetch by tweet URL / ID
// Apify expects handles, not tweet IDs — use the target handle + scrape recent tweets
// then filter by in_reply_to_status_id. Simple workaround: scrape by handle and find our reply.
const handleGroups = {};
for (const e of pending) {
  if (!handleGroups[e.target_handle]) handleGroups[e.target_handle] = [];
  handleGroups[e.target_handle].push(e);
}

for (const [handle, entries] of Object.entries(handleGroups)) {
  // Scrape the Sasha account's recent tweets and filter for replies to this handle
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      twitterHandles: ['SashaCoin95'],
      maxTweets: 20,
    }),
  });
  if (!resp.ok) {
    console.error(`Apify error ${resp.status}`);
    continue;
  }
  const tweets = await resp.json();

  for (const e of entries) {
    const match = tweets.find(tw => {
      const replyTo = tw.in_reply_to_status_id_str || tw.inReplyToStatusId;
      return replyTo === e.in_reply_to;
    });
    if (match) {
      e.likes_24h = match.favorite_count ?? match.likeCount ?? 0;
      e.replies_24h = match.reply_count ?? match.replyCount ?? 0;
      e.engagement_checked = true;
      console.log(`  ✅ @${e.target_handle}: ${e.likes_24h} ❤️  ${e.replies_24h} 💬`);
    } else {
      console.log(`  ⚠️  @${e.target_handle}: reply not found in recent tweets (may need manual check)`);
      e.engagement_checked = true; // mark as checked to avoid repeated attempts
    }
  }
}

// Update log
writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
console.log('\nposted-log.json updated.');
