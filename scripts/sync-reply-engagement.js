#!/usr/bin/env node
/**
 * sync-reply-engagement.js
 *
 * Scrapes Sasha's recent tweets via Apify (from:SashaCoin95),
 * matches them to posted-log entries by inReplyToId → in_reply_to,
 * and updates engagement fields + backfills topics.
 *
 * Also backfills topics/sasha_angle for entries that have none,
 * using reply-targets.json as the source.
 *
 * Usage:
 *   node scripts/sync-reply-engagement.js
 *   node scripts/sync-reply-engagement.js --dry-run
 *   node scripts/sync-reply-engagement.js --skip-apify   (topics-only backfill)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apifyFetch } from './lib/apify-rotate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const LOG_PATH   = join(ROOT, 'state/posted-log.json');
const TARGETS_PATH = join(ROOT, 'content/reply-targets.json');
const DRY_RUN    = process.argv.includes('--dry-run');
const SKIP_APIFY = process.argv.includes('--skip-apify');
const ACTOR      = 'CJdippxWmn9uRfooo';

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

const log = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
const replies = log.filter(e => e.source === 'reply');

// ── Step 1: Backfill topics from reply-targets.json ──────────────────────────
const { targets = [] } = JSON.parse(readFileSync(TARGETS_PATH, 'utf8'));
const targetMap = Object.fromEntries(targets.map(t => [t.handle.toLowerCase(), t]));

let topicsPatched = 0;
for (const entry of replies) {
  const needsTopics = !entry.topics || entry.topics.length === 0;
  const needsAngle  = !entry.sasha_angle;
  if (!needsTopics && !needsAngle) continue;

  const kol = targetMap[(entry.target_handle || '').toLowerCase()];
  if (!kol) continue;

  if (needsTopics)  { entry.topics      = kol.topics_of_interest || []; topicsPatched++; }
  if (needsAngle)   { entry.sasha_angle = kol.sasha_angle        || null; }
}
console.log(`Topics backfilled: ${topicsPatched} entries`);

// ── Step 2: Sync engagement via Apify ────────────────────────────────────────
if (!SKIP_APIFY) {
  console.log('Fetching from:SashaCoin95 via Apify…');

  let sashaItems = [];
  try {
    const url  = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=120`;
    const resp = await apifyFetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerms: ['from:SashaCoin95'], maxItems: 50 }),
    });
    if (!resp.ok) throw new Error(`Apify ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const all = await resp.json();
    sashaItems = all.filter(t => t.id && t.id !== -1 && t.isReply);
    console.log(`Got ${sashaItems.length} Sasha reply tweets`);
  } catch (e) {
    console.error('Apify fetch failed:', e.message);
    console.log('Skipping engagement sync — topics still saved.');
  }

  // Build lookup: inReplyToId → sasha tweet (take highest-engagement if duplicates)
  const byReplyTo = {};
  for (const tw of sashaItems) {
    const key = String(tw.inReplyToId || '');
    if (!key) continue;
    const existing = byReplyTo[key];
    const score = (tw.likeCount || 0) + (tw.replyCount || 0) + (tw.viewCount || 0);
    const existScore = existing ? (existing.likeCount || 0) + (existing.replyCount || 0) + (existing.viewCount || 0) : -1;
    if (!existing || score > existScore) byReplyTo[key] = tw;
  }

  let engPatched = 0;
  for (const entry of replies) {
    const tw = byReplyTo[String(entry.in_reply_to || '')];
    if (!tw) continue;

    entry.sasha_tweet_id  = String(tw.id);
    entry.sasha_tweet_url = tw.url || tw.twitterUrl || `https://x.com/SashaCoin95/status/${tw.id}`;
    entry.likes_latest    = tw.likeCount   ?? 0;
    entry.replies_latest  = tw.replyCount  ?? 0;
    entry.views_latest    = tw.viewCount   ?? 0;
    entry.engagement_synced_at = new Date().toISOString();

    // Mirror into the canonical schema fields the dashboard/reports read.
    // Without this, likes_24h/replies_24h/engagement_checked stay null/false
    // forever and every reply looks dead even though it is live and synced.
    entry.likes_24h    = entry.likes_latest;
    entry.replies_24h  = entry.replies_latest;
    entry.views_24h    = entry.views_latest;
    // Mark the 24h check done once we are past the scheduled due time.
    if (entry.engagement_check_due && new Date(entry.engagement_check_due).getTime() <= Date.now()) {
      entry.engagement_checked = true;
    }
    engPatched++;

    console.log(`  ✅ @${entry.target_handle} → ♥${entry.likes_latest} 💬${entry.replies_latest} 👁${entry.views_latest}`);
  }
  console.log(`Engagement updated: ${engPatched} entries`);
}

// ── Save ──────────────────────────────────────────────────────────────────────
if (!DRY_RUN) {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  console.log('Saved to state/posted-log.json');
} else {
  console.log('DRY RUN — nothing written');
}
