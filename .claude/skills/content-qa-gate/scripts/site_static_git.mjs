/**
 * site_static_git.mjs - read a static-git site checkout (mangabeira.net) the way refresh_select.mjs and slot_plan.mjs read
 * WordPress (2026-10-14).
 *
 * Checkout layout (gogrowth-co/mangabeira, on the VPS <workspace>/site):
 *   content/pages.json                 [{ id, slug, category, status, is_system_page, created_at, updated_at, ... }]
 *   content/{en,br,es}/<lang-slug>.json { page_id, language, slug, title, created_at, updated_at, ... }
 * Public URLs: EN https://<site>/publications/<slug>, BR /br/artigos/<br-slug>, ES /es/articulos/<es-slug>.
 *
 * Which adapter a script uses: --cms static-git [--site-dir <checkout>] on the command line, or "cms": "static-git"
 * [, "site_dir": "<path, relative to the workspace>"] in <context>/refresh-rules.json. Without either, WordPress (unchanged).
 * The default checkout is <context>/../site (the workspace's own site/ folder).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export const PREFIX = { en: '/publications/', br: '/br/artigos/', es: '/es/articulos/' };
export const LANGS = Object.keys(PREFIX);

/** The adapter a run uses: { cms: 'wordpress' | 'static-git', siteDir }. Flags win over the rules file. */
export function resolveSite(argv, ctx) {
  const arg = k => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : undefined; };
  let fileRules = {};
  try { if (ctx && existsSync(join(ctx, 'refresh-rules.json'))) fileRules = JSON.parse(readFileSync(join(ctx, 'refresh-rules.json'), 'utf8')); } catch { /* the caller reports a broken rules file */ }
  const cms = arg('--cms') || fileRules.cms || 'wordpress';
  if (!['wordpress', 'static-git'].includes(cms)) throw new Error(`unknown --cms "${cms}" (wordpress | static-git)`);
  const workspace = ctx ? dirname(resolve(ctx)) : process.cwd();
  const given = arg('--site-dir') || fileRules.site_dir;
  const siteDir = cms === 'static-git' ? (given ? (isAbsolute(given) ? given : resolve(workspace, given)) : join(workspace, 'site')) : null;
  return { cms, siteDir };
}

/** URL or path -> the path the checkout maps: no query, no fragment, no trailing slash, decoded. */
export function pathOf(u) {
  let p = String(u);
  try { p = new URL(p, 'https://x.invalid').pathname; } catch { p = p.replace(/[?#].*$/, ''); }
  try { p = decodeURIComponent(p); } catch { /* keep it encoded */ }
  p = p.replace(/\/+$/, '');
  return p || '/';
}

const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/**
 * Load the checkout. Returns { pages: Map(id -> page), byPath: Map(path -> { page, lang }) } where page =
 * { id, slug, category, status, system, created, updated, edited, title, langs: { en|br|es: { slug, title, path, updated, created } } }.
 * `edited` = the latest updated_at of the page row and its language rows (the three languages ship together, so an edit of
 * any language is an edit of the page). Pages without any updated_at have edited = null.
 */
export function loadCheckout(siteDir) {
  const content = join(siteDir, 'content');
  const pagesFile = join(content, 'pages.json');
  if (!existsSync(pagesFile)) throw new Error(`static-git: ${pagesFile} not found (is --site-dir the site checkout?)`);
  const raw = JSON.parse(readFileSync(pagesFile, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.pages || [];
  const pages = new Map(), bySlug = new Map(), byPath = new Map();
  for (const p of list) {
    if (!p?.id || !p.slug) continue;
    const page = { id: p.id, slug: p.slug, category: p.category ?? null, status: p.status ?? null, system: !!p.is_system_page,
      created: day(p.created_at), updated: day(p.updated_at), edited: null, title: '', langs: {} };
    pages.set(p.id, page); bySlug.set(p.slug, page);
  }
  for (const lang of LANGS) {
    const dir = join(content, lang);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      let row; try { row = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
      const slug = row.slug || f.replace(/\.json$/, '');
      const page = (row.page_id && pages.get(row.page_id)) || (lang === 'en' ? bySlug.get(slug) : null);
      if (!page) continue;
      page.langs[lang] = { slug, title: String(row.title || ''), path: PREFIX[lang] + slug, updated: day(row.updated_at), created: day(row.created_at) };
      if (lang === 'en') page.title = String(row.title || '');
    }
  }
  for (const page of pages.values()) {
    if (!page.langs.en) page.langs.en = { slug: page.slug, title: page.title, path: PREFIX.en + page.slug, updated: null, created: null };
    const dates = [page.updated, ...Object.values(page.langs).map(l => l.updated)].filter(Boolean).sort();
    page.edited = dates.pop() ?? null;
    for (const [lang, l] of Object.entries(page.langs)) byPath.set(l.path, { page, lang });
    if (page.system) byPath.set('/' + page.slug, { page, lang: 'en' });   // system pages (about, privacy-policy) live at /<slug>
  }
  return { pages, byPath };
}

/** The page a public URL (or path) belongs to, or null. */
export function pageOf(checkout, url) { return checkout.byPath.get(pathOf(url)) ?? null; }

/** Canonical public URLs of a page, per language. */
export function urlsOf(page, site) {
  const base = String(site).replace(/\/+$/, '');
  return Object.fromEntries(Object.entries(page.langs).map(([lang, l]) => [lang, base + l.path]));
}
