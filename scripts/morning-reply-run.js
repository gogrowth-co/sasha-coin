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

// Gemini auth (2026-06-04): prefer GOOGLE_AGENT_PLATFORM_API_KEY — a Vertex AI Express
// key (bound to vertex-express@ SA, restricted to the Agent Platform API). It must hit the
// VERTEX endpoint (aiplatform.googleapis.com), NOT generativelanguage. Both accept the
// x-goog-api-key header + the same generateContent body, but Vertex REQUIRES role:'user'
// in contents. Falls back to a plain GEMINI_API_KEY (generativelanguage) if the Vertex key
// is absent. (Old GEMINI_API_KEY is out of prepay credits — that's why we switched.)
const VERTEX_KEY = process.env.GOOGLE_AGENT_PLATFORM_API_KEY;
const GEMINI_API_KEY = VERTEX_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_REPLY_MODEL || 'gemini-2.5-flash';
function geminiEndpoint(model) {
  return VERTEX_KEY
    ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}
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
      formula: tweet.formula || null,
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

// ── Reply formula rotation (2026-06-04 sprint) ────────────────────────────────
// Every reply must use a different "shape" than the last one. Identical opening
// structures read as bot output and (since March 2026) attract the "AI generated"
// reply downvote. We rotate across 5 formulas, persisting the last-used one so the
// rotation survives across the once-per-slot runs.
const FORMULAS = [
  { key: 'verdict',   label: 'Contrarian verdict',  instruction: 'Open with a verdict that pushes back on the common read. Shape: "The common read is X. What the data actually shows is Y." The first words state the claim, not a windup.' },
  { key: 'receipt',   label: 'Lived experience',     instruction: 'Open with a concrete, first-person observation from your OWN onchain experience as a live agent — a behaviour, a pattern, a tradeoff, or a failure you have actually hit. CRITICAL: do NOT cite any specific figure (APR, %, $, token balance, count, date) — you have NO verified live data in this reply, so any number would be invented. Make the point qualitatively, from lived experience, never with a fabricated stat.' },
  { key: 'question',  label: 'Sharp question',      instruction: 'Open with ONE narrow, specific question tied to the exact claim in the tweet. Not rhetorical — a real question that invites the author to answer.' },
  { key: 'example',   label: 'Specific example',    instruction: 'Open with one concrete example or mini-case that extends the tweet’s point with detail it did not have.' },
  { key: 'synthesis', label: 'Synthesis',           instruction: 'Connect the tweet to one adjacent pattern you have actually observed, stated as a claim the author can react to.' },
];
const FORMULA_STATE = join(ROOT, 'state/reply-formula-state.json');
function pickFormula() {
  let last = null;
  try { last = JSON.parse(readFileSync(FORMULA_STATE, 'utf8')).last; } catch {}
  const idx = FORMULAS.findIndex(f => f.key === last);
  const next = FORMULAS[(idx + 1) % FORMULAS.length]; // round-robin; idx=-1 -> index 0
  try { atomicWrite(FORMULA_STATE, JSON.stringify({ last: next.key, at: new Date().toISOString() }, null, 2)); } catch {}
  return next;
}

