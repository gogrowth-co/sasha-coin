// node --test scripts/test/site_adapters.test.mjs : refresh_select.mjs and slot_plan.mjs on a static-git checkout (mangabeira.net)
// and on WordPress (EkkoGreen), with a fake v4q and a fake checkout / local WordPress (2026-10-14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCheckout, pageOf, resolveSite } from '../site_static_git.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '..');
const FAKE = join(HERE, 'fake_v4q.mjs');
const now = new Date();
const ago = n => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10);
const ts = n => `${ago(n)}T12:00:00.000000+00:00`;
const SITE = 'https://mangabeira.net';

function workspace() {
  const ws = mkdtempSync(join(tmpdir(), 'static-git-'));
  const content = join(ws, 'site', 'content');
  for (const l of ['en', 'br', 'es']) mkdirSync(join(content, l), { recursive: true });
  mkdirSync(join(ws, '_context'));
  const pages = [
    ['p-guide', 'definitive-guide-web3-seo', 70],   // hub: 60-day rule, priority
    ['p-growth', 'defi-growth-guide', 70],          // priority, but edited 70 days ago (< 90): not yet
    ['p-hyper', 'hyperliquid-analysis', 120],       // the query (ctr_repair floor), three languages
    ['p-lost', 'lost-page', 100],                   // lost rankings
    ['p-excl', 'excluded-page', 120],               // exclude_paths
    ['p-nodate', 'no-date', null],                  // require_edit_date
    ['p-recent', 'recent-page', 10],                // edited 10 days ago: recently_edited
    ['p-cooled', 'cooled', 100],                    // engine refresh 30 days ago: cooldown + regression read
    ['p-new', 'new-page', 0],                       // created today (slot_plan)
  ].map(([id, slug, ed]) => ({ id, slug, category: 'Web3 SEO', status: 'published', is_system_page: false, created_at: ts(id === 'p-new' ? 0 : 200), updated_at: ed === null ? null : ts(ed) }));
  pages.push({ id: 'p-about', slug: 'about', category: null, status: 'published', is_system_page: true, created_at: ts(300), updated_at: ts(300) });
  writeFileSync(join(content, 'pages.json'), JSON.stringify(pages));
  for (const p of pages) writeFileSync(join(content, 'en', `${p.slug}.json`), JSON.stringify({ page_id: p.id, language: 'en', slug: p.slug, title: `Title ${p.slug}`, updated_at: p.updated_at, created_at: p.created_at }));
  writeFileSync(join(content, 'br', 'analise-hyperliquid.json'), JSON.stringify({ page_id: 'p-hyper', language: 'br', slug: 'analise-hyperliquid', title: 'Analise', updated_at: ts(120) }));
  writeFileSync(join(content, 'es', 'analisis-hyperliquid.json'), JSON.stringify({ page_id: 'p-hyper', language: 'es', slug: 'analisis-hyperliquid', title: 'Analisis', updated_at: ts(130) }));
  writeFileSync(join(content, 'br', 'nova-pagina.json'), JSON.stringify({ page_id: 'p-new', language: 'br', slug: 'nova-pagina', title: 'Nova', updated_at: ts(0) }));
  writeFileSync(join(ws, '_context', 'refresh-rules.json'), JSON.stringify({
    site: SITE, cms: 'static-git', window_days: 90, min_impressions: 50, position: [5.5, 20], in_scope: '.', edited_cooldown_days: 60,
    require_edit_date: true, cooldown_days: 90, top: 10, exclude_paths: ['^/publications/excluded-'],
    priority_pages: ['/publications/definitive-guide-web3-seo', '/publications/defi-growth-guide'], hub_exemption: { pages: ['/publications/definitive-guide-web3-seo'], min_edit_age_days: 60 },
    lost_rankings: { position_drop_min: 3, window_days: 28, min_impressions: 30 }, ctr_repair: { min_impressions: 200, max_ctr: 0.01 },
    regression: { min_days_after: 7, max_days_after: 75, before_days: 21, drop_vs_site: 0.25 } }));
  return ws;
}

