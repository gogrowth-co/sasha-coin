---
name: product-imagery
description: Project-agnostic rule and tooling for images of REAL products (apps, tokens, tools, devices, vehicles, inverters, panels...) in any project's articles, product pages, social posts and covers. Use whenever content shows or reviews a specific real product, when choosing a cover/hero/OG image for a product page, or when an AI image would depict a real brand or model.
---

# Product Imagery (all projects)

**Rule (Gabriel, 2026-10-07):** "we need REAL product images (either from the manufacturer or/and rebuild with AI using the
real product as reference)". In order of preference:
1. **Official image**: manufacturer product page, press kit, gallery, official app screenshot, or the datasheet PDF itself.
   Caption credit: `Foto: divulgação <owner>` / `Image: <owner> press material`, and link the source in the text.
2. **AI from the official reference**: when no official image is usable (too small, wrong angle, only text), generate with
   the official image as the reference input, faithful to the real model (shape, colors, logos, proportions), and label it
   `Imagem gerada por IA a partir de foto oficial de <owner>`. Vision-check it against the reference before use.
3. Generic illustration only for pages that are NOT about one specific product (guides, comparisons of methods).

**Never:** an AI render invented from a text prompt (it invents logos and look-alike models: the 2026-10-07 EkkoGreen pages
had fake "solis" logos and an EX2 look-alike), and never the same stock picture on several product pages (three EV pages showed
one identical charging photo in the archive grid).

## Workflow
1. Find candidates: `python3 scripts/find_official_images.py --page <official product URL> [--pdf <datasheet URL>] --out <dir>`
   (og:image, gallery, srcset, CMS media, datasheet images; skips logos/icons/flags/stock). Files named `...-ai...` on a maker's
   site are the maker's own AI scenes: prefer a real photo. Sites that block scripts: Playwright download (`acceptDownloads`)
   or another host; Firecrawl screenshot only as last resort (it includes overlays).
2. Look at every candidate (vision QA) and pick the real product shot at the largest size.
3. Compose the cover: `python3 scripts/compose_cover.py --mode photo|cutout --in <file> [--in <file2>] --out cover.jpg`
   (1600x900; cutouts sit on the image's own background color so no box shows; front + back side by side works).
4. Upload with alt text describing the product and the credit as caption. Set it as the featured/OG image.
5. Check the listing grid (category/tag/related) in a browser after a cache purge: every product card must show its own product.

## Enforcement
- `content-qa-gate` blocks: product page cover that is an AI render file (`ai-product-render`, `product-render` markers),
  the same cover on two or more product pages, missing cover; and at plan time, a product plan without `cover.kind` =
  `official` or `ai_from_official` with a `cover.source`.
- Each project's contract carries the rule under `components.images.real_product` (EkkoGreen: `produto_real`).
- Rights: official press/product images are used editorially with credit. If an owner objects, replace with option 2.
