/* Real cost of the 3D path, throttled CPU (default 4× ≈ mid-range phone), real GPU.
   Reports: time-to-3D after first intent, init main-thread cost, steady orbit cost,
   cost while PAUSED (should be ~0: the loop sleeps), and long tasks.
   usage: npm run perf3d [-- 6]          (needs a built site; starts the preview server if needed) */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureServer, BASE } from './shot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slow = +(process.argv[2] || 4);
const puppeteer = createRequire(join(root, 'package.json'))('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = await ensureServer();
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
await page.evaluateOnNewDocument(() => {
  window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
});
await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(1500);
const a = await m();
const t0 = Date.now();
await page.touchscreen.touchStart(200, 600); await page.touchscreen.touchEnd();      // first intent → 3D starts
await page.waitForFunction(() => document.querySelector('#hero').classList.contains('is-3d'), { timeout: 40000 }).catch(() => {});
const readyMs = Date.now() - t0;
const cls = await page.evaluate(() => document.querySelector('#hero').className);
const b = await m();
await sleep(6000);                                                                   // steady orbit
const c = await m();
await page.evaluate(() => document.querySelector('[data-pause]').click());           // pause → loop should sleep
await sleep(2500);
const c2 = await m();
await sleep(3000);
const d = await m();
const lt = await page.evaluate(() => window.__lt);
const ms = (x) => Math.round(x * 1000);
console.log(`CPU slowdown ${slow}x · ready (is-3d) ${readyMs} ms after first touch · class: ${cls}`);
console.log(`init main-thread          : ${ms(b.TaskDuration - a.TaskDuration)} ms task / ${ms(b.ScriptDuration - a.ScriptDuration)} ms script`);
console.log(`steady orbit (6 s)        : ${ms(c.TaskDuration - b.TaskDuration)} ms task  (${Math.round(((c.TaskDuration - b.TaskDuration) / 6) * 100)}% of one core)`);
console.log(`paused, idle (3 s)        : ${ms(d.TaskDuration - c2.TaskDuration)} ms task   <-- ~0 means the loop sleeps`);
console.log('long tasks [start,dur]    :', JSON.stringify(lt.slice(0, 12)));
await browser.close();
if (child) { try { process.kill(-child.pid); } catch (e) { child.kill(); } }
