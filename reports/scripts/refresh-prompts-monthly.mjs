#!/usr/bin/env node
// STUB: Create per-ICP prompt source files for this project, then replace this stub
// with a real engine runner (see marketing/reports/scripts/refresh-prompts-monthly.mjs).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  total_cost_usd: 0,
  icps: [],
  full: [],
  refresh_status: 'stub - configure ICP prompt source files',
};

const outDir = path.join(ROOT, 'reports', 'snapshots');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `${snapshot.date}-prompts-monthly.json`), JSON.stringify(snapshot, null, 2));
console.log(`[stub] Monthly prompts snapshot written. Configure per-ICP prompt sources to populate.`);