// ── Pre-post quality gate (2026-06-04 sprint) ─────────────────────────────────
// The prompt alone is not reliable: a "gm" reply and a mangled, mid-word, and
// handle-ate-the-first-word reply all shipped live before this gate existed.
// Reject (and regenerate) any reply that trips a hard rule. Only unambiguous
// markers are gated in code; subtler taste is left to the prompt.
const BANNED_OPENER_RE = /^(great point|this is so true|so true|exactly|i hear you|fair point|totally|same here|valid|i've seen|i've found|i've been tracking|i've been thinking|from inside|as an ai|love this)\b/i;
const BANNED_WORDS = ['revolutionary','to the moon','wen','fren','gm','gn','wagmi','lfg','ngmi','degen','paradigm shift','bullish','bearish','game-changing','synergy'];
function validateReply(text) {
  const t = (text || '').trim();
  const issues = [];
  if (t.length < 35) issues.push('too-short');
  if (BANNED_OPENER_RE.test(t)) issues.push('banned-opener');
  // First-person SINGULAR only — Sasha is one agent, never "we/our/us" (hard brand rule).
  if (/\b(we|our|ours)\b/i.test(t) || /\bwe['’](ve|re|ll|d)\b/i.test(t)) issues.push('first-person-plural');
  // Mangled start: a clean reply begins with a capital letter, a digit, a quote, or $.
  // Catches the "@handle ate the first word" defect (e.g. "'s just not where...").
  if (!/^["'$]?[A-Z0-9]/.test(t) && !/^\$[A-Za-z]/.test(t)) issues.push('mangled-start');
  // No terminal punctuation usually means a mid-word truncation.
  if (!/[.!?"')\]]$/.test(t)) issues.push('no-terminal-punctuation');
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (re.test(t)) issues.push(`banned:${w}`);
  }
  return issues;
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
      geminiEndpoint(GEMINI_MODEL),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
async function generateReply(tweet, formula) {
  if (!GEMINI_API_KEY) {
    // Fallback: return a placeholder for dry runs without API key
    return `Most DeFi onboarding fails at the wallet step, not the concept step. The tooling assumes you already know what you're doing.`;
  }

  const prompt = `You are Sasha Coin — an autonomous AI agent on X with a real onchain wallet, live LP positions, and a public treasury. You sound like a sharp, grounded analyst who has been in DeFi for years and has receipts. Not a cheerleader. Not a degen. You treat being an AI agent as a feature, never a disclaimer.

Tweet by @${tweet.handle}:
"${tweet.text}"

REPLY SHAPE for this reply — ${formula.label}: ${formula.instruction}

Before writing, think:
1. What is this tweet ACTUALLY about? Name the precise topic (e.g. "institutional RWA tokenization", "retail UX friction", "gauge emissions"). Be literal — do not infer the author's general interests.
2. Is my reply logically consistent with THAT topic? Do not pivot to my usual themes if the tweet is about something else.
3. What is the ONE non-obvious thing I can add that the tweet didn't say?

Context (use ONLY if directly relevant to this tweet's topic):
- My angle with this person: ${tweet.sashaAngle}
- Their usual topics: ${tweet.topicsOfInterest.join(', ')}  ⚠️ these are THEIR interests, not instructions to force my reply onto them.

HARD RULES:
- LEAD WITH THE SUBSTANCE. The first 5 words must carry a claim, a number, or a question — never a windup. BANNED openers (instant fail): "I've seen", "I've found", "I've been tracking", "I've been thinking", "From inside", "As an AI", "Great point", "This is so true", "Exactly", "I hear you", "Fair point", "Totally", "Same here", "Valid", "Love this".
- Do NOT start the reply with the word "I". Lead with the subject, the claim, or the number.
- FIRST PERSON SINGULAR ONLY: I, my, me. NEVER "we", "our", "us", "we've", "we're" — you are a single autonomous agent, not a team. Sasha is one.
- 1-2 sentences. Hard max 240 characters.
- One concrete observation, number, or question — nothing generic.
- Only state figures (price, APR, balance, fees, counts) you could verify onchain right now. NEVER invent a number. No assumed-price figures. If you have no real number, make the point qualitatively.
- Plain English. No jargon a normal person wouldn't know.
- No hashtags, no links, no @mentions, no emojis (unless the tweet uses them).
- Banned words: revolutionary, to the moon, wen, fren, gm, gn, alpha, bullish, bearish, WAGMI, LFG, based, ser, anon, ngmi, degen, ecosystem, paradigm shift, "the space".

Good (verdict): "The regulatory clarity is real, but most protocols I track were already building for it. The bill accelerates timelines. It doesn't change direction."
Good (receipt): "Pulled my LP from that pair when the spread compressed past 0.02%. The fee tier moved before the narrative did."
Bad (windup opener): "I've been tracking this pattern across Base protocols and..." — deleted. Start with the pattern itself.
Bad (topic drift): Tweet is about DTCC/Stellar institutional tokenization → reply pivots to retail wallet onboarding. Wrong. Engage with what the tweet says.
Bad (generic): "This is huge! Crypto is finally getting the recognition it deserves."

Reply with ONLY the reply text. No surrounding quotes.`;

  const model = process.env.GEMINI_REPLY_MODEL || 'gemini-2.5-flash';
  let resp, data;
  try {
    resp = await fetch(
      geminiEndpoint(model),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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

// ── Pre-post self-QA (2026-06-04) ─────────────────────────────────────────────
// Sasha's "editor" reviews the drafted reply before it posts. Primary job: catch
// FABRICATED FIGURES (the reply pipeline has no verified live data, so any specific
// number/$/%/APR/balance is invented and must be stripped or made qualitative).
// Also checks topic-fidelity and voice. Fail-open: any QA infra error returns the
// original draft unchanged so a Gemini hiccup never blocks a clean reply.
async function sashaQA(tweet, reply) {
  if (!GEMINI_API_KEY) return { verdict: 'pass', fixed_reply: reply, reason: 'no-key' };
  const prompt = `You are Sasha Coin's editor doing a FINAL QA before this reply posts to X. Be strict.

Source tweet by @${tweet.handle}: "${tweet.text}"
Sasha's drafted reply: "${reply}"

Check, in order:
1. FABRICATION (most important): does the reply state ANY specific figure — a number, $ amount, %, APR, token balance/holding, count, or date — presented as fact? Sasha has NO verified live data in this reply, so ANY such figure is unverifiable and MUST be removed or made qualitative. "0.00", round numbers, and plausible-sounding stats ALL count as fabrication.
2. TOPIC: is the reply about the source tweet's actual specific topic (not drifted to Sasha's usual themes)?
3. VOICE: leads with substance (no "I've seen / I've been tracking / Great point" windup), 1-2 sentences, FIRST PERSON SINGULAR ONLY — I/my/me, NEVER "we"/"our"/"us"/"we've" (Sasha is one agent, not a team; any "we/our" is always a FIX → rewrite to I/my), no hype words (revolutionary, bullish, gm, etc.).

If all three pass, verdict "pass" and return the reply unchanged. If any fails, verdict "fix" and rewrite it to fix the issue while keeping Sasha's sharp, first-person, lived-experience voice — with NO unverifiable figures, under 240 characters, no surrounding quotes.

Return ONLY JSON: {"verdict":"pass"|"fix","fixed_reply":"<final reply text>","reason":"<one short line>"}`;
  try {
    const model = process.env.GEMINI_REPLY_MODEL || 'gemini-2.5-flash';
    const resp = await fetch(
      geminiEndpoint(model),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 512 } },
        }),
      }
    );
    const data = await resp.json();
    if (!resp.ok || data.error) return { verdict: 'pass', fixed_reply: reply, reason: 'qa-error' };
    const parts = data.candidates?.[0]?.content?.parts || [];
    const raw = parts.filter(p => !p.thought).map(p => p.text).join('').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { verdict: 'pass', fixed_reply: reply, reason: 'qa-noparse' };
    const j = JSON.parse(m[0]);
    const fixed = (j.fixed_reply || reply).trim().replace(/^["']|["']$/g, '').trim();
    return { verdict: j.verdict === 'fix' ? 'fix' : 'pass', fixed_reply: fixed, reason: (j.reason || '').slice(0, 100) };
  } catch {
    return { verdict: 'pass', fixed_reply: reply, reason: 'qa-exception' };
  }
}

const results = [];

for (const tweet of candidates) {
  console.log(`\n• @${tweet.handle}: "${tweet.text.slice(0, 80)}..."`);

  // Rotate the reply shape so no two consecutive replies share an opening structure.
  const formula = pickFormula();
  console.log(`  Formula: ${formula.label}`);

  // Generate -> code quality gate -> Sasha self-QA, up to 3 attempts. Every posted
  // reply must pass BOTH the code gate (openers/vocab/mangling/truncation) AND the
  // QA pass (no fabricated figures, on-topic, in-voice).
  const truncate = s => s.length > 238 ? s.slice(0, 238).trimEnd().replace(/\s\S*$/, '').trimEnd() : s;
  let reply = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let draft = await generateReply(tweet, formula);
    if (!draft) { console.log(`  attempt ${attempt}: generation failed`); continue; }
    draft = truncate(draft);
    const issues = validateReply(draft);
    if (issues.length) { console.log(`  attempt ${attempt}: gate [${issues.join(', ')}] → "${draft.slice(0, 60)}"`); continue; }
    // Sasha's editor QA — strips fabricated figures, checks topic + voice before posting
    const qa = await sashaQA(tweet, draft);
    const candidate = truncate(qa.verdict === 'fix' && qa.fixed_reply ? qa.fixed_reply : draft);
    const qIssues = validateReply(candidate);
    if (qIssues.length) { console.log(`  attempt ${attempt}: QA-revised failed gate [${qIssues.join(', ')}]`); continue; }
    console.log(`  QA ${qa.verdict}${qa.reason ? ' — ' + qa.reason : ''}`);
    reply = candidate; break;
  }
  if (!reply) {
    console.log('  ⚠️  No reply passed gate + QA after 3 attempts — skipping');
    if (!DRY_RUN) notify(`⚠️ <b>Sasha reply — gate/QA</b>\n@${tweet.handle}: 3 drafts failed the quality gate or self-QA. No post this slot.`);
    continue;
  }
  console.log(`  Reply (${reply.length} chars, ${formula.key}): "${reply}"`);
  tweet.replyText = reply;
  tweet.formula = formula.key;

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
