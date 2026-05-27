#!/usr/bin/env node
/**
 * kol-scraper.js — Scrape recent tweets from KOL shortlist + keyword search via Apify
 *
 * Reads: content/reply-targets.json
 * Reads: state/posted-log.json        (daily reply cap check)
 * Writes: content/kol-feed.json       (today's tweet candidates)
 *
 * Usage:
 *   node scripts/kol-scraper.js
 *   node scripts/kol-scraper.js --dry-run       (show targets, skip Apify)
 *   node scripts/kol-scraper.js --skip-handles  (only run search_terms pass)
 *   node scripts/kol-scraper.js --skip-search   (only run handles pass)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apifyFetch } from './lib/apify-rotate.js';

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

const APIFY_TOKEN = process.env.APIFY_API_KEY || process.env.APIFY_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_HANDLES = process.argv.includes('--skip-handles');
const SKIP_SEARCH = process.argv.includes('--skip-search');
const MAX_AGE_HOURS = parseInt(process.env.KOL_MAX_AGE_HOURS || '24');
// Cost: actor charges $0.00025/tweet. Total run cost = sum(per-handle × MAX_TWEETS_PER_HANDLE)
// + sum(per-search × MAX_TWEETS_PER_SEARCH) × $0.00025.
// IMPORTANT: the actor's input field is `maxItems`, NOT `maxTweets`. The actor
// silently ignores unknown fields and defaults to 200 — costing ~$0.95/run
// instead of ~$0.05. Always send `maxItems` in apifyRun().
const MAX_TWEETS_PER_HANDLE = 10;
const MAX_TWEETS_PER_SEARCH = 20;

// kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest
// $0.25/1K tweets. Switched from xquik (wAusCMrm284Voaw86) 2026-05-19 — xquik
// fails with "max-items-must-be-greater-than-zero" on FREE accounts.
// BLOCKLISTED: apidojo/tweet-scraper (61RPP7dywgiy0JPD0) — same failure mode.
const ACTOR = 'CJdippxWmn9uRfooo';

// ── Load targets ─────────────────────────────────────────────────────────────
const targetsPath = join(ROOT, 'content/reply-targets.json');
const { targets, search_terms = [], selection_rules } = JSON.parse(readFileSync(targetsPath, 'utf8'));
const handles = targets.map(t => t.handle);
const targetMap = Object.fromEntries(targets.map(t => [t.handle.toLowerCase(), t]));

// ── Daily reply cap check ────────────────────────────────────────────────────
const logPath = join(ROOT, 'state/posted-log.json');
const dailyCap = selection_rules.daily_reply_cap ?? 6;
const todayStr = new Date().toISOString().slice(0, 10);

function getDailyReplyCount() {
  if (!existsSync(logPath)) return 0;
  try {
    const log = JSON.parse(readFileSync(logPath, 'utf8'));
    // BUG FIX: `log.entries ?? log` on a flat array returns Array.prototype.entries
    // (a built-in method, truthy) instead of falling through to the array itself.
    // The ?? operator never sees undefined, so entries becomes the method function,
    // .filter() throws, catch silently returns 0, and the daily cap is never enforced.
    const entries = Array.isArray(log) ? log : (Array.isArray(log.entries) ? log.entries : []);
    return entries.filter(e => (e.posted_at || e.postedAt || e.timestamp || '').startsWith(todayStr)).length;
  } catch { return 0; }
}

const repliedToday = getDailyReplyCount();
if (repliedToday >= dailyCap) {
  console.log(`Daily reply cap reached (${repliedToday}/${dailyCap}). Exiting.`);
  writeFileSync(join(ROOT, 'content/kol-feed.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    dailyCapReached: true,
    repliedToday,
    dailyCap,
    candidates: [],
  }, null, 2));
  process.exit(0);
}
console.log(`Daily replies so far: ${repliedToday}/${dailyCap}`);

// ── Load already-replied log ─────────────────────────────────────────────────
const repliedPath = join(ROOT, 'state/replied-tweets.json');
const replied = existsSync(repliedPath)
  ? new Set(JSON.parse(readFileSync(repliedPath, 'utf8')))
  : new Set();

if (DRY_RUN) {
  console.log('DRY RUN — skipping Apify calls');
  console.log('Handles:', handles);
  console.log('Search terms:', search_terms.map(s => s.term));
  process.exit(0);
}

// ── Apify helper (auto-rotates keys via lib/apify-rotate.js) ────────────────
// apifyFetch reads keys from ~/.config/apify/keys (or /data/.openclaw/credentials/apify/keys
// on the VPS, or $APIFY_KEYS_FILE if set), tries each in order, and rotates on
// 403 platform-feature-disabled. Working key gets moved to top of file for
// future runs.
async function apifyRun(body) {
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=120`;
  const resp = await apifyFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Apify ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// ── Filter helper ────────────────────────────────────────────────────────────
const now = Date.now();
const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;
const topicBlocklist = selection_rules.topic_blocklist.map(t => t.toLowerCase());

function filterTweet(tw, targetMeta, minLikes = 3, minReplies = 1) {
  if (tw.status === 'zero-output') return null;

  // xquik/x-tweet-scraper field names
  const tweetId = tw.id || tw.id_str || tw.tweetId || tw.tweet_id;
  if (!tweetId || String(tweetId) === '-1' || replied.has(String(tweetId))) return null;

  const createdAt = new Date(tw.createdAt || tw.created_at || tw.date).getTime();
  if (isNaN(createdAt) || now - createdAt > maxAgeMs) return null;

  const likes = tw.likeCount ?? tw.favorite_count ?? tw.likes ?? 0;
  const replies = tw.replyCount ?? tw.reply_count ?? tw.replies ?? 0;
  if (likes < minLikes && replies < minReplies) return null;

  const text = (tw.text || tw.full_text || '').toLowerCase();
  if (topicBlocklist.some(t => text.includes(t))) return null;
  if (!text.trim()) return null;

  // Skip subscribers-only tweets — reply compose field won't exist
  const replySettings = tw.replySettings || tw.reply_settings;
  if (replySettings && replySettings.toLowerCase() !== 'everyone') return null;

  const handle = tw.author?.userName || tw.author?.username || tw.user?.screen_name || '';
  const tweetUrl = `https://x.com/${handle}/status/${tweetId}`;

  return {
    tweetId: String(tweetId),
    tweetUrl,
    handle,
    text: tw.text || tw.full_text || '',
    lang: tw.lang || tw.language || null,   // ISO 639-1 code from Apify ('en', 'pt', 'fr', …)
    likes,
    replies,
    createdAt: new Date(createdAt).toISOString(),
    topicsOfInterest: targetMeta.topics_of_interest,
    sashaAngle: targetMeta.sasha_angle,
    source: targetMeta.source || 'handle',
    replied: false,
    replyText: null,
    replyPostedAt: null,
  };
}

const allCandidates = [];

// ── Pass 1: handles — use searchTerms "from:handle" ──────────────────────────
if (!SKIP_HANDLES) {
  console.log(`\n─── Pass 1: scraping ${handles.length} handles ───`);
  for (const handle of handles) {
    const target = targetMap[handle.toLowerCase()];
    if (!target) continue;
    try {
      const tweets = await apifyRun({
        searchTerms: [`from:${handle}`],
        maxItems: MAX_TWEETS_PER_HANDLE,
      });
      const valid = Array.isArray(tweets) ? tweets : [];
      console.log(`  @${handle}: ${valid.length} raw`);
      for (const tw of valid) {
        const c = filterTweet(tw, { ...target, source: 'handle' });
        if (c) allCandidates.push(c);
      }
    } catch (e) {
      console.error(`  @${handle} scrape failed:`, e.message);
    }
  }
}

// ── Pass 2: search terms ─────────────────────────────────────────────────────
if (!SKIP_SEARCH && search_terms.length > 0) {
  console.log(`\n─── Pass 2: scraping ${search_terms.length} search terms ───`);
  for (const st of search_terms) {
    const [stMinLikes, stMinReplies] = parseMinSignals(st.min_signals);
    console.log(`  Searching: "${st.term}"`);
    try {
      const tweets = await apifyRun({
        searchTerms: [st.term],
        maxItems: MAX_TWEETS_PER_SEARCH,
      });
      const valid = Array.isArray(tweets) ? tweets : [];
      console.log(`  → ${valid.length} raw tweets`);

      for (const tw of valid) {
        const handle = (tw.author?.userName || tw.author?.username || tw.user?.screen_name || '').toLowerCase();
        if (targetMap[handle]) continue;
        const c = filterTweet(tw, {
          topics_of_interest: [st.term],
          sasha_angle: st.sasha_angle,
          source: `search:${st.term}`,
        }, stMinLikes, stMinReplies);
        if (c) allCandidates.push({ ...c, source: `search:${st.term}` });
      }
    } catch (e) {
      console.error(`  Search failed for "${st.term}":`, e.message);
    }
  }
}

function parseMinSignals(sig = '5+ likes OR 2+ replies') {
  const likeMatch = sig.match(/(\d+)\+\s*likes/);
  const replyMatch = sig.match(/(\d+)\+\s*replies/);
  return [likeMatch ? parseInt(likeMatch[1]) : 5, replyMatch ? parseInt(replyMatch[1]) : 2];
}

// ── Deduplicate + rank ────────────────────────────────────────────────────────
const seen = new Set();
const dedupedCandidates = allCandidates.filter(c => {
  if (seen.has(c.tweetId)) return false;
  seen.add(c.tweetId);
  return true;
});

// One candidate per handle. Once Sasha replies to a handle it goes on a 12h
// cooldown, so a second tweet from the same handle can never be used the same
// day — keeping duplicates just wastes feed slots and starves the afternoon.
// Keep the highest-engagement tweet per handle.
const bestByHandle = new Map();
for (const c of dedupedCandidates) {
  const key = c.handle.toLowerCase();
  const score = c.likes + c.replies * 3;
  const cur = bestByHandle.get(key);
  if (!cur || score > (cur.likes + cur.replies * 3)) bestByHandle.set(key, c);
}
const uniqueHandleCands = [...bestByHandle.values()];

// KOL-first, search fills gaps (Gabriel, 2026-05-26). Rank handle-sourced KOL
// tweets first (1.5x tier-1 engagement bonus), then append search-sourced tweets.
// Search tweets come from diverse authors, so they supply the distinct fresh
// handles the afternoon slots need once the KOL handles are on 12h cooldown.
const tier1handles = new Set(targets.filter(t => t.tier === 1).map(t => t.handle.toLowerCase()));
const engScore = c => (c.likes + c.replies * 3) * (tier1handles.has(c.handle.toLowerCase()) ? 1.5 : 1);
const isSearch = c => String(c.source || '').startsWith('search');
const handleTier = uniqueHandleCands.filter(c => !isSearch(c)).sort((a, b) => engScore(b) - engScore(a));
const searchTier = uniqueHandleCands.filter(isSearch).sort((a, b) => engScore(b) - engScore(a));
const ranked = [...handleTier, ...searchTier];

// Feed depth is decoupled from the daily reply cap: the pool holds many more
// distinct handles than we post, so every one of the 7 launchd slots finds a
// fresh target. Actual posting is capped by the slots (1 reply each, MAX_POSTS_PER_RUN=1)
// and the daily_reply_cap guard above — not by feed size.
const feedSize = selection_rules.feed_size ?? 15;
const remainingCap = dailyCap - repliedToday;
const feed = ranked.slice(0, feedSize);

// ── Write feed ───────────────────────────────────────────────────────────────
const feedPath = join(ROOT, 'content/kol-feed.json');
writeFileSync(feedPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dailyCap,
  repliedToday,
  remainingCap,
  scrapedHandles: handles,
  scrapedTerms: search_terms.map(s => s.term),
  totalCandidates: dedupedCandidates.length,
  candidates: feed,
}, null, 2));

console.log(`\n✅ Feed written — ${feed.length} candidates selected (${repliedToday}/${dailyCap} daily cap used):`);
for (const c of feed) {
  console.log(`   • @${c.handle} [${c.source}] (${c.likes}❤️ ${c.replies}💬): ${c.text.slice(0, 80)}...`);
  console.log(`     ${c.tweetUrl}`);
}
if (feed.length === 0) {
  console.log('   (no qualifying candidates this run)');
}
