import json
import base64
import io
from pathlib import Path

from PIL import Image

from qa_core import Gate, _image_dimensions


def contract(tmp_path):
    cover = tmp_path / 'cover.png'
    Image.new('RGB', (1200, 630), '#0A2540').save(cover)
    return {
        'site': 'https://example.test',
        'components': {
            'title': {'min_chars': 1, 'max_chars': 200},
            'meta_description': {'hard_min': 0, 'hard_max': 500},
            'readability': {'min_words': 0},
            'internal_links': {'min': 0}, 'external_refs': {'min': 0},
            'faq': {'heading': 'FAQ', 'min_questions': 0, 'max_questions': 10},
            'typography': {'em_dash_allowed': True},
            'images': {
                'featured_required': False,
                'min_in_article': 0,
                'cover': {'required': True, 'format': ['png'], 'width': 1200, 'height': 630,
                          'aspect_ratio': 1.9048, 'aspect_tolerance': 0.03,
                          'style': 'brand-designed-editorial', 'palette': ['#0A2540']},
                'inline_minimums': {'article': {'chart': 1}},
                'interactive_html': {'required': True, 'minimum_elements': 1},
                'alt_text': {'min_chars': 0, 'banned': []},
            },
        },
        'types': {'article': {'min_words': 0, 'faq_required': False}},
    }, cover


def test_draft_consumes_cover_typed_visual_and_interactive_contract(tmp_path):
    c, cover = contract(tmp_path)
    g = Gate(c, c['site'])
    body = (f'<meta name="cover-style" content="brand-designed-editorial">'
            f'<img data-cover="true" src="{cover}">'
            '<figure data-visual-type="chart"><img src="https://example.test/chart.png"></figure>'
            '<details><summary>Open</summary>Evidence</details>')
    result = g.audit_core('x', 'https://example.test/x', 'Title', 'Title', '', body, 'article')
    assert result['verdict'] == 'PASS', result['findings']


def test_live_rejects_wrong_cover_dimensions_and_missing_typed_content(tmp_path):
    c, cover = contract(tmp_path)
    Image.new('RGB', (100, 100), '#0A2540').save(cover)
    g = Gate(c, c['site'])
    page = (f'<meta property="og:image" content="{cover}">'
            '<meta name="cover-style" content="brand-designed-editorial">'
            '<figure data-visual-type="chart"><img src="https://example.test/chart.png"></figure>')
    result = g.audit_core(
        'x', 'https://example.test/x', 'Title', 'Title', '',
        '<p>body</p><figure data-visual-type="chart"><img src="https://example.test/chart.png"></figure>',
        'article', live_html=page,
    )
    checks = {f['check'] for f in result['findings']}
    assert {'cover_dimensions', 'interactive_html'} <= checks
    assert 'inline_chart' not in checks


def test_draft_accepts_data_uri_cover_without_style_metadata(tmp_path):
    c, _ = contract(tmp_path)
    cover = io.BytesIO()
    Image.new('RGB', (1200, 630), '#0A2540').save(cover, format='PNG')
    data_uri = 'data:image/png;base64,' + base64.b64encode(cover.getvalue()).decode('ascii')
    g = Gate(c, c['site'])
    body = (f'<img data-cover="true" src="{data_uri}">'
            f'<figure data-visual-type="chart"><img src="{data_uri}"></figure>'
            '<details><summary>Open</summary>Evidence</details>')
    result = g.audit_core('x', 'https://example.test/x', 'Title', 'Title', '', body, 'article')
    checks = {f['check'] for f in result['findings']}
    assert result['verdict'] == 'PASS', result['findings']
    assert 'cover_unreadable' not in checks
    assert 'cover_style' not in checks


def test_draft_accepts_declared_cdn_cover_without_fetching(tmp_path):
    c, _ = contract(tmp_path)
    c['components']['images']['cover']['cdn_hosts'] = ['cdn.example.test']
    g = Gate(c, c['site'])
    cover = 'https://cdn.example.test/covers/editorial-cover.png'
    body = (f'<meta property="og:image" content="{cover}">'
            '<figure data-visual-type="chart"><img src="https://example.test/chart.png"></figure>'
            '<details><summary>Open</summary>Evidence</details>')
    result = g.audit_core('x', 'https://example.test/x', 'Title', 'Title', '', body, 'article')
    assert result['verdict'] == 'PASS', result['findings']
    checks = {f['check'] for f in result['findings']}
    assert 'cover_unreadable' not in checks
    assert 'cover_deferred' in checks


