#!/usr/bin/env node
/**
 * morning-reply-run.js — Daily X reply pipeline
 *
 * Full flow:
 *   1. Scrape KOL tweets (kol-scraper.js)
 *   2. Generate Sasha replies via Gemini Flash
 *   3. Post each reply via ADB (adb-reply.js) — real device, no API cost
 *   4. Log to state/replied-tweets.json + state/posted-log.json
 *   5. Print summary
 *
 * Usage:
 *   node scripts/morning-reply-run.js
 *   node scripts/morning-reply-run.js --dry-run        (generate replies, don't post)
 *   node scripts/morning-reply-run.js --skip-scrape    (use existing kol-feed.json)
 *   node scripts/morning-reply-run.js --device 192.168.0.6:46185
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

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

// ── Telegram notifications ────────────────────────────────────────────────────
// Re-uses the TERMUX_BRIDGE_TOKEN + COMMANDER_CHAT_ID already in .env (same bot
// the phone bridge uses). Falls back to dedicated TELEGRAM_BOT_TOKEN /
// TELEGRAM_CHAT_ID if those are ever separated.
// Fire-and-forget: errors are silently swallowed so a Telegram outage never
// blocks or kills a run.
function notify(msg) {
  const token  = process.env.TERMUX_BRIDGE_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.COMMANDER_CHAT_ID   || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' });
  const opts = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  try {
    const req = https.request(opts, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch { /* never throw */ }
}

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_SCRAPE = process.argv.includes('--skip-scrape');
const args = process.argv.slice(2);
function getArg(f) { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; }
const DEVICE = getArg('--device') || process.env.SASHA_PHONE_ADB || '192.168.0.6:5555';

const ADB_PATH = process.env.ADB_PATH || `${process.env.HOME}/bin/adb`;

