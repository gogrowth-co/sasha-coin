"""Project-agnostic content QA engine. Every threshold comes from the project's contract (JSON); nothing here is specific
to one site, CMS or language. Deterministic, no model, no spend.

Gates (same code at every stage, so a piece is judged the same way from plan to live page):
  1. plan   - before any prose:   Gate.audit_plan(plan)
  2. draft  - before QA Passed:   Gate.audit_core(... body html ..., live_html=None)
  3. live   - after publishing:   Gate.audit_core(... live_html=page ...) -> sets the card's QA
  4. sweep  - weekly, recent pages, batch checks (template boilerplate, shared product covers)

Contract shape: see ../contracts/contract-template.json (EkkoGreen's article-contract.json v1.4 uses the same schema).
Project adapters (e.g. ekkogreen-ce-publish/scripts/content_audit.py) supply the site, the corpus and CMS specifics.
"""
import collections, html, re, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/128 Safari/537.36'
DEFAULT_LEFTOVERS = [   # production text that must never reach a reader (PT, EN, ES); a contract can add its own
    r'\bbriefing\b', r'descrito no brief', r'described in the brief', r'publica[cç][aã]o final', r'atualiz\w+ antes d[ae] publica',
    r'before (?:final )?publication', r'(?-i)\bTODO\b', r'(?-i)\bTBD\b', r'(?-i)\bFIXME\b', r'\[inserir', r'\[insert', r'\[link',
    r'lorem ipsum', r'placeholder', r'ficha (?:t[eé]cnica )?consultada',
]


def strip_tags(s):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()


def words(text):
    return len(re.findall(r'\w+', text))


def status_and_final(url, method='GET'):
    """(status, final url). Follows redirects; status 0 = no response from our side (never proof the target is dead)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA}, method=method)
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, url
    except Exception:
        return 0, url


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', errors='ignore')


def norm(u):
    """Same page, same key: no query or fragment. The trailing slash is kept as written (adding one turns a .pdf into a 404)."""
    p = urllib.parse.urlsplit(u)
    return f'{p.scheme}://{p.netloc}{p.path}'


def full(u):
    """An external source exactly as linked, minus the fragment: its query string can be what identifies the document."""
    return urllib.parse.urldefrag(u)[0]


def same_page(a, b):
    return norm(a).rstrip('/') == norm(b).rstrip('/')


def page_key(u):
    return norm(u).rstrip('/') + '/'


def head_fields(live_html):
    """(seo title, meta description, og:image) of a rendered page."""
    m = re.search(r'<title>(.*?)</title>', live_html, re.S)
    title = html.unescape(m.group(1)).strip() if m else ''
    m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', live_html)
    meta = html.unescape(m.group(1)) if m else ''
    m = re.search(r'<meta\s+property="og:image"\s+content="([^"]*)"', live_html)
    return title, meta, (html.unescape(m.group(1)) if m else '')


def body_of(live_html, selector=None):
    """Article body of any rendered page: the contract's selector tag, else <article>, else <main>, else <body>."""
    for tag in ([selector] if selector else []) + ['article', 'main', 'body']:
        m = re.search(rf'<{tag}\b[^>]*>(.*)</{tag}>', live_html, re.S | re.I)
        if m:
            return m.group(1)
    return live_html


