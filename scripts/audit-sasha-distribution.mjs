#!/usr/bin/env node
// audit-sasha-distribution.mjs
// Read-only liveness audit for Sasha's social distribution (persona posts + replies).
//
// HARD SAFETY CONTRACT: this script NEVER posts, replies, deletes, archives,
// schedules, bridges, signs, or trades. It only READS — local files, an optional
// read-only Buffer GraphQL query, and optional read-only SSH to the VPS. It never
// prints secret values (Buffer token is read from env and used, never logged).
//
// Checks implemented (see sasha-distribution-liveness/references/checks.md):
//   1. posted-log freshness vs the 5-events/day cadence (cron fires but no artifact)
//   2. content-mix quality (onchain-receipt vs persona vs reply share)
//   3. Buffer reachability + auth + schema-drift detection (PostPublishingError.code)
//   4. Buffer sentAt vs local/VPS posted-log divergence
//   5. (--ssh) persona/reply CRON PRESENCE on the VPS + box-load spawnSync timeouts + dual state dirs
//   -> compact status: healthy | degraded | broken
//
// Usage:
//   node scripts/audit-sasha-distribution.mjs                      # local-only, offline
//   node scripts/audit-sasha-distribution.mjs --ssh --buffer       # full read-only verdict
//   node scripts/audit-sasha-distribution.mjs --days 7 --json
//   node scripts/audit-sasha-distribution.mjs --posted-log state/posted-log.json
//
// Owner skill: sasha-distribution-liveness

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const USE_SSH = flag("--ssh");
const USE_BUFFER = flag("--buffer");
const AS_JSON = flag("--json");
const DAYS = parseInt(opt("--days", "7"), 10);
const POSTED_LOG = opt("--posted-log", join(ROOT, "state/posted-log.json"));

// --- VPS (read-only) -------------------------------------------------------
const VPS = { host: "root@187.77.42.134", key: `${process.env.HOME}/.ssh/hostinger_vps` };
const VPS_WS_LOG = "/docker/openclaw-h3mk/data/.openclaw/workspace/state/posted-log.json";
const VPS_CORE_LOG = "/docker/openclaw-h3mk/data/.openclaw/state/posted-log.json";

// BRT (UTC-3) posting cadence -> expected UTC hours.
// Persona posts: 09/13/18 BRT = 12/16/21 UTC. Replies: 11/16 BRT = 14/19 UTC.
const EXPECTED_EVENTS_PER_DAY = 5;
const MAX_HEALTHY_GAP_H = 28;   // ~1 day of cadence + grace
const BROKEN_GAP_H = 48;

const findings = [];
const add = (sev, id, title, detail, fix) => findings.push({ sev, id, title, detail, fix });

// --- helpers ---------------------------------------------------------------
function entryTs(e) {
  const t = e.posted_at || e.queued_at || e.created_at || null;
  const ms = t ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : null;
}
function newest(entries) {
  let best = null;
  for (const e of entries) { const ms = entryTs(e); if (ms && (!best || ms > best)) best = ms; }
  return best;
}
function classifyText(text = "") {
  const t = String(text);
  if (/0x[0-9a-fA-F]{8,}/.test(t) || /\b(oklink|basescan|explorer|tx hash|txn)\b/i.test(t)) return "onchain-receipt";
  if (/weekly .*yield|\bmETH\b|\bAPR\b|\bTVL\b|\bbps\b|rebalanc|fee:\s*\d|funding rate/i.test(t)) return "onchain-receipt";
  return "persona";
}
function classifyEntry(e) {
  if (e.source === "reply") return "reply";
  const byText = classifyText(e.tweet_text || e.text || "");
  if (["calendar", "brief", "scheduled"].includes(e.source)) return byText === "onchain-receipt" ? "onchain-receipt" : "persona";
  return byText;
}
function hoursSince(ms) { return ms ? ((Date.now() - ms) / 3.6e6) : null; }
function loadLog(path) {
  if (!existsSync(path)) return { entries: [], mtime: null, missing: true };
  try {
    const entries = JSON.parse(readFileSync(path, "utf8"));
    return { entries: Array.isArray(entries) ? entries : [], mtime: statSync(path).mtime.getTime(), missing: false };
  } catch (e) {
    return { entries: [], mtime: null, error: e.message };
  }
}
function ssh(cmd) {
  // read-only commands only; 12s connect timeout
  return execFileSync("ssh", ["-i", VPS.key, "-o", "ConnectTimeout=12", "-o", "BatchMode=yes", VPS.host, cmd], { encoding: "utf8", timeout: 30000 });
}