function gscFixture() {
  const u = p => SITE + p;
  const page = [
    { page: u('/'), impressions: 500, clicks: 50, position: 8 },
    { page: u('/publications/hyperliquid-analysis'), impressions: 200, clicks: 0, position: 12 },
    { page: u('/br/artigos/analise-hyperliquid'), impressions: 100, clicks: 0, position: 12 },
    { page: u('/publications/hyperliquid-analysis#faq'), impressions: 10, clicks: 0, position: 12 },
    { page: u('/publications/recent-page'), impressions: 120, clicks: 1, position: 8 },
    { page: u('/publications/excluded-page'), impressions: 300, clicks: 0, position: 9 },
    { page: u('/publications/no-date'), impressions: 300, clicks: 0, position: 9 },
    { page: u('/publications/cooled'), impressions: 300, clicks: 0, position: 9 },
    { page: u('/publications/definitive-guide-web3-seo'), impressions: 3000, clicks: 3, position: 7 },
  ];
  const end = ago(2), curStart = new Date(Date.parse(end) - 27 * 864e5).toISOString().slice(0, 10), prevStart = new Date(Date.parse(curStart) - 28 * 864e5).toISOString().slice(0, 10);
  const days = Array.from({ length: 101 }, (_, i) => ago(2 + i));
  const refreshed = ago(30);
  const pqd = [];
  for (const d of days) {
    const before = d < refreshed && d >= ago(51), after = d >= ago(28);
    if (before || after) pqd.push({ page: u('/publications/cooled'), query: 'cooled query', date: d, impressions: before ? 10 : 2, clicks: 0, position: 9 });
    pqd.push({ page: u('/publications/cooled-other'), query: 'other', date: d, impressions: 50, clicks: 5, position: 3 });   // "contains" also returns it: must be dropped
  }
  return { refreshed, fixture: { gsc: {
    page, 'page,query': [{ page: u('/publications/hyperliquid-analysis'), query: 'hyperliquid vs dydx', impressions: 150, clicks: 0, position: 12 }, { page: u('/br/artigos/analise-hyperliquid'), query: 'hyperliquid analise', impressions: 100, clicks: 0, position: 12 }],
    [`page@${curStart}`]: [{ page: u('/publications/lost-page'), impressions: 40, clicks: 0, position: 11 }],
    [`page@${prevStart}`]: [{ page: u('/publications/lost-page'), impressions: 80, clicks: 2, position: 6 }],
    date: days.map(d => ({ date: d, impressions: 100, clicks: 5 })),
    'page,query,date': pqd,
  }, lists: { ce_content: [
    { id: 'card-cooled', props: { Name: `${refreshed} | Refresh | cooled`, Status: 'Published', 'Primary CMS URL': u('/publications/cooled'), 'Primary Channel': 'Website' } },
    { id: 'card-hyper', props: { Name: '2026-01-01 | Article | hyperliquid', Status: 'Published', 'Primary CMS URL': u('/publications/hyperliquid-analysis') } },
  ] } } };
}

const run = (script, args, env) => execFileSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8', env: { ...process.env, V4Q_BIN: FAKE, ...env } });

test('the checkout maps EN, BR and ES URLs to one page; edited = the latest language edit', () => {
  const ws = workspace(); const c = loadCheckout(join(ws, 'site'));
  assert.equal(pageOf(c, `${SITE}/br/artigos/analise-hyperliquid/`).page.id, 'p-hyper');
  assert.equal(pageOf(c, `${SITE}/es/articulos/analisis-hyperliquid?x=1#faq`).lang, 'es');
  assert.equal(pageOf(c, `${SITE}/publications/hyperliquid-analysis-2`), null);
  assert.equal(pageOf(c, `${SITE}/publications/hyperliquid-analysis`).page.edited, ago(120));
  assert.equal(c.pages.get('p-nodate').edited, null);
  assert.deepEqual(resolveSite(['node', 'x'], join(ws, '_context')), { cms: 'static-git', siteDir: join(ws, 'site') });
  assert.equal(resolveSite(['node', 'x', '--cms', 'wordpress'], join(ws, '_context')).cms, 'wordpress');
});

