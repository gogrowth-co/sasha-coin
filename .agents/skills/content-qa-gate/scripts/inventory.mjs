/**
 * inventory.mjs - the project's content inventory, and the measured "is this new?" check every brief passes before Gabriel sees it
 * (2026-10-09). Zero model calls, project-agnostic.
 *
 * Root cause it removes: two approved Pinterest groups reached production and were then refused by the producer as repeats of pins
 * already published, and briefs declared their own uniqueness ("uniqueness": "checked") with nothing measured behind it.
 *
 * Inventory = everything the project already has or is making:
 *   site     every URL in the site's sitemaps (posts and pages), titled by its slug
 *   ce       every Content Engine card (any channel, any status except Rejected/Archived), name + caption + destination
 *   pitch    every Commission in flight (not Rejected/Archived/Exported), title + hook/angle/title from its Payload JSON
 *   published every post live on Pinterest and LinkedIn in the last 365 days (Zernio, incl. posts made outside V4), with its links
 * Similarity: overlap coefficient of normalized content words (accents, stopwords and plural endings removed):
 *   |A ∩ B| / min(|A|, |B|). Both sides need >= 2 content words.
 *
 *   import { loadInventory, overlap, tokens } from './inventory.mjs'
 *   node inventory.mjs --context <project>/_context --text "compostagem sem cheiro" [--channel pinterest]   (CLI: top matches)
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

const STOP = new Set(('a o as os um uma uns umas de do da dos das no na nos nas em por para pra com sem sobre entre e ou que se seu sua seus suas ' +
  'ao aos à às é ser são foi como mais menos muito muita já não sim isso esse essa este esta aqui ali lá quando onde qual quais quem ' +
  'the and for with your you how what why from this that are was guia grupo carrossel instagram pinterest linkedin newsletter news ' +
  'refresh evergreen seo aeo website programatico post posts pin pins mon tue wed thu fri sat sun voce vocês voces ter tem ' +
  'ate até tudo todo toda todos todas cada pelo pela pelos pelas mesmo mesma depois antes agora ainda também tambem ' +
  'comecar começar comeca começa dica dicas passo passos saiba veja entenda precisa pergunta perguntas forma jeito coisa').split(/\s+/));

export function tokens(text) {
  const t = String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/https?:\/\/[^\s/]+\//g, ' ').replace(/[^a-z0-9]+/g, ' ');
  const out = new Set();
  for (let w of t.split(/\s+/)) {
    if (w.length < 3 || STOP.has(w) || /^\d{4}$|^\d{1,2}$/.test(w)) continue;
    w = w.replace(/(oes|aes)$/, 'ao').replace(/(ais)$/, 'al').replace(/(eis)$/, 'el').replace(/(is)$/, 'il').replace(/(ns)$/, 'm').replace(/(es|s)$/, '');
    if (w.length >= 3 && !STOP.has(w)) out.add(w.length > 7 ? w.slice(0, 7) : w);   // light stem: compostagem/composteira, eletrico/eletrica
  }
  return out;
}

/** {score, shared}: overlap coefficient of content words; 0 when either side has fewer than 2 words */
export function overlap(a, b) {
  const A = a instanceof Set ? a : tokens(a), B = b instanceof Set ? b : tokens(b);
  if (A.size < 2 || B.size < 2) { const shared = [...A].filter(x => B.has(x)); return { score: shared.length && Math.min(A.size, B.size) ? shared.length / Math.max(1, Math.min(A.size, B.size)) * (Math.min(A.size, B.size) < 2 ? 0.5 : 1) : 0, shared }; }
  const shared = [...A].filter(x => B.has(x));
  return { score: shared.length / Math.min(A.size, B.size), shared };
}