// --- 1 + 2: local posted-log freshness + content mix -----------------------
const local = loadLog(POSTED_LOG);
let chosenLog = { ...local, source: "local", path: POSTED_LOG };

if (local.missing) {
  add("warn", "local-log", "Local posted-log missing", `No file at ${POSTED_LOG}`, "Expected on the dev box; use --ssh for the live VPS state.");
}

// --- 5: VPS read-only (cron presence is THE primary degradation signal) -----
let vps = null;
if (USE_SSH) {
  try {
    const cronList = ssh("ls /etc/cron.d/ 2>/dev/null; echo '---CRONTAB---'; crontab -l 2>/dev/null");
    const hasPostCron = /twitter[-_]scheduled[-_]post/i.test(cronList);
    const hasReplyCron = /twitter[-_]reply[-_]gal|morning-reply-run|run_reply_pipeline/i.test(cronList);
    if (!hasPostCron && !hasReplyCron) {
      add("fail", "cron-missing", "No persona/reply cron on the VPS",
        "Neither twitter-scheduled-post nor twitter-reply-gal is scheduled in /etc/cron.d or the host crontab. The only content-bound jobs are LP/yield automation, so the feed degrades to automated receipts.",
        "Install host cron entries (or OpenCLAW scheduler triggers) for the persona-post and reply cadence, then verify the next slot writes a fresh posted-log entry.");
    } else {
      if (!hasPostCron) add("fail", "cron-post-missing", "Persona-post cron missing", "twitter-scheduled-post is not scheduled on the VPS.", "Add the 12/16/21 UTC persona-post cron.");
      if (!hasReplyCron) add("fail", "cron-reply-missing", "Reply cron missing", "twitter-reply-gal/reply pipeline is not scheduled on the VPS.", "Add the 14/19 UTC reply cron (or re-enable the bridge trigger).");
    }

    // Box load vs cores (spawnSync ETIMEDOUT root cause)
    const load = ssh("uptime; echo '---'; nproc; echo '---'; grep -lE 'spawnSync.*ETIMEDOUT|ETIMEDOUT' /var/log/sasha-*.log 2>/dev/null | tr '\\n' ' '");
    const la1 = parseFloat((load.match(/load average:\s*([0-9.]+)/) || [])[1] || "0");
    const cores = parseInt((load.match(/---\s*(\d+)\s*---/) || [])[1] || "0", 10);
    const timeoutLogs = (load.split("---").pop() || "").trim();
    const loadHigh = cores && la1 > cores * 2;
    if (loadHigh || timeoutLogs) {
      add("warn", "box-overload", "VPS is oversubscribed / spawnSync timeouts present",
        `1-min load ${la1} on ${cores || "?"} vCPU(s)${loadHigh ? " (> 2x cores)" : ""}. spawnSync /bin/sh ETIMEDOUT breaks scripts that shell out (Buffer post, balance fetches).` + (timeoutLogs ? ` Logs with ETIMEDOUT: ${timeoutLogs}` : ""),
        "Reduce concurrent crons / move one OpenCLAW instance off the box, or raise spawnSync timeouts + serialize the */30 jobs.");
    }

    // Live VPS log freshness (workspace state)
    let vpsLog = null;
    try {
      const raw = ssh(`cat ${VPS_WS_LOG} 2>/dev/null || cat ${VPS_CORE_LOG} 2>/dev/null`);
      const entries = JSON.parse(raw);
      vpsLog = { entries: Array.isArray(entries) ? entries : [], newest: newest(Array.isArray(entries) ? entries : []) };
    } catch { /* leave null */ }

    // dual state dir divergence
    try {
      const dual = ssh(`for f in ${VPS_CORE_LOG} ${VPS_WS_LOG}; do echo -n "$f="; (cat "$f" 2>/dev/null | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null || echo NA); done`);
      const counts = Object.fromEntries(dual.trim().split("\n").map((l) => { const [k, v] = l.split("="); return [k, v]; }));
      const core = counts[VPS_CORE_LOG], ws = counts[VPS_WS_LOG];
      // After the 2026-06-03 unification, the core social files are archived (.stale-*) so `cat` -> "NA".
      // Only flag a TRUE divergence: both paths present, numeric, and different. core absent => unified (ok).
      if (core && ws && core !== "NA" && ws !== "NA" && core !== ws) {
        add("warn", "dual-state", "Two divergent posted-log files on the VPS",
          `core .openclaw/state/posted-log.json has ${core} entries; workspace/state/posted-log.json has ${ws}. Canonical is workspace/state; archive the core copy (see WS3 / DEC-003).`,
          "Archive the core social files (.stale-*) and point twitter-* SKILL.md at /data/.openclaw/workspace/state.");
      }
    } catch { /* ignore */ }

    vps = { ok: true, hasPostCron, hasReplyCron, log: vpsLog };
    if (vpsLog && vpsLog.newest && (!chosenLog.entries.length || vpsLog.newest > (newest(chosenLog.entries) || 0))) {
      chosenLog = { entries: vpsLog.entries, source: "vps", path: VPS_WS_LOG };
    }
  } catch (e) {
    add("warn", "ssh-failed", "VPS SSH read failed", `Could not reach the VPS read-only: ${String(e.message).slice(0, 80)}`, "Check ~/.ssh/hostinger_vps and connectivity; re-run with --ssh.");
    vps = { ok: false };
  }
}

