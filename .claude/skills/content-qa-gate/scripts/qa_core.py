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
import base64, collections, html, http.client, io, ipaddress, json, os, posixpath, re, socket, ssl, urllib.error, urllib.parse, urllib.request
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
    metas = {}
    for tag in re.findall(r'<meta\b(?:[^>"\']|"[^"]*"|\'[^\']*\')*>', live_html, re.I):   # any attribute order and quote style; ">" inside quotes kept
        attrs = {k.lower(): v1 if q else v2 for k, q, v1, v2 in
                 re.findall(r'([\w:-]+)\s*=\s*(?:(["\'])(.*?)\2|([^\s>]+))', tag, re.S)}
        for key in {(attrs.get('name') or '').lower(), (attrs.get('property') or '').lower()} - {''}:   # a tag may carry both
            if key not in metas and 'content' in attrs:
                metas[key] = html.unescape(attrs['content'])
    return title, metas.get('description', ''), metas.get('og:image', '')


_COVER_MAX_BYTES = 10 * 1024 * 1024
_COVER_TIMEOUT = 10
_COVER_MAX_REDIRECTS = 3


def _image_dimensions(data):
    """Return (width, height) for common raster covers without third-party imports."""
    if not data:
        return None
    if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) >= 24:
        width = int.from_bytes(data[16:20], 'big')
        height = int.from_bytes(data[20:24], 'big')
        return (width, height) if width and height else None
    if data[:2] == b'\xff\xd8':
        pos = 2
        while pos + 4 <= len(data):
            while pos < len(data) and data[pos] != 0xff:
                pos += 1
            while pos < len(data) and data[pos] == 0xff:
                pos += 1
            if pos >= len(data):
                break
            marker = data[pos]
            pos += 1
            if marker in (0xd8, 0xd9):
                continue
            if marker == 0xda:
                break
            if pos + 2 > len(data):
                break
            length = int.from_bytes(data[pos:pos + 2], 'big')
            if length < 2 or pos + length > len(data):
                break
            if marker in ({0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
                           0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf}):
                if length >= 7:
                    height = int.from_bytes(data[pos + 3:pos + 5], 'big')
                    width = int.from_bytes(data[pos + 5:pos + 7], 'big')
                    return (width, height) if width and height else None
            pos += length
        return None
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP' and len(data) >= 30:
        kind = data[12:16]
        if kind == b'VP8X' and len(data) >= 30:
            width = 1 + int.from_bytes(data[24:27], 'little')
            height = 1 + int.from_bytes(data[27:30], 'little')
            return (width, height)
        if kind == b'VP8 ' and len(data) >= 30 and data[23:26] == b'\x9d\x01\x2a':
            width = int.from_bytes(data[26:28], 'little') & 0x3fff
            height = int.from_bytes(data[28:30], 'little') & 0x3fff
            return (width, height) if width and height else None
        if kind == b'VP8L' and len(data) >= 25 and data[20] == 0x2f:
            bits = int.from_bytes(data[21:25], 'little')
            width = 1 + (bits & 0x3fff)
            height = 1 + ((bits >> 14) & 0x3fff)
            return (width, height)
    return None


def _cover_local_bytes(html_doc, cover):
    """Read an explicitly supplied local/package copy; never turn a CDN URL into a fetch."""
    basename = os.path.basename(urllib.parse.unquote(urllib.parse.urlsplit(cover).path))
    candidates = []
    for tag in re.findall(r'<(?:img|meta)\b[^>]*>', html_doc or '', re.I):
        if not re.search(r'data-cover(?:\s*=|[-_]local\s*=|[-_]file\s*=)', tag, re.I):
            continue
        for attr in ('data-cover-local', 'data-cover-file', 'data-cover-path', 'content'):
            match = re.search(rf'\b{re.escape(attr)}\s*=\s*["\']([^"\']+)', tag, re.I)
            if match:
                candidates.append(match.group(1))
    # A package may keep the local asset beside the review HTML with the same filename.
    if basename:
        candidates.extend([basename, os.path.join('assets', basename), os.path.join('covers', basename)])
    for candidate in candidates:
        if candidate.startswith(('http://', 'https://', 'data:')):
            continue
        try:
            with open(candidate, 'rb') as f:
                data = f.read(_COVER_MAX_BYTES + 1)
            if len(data) <= _COVER_MAX_BYTES:
                return data
        except (OSError, ValueError):
            continue
    return None


