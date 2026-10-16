#!/usr/bin/env node
/**
 * newsletter_qa.mjs - measured QA for ANY project's newsletter issue, against that project's newsletter-contract.json (2026-10-08).
 * Writes <pkg>/qa/verdict.json (schema newsletter-verdict/1). Exit 0 pass, 1 fail, 2 could not run. --offline never passes in V4.
 *
 *   node newsletter_qa.mjs --pkg <package> --contract <project>/_context/newsletter-contract.json [--offline]
 *
 * Reads <pkg>/issue.json (platform-neutral source of the issue) and <pkg>/issue.md (the reader text built from it):
 *   issue.json: { title, subject, preheader, send_at (ISO), lead: {decision, evidence, what_to_do}, radar: [{title, why_it_matters,
 *                 status, source, date}], tool, action, poll: {question, options[]}, share_line, ctas[], images: [{file, alt, ai?,
 *                 disclosure?, role}], sources[], hand_checked?: [{url, by, at}] (links behind a bot wall a person opened for this issue) }
 * Checks: blocks present, radar count, each radar item's status and age at the send slot, poll options, asks, share line length,
 * subject and preheader lengths, em dash, production text, forbidden CTA text, every link in issue.md live, hero image with alt,
 * AI disclosure. Blocks are the contract's (`structure`), so another project's newsletter needs only its own contract.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sha, check } from './creative_measure.mjs';

const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const pkg = resolve(arg('--pkg', '.'));
const contractPath = arg('--contract');
const offline = process.argv.includes('--offline');
if (!contractPath || !existsSync(contractPath)) { console.error('newsletter_qa: --contract <newsletter-contract.json> is required'); process.exit(2); }
const C = JSON.parse(readFileSync(contractPath, 'utf8'));
const jp = join(pkg, 'issue.json'), mp = join(pkg, 'issue.md');
if (!existsSync(jp) || !existsSync(mp)) { console.error('newsletter_qa: the package needs issue.json and issue.md: ' + pkg); process.exit(2); }
const I = JSON.parse(readFileSync(jp, 'utf8'));
const md = readFileSync(mp, 'utf8');
const S = C.structure, rows = [];
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const words = s => (String(s ?? '').match(/[\p{L}\p{N}][\p{L}\p{N}'’%.,-]*/gu) || []).length;
const pat = p => new RegExp(p, /[A-Z]/.test(p.replace(/\\[a-z]/g, '')) ? 'u' : 'iu');
const imgs0 = () => (Array.isArray(I.images) ? I.images : []);
const PRODUCTION = [/\bbriefing\b/i, /\bTODO\b/, /\bTBD\b/, /\[inserir/i, /antes da publica[cç][aã]o final/i, /ficha consultada/i, /<!--/];

// ---------- blocks ----------
const present = { lead_decision: norm(I.lead?.decision), evidence: norm(I.lead?.evidence), what_to_do_this_week: norm(I.lead?.what_to_do),
  radar: (I.radar || []).length, tool: norm(I.tool), action: norm(I.action), poll: norm(I.poll?.question), share_line: norm(I.share_line) };
for (const b of S.order) check(rows, `block_${b}`, !!present[b], present[b] ? `${b} present` : `${b} missing`);
const radar = Array.isArray(I.radar) ? I.radar : [];
check(rows, 'radar_count', radar.length >= S.radar.min_items && radar.length <= S.radar.max_items, `${radar.length} items; contract ${S.radar.min_items}-${S.radar.max_items}`);
const sendAt = Date.parse(I.send_at ?? '');
check(rows, 'send_at', Number.isFinite(sendAt), Number.isFinite(sendAt) ? `send at ${I.send_at}` : 'issue.json has no send_at (ISO, the contract slot)');
radar.forEach((it, i) => {
  const d = Date.parse(it?.date ?? ''), age = (sendAt - d) / 36e5;
  // a date after the send slot is a fact that has not happened yet, never fresh news
  check(rows, `radar_${i + 1}_fresh`, Number.isFinite(d) && Number.isFinite(sendAt) && age <= S.radar.max_age_hours && age >= -1,
    !Number.isFinite(d) ? `item ${i + 1} has no date` : age < -1 ? `dated ${Math.round(-age)}h after the send slot (${norm(it.title).slice(0, 60)})` : `${Math.round(age)}h old at the send slot; max ${S.radar.max_age_hours}h (${norm(it.title).slice(0, 60)})`);
  check(rows, `radar_${i + 1}_status`, (S.radar.status_values || []).includes(norm(it?.status).toLowerCase()), `status "${norm(it?.status)}"`);
  check(rows, `radar_${i + 1}_source`, /^https?:\/\//.test(String(it?.source ?? '')), it?.source ? `source ${it.source}` : 'no source');
});
const opts = Array.isArray(I.poll?.options) ? I.poll.options : [];
check(rows, 'poll_options', opts.length >= S.poll.min_options && opts.length <= S.poll.max_options, `${opts.length} options; contract ${S.poll.min_options}-${S.poll.max_options}`);
check(rows, 'share_line_words', words(I.share_line) <= S.share_line.max_words, `${words(I.share_line)} words; max ${S.share_line.max_words}`);
const asks = Array.isArray(I.ctas) ? I.ctas : [];
check(rows, 'asks', asks.length <= C.asks.max_asks && asks[0] === C.asks.primary, `asks ${JSON.stringify(asks)}; primary must be ${C.asks.primary}, max ${C.asks.max_asks}`);

// ---------- copy ----------
check(rows, 'subject', norm(I.subject).length > 0 && norm(I.subject).length <= C.copy.subject_max_chars, `${norm(I.subject).length} chars; max ${C.copy.subject_max_chars}`);
check(rows, 'preheader', norm(I.preheader).length >= C.copy.preheader_min_chars && norm(I.preheader).length <= C.copy.preheader_max_chars, `${norm(I.preheader).length} chars; contract ${C.copy.preheader_min_chars}-${C.copy.preheader_max_chars}`);
const all = [md, I.subject, I.preheader, I.title].join('\n');
if (C.copy.forbid_em_dash) check(rows, 'em_dash', !/—/.test(all), /—/.test(all) ? 'em dash in the issue' : 'no em dash');
const readerText = [md, I.subject, I.preheader, I.title, I.share_line, I.poll?.question, ...(Array.isArray(I.poll?.options) ? I.poll.options : []), ...imgs0().map(i => i.alt)].join('\n');
const leaks = PRODUCTION.filter(r => r.test(readerText)).map(String);
check(rows, 'production_text', leaks.length === 0, leaks.length ? `production text in what readers see: ${leaks.join(', ')}` : 'none');
const ctaHits = (C.cta?.forbidden_patterns || []).flatMap(p => { const m = all.match(pat(p)); return m ? [m[0]] : []; });
check(rows, 'cta_forbidden', ctaHits.length === 0, ctaHits.length ? `forbidden ask: ${ctaHits.join(', ')}` : 'none');
const mdText = md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
check(rows, 'decision_in_text', !!present.lead_decision && mdText.includes(norm(I.lead?.decision).slice(0, 40)), 'the lead decision appears in issue.md');

// ---------- images ----------
const imgs = Array.isArray(I.images) ? I.images : [];
if (C.images?.hero_required) check(rows, 'hero', imgs.some(i => i.role === 'hero'), imgs.some(i => i.role === 'hero') ? 'hero present' : 'no image with role "hero"');
const exportsMeta = [];
for (const im of imgs) {
  if (C.images?.alt_required) check(rows, 'image_alt', norm(im.alt).length > 0, `alt for ${im.file}: ${norm(im.alt).length} chars`);
  if (C.images?.disclosure_when_ai && im.ai) check(rows, 'image_disclosure', !!norm(im.disclosure), norm(im.disclosure) || `AI image without disclosure: ${im.file}`);
  if (!norm(im.file)) { check(rows, 'image_file', false, 'an image entry has no file'); continue; }
  const f = /^https?:/.test(im.file) ? null : resolve(pkg, im.file);
  if (f && existsSync(f)) { const b = readFileSync(f); exportsMeta.push({ file: im.file, sha256: sha(b), bytes: b.length }); }
  else if (f) check(rows, 'image_file', false, `image not in the package: ${im.file}`);
}
for (const f of ['issue.md', 'issue.json']) { const b = readFileSync(join(pkg, f)); exportsMeta.push({ file: f, sha256: sha(b), bytes: b.length }); }

// ---------- links ----------
const links = [...new Set(md.match(/https?:\/\/[^\s)"'<>\]]+/g) || [])];
if (!offline) {
  for (const u of links) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 content-qa-gate' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      // a bot wall (403/429) is not proof the reader's link works: it fails unless the contract lists the host as checked by hand
      const walled = r.status === 403 || r.status === 429;
      // scoped to THIS issue: issue.json hand_checked [{url, by, at}] names the exact link a person opened
      const hand = (I.hand_checked || []).find(h => h?.url === u && norm(h?.by) && norm(h?.at));
      const handChecked = walled && !!hand;
      check(rows, 'link_live', r.ok || handChecked, `HTTP ${r.status} ${u}${handChecked ? ` (opened by ${hand.by} at ${hand.at})` : walled ? ' (bot wall: not verified)' : ''}`, !handChecked);
    } catch (e) { check(rows, 'link_live', false, `fetch failed (${String(e.message).slice(0, 60)}) ${u}`); }
  }
}


// ---------- own-domain links (Gabriel 2026-10-08: every shared link points to our site unless specified) ----------
const OWN = C.links?.own_domain;
const ownHost = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
function ownDomainCheck(rows, urls, externalOk) {
  if (!OWN) return;
  const ok = new Set((Array.isArray(externalOk) ? externalOk : []).filter(x => x && (x.reason || '').trim()).map(x => x.url));
  const bad = [...new Set(urls)].filter(u => ownHost(u) !== OWN && !ok.has(u));
  check(rows, 'own_domain_links', bad.length === 0, bad.length ? `links outside ${OWN}: ${bad.slice(0, 4).join(', ')} (point to our page that covers it; external only with external_ok {url, reason})` : `every link on ${OWN}${ok.size ? ' or specified' : ''}`);
}
ownDomainCheck(rows, links, I.external_ok);

// ---------- verdict ----------
const failures = [...rows.filter(r => r.result === 'fail').map(r => `${r.id}: ${r.measurement}`), ...(offline ? ['offline run: links not verified, never valid for QA Passed'] : [])];
const v = { schema: 'newsletter-verdict/1', verdict: failures.length ? 'fail' : 'pass', generated_at: new Date().toISOString(), package: pkg, offline,
  contract: { path: resolve(contractPath), version: C.version, project: C.project, sha256: sha(readFileSync(contractPath)) },
  inputs: { title: norm(I.title), preheader: norm(I.preheader), subject: norm(I.subject), hashtags: [] },
  exports: exportsMeta, failures, checks: rows, links: links.length,
  note: 'Measured checks only. Read the issue as a subscriber would before QA Passed; the poll is checked again in the Substack draft before sending.' };
mkdirSync(join(pkg, 'qa'), { recursive: true });
writeFileSync(join(pkg, 'qa', 'verdict.json'), JSON.stringify(v, null, 2));
console.log(`newsletter_qa: ${v.verdict.toUpperCase()} (${failures.length} blocking, ${links.length} links) -> ${join(pkg, 'qa', 'verdict.json')}`);
failures.forEach(f => console.log('  FAIL ' + f));
rows.filter(c => c.result === 'warn').forEach(c => console.log(`  warn ${c.id}: ${c.measurement}`));
process.exit(failures.length ? 1 : 0);