// freshness (on the best available log)
const newestMs = newest(chosenLog.entries);
const gapH = hoursSince(newestMs);
if (!chosenLog.entries.length) {
  add("fail", "no-artifacts", "No posted-log artifacts at all", `Log source=${chosenLog.source} has 0 usable entries.`, "Persona/reply engine has never written here; confirm the engine + path.");
} else if (gapH === null) {
  add("warn", "no-timestamps", "Newest artifact has no parseable timestamp", "Could not determine recency from posted_at/queued_at.", "Ensure the engine writes ISO timestamps.");
} else if (gapH > BROKEN_GAP_H) {
  add("fail", "stale-artifacts", "Posted-log is stale (engine silent)", `Newest entry is ${gapH.toFixed(1)}h old (source=${chosenLog.source}); cadence expects ${EXPECTED_EVENTS_PER_DAY}/day.`, "Cron likely fires but writes no artifact (or no cron). Check the slot logs and engine path.");
} else if (gapH > MAX_HEALTHY_GAP_H) {
  add("warn", "aging-artifacts", "Posted-log aging", `Newest entry is ${gapH.toFixed(1)}h old (source=${chosenLog.source}).`, "Watch the next cadence slot; if it does not refresh, escalate.");
}

// content mix over last N days
const since = Date.now() - DAYS * 864e5;
const recent = chosenLog.entries.filter((e) => { const ms = entryTs(e); return ms && ms >= since; });
const mix = { persona: 0, reply: 0, "onchain-receipt": 0 };
for (const e of recent) { const c = classifyEntry(e); mix[c] = (mix[c] || 0) + 1; }
const totalRecent = recent.length;
const voiceShare = totalRecent ? (mix.persona + mix.reply) / totalRecent : null;
if (totalRecent > 0 && voiceShare !== null) {
  if (mix.persona === 0 && mix.reply === 0) {
    add("fail", "mix-no-voice", "Feed has no persona/reply content", `Last ${DAYS}d: ${mix["onchain-receipt"]} receipts, 0 persona, 0 reply.`, "Voice replaced by automation — restore the persona/reply cadence.");
  } else if (voiceShare < 0.4) {
    add("warn", "mix-low-voice", "Persona/reply share is low", `Last ${DAYS}d voice share ${(voiceShare * 100).toFixed(0)}% (persona ${mix.persona}, reply ${mix.reply}, receipts ${mix["onchain-receipt"]}).`, "Rebalance toward Sasha's voice; reduce automated-receipt dominance.");
  }
}

