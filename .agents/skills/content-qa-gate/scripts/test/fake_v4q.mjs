#!/usr/bin/env node
// Test double for v4q (2026-10-14): answers `gsc` and `list` from the JSON fixture in $FAKE_V4Q; logs every call to $FAKE_V4Q_LOG.
// Fixture: { gsc: { "<dims>": rows, "<dims>@<start>": rows }, lists: { "<collection>": records } }. `--contains page=X` keeps rows
// whose page contains X (substring, like Search Console "contains").
import { appendFileSync, readFileSync } from 'node:fs';
const a = process.argv.slice(2);
if (process.env.FAKE_V4Q_LOG) appendFileSync(process.env.FAKE_V4Q_LOG, JSON.stringify(a) + '\n');
const fx = JSON.parse(readFileSync(process.env.FAKE_V4Q, 'utf8'));
const flag = k => { const i = a.indexOf(k); return i > -1 ? a[i + 1] : undefined; };
if (a[0] === 'gsc') {
  const dims = flag('--dimensions') || 'query', start = flag('--start');
  let rows = (start && fx.gsc[`${dims}@${start}`]) || fx.gsc[dims] || [];
  const c = flag('--contains');
  if (c) { const [dim, ...rest] = c.split('='); const x = rest.join('='); rows = rows.filter(r => String(r[dim] ?? '').includes(x)); }
  console.log(JSON.stringify({ ok: true, site: 'fake', start: start || fx.start || '2026-07-16', end: flag('--end') || fx.end || '2026-10-12', count: rows.length, rows }));
} else if (a[0] === 'list') {
  const recs = fx.lists?.[a[1]] || [];
  const off = Number(flag('--offset') || 0), lim = Number(flag('--limit') || 200);
  console.log(JSON.stringify({ records: recs.slice(off, off + lim), has_more: off + lim < recs.length, next_offset: off + lim }));
} else { console.error(`fake v4q: unsupported ${a[0]}`); process.exit(1); }
