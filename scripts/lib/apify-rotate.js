// Apify key rotation helper.
//
// When any Apify call returns `platform-feature-disabled` (monthly usage hard
// limit hit on that account), walk the keys file and try the next key until
// one succeeds. Reorder the file so the working key sits at the top for
// future runs. If ALL keys are exhausted, throw a clear error pointing at the
// keys file so a fresh one can be added.
//
// Default keys file paths checked in order:
//   1. process.env.APIFY_KEYS_FILE — explicit override
//   2. /data/.openclaw/credentials/apify/keys — VPS canonical path
//   3. ~/.config/apify/keys — local canonical path
//
// File format: one key per line. Lines starting with # or blank are ignored.
// Anything after the key on the same line (e.g. " # label") is a comment.
//
// Usage:
//   import { apifyFetch } from './lib/apify-rotate.js';
//   const r = await apifyFetch(`https://api.apify.com/v2/acts/.../run-sync-get-dataset-items?timeout=120`);
//   // The helper injects ?token=<active key> (replaces any token already in the URL).
//   // It also accepts Authorization headers via fetch options.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_PATHS = [
  process.env.APIFY_KEYS_FILE,
  '/data/.openclaw/credentials/apify/keys',
  join(homedir(), '.config/apify/keys'),
].filter(Boolean);

function findKeysFile() {
  for (const p of DEFAULT_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

function loadKeys(file) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const entries = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // First whitespace-separated token is the key; rest is preserved as comment
    const idx = trimmed.search(/\s/);
    const key = idx === -1 ? trimmed : trimmed.slice(0, idx);
    const comment = idx === -1 ? '' : trimmed.slice(idx).trimEnd();
    if (key) entries.push({ key, comment, raw: line.trimEnd() });
  }
  return entries;
}

function saveKeys(file, entries) {
  const body = entries.map((e) => e.raw).join('\n') + '\n';
  writeFileSync(file, body, { mode: 0o600 });
}

function moveToFront(entries, key) {
  const i = entries.findIndex((e) => e.key === key);
  if (i <= 0) return entries;
  const [hit] = entries.splice(i, 1);
  return [hit, ...entries];
}

// Replace any existing ?token=... or &token=... query param with the active key.
function injectToken(url, key) {
  const u = new URL(url);
  u.searchParams.set('token', key);
  return u.toString();
}

function isRotateTriggerStatus(status) {
  // 403: platform-feature-disabled. 402: payment required. 429: rate limit.
  // For now we rotate on 403 only (per Gabriel's spec). 429 should retry-after,
  // not rotate. 402 is a billing block — rotate too.
  return status === 403 || status === 402;
}

async function isRotateTriggerBody(response) {
  // Some Apify errors return 200 with an error body. Cheap check via clone.
  try {
    const cloned = response.clone();
    const text = await cloned.text();
    return text.includes('platform-feature-disabled') || text.includes('Monthly usage hard limit');
  } catch {
    return false;
  }
}

export async function apifyFetch(url, options = {}) {
  const file = findKeysFile();
  if (!file) {
    throw new Error(
      'apify-rotate: no keys file found. Checked: ' + DEFAULT_PATHS.join(', ') +
      '. Create one with one APIFY token per line.'
    );
  }
  let entries = loadKeys(file);
  if (!entries.length) {
    throw new Error('apify-rotate: keys file ' + file + ' is empty.');
  }

  const tried = [];
  let lastErr = null;
  for (let i = 0; i < entries.length; i++) {
    const { key, comment } = entries[i];
    const labeled = `key#${i + 1}${comment ? ' ' + comment : ''}`;
    tried.push(labeled);
    const finalUrl = injectToken(url, key);
    try {
      const r = await fetch(finalUrl, options);
      if (isRotateTriggerStatus(r.status) || (await isRotateTriggerBody(r))) {
        const body = await r.clone().text();
        if (process.env.APIFY_ROTATE_VERBOSE) {
          console.error(`apify-rotate: ${labeled} returned ${r.status}, rotating. Body: ${body.slice(0, 120)}`);
        }
        lastErr = new Error(`Apify ${r.status} on ${labeled}: ${body.slice(0, 200)}`);
        continue;
      }
      // Success — make sure this key is at the top of the file for next run
      if (i > 0) {
        try { saveKeys(file, moveToFront(entries, key)); } catch (e) {
          // Non-fatal: file write failure shouldn't block this request
          if (process.env.APIFY_ROTATE_VERBOSE) {
            console.error(`apify-rotate: could not reorder keys file: ${e.message}`);
          }
        }
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (process.env.APIFY_ROTATE_VERBOSE) {
        console.error(`apify-rotate: ${labeled} threw: ${e.message}`);
      }
      continue;
    }
  }

  throw new Error(
    `All Apify API keys have hit their monthly usage limit. ` +
    `Add a fresh key to ${file} to restore. ` +
    `Tried ${tried.length} key(s): ${tried.join(', ')}. Last error: ${lastErr?.message || 'unknown'}`
  );
}

// CLI smoke test: `node lib/apify-rotate.js` calls /users/me with the active key.
if (import.meta.url === `file://${process.argv[1]}`) {
  apifyFetch('https://api.apify.com/v2/users/me')
    .then((r) => r.json())
    .then((j) => {
      console.log('Active key user:', j.data.username, '| plan:', j.data.plan.id);
    })
    .catch((e) => {
      console.error('FAIL:', e.message);
      process.exit(1);
    });
}