// --- 3 + 4: Buffer (read-only) ---------------------------------------------
let buffer = null;
if (USE_BUFFER) {
  const tok = process.env.BUFFER_ACCESS_TOKEN_SASHA_COIN || process.env.BUFFER_ACCESS_TOKEN;
  if (!tok) {
    add("warn", "buffer-no-token", "Buffer token not in env (queue read skipped)", "Set BUFFER_ACCESS_TOKEN(_SASHA_COIN) to enable the read-only queue check, or run on the VPS where it is present.", "Run with the env loaded (do not print the value).");
  } else {
    buffer = await readBuffer(tok);
    if (buffer.status === 200 && !buffer.errors) {
      // auth+endpoint healthy
    } else if (buffer.status === 401 || buffer.status === 403) {
      add("warn", "buffer-auth", "Buffer auth failed", `HTTP ${buffer.status} on api.buffer.com.`, "Refresh BUFFER_ACCESS_TOKEN_SASHA_COIN (do not echo the value).");
    } else if (buffer.status === 400 || buffer.errors) {
      add("fail", "buffer-schema", "Buffer GraphQL schema error", `HTTP ${buffer.status}; errors=${JSON.stringify(buffer.errorFields || buffer.errorMsg || "").slice(0, 160)}. Known removal: PostPublishingError.code (do NOT select it on the queue-read query).`, "Fix the queue-read query field selection per references/buffer-graphql.md (select message/__typename, not .code). Override via BUFFER_QUEUE_QUERY env.");
    } else {
      add("warn", "buffer-unknown", "Buffer returned non-200", `HTTP ${buffer.status}.`, "Inspect manually; this script only reads.");
    }
  }
}

async function readBuffer(tok) {
  const endpoint = "https://api.buffer.com";
  const out = { status: 0, errors: false, errorMsg: null, errorFields: null };
  // Reachability + auth probe (schema-independent, always valid GraphQL).
  try {
    const probe = await postGql(endpoint, tok, "query{ __typename }");
    out.status = probe.status;
    if (probe.json?.errors) { out.errors = true; out.errorMsg = probe.json.errors?.[0]?.message; }
  } catch (e) { out.status = -1; out.errorMsg = e.code || e.message?.slice(0, 60); return out; }

  // Optional queue read. The exact field selection drifts (PostPublishingError.code
  // was removed); externalize the query so ops can paste the current one without code edits.
  const queueQuery = process.env.BUFFER_QUEUE_QUERY || null;
  if (queueQuery && out.status === 200) {
    try {
      const q = await postGql(endpoint, tok, queueQuery);
      out.queueStatus = q.status;
      if (q.json?.errors) {
        out.errors = true;
        out.errorMsg = q.json.errors?.[0]?.message;
        out.errorFields = q.json.errors?.map((e) => e.path || e.message).slice(0, 4);
      } else {
        out.queue = summarizeQueue(q.json);
      }
    } catch (e) { out.errorMsg = e.code || e.message?.slice(0, 60); }
  }
  return out;
}
async function postGql(endpoint, tok, query) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
    body: JSON.stringify({ query }),
  });
  let json = null; try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}
function summarizeQueue(json) {
  // Best-effort: walk the response for objects with sentAt/dueAt/text.
  const posts = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (o.text && (o.sentAt || o.dueAt || o.createdAt)) posts.push({ text: String(o.text).slice(0, 120), sentAt: o.sentAt || null, dueAt: o.dueAt || null });
    for (const v of Object.values(o)) walk(v);
  })(json);
  const latestSent = posts.filter((p) => p.sentAt).map((p) => Date.parse(p.sentAt)).filter(Number.isFinite).sort().pop() || null;
  const mix = { persona: 0, "onchain-receipt": 0 };
  for (const p of posts) mix[classifyText(p.text)] = (mix[classifyText(p.text)] || 0) + 1;
  return { count: posts.length, latestSent, mix };
}

// Buffer sentAt vs posted-log divergence
if (buffer?.queue?.latestSent && newestMs) {
  const driftH = (buffer.queue.latestSent - newestMs) / 3.6e6;
  if (driftH > MAX_HEALTHY_GAP_H) {
    add("warn", "buffer-log-divergence", "Buffer is sending but posted-log is not updating", `Buffer latest sentAt is ${driftH.toFixed(1)}h newer than the newest posted-log entry.`, "The engine posts but does not persist artifacts — fix the posted-log write path.");
  }
}

