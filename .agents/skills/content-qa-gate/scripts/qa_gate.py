"""Content QA gate for ANY project (CMS-agnostic CLI over qa_core). Exit 0 = PASS, 1 = FAIL.

  python3 qa_gate.py --contract <project>/_context/content-contract.json plan  plan.json
  python3 qa_gate.py --contract ... draft --html body.html --title "..." --meta "..." --type article --url https://site/slug/
  python3 qa_gate.py --contract ... live  https://site/slug/ [--type product]
  python3 qa_gate.py --contract ... sweep --sitemap https://site/sitemap.xml [--limit 40] | --urls urls.txt

The contract names the site (`site`), the internal domain, the article body tag (`audit.body_selector`) and every threshold.
Live/sweep read what a reader and a crawler get: the rendered page (title, meta, og:image, ld+json) and its article body.
Page types for live/sweep come from --type, the contract's `audit.type_rules` ([{"pattern": regex on the URL path, "type"}]),
or `audit.default_type`.
"""
import argparse, json, os, re, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_core
from qa_core import Gate, body_of, fetch, head_fields, strip_tags


def type_for(C, url, override=None):
    if override:
        return override
    path = re.sub(r'^https?://[^/]+', '', url)
    for rule in C.get('audit', {}).get('type_rules', []):
        if re.search(rule['pattern'], path):
            return rule['type']
    return C.get('audit', {}).get('default_type')


def live_one(G, C, url, t=None, cache=None):
    base, _, frag = url.partition('#')   # the query goes before any #fragment, or the server never sees it
    url_q = base + ('&' if '?' in base else '?') + f'qa={int(time.time())}' + ('#' + frag if frag else '')   # fresh query: an edge cache outlives purges
    if C.get('audit', {}).get('render_js'):   # client-rendered site (SPA): read the DOM a browser builds, not the empty shell
        import subprocess
        here = os.path.dirname(os.path.abspath(__file__))
        mkt = os.path.abspath(os.path.join(here, '..', '..', '..', '..'))
        r = subprocess.run(['node', os.path.join(here, 'render.cjs'), url_q], capture_output=True, text=True, timeout=180,
                           env={**os.environ, 'NODE_PATH': os.environ.get('NODE_PATH') or os.path.join(mkt, 'node_modules')})
        if r.returncode != 0:
            raise RuntimeError('render failed: ' + r.stderr[-200:])
        page = r.stdout
    else:
        page = fetch(url_q)
    title, meta, og = head_fields(page)
    body = body_of(page, C.get('audit', {}).get('body_selector'))
    m = re.search(r'<h1\b[^>]*>(.*?)</h1>', body, re.S) or re.search(r'<h1\b[^>]*>(.*?)</h1>', page, re.S)   # the article's H1, not a shell/logo H1
    headline = strip_tags(m.group(1)) if m else title
    if C.get('audit', {}).get('strip_h1_from_body', True):
        body = re.sub(r'<h1\b.*?</h1>', '', body, flags=re.S)
    slug = re.sub(r'^https?://[^/]+', '', url).strip('/').split('/')[-1]
    return G.audit_core(slug, url, headline, title, meta, body, type_for(C, url, t), live_html=page, link_cache=cache, cover=og)


def sitemap_urls(url, limit, failed=None):
    """Page URLs from a sitemap or sitemap index. Sub-sitemaps that cannot be read go into `failed` (the sweep fails on them)."""
    try:
        xml = fetch(url)
    except Exception as e:
        raise SystemExit(f'FAIL  sitemap unreachable: {url} ({e!r:.160})')
    locs = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', xml)
    if any(l.endswith('.xml') or 'sitemap' in l.rsplit('/', 1)[-1] for l in locs):   # an index: read the post sitemaps first
        out = []
        for sm in locs:
            if re.search(r'post|blog|article|news', sm) or len(locs) < 4:
                try:
                    out += re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', fetch(sm))
                except Exception as e:   # the rest still get checked, but a partial sweep is never a PASS
                    if failed is not None:
                        failed.append((sm, repr(e)[:160]))
                    else:
                        print(f'WARN  sub-sitemap unreachable: {sm} ({e!r:.160})', file=sys.stderr)
        locs = [l for l in out if not l.endswith('.xml')]
    return locs[:limit]


