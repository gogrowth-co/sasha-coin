#!/usr/bin/env node
/**
 * x-engage.js — X/Twitter engagement flows via Termux bridge
 *
 * Orchestrates send_to_phone.js calls to perform real X app interactions
 * on the Android phone — real device fingerprint, no API credits.
 *
 * Usage:
 *   node x-engage.js --flow like_tweet --tweet-id 1234
 *   node x-engage.js --flow reply --tweet-url https://x.com/... --text "great point!"
 *   node x-engage.js --flow scroll_feed --count 5
 *   node x-engage.js --flow post_tweet --text "content here"
 *   node x-engage.js --flow follow_user --username SashaCoin95
 *
 * Calibration:
 *   node x-engage.js --flow screenshot  (see current screen)
 *   node x-engage.js --flow ping        (verify bridge is alive)
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SENDER   = join(__dirname, 'send_to_phone.js');

// ── Env loader ─────────────────────────────────────────────────────────────────
function loadEnv() {
  const candidates = [join(__dirname, '../../.env'), '/data/.openclaw/.env'];
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

// ── Bridge call ────────────────────────────────────────────────────────────────
function phone(action, params = {}, waitMs = 12000) {
  const args = ['--action', action];
  if (Object.keys(params).length) {
    args.push('--params', JSON.stringify(params));
  }
  args.push('--wait', String(waitMs));

  const result = spawnSync(process.execPath, [SENDER, ...args], {
    encoding: 'utf8', timeout: waitMs + 5000,
    env: { ...process.env },
  });

  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    return { status: 'error', raw: result.stdout?.slice(0, 200) };
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function humanDelay(baseMs = 800) {
  // Add ±30% jitter to simulate human timing
  return baseMs + (Math.random() * 0.6 - 0.3) * baseMs;
}

async function tap(x, y, waitMs = 800) {
  const r = phone('tap', { x, y, wait_ms: 200 });
  await sleep(humanDelay(waitMs));
  return r;
}

// ── Screen coordinates (Samsung Galaxy S series / 1080x2400) ──────────────────
// Calibrate by running --flow screenshot and measuring pixel positions.
// These are starting-point estimates — adjust to match your specific phone.
const COORDS = {
  // Bottom nav bar (1080x2400 phone)
  nav_home:     { x: 108, y: 2350 },
  nav_search:   { x: 324, y: 2350 },
  nav_notif:    { x: 756, y: 2350 },
  nav_profile:  { x: 972, y: 2350 },
  nav_messages: { x: 540, y: 2350 },

  // Compose tweet FAB (bottom right)
  compose_fab: { x: 980, y: 2210 },

  // Tweet composer
  tweet_input:  { x: 540, y: 700 },
  tweet_post:   { x: 970, y: 180 },

  // Home feed — first visible tweet's action bar offsets (relative to tweet Y)
  // Actions row is ~150px below tweet start; like is rightmost, reply is leftmost
  reply_btn_offset:  { dx: 60,  dy: 150 },
  retweet_btn_offset:{ dx: 270, dy: 150 },
  like_btn_offset:   { dx: 480, dy: 150 },

  // Reply composer (after tapping reply)
  reply_input: { x: 540, y: 900 },
  reply_post:  { x: 970, y: 180 },

  // Search
  search_bar: { x: 540, y: 140 },
  search_clear: { x: 950, y: 140 },
};

// ── Flows ──────────────────────────────────────────────────────────────────────

async function flow_ping() {
  return phone('ping');
}

async function flow_screenshot() {
  return phone('screenshot');
}

async function flow_open_x() {
  phone('force_stop', { package: 'com.twitter.android' });
  await sleep(500);
  const r = phone('launch_app', { package: 'com.twitter.android', wait_ms: 3000 });
  return r;
}

async function flow_scroll_feed({ count = 3 } = {}) {
  await flow_open_x();
  await tap(COORDS.nav_home.x, COORDS.nav_home.y);
  await sleep(1500);

  const scrolls = [];
  for (let i = 0; i < count; i++) {
    const r = phone('scroll_down', { x: 540, start_y: 1400, distance: 700 });
    scrolls.push(r);
    await sleep(humanDelay(1200));
  }
  return { status: 'ok', scrolls: count };
}

async function flow_open_tweet({ tweet_url }) {
  if (!tweet_url) return { status: 'error', error: 'tweet_url required' };
  return phone('open_url', { url: tweet_url });
}

async function flow_like_tweet({ tweet_url }) {
  if (tweet_url) {
    await flow_open_tweet({ tweet_url });
    await sleep(2500);
  }
  // Like button is usually in the action row — find by content description
  const r = phone('find_and_tap', { desc: 'Like' });
  await sleep(500);
  return r;
}

async function flow_reply({ tweet_url, text }) {
  if (!text) return { status: 'error', error: 'text required' };

  if (tweet_url) {
    await flow_open_tweet({ tweet_url });
    await sleep(2500);
  }

  // Find and tap Reply button
  phone('find_and_tap', { desc: 'Reply' });
  await sleep(1500);

  // Type the reply text
  await tap(COORDS.reply_input.x, COORDS.reply_input.y);
  await sleep(500);

  phone('type_text', { text });
  await sleep(humanDelay(1000));

  // Post
  await tap(COORDS.reply_post.x, COORDS.reply_post.y);
  await sleep(2000);

  // Confirm by taking screenshot
  phone('screenshot');
  return { status: 'ok', action: 'replied', text: text.slice(0, 50) };
}

async function flow_post_tweet({ text }) {
  if (!text) return { status: 'error', error: 'text required' };

  await flow_open_x();
  await sleep(1500);

  // Tap compose FAB
  await tap(COORDS.compose_fab.x, COORDS.compose_fab.y, 1200);

  // Type tweet
  await tap(COORDS.tweet_input.x, COORDS.tweet_input.y, 600);
  phone('type_text', { text });
  await sleep(humanDelay(1200));

  // Post
  await tap(COORDS.tweet_post.x, COORDS.tweet_post.y, 2000);

  phone('screenshot');
  return { status: 'ok', action: 'posted', text: text.slice(0, 80) };
}

async function flow_follow_user({ username }) {
  if (!username) return { status: 'error', error: 'username required' };

  const profileUrl = `https://twitter.com/${username.replace('@', '')}`;
  phone('open_url', { url: profileUrl });
  await sleep(3000);

  // Follow button
  const r = phone('find_and_tap', { text: 'Follow' });
  await sleep(1000);
  return { status: 'ok', action: 'followed', username };
}

async function flow_search({ query }) {
  if (!query) return { status: 'error', error: 'query required' };

  await flow_open_x();
  await sleep(1500);
  await tap(COORDS.nav_search.x, COORDS.nav_search.y, 1200);

  const r = phone('find_and_tap', { text: 'Search' });
  await sleep(600);
  phone('type_text', { text: query });
  phone('key_event', { keycode: 66 }); // ENTER
  await sleep(2000);
  phone('screenshot');
  return { status: 'ok', action: 'searched', query };
}

async function flow_notifications() {
  await flow_open_x();
  await sleep(1200);
  await tap(COORDS.nav_notif.x, COORDS.nav_notif.y, 1500);
  phone('screenshot');
  return { status: 'ok', action: 'opened_notifications' };
}

async function flow_calibrate() {
  // Opens X and takes screenshot with a coordinate grid overlay hint
  await flow_open_x();
  await sleep(2000);
  phone('screenshot');
  return {
    status: 'ok',
    note: 'Screenshot sent to Telegram. Measure pixel positions of: bottom nav icons, compose FAB, first tweet action row.',
    screen_size_hint: '1080x2400 assumed — update COORDS in x-engage.js if different'
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const flowName = getArg('--flow');
const params = {
  tweet_url: getArg('--tweet-url'),
  tweet_id:  getArg('--tweet-id'),
  text:      getArg('--text'),
  username:  getArg('--username'),
  query:     getArg('--query'),
  count:     parseInt(getArg('--count') || '3', 10),
};

const flows = {
  ping:          flow_ping,
  screenshot:    flow_screenshot,
  open_x:        flow_open_x,
  scroll_feed:   flow_scroll_feed,
  like_tweet:    flow_like_tweet,
  reply:         flow_reply,
  post_tweet:    flow_post_tweet,
  follow_user:   flow_follow_user,
  search:        flow_search,
  notifications: flow_notifications,
  calibrate:     flow_calibrate,
};

if (!flowName || !flows[flowName]) {
  console.log(JSON.stringify({
    status: 'usage',
    available_flows: Object.keys(flows),
    example: 'node x-engage.js --flow reply --tweet-url https://x.com/... --text "great take!"'
  }));
  process.exit(1);
}

try {
  const result = await flows[flowName](params);
  console.log(JSON.stringify(result));
  process.exit(result?.status === 'ok' ? 0 : 1);
} catch (err) {
  console.log(JSON.stringify({ status: 'exception', error: err.message }));
  process.exit(1);
}