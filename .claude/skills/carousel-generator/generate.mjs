/**
 * carousel-generator/generate.mjs  v3
 * Deterministic LinkedIn carousel generator.
 * Usage: node generate.mjs --content slides.json --out ./out/
 *
 * Slide fields:
 *   layout       'cover' | 'stat' | 'quote' | 'process' | 'author-cta' | 'default'
 *   eyebrow      string  ALL CAPS aqua label
 *   heading      string  Montserrat bold headline. Use ==word== (aqua pill) or ##word## (gold pill)
 *   stat         string  Large gold numeral / percentage  (layout: stat)
 *   statLabel    string  Aqua all-caps label under stat
 *   body         string  Inter body text
 *   bodyCard     bool    Wrap body in translucent bordered card (cover pattern)
 *   accentBar    bool    56px aqua bar above heading
 *   bgImage      path    Full-bleed background (dark overlay applied)
 *   bgGradient   string  CSS gradient string
 *   image        path    Left/right hero photo (author-cta, default)
 *   imagePosition 'left' | 'right'
 *   processNodes array   [{n: '01', label: '...'}]  (layout: process)
 *   ctaPills     array   string[]  (layout: author-cta)
 *   credentials  array   string[]  credential row (layout: author-cta)
 *   customHTML   string  Raw HTML injected
 *   customCSS    string  Extra CSS
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, isAbsolute } from 'path';
import { execSync } from 'child_process';

const BRAND = {
  navy:     '#0A2540',
  aqua:     '#1FB6FF',
  gold:     '#FFB800',
  white:    '#FFFFFF',
  midNavy:  '#0D3558',
  muted:    '#8B9BAD',
  navyDark: '#061829',
};

const SLIDE_W = 1080;
const SLIDE_H = parseInt(process.env.SLIDE_H || '1350', 10);
const SCALE   = SLIDE_H / 1350;
const s       = n => Math.round(n * SCALE);

function resolveImageRef(ref, baseDir) {
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref) || ref.startsWith('file://') || ref.startsWith('data:')) return ref;
  const abs = isAbsolute(ref) ? ref : resolve(baseDir, ref);
  return `file://${abs}`;
}

function renderHeading(text) {
  if (!text) return '';
  return text
    .replace(/==([^=]+)==/g, '<span class="hl hl-aqua">$1</span>')
    .replace(/##([^#]+)##/g, '<span class="hl hl-gold">$1</span>');
}

function buildSlideHTML(slide, baseDir, brandStrip) {
  const layout = slide.layout || 'default';
  const hasStat     = Boolean(slide.stat);
  const hasHeading  = Boolean(slide.heading);
  const hasBody     = Boolean(slide.body);
  const hasEyebrow  = Boolean(slide.eyebrow);
  const bgImage     = resolveImageRef(slide.bgImage, baseDir);
  const heroImage   = resolveImageRef(slide.image, baseDir);
  const iconImage   = resolveImageRef(slide.icon, baseDir);
  const brandAvatar = brandStrip ? resolveImageRef(brandStrip.avatar, baseDir) : null;
  const showBrandStrip = brandStrip && layout !== 'author-cta' && slide.brandStrip !== false;
  const bodyCard    = Boolean(slide.bodyCard);

  const bgStyle = bgImage
    ? `background: linear-gradient(rgba(10,37,64,0.80), rgba(10,37,64,0.94)), url("${bgImage}") center/cover no-repeat, ${BRAND.navy};`
    : slide.bgGradient
      ? `background: ${slide.bgGradient};`
      : `background: ${BRAND.navy};`;

  const imagePosition = slide.imagePosition || (layout === 'author-cta' ? 'left' : 'right');
  const splitLayout   = Boolean(heroImage);
  const imageOnLeft   = splitLayout && imagePosition === 'left';

  // -- Process nodes HTML --
  let processHTML = '';
  if (layout === 'process' && Array.isArray(slide.processNodes)) {
    const nodes = slide.processNodes.map((n, i) => {
      const fill = i % 2 === 1 ? BRAND.gold : BRAND.aqua;
      return `
        <div class="proc-node">
          <div class="proc-circle" style="background:${fill};color:${BRAND.navy};">${n.n || (i + 1)}</div>
          <div class="proc-label">${n.label || ''}</div>
        </div>
        ${i < slide.processNodes.length - 1 ? '<div class="proc-line"></div>' : ''}
      `;
    }).join('');
    processHTML = `<div class="proc-flow">${nodes}</div>`;
  }

  // -- CTA pills HTML --
  const ctaPills = Array.isArray(slide.ctaPills) ? slide.ctaPills : null;
  const ctaPillsHTML = ctaPills
    ? `<div class="cta-pills">${ctaPills.map(p =>
        `<div class="cta-pill"><span class="cta-pill-icon">→</span><span>${p}</span></div>`
      ).join('')}</div>`
    : '';

  // -- Credentials HTML --
  const credentials = Array.isArray(slide.credentials) ? slide.credentials : null;
  const credentialsHTML = credentials
    ? `<div class="credentials">${credentials.map(c => `<div class="credential">${c}</div>`).join('')}</div>`
    : '';

  // -- Body HTML --
  const bodyHTML = hasBody
    ? (bodyCard
        ? `<div class="body-card"><p class="body">${slide.body}</p></div>`
        : `<p class="body">${slide.body}</p>`)
    : '';

  // -- Brand strip HTML --
  const brandStripHTML = showBrandStrip ? `
    <div class="brand-strip">
      <div class="avatar"></div>
      <div class="brand-text">
        <div class="brand-name">${brandStrip.name || 'Gabriel Mangabeira'}</div>
        <div class="brand-role">${brandStrip.role || 'Analyst in the Arena'}</div>
      </div>
    </div>` : '';

  // -- Footer HTML --
  const footerHTML = `
    <div class="footer">
      <span class="footer-brand">Gabriel Mangabeira · mangabeira.net</span>
      <span class="slide-number">${String(slide.index).padStart(2,'0')} / ${String(slide.total).padStart(2,'0')}</span>
    </div>`;

  // -----------------------------------------------------------------------
  // Layout-specific body composition
  // -----------------------------------------------------------------------
  let innerHTML = '';

  if (layout === 'cover') {
    innerHTML = `
      <div class="cover-top">
        ${brandStripHTML}
        ${hasEyebrow ? `<div class="eyebrow">${slide.eyebrow}</div>` : ''}
        ${slide.accentBar ? `<div class="accent-bar"></div>` : ''}
        ${hasHeading ? `<h1>${renderHeading(slide.heading)}</h1>` : ''}
      </div>
      <div class="cover-bottom">
        ${bodyHTML}
        <div class="swipe-hint">Swipe to read →</div>
        ${footerHTML}
      </div>`;

  } else if (layout === 'stat') {
    innerHTML = `
      <div class="stat-bg-deco">${slide.stat || ''}</div>
      <div class="stat-top">
        ${hasEyebrow ? `<div class="eyebrow">${slide.eyebrow}</div>` : ''}
        <div class="stat">${slide.stat}</div>
        ${slide.statLabel ? `<div class="stat-label">${slide.statLabel}</div>` : ''}
      </div>
      <div class="stat-bottom">
        <div class="stat-rule"></div>
        ${bodyHTML}
      </div>
      ${footerHTML}`;

  } else if (layout === 'quote') {
    innerHTML = `
      <div class="quote-header">
        ${hasEyebrow ? `<div class="eyebrow">${slide.eyebrow}</div>` : ''}
        <div class="quote-bar"></div>
      </div>
      <div class="quote-body">
        <h1 class="quote-text">${renderHeading(slide.heading)}</h1>
      </div>
      <div class="quote-footer-group">
        ${hasBody ? `<div class="quote-attr-row"><div class="quote-attr-pip"></div><p class="quote-attr">${slide.body}</p></div>` : ''}
        ${footerHTML}
      </div>`;

  } else if (layout === 'process') {
    innerHTML = `
      ${brandStripHTML}
      <div class="proc-top">
        ${hasEyebrow ? `<div class="eyebrow">${slide.eyebrow}</div>` : ''}
        ${hasHeading ? `<h1>${renderHeading(slide.heading)}</h1>` : ''}
      </div>
      ${processHTML}
      ${footerHTML}`;

  } else if (layout === 'author-cta') {
    innerHTML = `
      <div class="closer-content">
        ${hasEyebrow ? `<div class="eyebrow closer-eyebrow">${slide.eyebrow}</div>` : ''}
        ${slide.accentBar ? `<div class="accent-bar"></div>` : ''}
        ${hasHeading ? `<h1>${renderHeading(slide.heading)}</h1>` : ''}
        ${bodyHTML}
        ${ctaPillsHTML}
        ${credentialsHTML}
      </div>`;

  } else {
    innerHTML = `
      ${brandStripHTML}
      ${hasEyebrow ? `<div class="eyebrow">${slide.eyebrow}</div>` : ''}
      ${slide.accentBar ? `<div class="accent-bar"></div>` : ''}
      ${hasHeading ? `<h1>${renderHeading(slide.heading)}</h1>` : ''}
      ${hasStat ? `<div class="stat-block"><div class="stat">${slide.stat}</div>${slide.statLabel ? `<div class="stat-label">${slide.statLabel}</div>` : ''}</div>` : ''}
      ${bodyHTML}
      ${ctaPillsHTML}
      ${credentialsHTML}
      ${slide.customHTML ? `<div>${slide.customHTML}</div>` : ''}
      ${footerHTML}`;
  }

  // -----------------------------------------------------------------------
  // CSS
  // -----------------------------------------------------------------------
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${SLIDE_W}px;
    height: ${SLIDE_H}px;
    overflow: hidden;
    ${bgStyle}
    font-family: 'Inter', system-ui, sans-serif;
    color: ${BRAND.white};
    position: relative;
  }

  /* Subtle grid texture on all slides */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(31,182,255,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(31,182,255,0.045) 1px, transparent 1px);
    background-size: 72px 72px;
    pointer-events: none;
    z-index: 0;
  }

  .slide {
    width: 100%;
    height: 100%;
    padding: ${layout === 'author-cta' ? '0' : `${s(72)}px ${s(72)}px ${s(56)}px`};
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    ${splitLayout && imageOnLeft && layout !== 'author-cta' ? `padding-left: calc(42% + 56px);` : ''}
    ${splitLayout && !imageOnLeft && layout !== 'author-cta' ? `padding-right: 0;` : ''}
  }

  /* ---- Hero image (non-closer) ---- */
  .hero-image {
    position: absolute;
    top: 0;
    ${imageOnLeft ? 'left: 0;' : 'right: 0;'}
    width: 44%;
    height: 100%;
    background: ${heroImage ? `url("${heroImage}") center/cover no-repeat` : 'transparent'};
  }
  .hero-image::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(${imageOnLeft ? '270deg' : '90deg'}, ${BRAND.navy} 0%, transparent 30%);
  }

  /* ---- Brand strip ---- */
  .brand-strip {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: ${s(40)}px;
    flex-shrink: 0;
  }
  .avatar {
    width: ${s(60)}px;
    height: ${s(60)}px;
    border-radius: 50%;
    background: ${brandAvatar ? `url("${brandAvatar}") center/cover` : BRAND.aqua};
    border: 2px solid ${BRAND.aqua};
    flex-shrink: 0;
  }
  .brand-name {
    font-family: 'Montserrat', sans-serif;
    font-size: 19px;
    font-weight: 700;
    color: ${BRAND.white};
    line-height: 1.2;
  }
  .brand-role {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: ${BRAND.aqua};
    letter-spacing: 0.4px;
  }

  /* ---- Eyebrow ---- */
  .eyebrow {
    font-family: 'Montserrat', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: ${BRAND.aqua};
    margin-bottom: 18px;
    flex-shrink: 0;
  }

  /* ---- Accent bar ---- */
  .accent-bar {
    width: 56px;
    height: 5px;
    background: ${BRAND.aqua};
    margin-bottom: 28px;
    flex-shrink: 0;
  }

  /* ---- Headline ---- */
  h1 {
    font-family: 'Montserrat', sans-serif;
    font-size: ${layout === 'cover' ? `${s(112)}px` : layout === 'process' ? `${s(72)}px` : `${s(68)}px`};
    font-weight: 900;
    line-height: 1.03;
    letter-spacing: -1.5px;
    color: ${BRAND.white};
    margin-bottom: 24px;
    flex-shrink: 0;
  }

  /* ---- Highlight pills ---- */
  .hl {
    display: inline-block;
    padding: 2px 16px;
    margin: 0 2px;
    border-radius: 8px;
    line-height: inherit;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .hl-aqua { background: ${BRAND.aqua}; color: ${BRAND.navy}; }
  .hl-gold { background: ${BRAND.gold}; color: ${BRAND.navy}; }

  /* ---- Body text ---- */
  .body {
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    line-height: 1.65;
    color: rgba(255,255,255,0.88);
  }

  /* ---- Body card (cover pattern) ---- */
  .body-card {
    background: rgba(13, 53, 88, 0.72);
    backdrop-filter: blur(4px);
    padding: 32px 36px;
    border-left: 5px solid ${BRAND.aqua};
    flex-shrink: 0;
  }
  .body-card .body { font-size: 26px; color: ${BRAND.white}; }

  /* ---- Footer ---- */
  .footer {
    margin-top: 28px;
    padding-top: 18px;
    border-top: 1px solid rgba(255,255,255,0.12);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .footer-brand {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    color: ${BRAND.muted};
  }
  .slide-number {
    font-family: 'Montserrat', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: ${BRAND.muted};
    letter-spacing: 1px;
  }

  /* ====================================================
     COVER LAYOUT
  ==================================================== */
  ${layout === 'cover' ? `
  .slide { justify-content: space-between; }
  .cover-top { display: flex; flex-direction: column; }
  .cover-top h1 { margin-bottom: 0; }
  .cover-bottom { display: flex; flex-direction: column; gap: 0; }
  .swipe-hint {
    font-family: 'Montserrat', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.3);
    text-transform: uppercase;
    margin-top: 20px;
    margin-bottom: 12px;
  }
  ` : ''}

  /* ====================================================
     STAT LAYOUT
  ==================================================== */
  ${layout === 'stat' ? `
  .brand-strip { display: none !important; }
  .slide { justify-content: flex-start; }
  .stat-bg-deco {
    position: absolute;
    right: -40px;
    bottom: 60px;
    font-family: 'Montserrat', sans-serif;
    font-size: ${s(700)}px;
    font-weight: 900;
    line-height: 1;
    color: rgba(31,182,255,0.055);
    letter-spacing: -24px;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }
  .stat-top { flex-shrink: 0; position: relative; z-index: 1; }
  .stat-bottom { flex-shrink: 0; margin-top: auto; position: relative; z-index: 1; }
  .stat {
    font-family: 'Montserrat', sans-serif;
    font-size: ${s(260)}px;
    font-weight: 900;
    line-height: 0.86;
    color: ${BRAND.gold};
    letter-spacing: -8px;
    margin-top: 8px;
  }
  .stat-label {
    font-family: 'Inter', sans-serif;
    font-size: 18px;
    color: ${BRAND.aqua};
    margin-top: 18px;
    text-transform: uppercase;
    letter-spacing: 3px;
    font-weight: 700;
  }
  .stat-rule {
    width: 80px;
    height: 3px;
    background: ${BRAND.aqua};
    margin-bottom: 28px;
    opacity: 0.45;
  }
  .stat-bottom .body {
    font-size: 30px;
    line-height: 1.5;
    max-width: 860px;
    color: rgba(255,255,255,0.9);
  }
  ` : ''}

  /* ====================================================
     QUOTE LAYOUT
  ==================================================== */
  ${layout === 'quote' ? `
  .brand-strip { display: none !important; }
  .slide { height: ${SLIDE_H}px !important; justify-content: flex-start !important; }
  .quote-header {
    flex-shrink: 0;
  }
  .quote-header .eyebrow {
    font-size: ${s(26)}px;
    letter-spacing: 5px;
    color: ${BRAND.gold};
    margin-bottom: 14px;
  }
  .quote-bar {
    width: 140px;
    height: 10px;
    background: ${BRAND.gold};
    border-radius: 5px;
    margin-top: 0;
    margin-bottom: ${s(56)}px;
  }
  .quote-body {
    flex-shrink: 0;
  }
  .quote-text {
    font-family: 'Montserrat', sans-serif !important;
    font-size: ${s(100)}px !important;
    font-weight: 900 !important;
    line-height: 1.04 !important;
    letter-spacing: -3px !important;
    color: ${BRAND.white} !important;
    margin-bottom: 0 !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  .quote-footer-group {
    position: fixed;
    bottom: ${s(56)}px;
    left: ${s(72)}px;
    right: ${s(72)}px;
    z-index: 2;
  }
  .quote-attr-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }
  .quote-attr-pip {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${BRAND.aqua};
    flex-shrink: 0;
    opacity: 0.9;
  }
  .quote-attr {
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    color: ${BRAND.aqua};
    letter-spacing: 3px;
    font-weight: 700;
    text-transform: uppercase;
    margin: 0;
  }
  ` : ''}

  /* ====================================================
     PROCESS LAYOUT
  ==================================================== */
  ${layout === 'process' ? `
  .slide { justify-content: space-between; }
  .proc-top { display: flex; flex-direction: column; flex-shrink: 0; }
  .proc-top h1 { margin-bottom: 0; }
  .proc-flow {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    padding: 16px 0;
  }
  .proc-node {
    display: flex;
    align-items: center;
    gap: 28px;
  }
  .proc-circle {
    width: ${s(96)}px;
    height: ${s(96)}px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Montserrat', sans-serif;
    font-weight: 900;
    font-size: ${s(34)}px;
    flex-shrink: 0;
  }
  .proc-label {
    font-family: 'Montserrat', sans-serif;
    font-size: ${s(28)}px;
    font-weight: 700;
    color: ${BRAND.white};
    line-height: 1.2;
  }
  .proc-line {
    width: 3px;
    height: 24px;
    background: ${BRAND.aqua};
    opacity: 0.35;
    margin-left: 46px;
    flex-shrink: 0;
  }
  ` : ''}

  /* ====================================================
     AUTHOR-CTA LAYOUT
  ==================================================== */
  ${layout === 'author-cta' ? `
  .slide { padding: 0; }
  .hero-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 40%;
    height: 100%;
    background: ${heroImage ? `url("${heroImage}") center 30%/130% auto no-repeat` : 'transparent'};
    background-color: #0B2E4E;
  }
  .hero-image::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0; right: 0;
    width: 5px;
    background: ${BRAND.aqua};
  }
  .closer-content {
    position: absolute;
    top: 0;
    left: 40%;
    right: 0;
    height: 100%;
    padding: ${s(80)}px ${s(64)}px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .closer-eyebrow {
    font-size: 12px !important;
    color: ${BRAND.gold} !important;
    letter-spacing: 5px !important;
    margin-bottom: 20px !important;
  }
  .closer-content h1 {
    font-size: ${s(52)}px !important;
    line-height: 1.08 !important;
    margin-bottom: 20px !important;
    letter-spacing: -1px !important;
  }
  .closer-content .body {
    font-size: 21px !important;
    line-height: 1.55 !important;
    color: rgba(255,255,255,0.8) !important;
    margin-bottom: 0;
  }
  .cta-pills {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 32px;
  }
  .cta-pill {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(31,182,255,0.1);
    border: 1px solid rgba(31,182,255,0.35);
    border-radius: 999px;
    padding: 14px 22px 14px 16px;
    font-family: 'Montserrat', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: ${BRAND.white};
  }
  .cta-pill-icon {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: ${BRAND.gold};
    color: ${BRAND.navy};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
    flex-shrink: 0;
  }
  ` : ''}

  ${slide.customCSS || ''}
</style>
</head>
<body>
  <div class="slide">
    ${heroImage && layout !== 'author-cta' ? '<div class="hero-image"></div>' : ''}
    ${heroImage && layout === 'author-cta' ? '<div class="hero-image"></div>' : ''}
    ${iconImage ? `<div style="position:absolute;top:56px;right:56px;width:96px;height:96px;background:url('${iconImage}') center/contain no-repeat;z-index:2;"></div>` : ''}
    ${innerHTML}
  </div>
</body>
</html>`;
}

async function generateCarousel(contentPath, outDir) {
  if (!existsSync(contentPath)) {
    console.error(`Error: content file not found: ${contentPath}`);
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(contentPath, 'utf-8'));
  const slides    = Array.isArray(parsed) ? parsed : parsed.slides;
  const brandStrip = Array.isArray(parsed) ? null : parsed.brandStrip;

  if (!Array.isArray(slides) || slides.length === 0) {
    console.error('Error: content file must be a non-empty JSON array or {brandStrip, slides} object.');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const baseDir = resolve(contentPath, '..');

  console.log(`\nGenerating ${slides.length} slides at ${SLIDE_W}x${SLIDE_H}px...`);

  const browser = await chromium.launch();
  const pngPaths = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = { ...slides[i], index: i + 1, total: slides.length };
    const padded  = String(i + 1).padStart(2, '0');
    const htmlPath = join(outDir, `slide-${padded}.html`);
    const pngPath  = join(outDir, `slide-${padded}.png`);

    const html = buildSlideHTML(slide, baseDir, brandStrip);
    writeFileSync(htmlPath, html, 'utf-8');

    const page = await browser.newPage();
    await page.setViewportSize({ width: SLIDE_W, height: SLIDE_H });
    await page.goto(`file://${resolve(htmlPath)}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.warn(`  Slide ${i + 1}: network idle timeout — continuing.`);
    });

    await page.screenshot({ path: pngPath, fullPage: false });
    await page.close();
    pngPaths.push(pngPath);
    console.log(`  Slide ${i + 1}/${slides.length} → ${pngPath}`);
  }

  await browser.close();

  const pdfPath  = join(outDir, 'carousel.pdf');
  const pngList  = pngPaths.map(p => `"${resolve(p)}"`).join(' ');
  const img2pdfBin = process.env.IMG2PDF_BIN || 'img2pdf';
  try {
    execSync(`${img2pdfBin} ${pngList} -o "${resolve(pdfPath)}"`, { stdio: 'inherit' });
  } catch {
    console.error('img2pdf failed. Install: pip3 install --user --break-system-packages img2pdf');
    process.exit(1);
  }

  console.log(`\nPDF: ${pdfPath}`);
  try {
    const bytes = execSync(`stat -f%z "${resolve(pdfPath)}"`).toString().trim();
    const mb = (parseInt(bytes, 10) / 1024 / 1024).toFixed(2);
    console.log(`Size: ${mb} MB${parseFloat(mb) > 3 ? ' ⚠️  compress with ghostscript' : ''}`);
  } catch {}

  console.log(`\nDone. Upload ${pdfPath} to LinkedIn as a document post.`);
  return pdfPath;
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx > -1 ? process.argv[idx + 1] : null;
}

const contentPath = getArg('--content') || 'slides.json';
const outDir      = getArg('--out') || './out';

generateCarousel(contentPath, outDir).catch(err => {
  console.error('Generator failed:', err);
  process.exit(1);
});