def _cover_host(value):
    """Return a normalized hostname from a host, URL, or contract declaration."""
    value = str(value or '').strip().lower().rstrip('.')
    if not value:
        return ''
    parsed = urllib.parse.urlsplit(value if '://' in value else '//' + value)
    try:
        return (parsed.hostname or '').encode('idna').decode('ascii').lower().rstrip('.')
    except UnicodeError:
        return ''


def _cover_host_allowed(host, allowed_hosts):
    host = _cover_host(host)
    return bool(host) and any(host == allowed or host.endswith('.' + allowed) for allowed in allowed_hosts)


def _cover_public_addresses(host, port):
    """Return the checked public addresses that the HTTP connection must use."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (OSError, ValueError):
        return []
    if not infos:
        return []
    try:
        if not all(ipaddress.ip_address(item[4][0]).is_global for item in infos):
            return []
    except (IndexError, ValueError):
        return []
    return [item for item in infos if item[4][0]]


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, port, address, **kwargs):
        super().__init__(host, port, **kwargs)
        self._pinned_address = address

    def connect(self):
        self.sock = socket.create_connection(self._pinned_address, self.timeout, self.source_address)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, port, address, **kwargs):
        super().__init__(host, port, **kwargs)
        self._pinned_address = address

    def connect(self):
        self.sock = socket.create_connection(self._pinned_address, self.timeout, self.source_address)
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self.host)


def _cover_http_request(url, addresses):
    """Fetch one URL over the exact address already checked by _cover_public_addresses."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.username or parsed.password or not parsed.hostname:
        return 0, {}, b''
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    address = next((item[4] for item in addresses if item[4][0]), None)
    if not address:
        return 0, {}, b''
    connection_type = _PinnedHTTPSConnection if parsed.scheme == 'https' else _PinnedHTTPConnection
    kwargs = {'timeout': _COVER_TIMEOUT}
    if parsed.scheme == 'https':
        kwargs['context'] = ssl.create_default_context()
    conn = connection_type(parsed.hostname, port, address, **kwargs)
    try:
        target = urllib.parse.urlunsplit(('', '', parsed.path or '/', parsed.query, ''))
        host_header = parsed.hostname
        if parsed.port:
            host_header = f'[{host_header}]' if ':' in host_header and not host_header.startswith('[') else host_header
            host_header = f'{host_header}:{parsed.port}'
        conn.request('GET', target, headers={'User-Agent': UA, 'Host': host_header})
        response = conn.getresponse()
        headers = {k.lower(): v for k, v in response.getheaders()}
        data = response.read(_COVER_MAX_BYTES + 1)
        return response.status, headers, data
    except Exception:
        return 0, {}, b''
    finally:
        conn.close()


