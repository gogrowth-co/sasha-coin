"""Candidate OFFICIAL images of a real product, from the manufacturer's own sources. No model, no spend.

  python3 find_official_images.py --page <official product page URL> [--pdf <datasheet URL>] --out <dir>

Collects og:image, product/gallery images (src, data-src, srcset, CMS media paths) and, for a datasheet, the images inside
the PDF (pdfimages). Downloads each candidate, skips icons/flags/logos/tiny files, and writes candidates.json with size and
source so a person or agent can pick the real product shot. Sites that block scripts: use a real browser download
(Playwright acceptDownloads) or fetch from another host; never substitute an invented render.
"""
import argparse, html, json, os, re, subprocess, urllib.parse, urllib.request

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/128 Safari/537.36'
SKIP = re.compile(r'logo|icon|favicon|flag|sprite|whatsapp|qrcode|avatar|banner-menu|gotop|placeholder|stock-photos', re.I)


def get(url, timeout=40):
    """Python first, then curl (some sites reset Python's TLS client but answer curl)."""
    for _ in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout) as r:
                return r.read()
        except Exception:
            pass
    r = subprocess.run(['curl', '-sL', '--max-time', str(timeout), '-A', UA, url], capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError(f'could not fetch {url}')
    return r.stdout


def size(path):
    try:
        from PIL import Image
        return Image.open(path).size
    except Exception:
        return (0, 0)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--page'); ap.add_argument('--pdf'); ap.add_argument('--out', required=True); ap.add_argument('--max', type=int, default=25)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    found = []
    if a.page:
        page = html.unescape(get(a.page).decode('utf-8', 'ignore'))
        og = re.findall(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', page)
        urls = og + re.findall(r'(?:src|data-src|data-lazy-src|href|content)="([^"]+\.(?:jpe?g|png|webp)(?:\?[^"]*)?)"', page, re.I)
        urls += [u.split()[0] for ss in re.findall(r'srcset="([^"]+)"', page) for u in ss.split(',') if u.strip()]
        seen = set()
        for u in urls:
            u = urllib.parse.urljoin(a.page, u.strip())
            if u in seen or SKIP.search(u):
                continue
            seen.add(u)
            if len(found) >= a.max:
                break
            fn = os.path.join(a.out, f'page-{len(found):02d}' + os.path.splitext(urllib.parse.urlsplit(u).path)[1][:5])
            try:
                open(fn, 'wb').write(get(u))
            except Exception:
                continue
            w, h = size(fn)
            if w < 300 or h < 200:
                os.remove(fn); continue
            found.append({'file': fn, 'source': u, 'width': w, 'height': h, 'origin': 'og:image' if u in og else 'page'})
    if a.pdf:
        pdf = os.path.join(a.out, 'datasheet.pdf'); open(pdf, 'wb').write(get(a.pdf, 90))
        subprocess.run(['pdfimages', '-j', '-png', pdf, os.path.join(a.out, 'pdf')], check=False)
        for f in sorted(os.listdir(a.out)):
            if f.startswith('pdf-') and not f.endswith(('.ppm', '.pbm')):
                w, h = size(os.path.join(a.out, f))
                if w >= 300 and h >= 300:
                    found.append({'file': os.path.join(a.out, f), 'source': a.pdf, 'width': w, 'height': h, 'origin': 'datasheet'})
    json.dump(found, open(os.path.join(a.out, 'candidates.json'), 'w'), indent=1)
    for c in found:
        print(f"{c['width']}x{c['height']}  {c['origin']:<9} {c['file']}  <- {c['source'][:100]}")
    print(f'{len(found)} candidate(s). Look at them (vision check) and pick the real product shot; credit the owner.')