const slugTitle = u => { try { return decodeURIComponent(new URL(u).pathname).replace(/[/-]+/g, ' ').trim(); } catch { return String(u); } };
const locs = x => [...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
const flat = x => Array.isArray(x) ? x.map(flat).join(' ') : x && typeof x === 'object' ? Object.values(x).map(flat).join(' ') : String(x ?? '');

async function siteUrls(sitemapIndex) {
  // a sitemap that does not answer fails the inventory (never a silently empty site, which would pass every repeat check)
  const get = async u => { const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 content-qa-gate' }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`sitemap ${u} -> HTTP ${r.status}`); return r.text(); };
  const maps = locs(await get(sitemapIndex)).filter(m => /post-sitemap|page-sitemap|sitemap-posts|sitemap-pages|wp-sitemap-posts/.test(m));
  if (!maps.length) throw new Error(`sitemap index ${sitemapIndex} lists no post/page sitemaps`);
  return [...new Set((await Promise.all(maps.map(get))).flatMap(locs))];
}

// published history from the distribution tools (what is live on the channel, including posts made outside V4)
function envKey(ctx, name) {
  if (process.env[name]) return process.env[name];
  try { const m = readFileSync(join(ctx, '..', '.env'), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm')); return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null; } catch { return null; }
}
async function zernioPublished(ctx, ownDomain) {
  let cfg; try { cfg = JSON.parse(readFileSync(join(ctx, 'zernio-accounts.json'), 'utf8')); } catch { return []; }
  const key = envKey(ctx, cfg.api_key_env || 'ZERNIO_API_KEY'); if (!key) return [];
  const from = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const platform of ['pinterest', 'linkedin']) for (const source of ['zernio', 'external']) {
    for (let page = 1; page < 30; page++) {
      const q = new URLSearchParams({ page, limit: 100, platform, status: 'published', fromDate: from, source });
      let d; try { const r = await fetch('https://zernio.com/api/v1/posts?' + q, { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(60000) }); if (!r.ok) break; d = await r.json(); } catch { break; }
      for (const p of d.posts || []) {
        const pl = (p.platforms || []).find(x => x.platform === platform) || {};
        // the project's own links (its domain comes from the caller: contract links.own_domain or the sitemap host)
        const links = [...new Set(JSON.stringify(p).match(/https?:\/\/[^\s"'\\]+/g) || [])].filter(u => { try { const h = new URL(u).host.replace(/^www\./, ''); return ownDomain && (h === ownDomain || h.endsWith('.' + ownDomain)) && !/\/wp-content\//.test(u); } catch { return false; } });
        const title = pl.platformSpecificData?.title || p.title || '';
        out.push({ source: 'published', channel: platform, status: 'Published', date: String(pl.publishedAt || p.scheduledFor || '').slice(0, 10), title: (title || String(p.content || '')).slice(0, 140),
          url: pl.platformPostUrl || '', links, text: [title, p.content, links.map(slugTitle).join(' ')].filter(Boolean).join(' ') });
      }
      if (!d.pagination || page >= (d.pagination.pages || 1)) break;
    }
  }
  return out;
}

function v4qAll(base) {
  const bin = process.env.V4Q_BIN || (existsSync(join(homedir(), '.local/bin/v4q')) ? join(homedir(), '.local/bin/v4q') : 'v4q');
  const recs = [];
  for (let offset = 0; ;) {
    const out = JSON.parse(execFileSync(bin, ['list', base, '--limit', '200', '--offset', String(offset)], { encoding: 'utf8', maxBuffer: 64 << 20 }));
    if (out.ok === false) throw new Error(out.error);
    recs.push(...out.records);
    if (!out.has_more) return recs;
    offset = out.next_offset;
  }
}

/**
 * Loads (and caches for maxAgeMin in <workspace>/qa/.cache/content-inventory.json) the project's inventory.
 * opts: { sitemapIndex, ownDomain, maxAgeMin = 60, offline }  -> [{ source, channel, status, date, title, url, id, text }]
 */
export async function loadInventory(ctx, opts = {}) {
  // cache in the workspace's qa/ folder: _context (contracts, strategy) is read-only for production runs
  const cacheDir = join(ctx, '..', 'qa', '.cache'); try { mkdirSync(cacheDir, { recursive: true }); } catch {}
  const cache = join(cacheDir, 'content-inventory.json');
  const maxAge = (opts.maxAgeMin ?? 60) * 60e3;
  const ownDomain0 = opts.ownDomain || (() => { try { return new URL(opts.sitemapIndex).host.replace(/^www\./, ''); } catch { return null; } })();
  const cacheKey = JSON.stringify({ v: 2, sitemapIndex: opts.sitemapIndex || null, ownDomain: ownDomain0, offline: !!opts.offline });   // v: bump when the item shape changes (v2: pitch url)
  if (existsSync(cache) && Date.now() - statSync(cache).mtimeMs < maxAge) {
    try { const c = JSON.parse(readFileSync(cache, 'utf8')); if (c.key === cacheKey) return c.items; } catch { /* rebuild */ }
  }
  const items = [];
  if (opts.sitemapIndex && !opts.offline) {
    for (const u of await siteUrls(opts.sitemapIndex)) items.push({ source: 'site', channel: 'website', status: 'Published', url: u, title: slugTitle(u), text: slugTitle(u) });
  }
  const ownDomain = opts.ownDomain || (() => { try { return new URL(opts.sitemapIndex).host.replace(/^www\./, ''); } catch { return null; } })();
  if (!opts.offline) items.push(...await zernioPublished(ctx, ownDomain));
  const dead = s => ['Rejected', 'Archived'].includes(s);
  for (const r of v4qAll('ce_content')) {
    const p = r.props; if (dead(p.Status)) continue;
    items.push({ source: 'ce', id: r.id, commission: flat(p['Commission Relation']), channel: String(p['Primary Channel'] || '').toLowerCase(), status: p.Status,
      date: p['date:Target Date:start'] || null, title: p.Name || '', url: p['Primary CMS URL'] || p['Destination URL'] || '',
      text: [p.Name, p.Caption].filter(Boolean).join(' ') });
  }
  // a pitch's page: its own existing_url, else the URL of the card produced from it (older refresh pitches carry no URL, so a
  // repair of the same page looked like a repeat of it and the gate pushed the writer to "a different angle", 2026-10-13)
  const cardUrlOf = new Map(items.filter(i => i.source === 'ce' && i.url).flatMap(i => String(i.commission || '').match(/[0-9a-f]{8}-[0-9a-f-]{27}|[0-9a-f]{32}/g)?.map(c => [c.replace(/-/g, ''), i.url]) || []));
  for (const r of v4qAll('commissions')) {
    const p = r.props; if (dead(p.Status) || p.Status === 'Exported') continue;
    let pay = {}; try { const raw = p['Payload JSON']; pay = raw && typeof raw === 'object' ? raw : JSON.parse(raw || '{}'); } catch {}
    const hooks = Array.isArray(pay.pin_specs) ? pay.pin_specs.map(s => s?.hook).join(' ') : '';
    items.push({ source: 'pitch', id: r.id, channel: String(p['Primary Channel'] || '').toLowerCase(), status: p.Status, date: p['date:Target Date:start'] || null,
      title: p.Commission || '', url: pay.existing_url || cardUrlOf.get(String(r.id).replace(/-/g, '')) || '', text: [p.Commission, pay.title, pay.hook, pay.angle, hooks].filter(Boolean).join(' ') });
  }
  try { writeFileSync(cache, JSON.stringify({ key: cacheKey, built_at: new Date().toISOString(), count: items.length, items })); } catch { /* read-only ctx: no cache */ }
  return items;
}

/**
 * Top matches of `text` in the inventory. opts: { channel, excludeIds:Set, sources:[...], sinceDays, threshold }
 * A match from the same channel (or the site, for site articles) at >= threshold is a repeat.
 */
export function matches(items, text, opts = {}) {
  const T = text instanceof Set ? text : tokens(text); const since = opts.sinceDays ? new Date(Date.now() - opts.sinceDays * 864e5).toISOString().slice(0, 10) : null;
  return items
    .filter(i => (!opts.sources || opts.sources.includes(i.source)) && (!opts.channel || i.channel === opts.channel || i.source === 'site' && opts.channel === 'website'))
    .filter(i => !opts.excludeIds || !(opts.excludeIds.has(i.id) || [...opts.excludeIds].some(x => x && String(i.commission || '').includes(x))))
    .filter(i => !since || i.source === 'site' || !i.date || i.date >= since)
    .map(i => ({ ...i, ...overlap(T, tokens(i.text)) }))
    .filter(i => i.score >= (opts.threshold ?? 0))
    .sort((a, b) => b.score - a.score);
}

// ---- CLI ----
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
  const ctx = arg('--context'); const text = arg('--text');
  if (!ctx || !text) { console.error('inventory: --context and --text are required'); process.exit(2); }
  let sitemapIndex = null; try { sitemapIndex = JSON.parse(readFileSync(join(ctx, 'pin-contract.json'), 'utf8')).destination?.article_sitemap_index; } catch {}
  const items = await loadInventory(ctx, { sitemapIndex, maxAgeMin: Number(arg('--max-age', '60')) });
  const top = matches(items, text, { channel: arg('--channel'), threshold: 0.34 }).slice(0, 12);
  console.log(`inventory: ${items.length} items; tokens [${[...tokens(text)].join(' ')}]`);
  for (const m of top) console.log(`  ${m.score.toFixed(2)} ${m.source}/${m.channel} ${m.status} ${m.date ?? ''} ${m.title.slice(0, 80)} ${m.url ?? ''} [${m.shared.join(' ')}]`);
}