// --- verdict ---------------------------------------------------------------
const hasFail = findings.some((f) => f.sev === "fail");
const hasWarn = findings.some((f) => f.sev === "warn");
const status = hasFail ? "broken" : hasWarn ? "degraded" : "healthy";

const report = {
  generated_at: new Date().toISOString(),
  status,
  window_days: DAYS,
  log_source: chosenLog.source,
  newest_artifact_age_hours: gapH !== null ? Number(gapH.toFixed(1)) : null,
  content_mix_recent: { total: totalRecent, ...mix, voice_share: voiceShare !== null ? Number(voiceShare.toFixed(2)) : null },
  buffer: buffer ? { status: buffer.status, schema_error: !!buffer.errors, queue: buffer.queue || null } : null,
  vps: vps || null,
  findings,
};

// write report artifacts (these are reports, not runtime/posting actions)
const day = report.generated_at.slice(0, 10);
const outDir = join(ROOT, "reports");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, `sasha-distribution-audit-${day}.json`);
const mdPath = join(outDir, `sasha-distribution-audit-${day}.md`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
writeFileSync(mdPath, renderMd(report));

function renderMd(r) {
  const icon = { ok: "🟢", warn: "🟡", fail: "🔴" };
  const sIcon = { healthy: "🟢 HEALTHY", degraded: "🟡 DEGRADED", broken: "🔴 BROKEN" };
  let m = `# Sasha Distribution Liveness Audit — ${r.generated_at}\n\n`;
  m += `**Status: ${sIcon[r.status]}**\n\n`;
  m += `- Log source: \`${r.log_source}\`\n- Newest artifact age: ${r.newest_artifact_age_hours ?? "n/a"}h\n- Content mix (last ${r.window_days}d): persona ${r.content_mix_recent.persona}, reply ${r.content_mix_recent.reply}, receipts ${r.content_mix_recent["onchain-receipt"]} (voice share ${r.content_mix_recent.voice_share ?? "n/a"})\n`;
  if (r.buffer) m += `- Buffer: HTTP ${r.buffer.status}${r.buffer.schema_error ? " ⚠ schema error" : " ok"}\n`;
  if (r.vps) m += `- VPS cron: post=${r.vps.hasPostCron} reply=${r.vps.hasReplyCron}\n`;
  m += `\n## Findings\n\n`;
  if (!r.findings.length) m += "No issues found.\n";
  for (const f of r.findings) m += `### ${icon[f.sev]} ${f.title} \`[${f.id}]\`\n${f.detail}\n\n**Fix:** ${f.fix}\n\n`;
  m += `\n---\n_Read-only audit. This script never posts, replies, deletes, archives, signs, or trades._\n`;
  return m;
}

// --- output ----------------------------------------------------------------
if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const sIcon = { healthy: "🟢 HEALTHY", degraded: "🟡 DEGRADED", broken: "🔴 BROKEN" };
  console.log(`\nSasha distribution liveness: ${sIcon[status]}\n`);
  console.log(`  log source        : ${chosenLog.source}`);
  console.log(`  newest artifact   : ${gapH !== null ? gapH.toFixed(1) + "h ago" : "n/a"}`);
  console.log(`  content mix (${DAYS}d) : persona ${mix.persona} | reply ${mix.reply} | receipts ${mix["onchain-receipt"]} (voice ${voiceShare !== null ? (voiceShare * 100).toFixed(0) + "%" : "n/a"})`);
  if (buffer) console.log(`  buffer            : HTTP ${buffer.status}${buffer.errors ? " ⚠ schema error" : ""}`);
  if (vps) console.log(`  vps cron          : post=${vps.hasPostCron} reply=${vps.hasReplyCron}`);
  console.log("");
  const icon = { ok: "🟢", warn: "🟡", fail: "🔴" };
  if (!findings.length) console.log("  No issues found.");
  for (const f of findings) {
    console.log(`  ${icon[f.sev]} [${f.id}] ${f.title}`);
    console.log(`     ${f.detail}`);
    console.log(`     fix: ${f.fix}`);
  }
  console.log(`\n  report: ${jsonPath}`);
  console.log(`          ${mdPath}\n`);
}

// exit code: 0 healthy, 1 degraded, 2 broken (for cron alerting). Never throws on findings.
process.exit(status === "broken" ? 2 : status === "degraded" ? 1 : 0);