def _cover_bytes(url, *, page_url=None, declared_hosts=(), live=False):
    """Read a draft-local or live cover without treating a URL string as proof of an image."""
    if not url:
        return None
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme == 'data':
            match = re.match(r'^data:(image/[^;,]+)(;base64)?,(.*)$', url, re.I | re.S)
            if not match:
                return None
            payload = match.group(3)
            if match.group(2):
                # Reject oversized encoded payloads before decoding.
                if len(payload) > ((_COVER_MAX_BYTES + 2) * 4 // 3) + 4:
                    return None
                return base64.b64decode(payload, validate=True)[:_COVER_MAX_BYTES + 1]
            data = urllib.parse.unquote_to_bytes(payload)
            return data if len(data) <= _COVER_MAX_BYTES else None
        if parsed.scheme in ('http', 'https'):
            if not live:
                return None   # draft QA reads the cover from the package only; a remote URL in a draft is never fetched (Codex P1: SSRF)
            page_host = _cover_host(urllib.parse.urlsplit(page_url).hostname if page_url else '')
            allowed_hosts = {page_host} | {_cover_host(host) for host in declared_hosts}
            current = url
            for redirect_count in range(_COVER_MAX_REDIRECTS + 1):
                current_parts = urllib.parse.urlsplit(current)
                if current_parts.scheme not in ('http', 'https') or not _cover_host_allowed(current_parts.hostname, allowed_hosts):
                    return None
                port = current_parts.port or (443 if current_parts.scheme == 'https' else 80)
                addresses = _cover_public_addresses(current_parts.hostname, port)
                if not addresses:
                    return None
                code, headers, data = _cover_http_request(current, addresses)
                if 300 <= code < 400:
                    if redirect_count >= _COVER_MAX_REDIRECTS:
                        return None
                    location = headers.get('location')
                    if not location:
                        return None
                    current = urllib.parse.urljoin(current, location)
                    continue
                if code >= 400 or code == 0:
                    return None
                if int(headers.get('content-length') or 0) > _COVER_MAX_BYTES:
                    return None
                return data if len(data) <= _COVER_MAX_BYTES else None
            return None
        if parsed.scheme:
            return None
        with open(url, 'rb') as f:
            return f.read()
    except Exception:
        return None


def cover_contract_findings(C, html_doc, cover_url, draft=False, page_url=None):
    """Validate the structured images.cover contract in both draft and live paths."""
    spec = (C.get('components', {}).get('images', {}).get('cover') or {})
    if not spec or not spec.get('required', False):
        return []
    findings = []
    cover = html.unescape(str(cover_url or '').strip())
    if not cover and draft:
        # Review HTML normally carries the OG image; allow an explicitly marked cover image too.
        cover = head_fields(html_doc)[2]
    if not cover and draft:
        m = re.search(r'<img\b[^>]*(?:data-cover\s*=\s*["\'][^"\']*["\']|class\s*=\s*["\'][^"\']*(?:cover|featured)[^"\']*["\'])[^>]*>', html_doc, re.I)
        cover = re.search(r'\bsrc=["\']([^"\']+)', m.group(0), re.I).group(1) if m else ''
    if not cover:
        findings.append(('cover_missing', 'block', 'images.cover requires a declared cover image'))
        return findings
    if not draft and page_url and not urllib.parse.urlsplit(cover).scheme and not os.path.exists(cover):
        cover = urllib.parse.urljoin(page_url, cover)
    allowed = {str(x).lower().lstrip('.') for x in spec.get('format', [])}
    if cover.lower().startswith('data:'):
        mime = re.match(r'^data:(image/[^;,]+)', cover, re.I)
        ext = {'jpeg': 'jpg', 'svg+xml': 'svg'}.get(mime.group(1).split('/', 1)[1].lower(), mime.group(1).split('/', 1)[1].lower()) if mime else ''
    else:
        ext = os.path.splitext(urllib.parse.urlsplit(cover).path)[1].lower().lstrip('.')
    if allowed and ext not in allowed:
        findings.append(('cover_format', 'block', f'cover format {ext or "unknown"} is not in contract {sorted(allowed)}'))
    images = C.get('components', {}).get('images', {})
    cover_spec = images.get('cover') or {}
    declared_hosts = []
    for source in (C.get('cdn_hosts'), C.get('audit', {}).get('cdn_hosts'), images.get('cdn_hosts'),
                   cover_spec.get('cdn_hosts'), cover_spec.get('allowed_hosts')):
        if isinstance(source, str):
            declared_hosts.append(source)
        elif isinstance(source, (list, tuple, set)):
            declared_hosts.extend(source)
    parsed_cover = urllib.parse.urlsplit(cover)
    if draft and parsed_cover.scheme in ('http', 'https'):
        # Draft QA must not fetch. A declared HTTPS CDN URL is still useful
        # evidence: validate its host and filename now, then verify its bytes
        # in live QA. If the package exposes a local copy, inspect that copy.
        if parsed_cover.scheme != 'https' or not _cover_host_allowed(parsed_cover.hostname, declared_hosts):
            findings.append(('cover_unreadable', 'block', 'draft cover URL must use HTTPS on a declared CDN host'))
            return findings
        data = _cover_local_bytes(html_doc, cover)
        if not data:
            findings.append(('cover_deferred', 'info', 'draft CDN cover passed static checks; live QA verifies fetched bytes'))
    else:
        data = _cover_bytes(cover, page_url=page_url, declared_hosts=declared_hosts, live=not draft and page_url is not None)
    if not data:
        if not (draft and parsed_cover.scheme in ('http', 'https')):
            findings.append(('cover_unreadable', 'block', 'images.cover could not be read for validation'))
        return findings
    dimensions = _image_dimensions(data)
    if not dimensions:
        findings.append(('cover_unreadable', 'block', 'cover bytes are not a supported PNG, JPEG, or WebP image'))
        return findings
    width, height = dimensions
    if width != int(spec.get('width', width)) or height != int(spec.get('height', height)):
        findings.append(('cover_dimensions', 'block', f'cover is {width}x{height}; contract requires {spec.get("width")}x{spec.get("height")}'))
    ratio = width / height if height else 0
    tolerance = float(spec.get('aspect_tolerance', 0.03))
    if abs(ratio - float(spec.get('aspect_ratio', ratio))) > tolerance:
        findings.append(('cover_aspect_ratio', 'block', f'cover aspect ratio {ratio:.4f} is outside contract'))
    palette = [str(x).lstrip('#') for x in spec.get('palette', [])]
    if palette:
        # Palette matching is an optional enhancement. Dimensions and basic
        # image validity stay dependency-free when Pillow is unavailable.
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(data))
            colors = im.convert('RGB').resize((64, 64)).getdata()
            matched = 0
            for color in palette:
                rgb = tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))
                if any(sum((a - b) ** 2 for a, b in zip(px, rgb)) ** 0.5 <= 45 for px in colors):
                    matched += 1
            if matched < len(palette):
                findings.append(('cover_palette', 'block', f'cover matches {matched}/{len(palette)} contract palette colors'))
        except ImportError:
            pass
        except Exception:
            # Palette matching is an optional enhancement. Header dimensions
            # and supported format remain authoritative when Pillow cannot
            # decode an otherwise valid package image.
            pass
    # Contract style is descriptive until the producer and renderer expose a
    # stable annotation. The image bytes remain subject to dimensions, ratio,
    # palette, and format checks above.
    return findings


