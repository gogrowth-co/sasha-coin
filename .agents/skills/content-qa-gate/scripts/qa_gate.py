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
import argparse, json, os, re, sys, time
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
    url_q = url + ('&' if '?' in url else '?') + f'qa={int(time.time())}'   # fresh query: an edge cache outlives purges
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


def sitemap_urls(url, limit):
    xml = fetch(url)
    locs = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', xml)
    if any(l.endswith('.xml') or 'sitemap' in l.rsplit('/', 1)[-1] for l in locs):   # an index: read the post sitemaps first
        out = []
        for sm in locs:
            if re.search(r'post|blog|article|news', sm) or len(locs) < 4:
                out += re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', fetch(sm))
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
    d = sub.add_parser('draft'); d.add_argument('--html', required=True); d.add_argument('--title', required=True)
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
        out = G.finalize([G.audit_core(a.url.rstrip('/').split('/')[-1], a.url, a.title, a.title, a.meta, open(a.html).read(), a.type,
                                       live_html=None, short_update=a.short_update)])
        report(out)
    elif a.mode == 'live':
        out = G.finalize([live_one(G, C, a.url, a.type)])
        report(out)
    else:
        urls = sitemap_urls(a.sitemap, a.limit) if a.sitemap else [u.strip() for u in open(a.urls) if u.strip()][:a.limit]
        cache, out = {}, []
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
