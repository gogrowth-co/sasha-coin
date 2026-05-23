#!/usr/bin/env node
/**
 * adb-reply.js — Post a reply to an X tweet via ADB (real device, no API)
 *
 * Usage:
 *   node scripts/adb-reply.js --url "https://x.com/user/status/ID" --text "reply text"
 *   node scripts/adb-reply.js --url "..." --text "..." --dry-run
 *   node scripts/adb-reply.js --url "..." --text "..." --device 192.168.0.6:46185
 *
 * Requirements:
 *   - ADB binary at /tmp/platform-tools/adb (or set ADB_PATH env var)
 *   - Phone connected via wireless ADB (or USB)
 *   - X app installed, Gboard set to English (US) as primary language
 */

import { spawnSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';


const SASHA_TMP_DIR = process.env.SASHA_TMPDIR || process.env.TMPDIR || "/tmp";
const ADB_PATH = process.env.ADB_PATH || `${process.env.HOME}/bin/adb`;
const SASHA_PHONE = process.env.SASHA_PHONE_ADB || '192.168.0.6:5555';

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}
const tweetUrl = getArg('--url');
const replyText = getArg('--text');
const deviceSerial = getArg('--device') || SASHA_PHONE;
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

if (!tweetUrl || !replyText) {
  console.error('Usage: node adb-reply.js --url <tweet_url> --text <reply_text> [--dry-run] [--device <serial>]');
  process.exit(1);
}

if (replyText.length > 280) {
  console.error(`ERROR: Reply text is ${replyText.length} chars (max 280)`);
  process.exit(1);
}

// ── ADB helpers ─────────────────────────────────────────────────────────────
function adb(...cmdArgs) {
  const result = spawnSync(ADB_PATH, ['-s', deviceSerial, ...cmdArgs], {
    encoding: 'utf8', timeout: 15000,
  });
  if (VERBOSE) console.log(`adb ${cmdArgs.join(' ')} → ${result.stdout?.trim() || result.stderr?.trim()}`);
  return result;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function uiDump(label = '') {
  // Delete local copy first so a failed pull can't return stale XML
  if (existsSync(`${SASHA_TMP_DIR}/ui-reply.xml`)) { try { rmSync(`${SASHA_TMP_DIR}/ui-reply.xml`); } catch {} }
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const pull = adb('pull', '/sdcard/ui.xml', `${SASHA_TMP_DIR}/ui-reply.xml`);
  if (pull.status !== 0) throw new Error(`uiDump pull failed${label ? ' at ' + label : ''}: ${pull.stderr}`);
  const xml = readFileSync(`${SASHA_TMP_DIR}/ui-reply.xml`, 'utf8');
  if (!xml || xml.length < 100) throw new Error(`uiDump returned empty XML${label ? ' at ' + label : ''}`);
  return xml;
}

function findElement(xml, filter) {
  // Parse simple XML without a full parser — extract node attributes
  const results = [];
  const nodeRx = /<node([^>]*)\/>/g;
  let m;
  while ((m = nodeRx.exec(xml)) !== null) {
    const attrs = {};
    const attrRx = /(\w[\w-]*)="([^"]*)"/g;
    let a;
    while ((a = attrRx.exec(m[1])) !== null) {
      attrs[a[1]] = a[2];
    }
    if (filter(attrs)) results.push(attrs);
  }
  return results;
}

function boundsCenter(bounds) {
  // bounds = "[x1,y1][x2,y2]"
  const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  return {
    x: Math.round((parseInt(m[1]) + parseInt(m[3])) / 2),
    y: Math.round((parseInt(m[2]) + parseInt(m[4])) / 2),
  };
}

// Convert reply text to ADB-safe format.
// ADB input text: %s = space. Percent signs pass through as-is (no %% escaping needed).
// Apostrophes are handled separately via keyevent 75 — do NOT pass them here.
function encodeText(text) {
  return text.replace(/ /g, '%s');
}

