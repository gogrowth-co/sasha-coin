#!/usr/bin/env node
/**
 * page_shot.mjs - screenshot of an official page for an article visual, with cookie/consent overlays removed (2026-10-08).
 * Free (local Chromium); replaces paid screenshot APIs for this job. Born from a news run blocked because gov.br's consent bar covered
 * the official page in both captures and ScreenshotOne refused the hide request.
 *
 *   node page_shot.mjs --url <https://...> --out <file.png> [--width 1200] [--height 675] [--full] [--selector <css to capture>]
 *
 * Clicks common "accept" buttons, then hides consent/cookie/banner layers by selector and by fixed-position heuristics, waits for fonts,
 * and saves the PNG. Prints one JSON line {ok, file, removed, title}. Exit 0 ok, 1 failed.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const lang = arg('--lang', 'pt-BR');   // page language for the capture (Gabriel 2026-10-15: English screenshots for English articles)
let url = arg('--url'); const out = arg('--out');
// Google, YouTube and docs sites pick the UI language from hl=; force it to the capture language
try { const u = new URL(url); if (/(^|\.)(google|youtube|withgoogle|googleblog)\.com$/.test(u.hostname) && !u.searchParams.has('hl')) { u.searchParams.set('hl', lang.split('-')[0]); url = u.toString(); } } catch {}
if (!url || !out) { console.log(JSON.stringify({ ok: false, error: 'need --url and --out' })); process.exit(1); }
const W = Number(arg('--width', 1200)), H = Number(arg('--height', 675));
const HIDE = ['.br-cookiebar', '#cookiebar', '[class*="cookie" i]', '[id*="cookie" i]', '[class*="consent" i]', '[id*="consent" i]', '[class*="lgpd" i]', '[id*="lgpd" i]',
  '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.cc-window', '#CybotCookiebotDialog', '[aria-label*="cookie" i]', '[class*="vlibras" i]', '[vw]', '.vw-plugin-top-wrapper', '[vw-access-button]', '.vw-access-button', 'div[vw] *'];
const ACCEPT = /^(aceitar|aceito|aceitar todos|aceitar cookies|concordo|ok|entendi|accept|accept all|i agree|fechar)$/i;

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: lang, extraHTTPHeaders: { 'Accept-Language': `${lang},${lang.split('-')[0]};q=0.9` }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }));
  let clicked = 0;
  for (const b of await page.locator('button, a[role=button], input[type=button]').all()) {
    try { const t = (await b.innerText({ timeout: 300 })).trim(); if (ACCEPT.test(t) && await b.isVisible()) { await b.click({ timeout: 1000 }); clicked++; } } catch {}
  }
  const removed = await page.evaluate(sel => {
    let n = 0;
    for (const s of sel) for (const el of document.querySelectorAll(s)) { el.style.setProperty('display', 'none', 'important'); n++; }
    // any fixed/sticky layer covering the bottom or the whole screen with consent words is a banner, not content
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && /cookie|consent|privacidade|lgpd|aceit/i.test(el.textContent || '') && el.getBoundingClientRect().height > 40) { el.style.setProperty('display', 'none', 'important'); n++; }
    }
    document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto';
    return n;
  }, HIDE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const sel = arg('--selector');
  if (sel) await page.locator(sel).first().screenshot({ path: out });
  else await page.screenshot({ path: out, fullPage: process.argv.includes('--full') });
  console.log(JSON.stringify({ ok: true, file: resolve(out), clicked, removed, title: await page.title() }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.message).slice(0, 300) })); process.exitCode = 1;
} finally { await browser?.close(); }
