#!/usr/bin/env node
// STUB: Configure GSC + GA4 credentials for this project before wiring real calls.
// Writes a shape-correct empty snapshot so the dashboard renders.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const GA4_PROPERTY_ID = '__GA4_PROPERTY_ID__';
const SITE = '__GSC_SITE__';
const CONVERSION_EVENTS = [];

function emptyGsc(d) { return { period_days: d, totals: { impressions: 0, clicks: 0, ctr: 0, position: 0 }, by_query: [], by_page: [], indexing_issues: [] }; }
function emptyGa4(d) { return { period_days: d, by_page: [], conversion_events_present: CONVERSION_EVENTS.map(e => ({ name: e, present: null })) }; }

const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  source: 'gsc + ga4 (stub)',
  site: SITE,
  ga4_property_id: GA4_PROPERTY_ID,
  conversion_events_tracked: CONVERSION_EVENTS,
  periods: { 'trailing-7d': { gsc: emptyGsc(7), ga4: emptyGa4(7) }, 'trailing-30d': { gsc: emptyGsc(30), ga4: emptyGa4(30) }, 'trailing-90d': { gsc: emptyGsc(90), ga4: emptyGa4(90) } },
  refresh_status: 'stub - configure project',
};

const outDir = path.join(ROOT, 'reports', 'snapshots');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `${snapshot.date}-seo.json`), JSON.stringify(snapshot, null, 2));
console.log(`[stub] SEO snapshot written. Configure GSC/GA4 to replace stub.`);
