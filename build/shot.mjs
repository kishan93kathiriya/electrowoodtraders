/* Review harness — real frames, real GPU (headless Chrome + Metal), unlike the in-app browser pane
   which starves requestAnimationFrame.
   usage: node build/shot.mjs <out.png> [--path /modular-switches-plates/ --w 1440 --h 900 --dsf 1 --mobile --lightoff --freeze --reduced --no3d
                                          --wait 3500 --y <scrollY> --sel <css> --off 60 --settle 4500
                                          --click <css> --hover <css> --press Tab,Tab,Space --drag 120]
   Prints page state + console errors. Needs `npm run build` first. */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [out, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i < 0 ? d : rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const puppeteer = createRequire(join(root, 'package.json'))('puppeteer-core');

export const BASE = 'http://localhost:4173';
export async function ensureServer() {
  const up = () => new Promise((res) => http.get(BASE + '/', (r) => { r.resume(); res(true); }).on('error', () => res(false)));
  if (await up()) return null;
  const child = spawn('node', [join(root, 'build/serve.mjs')], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 30 && !(await up()); i++) await sleep(150);
  return child;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const child = await ensureServer();
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  const mobile = !!opt('mobile', false);
  await page.setViewport({ width: +opt('w', mobile ? 390 : 1440), height: +opt('h', mobile ? 844 : 900), deviceScaleFactor: +opt('dsf', 1), isMobile: mobile, hasTouch: mobile });
  if (opt('reduced', false)) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  const PATH = String(opt('path', '/'));
  await page.goto(BASE + PATH + (opt('freeze', false) ? '?freeze' : ''), { waitUntil: 'networkidle0' });
  if (PATH === '/' && !opt('reduced', false) && !opt('no3d', false)) {
    await page.mouse.move(+opt('w', 1440) * 0.3, 200);                       // first intent → loads the 3D
    try { await page.waitForFunction(() => document.querySelector('#hero').classList.contains('is-3d'), { timeout: 15000 }); }
    catch { logs.push('[harness] 3D never became ready'); }
  }
  await sleep(+opt('wait', 3500));
  if (opt('lightoff', false)) { await page.click('[data-switch]'); await sleep(2600); }
  if (opt('click', false)) { await page.click(String(opt('click'))); await sleep(1400); }
  if (opt('press', false)) { for (const k of String(opt('press')).split(',')) { await page.keyboard.press(k); await sleep(120); } await sleep(900); }
  const y = opt('y', false);
  if (y !== false) { await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), +y); await sleep(+opt('settle', 4500)); }
  const sel = opt('sel', false);
  if (sel) { await page.evaluate((s, off) => { const el = document.querySelector(s); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: 'instant' }); }, String(sel), +opt('off', 60)); await sleep(+opt('settle', 4500)); }
  if (opt('drag', false)) {
    const dx = +opt('drag');
    await page.mouse.move(900, 450); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(900 + (dx * i) / 8, 450); await sleep(16); }
    await page.mouse.up(); await sleep(1500);
  }
  if (opt('hover', false)) {
    if (/^\d+,\d+$/.test(String(opt('hover')))) { const [hx, hy] = String(opt('hover')).split(',').map(Number); await page.mouse.move(hx, hy); }
    else await page.hover(String(opt('hover')));
    await sleep(900);
  }
  await page.screenshot({ path: out });
  const info = await page.evaluate(() => ({ cls: (document.querySelector('#hero') || {}).className, light: (document.querySelector('#hero') || { dataset: {} }).dataset.light, scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  console.log(JSON.stringify(info));
  if (logs.length) console.log(logs.join('\n'));
  await browser.close();
  if (child) { try { process.kill(-child.pid); } catch (e) { child.kill(); } }
}