class Gate:
    def __init__(self, contract, site, internal_domain=None, extra_leftovers=(), corpus=None):
        self.C = contract
        self.COMP, self.TYPES = contract['components'], contract['types']
        self.AUDIT = contract.get('audit', {})
        self.site = site.rstrip('/')
        self.domain = internal_domain or urllib.parse.urlsplit(self.site).netloc.replace('www.', '')
        self.leftovers = list(extra_leftovers) + self.AUDIT.get('leftover_patterns', DEFAULT_LEFTOVERS)
        self.corpus = corpus or (lambda: {})   # {url: [long paragraphs]} of recent pages, for single-page boilerplate checks
        heads = self.COMP['faq'].get('heading_aliases') or [re.sub(r'^#+\s*', '', self.COMP['faq'].get('heading', 'FAQ'))]
        self.FAQ_H2 = r'<h2[^>]*>(?:\s|<[^>]+>)*(?:' + '|'.join(re.escape(h) for h in heads) + r')(?:\s|<[^>]+>)*</h2>'
        self.programmatic = set(self.AUDIT.get('programmatic_types', []))
        self.product_types = set(self.AUDIT.get('product_types', []))
        self.default_type = self.AUDIT.get('default_type') or next(iter(k for k, v in self.TYPES.items() if isinstance(v, dict)))

    # --------------------------------------------------------------------------------------------------- helpers
    def spec(self, t):
        v = self.TYPES.get(t)
        return v if isinstance(v, dict) else self.TYPES[self.default_type]

    def is_internal(self, u):
        return urllib.parse.urlsplit(u).netloc.replace('www.', '').endswith(self.domain)

    def leftover_hits(self, text):
        for pat in self.leftovers:
            flags = 0 if pat.startswith('(?-i)') else re.I
            p = pat[5:] if pat.startswith('(?-i)') else pat
            m = re.search(p, text, flags)
            if m:
                yield pat, text[max(0, m.start() - 70): m.end() + 70]

    def visuals(self, body):
        """Images plus tables (a table is a visual element). [[IMG n]] = an image slot of a Doc draft."""
        imgs = re.findall(r'<img\b[^>]*>', body)
        return imgs, len(imgs) + len(re.findall(r'\[\[IMG \d+\]\]', body)) + len(re.findall(r'<table\b', body))

    def need_visuals(self, t, chars):
        ic = self.COMP['images']
        need = self.spec(t).get('min_visuais', self.spec(t).get('min_visuals', ic.get('min_in_article', 1)))
        if ic.get('densidade_por_3000_chars') or ic.get('density_per_3000_chars'):
            need = max(need, round(chars / 3000))
        return need

    def prefetch(self, bodies, cache):
        """Every link and body image of a batch, checked in parallel once."""
        urls = set()
        for b in bodies:
            for h in re.findall(r'<a\b[^>]*href="([^"]+)"', b) + re.findall(r'<img\b[^>]*\ssrc="([^"]+)"', b):
                h = html.unescape(h)
                if not h.startswith(('#', 'mailto:', 'tel:', 'data:')):
                    u = urllib.parse.urljoin(self.site + '/', h)
                    is_page = self.is_internal(u) and not re.search(r'\.(?:jpe?g|png|webp|gif|svg|pdf)$', urllib.parse.urlsplit(u).path, re.I)
                    urls.add(page_key(u) if is_page else full(u))
        todo = [u for u in urls if u not in cache]
        with ThreadPoolExecutor(16) as ex:
            for u, r in zip(todo, ex.map(status_and_final, todo)):
                cache[u] = r

    # --------------------------------------------------------------------------------------------------- gate 2/3
    def audit_core(self, slug, link, headline, seo_title, meta, body, t, live_html=None, link_cache=None, short_update=None,
                   post_id=None, date=None, cover=None):
        """The contract checks on one piece. live_html=None is the draft mode: page-only checks (FAQ schema, cover) wait."""
        link_cache = link_cache if link_cache is not None else {}
        COMP, spec = self.COMP, self.spec(t)
        text = strip_tags(body)
        findings = []

        def add(check, sev, msg, **kw):
            findings.append({'check': check, 'severity': sev, 'message': msg, **kw})

        tc = COMP['title']
        hmin, hmax = tc.get('headline_min_chars', tc['min_chars']), tc.get('headline_max_chars', tc['max_chars'])
        if not hmin <= len(headline) <= hmax:
            add('headline_length', 'block', f'headline {len(headline)} chars (contract {hmin}-{hmax})', value=headline)
        smax = tc.get('rendered_max_chars', tc['max_chars'] + 13)
        if len(seo_title) > smax:
            add('seo_title_length', 'warn', f'rendered <title> {len(seo_title)} chars (contract max {smax})', value=seo_title)
        mc = COMP['meta_description']
        if not mc['hard_min'] <= len(meta) <= mc['hard_max']:
            add('meta_length', 'block', f'meta description {len(meta)} chars (contract {mc["hard_min"]}-{mc["hard_max"]})', value=meta)

        n = words(text)
        floor = spec.get('min_words', COMP['readability']['min_words'])
        exc = (spec.get('exceptions') or {}).get('short_update')
        if n < floor:
            if exc and n >= exc['min_words'] and short_update:
                add('words', 'warn', f'{n} words: short-update exception declared ({short_update[:80]})')
            else:
                add('words', 'block', f'{n} words (contract minimum for {t}: {floor})', value=n)

        internal, external = [], []
        for h in (html.unescape(h) for h in re.findall(r'<a\b[^>]*href="([^"]+)"', body)):
            if h.startswith(('#', 'mailto:', 'tel:')):
                continue
            u = urllib.parse.urljoin(self.site + '/', h)
            (internal if self.is_internal(u) else external).append(u)
        uniq_int = sorted({page_key(u) for u in internal if not same_page(u, link)})
        il = COMP['internal_links']
        if len(uniq_int) < il['min']:
            add('internal_links', 'block', f'{len(uniq_int)} unique internal destination(s) (contract min {il["min"]})', value=uniq_int)
        for u in uniq_int:
            if u not in link_cache:
                link_cache[u] = status_and_final(u)
            st, final = link_cache[u]
            if st >= 400:
                add('internal_link_broken', 'block', f'internal link {u} -> HTTP {st}')
            elif not same_page(final, u):
                add('internal_link_redirect', 'block', f'internal link {u} redirects to {final}: link the final URL')
        ext_uniq = sorted({full(u) for u in external})
        if len(ext_uniq) < COMP['external_refs']['min']:
            add('external_refs', 'block', f'{len(ext_uniq)} clickable external source(s) in the body (contract min {COMP["external_refs"]["min"]})')
        for u in ext_uniq:
            if u not in link_cache:
                link_cache[u] = status_and_final(u)
            if link_cache[u][0] in (404, 410):   # only a confirmed 404/410 proves a source dead (never 403/429/0)
                add('external_link_dead', 'block', f'external source {u} -> HTTP {link_cache[u][0]}')

        imgs, nvis = self.visuals(body)
        ac = COMP['images'].get('alt_text', {})
        banned = [b.lower() for b in ac.get('banidos', ac.get('banned', []))]
        for tag in imgs:
            src = re.search(r'\ssrc="([^"]+)"', tag)
            if not src or src.group(1).startswith('data:'):
                continue
            u = full(urllib.parse.urljoin(self.site + '/', html.unescape(src.group(1))))
            if u not in link_cache:
                link_cache[u] = status_and_final(u)
            if link_cache[u][0] >= 400:
                add('image_broken', 'block', f'body image {u} -> HTTP {link_cache[u][0]}')
            alt = re.search(r'\salt="([^"]*)"', tag)
            alt = html.unescape(alt.group(1)).strip() if alt else ''
            if len(alt) < ac.get('min_chars', 10) or alt.lower() in banned:
                add('image_alt', 'warn', f'alt text too thin on {u.rsplit("/", 1)[-1]}: "{alt}"')
        need = self.need_visuals(t, len(text))
        if nvis < need:
            add('visuals', 'block', f'{nvis} body visual(s) for {len(text)} chars (contract needs {need} for {t})', value=nvis)

        has_faq = re.search(self.FAQ_H2, body, re.I)
        if spec.get('faq_required', True) or has_faq:
            fq = COMP['faq']
            m = re.search(self.FAQ_H2 + r'(.*?)(?=<h2|$)', body, re.S | re.I)
            q = len(re.findall(r'<h3\b', m.group(1))) if m else 0
            lo, hi = spec.get('faq_min_questions', fq['min_questions']), spec.get('faq_max_questions', fq['max_questions'])
            if not lo <= q <= hi:
                add('faq', 'block', f'FAQ has {q} question(s) (contract {lo}-{hi})')
            elif live_html is not None and fq.get('jsonld_required', True) and '"FAQPage"' not in live_html:
                add('faq_schema', 'block', 'FAQ present but no FAQPage ld+json on the live page')

        for pat, ctx in self.leftover_hits(text):
            add('production_leftover', 'block', f'production text in the copy: "...{ctx}..."', pattern=pat)
        if not COMP['typography'].get('em_dash_allowed', False) and '—' in text:
            add('em_dash', 'block', f'{text.count(chr(0x2014))} em dash(es) in the body')

        # product imagery (live page): a real product needs its real image, not an invented render or a shared stock picture
        og = cover or ''
        if live_html is not None:
            og = cover if cover is not None else head_fields(live_html)[2]
            if not og and COMP['images'].get('featured_required', True):
                add('cover_missing', 'block', 'no og:image / cover on the live page')
            pr = COMP['images'].get('produto_real') or COMP['images'].get('real_product') or {}
            markers = pr.get('forbidden_filename_markers', ['ai-product-render', 'product-render'])
            if t in self.product_types and og and any(mk in og.lower() for mk in markers):
                add('cover_invented_render', 'block', f'product page cover is an AI render file ({og.rsplit("/", 1)[-1]}): use the official image (contract images.produto_real)')

        paras = [strip_tags(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>', body, re.S)]
        return {
            'url': link, 'id': post_id, 'slug': slug, 'type': t, 'date': date, 'cover': og,
            'headline': headline, 'headline_chars': len(headline), 'seo_title_chars': len(seo_title), 'meta_chars': len(meta),
            'words': n, 'internal_unique': len(uniq_int), 'external_unique': len(ext_uniq), 'visuals': nvis,
            'verdict': 'FAIL' if any(f['severity'] == 'block' for f in findings) else 'PASS',
            'findings': findings, '_paras': [p for p in paras if len(p) > 120],
        }

    # --------------------------------------------------------------------------------------------------- batch checks
    def finalize(self, results):
        """Cross-page checks, then the verdict. Every caller ends here, so a single page is judged like a batch."""
        self.boilerplate(results)
        self.shared_covers(results)
        for r in results:
            r.pop('_paras', None)
            r['verdict'] = 'FAIL' if any(f['severity'] == 'block' for f in r['findings']) else 'PASS'
        return results

    def boilerplate(self, results, min_posts=3):
        """Paragraphs repeated verbatim in min_posts+ pages (batch + recent corpus) are template text. Blocks programmatic types."""
        key = lambda p: re.sub(r'\W+', ' ', p.lower())[:200]
        seen = collections.defaultdict(set)
        for url, paras in (self.corpus() or {}).items():
            for p in paras:
                if len(p) > 120:
                    seen[key(p)].add(page_key(url))
        for r in results:
            for p in r['_paras']:
                seen[key(p)].add(page_key(r['url']))
        for r in results:
            for p in r['_paras']:
                if len(seen[key(p)]) >= min_posts:
                    sev = 'block' if r['type'] in self.programmatic else 'warn'
                    r['findings'].append({'check': 'boilerplate', 'severity': sev,
                                          'message': f'paragraph repeated in {len(seen[key(p)])} pages: "{p[:110]}..."'})
                    break

    def shared_covers(self, results):
        """The same cover on two or more product pages = a stock picture standing in for the product (2026-10-07 incident)."""
        by = collections.defaultdict(list)
        for r in results:
            if r['type'] in self.product_types and r.get('cover'):
                by[re.sub(r'-\d+x\d+(?=\.\w+$)', '', norm(r['cover']))].append(r)
        for cov, rs in by.items():
            if len(rs) > 1:
                for r in rs:
                    r['findings'].append({'check': 'cover_shared', 'severity': 'block',
                                          'message': f'same cover on {len(rs)} product pages ({cov.rsplit("/", 1)[-1]}): each product needs its own real image'})

    # --------------------------------------------------------------------------------------------------- gate 1
    def audit_plan(self, plan, link_cache=None):
        """Pre-write gate: the PLAN against the contract, before a paragraph exists.
        {slug, type, headline, meta, target_words, skeleton_map: {skeleton item: planned heading}, internal_links: [url],
         sources: [url], visuals: [{kind, about}], faq: [question], short_update?, promise?, alternatives?: [{name, source}],
         cover?: {kind: official|ai_from_official|illustration, source}}"""
        link_cache = link_cache if link_cache is not None else {}
        COMP, findings = self.COMP, []

        def add(check, msg):
            findings.append({'check': check, 'severity': 'block', 'message': msg})

        t = plan.get('type')
        if not isinstance(self.TYPES.get(t), dict):
            add('type', f'unknown article type "{t}" (contract types: {", ".join(k for k, v in self.TYPES.items() if isinstance(v, dict))})')
            return {'verdict': 'FAIL', 'findings': findings}
        spec = self.TYPES[t]
        tc, mc = COMP['title'], COMP['meta_description']
        h, m = plan.get('headline') or '', plan.get('meta') or ''
        hmin, hmax = tc.get('headline_min_chars', tc['min_chars']), tc.get('headline_max_chars', tc['max_chars'])
        if not hmin <= len(h) <= hmax:
            add('headline_length', f'headline {len(h)} chars (contract {hmin}-{hmax})')
        if not mc['hard_min'] <= len(m) <= mc['hard_max']:
            add('meta_length', f'meta {len(m)} chars (contract {mc["hard_min"]}-{mc["hard_max"]})')
        for label, txt in (('headline', h), ('meta', m)):
            if '—' in txt and not COMP['typography'].get('em_dash_allowed', False):
                add('em_dash', f'em dash in the {label}')
            for pat, _ in self.leftover_hits(txt):
                add('production_leftover', f'production text in the {label}: {pat}')
        floor = spec.get('min_words', COMP['readability']['min_words'])
        tw = int(plan.get('target_words') or 0)
        if tw < floor and not (plan.get('short_update') and (spec.get('exceptions') or {}).get('short_update')):
            add('words', f'target_words {tw} below the {t} floor ({floor}); declare short_update only where the contract allows it')
        planned = {k for k, v in (plan.get('skeleton_map') or {}).items() if str(v).strip()}
        missing = [x for x in spec.get('skeleton', []) if x not in planned]
        if missing:
            add('skeleton', f'skeleton items with no planned heading: {missing}')
        ints = sorted({page_key(u) for u in plan.get('internal_links') or []})
        if len(ints) < COMP['internal_links']['min']:
            add('internal_links', f'{len(ints)} planned internal destination(s) (contract min {COMP["internal_links"]["min"]})')
        exts = sorted({full(u) for u in plan.get('sources') or []})
        if len(exts) < COMP['external_refs']['min']:
            add('external_refs', f'{len(exts)} planned primary source(s) (contract min {COMP["external_refs"]["min"]})')
        todo = [u for u in ints + exts if u not in link_cache]
        if todo:
            with ThreadPoolExecutor(12) as ex:
                for u, r in zip(todo, ex.map(status_and_final, todo)):
                    link_cache[u] = r
        for u in ints:
            st, final = link_cache[u]
            if st >= 400 or st == 0:
                add('internal_link_broken', f'planned internal link {u} -> HTTP {st}')
            elif not same_page(final, u):
                add('internal_link_redirect', f'planned internal link {u} redirects to {final}: plan the final URL')
        for u in exts:
            if link_cache[u][0] in (404, 410):
                add('external_link_dead', f'planned source {u} -> HTTP {link_cache[u][0]}')
        vis = plan.get('visuals') or []
        cpw = self.AUDIT.get('chars_per_word', 6.36)
        chars = round(tw * cpw)
        need = self.need_visuals(t, chars)
        if len(vis) < need:
            add('visuals', f'{len(vis)} planned visual(s) for ~{chars} chars (contract needs {need} for {t})')
        if (spec.get('tabela_comparativa_obrigatoria') or spec.get('comparison_table_required')) and not any(
                v.get('kind') in ('tabela', 'table') and re.search(r'compar', v.get('about', ''), re.I) for v in vis):
            add('comparison_table', f'{t} requires a comparison table: plan one (kind "table", about "comparison ...")')
        if spec.get('faq_required', True):
            lo, hi = spec.get('faq_min_questions', COMP['faq']['min_questions']), spec.get('faq_max_questions', COMP['faq']['max_questions'])
            if not lo <= len(plan.get('faq') or []) <= hi:
                add('faq', f'{len(plan.get("faq") or [])} planned FAQ question(s) (contract {lo}-{hi})')
        if spec.get('requires_promise') and not (plan.get('promise') or '').strip():
            add('promise', f'{t}: state the calculation or number the headline promises; the draft must deliver it')
        if spec.get('requires_alternatives') and not [x for x in plan.get('alternatives') or [] if x.get('name') and x.get('source')]:
            add('alternatives', f'{t}: plan at least one real alternative with its source, compared in the same units')
        if t in self.product_types:
            cov = plan.get('cover') or {}
            if cov.get('kind') not in ('official', 'ai_from_official') or not cov.get('source'):
                add('product_cover', f'{t}: plan the cover as the official product image (cover.kind "official", cover.source = URL) '
                                     'or an AI image built from it ("ai_from_official"); never an invented render or a shared stock picture')
        return {'verdict': 'FAIL' if findings else 'PASS', 'type': t, 'findings': findings}