def _balanced(html_, start, tag):
    """Inner HTML of the element whose start tag ends at `start`, counting nested tags of the same name."""
    depth = 1
    for m in re.finditer(rf'<!--.*?-->|<(/?){tag}\b[^>]*>', html_[start:], re.I | re.S):
        if m.group(0).startswith('<!--'):   # commented-out tags do not count; <div/> does (browsers open it)
            continue
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return html_[start:start + m.start()]
    return html_[start:]


def body_of(live_html, selector=None):
    """Article body of any rendered page. selector: a tag ("article") or a class (".entry-content", the element carrying
    that class, nested tags counted); else <article>, else <main>, else <body>."""
    for sel in ([selector] if selector else []) + ['article', 'main', 'body']:
        if sel.startswith('.'):
            m = re.search(r'<(\w+)\b[^>]*class=(["\'])(?:(?!\2).)*?(?<![\w-])' + re.escape(sel[1:]) + r'(?![\w-])(?:(?!\2).)*\2[^>]*>',
                          live_html, re.I | re.S)
            if m:
                return _balanced(live_html, m.end(), m.group(1))
            continue
        m = re.search(rf'<{sel}\b[^>]*>', live_html, re.I)
        if m:
            return _balanced(live_html, m.end(), sel)
    return live_html