// ── ADB reconnect (3× retry, 5s apart) ────────────────────────────────────────
// ADB wireless connections drop on network changes, phone reboots, and ~24h idle.
// One connect attempt was enough 90% of the time, but a single dropped packet
// on a fresh Mac wake would abort the slot immediately. Three retries adds <10s
// to a worst-case run and eliminates almost all transient drop scenarios.
if (!DRY_RUN) {
  console.log(`─── ADB: connecting to ${DEVICE} ───`);
  const ADB_RETRIES = 3;
  let connected = false;
  for (let attempt = 1; attempt <= ADB_RETRIES; attempt++) {
    const conn = spawnSync(ADB_PATH, ['connect', DEVICE], { encoding: 'utf8' });
    const out = (conn.stdout || '').trim();
    console.log(`  [${attempt}/${ADB_RETRIES}] ${out}`);
    if (out.includes('connected') || out.includes('already connected')) {
      connected = true;
      break;
    }
    if (attempt < ADB_RETRIES) {
      console.log(`  Waiting 5s before retry...`);
      spawnSync('sleep', ['5']);
    }
  }
  if (!connected) {
    console.error(`  ADB reconnect failed after ${ADB_RETRIES} attempts — aborting.`);
    notify(`❌ <b>Sasha reply — ADB offline</b>\nFailed to connect to ${DEVICE} after ${ADB_RETRIES} attempts. No reply posted this slot.\nCheck phone WiFi + wireless debugging.`);
    process.exit(1);
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Hard cap at 1 — in-memory repliedIds is rebuilt each run, so multi-post
// would require each post to re-read disk. Until that is wired, cap=1 is safe.
const MAX_POSTS_PER_RUN = Math.min(parseInt(getArg('--max-posts') || '1'), 1);
const FEED_PATH = join(ROOT, 'content/kol-feed.json');
const REPLIED_PATH = join(ROOT, 'state/replied-tweets.json');
const LOG_PATH = join(ROOT, 'state/posted-log.json');

// ── Atomic write helper ───────────────────────────────────────────────────────
// writeFileSync is NOT atomic on macOS — two concurrent processes writing the
// same file produce last-writer-wins (one process's data silently lost).
// rename(2) IS atomic on the same filesystem. Write to a temp file, then rename.
// This makes every state write crash-safe and concurrent-safe.
function atomicWrite(filePath, content) {
  const tmp = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, filePath);
}

// Persist a confirmed reply to dedup state IMMEDIATELY (per-post), not at end of run.
// Why: a reply lands on X inside the loop, but if the process is killed before the
// end-of-run write (Mac sleep, caffeinate timeout, next-slot lock), the reply is
// orphaned — absent from replied-tweets.json — so the next fresh scrape re-picks the
// same tweet and Sasha double-replies. Writing here makes that window zero.
// Idempotent: replied-tweets is a Set; posted-log dedups on entry id.
function persistReply(tweet) {
  const replied = existsSync(REPLIED_PATH)
    ? new Set(JSON.parse(readFileSync(REPLIED_PATH, 'utf8')))
    : new Set();
  replied.add(tweet.tweetId);
  atomicWrite(REPLIED_PATH, JSON.stringify([...replied], null, 2));

  const log = existsSync(LOG_PATH) ? JSON.parse(readFileSync(LOG_PATH, 'utf8')) : [];
  const id = `reply-${tweet.tweetId}`;
  if (!log.some(e => e.id === id)) {
    log.push({
      id,
      source: 'reply',
      method: 'adb',
      target_handle: tweet.handle,
      in_reply_to: tweet.tweetId,
      tweet_url: tweet.tweetUrl,
      original_text: tweet.text || null,
      topics: tweet.topicsOfInterest || [],
      sasha_angle: tweet.sashaAngle || null,
      tweet_text: tweet.replyText,
      posted_at: tweet.replyPostedAt,
      status: tweet.status,
      engagement_check_due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      engagement_checked: false,
      likes_24h: null,
      replies_24h: null,
    });
    atomicWrite(LOG_PATH, JSON.stringify(log, null, 2));
  }
}

// ── Step 1: Scrape ────────────────────────────────────────────────────────────
if (!SKIP_SCRAPE) {
  console.log('─── Step 1: Scraping KOL tweets (fresh) ───');
  const scrape = spawnSync(process.execPath, [join(__dirname, 'kol-scraper.js')], {
    encoding: 'utf8', env: { ...process.env }, stdio: 'inherit',
  });
  if (scrape.status !== 0) {
    console.error('Scraper failed.');
    process.exit(1);
  }
} else {
  console.log('─── Step 1: Using cached kol-feed.json (--skip-scrape) ───');
}

// ── Step 2: Load feed ────────────────────────────────────────────────────────
if (!existsSync(FEED_PATH)) {
  console.error('No kol-feed.json found. Run without --skip-scrape first.');
  process.exit(1);
}
const feed = JSON.parse(readFileSync(FEED_PATH, 'utf8'));
// RULE: Never reply to the same X post twice (Gabriel, 2026-05-22)
// Tweet IDs in replied-tweets.json are permanently excluded — do not remove this guard.
const repliedIds = existsSync(REPLIED_PATH)
  ? new Set(JSON.parse(readFileSync(REPLIED_PATH, 'utf8')))
  : new Set();
const unreplied = feed.candidates.filter(c => !c.replied && !repliedIds.has(c.tweetId));

// ── Phase 4: English-only filter ─────────────────────────────────────────────
// Skip any tweet where lang is explicitly non-English.
// Tweets with lang=null/undefined are treated as English (unknown = keep).
// Rationale: political/brand-safety blocklist is English-only; non-English tweets
// bypass it silently. A French tweet about immigration or a Portuguese political
// thread would pass all filters and generate a reply — filter at source instead.
const engOnlyPool = unreplied.filter(c => {
  if (!c.lang || c.lang === 'en') return true;
  console.log(`  Skipping @${c.handle} — non-English tweet (lang: ${c.lang})`);
  return false;
});

if (!engOnlyPool.length) {
  const reason = unreplied.length > 0
    ? `All ${unreplied.length} candidate(s) filtered out (non-English).`
    : 'No unread candidates in feed.';
  console.log(`${reason} Done.`);
  if (!DRY_RUN) notify(`⚠️ <b>Sasha reply — 0 candidates</b>\n${reason}\nFeed generated: ${feed.generatedAt || 'unknown'}`);
  process.exit(0);
}

// Skip handles replied in the last 12 hours — prevents double-replying same KOL
const recentHandles = new Set();
if (existsSync(LOG_PATH)) {
  const posted = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  posted.filter(e => e.posted_at && new Date(e.posted_at).getTime() > cutoff)
        .forEach(e => recentHandles.add(e.target_handle));
}
const filtered = engOnlyPool.filter(c => {
  if (recentHandles.has(c.handle)) {
    console.log(`  Skipping @${c.handle} — replied in last 12h`);
    return false;
  }
  return true;
});
if (!filtered.length) {
  console.log('All candidates on cooldown (12h handle limit). Done.');
  if (!DRY_RUN) notify(`⚠️ <b>Sasha reply — all on cooldown</b>\n${engOnlyPool.length} English candidate(s) available but all handles replied in last 12h. No post this slot.`);
  process.exit(0);
}

// ── Step 2b: Sasha picks her tweet ───────────────────────────────────────────
// When multiple candidates exist, let Gemini (as Sasha) choose the best fit.
async function sashaPicksTweet(pool) {
  if (pool.length === 1) return pool; // nothing to choose from
  if (!GEMINI_API_KEY) return pool;   // no key — take first

  const list = pool.map((c, i) =>
    `[${i}] @${c.handle} (${c.likeCount} likes, ${c.replyCount} replies)\nTweet: "${c.text.slice(0, 300)}"\nSasha's angle: ${c.sashaAngle}`
  ).join('\n\n');

  const prompt = `You are Sasha Coin — a crypto educator on X. Sharp, grounded, data-forward.

Pick ONE tweet from this list where you have the most non-obvious, logically grounded thing to say. Not the most viral — the one where Sasha can add something real from her on-chain perspective.

${list}

Think: which tweet demands a specific take (not a generic one)? Which is in Sasha's core lane (DeFAI, AI agents, DeFi UX, onchain activity)?

Reply ONLY with JSON: {"index": N, "reason": "one sentence"}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 512 } },
        }),
      }
    );
    const data = await resp.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const raw = parts.filter(p => !p.thought).map(p => p.text).join('').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return pool;
    const pick = JSON.parse(jsonMatch[0]);
    const chosen = pool[pick.index];
    if (!chosen) return pool;
    console.log(`  Sasha chose @${chosen.handle}: ${pick.reason}`);
    return [chosen, ...pool.filter((_, i) => i !== pick.index)];
  } catch {
    return pool; // fallback: original order
  }
}

console.log(`\n─── Step 2b: Sasha picks from ${filtered.length} candidates ───`);
const orderedPool = await sashaPicksTweet(filtered);

// Write reordered feed so choice persists if run is interrupted
writeFileSync(FEED_PATH, JSON.stringify({
  ...feed,
  candidates: [...feed.candidates.filter(c => c.replied), ...orderedPool],
}, null, 2));

const candidates = orderedPool.slice(0, MAX_POSTS_PER_RUN);

console.log(`\n─── Step 3: Generating ${candidates.length} replies ───`);

// ── Step 3: Generate replies via Gemini Flash ────────────────────────────────
async function generateReply(tweet) {
  if (!GEMINI_API_KEY) {
    // Fallback: return a placeholder for dry runs without API key
    return `I keep tabs on ${tweet.topicsOfInterest[0]}. From what I track, this changes the deployment calculus more than most people realize.`;
  }

  const prompt = `You are Sasha Coin — a crypto educator on X who sounds like a real person, not a character. Sharp, grounded, direct. Not a cheerleader. Not a degen. Think: someone who has been in DeFi for years and has seen what actually works.

Tweet by @${tweet.handle}:
"${tweet.text}"

Before writing, think through:
1. What is this tweet ACTUALLY about? Name the specific topic precisely (e.g. "institutional RWA tokenization", "retail UX friction", "protocol hack recovery"). Be literal — don't infer the author's general interests.
2. Is my reply logically consistent with THAT specific topic? If the tweet is about institutional infrastructure, don't pivot to retail onboarding. If it's about a protocol hack, don't pivot to adoption metrics.
3. What's the one non-obvious observation or question that adds something the tweet didn't say?

Background context (use only if directly relevant to this tweet's specific topic):
- Sasha's angle for this person: ${tweet.sashaAngle}
- Topics of interest: ${tweet.topicsOfInterest.join(', ')}
⚠️ These are this person's general interests — NOT instructions to force your reply into those topics. If this tweet is about something else, engage with the tweet's actual topic instead.

Write a reply. Hard rules:
- Max 240 characters
- Sound like a person, not a crypto account
- Start with the substance — never open with "Great point", "This is so true", "Exactly", "I hear you", "Fair point", "Totally", "Same here", "Valid", or any form of agreement or validation opener
- One concrete observation, question, or data point — nothing generic
- 1-2 sentences max
- First person singular (I / my / I've seen)
- Plain English — no jargon the average Twitter user wouldn't understand
- No hashtags, no links, no @mentions
- No emojis unless the original tweet uses them
- Banned words: revolutionary, to the moon, wen, fren, gm, gn, alpha, bullish, bearish, WAGMI, LFG, based, ser, anon, ngmi, degen (unless quoting someone), ecosystem, paradigm shift, space (as in "the crypto space")

Good reply (tweet about regulatory clarity): "The regulatory clarity is real. What's interesting is most protocols I've tracked were already building for this — the bill accelerates timelines, it doesn't change direction."
Bad reply (topic drift): Tweet is about DTCC connecting to Stellar for institutional tokenization → reply pivots to retail wallet onboarding because that's the author's usual topic. Wrong. Engage with what the tweet says, not who wrote it.
Bad reply (logic error): Tweet is about people who CAN'T access a private beta → reply talks about engagement dropping for people who CAN access it. Different population, different problem.
Bad reply (generic): "This is huge! Crypto is finally getting the recognition it deserves. Bullish on what's next for the ecosystem!"

Reply only with the tweet text, nothing else.`;

  const model = process.env.GEMINI_REPLY_MODEL || 'gemini-2.5-flash';
  let resp, data;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // thinkingBudget tokens count toward maxOutputTokens in Gemini 2.5
          // 1024 for thinking + ~100 for visible reply = 1500 safe margin
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 1024 } },
        }),
      }
    );
    data = await resp.json();
  } catch (e) {
    notify(`❌ <b>Sasha reply — Gemini API error</b>\nModel: ${model}\nError: ${e.message}\nReply for @${tweet.handle} skipped.`);
    return null;
  }
  if (!resp.ok || data.error) {
    const errMsg = data.error?.message || `HTTP ${resp.status}`;
    notify(`❌ <b>Sasha reply — Gemini API error</b>\nModel: ${model}\n${errMsg}\nReply for @${tweet.handle} skipped.`);
    return null;
  }
  // Filter out thinking parts (thought: true) — only return visible output
  const parts = data.candidates?.[0]?.content?.parts || [];
  // Gemini sometimes wraps its output in quotes despite "reply only with the tweet text" instruction.
  // Strip any surrounding single or double quotes before returning.
  const raw = parts.filter(p => !p.thought).map(p => p.text).join('').trim().replace(/^["']|["']$/g, '').trim();
  return raw || null;
}

const results = [];

for (const tweet of candidates) {
  console.log(`\n• @${tweet.handle}: "${tweet.text.slice(0, 80)}..."`);

  let reply = await generateReply(tweet);
  if (!reply) {
    console.log('  ⚠️  Failed to generate reply — skipping');
    continue;
  }
  // Hard enforce 238 chars — prompt instruction alone is not reliable
  // Word-boundary truncation: don't cut mid-word (slice then strip trailing partial word)
  if (reply.length > 238) {
    reply = reply.slice(0, 238).trimEnd().replace(/\s\S*$/, '').trimEnd();
    console.log(`  Truncated to ${reply.length} chars`);
  }
  console.log(`  Reply (${reply.length} chars): "${reply}"`);
  tweet.replyText = reply;

  if (DRY_RUN) {
    console.log('  DRY RUN — not posting');
    results.push({ ...tweet, status: 'dry_run' });
    continue;
  }

  // ── Step 4: Post via ADB ───────────────────────────────────────────────────
  // Optimistic pre-write: add tweet ID to replied-tweets BEFORE calling ADB.
  // Why: if ADB posts the reply but the process is killed before persistReply runs
  // (Mac sleep, caffeinate timeout, or exit-code ambiguity on 'unconfirmed'),
  // the tweet ID is already deduped. Without this, the next slot finds the tweet
  // still unreplied and posts again → double reply.
  // Risk: if ADB truly fails (network down, device offline), we waste a feed slot.
  // That is vastly preferable to double-replying.
  // Pre-write: atomically add tweet ID to replied-tweets BEFORE ADB fires.
  // Also update the in-memory repliedIds Set so any future loop iteration
  // (at MAX_POSTS_PER_RUN > 1) immediately sees this tweet as done.
  {
    const preReplied = existsSync(REPLIED_PATH)
      ? new Set(JSON.parse(readFileSync(REPLIED_PATH, 'utf8')))
      : new Set();
    preReplied.add(tweet.tweetId);
    atomicWrite(REPLIED_PATH, JSON.stringify([...preReplied], null, 2));
    repliedIds.add(tweet.tweetId); // keep in-memory Set in sync (P5)
  }

  console.log('  Posting via ADB...');
  // Timeout 180s: step 5 (find Reply button, 3 retries × screenshot + uiDump)
  // can take up to 126s on a slow phone. 60s killed the subprocess mid-attempt,
  // the reply may have already posted, but we got exit-null → ok=false → no log entry.
  const post = spawnSync(
    process.execPath,
    [join(__dirname, 'adb-reply.js'), '--url', tweet.tweetUrl, '--text', reply, '--device', DEVICE],
    { encoding: 'utf8', env: { ...process.env }, timeout: 180000 }
  );

  let postResult = {};
  try { postResult = JSON.parse(post.stdout?.trim().split('\n').pop() || '{}'); } catch {}

  if (postResult.status === 'subscribers_only') {
    console.log('  Subscribers-only tweet — adding to skip list, not counting as post');
    // Pre-write already added tweetId to replied-tweets. Just update the feed.
    results.push({ ...tweet, status: 'subscribers_only', replied: false });
    continue;
  }

  const ok = post.status === 0 || postResult.status === 'ok' || postResult.status === 'unconfirmed';
  console.log(`  ${ok ? '✅' : '❌'} Status: ${postResult.status || 'unknown'}`);
  if (post.stderr) console.log(`  stderr: ${post.stderr.slice(0, 200)}`);

  tweet.replied = ok;
  tweet.replyPostedAt = ok ? new Date().toISOString() : null;
  tweet.status = postResult.status || (ok ? 'ok' : 'error');
  results.push({ ...tweet, status: tweet.status });

  // Persist the instant the reply confirms — before engagement sync or anything
  // else that could be interrupted. This is the atomic guard against double-replies.
  if (!DRY_RUN && ok) {
    persistReply(tweet);
    // Count today's posts (from the freshly-written log) for the summary line
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = (() => {
      try {
        const entries = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
        return entries.filter(e => e.source === 'reply' && (e.posted_at || '').startsWith(todayStr)).length;
      } catch { return '?'; }
    })();
    const previewReply = reply.length > 80 ? reply.slice(0, 80) + '…' : reply;
    notify(`✅ <b>Sasha replied</b>\n@${tweet.handle} · ${todayCount}/8 today\n"${previewReply}"`);
  }
  if (!DRY_RUN && !ok) {
    notify(`❌ <b>Sasha reply — ADB post failed</b>\n@${tweet.handle}\nStatus: ${postResult.status || 'unknown'}\nTweet ID already deduped — will NOT retry.`);
  }
}

// ── Step 5: Write back feed + logs ────────────────────────────────────────────
// Update feed file
writeFileSync(FEED_PATH, JSON.stringify({
  ...feed,
  candidates: feed.candidates.map(c => {
    const updated = results.find(r => r.tweetId === c.tweetId);
    return updated || c;
  }),
}, null, 2));

if (!DRY_RUN) {
  // NOTE: replied-tweets.json and posted-log.json are now written per-post inside
  // the loop (persistReply) so a mid-run kill can't orphan a reply. Do not re-append
  // here or entries would duplicate.

  // Sync engagement + topics in the background (non-blocking — don't fail the run if it errors)
  const syncScript = join(__dirname, 'sync-reply-engagement.js');
  try {
    spawnSync(process.execPath, [syncScript], {
      encoding: 'utf8', env: { ...process.env }, stdio: 'inherit', timeout: 120000,
    });
  } catch (e) {
    console.log(`  ⚠️  Engagement sync failed (non-fatal): ${e.message}`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n─── Summary ───');
console.log(`Candidates: ${candidates.length}`);
console.log(`Posted:     ${results.filter(r => r.replied).length}`);
console.log(`Skipped:    ${results.filter(r => !r.replied).length}`);
if (DRY_RUN) console.log('(DRY RUN — nothing actually posted)');
