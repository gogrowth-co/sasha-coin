/**
 * refresh_select_static.mjs - the refresh selection for a static-git site (mangabeira.net), run by refresh_select.mjs when the
 * site adapter is static-git (2026-10-14). The WordPress path (EkkoGreen) stays in refresh_select.mjs, untouched.
 *
 * Unit = the PAGE (one pages.json row): its EN, BR and ES URLs ship together, so Search Console rows of the three URLs are
 * summed (clicks, impressions; position impression-weighted) and the page is one candidate with its EN URL as `url`.
 * Slots, in this order (rules.slot_sharing), deduplicated, top `rules.top`:
 *   1. lost_rankings  page position over the last lost_rankings.window_days is >= position_drop_min worse than over the previous
 *                     window of the same length, with >= lost_rankings.min_impressions in the previous window and some impressions now.
 *   2. priority       rules.priority_pages in file order, then rules.pillar_support pages by impressions.
 *   3. query          the P3 playbook query: impressions >= min_impressions, position inside rules.position, CTR below the site's
 *                     median at that position OR the ctr_repair floor (>= ctr_repair.min_impressions, CTR <= ctr_repair.max_ctr),
 *                     in_scope on URL + top queries, last edit older than edited_cooldown_days (else `recently_edited`).
 * Every group: published, non-system pages of the checkout only; exclude_paths (regexes on every language path) and
 * exclude_category_ids (matched against the pages.json category name) drop a page; require_edit_date drops a page without an
 * edit date; groups 1 and 2 need the last edit older than cooldown_days; every group skips a page the engine refreshed less than
 * cooldown_days ago (a Published "| Refresh" CE card). hub_exemption.pages use hub_exemption.min_edit_age_days in place of
 * cooldown_days for both clocks.
 * Regressions: the same read as WordPress (every engine refresh 7-75 days old, impressions/clicks per day vs the site), on the
 * page's three URLs.
 */
import { createHash } from 'node:crypto';
import { pageOf, pathOf, urlsOf } from './site_static_git.mjs';

export const shortId = (prefix, url) => prefix + createHash('sha1').update(String(url)).digest('hex').slice(0, 5);
const DECISION = /\b(quanto custa|pre[cç]o|valor|melhor(es)?|vale a pena|compar|qual (escolher|comprar)|como escolher|review|modelos?|kit|best|vs\.?|versus|cost|price|pricing|alternatives?|how to choose|which)\b/i;
const day = d => d.toISOString().slice(0, 10);
const daysAgo = (now, n) => day(new Date(now.getTime() - n * 864e5));

export const STATIC_DEFAULTS = { window_days: 90, min_impressions: 500, position: [5.5, 10.5], edited_cooldown_days: 60, exclude_category_ids: [], top: 10,
  in_scope: '.', exclude_paths: [], require_edit_date: false, cooldown_days: null, priority_pages: [], pillar_support: {}, hub_exemption: null,
  lost_rankings: null, ctr_repair: null, regression: { min_days_after: 7, max_days_after: 75, before_days: 21, drop_vs_site: 0.25 } };

/** Engine refreshes per page id: Published CE cards named "... | Refresh ..." (or Content Type / Format "Refresh") on a checkout URL. */
export function engineRefreshes(cards, checkout) {
  const out = [];
  for (const r of cards) {
    const p = r.props || {};
    const name = String(p.Name || '');
    const isRefresh = /\|\s*Refresh\b/i.test(name) || /refresh/i.test(`${p['Content Type'] || ''} ${p.Format || ''}`);
    if (!isRefresh || p.Status !== 'Published' || !p['Primary CMS URL']) continue;
    const hit = pageOf(checkout, p['Primary CMS URL']); if (!hit) continue;
    const note = String(p['Publish Note'] || '');
    const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(name)?.[1]
      || (() => { const m = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(note); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; })()
      || /\b(\d{4}-\d{2}-\d{2})\b/.exec(note)?.[1]
      || (typeof r.updated_at === 'string' ? r.updated_at.slice(0, 10) : null)
      || hit.page.edited;   // a refresh with no date of its own: the page's last edit (the publisher bumps updated_at)
    if (date) out.push({ page: hit.page, url: p['Primary CMS URL'], card: r.id, refreshed: date });
  }
  return out;
}