// ── Main flow ────────────────────────────────────────────────────────────────
async function postReply() {
  console.log(`[adb-reply] URL: ${tweetUrl}`);
  console.log(`[adb-reply] Text (${replyText.length} chars): ${replyText}`);
  console.log(`[adb-reply] Device: ${deviceSerial}`);

  if (DRY_RUN) {
    console.log('[adb-reply] DRY RUN — no changes made');
    return { status: 'dry_run' };
  }

  // Step 0: Force-stop X app for clean state
  console.log('[0/6] Force-stopping X app...');
  adb('shell', 'am', 'force-stop', 'com.twitter.android');
  await sleep(1500);

  // Step 1: Open tweet URL in X app
  console.log('[1/6] Opening tweet in X...');
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', tweetUrl);
  await sleep(4000);

  // Step 2: Find reply text field
  console.log('[2/6] Finding reply field...');
  let xml = uiDump();
  let replyFields = findElement(xml, a =>
    a['resource-id'] === 'com.twitter.android:id/tweet_text' &&
    (a.text === 'Publicar sua resposta' || a.text === 'Post your reply' || a.text === '')
  );

  if (!replyFields.length) {
    // May need a small scroll to show the persistent reply bar
    adb('shell', 'input', 'swipe', '540', '1400', '540', '800', '400');
    await sleep(1500);
    xml = uiDump();
    replyFields = findElement(xml, a =>
      a['resource-id'] === 'com.twitter.android:id/tweet_text'
    );
  }

  if (!replyFields.length) {
    // Check for subscribers-only gate before throwing generic error
    const subGate = findElement(xml, a =>
      (a.text && (
        a.text.toLowerCase().includes('subscriber') ||
        a.text.toLowerCase().includes('assinante') ||
        a.text === 'Subscribe'
      )) ||
      (a['content-desc'] && a['content-desc'].toLowerCase().includes('subscriber'))
    );
    if (subGate.length) {
      console.log('[adb-reply] 🔒 Subscribers-only tweet — cannot reply');
      return { status: 'subscribers_only', url: tweetUrl };
    }
    throw new Error('Reply field not found in UI tree');
  }

  const replyBounds = replyFields[0].bounds;
  const replyCenter = boundsCenter(replyBounds);
  console.log(`[2/6] Reply field found at ${replyBounds}, center (${replyCenter.x}, ${replyCenter.y})`);

  // Step 3: Tap reply field to open composer, then ensure compose has focus
  console.log('[3/6] Tapping reply field...');
  adb('shell', 'input', 'tap', String(replyCenter.x), String(replyCenter.y));
  await sleep(4500); // wait for compose screen + keyboard animation

  // Step 4: Type the reply text
  // Split on apostrophes — apostrophes break device shell parsing via input text.
  // Type each segment, insert apostrophe (keycode 75) between segments.
  console.log('[4/6] Typing reply...');
  const segments = replyText.split("'");
  for (let i = 0; i < segments.length; i++) {
    if (segments[i]) {
      adb('shell', 'input', 'text', encodeText(segments[i]));
      await sleep(400);
    }
    if (i < segments.length - 1) {
      adb('shell', 'input', 'keyevent', '75'); // KEYCODE_APOSTROPHE
      await sleep(200);
    }
  }
  await sleep(1000);

  // Screenshot before posting — confirms text is in the compose field
  const screencap = spawnSync(ADB_PATH, ['-s', deviceSerial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer', timeout: 10000,
  });
  if (screencap.stdout && screencap.stdout.length > 1000) {
    writeFileSync(`${SASHA_TMP_DIR}/sasha-pre-post.png`, screencap.stdout);
    console.log('[4b/6] Screenshot saved → /tmp/sasha-pre-post.png');
  }

  // Step 5: Find and tap Responder/Reply button
  // Retry up to 3 times with increasing delay — compose screen may still be animating.
  // Primary selector: resource-id (most stable). Fallback: text/content-desc.
  console.log('[5/6] Finding Responder button...');
  let respButtons = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.log(`[5/6] Retry ${attempt}...`);
      await sleep(2000 * attempt);
    }
    // Save screenshot for each attempt to aid debugging
    const sc = spawnSync(ADB_PATH, ['-s', deviceSerial, 'exec-out', 'screencap', '-p'], {
      encoding: 'buffer', timeout: 10000,
    });
    if (sc.stdout && sc.stdout.length > 1000) {
      writeFileSync(`${SASHA_TMP_DIR}/sasha-step5-attempt${attempt}.png`, sc.stdout);
    }
    try {
      xml = uiDump('step5');
    } catch (e) {
      console.log(`[5/6] uiDump failed: ${e.message}`);
      continue;
    }
    respButtons = findElement(xml, a =>
      a['resource-id'] === 'com.twitter.android:id/tweet_button' ||
      a.text === 'Responder' || a.text === 'Reply' || a.text === 'REPLY' ||
      (a['content-desc'] && (a['content-desc'] === 'Reply' || a['content-desc'] === 'REPLY'))
    );
    if (respButtons.length) break;
    console.log('[5/6] Reply button not found yet — waiting...');
  }

  if (!respButtons.length) {
    throw new Error('Responder button not found');
  }

  const respCenter = boundsCenter(respButtons[0].bounds);
  console.log(`[5/6] Responder at (${respCenter.x}, ${respCenter.y})`);
  adb('shell', 'input', 'tap', String(respCenter.x), String(respCenter.y));

  // Step 6: Handle "Mais possibilidades no X" popup (always appears for unverified accounts)
  console.log('[6/6] Waiting for confirmation / popup...');
  await sleep(3000);

  xml = uiDump();
  const popupText = findElement(xml, a =>
    (a.text && (a.text.includes('possibilidades') || a.text.includes('possibilities')))
  );

  if (popupText.length) {
    console.log('[6/6] Popup detected — dismissing "Entendi"...');
    // "Entendi" button renders at 0,0 in uiautomator; tap visually at y=2200
    // (below "Saiba mais" at ~y=2090, above nav bar at ~y=2300)
    adb('shell', 'input', 'tap', '540', '2200');
    await sleep(1500);
    console.log('[6/6] Popup dismissed');
  } else {
    console.log('[6/6] No popup — reply may have posted directly');
  }

  // Verify: check if reply field reset to placeholder (means composer closed = reply posted)
  await sleep(1000);
  xml = uiDump();
  const resetField = findElement(xml, a =>
    a['resource-id'] === 'com.twitter.android:id/tweet_text' &&
    (a.text === 'Publicar sua resposta' || a.text === 'Post your reply')
  );

  if (resetField.length) {
    console.log('[adb-reply] ✅ Reply posted successfully');
    return { status: 'ok', url: tweetUrl, text: replyText };
  } else {
    console.log('[adb-reply] ⚠️  Could not confirm via uiautomator — check phone screen');
    return { status: 'unconfirmed', url: tweetUrl, text: replyText };
  }
}

postReply()
  .then(r => {
    console.log(JSON.stringify(r));
    process.exit(r.status === 'ok' || r.status === 'dry_run' ? 0 : 1);
  })
  .catch(err => {
    console.error('[adb-reply] ERROR:', err.message);
    console.log(JSON.stringify({ status: 'error', error: err.message }));
    process.exit(1);
  });
