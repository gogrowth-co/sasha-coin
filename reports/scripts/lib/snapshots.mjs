import fs from 'node:fs/promises';
import path from 'node:path';

// File naming convention: YYYY-MM-DD-<kind>.json (e.g. 2026-04-27-seo.json)
const NAME_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.json$/;

export async function readLatestSnapshot(dir, kind) {
  const all = await listSnapshots(dir, kind);
  if (all.length === 0) return null;
  return JSON.parse(await fs.readFile(path.join(dir, all[all.length - 1].file), 'utf8'));
}

export async function readRecentSnapshots(dir, kind, n) {
  const all = await listSnapshots(dir, kind);
  const recent = all.slice(-n);
  const out = [];
  for (const { file } of recent) {
    out.push(JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')));
  }
  return out;
}

async function listSnapshots(dir, kind) {
  let files = [];
  try { files = await fs.readdir(dir); } catch { return []; }
  return files
    .map(f => ({ file: f, match: NAME_RE.exec(f) }))
    .filter(x => x.match && x.match[2] === kind)
    .map(x => ({ file: x.file, date: x.match[1] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeDelta(current, prior) {
  const abs = current - prior;
  const direction = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  const pct = prior === 0 ? null : Math.round((abs / prior) * 100);
  return { abs, pct, direction };
}
