#!/usr/bin/env node
// STUB: Create seo/target-keywords.json for this project, then replace this stub
// with a real YepAPI runner (see marketing/reports/scripts/refresh-keywords.mjs as reference).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  source: 'yepapi-google-serp + gsc (stub)',
  target_domain: '__TARGET_DOMAIN__',
  keywords_tested: 0,
  errors: 0,
  estimated_cost_usd: 0,
  cost_per_call_usd: 0.01,
  elapsed_seconds: 0,
  gsc_queries: [],
  target_tracking: [],
  refresh_status: 'stub - configure seo/target-keywords.json',
};

const outDir = path.join(ROOT, 'reports', 'snapshots');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `${snapshot.date}-keywords.json`), JSON.stringify(snapshot, null, 2));
console.log(`[stub] Keywords snapshot written. Create seo/target-keywords.json to populate.`);
