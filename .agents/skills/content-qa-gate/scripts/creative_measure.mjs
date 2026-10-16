// Shared measurement for rendered social creatives (carousel slides, pins, any fixed-size canvas), 2026-10-08.
// One page in, measured rows out: contrast at 9 points per text box over the bare background, smallest font, number of sizes,
// type scale, glyph safe margin, line height, overflow, fonts loaded, images loaded, photo resolution, page errors.
// Thresholds come from the caller's contract `visual` block. Used by carousel-generator/carousel_qa.mjs and
// pinterest-package/scripts/pin_qa.mjs, so every format is measured by the same code.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const sha = b => createHash('sha256').update(b).digest('hex');
export const check = (list, id, pass, measurement, blocking = true) => list.push({ id, result: pass ? 'pass' : (blocking ? 'fail' : 'warn'), measurement });

/** Pixel size of a PNG (IHDR) or JPEG (SOFn) without a decoder. */
export function dims(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  for (let o = 2; o < b.length - 9;) {
    if (b[o] !== 0xFF) { o++; continue; }
    const mk = b[o + 1];
    if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk)) return { width: b.readUInt16BE(o + 7), height: b.readUInt16BE(o + 5) };
    o += 2 + b.readUInt16BE(o + 2);
  }
  return { width: null, height: null };
}

