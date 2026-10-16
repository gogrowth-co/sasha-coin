#!/usr/bin/env node
/**
 * linkedin_qa.mjs - measured QA for ANY project's LinkedIn post, against that project's linkedin-contract.json (2026-10-08).
 * Writes <pkg>/qa/verdict.json (schema linkedin-verdict/1). Exit 0 pass, 1 fail, 2 could not run. --offline never passes in V4.
 *
 *   node linkedin_qa.mjs --pkg <package> --contract <project>/_context/linkedin-contract.json [--offline]
 *
 * Reads <pkg>/post.json: { caption, link?, link_placement?, document?: {file, title}, images?: [{file, alt}], disclosure?, ai_image? }
 * Document pages are rendered by carousel-generator (generate.mjs --contract <linkedin-contract>): <pkg>/render/slide-NN.html are
 * measured with the same canvas checks as carousels and pins (creative_measure.mjs).
 * Checks: caption length, first line, ends on an ask (not on a bare link/hashtags), hashtags, em dash, production text,
 * forbidden CTA text, media kind and limits (one PDF with a title, or up to N images, never both; local file sizes/pages),
 * link (live; an own-site link must be an article or tool, never a hub), disclosure for AI images, page measurements.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { measureCanvas, sha, check, dims } from './creative_measure.mjs';
import { destinationChecker } from './destination.mjs';

const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const pkg = resolve(arg('--pkg', '.'));
const contractPath = arg('--contract');
const offline = process.argv.includes('--offline');
if (!contractPath || !existsSync(contractPath)) { console.error('linkedin_qa: --contract <linkedin-contract.json> is required'); process.exit(2); }
const postPath = join(pkg, 'post.json');
if (!existsSync(postPath)) { console.error('linkedin_qa: no post.json in ' + pkg); process.exit(2); }
const C = JSON.parse(readFileSync(contractPath, 'utf8'));
const post = JSON.parse(readFileSync(postPath, 'utf8'));
const P = C.post, M = C.media;
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const pat = p => new RegExp(p, /[A-Z]/.test(p.replace(/\\[a-z]/g, '')) ? 'u' : 'iu');
const rows = [], pageRows = [];
const caption = String(post.caption ?? '');
const PRODUCTION = [/\bbriefing\b/i, /\bTODO\b/, /\bTBD\b/, /\[inserir/i, /antes da publica[cç][aã]o final/i, /ficha consultada/i];

// ---------- text ----------
check(rows, 'caption_length', caption.length >= P.caption_min_chars && caption.length <= P.caption_max_chars, `${caption.length} chars; contract ${P.caption_min_chars}-${P.caption_max_chars}`);
const lines = caption.split('\n').map(l => l.trim()).filter(Boolean);
if (P.first_line_max_chars) check(rows, 'first_line', (lines[0] ?? '').length > 0 && (lines[0] ?? '').length <= P.first_line_max_chars, `${(lines[0] ?? '').length} chars in the first line; max ${P.first_line_max_chars}`);
const last = lines[lines.length - 1] ?? '';
if (P.forbid_ending_on_link_or_hashtags) check(rows, 'ending', !/^((https?:\/\/\S+|#[\p{L}\p{N}_]+)\s*)+$/u.test(last), /^((https?:\/\/\S+|#[\p{L}\p{N}_]+)\s*)+$/u.test(last) ? `ends on a bare link/hashtags: "${last.slice(0, 80)}"` : 'ends on text');
if (P.ask_required && C.cta?.kind_patterns) {
  const body = lines.filter(l => !/^((https?:\/\/\S+|#[\p{L}\p{N}_]+)\s*)+$/u.test(l)).slice(-2).join(' ');
  const kinds = (C.cta.allowed_kinds || []).filter(k => C.cta.kind_patterns[k] && pat(C.cta.kind_patterns[k]).test(body));
  check(rows, 'ask', kinds.length > 0, kinds.length ? `closes with a ${kinds.join('/')}` : `the last lines ask for nothing (${(C.cta.allowed_kinds || []).join(', ')})`);
}
const ctaHits = (C.cta?.forbidden_patterns || []).flatMap(p => { const m = caption.match(pat(p)); return m ? [m[0]] : []; });
check(rows, 'cta_forbidden', ctaHits.length === 0, ctaHits.length ? `forbidden text: ${ctaHits.join(', ')}` : 'none');
const tags = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase()));
check(rows, 'hashtags', tags.size >= C.hashtags.min && tags.size <= C.hashtags.max, `${tags.size} hashtags; contract ${C.hashtags.min}-${C.hashtags.max}`);
if (P.forbid_em_dash) check(rows, 'em_dash', !/—/.test(caption + (post.document?.title ?? '')), /—/.test(caption) ? 'em dash in the post' : 'no em dash');
const seen = [caption, post.document?.title ?? '', ...(Array.isArray(post.images) ? post.images : []).map(i => i?.alt ?? '')].join('\n');
const leaks = PRODUCTION.filter(r => r.test(seen)).map(String);
check(rows, 'production_text', leaks.length === 0, leaks.length ? `production text in the post, document title or alt: ${leaks.join(', ')}` : 'none');


// ---------- own-domain links (Gabriel 2026-10-08: every shared link points to our site unless specified) ----------
const OWN = C.links?.own_domain;
const ownHost = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
function ownDomainCheck(rows, urls, externalOk) {
  if (!OWN) return;
  const ok = new Set((Array.isArray(externalOk) ? externalOk : []).filter(x => x && (x.reason || '').trim()).map(x => x.url));
  const bad = [...new Set(urls)].filter(u => ownHost(u) !== OWN && !ok.has(u));
  check(rows, 'own_domain_links', bad.length === 0, bad.length ? `links outside ${OWN}: ${bad.slice(0, 4).join(', ')} (point to our page that covers it; external only with external_ok {url, reason})` : `every link on ${OWN}${ok.size ? ' or specified' : ''}`);
}
ownDomainCheck(rows, [...(caption.match(/https?:\/\/[^\s)\]]+/g) || []), ...(post.link ? [post.link] : [])], post.external_ok);

// ---------- media ----------
const doc = post.document, imgs = Array.isArray(post.images) ? post.images : [];
check(rows, 'media_present', !!doc || imgs.length > 0, doc ? 'document post' : imgs.length ? `${imgs.length} image(s)` : 'no document or image (the contract needs an informational visual)');
if (doc && imgs.length && !M.document_and_images_together) check(rows, 'media_mix', false, 'a document post carries nothing alongside it');
const kind = doc ? 'document' : imgs.length === 1 ? 'image' : imgs.length > 1 ? 'images' : 'text';
if (Array.isArray(P.kinds)) check(rows, 'post_kind', P.kinds.includes(kind), `${kind} post; contract allows ${P.kinds.join(', ')}${P._kinds_note ? ` (${P._kinds_note})` : ''}`);
const exportsMeta = [];
const local = f => f && !/^https?:\/\//.test(f) ? resolve(pkg, f) : null;
if (doc) {
  if (M.document_title_required) check(rows, 'document_title', !!norm(doc.title) && norm(doc.title).length <= (M.document_title_max_chars ?? 100), `title "${norm(doc.title)}" (${norm(doc.title).length} chars)`);
  const f = local(doc.file);
  if (f && existsSync(f)) {
    const b = readFileSync(f); const pages = (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    check(rows, 'document_size', b.length <= M.document_max_mb * 1048576, `${(b.length / 1048576).toFixed(1)} MB; max ${M.document_max_mb}`);
    check(rows, 'document_pages', pages > 0 && pages <= M.document_max_pages, `${pages} pages; max ${M.document_max_pages}`);
    exportsMeta.push({ file: f.replace(pkg + '/', ''), sha256: sha(b), bytes: b.length, pages });
  } else check(rows, 'document_file', false, `document not in the package: ${doc.file}`);
} else {
  check(rows, 'images_max', imgs.length <= M.images_max, `${imgs.length} images; max ${M.images_max}`);
  for (const im of imgs) {
    const f = local(im.file);
    check(rows, 'image_alt', norm(im.alt).length > 0, `alt for ${basename(String(im.file))}: ${norm(im.alt).length} chars`);
    if (f && existsSync(f)) { const b = readFileSync(f); exportsMeta.push({ file: f.replace(pkg + '/', ''), sha256: sha(b), bytes: b.length, ...dims(b) }); }
    else check(rows, 'image_file', false, `image not in the package: ${im.file}`);
  }
}
if (C.disclosure?.required_when_ai_image && post.ai_image) check(rows, 'disclosure', !!norm(post.disclosure), norm(post.disclosure) || 'AI image without disclosure');
for (const u of [doc?.public_url, ...imgs.map(i => i.public_url)].filter(Boolean)) {
  const bad = (M.forbid_url_hosts || []).filter(h => u.includes(h));
  check(rows, 'media_public_url', bad.length === 0, bad.length ? `media on a host Zernio cannot fetch (${bad.join(', ')}): ${u}` : `public: ${u}`);
}

// ---------- link ----------
if (post.link || C.destination?.required) {   // a contract that requires a destination fails a post without one
  const dest = destinationChecker(C.destination, { offline });
  try { await dest.load(); } catch (e) { console.error('linkedin_qa: sitemaps unreadable: ' + e.message); }
  await dest.checkUrl(rows, post.link || null);
}
if (post.link && C.link?.placement_options) check(rows, 'link_placement', C.link.placement_options.includes(post.link_placement ?? C.link.placement_default), `placement ${post.link_placement ?? C.link.placement_default}`);

// ---------- document pages (deterministic render) ----------
const renderDir = join(pkg, 'render');
const pages = existsSync(renderDir) ? readdirSync(renderDir).filter(f => /^slide-\d+\.html$/.test(f)).sort() : [];
if (doc) check(rows, 'pages_rendered', pages.length > 0, pages.length ? `${pages.length} rendered pages measured` : 'no render/slide-NN.html (render the document with carousel-generator)');
if (pages.length) {
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.error('linkedin_qa: cannot launch Chromium: ' + e.message); process.exit(2); }
  for (const f of pages) {
    const r = await measureCanvas(browser, join(renderDir, f), C.canvas.width, C.canvas.height, C.visual);
    pageRows.push({ page: f, checks: r.rows, contrast_min: r.contrastMin });
  }
  await browser.close();
}

// ---------- verdict ----------
const failures = [...rows.filter(r => r.result === 'fail').map(r => `${r.id}: ${r.measurement}`),
  ...pageRows.flatMap(p => p.checks.filter(c => c.result === 'fail').map(c => `${p.page} ${c.id}: ${c.measurement}`)),
  ...(offline ? ['offline run: link not verified, never valid for QA Passed'] : [])];
const v = { schema: 'linkedin-verdict/1', verdict: failures.length ? 'fail' : 'pass', generated_at: new Date().toISOString(), package: pkg, offline,
  contract: { path: resolve(contractPath), version: C.version, project: C.project, sha256: sha(readFileSync(contractPath)) },
  inputs: { caption: norm(caption), link: post.link ?? '', hashtags: [...tags], document_title: doc?.title ?? null },
  exports: exportsMeta, failures, checks: rows, pages: pageRows,
  note: 'Measured checks only. Read the post and look at every page before QA Passed.' };
mkdirSync(join(pkg, 'qa'), { recursive: true });
writeFileSync(join(pkg, 'qa', 'verdict.json'), JSON.stringify(v, null, 2));
console.log(`linkedin_qa: ${v.verdict.toUpperCase()} (${failures.length} blocking) -> ${join(pkg, 'qa', 'verdict.json')}`);
failures.forEach(f => console.log('  FAIL ' + f));
[...rows, ...pageRows.flatMap(p => p.checks)].filter(c => c.result === 'warn').forEach(c => console.log(`  warn ${c.id}: ${c.measurement}`));
process.exit(failures.length ? 1 : 0);