def slugify_type(t):
    import unicodedata
    t = unicodedata.normalize('NFKD', str(t or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def valid_price_ledger(path, accepts=('PASS', 'PRESS_QUOTE', 'NO_PUBLIC_PRICE')):
    """price-research ledger (price-research skill): an accepted verdict, with evidence rows (prices, or the on-request page)."""
    try:
        led = json.load(open(path)) if isinstance(path, str) else path
        rows = [r for r in (led or {}).get('prices', []) + (led or {}).get('on_request', []) if str(r.get('url', '')).startswith('http') and r.get('checked_at')]
        import datetime
        made = datetime.datetime.fromisoformat(str((led or {}).get('generated_at', '')).replace('Z', '+00:00'))
        fresh = (datetime.datetime.now(datetime.timezone.utc) - made).days <= ((led or {}).get('rules') or {}).get('valid_for_days', 30)
        return (led or {}).get('verdict') in accepts and bool(rows) and fresh
    except Exception:
        return False


def ledger_matches(path, text):
    """the ledger's product shares at least 2 content words (or all, when shorter) with what the plan says it is about"""
    try:
        led = json.load(open(path)) if isinstance(path, str) else path
        norm = lambda x: set(w for w in re.sub(r'[^a-z0-9]+', ' ', __import__('unicodedata').normalize('NFKD', str(x or '')).encode('ascii', 'ignore').decode().lower()).split() if len(w) > 2)
        want, have = norm(f"{led.get('product', '')} {led.get('model') or ''}"), norm(text)
        return bool(want) and len(want & have) >= min(2, len(want))
    except Exception:
        return False


class Gate:
    def __init__(self, contract, site, internal_domain=None, extra_leftovers=(), corpus=None, manifest=None):
        self.C = contract
        self.COMP, self.TYPES = contract['components'], contract['types']
        self.AUDIT = contract.get('audit', {})
        self.site = site.rstrip('/')
        self.domain = internal_domain or urllib.parse.urlsplit(self.site).netloc.replace('www.', '')
        self.leftovers = list(extra_leftovers) + self.AUDIT.get('leftover_patterns', DEFAULT_LEFTOVERS)
        self.corpus = corpus or (lambda: {})   # {url: [long paragraphs]} of recent pages, for single-page boilerplate checks
        self.manifest = self._load_manifest(manifest)
        heads = self.COMP['faq'].get('heading_aliases') or [re.sub(r'^#+\s*', '', self.COMP['faq'].get('heading', 'FAQ'))]
        self.FAQ_H2 = r'<h2[^>]*>(?:\s|<[^>]+>)*(?:' + '|'.join(re.escape(h) for h in heads) + r')(?:\s|<[^>]+>)*</h2>'
        self.programmatic = set(self.AUDIT.get('programmatic_types', []))
        self.product_types = set(self.AUDIT.get('product_types', []))
        self.default_type = self.AUDIT.get('default_type') or next(iter(k for k, v in self.TYPES.items() if isinstance(v, dict)))
        # aliases ("calculadora" -> ferramenta, "review" -> produto): a brief may name a type by any of its names (2026-10-09)
        self.alias = {}
        for k, v in self.TYPES.items():
            if isinstance(v, dict):
                self.alias[k] = k
                for a in v.get('aliases') or []:
                    self.alias.setdefault(slugify_type(a), k)

    def resolve_type(self, t):
        """Canonical contract type for a type name or alias; None when unknown (never a silent default)."""
        return self.alias.get(slugify_type(t)) if t else None

    # --------------------------------------------------------------------------------------------------- helpers
    def spec(self, t):
        v = self.TYPES.get(self.resolve_type(t) or t)
        return v if isinstance(v, dict) else self.TYPES[self.default_type]

    def routed_type(self, url):
        """The type the contract's audit.type_rules give a URL (first match), else None. Live and sweep QA route pages this way."""
        path = re.sub(r'^https?://[^/]+', '', str(url or ''))
        for rule in self.AUDIT.get('type_rules', []):
            if re.search(rule['pattern'], path):
                return rule['type']
        return None

    def route_problem(self, t, url):
        """A piece of a type listed in audit.enforce_route_types must sit at a URL that routes to it, or live QA would judge it as
        another type. Opt-in per contract: other contracts' type_rules stay hints for live QA, never a draft block."""
        if not url or t not in (self.AUDIT.get('enforce_route_types') or []):
            return None
        got = self.routed_type(url)
        return None if got == t else f'{t} at {url} routes to "{got}" in audit.type_rules: use a slug the {t} rule matches'

    def is_internal(self, u):
        h = urllib.parse.urlsplit(u).netloc.lower().split(':')[0].replace('www.', '')
        return h == self.domain or h.endswith('.' + self.domain)

    def leftover_hits(self, text):
        for pat in self.leftovers:
            flags = 0 if pat.startswith('(?-i)') else re.I
            p = pat[5:] if pat.startswith('(?-i)') else pat
            m = re.search(p, text, flags)
            if m:
                yield pat, text[max(0, m.start() - 70): m.end() + 70]

    @staticmethod
    def _load_manifest(manifest):
        if isinstance(manifest, (str, os.PathLike)):
            try:
                with open(manifest) as f:
                    return json.load(f)
            except (OSError, ValueError):
                return {}
        return manifest if isinstance(manifest, dict) else {}

    @staticmethod
    def _asset_key(value):
        value = html.unescape(str(value or '')).strip()
        if not value or value.startswith('data:'):
            return ''
        parsed = urllib.parse.urlsplit(value)
        path = urllib.parse.unquote(parsed.path or value)
        if not path:
            path = parsed.path or value
        return posixpath.normpath(path).lstrip('./')

    def _manifest_type(self, src, manifest):
        src_key = self._asset_key(src)
        if not src_key:
            return None
        for key in ('visual_slots', 'image_slots', 'visuals'):
            for slot in (manifest or {}).get(key) or []:
                if not isinstance(slot, dict):
                    continue
                candidates = [slot.get(name) for name in ('file', 'src', 'filename')]
                if any(src_key == self._asset_key(candidate) for candidate in candidates):
                    return slot.get('type')
        return None

    @staticmethod
    def _type_from_value(value):
        token = str(value or '').lower().replace('visual-', '').strip()
        return token if token in ('chart', 'screenshot', 'illustrative', 'diagram') else None

    def _inline_types(self, body, manifest=None):
        typed = collections.Counter()
        unknown = []
        for fig in re.findall(r'<figure\b[^>]*>[\s\S]*?</figure>', body, re.I):
            img = re.search(r'<img\b[^>]*>', fig, re.I)
            if not img:
                continue
            figure_tag = re.search(r'<figure\b[^>]*>', fig, re.I).group(0)
            img_tag = img.group(0)
            src_match = re.search(r'\bsrc=["\']([^"\']+)', img_tag, re.I)
            src = src_match.group(1) if src_match else ''
            # Explicit annotations win, including an invalid annotation, which
            # remains unknown rather than silently borrowing a manifest type.
            attr = re.search(r'\b(?:data-visual-type|data-slot-type)=["\']([^"\']+)', figure_tag, re.I)
            attr = attr or re.search(r'\b(?:data-visual-type|data-slot-type)=["\']([^"\']+)', img_tag, re.I)
            if attr:
                token = self._type_from_value(attr.group(1))
            else:
                token = self._manifest_type(src, manifest or self.manifest)
            if not token and not attr:
                # Preserve the prior data-type/class annotation path for older
                # packages that predate data-slot-type.
                legacy = re.search(r'\bdata-type=["\']([^"\']+)', figure_tag, re.I)
                classes = re.search(r'\bclass=["\']([^"\']+)', figure_tag, re.I)
                values = ([legacy.group(1)] if legacy else []) + ((classes.group(1).split()) if classes else [])
                for value in values:
                    token = self._type_from_value(value)
                    if token:
                        break
            if token:
                typed[token] += 1
            else:
                unknown.append(src or '[figure without img src]')
        return typed, unknown

    def visuals(self, body, manifest=None):
        """Actual figure images plus legacy tables/placeholders, with typed figures for Mangabeira."""
        imgs = re.findall(r'<img\b[^>]*>', body)
        typed, _ = self._inline_types(body, manifest)
        return imgs, len(imgs) + len(re.findall(r'\[\[IMG \d+\]\]', body)) + len(re.findall(r'<table\b', body)), typed

    def interactive_count(self, body):
        allowed = self.COMP['images'].get('interactive_html') or {}
        if not allowed.get('required', False):
            return 1
        found = 0
        if re.search(r'<details\b', body, re.I): found += 1
        if re.search(r'<table\b', body, re.I): found += 1
        if re.search(r'<input\b[^>]*type=["\']checkbox["\']', body, re.I): found += 1
        if re.search(r'(?:<[^>]+\brole=["\']tab(list)?["\']|<tabs\b|data-tabs\s*=)', body, re.I): found += 1
        if re.search(r'(?:data-interactive=["\']callout["\']|class=["\'][^"\']*\bcallout\b)', body, re.I): found += 1
        return found

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
                   post_id=None, date=None, cover=None, manifest=None):
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

        imgs, nvis, typed = self.visuals(body, manifest)
        _, unknown_inline = self._inline_types(body, manifest)
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
        for kind, minimum in (COMP['images'].get('inline_minimums') or {}).get(t, {}).items():
            if typed.get(kind, 0) < int(minimum):
                suffix = ''
                if unknown_inline:
                    suffix = f'; unknown-typed figure(s): {", ".join(unknown_inline)}'
                add('inline_' + kind, 'block', f'{typed.get(kind, 0)} typed {kind} visual(s) (contract minimum {minimum}){suffix}')
        interactive = COMP['images'].get('interactive_html') or {}
        if interactive.get('required', False) and self.interactive_count(body) < int(interactive.get('minimum_elements', 1)):
            add('interactive_html', 'block', 'body is missing a real interactive HTML element')

        if spec.get('requires_scorecard'):
            sc = re.search(r'<h[23][^>]*>(?:(?!</h[23]>).)*(?:scorecard|placar|pontua|puntua)(?:(?!</h[23]>).)*</h[23]>(.*?)(?=<h2|$)', body, re.S | re.I)
            scored = 0
            if sc:
                for table in re.findall(r'<table\b.*?</table>', sc.group(1), re.S | re.I):
                    for row in re.findall(r'<tr\b.*?</tr>', table, re.S | re.I):
                        cells = [strip_tags(c).strip() for c in re.findall(r'<t([dh])\b[^>]*>(.*?)</t\1>', row, re.S | re.I) for c in [c[1]]]
                        # a scored criterion: a named first cell (td or a row-header th) and a score (a number) in another cell;
                        # a header row (only <th>, no number) never counts
                        if re.search(r'<td\b', row, re.I) and len(cells) >= 2 and re.search(r'[A-Za-z]{3}', cells[0]) and any(re.search(r'\d', c) for c in cells[1:]):
                            scored += 1
            need = int(spec.get('scorecard_min_criteria', 3))
            if scored < need:
                add('scorecard', 'block', f'{t} requires a scored scorecard: an H2/H3 with "scorecard" followed by a table of at least {need} named criteria, each with a score ({scored} found)')
        rp = self.route_problem(t, link)
        if rp:
            add('type_route', 'block', rp)

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
        for check, severity, message in cover_contract_findings(self.C, live_html if live_html is not None else body, og,
                                                                draft=live_html is None, page_url=link if live_html is not None else None):
            add(check, severity, message)

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

        t = self.resolve_type(plan.get('type')) or plan.get('type')
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
        if spec.get('requires_scorecard') and not any(
                v.get('kind') in ('tabela', 'table') and re.search(r'scorecard|placar|pontua|puntua', v.get('about', ''), re.I) for v in vis):
            add('scorecard', f'{t} requires a scored scorecard: plan one (kind "table", about "scorecard ...": named criteria, each scored)')
        # a plan names its slug; audit.plan_url_prefix (the primary language's article path) turns it into the URL live QA will route
        prefix = self.AUDIT.get('plan_url_prefix')
        rp = self.route_problem(t, plan.get('url') or (prefix and plan.get('slug') and f'{prefix}{plan.get("slug")}'))
        if rp:
            add('type_route', rp)
        if spec.get('faq_required', True):
            lo, hi = spec.get('faq_min_questions', COMP['faq']['min_questions']), spec.get('faq_max_questions', COMP['faq']['max_questions'])
            if not lo <= len(plan.get('faq') or []) <= hi:
                add('faq', f'{len(plan.get("faq") or [])} planned FAQ question(s) (contract {lo}-{hi})')
        if spec.get('requires_promise') and not (plan.get('promise') or '').strip():
            add('promise', f'{t}: state the calculation or number the headline promises; the draft must deliver it')
        if spec.get('requires_alternatives') and not [x for x in plan.get('alternatives') or [] if x.get('name') and x.get('source')]:
            add('alternatives', f'{t}: plan at least one real alternative with its source, compared in the same units')
        if spec.get('requires_price_ledger'):
            accepts = tuple(spec.get('price_ledger_accepts') or ('PASS', 'PRESS_QUOTE', 'NO_PUBLIC_PRICE'))
            ledgers = plan.get('price_ledger') if isinstance(plan.get('price_ledger'), list) else [plan.get('price_ledger')]
            # each ledger must be valid AND about a product this plan names (headline, promise or `products`), not any old ledger
            about = ' '.join(str(x) for x in [plan.get('headline'), plan.get('promise'), *(plan.get('products') or [])] if x)
            ok = [lp for lp in ledgers if lp and valid_price_ledger(lp, accepts) and ledger_matches(lp, about)]
            if not ok:
                add('price_ledger', f'{t}: every price needs a fresh price-research ledger for a product this plan names (price_ledger: path(s) to price-ledger.json; products: [...])')
        if spec.get('requires_destination'):
            u = str(plan.get('tool_url') or '')
            if u and u not in link_cache:
                link_cache[u] = status_and_final(u)
            if not self.is_internal(u) or (link_cache.get(u) or (0,))[0] != 200:
                add('destination', f'{t}: the tool/page this article explains must be a LIVE page on {self.site} (tool_url {u or "missing"}{"" if not u else " -> HTTP " + str((link_cache.get(u) or (0,))[0])}); missing = destination commission first')
        if t in self.product_types:
            cov = plan.get('cover') or {}
            if cov.get('kind') not in ('official', 'ai_from_official') or not cov.get('source'):
                add('product_cover', f'{t}: plan the cover as the official product image (cover.kind "official", cover.source = URL) '
                                     'or an AI image built from it ("ai_from_official"); never an invented render or a shared stock picture')
        return {'verdict': 'FAIL' if findings else 'PASS', 'type': t, 'findings': findings}