def test_draft_cdn_cover_uses_local_package_copy_for_dimensions(tmp_path, monkeypatch):
    c, _ = contract(tmp_path)
    c['components']['images']['cover']['cdn_hosts'] = ['cdn.example.test']
    local = tmp_path / 'editorial-cover.png'
    local.write_bytes(b'\x89PNG\r\n\x1a\n' + b'\x00' * 8 + (1200).to_bytes(4, 'big') + (630).to_bytes(4, 'big'))
    monkeypatch.chdir(tmp_path)
    g = Gate(c, c['site'])
    cover = 'https://cdn.example.test/covers/editorial-cover.png'
    body = (f'<meta property="og:image" content="{cover}">'
            '<figure data-visual-type="chart"><img src="https://example.test/chart.png"></figure>'
            '<details><summary>Open</summary>Evidence</details>')
    result = g.audit_core('x', 'https://example.test/x', 'Title', 'Title', '', body, 'article')
    assert result['verdict'] == 'PASS', result['findings']
    assert 'cover_dimensions' not in {f['check'] for f in result['findings']}


def test_stdlib_cover_parser_reads_png_jpeg_and_webp_headers():
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 8 + (1200).to_bytes(4, 'big') + (630).to_bytes(4, 'big')
    jpeg = (b'\xff\xd8\xff\xc0\x00\x11\x08' + (630).to_bytes(2, 'big') +
            (1200).to_bytes(2, 'big') + b'\x00' * 10)
    webp = (b'RIFF' + b'\x00' * 4 + b'WEBPVP8X' + b'\x00' * 8 +
            (1199).to_bytes(3, 'little') + (629).to_bytes(3, 'little'))
    assert _image_dimensions(png) == (1200, 630)
    assert _image_dimensions(jpeg) == (1200, 630)
    assert _image_dimensions(webp) == (1200, 630)


def test_one_figure_cannot_satisfy_multiple_typed_visuals(tmp_path):
    c, cover = contract(tmp_path)
    c['components']['images']['inline_minimums']['article'] = {
        'chart': 1, 'screenshot': 1, 'illustrative': 1,
    }
    g = Gate(c, c['site'])
    body = (f'<img data-cover="true" src="{cover}">'
            '<figure class="chart screenshot illustrative"><img src="https://example.test/one.png"></figure>'
            '<details><summary>Open</summary>Evidence</details>')
    _, _, typed = g.visuals(body)
    assert typed['chart'] == 1
    assert typed['screenshot'] == 0
    assert typed['illustrative'] == 0


def test_inline_visual_type_can_be_annotated_on_img(tmp_path):
    c, cover = contract(tmp_path)
    g = Gate(c, c['site'])
    body = (f'<img data-cover="true" src="{cover}">'
            '<figure><img data-slot-type="chart" src="https://example.test/chart.png"></figure>')
    _, _, typed = g.visuals(body)
    assert typed['chart'] == 1


def test_inline_visual_type_can_come_from_manifest_file(tmp_path):
    c, cover = contract(tmp_path)
    c['components']['images']['inline_minimums']['article'] = {'screenshot': 1}
    manifest = {'visual_slots': [{'id': 'capture', 'type': 'screenshot', 'file': 'assets/capture.png'}]}
    g = Gate(c, c['site'], manifest=manifest)
    body = (f'<img data-cover="true" src="{cover}">'
            '<figure><img src="/assets/capture.png"></figure>')
    _, _, typed = g.visuals(body)
    assert typed['screenshot'] == 1


def test_unknown_inline_visual_does_not_satisfy_minimum_and_is_named(tmp_path):
    c, cover = contract(tmp_path)
    g = Gate(c, c['site'])
    body = (f'<img data-cover="true" src="{cover}">'
            '<figure><img src="https://example.test/unclassified.png"></figure>'
            '<details><summary>Open</summary>Evidence</details>')
    result = g.audit_core(
        'x', 'https://example.test/x', 'Title', 'Title', '', body, 'article',
        link_cache={'https://example.test/unclassified.png': (200, 'https://example.test/unclassified.png')},
    )
    finding = next(f for f in result['findings'] if f['check'] == 'inline_chart')
    assert 'unknown-typed figure(s)' in finding['message']
    assert 'unclassified.png' in finding['message']
