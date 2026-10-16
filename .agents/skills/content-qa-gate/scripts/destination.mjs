/**
 * destination.mjs - shared destination checks for every format that links to the site (pins, LinkedIn, newsletter, briefs).
 * Policy comes from the format contract's `destination` block (see portal-ekkogreen/_context/pin-contract.json):
 *   required, forbid_redirect, article_sitemap_index, article_sitemap_pattern, hub_sitemap_pattern, allow_patterns, forbid_patterns,
 *   external_allowed (a URL on another host, e.g. the primary source, passes on live + form alone; default false).
 * A destination passes when it answers 200 (no redirect if forbidden), is an article in the post sitemaps (or an allowed
 * tool page), is not a hub page, and matches no forbidden form. Used by pin_qa.mjs and brief_gate.mjs.
 */
import { check } from './creative_measure.mjs';

const UA = { 'User-Agent': 'Mozilla/5.0 content-qa-gate' };
const locs = x => [...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
export const plain = u => { try { const x = new URL(u); return `${x.origin}${x.pathname}`.replace(/\/?$/, '/'); } catch { return u; } };

export function destinationChecker(D, { offline = false } = {}) {
  let articleSet = null, hubSet = null;
  const fetchText = async u => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); return r.ok ? r.text() : ''; };
  async function load() {
    if (offline || !D?.article_sitemap_index) return;
    const idx = await fetchText(D.article_sitemap_index + (D.article_sitemap_index.includes('?') ? '&' : '?') + 'qa=' + Date.now());
    const maps = locs(idx);
    const read = async re => new Set((await Promise.all(maps.filter(m => re.test(m)).map(fetchText))).flatMap(locs).map(plain));
    articleSet = await read(new RegExp(D.article_sitemap_pattern));
    hubSet = await read(new RegExp(D.hub_sitemap_pattern));
  }
  /** Adds rows (destination, destination_pattern, destination_live, destination_answers) and returns true when all pass. */
  async function checkUrl(rows, url) {
    const before = rows.length;
    if (!url) { check(rows, 'destination', !D?.required, 'no destination'); return !D?.required; }
    const bad = (D.forbid_patterns || []).filter(p => new RegExp(p, 'i').test(url));
    check(rows, 'destination_pattern', bad.length === 0, bad.length ? `forbidden destination form (${bad.join(', ')}): ${url}` : 'destination form ok');
    if (offline) { check(rows, 'destination_live', false, 'not checked (--offline)', false); return false; }
    try {
      const r = await fetch(url, { redirect: 'manual', headers: UA, signal: AbortSignal.timeout(30000) });
      const redirected = r.status >= 300 && r.status < 400;
      check(rows, 'destination_live', r.status === 200 || (redirected && !D.forbid_redirect),
        `HTTP ${r.status}${redirected ? ' -> ' + r.headers.get('location') : ''} ${url}`);
    } catch (e) { check(rows, 'destination_live', false, `fetch failed: ${String(e.message).slice(0, 100)}`); }
    const host = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
    if (D.external_allowed && D.article_sitemap_index && host(url) !== host(D.article_sitemap_index)) {
      check(rows, 'destination_answers', true, `external page (allowed on this channel): ${url}`);
      return rows.slice(before).every(r => r.result !== 'fail');
    }
    const p = plain(url), allowed = (D.allow_patterns || []).some(a => url.includes(a));
    const isArticle = articleSet?.has(p), isHub = hubSet?.has(p);
    check(rows, 'destination_answers', allowed || (isArticle && !isHub),
      allowed ? 'allowed tool/page' : isArticle ? 'an article in the post sitemap' : isHub ? `a hub page (page sitemap), not an article: ${p}` : `not in the site's post sitemaps: ${p}`);
    return rows.slice(before).every(r => r.result !== 'fail');
  }
  return { load, checkUrl };
}
