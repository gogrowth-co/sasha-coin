"""Cover from OFFICIAL product images, deterministic (no AI): 1600x900 by default.

  python3 compose_cover.py --mode photo   --in official.jpg --out cover.jpg [--cx 0.5 --cy 0.5]
  python3 compose_cover.py --mode cutout  --in product.png [--in back.png] --out cover.jpg [--fill 0.8]

photo  : crop a scene/lifestyle photo to the cover ratio (no distortion).
cutout : place one or more product shots (transparent, white or flat background) centered on a background that matches
         the image's own corner color, so no box shows. Several inputs sit side by side (e.g. front and back of a module).
Check the result with your eyes (vision QA) and in the site's listing grid before publishing.
"""
import argparse
from PIL import Image

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('--mode', choices=['photo', 'cutout'], required=True)
ap.add_argument('--in', dest='inp', action='append', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--w', type=int, default=1600); ap.add_argument('--h', type=int, default=900)
ap.add_argument('--cx', type=float, default=0.5); ap.add_argument('--cy', type=float, default=0.5); ap.add_argument('--fill', type=float, default=0.82)
a = ap.parse_args(); W, H = a.w, a.h
if a.mode == 'photo':
    im = Image.open(a.inp[0]).convert('RGB'); r = W / H
    if im.width / im.height > r:
        nw = int(im.height * r); x = int((im.width - nw) * a.cx); im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = int(im.width / r); y = int((im.height - nh) * a.cy); im = im.crop((0, y, im.width, y + nh))
    if im.width < W * 0.6:
        print(f'warning: source is {im.width}px wide; the cover will be soft')
    im.resize((W, H), Image.LANCZOS).save(a.out, quality=88)
else:
    ims = []
    for f in a.inp:
        im = Image.open(f).convert('RGBA'); bb = im.getbbox(); ims.append(im.crop(bb) if bb else im)
    corner = Image.open(a.inp[0]).convert('RGBA').getpixel((2, 2))
    bg = (corner[:3] if corner[3] > 0 else (238, 243, 238))
    c = Image.new('RGB', (W, H), bg); gap = 80
    sc = []
    for im in ims:
        s = min(H * a.fill / im.height, (W * 0.9 / len(ims) - gap) / im.width); sc.append(im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS))
    x = (W - (sum(i.width for i in sc) + gap * (len(sc) - 1))) // 2
    for i in sc:
        c.paste(i, (x, (H - i.height) // 2), i); x += i.width + gap
    c.save(a.out, quality=88)
print(a.out)
