#!/usr/bin/env node
/**
 * send_to_phone.js — VPS-side Termux bridge command sender
 *
 * Usage:
 *   node send_to_phone.js --action tap --params '{"x":540,"y":1200}'
 *   node send_to_phone.js --action screenshot
 *   node send_to_phone.js --action launch_app --params '{"package":"com.twitter.android"}'
 *   node send_to_phone.js --action type_text --params '{"text":"great point!"}'
 *   node send_to_phone.js --action ping
 *
 * Env vars (from /data/.openclaw/.env):
 *   TERMUX_BRIDGE_TOKEN    — bridge bot token (from BotFather)
 *   COMMANDER_CHAT_ID      — Gabriel's Telegram user ID
 *   BRIDGE_SECRET          — shared secret (must match phone .env)
 *
 * Returns JSON to stdout: { status, cmd_id, ...result }
 * Exit 0 on ok, 1 on error.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env loader ────────────────────────────────────────────────────────────────
function loadEnv() {
  const candidates = [
    join(__dirname, '../../.env'),
    '/data/.openclaw/.env',
    join(__dirname, '../../../../.env'),
  ];
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

const BOT_TOKEN    = process.env.TERMUX_BRIDGE_TOKEN;
const COMMANDER_ID = process.env.COMMANDER_CHAT_ID;
const SECRET       = process.env.BRIDGE_SECRET;

if (!BOT_TOKEN || !COMMANDER_ID || !SECRET) {
  console.log(JSON.stringify({
    status: 'config_error',
    error: 'Missing env vars: TERMUX_BRIDGE_TOKEN, COMMANDER_CHAT_ID, BRIDGE_SECRET'
  }));
  process.exit(1);
}

// ── CLI argument parsing ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const action  = getArg('--action');
const rawParams = getArg('--params');
const waitMs  = parseInt(getArg('--wait') || '15000', 10);  // ms to wait for reply

if (!action) {
  console.log(JSON.stringify({ status: 'usage_error', error: '--action required' }));
  process.exit(1);
}

let params = {};
if (rawParams) {
  try {
    params = JSON.parse(rawParams);
  } catch (e) {
    console.log(JSON.stringify({ status: 'parse_error', error: 'Invalid JSON in --params' }));
    process.exit(1);
  }
}

// ── Telegram API ────────────────────────────────────────────────────────────────
async function tgPost(method, body) {
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`TG ${resp.status}: ${t.slice(0, 200)}`);
  }
  return resp.json();
}

async function sendCommand(cmdObj) {
  return tgPost('sendMessage', {
    chat_id: COMMANDER_ID,
    text: JSON.stringify(cmdObj),
  });
}

// Poll for reply matching cmd_id (getUpdates long-poll)
async function waitForReply(cmdId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  // Get current update offset first (skip old messages)
  let offset = 0;
  try {
    const current = await tgPost('getUpdates', { limit: 1, timeout: 0 });
    const updates = current.result || [];
    if (updates.length > 0) {
      offset = updates[updates.length - 1].update_id + 1;
    }
  } catch {}

  while (Date.now() < deadline) {
    const remaining = Math.min(10000, deadline - Date.now());
    if (remaining <= 0) break;

    let resp;
    try {
      resp = await tgPost('getUpdates', {
        offset,
        timeout: Math.floor(remaining / 1000),
        allowed_updates: ['message'],
      });
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const updates = resp.result || [];
    for (const update of updates) {
      offset = update.update_id + 1;
      const text = update.message?.text || '';
      // Strip markdown code block if present
      const cleaned = text.replace(/^`+|`+$/g, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.cmd_id === cmdId) {
          return parsed;
        }
      } catch {}
    }
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────────
const cmdId = randomUUID().slice(0, 8);
const cmd = { cmd_id: cmdId, action, params, secret: SECRET };

process.stderr.write(`→ action=${action} cmd_id=${cmdId}\n`);

// Screenshot action never sends a JSON reply (sends a photo), so don't wait for it
const noReplyActions = new Set(['screenshot']);

try {
  await sendCommand(cmd);

  if (noReplyActions.has(action)) {
    console.log(JSON.stringify({ status: 'ok', cmd_id: cmdId, note: 'screenshot sent to Telegram' }));
    process.exit(0);
  }

  const reply = await waitForReply(cmdId, waitMs);
  if (!reply) {
    console.log(JSON.stringify({ status: 'timeout', cmd_id: cmdId, waited_ms: waitMs }));
    process.exit(1);
  }

  console.log(JSON.stringify(reply));
  process.exit(reply.status === 'ok' ? 0 : 1);

} catch (err) {
  console.log(JSON.stringify({ status: 'error', error: err.message }));
  process.exit(1);
}