// Rendered HTML of a client-side page (SPA): node render.cjs <url>  -> prints document.documentElement.outerHTML
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/128 Safari/537.36' });
    await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(1500);
    process.stdout.write(await p.content());
  } finally {
    await b.close();   // also on a failed load, so no Chromium is left running
  }
})().catch(e => { console.error(e.message); process.exit(1); });
