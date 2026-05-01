#!/usr/bin/env node
// STUB: Configure GA4 credentials for this project before wiring real calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const GA4_PROPERTY_ID = '__GA4_PROPERTY_ID__';

function empty(d) { return { period_days: d, totals: { sessions: 0, users: 0, new_users: 0, avg_engagement_time_sec: 0, bounce_rate: 0, conversions: 0 }, by_source: [], top_pages: [], by_device: [], by_country: [], funnel: { sessions: 0, engaged_sessions: 0, key_event: 0, secondary_event: 0 } }; }

const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  source: 'ga4 (stub)',
  ga4_property_id: GA4_PROPERTY_ID,
  periods: { 'trailing-7d': empty(7), 'trailing-30d': empty(30), 'trailing-90d': empty(90) },
  refresh_status: 'stub - configure project',
};

const outDir = path.join(ROOT, 'reports', 'snapshots');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `${snapshot.date}-traffic.json`), JSON.stringify(snapshot, null, 2));
console.log(`[stub] Traffic snapshot written. Configure GA4 to replace stub.`);