test('refresh_select static-git: lost rankings, then priority (hub 60 days), then the query; exclusions and cooldown enforced', () => {
  const ws = workspace(); const { fixture, refreshed } = gscFixture();
  const fx = join(ws, 'v4q.json'), log = join(ws, 'calls.log'); writeFileSync(fx, JSON.stringify(fixture));
  const out = join(ws, 'reports', 'sel.json');
  run('refresh_select.mjs', ['--client', 'mangabeira', '--context', join(ws, '_context'), '--out', out], { FAKE_V4Q: fx, FAKE_V4Q_LOG: log });
  const r = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(r.cms, 'static-git');
  assert.deepEqual(r.candidates.map(c => [c.group, c.url]), [
    ['lost_rankings', `${SITE}/publications/lost-page`],
    ['priority', `${SITE}/publications/definitive-guide-web3-seo`],
    ['query', `${SITE}/publications/hyperliquid-analysis`],
  ]);
  const hyper = r.candidates[2];
  assert.equal(hyper.impressions, 310);                       // EN + BR + the #faq variant, one page
  assert.equal(hyper.reason, 'ctr_repair floor');
  assert.equal(hyper.languages.es, `${SITE}/es/articulos/analisis-hyperliquid`);
  assert.equal(hyper.decision_intent, true);                  // "vs"
  assert.equal(r.candidates[0].lost.drop, 5);
  assert.equal(r.candidates[1].hub, true);
  assert.deepEqual(r.excluded.path, [`${SITE}/publications/excluded-page`]);
  assert.deepEqual(r.excluded.no_edit_date, [`${SITE}/publications/no-date`]);
  assert.deepEqual(r.excluded.engine_cooldown, [`${SITE}/publications/cooled`]);
  assert.deepEqual(r.recently_edited.map(x => x.url), [`${SITE}/publications/recent-page`]);
  assert.ok(!r.candidates.some(c => c.url.endsWith('/defi-growth-guide')));   // priority, but only 70 days since its edit
  assert.equal(r.regressions.length, 1);
  assert.equal(r.regressions[0].refreshed, refreshed);
  assert.equal(r.regressions[0].impressions.page, -80);       // 10/day -> 2/day; the "cooled-other" URL is not read as this page
  assert.equal(r.regressions[0].lost_queries[0].query, 'cooled query');
  const calls = readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  // the argv shape the real CLI accepts (v4q.ts: `gsc <slug>` positional for the property, global --client for the client gate;
  // verified live 2026-10-14: without --client the Mac-side v4q answers "client required")
  for (const c of calls) {
    assert.deepEqual(c.slice(-2), ['--client', 'mangabeira']);
    assert.equal(c.filter(x => x === '--client').length, 1);
    if (c[0] === 'gsc') { assert.equal(c[1], 'mangabeira'); assert.ok(c.includes('--dimensions') && c.includes('--limit')); assert.ok(c.includes('--days') !== c.includes('--start')); }
    else assert.deepEqual(c.slice(0, 2), ['list', 'ce_content']);
  }
  assert.ok(calls.some(c => c[0] === 'gsc' && c.includes('--start') && c.includes('--end')));
  assert.ok(calls.some(c => c[0] === 'gsc' && c.includes('--contains') && c[c.indexOf('--contains') + 1] === 'page=/publications/cooled'));
});

test('slot_plan static-git: a page already live before the week counts in its own week (pages.json created_at, any language)', () => {
  const ws = workspace(); const start = ago(1);
  writeFileSync(join(ws, '_context', 'desk-quotas.json'), JSON.stringify({ strategy_version: 't', desks: [{ desk: 'site-seo', weekly_target: { evergreen_pages: 2, refreshes: 1 } }] }));
  const cid = n => `0000000${n}-0000-0000-0000-000000000000`;
  const fx = join(ws, 'v4q.json');
  writeFileSync(fx, JSON.stringify({ gsc: {}, lists: {
    commissions: [
      { id: cid(1), props: { Commission: 'old page', 'Primary Channel': 'Website', 'Content Type': 'Article', Status: 'Approved', 'date:Target Date:start': ago(0) } },
      { id: cid(2), props: { Commission: 'new page', 'Primary Channel': 'Website', 'Content Type': 'Article', Status: 'Approved', 'date:Target Date:start': ago(0) } },
      { id: cid(3), props: { Commission: 'x | Refresh | y', 'Primary Channel': 'Website', 'Content Type': 'Refresh', Status: 'Approved', 'date:Target Date:start': ago(0) } },
    ],
    ce_content: [
      { id: 'c1', props: { Status: 'Published', 'Primary CMS URL': `${SITE}/publications/lost-page`, 'Commission Relation': cid(1) } },
      { id: 'c2', props: { Status: 'Published', 'Primary CMS URL': `${SITE}/br/artigos/nova-pagina`, 'Commission Relation': cid(2) } },
    ] } }));
  const log = join(ws, 'calls.log');
  const plan = JSON.parse(run('slot_plan.mjs', ['--context', join(ws, '_context'), '--week-start', start, '--client', 'mangabeira', '--json'], { FAKE_V4Q: fx, FAKE_V4Q_LOG: log, V4Q_CLIENT: '' })).plan;
  const calls = readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.deepEqual(calls.map(c => [c[0], c[1], ...c.slice(-2)]), [['list', 'commissions', '--client', 'mangabeira'], ['list', 'ce_content', '--client', 'mangabeira']]);
  assert.deepEqual(plan['site-seo:evergreen_pages'], { target: 2, counted: 1, open: 1, ids: ['00000002'] });   // the old page went live 200 days ago
  assert.equal(plan['site-seo:refreshes'].counted, 1);
});