/** Measure one rendered HTML file at W x H against the contract's `visual` thresholds V. */
export async function measureCanvas(browser, file, W, H, V) {
  const rows = [];
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (!/fonts\.g/.test(r.url())) errors.push('request failed: ' + r.url().slice(0, 120)); });
  await page.goto('file://' + file); await page.waitForLoadState('networkidle').catch(() => errors.push('network idle timeout'));
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(async (exempt) => {
    const texts = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const nd = walker.currentNode; if (!nd.textContent.trim()) continue;
      const el = nd.parentElement, cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const rg = document.createRange(); rg.selectNodeContents(nd);
      const rects = [...rg.getClientRects()].filter(r => r.width > 1 && r.height > 1).map(r => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      if (!rects.length) continue;
      const size = parseFloat(cs.fontSize), lh = cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / size;
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const chrome = exempt.length > 0 && !!el.closest(exempt.join(','));
      texts.push({ chrome, text: nd.textContent.trim(), size, lh, weight: cs.fontWeight, fam, loaded: document.fonts.check(`${cs.fontWeight} ${size}px "${fam}"`),
        color: (cs.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number), rects, multiline: rects.length > 1 });
    }
    const imgs = [...document.querySelectorAll('img')].map(im => ({ src: im.currentSrc || im.src, w: im.naturalWidth, h: im.naturalHeight, ok: im.complete && im.naturalWidth > 0, cls: String(im.className), alt: im.alt }));
    const bgs = [...new Set([...document.querySelectorAll('*')].flatMap(el => [...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(x => x[1])))];
    const bgImgs = await Promise.all(bgs.map(src => new Promise(res => { const im = new Image(); im.onload = () => res({ src, w: im.naturalWidth, h: im.naturalHeight, ok: true, cls: 'background', alt: '' }); im.onerror = () => res({ src, w: 0, h: 0, ok: false, cls: 'background', alt: '' }); im.src = src; })));
    return { texts, imgs: [...imgs, ...bgImgs], bgs, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight };
  }, V.exempt_selectors || []);
  // bare background: hide glyphs only, keep panels/chips, then sample 9 points per text box inside the page's own canvas
  await page.addStyleTag({ content: '*{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}' });
  const bare = (await page.screenshot()).toString('base64');
  const samples = await page.evaluate(async ({ b64, boxes }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    return boxes.map(rs => rs.flatMap(r => [.2, .5, .8].flatMap(fx => [.2, .5, .8].map(fy => {
      const x = Math.min(cv.width - 1, Math.max(0, Math.round(r.x + r.w * fx))), y = Math.min(cv.height - 1, Math.max(0, Math.round(r.y + r.h * fy)));
      return [...cx.getImageData(x, y, 1, 1).data.slice(0, 3)];
    }))));
  }, { b64: bare, boxes: m.texts.map(t => t.rects) });
  await page.close();

  const lum = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, k) => a + v * [.2126, .7152, .0722][k], 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  const worst = m.texts.map((t, k) => {
    const r = Math.min(...samples[k].map(bg => ratio(t.color, bg)));
    const need = t.size >= V.large_text_min_px ? V.contrast_min_large : V.contrast_min_body;
    return { text: t.text.slice(0, 60), ratio: +r.toFixed(2), need };
  });
  const lowC = worst.filter(w => w.ratio < w.need);
  check(rows, 'contrast', lowC.length === 0, lowC.length ? `below target: ${lowC.slice(0, 4).map(w => `"${w.text}" ${w.ratio}:1 < ${w.need}`).join('; ')}` : `min ${Math.min(...worst.map(w => w.ratio)).toFixed(2)}:1 (9 points per text box, bare background)`);
  const typo = m.texts.filter(t => !t.chrome);   // contract visual.exempt_selectors: chrome excluded from size rules only
  const sizes = [...new Set(typo.map(t => Math.round(t.size)))].sort((a, b) => a - b);
  check(rows, 'min_font', !sizes.length || sizes[0] >= V.min_font_px, `smallest text ${sizes[0]}px (= ${(sizes[0] * 360 / W).toFixed(1)}px on a 360px phone); floor ${V.min_font_px}`);
  check(rows, 'font_sizes', sizes.length <= V.max_font_sizes_per_slide, `${sizes.length} sizes (${sizes.join(', ')}); max ${V.max_font_sizes_per_slide}`);
  if (V.brand_type_scale_px) { const off = sizes.filter(x => !V.brand_type_scale_px.includes(x)); check(rows, 'type_scale', off.length === 0, off.length ? `off-scale sizes ${off.join(', ')}` : 'all sizes on the brand scale', !!V.type_scale_enforced); }
  const margin = Math.min(...m.texts.flatMap(t => t.rects.map(r => Math.min(r.x, r.y, W - r.x - r.w, H - r.y - r.h))));
  check(rows, 'safe_margin', margin >= V.safe_margin_px - 0.5, `closest glyph ${margin.toFixed(1)}px from an edge; floor ${V.safe_margin_px}`);
  const badLh = m.texts.filter(t => t.multiline && (t.lh < V.line_height_min - 0.001 || t.lh > V.line_height_max + 0.001));
  check(rows, 'line_height', badLh.length === 0, badLh.length ? `multi-line text out of ${V.line_height_min}-${V.line_height_max}: ${badLh.slice(0, 3).map(t => `"${t.text.slice(0, 60)}" ${t.lh.toFixed(2)}`).join('; ')}` : 'multi-line text within range');
  check(rows, 'overflow', m.scrollW <= W + 1 && m.scrollH <= H + 1 && !m.texts.some(t => t.rects.some(r => r.x < -1 || r.y < -1 || r.x + r.w > W + 1 || r.y + r.h > H + 1)), `page ${m.scrollW}x${m.scrollH}; canvas ${W}x${H}`);
  const notLoaded = [...new Set(m.texts.filter(t => !t.loaded).map(t => t.fam))];
  if (V.fonts_must_load) check(rows, 'fonts_loaded', notLoaded.length === 0, notLoaded.length ? `fallback font used for: ${notLoaded.join(', ')}` : 'every text face loaded');
  const photos = m.imgs.filter(im => !/logo|mark|emblem|icon|avatar|selo|seal/i.test(im.src + ' ' + im.cls));
  const brokenImg = m.imgs.filter(im => !im.ok);
  check(rows, 'images_load', brokenImg.length === 0, brokenImg.length ? `not loaded: ${brokenImg.map(im => im.src.slice(-60)).join(', ')}` : `${m.imgs.length} images loaded`);
  const small = photos.filter(im => im.ok && (Math.max(im.w, im.h) < V.photo_min_long_edge_px || Math.min(im.w, im.h) < V.photo_min_short_edge_px));
  check(rows, 'photo_resolution', small.length === 0, small.length ? small.map(im => `${im.w}x${im.h} ${im.src.slice(-50)}`).join('; ') : photos.length ? photos.map(im => `${im.w}x${im.h}`).join(', ') : 'no photo');
  check(rows, 'page_errors', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'none');
  const photoHashes = [];
  for (const src of new Set(photos.map(p => p.src))) {
    if (!src.startsWith('file:') && !src.startsWith('data:')) continue;
    try { photoHashes.push(src.startsWith('data:') ? sha(src) : sha(readFileSync(decodeURIComponent(src.replace('file://', ''))))); } catch {}
  }
  return { rows, visibleText: m.texts.map(t => t.text).join(' '), sizes, contrastMin: Math.min(...worst.map(w => w.ratio)), photoHashes };
}
