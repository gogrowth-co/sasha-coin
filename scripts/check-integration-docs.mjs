#!/usr/bin/env node
// check-integration-docs.mjs
// Docs-freshness watchdog for docs/integrations/registry.json.
// Verifies every docs_url + llms_url returns 200 and (optionally) hashes the
// page title + body so silent doc rewrites are detected on the next run.
//
// Read-only. Makes only GET requests to PUBLIC documentation URLs.
// Never reads .env, never prints secret values. Deterministic output (sorted).
//
// Usage:
//   node scripts/check-integration-docs.mjs                 # check all URLs
//   node scripts/check-integration-docs.mjs --only signal-data
//   node scripts/check-integration-docs.mjs --hash          # update/diff content hashes
//   node scripts/check-integration-docs.mjs --json          # machine-readable output
//   node scripts/check-integration-docs.mjs --timeout 15000
//
// Owner skill: sasha-ops-hardening

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REGISTRY = join(ROOT, "docs/integrations/registry.json");
const HASH_SIDECAR = join(ROOT, "docs/integrations/.docs-hashes.json");

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const DO_HASH = flag("--hash");
const AS_JSON = flag("--json");
const ONLY = opt("--only", null);
const TIMEOUT = parseInt(opt("--timeout", "15000"), 10);

if (!existsSync(REGISTRY)) {
  console.error(`ERROR: registry not found at ${REGISTRY}`);
  process.exit(2);
}

const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
const prevHashes = DO_HASH && existsSync(HASH_SIDECAR)
  ? JSON.parse(readFileSync(HASH_SIDECAR, "utf8"))
  : {};

// Collect (integration, kind, url) tuples, de-duplicated and sorted for determinism.
const urlSet = new Map(); // url -> { url, owners:Set, kinds:Set }
for (const itg of registry.integrations || []) {
  if (ONLY && itg.category !== ONLY) continue;
  for (const kind of ["docs_url", "llms_url"]) {
    const url = itg[kind];
    if (!url) continue;
    if (!urlSet.has(url)) urlSet.set(url, { url, owners: new Set(), kinds: new Set() });
    urlSet.get(url).owners.add(itg.name);
    urlSet.get(url).kinds.add(kind);
  }
}
const targets = [...urlSet.values()].sort((a, b) => a.url.localeCompare(b.url));

function sha256(s) { return createHash("sha256").update(s).digest("hex").slice(0, 16); }
function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : null;
}

async function probe(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const out = { url, status: 0, ok: false, titleHash: null, bodyHash: null, title: null, error: null };
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "sasha-docs-check/1.0 (+integration-registry)" },
    });
    out.status = res.status;
    out.ok = res.ok;
    if (DO_HASH && res.ok) {
      const body = await res.text();
      out.title = extractTitle(body);
      out.titleHash = out.title ? sha256(out.title) : null;
      out.bodyHash = sha256(body.replace(/\s+/g, " ").trim());
    }
  } catch (e) {
    out.error = e.name === "AbortError" ? "timeout" : (e.code || e.message?.slice(0, 60) || "fetch_error");
  } finally {
    clearTimeout(timer);
  }
  return out;
}

const results = [];
for (const t of targets) {
  const r = await probe(t.url);
  r.owners = [...t.owners].sort();
  r.kinds = [...t.kinds].sort();
  if (DO_HASH) {
    const prev = prevHashes[t.url];
    if (prev && r.bodyHash && prev.bodyHash && prev.bodyHash !== r.bodyHash) {
      r.drift = true;
      r.prevBodyHash = prev.bodyHash;
    } else {
      r.drift = false;
    }
  }
  results.push(r);
}

// Persist hashes (only when --hash); store no secrets, only URL->hash maps.
if (DO_HASH) {
  const next = {};
  for (const r of results) {
    if (r.ok && r.bodyHash) next[r.url] = { titleHash: r.titleHash, bodyHash: r.bodyHash, status: r.status };
    else if (prevHashes[r.url]) next[r.url] = prevHashes[r.url];
  }
  writeFileSync(HASH_SIDECAR, JSON.stringify(next, null, 2) + "\n");
}

const dead = results.filter((r) => !r.ok);
const drifted = results.filter((r) => r.drift);

if (AS_JSON) {
  console.log(JSON.stringify({
    checked: results.length,
    dead: dead.length,
    drifted: drifted.length,
    results: results.map(({ url, status, ok, error, drift, titleHash, owners }) => ({ url, status, ok, error: error || null, drift: !!drift, titleHash: titleHash || null, owners })),
  }, null, 2));
} else {
  console.log(`Docs registry check — ${results.length} URL(s)${ONLY ? ` [category=${ONLY}]` : ""}${DO_HASH ? " [hashing]" : ""}\n`);
  for (const r of results) {
    const tag = r.ok ? "OK  " : "DEAD";
    const drift = r.drift ? "  ⚠ CONTENT DRIFT" : "";
    const err = r.error ? ` (${r.error})` : "";
    console.log(`  [${tag}] ${r.status || "---"} ${r.url}${err}${drift}`);
    if (!r.ok || r.drift) console.log(`         owners: ${r.owners.join(", ")}`);
  }
  console.log(`\nSummary: ${results.length - dead.length}/${results.length} reachable, ${dead.length} dead, ${drifted.length} drifted.`);
  if (dead.length) console.log("Action: update docs_url/llms_url in docs/integrations/registry.json for dead links (run via sasha-ops-hardening).");
}

// Non-zero exit only on dead links so this can gate CI / a cron health check.
process.exit(dead.length ? 1 : 0);
