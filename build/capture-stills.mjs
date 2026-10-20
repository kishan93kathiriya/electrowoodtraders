/* Regenerates the hero fallback stills + OG image from the REAL 3D scene (headless Chrome),
   so the static fallback is pixel-identical to what the canvas cross-fades into.
   `?freeze` pins the orbit clock at t=0 — exactly where a real visit's 3D starts.
   usage: npm run stills   (after npm run build; starts the preview server if needed) */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { ensureServer, BASE } from './shot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = createRequire(join(root, 'package.json'))('puppeteer-core');
const tmp = join(root, '.lighthouse');
mkdirSync(tmp, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = await ensureServer();
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--hide-scrollbars'],
});

async function open(vw, vh, dsf, mobile) {
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${BASE}/?freeze`, { waitUntil: 'networkidle0' });
  await page.mouse.move(vw * 0.3, 200);                                 // first intent → loads the 3D
  await page.waitForFunction(() => document.querySelector('#hero').classList.contains('is-3d'), { timeout: 20000 });
  await sleep(2500);                                                    // entrance animation + springs settle
  return page;
}

async function still(name, vw, vh, dsf, mobile, q) {
  const page = await open(vw, vh, dsf, mobile);
  await page.addStyleTag({ content: '.hero__fade,.tour--pinned,.tdots,.hero__plabels,.pop,.nav,.sheet,.skip,.hero__sweep,.hero__cue,.hero__bloom{visibility:hidden!important}.hero__still-wrap{display:none!important}.hero__stage::after{display:none!important}' });
  await sleep(500);
  const png = join(tmp, `${name}.png`);
  await (await page.$('.hero__stage')).screenshot({ path: png });
  execFileSync('cwebp', ['-quiet', '-q', String(q), '-m', '6', png, '-o', join(root, `assets/img/${name}.webp`)]);
  console.log(`  ${name}.webp  ${vw}x${vh} @${dsf}x`);
  await page.close();
}

async function og() {
  const page = await open(1200, 630, 1, false);
  await page.addStyleTag({ content: '.nav,.skip,.hero__cue,.hero__cats,.hero__hint{visibility:hidden!important}' });
  await sleep(500);
  await page.screenshot({ path: join(root, 'assets/img/og-image.jpg'), type: 'jpeg', quality: 84 });
  console.log('  og-image.jpg 1200x630');
  await page.close();
}

await still('hero-still', 1600, 1000, 1, false, 68);
await still('hero-still-m', 430, 900, 1.5, true, 64);
await og();
await browser.close();
if (child) { try { process.kill(-child.pid); } catch (e) { child.kill(); } }
