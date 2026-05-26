#!/usr/bin/env node
/**
 * backfill-original-tweets.js
 *
 * One-time script: fetches original tweet text for all reply log entries
 * missing `original_text` using Twitter's public oEmbed API (no auth, no cost).
 *
 * Usage:
 *   node scripts/backfill-original-tweets.js
 *   node scripts/backfill-original-tweets.js --dry-run
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG_PATH = join(ROOT, 'state/posted-log.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Extract plain text from oEmbed HTML.
// oEmbed wraps in <blockquote> with nested <p> then attribution <a> tags.
// Result looks like: "tweet text\n— @handle (date)"  — we want just the tweet text.
function extractText(html) {
  // Strip all HTML tags
  let text = html.replace(/<[^>]+>/g, ' ').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Remove trailing attribution "— @handle (date)"
  text = text.replace(/\s*—\s*@?\S+\s*\([^)]+\)\s*$/, '').trim();
  // Remove trailing URLs (t.co links embedded in oEmbed text)
  text = text.replace(/https?:\/\/t\.co\/\S+/g, '').trim();
  return text;
}

async function fetchTweetText(tweetUrl) {
  const oembed = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
  const resp = await fetch(oembed, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.html ? extractText(data.html) : null;
}

const log = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
const missing = log.filter(e => e.source === 'reply' && !e.original_text);
console.log(`Entries needing backfill: ${missing.length}`);

if (!missing.length) { console.log('Nothing to do.'); process.exit(0); }
if (DRY_RUN) { missing.forEach(e => console.log(' ', e.tweet_url)); process.exit(0); }

let patched = 0;
let failed  = 0;

for (const entry of missing) {
  process.stdout.write(`  @${entry.target_handle} … `);
  try {
    const text = await fetchTweetText(entry.tweet_url);
    if (text) {
      entry.original_text = text;
      if (!entry.topics) entry.topics = [];
      patched++;
      console.log(`✅ "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    } else {
      failed++;
      console.log('⚠️  empty response');
    }
  } catch (e) {
    failed++;
    console.log(`❌ ${e.message}`);
  }
  // Small delay — be polite to Twitter's public API
  await new Promise(r => setTimeout(r, 300));
}

writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
console.log(`\nDone. Patched ${patched} · Failed ${failed} · Saved to state/posted-log.json`);
