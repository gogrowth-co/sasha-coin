#!/usr/bin/env node
/**
 * refresh_select.mjs - which published pages deserve a refresh this week, and which recent refreshes regressed (2026-10-12).
 *
 * Replaces the one-off "P3 crosscheck" of 2026-09-03 (two pages, never regenerated): once those two pages were refreshed nothing
 * could qualify again, so every briefing recorded "no eligible URL". This runs the approved selection query of the P3 playbook
 * (_ops/strategy-os/playbooks/03-page-refresh-engine.md, "Selection query") as code, on current data, every run:
 *   candidates  = posts, last 90 days: position 5.5-10.5, impressions >= 500, CTR below the CTR the site earns at that
 *                 position (median of the site's own pages), topic in the core verticals (solar, wind, EV, efficiency),
 *                 ordered by impressions, top 10. News and posts edited in the last edited_cooldown_days are excluded.
 *   regressions = every refresh 7-75 days old (V4 refresh cards), read on its own window: impressions and clicks per day vs the
 *                 site over the same days; a drop beyond drop_vs_site flags it with its lost queries (repair before new refreshes).
 *   node refresh_select.mjs --client portal-ekkogreen --context <project>/_context [--out <file>] [--json]
 * Rules: <ctx>/refresh-rules.json (site, exclude_category_ids, window_days, min_impressions, position, in_scope, edited_cooldown_days, top, regression).
 * Data: `v4q gsc` (the collector's read-only Google account), WordPress REST (public), V4 store (refresh cards). Writes only --out.
 *
 * Site adapter (2026-10-14): WordPress by default (the code below, EkkoGreen). A static-git site (mangabeira.net) runs
 * refresh_select_static.mjs instead, chosen by `--cms static-git [--site-dir <checkout>]` or by "cms": "static-git"
 * [, "site_dir"] in refresh-rules.json; the checkout defaults to <ctx>/../site. That path also enforces exclude_paths,
 * require_edit_date, lost_rankings, priority_pages, pillar_support, hub_exemption and cooldown_days (see that file).
 *   node refresh_select.mjs --client mangabeira --context <workspace>/_context --cms static-git --site-dir <workspace>/site --out <file>
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveSite } from './site_static_git.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const client = arg('--client'), ctx = arg('--context'), outFile = arg('--out');
if (!client || !ctx) { console.error('refresh_select: --client and --context are required'); process.exit(2); }
const rules = { window_days: 90, min_impressions: 500, position: [5.5, 10.5], edited_cooldown_days: 60, exclude_category_ids: [], top: 10, in_scope: 'solar|fotovolt|e[oó]lic|aerogerador|(carro|ve[ií]culo|moto|bicicleta|scooter|patinete|[oô]nibus|caminh[aã]o)s?[- ]?el[eé]tric|recarga|carregador|bateria|efici[eê]ncia[- ]energ|procel|etiqueta[- ]de[- ]efici',
  regression: { min_days_after: 7, max_days_after: 75, before_days: 21, drop_vs_site: 0.25 },
  ...(existsSync(join(ctx, 'refresh-rules.json')) ? JSON.parse(readFileSync(join(ctx, 'refresh-rules.json'), 'utf8')) : {}) };
if (rules.news_category_ids && !rules.exclude_category_ids?.length) rules.exclude_category_ids = rules.news_category_ids;   // older name
if (!rules.site) { console.error(`refresh_select: "site" missing in ${join(ctx, 'refresh-rules.json')}`); process.exit(2); }
const V4Q = process.env.V4Q_BIN || (existsSync(join(homedir(), '.local/bin/v4q')) ? join(homedir(), '.local/bin/v4q') : 'v4q');
export const shortId = (prefix, url) => prefix + createHash('sha1').update(String(url)).digest('hex').slice(0, 5);
const siteAdapter = resolveSite(process.argv, ctx);
if (siteAdapter.cms === 'static-git') {
  // static-git: every v4q call names the client (v4q has no default client)
  const v4qS = (...a) => JSON.parse(execFileSync(V4Q, [...a, '--client', client], { encoding: 'utf8', maxBuffer: 128 << 20 }));
  const gscS = (range, dims, contains) => v4qS('gsc', client, ...(typeof range === 'number' ? ['--days', String(range)] : ['--start', range.start, '--end', range.end]),
    '--dimensions', dims, '--limit', '25000', ...(contains ? ['--contains', contains] : []));
  const cards = []; for (let off = 0; ;) { const pg = v4qS('list', 'ce_content', '--limit', '200', '--offset', String(off)); cards.push(...pg.records); if (!pg.has_more) break; off = pg.next_offset; }
  const { loadCheckout } = await import('./site_static_git.mjs');
  const { selectStatic, printStatic } = await import('./refresh_select_static.mjs');
  const result = selectStatic({ client, site: rules.site, rules, checkout: loadCheckout(siteAdapter.siteDir), gsc: gscS, cards, siteDir: siteAdapter.siteDir });
  if (outFile) { mkdirSync(dirname(outFile), { recursive: true }); writeFileSync(outFile, JSON.stringify(result, null, 2)); }
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2)); else printStatic(result);
} else {   // WordPress (unchanged below)
const v4q = (...a) => JSON.parse(execFileSync(V4Q, a, { encoding: 'utf8', maxBuffer: 128 << 20 }));
const gsc = (days, dims, contains) => v4q('gsc', client, '--days', String(days), '--dimensions', dims, '--limit', '25000', ...(contains ? ['--contains', contains] : []));
const norm = u => String(u).replace(/[?#].*$/, '').replace(/\/?$/, '/');
const DECISION = /\b(quanto custa|pre[cç]o|valor|melhor(es)?|vale a pena|compar|qual (escolher|comprar)|como escolher|review|modelos?|kit)\b/i;
const day = d => d.toISOString().slice(0, 10);
const now = new Date();

// 1. WordPress: every post with its last real edit and categories (pages and archives are not refresh material)
const posts = new Map();
for (let page = 1; ; page++) {
  const r = await fetch(`${rules.site}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=link,modified,date,categories,title`, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) { if (page === 1) throw new Error(`WordPress REST HTTP ${r.status}`); break; }
  const list = await r.json();
  for (const p of list) posts.set(norm(p.link), { modified: p.modified, date: p.date, categories: p.categories, title: p.title?.rendered ?? '' });
  if (list.length < 100) break;
}

// 2. Search Console, last 28 days: pages, then the queries of the pages that pass the volume/position screen
// Search Console reports URL variants (?amp, #anchors, missing slash) as separate pages: fold them into one page
const pages = (() => {
  const m = new Map();
  for (const r of gsc(rules.window_days, 'page').rows) {
    const u = norm(r.page); const x = m.get(u) || { page: u, impressions: 0, clicks: 0, posw: 0 };
    x.impressions += r.impressions; x.clicks += r.clicks; x.posw += r.position * r.impressions; m.set(u, x);
  }
  return [...m.values()].map(x => ({ page: x.page, impressions: x.impressions, clicks: x.clicks, ctr: x.impressions ? x.clicks / x.impressions : 0, position: x.impressions ? x.posw / x.impressions : 0 }));
})();
const window = { start: null, end: null };
// the CTR the site itself earns at each rounded position (median over pages with >= 100 impressions): "expected_ctr_for_position"
const byPos = new Map();
for (const r of pages) if (r.impressions >= 100) { const k = Math.round(r.position); if (!byPos.has(k)) byPos.set(k, []); byPos.get(k).push(r.ctr); }
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const expectedCtr = pos => median(byPos.get(Math.round(pos)) || []);
const IN_SCOPE = new RegExp(rules.in_scope, 'i');
const pq = gsc(rules.window_days, 'page,query');
const queriesOf = new Map();
for (const r of pq.rows) { const u = norm(r.page); if (!queriesOf.has(u)) queriesOf.set(u, []); queriesOf.get(u).push(r); }
const screened = [], offTopic = [];
for (const r of pages) {
  const url = norm(r.page), post = posts.get(url);
  if (!post) continue;                                                          // not a post (home, category, page)
  if (post.categories?.some(c => rules.exclude_category_ids.includes(c))) continue;  // excluded categories (news is not refreshed)
  if (r.impressions < rules.min_impressions || r.position < rules.position[0] || r.position > rules.position[1]) continue;
  const exp = expectedCtr(r.position);
  if (exp !== null && r.ctr >= exp) continue;                                   // already earns its position's CTR
  const topQ = (queriesOf.get(url) || []).sort((a, b) => b.impressions - a.impressions).slice(0, 5).map(q => q.query).join(' ');
  if (!IN_SCOPE.test(`${url} ${topQ}`)) { offTopic.push(url); continue; }        // outside the core verticals: pruned, never refreshed
  screened.push({ url, ...r, post, expected_ctr: exp });
}
window.start = pq.start; window.end = pq.end;
const recentCut = day(new Date(now.getTime() - rules.edited_cooldown_days * 864e5));
const candidates = [], recentlyEdited = [];
for (const s of screened) {
  const qs = (queriesOf.get(s.url) || []).sort((a, b) => b.impressions - a.impressions);
  const decision = qs.slice(0, 15).some(q => DECISION.test(q.query));
  const row = { id: shortId('r', s.url), url: s.url, title: s.post.title.replace(/<[^>]+>/g, ''), impressions: Math.round(s.impressions), clicks: Math.round(s.clicks),
    position: +s.position.toFixed(1), ctr: +(s.ctr * 100).toFixed(2), expected_ctr: s.expected_ctr === null ? null : +(s.expected_ctr * 100).toFixed(2),
    last_modified: s.post.modified.slice(0, 10), decision_intent: decision,
    top_queries: qs.slice(0, 6).map(q => ({ query: q.query, impressions: Math.round(q.impressions), position: +q.position.toFixed(1) })) };
  (s.post.modified.slice(0, 10) >= recentCut ? recentlyEdited : candidates).push(row);
}
candidates.sort((a, b) => b.impressions - a.impressions);   // the playbook orders by impressions

// 3. Regression read for every refresh 14-75 days old: page impressions/day after vs before, against the site's own change
const refreshes = [];
const allCards = []; for (let off = 0; ;) { const pg = v4q('list', 'ce_content', '--limit', '200', '--offset', String(off)); allCards.push(...pg.records); if (!pg.has_more) break; off = pg.next_offset; }   // paginated (Codex P2)
for (const r of allCards) {
  const p = r.props; const m = /\b(\d{4}-\d{2}-\d{2})\b.*\|\s*Refresh\b/i.exec(String(p.Name || ''));
  if (!m || p.Status !== 'Published' || !p['Primary CMS URL']) continue;
  const url = norm(p['Primary CMS URL']), wp = posts.get(url);
  // the refresh date: the card's slot date, or the WordPress edit if that is later (a repair re-edits the page)
  refreshes.push({ url, card: r.id, refreshed: m[1], wp_modified: wp?.modified?.slice(0, 10) });
}
const regressions = [], healthy = [];
if (refreshes.length) {
  const span = rules.regression.max_days_after + rules.regression.before_days + 5;
  const site = new Map(gsc(span, 'date').rows.map(r => [r.date, r]));
  const lastDay = [...site.keys()].sort().pop();
  // every refresh is read on its own: its after-window ends where the next refresh of the same page starts
  const events = [...refreshes].sort((a, b) => a.url.localeCompare(b.url) || a.refreshed.localeCompare(b.refreshed));
  const seen = new Set();
  for (const [i, f] of events.entries()) {
    if (seen.has(f.url + f.refreshed)) continue; seen.add(f.url + f.refreshed);
    const next = events.slice(i + 1).find(e => e.url === f.url && e.refreshed > f.refreshed);
    const after0 = new Date(Date.parse(f.refreshed) + 2 * 864e5);
    const end = next && next.refreshed < lastDay ? day(new Date(Date.parse(next.refreshed) - 864e5)) : lastDay;
    const daysAfter = Math.floor((Date.parse(end) - after0.getTime()) / 864e5) + 1;
    if (daysAfter < rules.regression.min_days_after || daysAfter > rules.regression.max_days_after) continue;
    const b0 = day(new Date(Date.parse(f.refreshed) - rules.regression.before_days * 864e5)), b1 = day(new Date(Date.parse(f.refreshed) - 1 * 864e5)), a0 = day(after0);
    const rows = gsc(span, 'query,date', `page=${new URL(f.url).pathname}`).rows;   // keep the slashes: "/slug/" never matches "/slug-2/" (Codex P1)
    const inB = d => d >= b0 && d <= b1, inA = d => d >= a0 && d <= end;
    const nB = rules.regression.before_days, nA = daysAfter;
    const siteSum = (pred, k) => [...site].filter(([d]) => pred(d)).reduce((n, [, r]) => n + r[k], 0);
    const pageSum = (pred, k) => rows.filter(r => pred(r.date)).reduce((n, r) => n + r[k], 0);
    const rel = k => { const pB = pageSum(inB, k) / nB, pA = pageSum(inA, k) / nA, sB = siteSum(inB, k) / nB, sA = siteSum(inA, k) / nA;
      const pc = pB ? pA / pB - 1 : 0, sc = sB ? sA / sB - 1 : 0; return { before: +pB.toFixed(1), after: +pA.toFixed(1), page: Math.round(pc * 100), site: Math.round(sc * 100), relative: Math.round(((1 + pc) / (1 + sc) - 1) * 100) }; };
    const imp = rel('impressions'), clk = rel('clicks');
    const relative = Math.min(imp.relative, clk.before >= 1 ? clk.relative : 0) / 100;   // clicks count once the page had at least 1 click a day
    const q = new Map();
    for (const r of rows) { const k = r.query; if (!q.has(k)) q.set(k, { b: 0, a: 0, pb: 0, pa: 0 }); const x = q.get(k);
      if (inB(r.date)) { x.b += r.impressions; x.pb += r.position * r.impressions; } else if (inA(r.date)) { x.a += r.impressions; x.pa += r.position * r.impressions; } }
    const lost = [...q.entries()].map(([query, x]) => ({ query, before_per_day: +(x.b / nB).toFixed(1), after_per_day: +(x.a / nA).toFixed(1),
      position_before: x.b ? +(x.pb / x.b).toFixed(1) : null, position_after: x.a ? +(x.pa / x.a).toFixed(1) : null }))
      .sort((a, b) => (b.before_per_day - b.after_per_day) - (a.before_per_day - a.after_per_day)).slice(0, 8);
    const row = { id: shortId('g', `${f.url}|${f.refreshed}`),   // one id per refresh event, not per page (Codex P2)
       url: f.url, refresh_card: f.card, refreshed: f.refreshed, read_until: end, days_after: nA, re_refreshed: next?.refreshed ?? null,
      impressions: imp, clicks: clk, page_change: imp.page, site_change: imp.site, relative_change: Math.round(relative * 100), lost_queries: lost };
    (relative <= -rules.regression.drop_vs_site ? regressions : healthy).push(row);
  }
}

const result = { generatedAt: now.toISOString(), client, site: rules.site, window, rules,
  method: 'P3 playbook selection query on GSC (window_days): position window, min impressions, CTR below the site median at that position, core-vertical topic, ordered by impressions; news and posts edited within edited_cooldown_days excluded. Regressions: each refresh 7-75 days old, impressions and clicks per day vs the site over the same days',
  regressions, candidates: candidates.slice(0, rules.top), more_candidates: Math.max(0, candidates.length - rules.top),
  off_topic: offTopic, recently_edited: recentlyEdited.map(r => ({ url: r.url, last_modified: r.last_modified, impressions: r.impressions, position: r.position })), healthy_refreshes: healthy };
if (outFile) { mkdirSync(dirname(outFile), { recursive: true }); writeFileSync(outFile, JSON.stringify(result, null, 2)); }
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`refresh selection ${window.start}..${window.end}: ${candidates.length} candidates (top ${Math.min(rules.top, candidates.length)} below), ${regressions.length} regression(s)`);
  for (const g of regressions) console.log(`  REGRESSION ${g.id} ${g.url} refreshed ${g.refreshed} (read to ${g.read_until}${g.re_refreshed ? `, re-refreshed ${g.re_refreshed}` : ''}): impressions ${g.impressions.page}% vs site ${g.impressions.site}%, clicks ${g.clicks.page}% vs site ${g.clicks.site}% (worst relative ${g.relative_change}%); lost: ${g.lost_queries.slice(0, 3).map(q => `"${q.query}" ${q.before_per_day}->${q.after_per_day}/d`).join(', ')}`);
  for (const c of candidates.slice(0, rules.top)) console.log(`  ${c.id} ${c.impressions} imp · pos ${c.position} · ctr ${c.ctr}% (site at that position ${c.expected_ctr}%) · edited ${c.last_modified}${c.decision_intent ? ' · decision' : ''} · ${c.url}`);
}
}   // end WordPress