def report(results):
    for r in results:
        print(f"{r['verdict']}  {str(r['type'])[:13]:<13} {r['url'][:70]:<70} words {r['words']} il {r['internal_unique']} el {r['external_unique']} v {r['visuals']}")
        for f in r['findings']:
            print(f"     {f['severity']:<5} {f['check']}: {f['message'][:170]}")
    fails = sum(r['verdict'] == 'FAIL' for r in results)
    print(f'\n{len(results) - fails} PASS, {fails} FAIL')
    return fails


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--contract', required=True)
    ap.add_argument('--out', help='write the JSON report here')
    sub = ap.add_subparsers(dest='mode', required=True)
    p = sub.add_parser('plan'); p.add_argument('file')
    d = sub.add_parser('draft'); d.add_argument('--manifest', help='package manifest.json (default: next to --html)'); d.add_argument('--html', required=True); d.add_argument('--title', required=True)
    d.add_argument('--meta', required=True); d.add_argument('--type', required=True); d.add_argument('--url', required=True)
    d.add_argument('--short-update')
    l = sub.add_parser('live'); l.add_argument('url'); l.add_argument('--type')
    s = sub.add_parser('sweep'); s.add_argument('--sitemap'); s.add_argument('--urls'); s.add_argument('--limit', type=int, default=40)
    a = ap.parse_args()
    C = json.load(open(a.contract))
    if not C.get('site'):
        raise SystemExit('the contract has no "site" (https://domain)')
    G = Gate(C, C['site'], C.get('internal_domain'))
    if a.mode == 'plan':
        res = G.audit_plan(json.load(open(a.file)))
        print(json.dumps(res, ensure_ascii=False, indent=1))
        out = [res]
    elif a.mode == 'draft':
        draft_body = open(a.html).read()
        # visual types come from the package manifest's slots when the figures carry no data-* annotation
        manifest_path = getattr(a, 'manifest', None) or os.path.join(os.path.dirname(os.path.abspath(a.html)), 'manifest.json')
        if os.path.exists(manifest_path):
            G.manifest = G._load_manifest(manifest_path)
        draft_cover = head_fields(draft_body)[2]
        # Producer packages can retain the producer's absolute workspace path
        # in og:image. Draft QA must inspect the package copy, when present,
        # rather than treating that stale path as proof that the cover is absent.
        if draft_cover and not urllib.parse.urlsplit(draft_cover).scheme and not os.path.exists(draft_cover):
            package_cover = os.path.join(os.path.dirname(os.path.abspath(a.html)), 'assets', os.path.basename(draft_cover))
            if os.path.exists(package_cover):
                draft_cover = package_cover
        out = G.finalize([G.audit_core(a.url.rstrip('/').split('/')[-1], a.url, a.title, a.title, a.meta, draft_body, a.type,
                                       live_html=None, short_update=a.short_update, cover=draft_cover)])
        report(out)
    elif a.mode == 'live':
        try:
            out = G.finalize([live_one(G, C, a.url, a.type)])
        except Exception as e:   # a fetch or render failure is a FAIL with its reason, never a traceback
            out = [{'url': a.url, 'type': a.type, 'words': 0, 'internal_unique': 0, 'external_unique': 0, 'visuals': 0,
                    'verdict': 'FAIL', 'findings': [{'check': 'fetch', 'severity': 'block', 'message': repr(e)[:200]}]}]
        report(out)
    else:
        failed = []
        # listing pages (home, blog index, categories, tags, authors, pagination) are not articles: never judged as one
        # listing routes only: /blog/<slug> articles stay in (a site whose articles live under /blog/ keeps its whole content set)
        skip = re.compile(C.get('audit', {}).get('sweep_exclude',
                          r'^/?$|^/(blog|noticias|news|artigos|articles)/?$|^/(category|categoria|tag|author|autor)/|/page/\d+/?$'))
        keep = lambda u: not skip.search(re.sub(r'^https?://[^/]+', '', u) or '/')
        urls = [u for u in (sitemap_urls(a.sitemap, 10 ** 9, failed) if a.sitemap else [u.strip() for u in open(a.urls) if u.strip()]) if keep(u)][:a.limit]   # filter, then limit
        cache, out = {}, []
        if not urls:   # nothing to audit is not a pass
            out.append({'url': a.sitemap or a.urls, 'type': None, 'words': 0, 'internal_unique': 0, 'external_unique': 0, 'visuals': 0,
                        'verdict': 'FAIL', 'findings': [{'check': 'sweep_empty', 'severity': 'block', 'message': 'no article URLs left to audit after excluding listing pages'}], '_paras': []})
        for sm, err in failed:
            out.append({'url': sm, 'type': 'sitemap', 'words': 0, 'internal_unique': 0, 'external_unique': 0, 'visuals': 0,
                        'verdict': 'FAIL', 'findings': [{'check': 'sitemap', 'severity': 'block', 'message': 'sub-sitemap unreachable: ' + err}],
                        '_paras': []})
        for u in urls:
            try:
                out.append(live_one(G, C, u, cache=cache))
            except Exception as e:
                out.append({'url': u, 'type': None, 'words': 0, 'internal_unique': 0, 'external_unique': 0, 'visuals': 0, 'verdict': 'FAIL',
                            'findings': [{'check': 'fetch', 'severity': 'block', 'message': repr(e)[:200]}], '_paras': []})
        out = G.finalize(out)
        report(out)
    if a.out:
        json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
    sys.exit(0 if all(r['verdict'] == 'PASS' for r in out) else 1)
