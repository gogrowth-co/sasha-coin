#!/usr/bin/env node
/**
 * contract_drift.mjs - finds numbers in a project's prose (context docs, desks, playbooks, routines) that contradict its format
 * contracts (2026-10-08). Root cause it guards: on 2026-10-08 the Thursday briefing wrote 1080x1080, 5-slide carousels because
 * style-guide.md still said "Instagram post 1080x1080" while carousel-contract.json says 1080x1350 and 6-10 slides.
 *
 *   node contract_drift.mjs --context <project>/_context [--also <dir> ...]
 *
 * For every <format>-contract.json with a canvas: any line that names the format's channel words and states a WxH size other
 * than the contract canvas is drift; for carousels, "N slides" outside slides.min..max is drift. Lines that point to the
 * contract ("contract", "contrato") are ignored. Exit 0 clean, 1 drift (one line per finding), 2 could not run.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const argv = process.argv.slice(2);
const ctx = argv[argv.indexOf('--context') + 1];
if (!ctx || !existsSync(ctx)) { console.error('contract_drift: --context <project>/_context is required'); process.exit(2); }
const extra = argv.flatMap((a, i) => (a === '--also' ? [argv[i + 1]] : [])).filter(Boolean);
const project = resolve(ctx, '..');
const WORDS = { carousel: /carrossel|carousel|instagram(?!.*\b(reels?|stories|story)\b)/i, pin: /pinterest|\bpins?\b/i, 'linkedin-post': /linkedin/i, 'newsletter-issue': /newsletter|substack/i };

const contracts = readdirSync(ctx).filter(f => f.endsWith('-contract.json')).map(f => {
  try { return JSON.parse(readFileSync(join(ctx, f), 'utf8')); }
  catch (e) { console.error(`contract_drift: cannot read ${f}: ${e.message}`); process.exit(2); }   // a broken contract is never "clean"
}).filter(c => WORDS[c.format]);
const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p);
  if (s.isDirectory()) { if (!/node_modules|\.git|backups?|archive/i.test(f)) walk(p); } else if (/\.md$/i.test(f)) files.push(p); } };
for (const d of [ctx, join(project, '_ops', 'strategy-os', 'playbooks'), ...extra]) if (existsSync(d)) walk(d);

const findings = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
    if (/contract|contrato/i.test(line)) return;
    for (const c of contracts) {
      if (!WORDS[c.format].test(line)) continue;
      if (c.canvas) {
        const want = `${c.canvas.width}x${c.canvas.height}`;
        for (const m of line.matchAll(/(\d{3,4})\s*[x×]\s*(\d{3,4})/g)) {
          const got = `${m[1]}x${m[2]}`;
          // only sizes in the format's own family (same width) are claims about this format; 1200x627 next to "LinkedIn" is another format
          if (got !== want && m[1] === String(c.canvas.width)) findings.push(`${relative(project, f)}:${n + 1}  ${c.format} size ${got}, contract ${want}`);
        }
      }
      if (c.slides) for (const m of line.matchAll(/(\d{1,2})\s*(slides?|páginas?|telas?)/gi)) {
        const k = Number(m[1]);
        if (k < c.slides.min || k > c.slides.max) findings.push(`${relative(project, f)}:${n + 1}  ${c.format} "${m[0]}", contract ${c.slides.min}-${c.slides.max} slides`);
      }
    }
  });
}
findings.forEach(x => console.log('DRIFT ' + x));
console.log(`contract_drift: ${findings.length ? findings.length + ' line(s) contradict a contract' : 'clean'} (${contracts.length} contracts, ${files.length} files)`);
process.exit(findings.length ? 1 : 0);
