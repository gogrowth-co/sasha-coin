#!/usr/bin/env node
/**
 * brief_gate.mjs - QA BEFORE production, for any format and any project (2026-10-08). Zero model calls.
 * Judges a commission's brief (Payload JSON) against the format's project contract, so a brief that cannot pass the measured
 * QA after production (carousel_qa, pin_qa, newsletter, LinkedIn) is fixed at pitch time instead of being produced and redone.
 *
 *   node brief_gate.mjs --contract <project>/_context/<format>-contract.json (--payload <brief.json> | --commission <v4q id>)
 *                       [--out <dir>] [--offline]
 *
 * What it reads from the contract is declared there, in a `brief` block, so the engine has no per-project or per-format code:
 *   brief.text_fields         payload fields that carry reader-facing copy (em dash, banned topics, forbidden CTA text)
 *   brief.copy_list           array of slide/page/pin copy; its length is judged against brief.copy_count (or slides.min/max)
 *   brief.cover_index         index of the cover inside copy_list (word cap copy.cover_max_words, the rest copy.slide_max_words)
 *   brief.cta_field           the brief's call to action, judged against cta.forbidden_patterns / cta.allowed_kinds / kind_patterns
 *   brief.dimensions_field    free text whose WxH sizes must equal the contract canvas
 *   brief.claims_field        claim ledger: every claim needs a value and an http(s) source
 *   brief.sources_fields      source URLs: must answer (403/429 from bot walls is a warning, 404/410/5xx fail)
 *   brief.destination_field   destination URL(s), judged with the contract's `destination` policy (content-qa-gate/destination.mjs)
 *   brief.items_field         per-item specs (pins): count = group.size; hook words <= copy.overlay_max_words; alt >= copy.alt_min_chars;
 *                             distinct hooks; when group.distinct_destinations, each item needs its own valid destination
 *   brief.board_field         board, in the project's allowlist (contract.board)
 *   brief.required_fields     fields that must be present and non-empty (e.g. poll for a newsletter)
 *   brief.max_ctas            the most asks one piece may carry (brief.ctas_field holds the list)
 *   brief.list_counts         { field: [min, max] } array lengths (e.g. newsletter radar of 3 news)
 *   brief.uniqueness_field    the duplicate check must be present and not Unverified (self-declared; the measured check is below)
 *   inventory (2026-10-09)    measured repeat check against the project inventory (inventory.mjs: site, CE, pitches, live posts):
 *                             overlap >= fail_at fails; a destination posted on the channel within destination_repeat_days fails
 *   destination relevance     a destination sharing no subject word with the pitch is a missing destination (open its brief)
 *   article_type              resolved through the article contract and its aliases; requires_price_ledger types need a PASS
 *                             price ledger (price_research.mjs); requires_destination types need a live tool page
 *   brief.freshness           { field, date_key, max_age_hours, relative_to }: each item dated, and no older than the limit at the slot
 *   strategy (2026-10-08)     <ctx>/desk-rules.json for the contract's desk (contract.desk, else its channel): the brief's `pillar` must be one
 *                             of the desk's pillars, no banned topic, no banned article type (unless decision_angle)
 *   judge (2026-10-13)        --judge or BRIEF_JUDGE=1: once every field check passes, an open model (brief_judge.mjs) judges meaning: the
 *                             pillar fits the desk, and a repair (regression_id) restores what its regression lost. pass false fails the
 *                             gate ("judge: <reason>"); unavailable never blocks and never passes silently (WARN, verdict.judge.reason)
 *   brief.own_domain_fields   paths ("tool", "radar[].link", "lead.link") whose links must be on links.own_domain (Gabriel 2026-10-08: every
 *                             shared link points to our site unless the brief names external_link_reason); a missing or pending page is a
 *                             missing_destination (the briefing opens its commission and blocks publishing until it is live)
 * Writes <out>/qa/brief-verdict.json (schema brief-verdict/1) with `missing_destinations` (URLs or angles that need a site
 * article first: the briefing turns each into a required Website commission). Exit 0 pass, 1 fail, 2 could not run.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { sha, check } from './creative_measure.mjs';
import { destinationChecker, plain } from './destination.mjs';
import { loadInventory, matches, overlap, tokens } from './inventory.mjs';
import { judgeGate } from './brief_judge.mjs';

const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const contractPath = arg('--contract');
const offline = process.argv.includes('--offline');
if (!contractPath || !existsSync(contractPath)) { console.error('brief_gate: --contract <format-contract.json> is required'); process.exit(2); }
const C = JSON.parse(readFileSync(contractPath, 'utf8'));
const B = C.brief;
if (!B) { console.error(`brief_gate: ${contractPath} has no "brief" block (declare which brief fields this format judges)`); process.exit(2); }
const projectRoot = resolve(dirname(contractPath), '..');

let payload, commission = null;
try {
  if (arg('--payload')) payload = JSON.parse(readFileSync(arg('--payload'), 'utf8'));
  else if (arg('--commission')) {
    const out = JSON.parse(execFileSync(process.env.V4Q_BIN || (existsSync(join(homedir(), '.local/bin/v4q')) ? join(homedir(), '.local/bin/v4q') : 'v4q'), ['get', arg('--commission')], { encoding: 'utf8' }));
    commission = { id: out.record.id, version: out.record.version, title: out.record.props.Commission || '' };
    const p = out.record.props['Payload JSON'];
    payload = typeof p === 'string' ? JSON.parse(p) : p;
  } else { console.error('brief_gate: --payload <file> or --commission <id> is required'); process.exit(2); }
} catch (e) { console.error('brief_gate: cannot read the brief: ' + e.message); process.exit(2); }
if (!payload || typeof payload !== 'object') { console.error('brief_gate: the brief has no Payload JSON object'); process.exit(2); }

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const flat = x => Array.isArray(x) ? x.map(flat).join(' \n ') : x && typeof x === 'object' ? Object.values(x).map(flat).join(' \n ') : String(x ?? '');
const words = s => (String(s ?? '').match(/[\p{L}\p{N}][\p{L}\p{N}'’%.,-]*/gu) || []).length;
const pat = p => new RegExp(p, /[A-Z]/.test(p.replace(/\\[a-z]/g, '')) ? 'u' : 'iu');
const urlsIn = x => [...new Set(flat(x).match(/https?:\/\/[^\s"'<>)\]]+/g) || [])];
const rows = [];
const missing_destinations = [];

// ---------- copy ----------
const text = (B.text_fields || []).map(f => flat(payload[f])).join(' \n ');
if (C.copy?.forbid_em_dash || C.caption?.forbid_em_dash) check(rows, 'em_dash', !/—/.test(text), /—/.test(text) ? 'em dash in the brief copy' : 'no em dash');
const banned = (C.topics?.banned_on_channel || []).filter(t => new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(text));
if (C.topics) check(rows, 'topic_allowed', banned.length === 0, banned.length ? `topic banned on ${C.channel} (${banned.join(', ')})${C.topics.route_to ? '; route to ' + C.topics.route_to : ''}` : 'no banned topic');
for (const [f, want] of Object.entries(B.topic_required || {})) {
  const ok = new RegExp(want, 'iu').test(flat(payload[f]));
  check(rows, `topic_${f}`, ok, ok ? `${f} matches ${want}` : `${f} must match ${want}`);
}
if (B.copy_list) {
  const list = Array.isArray(payload[B.copy_list]) ? payload[B.copy_list] : [];
  const [min, max] = B.copy_count || [C.slides?.min, C.slides?.max];
  if (min != null) check(rows, 'copy_count', list.length >= min && list.length <= max, `${list.length} ${B.copy_list} items; contract ${min}-${max}`);
  list.forEach((item, i) => {
    const cap = i === (B.cover_index ?? 0) ? C.copy?.cover_max_words : C.copy?.slide_max_words;
    if (cap) check(rows, `copy_words_${i + 1}`, words(flat(item)) <= cap, `${B.copy_list}[${i}]: ${words(flat(item))} words; max ${cap}`);
  });
}
for (const f of B.required_fields || []) {
  const v = payload[f]; const ok = v != null && norm(flat(v)) !== '';
  check(rows, `required_${f}`, ok, ok ? `${f} present` : `${f} missing from the brief`);
}
for (const [f, [min, max]] of Object.entries(B.list_counts || {})) {
  const n = Array.isArray(payload[f]) ? payload[f].length : 0;
  check(rows, `count_${f}`, n >= min && n <= max, `${n} ${f}; contract ${min}-${max}`);
}

// ---------- call to action ----------
if (B.cta_field) {
  const cta = flat(payload[B.cta_field]);
  const hits = (C.cta?.forbidden_patterns || []).flatMap(p => { const m = cta.match(pat(p)); return m ? [m[0]] : []; });
  check(rows, 'cta_forbidden', hits.length === 0, hits.length ? `forbidden CTA text: ${hits.join(', ')} in "${norm(cta).slice(0, 120)}"` : 'none');
  if (C.cta?.allowed_kinds && C.cta?.kind_patterns) {
    const kinds = Object.entries(C.cta.kind_patterns).filter(([, p]) => pat(p).test(cta)).map(([k]) => k);
    const ok = kinds.some(k => C.cta.allowed_kinds.includes(k));
    check(rows, 'cta_kind', ok, ok ? `CTA kind ${kinds.join('/')}` : `CTA "${norm(cta).slice(0, 80)}" is none of ${C.cta.allowed_kinds.join(', ')}`);
  }
}
if (B.ctas_field && B.max_ctas != null) {
  const n = Array.isArray(payload[B.ctas_field]) ? payload[B.ctas_field].length : (payload[B.ctas_field] ? 1 : 0);
  check(rows, 'one_ask', n <= B.max_ctas, `${n} asks; max ${B.max_ctas} (${flat(payload[B.ctas_field]).slice(0, 120)})`);
}

// ---------- visual spec ----------
if (B.dimensions_field && C.canvas) {
  const sizes = [...flat(payload[B.dimensions_field]).matchAll(/(\d{3,4})\s*[x×]\s*(\d{3,4})/g)].map(m => `${m[1]}x${m[2]}`);
  const want = `${C.canvas.width}x${C.canvas.height}`;
  const off = sizes.filter(s => s !== want);
  check(rows, 'canvas', off.length === 0, sizes.length ? (off.length ? `brief asks ${off.join(', ')}; contract canvas ${want}` : `${want}`) : `no size in the brief; contract ${want}`, sizes.length > 0);
}

// ---------- evidence ----------
if (B.claims_field) {
  const claims = Array.isArray(payload[B.claims_field]) ? payload[B.claims_field] : [];
  const bad = claims.filter(c => !norm(c?.value) || !/^https?:\/\//.test(String(c?.source ?? '')));
  check(rows, 'claims_sourced', bad.length === 0, bad.length ? `${bad.length} claim(s) without value or http source` : `${claims.length} claims, each with a source`);
}
const sourceUrls = (B.sources_fields || []).flatMap(f => urlsIn(payload[f]));
if (!offline) {
  for (const u of sourceUrls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 content-qa-gate' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      check(rows, 'source_live', r.ok || r.status === 403 || r.status === 429, `HTTP ${r.status} ${u}`, !(r.status === 403 || r.status === 429) && !r.ok);
    } catch (e) { check(rows, 'source_live', false, `fetch failed (${String(e.message).slice(0, 60)}) ${u}`, false); }
  }
} else if (sourceUrls.length) check(rows, 'source_live', false, `${sourceUrls.length} sources not checked (--offline)`, false);
if (B.uniqueness_field) {
  const u = norm(flat(payload[B.uniqueness_field]));
  check(rows, 'uniqueness', !!u && !/^unverified/i.test(u) && !/^unverified/i.test(norm(payload.decision)), u ? u.slice(0, 120) : 'no duplicate/uniqueness check in the brief');
}

// ---------- destinations, board, items ----------
const dest = C.destination ? destinationChecker(C.destination, { offline }) : null;
if (dest) { try { await dest.load(); } catch (e) { console.error('brief_gate: sitemaps unreadable: ' + e.message); } }
const destOf = x => (urlsIn(x)[0] ?? null);
const topDest = B.destination_field ? destOf(payload[B.destination_field]) : null;
if (dest && B.destination_field && !B.items_field) {
  const r = []; const ok = await dest.checkUrl(r, topDest); rows.push(...r);
  if (!ok) missing_destinations.push({ angle: norm(payload.hook || payload.title || payload.promise).slice(0, 140), url: topDest });
}
if (B.board_field && C.board) {
  let boards = null;
  try { let o = JSON.parse(readFileSync(join(projectRoot, C.board.allowlist_file), 'utf8')); for (const k of C.board.allowlist_path.split('.')) o = o?.[k];
    boards = Object.entries(o || {}).flatMap(([slug, b]) => [slug.toLowerCase(), String(b?.name ?? '').toLowerCase()]); } catch {}
  const b = norm(payload[B.board_field]).toLowerCase();
  check(rows, 'board', !!boards && boards.includes(b), boards ? `${payload[B.board_field] || '(none)'}${boards.includes(b) ? '' : ' is not in ' + C.board.allowlist_file}` : `allowlist unreadable: ${C.board.allowlist_file}`);
}
if (B.items_field) {
  const items = Array.isArray(payload[B.items_field]) ? payload[B.items_field] : [];
  if (C.group?.size) check(rows, 'items_count', items.length === C.group.size, `${items.length} items; group size ${C.group.size}`);
  const hooks = items.map(i => norm(i.hook).toLowerCase()).filter(Boolean);
  if (C.group?.distinct_angles) check(rows, 'distinct_angles', new Set(hooks).size === hooks.length && hooks.length === items.length, `${new Set(hooks).size} distinct hooks of ${items.length}`);
  items.forEach((it, i) => {
    if (C.copy?.overlay_max_words) check(rows, `item_${i + 1}_hook_words`, words(it.hook) <= C.copy.overlay_max_words, `"${norm(it.hook)}": ${words(it.hook)} words; max ${C.copy.overlay_max_words}`);
    if (C.copy?.alt_min_chars) check(rows, `item_${i + 1}_alt`, norm(it.alt).length >= C.copy.alt_min_chars, `alt ${norm(it.alt).length} chars; min ${C.copy.alt_min_chars}`);
  });
  if (dest) {
    const urls = items.map(it => destOf(it.destination ?? it.destination_url) ?? topDest);
    const seen = new Map();
    for (let i = 0; i < items.length; i++) {
      const u = urls[i], r = [];
      const ok = await dest.checkUrl(r, u);
      rows.push(...r.map(x => ({ ...x, id: `item_${i + 1}_${x.id}` })));
      const dup = u && seen.has(plain(u));
      if (C.group?.distinct_destinations && dup) check(rows, `item_${i + 1}_distinct_destination`, false, `same destination as item ${seen.get(plain(u)) + 1}: ${u}`);
      if (u && !dup) seen.set(plain(u), i);
      if (!ok || (C.group?.distinct_destinations && dup)) missing_destinations.push({ item: i + 1, angle: norm(items[i].hook), url: dup ? null : u, reason: dup ? 'shares a destination; needs its own article' : 'destination not a live article' });
    }
  }
}

// ---------- freshness (news radar) ----------
if (B.freshness) {
  const F = B.freshness, items = Array.isArray(payload[F.field]) ? payload[F.field] : [];
  const when = x => { const t = String(x ?? '').trim(); const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return br ? Date.parse(`${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}T12:00:00-03:00`) : Date.parse(t); };
  const ref = Number.isFinite(when(payload[F.relative_to])) ? when(payload[F.relative_to]) : Date.now();
  items.forEach((it, i) => {
    const d = when(it?.[F.date_key]);
    const age = (ref - d) / 36e5;
    // a date after the slot is a fact that has not happened yet (Gap/Hold), never fresh news
    check(rows, `fresh_${F.field}_${i + 1}`, Number.isFinite(d) && age <= F.max_age_hours && age >= -1,
      !Number.isFinite(d) ? `item ${i + 1} has no ${F.date_key}` : age < -1 ? `dated ${Math.round(-age)}h after the slot: a future fact is not news (${norm(it?.title).slice(0, 60)})`
        : `${Math.round(age)}h old at ${new Date(ref).toISOString().slice(0, 16)}; max ${F.max_age_hours}h (${norm(it?.title).slice(0, 60)})`);
  });
}

// ---------- own-domain links (every shared link points to the project's site) ----------
const OWN = C.links?.own_domain;
if (OWN && B.own_domain_fields) {
  const host = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
  const allowedExternal = new Set([...(Array.isArray(payload.external_ok) ? payload.external_ok.map(x => x?.url ?? x) : [])]);
  const hasReason = !!norm(payload.external_link_reason);
  const at = (obj, path) => path.split('.').reduce((acc, seg) => acc.flatMap(o => {
    if (seg.endsWith('[]')) { const v = o?.[seg.slice(0, -2)]; return Array.isArray(v) ? v : []; }
    return o && o[seg] !== undefined ? [o[seg]] : [];
  }), [obj]);
  for (const path of B.own_domain_fields) {
    // "radar[].link": one value per radar item (a missing link is a failure, not a skip); "tool": the single value
    let list;
    if (path.endsWith('[]')) {   // "internal_links[]": an array of URL strings, every item checked; an empty or missing array is a warning, not a pass
      list = at(payload, path);
      if (!list.length) { check(rows, `own_domain_${path.replace(/\W+/g, '_')}`, false, `${path}: no links listed (each one must point to a ${OWN} page)`, false); continue; }
    }
    else if (path.includes('[]')) { const [arrPath, field] = path.split('[].'); list = at(payload, arrPath + '[]').map(item => item?.[field]); }
    else { const vals = at(payload, path); list = [vals.length ? vals[0] : undefined]; }   // a configured field that is missing fails
    list.forEach((v, i) => {
      const u = urlsIn(v)[0];
      const id = `own_domain_${path.replace(/\W+/g, '_')}${list.length > 1 ? '_' + (i + 1) : ''}`;
      if (!u) { { check(rows, id, false, `${path}: no link (it must point to a ${OWN} page)`); missing_destinations.push({ field: path, item: i + 1, url: null, reason: 'no own-site link' }); } return; }
      const ok = host(u) === OWN || hasReason || allowedExternal.has(u);
      check(rows, id, ok, ok ? `${u}${host(u) === OWN ? '' : ' (external, specified)'}` : `${path} links outside ${OWN}: ${u} (point to our page that covers it, or open its commission)`);
      if (!ok) missing_destinations.push({ field: path, item: i + 1, url: u, reason: 'external link: needs our own page' });
    });
  }
}

// ---------- strategy: the approved desk rules (pillars, banned topics, article types) ----------
let deskRules = null;   // kept for the model judge below
{
  const rulesPath = join(dirname(resolve(contractPath)), 'desk-rules.json');
  const deskKey = C.desk || C.channel;
  let R = null; try { R = JSON.parse(readFileSync(rulesPath, 'utf8'))[deskKey] ?? null; } catch { /* no rules file: desk not codified yet */ }
  deskRules = R;
  if (R) {
    const pillar = norm(payload.pillar).toLowerCase();
    if (R.pillars?.length) check(rows, 'strategy_pillar', R.pillars.includes(pillar), pillar ? (R.pillars.includes(pillar) ? `pillar ${pillar}` : `pillar "${pillar}" is not one of the ${deskKey} desk's: ${R.pillars.join(', ')}`) : `no pillar: the ${deskKey} desk's pillars are ${R.pillars.join(', ')}`);
    const all = [text, flat(payload.title), flat(payload.angle), flat(payload.hook), flat(payload.promise)].join(' \n ');
    const hits = (R.banned_topics || []).filter(t => new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(all));
    check(rows, 'strategy_topic', hits.length === 0, hits.length ? `topic outside the ${deskKey} desk (${hits.join(', ')})${R.route_banned_to ? '; belongs to ' + R.route_banned_to : ''}` : 'topic within the desk');
    const at = norm(payload.article_type).toLowerCase();
    if ((R.banned_article_types || []).includes(at)) check(rows, 'strategy_article_type', !!norm(payload.decision_angle), norm(payload.decision_angle) ? `${at} with a decision angle` : `"${at}" is a weak pitch for the ${deskKey} desk (generic explainers lose to AI answers): needs ${R.banned_article_types_unless}`);
  }
}


// ---------- inventory: is this new? (measured, 2026-10-09; replaces the self-declared "uniqueness") ----------
// Everything the project has or is making: site URLs, Content Engine cards, pitches in flight, posts live on the channel (Zernio).
// contract brief.inventory overrides: { fields, fail_at, warn_at, days, destination_repeat_days, site }. On by default for every format.
// Site articles count as repeats only for site briefs (site: true by default for channel website): a pin, carousel or LinkedIn post on a
// topic the site already covers is the intended pattern (social pieces point at our articles), so social briefs are judged against
// the same channel's cards, pitches and live posts, and their destinations against the channel's recent posts.
const INV = { fields: ['title', 'hook', 'angle', 'promise'], fail_at: 0.75, warn_at: 0.5, days: 365, destination_repeat_days: 90, site: C.channel === 'website', ...(B.inventory || {}) };
let inventory = [];
if (!offline) {
  try { inventory = await loadInventory(dirname(resolve(contractPath)), { sitemapIndex: C.destination?.article_sitemap_index || INV.sitemap_index || null, ownDomain: C.links?.own_domain || null }); }
  catch (e) { check(rows, 'inventory', false, `inventory unreadable: ${String(e.message).slice(0, 120)}`); }
}
if (inventory.length) {
  const self = new Set([commission?.id, payload.commission_id, payload.parent_briefing_id].filter(Boolean));
  const ch = String(C.channel || '').toLowerCase();
  const isRefresh = /refresh/i.test(String(payload.action || '')) || !!payload.existing_url;
  // a site URL the brief consciously differs from (distinct_from: [{url, why}]) is shown to Gabriel instead of failing
  const distinct = new Map((Array.isArray(payload.distinct_from) ? payload.distinct_from : []).filter(d => d?.url && norm(d.why)).map(d => [plain(d.url), norm(d.why)]));
  const judge = (id, text, label, minShared = 2) => {
    const T = tokens(text); if (T.size < 2) return;
    const top = matches(inventory, T, { channel: ch, excludeIds: self, sinceDays: INV.days, sources: INV.site ? ['site', 'ce', 'pitch', 'published'] : ['ce', 'pitch', 'published'] })   // a refresh is still checked against OTHER site URLs (its own is excluded below)
      .filter(m => m.shared.length >= minShared && !(isRefresh && m.url && payload.existing_url && plain(m.url) === plain(payload.existing_url)))[0];
    if (!top) { check(rows, id, true, `${label}: nothing similar in ${inventory.length} inventory items`); return; }
    const where = `${top.source}/${top.channel} ${top.status} ${top.date ?? ''} "${String(top.title).slice(0, 80)}" ${top.url || ''}`.trim();
    if (top.score >= INV.fail_at && top.url && distinct.has(plain(top.url))) { check(rows, id, false, `${label} is close to ${where}; brief says why it differs: ${distinct.get(plain(top.url))}`, false); return; }
    if (top.score >= INV.fail_at) check(rows, id, false, `${label} repeats ${where} (overlap ${top.score.toFixed(2)}: ${top.shared.join(' ')})${top.source === 'site' ? ': pitch a REFRESH of that URL or a different angle' : ': pick a different angle'}`);
    else check(rows, id, top.score < INV.warn_at, `${label}: closest ${where} (overlap ${top.score.toFixed(2)})`, false);   // between warn_at and fail_at: a warning
  };
  judge('inventory_topic', [commission?.title, ...INV.fields.map(f => flat(payload[f]))].join(' '), 'topic');
  if (B.items_field && Array.isArray(payload[B.items_field])) payload[B.items_field].forEach((it, i) => judge(`inventory_item_${i + 1}`, flat(it.hook) + ' ' + flat(it.title), `item ${i + 1} "${norm(it.hook).slice(0, 50)}"`, 3));   // short hooks: 3 shared words
  // the same destination pinned/posted on this channel recently is a repeat for the audience
  if (INV.destination_repeat_days) {
    const since = new Date(Date.now() - INV.destination_repeat_days * 864e5).toISOString().slice(0, 10);
    const used = new Map(); for (const m of inventory) if (m.source === 'published' && m.channel === ch && (m.date || '') >= since) for (const l of m.links || []) used.set(plain(l), m.date);
    const dests = B.items_field && Array.isArray(payload[B.items_field]) ? payload[B.items_field].map(it => urlsIn(it.destination ?? it.destination_url)[0]) : [urlsIn(payload[B.destination_field])[0]];
    dests.forEach((u, i) => { if (u && used.has(plain(u))) check(rows, `inventory_destination_${i + 1}`, false, `${u} was already posted on ${ch} on ${used.get(plain(u))} (within ${INV.destination_repeat_days} days): choose another article`); });
  }
}

// ---------- destination answers the topic (2026-10-09) ----------
// A live destination that shares no content word with the pitch is not an answer (LinkedIn "previsão de risco" -> a Santo André rain-garden
// article): it becomes a missing destination, so the briefing opens the destination's own brief and blocks this piece until it is live.
if (!offline && B.destination_field) {
  const titleOf = async u => { try { const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 content-qa-gate' }, signal: AbortSignal.timeout(20000) }); const h = r.ok ? await r.text() : '';
    return [(h.match(/<title[^>]*>([^<]*)/i) || [])[1], (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]].filter(Boolean).join(' ').replace(/<[^>]+>/g, ' '); } catch { return ''; } };
  const topic = [commission?.title, payload.title, payload.hook, payload.angle, payload.promise, payload.board].map(flat).join(' ');
  const pairs = B.items_field && Array.isArray(payload[B.items_field])
    ? payload[B.items_field].map((it, i) => ({ i: i + 1, u: urlsIn(it.destination ?? it.destination_url)[0] ?? topDest, t: `${flat(it.hook)} ${flat(it.title)} ${topic}` }))
    : [{ i: 0, u: topDest, t: topic }];
  for (const { i, u, t } of pairs) {
    if (!u) continue;
    const page = `${decodeURIComponent(new URL(u).pathname).replace(/[/-]+/g, ' ')} ${await titleOf(u)}`;
    const o = overlap(tokens(t), tokens(page));
    const id = `destination_answers_topic${i ? '_' + i : ''}`;
    check(rows, id, o.shared.length > 0, o.shared.length ? `${u} covers it (${o.shared.join(' ')})` : `${u} does not cover the topic (no shared subject word): needs its own destination article`);
    if (!o.shared.length) missing_destinations.push({ item: i || undefined, angle: norm(t).slice(0, 140), url: u, reason: 'destination does not cover the topic: open its brief' });
  }
}

// ---------- article type, price evidence and tool pages (website briefs, 2026-10-09) ----------
if (payload.article_type || B.article_type_field) {
  // the PROJECT's article contract: declared by the brief contract (absolute or relative to _context), else <ctx>/article-contract.json
  // or <ctx>/content-contract.json (rule 22); never another project's file
  const ctxDir = dirname(resolve(contractPath));
  const acPath = [C.article_contract && resolve(ctxDir, C.article_contract), process.env.ARTICLE_CONTRACT, join(ctxDir, 'article-contract.json'), join(ctxDir, 'content-contract.json')]
    .filter(Boolean).find(x => existsSync(x)) || '(no article contract declared for this project)';
  // a channel brief (newsletter, pins, LinkedIn, carousel) may carry its own "article_type" label (e.g. decisao-da-semana) and declares no
  // article contract: that is not a website article type, so it is not judged here (2026-10-11: the newsletter brief failed on this forever)
  // a website/news brief: it declares an article contract, or its format/channel says article/news/website (then the <ctx> fallbacks apply)
  const articleBrief = !!(C.article_contract || process.env.ARTICLE_CONTRACT || /\b(article|news|website|artigo|noticia)\b/i.test(`${C.format ?? ''} ${C.channel ?? ''}`));
  let AC = null;
  if (!articleBrief) check(rows, 'article_type', true, `"${payload.article_type}" is a ${C.channel || C.format || 'channel'} label, not a website article type (no article contract for this brief)`);
  else try { AC = JSON.parse(readFileSync(acPath, 'utf8')); } catch (e) { check(rows, 'article_type', false, `article contract unreadable (${acPath})`); }
  if (AC) {
    const slugT = x => String(x ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const types = Object.entries(AC.types).filter(([, v]) => v && typeof v === 'object');
    const alias = new Map(); for (const [k, v] of types) { alias.set(k, k); for (const a of v.aliases || []) if (!alias.has(slugT(a))) alias.set(slugT(a), k); }
    const asked = payload[B.article_type_field || 'article_type'];
    const t = alias.get(slugT(asked));
    if (!t) {
      const near = types.map(([k, v]) => [k, overlap(tokens(`${asked} ${payload.title ?? ''}`), tokens(`${k} ${(v.aliases || []).join(' ')} ${(v.skeleton || []).join(' ')}`)).score]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
      check(rows, 'article_type', false, `article_type "${asked}" is not in article contract ${AC.version} (types: ${types.map(x => x[0]).join(', ')}); closest: ${near.join(', ')}`);
    } else {
      check(rows, 'article_type', true, `${asked} -> ${t} (contract ${AC.version})`);
      const spec = AC.types[t];
      if (spec.requires_price_ledger) {
        // one or more ledgers; the first that is about a product this brief names (title, angle, products) is the evidence
        const about = tokens([payload.title, payload.angle, payload.promise, ...(Array.isArray(payload.products) ? payload.products : [])].map(flat).join(' '));
        const paths = (Array.isArray(payload.price_ledger) ? payload.price_ledger : [payload.price_ledger]).filter(Boolean).map(x => resolve(projectRoot, String(x)));
        const read = x => { try { return JSON.parse(readFileSync(x, 'utf8')); } catch { return null; } };
        const leds = paths.map(read).filter(Boolean);
        const led = leds.find(l => { const w = tokens(`${l.product ?? ''} ${l.model ?? ''}`); const sh = [...w].filter(x => about.has(x)).length; return w.size && sh >= Math.min(2, w.size); }) ?? (leds.length ? { ...leds[0], verdict: 'OTHER_PRODUCT', missing: [`ledger is about "${leds[0].product}", not a product this brief names`] } : null);
        const okRows = [...(led?.prices || []), ...(led?.on_request || [])].filter(r => /^https?:/.test(String(r.url)) && r.checked_at);
        const accepts = spec.price_ledger_accepts || ['PASS', 'PRESS_QUOTE', 'NO_PUBLIC_PRICE'];
        const ageDays = led?.generated_at ? (Date.now() - Date.parse(led.generated_at)) / 864e5 : Infinity;
        const maxAge = led?.rules?.valid_for_days ?? 30;
        const ok = accepts.includes(led?.verdict) && okRows.length > 0 && ageDays <= maxAge;
        check(rows, 'price_ledger', ok, ok ? `${led.verdict}: ${led.cite ?? okRows.length + ' evidence row(s)'}` : `${t} needs verified prices before approval: run price-research (price_research.mjs) in the briefing and set price_ledger${led && ageDays > maxAge ? ` (ledger is ${Math.round(ageDays)} days old; max ${maxAge}: re-run it)` : ''}${led ? ` (ledger verdict ${led.verdict}: ${(led.missing || []).join('; ').slice(0, 160)})` : ''}`);
      }
      if (spec.requires_destination) {
        const u = urlsIn(payload.tool_url)[0];
        const host = x => { try { return new URL(x).host.replace(/^www\./, ''); } catch { return ''; } };
        let live = false; if (u) { try { live = (await fetch(u, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 content-qa-gate' }, signal: AbortSignal.timeout(20000) })).status === 200; } catch {} }
        const ok = !!u && live && (!C.links?.own_domain || host(u) === C.links.own_domain);
        check(rows, 'tool_page', ok, ok ? `tool page ${u}` : `${t} explains a tool page that must be live on our site (tool_url ${u || 'missing'}${u && !live ? ', not live' : ''})`);
        if (!ok) missing_destinations.push({ angle: `ferramenta: ${norm(payload.title).slice(0, 100)}`, url: u || null, reason: 'tool page missing: open its brief' });
      }
    }
  }
}

// ---------- verdict ----------
const failures = rows.filter(r => r.result === 'fail').map(r => `${r.id}: ${r.measurement}`);
const out = resolve(arg('--out', '.'));
let judge;
// meaning is judged only once the fields pass: a brief that fails a field check is fixed first, and the call is not paid for twice
if ((process.argv.includes('--judge') || process.env.BRIEF_JUDGE === '1') && !failures.length) {
  const j = await judgeGate({ payload, deskRules, projectRoot, outDir: join(out, 'qa'), commission: commission?.id ?? payload.commission_id ?? null });
  judge = j.judge;
  if (j.failure) failures.push(j.failure);
  if (j.warn) console.log(j.warn);
}
if (offline) failures.push('offline run: links and destinations not verified');
const v = { schema: 'brief-verdict/1', verdict: failures.length ? 'fail' : 'pass', generated_at: new Date().toISOString(), offline,
  commission, format: C.format, channel: C.channel,
  contract: { path: resolve(contractPath), version: C.version, project: C.project, sha256: sha(readFileSync(contractPath)) },
  payload_sha256: sha(JSON.stringify(payload)), missing_destinations, failures, checks: rows, ...(judge ? { judge } : {}) };
mkdirSync(join(out, 'qa'), { recursive: true });
writeFileSync(join(out, 'qa', 'brief-verdict.json'), JSON.stringify(v, null, 2));
for (const r of rows.filter(r => r.result !== 'pass')) console.log(`  ${r.result.toUpperCase()} ${r.id}: ${r.measurement}`);
if (missing_destinations.length) console.log(`  needs site articles first: ${missing_destinations.map(m => m.angle || m.url).join(' | ')}`);
console.log(`brief_gate: ${v.verdict.toUpperCase()} (${C.channel}/${C.format}, ${rows.length} checks) -> ${join(out, 'qa', 'brief-verdict.json')}`);
process.exit(failures.length ? 1 : 0);