// WordPress (EkkoGreen): the unchanged path, against a local WordPress
async function wordpress(handler) {
  const srv = createServer(handler); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => srv.close(r)) };
}
const runAsync = (script, args, env) => new Promise((res, rej) => {
  import('node:child_process').then(({ execFile }) => execFile(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8', env: { ...process.env, V4Q_BIN: FAKE, ...env } }, (e, out, err) => e ? rej(new Error(err || e.message)) : res(out)));
});

test('refresh_select WordPress path (EkkoGreen) is unchanged: posts from REST, categories excluded', async () => {
  const wp = await wordpress((req, res) => {
    const page = new URL(req.url, 'http://x').searchParams.get('page');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(page === '1' ? [
      { link: `${wp.url}/carro-eletrico/`, modified: `${ago(200)}T10:00:00`, date: `${ago(400)}T10:00:00`, categories: [5], title: { rendered: 'Carro el&eacute;trico' } },
      { link: `${wp.url}/noticia-solar/`, modified: `${ago(200)}T10:00:00`, date: `${ago(400)}T10:00:00`, categories: [123], title: { rendered: 'News' } },
    ] : []));
  });
  try {
    const ws = mkdtempSync(join(tmpdir(), 'wp-')); const ctx = join(ws, '_context'); mkdirSync(ctx);
    writeFileSync(join(ctx, 'refresh-rules.json'), JSON.stringify({ site: wp.url, exclude_category_ids: [123], window_days: 90, min_impressions: 500, position: [5.5, 10.5], edited_cooldown_days: 60, top: 10 }));
    const fx = join(ws, 'v4q.json');
    writeFileSync(fx, JSON.stringify({ gsc: {
      page: [{ page: `${wp.url}/carro-eletrico/`, impressions: 900, clicks: 0, position: 8 }, { page: `${wp.url}/noticia-solar/`, impressions: 900, clicks: 1, position: 8 }, { page: `${wp.url}/`, impressions: 900, clicks: 90, position: 8 }],
      'page,query': [{ page: `${wp.url}/carro-eletrico/`, query: 'melhor carro eletrico', impressions: 500, clicks: 0, position: 8 }],
    }, lists: { ce_content: [] } }));
    const r = JSON.parse(await runAsync('refresh_select.mjs', ['--client', 'portal-ekkogreen', '--context', ctx, '--json'], { FAKE_V4Q: fx }));
    assert.equal(r.cms, undefined);
    assert.deepEqual(r.candidates.map(c => [c.url, c.title, c.decision_intent]), [[`${wp.url}/carro-eletrico/`, 'Carro el&eacute;trico', true]]);
  } finally { await wp.close(); }
});

test('slot_plan WordPress path (EkkoGreen) is unchanged: post date from REST', async () => {
  const wp = await wordpress((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(/slug=velho/.test(req.url) ? [{ date: `${ago(30)}T10:00:00` }] : [{ date: `${ago(0)}T10:00:00` }])); });
  try {
    const ws = mkdtempSync(join(tmpdir(), 'wp-')); const ctx = join(ws, '_context'); mkdirSync(ctx);
    writeFileSync(join(ctx, 'desk-quotas.json'), JSON.stringify({ desks: [{ desk: 'site-seo', weekly_target: { evergreen_pages: 2, refreshes: 1 } }] }));
    const cid = n => `0000000${n}-0000-0000-0000-000000000000`;
    const fx = join(ws, 'v4q.json');
    writeFileSync(fx, JSON.stringify({ gsc: {}, lists: {
      commissions: [1, 2].map(n => ({ id: cid(n), props: { Commission: `p${n}`, 'Primary Channel': 'Website', 'Content Type': 'Article', Status: 'Approved', 'date:Target Date:start': ago(0) } })),
      ce_content: [{ id: 'a', props: { Status: 'Published', 'Primary CMS URL': `${wp.url}/velho/`, 'Commission Relation': cid(1) } }, { id: 'b', props: { Status: 'Published', 'Primary CMS URL': `${wp.url}/novo/`, 'Commission Relation': cid(2) } }] } }));
    const log = join(ws, 'calls.log');
    const plan = JSON.parse(await runAsync('slot_plan.mjs', ['--context', ctx, '--week-start', ago(1), '--json'], { FAKE_V4Q: fx, FAKE_V4Q_LOG: log, V4Q_CLIENT: 'portal-ekkogreen' })).plan;
    assert.deepEqual(plan['site-seo:evergreen_pages'].ids, ['00000002']);
    const calls = readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    assert.ok(calls.length === 2 && calls.every(c => c.slice(-2).join(' ') === '--client portal-ekkogreen'));   // V4Q_CLIENT becomes the flag
  } finally { await wp.close(); }
});