/** Fold GSC rows (any dims incl. `page`) into checkout pages: Map(pageId -> {impressions, clicks, posw}); unmapped URLs go to `other`. */
function foldPages(rows, checkout) {
  const m = new Map(), other = new Map();
  for (const r of rows) {
    const hit = pageOf(checkout, r.page);
    const key = hit ? hit.page.id : pathOf(r.page);
    const into = hit ? m : other;
    const x = into.get(key) || { impressions: 0, clicks: 0, posw: 0 };
    x.impressions += r.impressions; x.clicks += r.clicks; x.posw += r.position * r.impressions; into.set(key, x);
  }
  const fin = x => ({ impressions: x.impressions, clicks: x.clicks, ctr: x.impressions ? x.clicks / x.impressions : 0, position: x.impressions ? x.posw / x.impressions : 0 });
  return { pages: new Map([...m].map(([k, x]) => [k, fin(x)])), other: new Map([...other].map(([k, x]) => [k, fin(x)])) };
}

/**
 * The selection, pure: gsc(range, dims, contains) -> {start, end, rows}; range is a number of days or {start, end}.
 * cards = CE content records ({id, props}); checkout from loadCheckout(); now = Date.
 */
export function selectStatic({ client, site, rules: given, checkout, gsc, cards, now = new Date(), siteDir = null }) {
  const rules = { ...STATIC_DEFAULTS, ...given, regression: { ...STATIC_DEFAULTS.regression, ...(given.regression || {}) } };
  const notes = [];
  const EXCL = (rules.exclude_paths || []).map(x => new RegExp(x));
  const IN_SCOPE = new RegExp(rules.in_scope ?? '.', 'i');
  const hubPaths = new Set((rules.hub_exemption?.pages || []).map(pathOf));
  const isHub = page => Object.values(page.langs).some(l => hubPaths.has(l.path));
  const cooldownOf = page => isHub(page) && Number.isFinite(rules.hub_exemption?.min_edit_age_days) ? rules.hub_exemption.min_edit_age_days : rules.cooldown_days;
  const exclCats = (rules.exclude_category_ids || []).map(String);

  // engine refreshes: the last one per page (the cooldown) and every event (regressions)
  const refreshes = engineRefreshes(cards, checkout);
  const lastRefresh = new Map();
  for (const f of refreshes) if (!lastRefresh.has(f.page.id) || f.refreshed > lastRefresh.get(f.page.id)) lastRefresh.set(f.page.id, f.refreshed);

  // why a page cannot be refreshed at all this week (null = it can); minEditDays = the edit-age clock of the caller's group
  const excluded = { path: [], category: [], no_edit_date: [], engine_cooldown: [] };
  const blockOf = page => {
    if (page.system || (page.status && page.status !== 'published')) return 'not_material';
    if (Object.values(page.langs).some(l => EXCL.some(re => re.test(l.path)))) return 'path';
    if (page.category != null && exclCats.includes(String(page.category))) return 'category';
    if (!page.edited && rules.require_edit_date) return 'no_edit_date';
    const cd = cooldownOf(page), last = lastRefresh.get(page.id);
    if (Number.isFinite(cd) && last && last > daysAgo(now, cd)) return 'engine_cooldown';
    return null;
  };
  const editOlderThan = (page, n) => !Number.isFinite(n) || (page.edited ? page.edited <= daysAgo(now, n) : !rules.require_edit_date);

  // Search Console: the selection window (pages, then page x query)
  const pg = gsc(rules.window_days, 'page');
  const urlRows = (() => {   // per URL, folded over ?query/#fragment/slash variants: the site's CTR-at-position curve
    const m = new Map();
    for (const r of pg.rows) { const k = pathOf(r.page); const x = m.get(k) || { impressions: 0, clicks: 0, posw: 0 }; x.impressions += r.impressions; x.clicks += r.clicks; x.posw += r.position * r.impressions; m.set(k, x); }
    return [...m.values()].map(x => ({ impressions: x.impressions, ctr: x.impressions ? x.clicks / x.impressions : 0, position: x.impressions ? x.posw / x.impressions : 0 }));
  })();
  const byPos = new Map();
  for (const r of urlRows) if (r.impressions >= 100) { const k = Math.round(r.position); if (!byPos.has(k)) byPos.set(k, []); byPos.get(k).push(r.ctr); }
  const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  const expectedCtr = pos => median(byPos.get(Math.round(pos)) || []);
  const metrics = foldPages(pg.rows, checkout).pages;
  const pq = gsc(rules.window_days, 'page,query');
  const queriesOf = new Map();
  for (const r of pq.rows) {
    const hit = pageOf(checkout, r.page); if (!hit) continue;
    const m = queriesOf.get(hit.page.id) || new Map(); const x = m.get(r.query) || { query: r.query, impressions: 0, posw: 0 };
    x.impressions += r.impressions; x.posw += r.position * r.impressions; m.set(r.query, x); queriesOf.set(hit.page.id, m);
  }
  const topQueries = page => [...(queriesOf.get(page.id)?.values() || [])].sort((a, b) => b.impressions - a.impressions)
    .map(q => ({ query: q.query, impressions: Math.round(q.impressions), position: q.impressions ? +(q.posw / q.impressions).toFixed(1) : null }));

  const rowOf = (page, group, reason, extra = {}) => {
    const m = metrics.get(page.id) || { impressions: 0, clicks: 0, ctr: 0, position: 0 };
    const qs = topQueries(page), exp = m.impressions ? expectedCtr(m.position) : null;
    const urls = urlsOf(page, site);
    return { id: shortId('r', urls.en), url: urls.en, group, reason, title: page.title || page.slug, impressions: Math.round(m.impressions), clicks: Math.round(m.clicks),
      position: m.impressions ? +m.position.toFixed(1) : null, ctr: +(m.ctr * 100).toFixed(2), expected_ctr: exp === null ? null : +(exp * 100).toFixed(2),
      last_modified: page.edited, last_engine_refresh: lastRefresh.get(page.id) ?? null, hub: isHub(page), decision_intent: qs.slice(0, 15).some(q => DECISION.test(q.query)),
      top_queries: qs.slice(0, 6), languages: urls, ...extra };
  };
  const all = [...checkout.pages.values()];
  const blocked = new Map(all.map(p => [p.id, blockOf(p)]));
  for (const p of all) { const b = blocked.get(p.id); if (b && b !== 'not_material') excluded[b].push(urlsOf(p, site).en); }
  const open = p => !blocked.get(p.id);

  // 1. lost rankings
  const lost = [];
  let lostWindow = null;
  if (rules.lost_rankings) {
    const lr = rules.lost_rankings, n = lr.window_days ?? 28;
    const end = daysAgo(now, 2);   // Search Console lags about 2 days (the same default end as v4q gsc)
    const curStart = day(new Date(Date.parse(end) - (n - 1) * 864e5)), prevEnd = day(new Date(Date.parse(curStart) - 864e5)), prevStart = day(new Date(Date.parse(prevEnd) - (n - 1) * 864e5));
    lostWindow = { current: [curStart, end], previous: [prevStart, prevEnd] };
    const cur = foldPages(gsc({ start: curStart, end }, 'page').rows, checkout).pages, prev = foldPages(gsc({ start: prevStart, end: prevEnd }, 'page').rows, checkout).pages;
    for (const p of all) {
      const a = prev.get(p.id), b = cur.get(p.id);
      if (!a || a.impressions < (lr.min_impressions ?? 0) || !b || !b.impressions) continue;
      const drop = b.position - a.position;
      if (drop < (lr.position_drop_min ?? 3)) continue;
      if (!open(p) || !editOlderThan(p, cooldownOf(p))) continue;
      lost.push(rowOf(p, 'lost_rankings', `position ${a.position.toFixed(1)} -> ${b.position.toFixed(1)} (${prevStart}..${prevEnd} vs ${curStart}..${end}), ${Math.round(a.impressions)} impressions before`,
        { lost: { position_before: +a.position.toFixed(1), position_now: +b.position.toFixed(1), drop: +drop.toFixed(1), impressions_before: Math.round(a.impressions), impressions_now: Math.round(b.impressions) } }));
    }
    lost.sort((x, y) => y.lost.drop - x.lost.drop);
  } else notes.push('lost_rankings not set in the rules: group skipped');

  // 2. priority pages (file order), then pillar-support pages (impressions)
  const priority = [], seenPriority = new Set();
  const priorityPage = path => checkout.byPath.get(pathOf(path))?.page;
  for (const path of [...(rules.priority_pages || []), ...(rules.hub_exemption?.pages || [])]) {   // a hub counts in this group even when not listed
    const p = priorityPage(path);
    if (!p) { notes.push(`priority page ${path} is not in the checkout`); continue; }
    if (seenPriority.has(p.id)) continue; seenPriority.add(p.id);
    if (open(p) && editOlderThan(p, cooldownOf(p))) priority.push(rowOf(p, 'priority', `priority page${isHub(p) ? ' (hub exemption, ' + cooldownOf(p) + '-day edit rule)' : ''}, last edit ${p.edited ?? 'unknown'}`));
  }
  const pillar = [];
  for (const [pillarId, paths] of Object.entries(rules.pillar_support || {})) for (const path of paths) {
    const p = priorityPage(path);
    if (!p || seenPriority.has(p.id)) continue; seenPriority.add(p.id);
    if (open(p) && editOlderThan(p, cooldownOf(p))) pillar.push(rowOf(p, 'pillar_support', `pillar ${pillarId}, last edit ${p.edited ?? 'unknown'}`, { pillar: pillarId }));
  }
  pillar.sort((a, b) => b.impressions - a.impressions);

  // 3. the playbook query
  const query = [], recentlyEdited = [], offTopic = [];
  const [lo, hi] = rules.position;
  for (const p of all) {
    const m = metrics.get(p.id); if (!m || !open(p)) continue;
    if (m.impressions < rules.min_impressions || m.position < lo || m.position > hi) continue;
    const exp = expectedCtr(m.position);
    const repair = rules.ctr_repair && m.impressions >= rules.ctr_repair.min_impressions && m.ctr <= rules.ctr_repair.max_ctr;
    if (exp !== null && m.ctr >= exp && !repair) continue;
    const urls = urlsOf(p, site);
    if (!IN_SCOPE.test(`${Object.values(urls).join(' ')} ${topQueries(p).slice(0, 5).map(q => q.query).join(' ')}`)) { offTopic.push(urls.en); continue; }
    const row = rowOf(p, 'query', repair && !(exp !== null && m.ctr < exp) ? 'ctr_repair floor' : 'CTR below the site at this position');
    (editOlderThan(p, rules.edited_cooldown_days) ? query : recentlyEdited).push(row);
  }
  query.sort((a, b) => b.impressions - a.impressions);

  const seen = new Set(), candidates = [];
  for (const r of [...lost, ...priority, ...pillar, ...query]) if (!seen.has(r.id)) { seen.add(r.id); candidates.push(r); }

  // regressions: every engine refresh 7-75 days old, on the page's three URLs
  const regressions = [], healthy = [];
  if (refreshes.length) {
    const span = rules.regression.max_days_after + rules.regression.before_days + 5;
    const siteRows = new Map(gsc(span, 'date').rows.map(r => [r.date, r]));
    const lastDay = [...siteRows.keys()].sort().pop();
    const events = [...refreshes].sort((a, b) => a.page.id.localeCompare(b.page.id) || a.refreshed.localeCompare(b.refreshed));
    const seenEv = new Set(), rowsOfPage = new Map();
    for (const [i, f] of events.entries()) {
      if (seenEv.has(f.page.id + f.refreshed)) continue; seenEv.add(f.page.id + f.refreshed);
      const next = events.slice(i + 1).find(e => e.page.id === f.page.id && e.refreshed > f.refreshed);
      const after0 = new Date(Date.parse(f.refreshed) + 2 * 864e5);
      const end = next && next.refreshed < lastDay ? day(new Date(Date.parse(next.refreshed) - 864e5)) : lastDay;
      if (!end) continue;
      const daysAfter = Math.floor((Date.parse(end) - after0.getTime()) / 864e5) + 1;
      if (daysAfter < rules.regression.min_days_after || daysAfter > rules.regression.max_days_after) continue;
      if (!rowsOfPage.has(f.page.id)) {   // exact URL match after the "contains" filter: /publications/x never reads /publications/x-guide
        const rows = [];
        for (const l of Object.values(f.page.langs)) for (const r of gsc(span, 'page,query,date', `page=${l.path}`).rows) if (pageOf(checkout, r.page)?.page.id === f.page.id) rows.push(r);
        rowsOfPage.set(f.page.id, rows);
      }
      const rows = rowsOfPage.get(f.page.id);
      const b0 = day(new Date(Date.parse(f.refreshed) - rules.regression.before_days * 864e5)), b1 = day(new Date(Date.parse(f.refreshed) - 864e5)), a0 = day(after0);
      const inB = d => d >= b0 && d <= b1, inA = d => d >= a0 && d <= end;
      const nB = rules.regression.before_days, nA = daysAfter;
      const siteSum = (pred, k) => [...siteRows].filter(([d]) => pred(d)).reduce((n, [, r]) => n + r[k], 0);
      const pageSum = (pred, k) => rows.filter(r => pred(r.date)).reduce((n, r) => n + r[k], 0);
      const rel = k => { const pB = pageSum(inB, k) / nB, pA = pageSum(inA, k) / nA, sB = siteSum(inB, k) / nB, sA = siteSum(inA, k) / nA;
        const pc = pB ? pA / pB - 1 : 0, sc = sB ? sA / sB - 1 : 0; return { before: +pB.toFixed(1), after: +pA.toFixed(1), page: Math.round(pc * 100), site: Math.round(sc * 100), relative: Math.round(((1 + pc) / (1 + sc) - 1) * 100) }; };
      const imp = rel('impressions'), clk = rel('clicks');
      const relative = Math.min(imp.relative, clk.before >= 1 ? clk.relative : 0) / 100;
      const q = new Map();
      for (const r of rows) { const k = r.query; if (!q.has(k)) q.set(k, { b: 0, a: 0, pb: 0, pa: 0 }); const x = q.get(k);
        if (inB(r.date)) { x.b += r.impressions; x.pb += r.position * r.impressions; } else if (inA(r.date)) { x.a += r.impressions; x.pa += r.position * r.impressions; } }
      const lostQ = [...q.entries()].map(([query, x]) => ({ query, before_per_day: +(x.b / nB).toFixed(1), after_per_day: +(x.a / nA).toFixed(1),
        position_before: x.b ? +(x.pb / x.b).toFixed(1) : null, position_after: x.a ? +(x.pa / x.a).toFixed(1) : null }))
        .sort((a, b) => (b.before_per_day - b.after_per_day) - (a.before_per_day - a.after_per_day)).slice(0, 8);
      const url = urlsOf(f.page, site).en;
      const row = { id: shortId('g', `${url}|${f.refreshed}`), url, refresh_card: f.card, refreshed: f.refreshed, read_until: end, days_after: nA, re_refreshed: next?.refreshed ?? null,
        impressions: imp, clicks: clk, page_change: imp.page, site_change: imp.site, relative_change: Math.round(relative * 100), lost_queries: lostQ };
      (relative <= -rules.regression.drop_vs_site ? regressions : healthy).push(row);
    }
  }

  return { generatedAt: now.toISOString(), client, site, cms: 'static-git', site_dir: siteDir, window: { start: pq.start ?? null, end: pq.end ?? null }, lost_rankings_window: lostWindow, rules,
    method: 'static-git checkout (content/pages.json + content/{en,br,es}): one candidate per page, its EN/BR/ES Search Console rows summed. Slots: lost_rankings, then priority_pages and pillar_support, then the P3 query (position window, min impressions, CTR below the site median at that position or the ctr_repair floor, in_scope, edited_cooldown_days). exclude_paths, exclude_category_ids (category name), require_edit_date, cooldown_days after an engine refresh (hub_exemption pages: min_edit_age_days). Regressions: each engine refresh 7-75 days old, impressions and clicks per day vs the site over the same days',
    not_enforced: ['slot_sharing beyond the group order (no per-group slot counts)', 'baseline_window', 'merge_fragments is always on (URL variants fold into the page)'],
    notes, regressions, candidates: candidates.slice(0, rules.top), more_candidates: Math.max(0, candidates.length - rules.top),
    groups: { lost_rankings: lost.length, priority: priority.length, pillar_support: pillar.length, query: query.length },
    excluded, off_topic: offTopic, recently_edited: recentlyEdited.map(r => ({ url: r.url, last_modified: r.last_modified, impressions: r.impressions, position: r.position })), healthy_refreshes: healthy };
}

