/* Cuts one listing thumbnail per product family out of the catalogue page scans.
     in : uploads/electrowood-claude-design/electro_catalogue_page_images/pNN_*.jpg  (901 × 1201 scans)
     out: assets/img/products/<family-id>-320.webp and -480.webp  (8:5)
   The scans are low resolution, so every crop is small and the 480 file is a mild upscale. When the
   business supplies original product photography, drop it in under the SAME filenames (or point a
   crop at a new source) and nothing else has to change.

   usage: node build/product-images.mjs [--sheet <contact-sheet.png>]
   Chrome does the resampling and WebP encoding (puppeteer-core is already installed via lighthouse),
   so no image library is needed. */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = createRequire(join(root, 'package.json'))('puppeteer-core');
const SRC = join(root, 'uploads/electrowood-claude-design/electro_catalogue_page_images');
const OUT = join(root, 'assets/img/products');
const WIDTHS = [320, 480];
const RATIO = 1.6; // 8:5 — matches the width/height attributes written by build/templates.mjs

/* family-id → { p: scan number, x, y, h }  (w = h × 1.6, in scan pixels).
   `pad: true` is for products photographed on plain white: crop wide, letterbox onto white. */
export const CROPS = {
  'venox-new-gen-modular-holder': { p: 5, x: 78, y: 770, h: 188 },
  'venox-5x5-holder-plate-white': { p: 6, x: 78, y: 258, h: 195 },
  'venox-6x6-7x7-holder-plate-white': { p: 7, x: 72, y: 258, h: 195 },
  'venox-holder-plate-black': { p: 8, x: 85, y: 258, h: 195 },
  'venox-holder-plate-grey': { p: 9, x: 85, y: 258, h: 195 },
  'venox-surface-oval-holder': { p: 10, x: 68, y: 720, h: 239 },
  'rio-holder-series': { p: 11, x: 62, y: 235, h: 211 },
  'star-series-white': { p: 12, x: 60, y: 225, h: 200 },
  'star-glossy-series': { p: 13, x: 175, y: 240, h: 190 },
  'star-matt-series': { p: 14, x: 55, y: 220, h: 200 },
  'modular-concealed-box-grey': { p: 16, x: 60, y: 192, h: 190 },
  'modular-concealed-box-orange': { p: 17, x: 60, y: 192, h: 190 },
  'modular-concealed-box-black': { p: 18, x: 60, y: 190, h: 190 },
  'metal-concealed-box-zinc-gi': { p: 19, x: 465, y: 560, h: 272 },
  'surface-gang-box-whiteline': { p: 20, x: 40, y: 225, h: 200 },
  'surface-box-silverline': { p: 21, x: 38, y: 240, h: 215 },
  'surface-box-whiteline': { p: 22, x: 38, y: 240, h: 215 },
  'cable-ties': { p: 23, x: 6, y: 200, h: 270 },
  'wire-circle-cable-clip': { p: 23, x: 40, y: 790, h: 244 },
  'modular-plate-silverline-blackline': { p: 24, x: 65, y: 215, h: 200 },
  'euro-accessories': { p: 25, x: 40, y: 215, h: 225 },
  'arc-distribution-box': { p: 26, x: 475, y: 258, h: 191 },
  'pvc-mcb-box': { p: 26, x: 480, y: 725, h: 250 },
  'tpn-distribution-box': { p: 26, x: 475, y: 940, h: 253 },
  'regulator-4pf': { p: 27, x: 40, y: 205, h: 250 },
  'fotolia-led-foot-light': { p: 27, x: 42, y: 755, h: 235 },
  'extension-cord-power-strip': { p: 28, x: 130, y: 188, w: 387, h: 135, pad: true },
  'nova-flex-board-series': { p: 29, x: 595, y: 172, w: 245, h: 232, pad: true },
  'pvc-simple-plate': { p: 30, x: 470, y: 235, h: 156 },
  'ezee-junction-box': { p: 30, x: 483, y: 412, h: 185 },
  'ezee-junction-modular-plate': { p: 30, x: 470, y: 650, h: 245 },
  'pvc-open-switch-board': { p: 31, x: 60, y: 205, h: 288 },
  'fancy-orange-surface-board': { p: 32, x: 3, y: 225, h: 275 },
  'drywall-black-screw': { p: 32, x: 44, y: 645, h: 249 },
  'door-bell': { p: 32, x: 33, y: 935, h: 255 },
};

const sheetArg = process.argv.indexOf('--sheet');
const sheetOut = sheetArg > 0 ? resolve(process.argv[sheetArg + 1]) : null;

const data = JSON.parse(readFileSync(join(root, 'products.json'), 'utf8'));
const missing = data.families.map((f) => f.id).filter((id) => !CROPS[id]);
const stray = Object.keys(CROPS).filter((id) => !data.families.some((f) => f.id === id));
if (missing.length || stray.length) throw new Error(`crop map out of sync with products.json — missing: [${missing}] unknown: [${stray}]`);

const scans = readdirSync(SRC);
const scanFor = (p) => {
  const f = scans.find((n) => n.startsWith(`p${String(p).padStart(2, '0')}_`));
  if (!f) throw new Error(`no catalogue scan for page ${p}`);
  return join(SRC, f);
};

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

const cache = new Map();
let n = 0;
for (const [id, c] of Object.entries(CROPS)) {
  const file = scanFor(c.p);
  if (!cache.has(file)) cache.set(file, 'data:image/jpeg;base64,' + readFileSync(file).toString('base64'));
  const w = c.w || Math.round(c.h * RATIO);
  const files = await page.evaluate(
    async (src, crop, widths, ratio) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const out = {};
      for (const W of widths) {
        const H = Math.round(W / ratio);
        const cv = document.getElementById('c');
        cv.width = W;
        cv.height = H;
        const g = cv.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H);
        if (crop.pad) {
          const k = Math.min(W / crop.w, H / crop.h);       // contain, centred, on white
          const dw = crop.w * k, dh = crop.h * k;
          g.drawImage(img, crop.x, crop.y, crop.w, crop.h, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } else {
          g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
        }
        const blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.86));
        out[W] = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
      }
      return out;
    },
    cache.get(file),
    { x: c.x, y: c.y, w, h: c.h, pad: !!c.pad },
    WIDTHS,
    RATIO
  );
  for (const W of WIDTHS) writeFileSync(join(OUT, `${id}-${W}.webp`), Buffer.from(files[W], 'base64'));
  n++;
}
console.log(`wrote ${n * WIDTHS.length} files to ${OUT.replace(root + '/', '')}`);

if (sheetOut) {
  const cells = data.families
    .map((f) => `<figure><img src="data:image/webp;base64,${readFileSync(join(OUT, `${f.id}-480.webp`)).toString('base64')}" width="320" height="200"><figcaption>${f.id}</figcaption></figure>`)
    .join('');
  await page.setViewport({ width: 1400, height: 900 });
  await page.setContent(`<style>body{margin:0;padding:12px;background:#ddd;display:grid;grid-template-columns:repeat(4,320px);gap:10px;font:11px/1.2 system-ui}figure{margin:0}img{display:block;border:1px solid #999}</style>${cells}`);
  await page.screenshot({ path: sheetOut, fullPage: true });
  console.log('contact sheet →', sheetOut);
}
await browser.close();