export function printStatic(result) {
  const { window: w, candidates, regressions, rules } = result;
  const total = candidates.length + result.more_candidates;
  console.log(`refresh selection ${w.start}..${w.end} (static-git): ${total} candidates (top ${Math.min(rules.top, total)} below; lost ${result.groups.lost_rankings}, priority ${result.groups.priority}, pillar ${result.groups.pillar_support}, query ${result.groups.query}), ${regressions.length} regression(s)`);
  for (const g of regressions) console.log(`  REGRESSION ${g.id} ${g.url} refreshed ${g.refreshed} (read to ${g.read_until}${g.re_refreshed ? `, re-refreshed ${g.re_refreshed}` : ''}): impressions ${g.impressions.page}% vs site ${g.impressions.site}%, clicks ${g.clicks.page}% vs site ${g.clicks.site}% (worst relative ${g.relative_change}%); lost: ${g.lost_queries.slice(0, 3).map(q => `"${q.query}" ${q.before_per_day}->${q.after_per_day}/d`).join(', ')}`);
  for (const c of candidates) console.log(`  ${c.id} [${c.group}] ${c.impressions} imp · pos ${c.position ?? '-'} · ctr ${c.ctr}% (site at that position ${c.expected_ctr ?? '-'}%) · edited ${c.last_modified ?? 'unknown'}${c.decision_intent ? ' · decision' : ''} · ${c.url} · ${c.reason}`);
  for (const n of result.notes) console.log(`  note: ${n}`);
}
